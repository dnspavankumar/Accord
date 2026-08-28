"""Guardrail policy configuration and explainable evaluation results."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from ..models.ledger import PolicyStatus


class PolicySettings(BaseModel):
    """Merchant policy defaults used by the deterministic guardrail engine."""

    model_config = ConfigDict(frozen=True)

    max_transaction_limit_inr: Decimal = Field(default=Decimal("25000.00"), gt=0)
    max_quantity_per_item: int = Field(default=5, gt=0)
    allowed_currency: str = Field(default="INR", min_length=3, max_length=3)
    velocity_limit: int = Field(default=30, gt=0)
    velocity_window_seconds: int = Field(default=3600, gt=0)


class PolicyResult(BaseModel):
    """Stable result returned by a policy evaluation."""

    approved: bool
    policy_status: PolicyStatus
    reason: str = Field(min_length=1)
    total_amount: Decimal = Field(ge=0, decimal_places=2)
    intent_hash: str
    evaluated_at: datetime
