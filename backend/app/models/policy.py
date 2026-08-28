"""Persisted merchant guardrail configuration."""

from decimal import Decimal
import uuid

from sqlalchemy import ForeignKey, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .ledger import Base


class PolicyConfig(Base):
    __tablename__ = "policy_config"

    merchant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("merchants.id"), primary_key=True)
    max_transaction_limit_inr: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    max_quantity_per_item: Mapped[int] = mapped_column(Integer, nullable=False)
    allowed_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    velocity_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    velocity_window_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)
