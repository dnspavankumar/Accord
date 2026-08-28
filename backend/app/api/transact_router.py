"""AP2 mandate transaction pipeline."""

from __future__ import annotations

import uuid
import json
from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models.ledger import AuditLedger, ExecutionStatus, PolicyStatus
from ..models.product import Product
from ..schemas.ap2_mandate import IntentMandate
from ..schemas.ap2_mandate import CartItem
from ..config import get_settings
from ..services.guardrail_engine import GuardrailEngine
from ..services.razorpay_client import RazorpayClient, RazorpayError
from ..services.recovery_engine import RecoveryEngine, RecoveryResult
from ..services.policy_service import get_policy

from .telemetry import telemetry_hub

router = APIRouter(prefix="/api/v1/accord", tags=["Transactions"])


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: uuid.UUID
    timestamp: datetime
    buyer_agent_id: str
    intent_hash: str
    requested_amount: Decimal
    policy_status: PolicyStatus | None
    execution_status: ExecutionStatus
    explanation: str
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    failure_reason: str | None = None
    recovery_attempted: bool


class MerchantDashboardResponse(BaseModel):
    received_amount: Decimal
    received_payment_count: int
    recovered_payment_count: int
    payments: list[TransactionResponse]


class CheckoutPrepareRequest(BaseModel):
    protocol_version: Literal["AP2-2026"] = "AP2-2026"
    buyer_agent_id: str
    cart: list[CartItem] = Field(min_length=1)
    max_authorized_amount: Decimal = Field(gt=0, decimal_places=2, max_digits=12)
    currency: Literal["INR"] = "INR"


class CheckoutPrepareResponse(BaseModel):
    transaction_id: uuid.UUID
    order_id: str
    key_id: str | None
    amount_in_paise: int
    currency: str
    status: ExecutionStatus


class CheckoutConfirmRequest(BaseModel):
    razorpay_payment_id: str = Field(min_length=1, max_length=128)
    razorpay_signature: str = Field(min_length=1, max_length=256)


async def _publish(ledger: AuditLedger, explanation: str) -> None:
    await telemetry_hub.publish(
        {
            "transaction_id": str(ledger.transaction_id),
            "timestamp": ledger.timestamp,
            "buyer_agent_id": ledger.buyer_agent_id,
            "intent_hash": ledger.intent_hash,
            "policy_status": ledger.policy_status.value if ledger.policy_status else None,
            "execution_status": ledger.execution_status.value,
            "amount": str(ledger.requested_amount),
            "requested_amount": str(ledger.requested_amount),
            "explanation": explanation,
            "razorpay_order_id": ledger.razorpay_order_id,
            "razorpay_payment_id": ledger.razorpay_payment_id,
        }
    )


def _cart_amount(mandate: IntentMandate) -> Decimal:
    return sum(
        (item.unit_price * item.quantity for item in mandate.cart),
        Decimal("0.00"),
    )


async def _reserve_inventory(session: AsyncSession, mandate: IntentMandate) -> None:
    quantities: dict[str, int] = {}
    for item in mandate.cart:
        quantities[item.sku] = quantities.get(item.sku, 0) + item.quantity
    rows = await session.execute(
        select(Product).where(Product.sku.in_(quantities), Product.is_active.is_(True))
    )
    products = {product.sku: product for product in rows.scalars().all()}
    for sku, quantity in quantities.items():
        product = products.get(sku)
        if product is None or product.stock_quantity < quantity:
            raise ValueError(f"Inventory changed before reservation for SKU {sku}.")
    for sku, quantity in quantities.items():
        products[sku].stock_quantity -= quantity
    await session.flush()


async def _release_inventory(session: AsyncSession, mandate: IntentMandate) -> None:
    quantities: dict[str, int] = {}
    for item in mandate.cart:
        quantities[item.sku] = quantities.get(item.sku, 0) + item.quantity
    rows = await session.execute(select(Product).where(Product.sku.in_(quantities)))
    products = {product.sku: product for product in rows.scalars().all()}
    for sku, quantity in quantities.items():
        if sku in products:
            products[sku].stock_quantity += quantity
    await session.flush()


def _response(ledger: AuditLedger, explanation: str) -> TransactionResponse:
    return TransactionResponse(
        transaction_id=ledger.transaction_id,
        timestamp=ledger.timestamp,
        buyer_agent_id=ledger.buyer_agent_id,
        intent_hash=ledger.intent_hash,
        requested_amount=ledger.requested_amount,
        policy_status=ledger.policy_status,
        execution_status=ledger.execution_status,
        explanation=explanation,
        razorpay_order_id=ledger.razorpay_order_id,
        razorpay_payment_id=ledger.razorpay_payment_id,
        failure_reason=ledger.failure_reason,
        recovery_attempted=ledger.recovery_attempted,
    )


@router.get("/transactions", response_model=list[TransactionResponse])
async def transactions(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TransactionResponse]:
    """Return recent durable transactions for the operator console."""
    rows = await session.execute(
        select(AuditLedger)
        .order_by(AuditLedger.timestamp.desc())
        .limit(limit)
    )
    return [_response(ledger, ledger.failure_reason or "Transaction recorded.") for ledger in rows.scalars().all()]


@router.get("/merchant/dashboard", response_model=MerchantDashboardResponse)
async def merchant_dashboard(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, ge=1, le=500),
) -> MerchantDashboardResponse:
    """Return payments received by the merchant from durable ledger records."""
    rows = await session.execute(
        select(AuditLedger)
        .where(AuditLedger.razorpay_payment_id.is_not(None))
        .order_by(AuditLedger.timestamp.desc())
        .limit(limit)
    )


@router.post("/merchant/checkout/prepare", response_model=CheckoutPrepareResponse)
async def prepare_checkout(
    mandate: CheckoutPrepareRequest,
    session: AsyncSession = Depends(get_session),
) -> CheckoutPrepareResponse:
    """Validate a merchant checkout and create an unpaid Razorpay order."""
    full_mandate = IntentMandate(
        buyer_agent_id=mandate.buyer_agent_id,
        cart=mandate.cart,
        max_authorized_amount=mandate.max_authorized_amount,
        currency=mandate.currency,
        payment_method={"provider": "razorpay", "token": "checkout_pending"},
    )
    guardrails = GuardrailEngine(session=session, settings=get_policy())
    policy = await guardrails.evaluate_mandate(full_mandate)
    if not policy.approved:
        raise HTTPException(status_code=422, detail=policy.reason)

    ledger = AuditLedger(
        transaction_id=uuid.uuid4(),
        buyer_agent_id=mandate.buyer_agent_id,
        intent_hash=policy.intent_hash,
        requested_amount=policy.total_amount,
        policy_status=policy.policy_status,
        execution_status=ExecutionStatus.PENDING_PAYMENT,
    )
    try:
        await _reserve_inventory(session, full_mandate)
        order = RazorpayClient().create_order(
            amount_in_paise=RazorpayClient.to_paise(policy.total_amount),
            currency=mandate.currency,
            receipt_id=str(ledger.transaction_id),
        )
        ledger.razorpay_order_id = order.get("id")
        session.add(ledger)
        await session.commit()
    except (RazorpayError, ValueError) as exc:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return CheckoutPrepareResponse(
        transaction_id=ledger.transaction_id,
        order_id=ledger.razorpay_order_id,
        key_id=get_settings().razorpay_key_id,
        amount_in_paise=RazorpayClient.to_paise(policy.total_amount),
        currency=mandate.currency,
        status=ledger.execution_status,
    )


@router.post("/merchant/checkout/{transaction_id}/confirm", response_model=TransactionResponse)
async def confirm_checkout(
    transaction_id: uuid.UUID,
    payment: CheckoutConfirmRequest,
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    """Verify Checkout's order/payment signature and settle the ledger."""
    ledger = await session.get(AuditLedger, transaction_id)
    if ledger is None or ledger.razorpay_order_id is None:
        raise HTTPException(status_code=404, detail="Checkout transaction not found.")
    if ledger.execution_status == ExecutionStatus.SETTLED:
        return _response(ledger, "Payment was already verified.")
    if ledger.execution_status != ExecutionStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=409, detail="Checkout is not awaiting payment.")
    if not RazorpayClient().verify_payment_signature(
        ledger.razorpay_order_id, payment.razorpay_payment_id, payment.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Razorpay payment signature verification failed.")
    ledger.razorpay_payment_id = payment.razorpay_payment_id
    ledger.execution_status = ExecutionStatus.SETTLED
    await session.commit()
    await _publish(ledger, "Razorpay Checkout payment verified and settled.")
    return _response(ledger, "Razorpay Checkout payment verified and settled.")


@router.post("/merchant/webhooks/razorpay", status_code=status.HTTP_204_NO_CONTENT)
async def razorpay_webhook(request: Request, session: AsyncSession = Depends(get_session)) -> None:
    """Accept captured-payment webhooks after verifying Razorpay's signature."""
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not RazorpayClient.verify_webhook_signature(body, signature, get_settings().razorpay_webhook_secret):
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature.")
    payload = json.loads(body)
    if payload.get("event") != "payment.captured":
        return
    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not order_id or not payment_id:
        return
    ledger = await session.scalar(select(AuditLedger).where(AuditLedger.razorpay_order_id == order_id))
    if ledger is None or ledger.execution_status == ExecutionStatus.SETTLED:
        return
    ledger.razorpay_payment_id = payment_id
    ledger.execution_status = ExecutionStatus.SETTLED
    await session.commit()
    ledgers = list(rows.scalars().all())
    successful = [
        ledger for ledger in ledgers
        if ledger.execution_status in (ExecutionStatus.SETTLED, ExecutionStatus.FAILED_RECOVERED)
    ]
    return MerchantDashboardResponse(
        received_amount=sum((ledger.requested_amount for ledger in successful), Decimal("0.00")),
        received_payment_count=len(successful),
        recovered_payment_count=sum(
            ledger.execution_status == ExecutionStatus.FAILED_RECOVERED for ledger in successful
        ),
        payments=[
            _response(ledger, ledger.failure_reason or "Payment received successfully.")
            for ledger in successful
        ],
    )


@router.post("/transact", response_model=TransactionResponse)
async def transact(
    mandate: IntentMandate,
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    """Execute an AP2 mandate through policy, inventory and payment rails."""
    intent_hash = GuardrailEngine.intent_hash(mandate)
    ledger = AuditLedger(
        transaction_id=uuid.uuid4(),
        buyer_agent_id=mandate.buyer_agent_id,
        intent_hash=intent_hash,
        requested_amount=_cart_amount(mandate),
        execution_status=ExecutionStatus.INITIATED,
    )
    session.add(ledger)
    await session.flush()
    await _publish(ledger, "Mandate parsed and audit ledger initialized.")

    guardrails = GuardrailEngine(session=session, settings=get_policy())
    policy = await guardrails.evaluate_mandate(mandate)
    ledger.policy_status = policy.policy_status
    ledger.requested_amount = policy.total_amount
    await session.flush()
    await _publish(ledger, policy.reason)

    if not policy.approved:
        ledger.execution_status = ExecutionStatus.GATED
        await session.commit()
        await _publish(ledger, policy.reason)
        return _response(ledger, policy.reason)

    try:
        await _reserve_inventory(session, mandate)
        ledger.execution_status = ExecutionStatus.GATED
        await session.flush()
        await _publish(ledger, "Guardrails passed and inventory was reserved.")

        razorpay = RazorpayClient()
        order = razorpay.create_order(
            amount_in_paise=razorpay.to_paise(policy.total_amount),
            currency=mandate.currency,
            receipt_id=str(ledger.transaction_id),
        )
        ledger.razorpay_order_id = order.get("id")
        await session.flush()
        await _publish(ledger, "Razorpay order created.")

        async def release_reserved_inventory(_: IntentMandate) -> None:
            await _release_inventory(session, mandate)

        recovery = RecoveryEngine(
            razorpay_client=razorpay,
            inventory_release=release_reserved_inventory,
        )
        result: RecoveryResult = await recovery.execute_with_recovery(
            ledger, mandate, session
        )
        await session.commit()
        await _publish(ledger, result.explanation)
        return _response(ledger, result.explanation)
    except (RazorpayError, ValueError) as exc:
        await _release_inventory(session, mandate)
        ledger.execution_status = ExecutionStatus.TERMINATED
        ledger.failure_reason = str(exc)
        await session.commit()
        await _publish(ledger, str(exc))
        return _response(ledger, str(exc))
    except Exception:
        await session.rollback()
        raise
