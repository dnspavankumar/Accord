"""AP2 purchase mandate validation models."""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(gt=0, decimal_places=2, max_digits=12)]


class CartItem(BaseModel):
    """A SKU and requested quantity in an agent cart."""

    model_config = ConfigDict(extra="forbid")

    sku: str = Field(min_length=1, max_length=128)
    quantity: int = Field(gt=0)
    unit_price: Money


class PaymentMethod(BaseModel):
    """Tokenized payment rail supplied by the buyer agent."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=1, max_length=64)
    token: str = Field(min_length=1, max_length=256)
    simulate_failure: bool = False


class IntentMandate(BaseModel):
    """Signed-intent portion of an AP2 purchase request."""

    model_config = ConfigDict(extra="forbid")

    protocol_version: Literal["AP2-2026"] = "AP2-2026"
    buyer_agent_id: str = Field(min_length=1, max_length=256)
    cart: list[CartItem] = Field(min_length=1)
    max_authorized_amount: Money
    currency: Literal["INR"] = "INR"
    payment_method: PaymentMethod
    # Optional because Phase 1 clients may omit it. When supplied, Phase 2
    # recomputes the canonical mandate hash and rejects tampered requests.
    intent_hash: str | None = Field(default=None, min_length=64, max_length=64)


class CartMandate(IntentMandate):
    """Cart-specific AP2 mandate; retained as a distinct protocol type."""
