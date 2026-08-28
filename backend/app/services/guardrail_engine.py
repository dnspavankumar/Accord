"""Deterministic pre-payment policy evaluation for AP2 mandates."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ledger import AuditLedger, PolicyStatus
from ..models.product import Product
from ..schemas.ap2_mandate import IntentMandate
from ..schemas.policy import PolicyResult, PolicySettings


class GuardrailEngine:
    """Evaluates mandates before an order is sent to a payment provider."""

    def __init__(
        self,
        session: AsyncSession | None = None,
        settings: PolicySettings | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or PolicySettings()

    @staticmethod
    def intent_hash(mandate: IntentMandate) -> str:
        """Return the SHA-256 hash of the canonical, unsigned mandate payload."""

        payload = mandate.model_dump(mode="json", exclude={"intent_hash"})
        canonical_payload = json.dumps(
            payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode("utf-8")
        return hashlib.sha256(canonical_payload).hexdigest()

    @staticmethod
    def _result(
        *,
        approved: bool,
        status: PolicyStatus,
        reason: str,
        amount: Decimal,
        intent_hash: str,
    ) -> PolicyResult:
        return PolicyResult(
            approved=approved,
            policy_status=status,
            reason=reason,
            total_amount=amount,
            intent_hash=intent_hash,
            evaluated_at=datetime.now(timezone.utc),
        )

    async def evaluate_mandate(
        self,
        mandate: IntentMandate,
        session: AsyncSession | None = None,
    ) -> PolicyResult:
        """Evaluate currency, quantity, price, stock, cap and velocity rules.

        Product prices and stock are always read from the database when a
        session is available. This prevents an agent from authorizing a stale
        or manipulated cart price.
        """

        db = session or self.session
        current_hash = self.intent_hash(mandate)
        requested_hash = mandate.intent_hash
        if requested_hash is not None and requested_hash != current_hash:
            return self._result(
                approved=False,
                status=PolicyStatus.REJECTED_CAP,
                reason="Intent hash verification failed: mandate contents do not match the supplied SHA-256 hash.",
                amount=Decimal("0.00"),
                intent_hash=current_hash,
            )

        if mandate.currency != self.settings.allowed_currency:
            return self._result(
                approved=False,
                status=PolicyStatus.REJECTED_CAP,
                reason=f"Currency {mandate.currency} is not permitted; only {self.settings.allowed_currency} is accepted.",
                amount=Decimal("0.00"),
                intent_hash=current_hash,
            )

        requested_quantities: dict[str, int] = {}
        for item in mandate.cart:
            requested_quantities[item.sku] = requested_quantities.get(item.sku, 0) + item.quantity
            if requested_quantities[item.sku] > self.settings.max_quantity_per_item:
                return self._result(
                    approved=False,
                    status=PolicyStatus.REJECTED_CAP,
                    reason=(
                        f"Quantity for {item.sku} is {requested_quantities[item.sku]}; the policy allows "
                        f"at most {self.settings.max_quantity_per_item} per item."
                    ),
                    amount=Decimal("0.00"),
                    intent_hash=current_hash,
                )

        total = Decimal("0.00")
        products: dict[str, Product] = {}
        if db is not None:
            skus = [item.sku for item in mandate.cart]
            rows = await db.execute(
                select(Product).where(Product.sku.in_(skus), Product.is_active.is_(True))
            )
            products = {product.sku: product for product in rows.scalars().all()}

        for item in mandate.cart:
            product = products.get(item.sku)
            if product is None:
                return self._result(
                    approved=False,
                    status=PolicyStatus.REJECTED_CAP,
                    reason=f"SKU {item.sku} is not available in the live catalog.",
                    amount=total,
                    intent_hash=current_hash,
                )
            if item.quantity > product.stock_quantity:
                return self._result(
                    approved=False,
                    status=PolicyStatus.REJECTED_CAP,
                    reason=(
                        f"Insufficient live stock for {item.sku}: requested {item.quantity}, "
                        f"available {product.stock_quantity}."
                    ),
                    amount=total,
                    intent_hash=current_hash,
                )
            total += Decimal(product.price) * item.quantity

        if total > self.settings.max_transaction_limit_inr:
            return self._result(
                approved=False,
                status=PolicyStatus.REJECTED_CAP,
                reason=(
                    f"Cart total ₹{total:.2f} exceeds the merchant transaction cap "
                    f"of ₹{self.settings.max_transaction_limit_inr:.2f}."
                ),
                amount=total,
                intent_hash=current_hash,
            )
        if total > mandate.max_authorized_amount:
            return self._result(
                approved=False,
                status=PolicyStatus.REJECTED_CAP,
                reason=(
                    f"Cart total ₹{total:.2f} exceeds the buyer authorization of "
                    f"₹{mandate.max_authorized_amount:.2f}."
                ),
                amount=total,
                intent_hash=current_hash,
            )

        if db is not None:
            since = datetime.now(timezone.utc) - timedelta(
                seconds=self.settings.velocity_window_seconds
            )
            count = await db.scalar(
                select(func.count(AuditLedger.transaction_id)).where(
                    AuditLedger.buyer_agent_id == mandate.buyer_agent_id,
                    AuditLedger.timestamp >= since,
                )
            )
            if (count or 0) >= self.settings.velocity_limit:
                return self._result(
                    approved=False,
                    status=PolicyStatus.REJECTED_VELOCITY,
                    reason=(
                        f"Buyer agent {mandate.buyer_agent_id} has made {count} "
                        f"transactions in the last {self.settings.velocity_window_seconds // 60} minutes; "
                        f"the limit is {self.settings.velocity_limit}."
                    ),
                    amount=total,
                    intent_hash=current_hash,
                )

        return self._result(
            approved=True,
            status=PolicyStatus.APPROVED,
            reason=(
                f"Mandate approved: cart total ₹{total:.2f} is within authorization, "
                "merchant cap, stock, quantity, currency, and velocity policies."
            ),
            amount=total,
            intent_hash=current_hash,
        )
