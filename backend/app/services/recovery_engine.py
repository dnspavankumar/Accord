"""Deterministic payment failure recovery and ledger state transitions."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ledger import AuditLedger, ExecutionStatus
from ..schemas.ap2_mandate import IntentMandate

from .razorpay_client import RazorpayClient, RazorpayError

FALLBACK_TOKEN = "tok_test_card_success"
RECOVERY_NOTE = "Primary payment token invalid. Gracefully recovered via secondary agent mandate rail."


@dataclass(frozen=True)
class RecoveryResult:
    success: bool
    execution_status: ExecutionStatus
    payment_id: str | None
    explanation: str


class RecoveryEngine:
    """Attempts the primary token once, then one deterministic fallback."""

    def __init__(self, razorpay_client: RazorpayClient | None = None, inventory_release: Callable[[IntentMandate], Awaitable[None]] | None = None) -> None:
        self.razorpay = razorpay_client or RazorpayClient()
        self.inventory_release = inventory_release

    async def _flush(self, session: AsyncSession | None) -> None:
        if session is not None:
            await session.flush()

    async def _release_inventory(self, mandate: IntentMandate) -> None:
        if self.inventory_release is not None:
            await self.inventory_release(mandate)

    async def execute_with_recovery(self, ledger: AuditLedger, mandate: IntentMandate, session: AsyncSession | None = None) -> RecoveryResult:
        """Capture the primary token and recover once on failure."""
        amount_paise = self.razorpay.to_paise(Decimal(ledger.requested_amount))
        primary_error: str | None = None
        try:
            if mandate.payment_method.simulate_failure:
                raise RazorpayError("Primary payment token declined (simulated failure).")
            payment = self.razorpay.capture_payment(mandate.payment_method.token, amount_paise)
            ledger.razorpay_payment_id = payment.get("id", mandate.payment_method.token)
            ledger.execution_status = ExecutionStatus.SETTLED
            await self._flush(session)
            return RecoveryResult(True, ExecutionStatus.SETTLED, ledger.razorpay_payment_id, "Primary payment captured successfully.")
        except Exception as exc:
            primary_error = str(exc)
            ledger.recovery_attempted = True
            ledger.failure_reason = f"Primary payment declined: {primary_error}"
            await self._flush(session)

        try:
            payment = self.razorpay.capture_payment(FALLBACK_TOKEN, amount_paise)
            ledger.razorpay_payment_id = payment.get("id", FALLBACK_TOKEN)
            ledger.execution_status = ExecutionStatus.FAILED_RECOVERED
            ledger.failure_reason = RECOVERY_NOTE
            await self._flush(session)
            return RecoveryResult(True, ExecutionStatus.FAILED_RECOVERED, ledger.razorpay_payment_id, RECOVERY_NOTE)
        except Exception as exc:
            ledger.execution_status = ExecutionStatus.TERMINATED
            ledger.failure_reason = f"Primary payment declined: {primary_error}. Fallback payment also failed: {exc}"
            await self._release_inventory(mandate)
            await self._flush(session)
            return RecoveryResult(False, ExecutionStatus.TERMINATED, None, ledger.failure_reason)
