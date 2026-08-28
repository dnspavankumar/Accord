"""Auditable transaction ledger model."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class shared by Accord's SQLAlchemy models."""


class PolicyStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED_CAP = "REJECTED_CAP"
    REJECTED_VELOCITY = "REJECTED_VELOCITY"


class ExecutionStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    GATED = "GATED"
    PENDING_PAYMENT = "PENDING_PAYMENT"
    SETTLED = "SETTLED"
    FAILED_RECOVERED = "FAILED_RECOVERED"
    TERMINATED = "TERMINATED"


class AuditLedger(Base):
    """One durable, queryable record for an agent transaction."""

    __tablename__ = "audit_ledger"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("merchants.id"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    buyer_agent_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    intent_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    requested_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    policy_status: Mapped[PolicyStatus | None] = mapped_column(
        Enum(PolicyStatus, native_enum=False), nullable=True
    )
    razorpay_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    execution_status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus, native_enum=False),
        nullable=False,
        default=ExecutionStatus.INITIATED,
    )
    failure_reason: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    recovery_attempted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )


class TransactionItem(Base):
    """Immutable product/price snapshot for a transaction."""

    __tablename__ = "transaction_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("audit_ledger.transaction_id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class PaymentEvent(Base):
    """Deduplicated payment-provider webhook event."""

    __tablename__ = "payment_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String(256), nullable=False, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InventoryReservation(Base):
    """Stock held for a checkout until payment or expiry."""

    __tablename__ = "inventory_reservations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("audit_ledger.transaction_id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
