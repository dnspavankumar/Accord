"""Pydantic representations of Accord's AP2 JSON-LD product feed."""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(ge=0, decimal_places=2, max_digits=12)]
PositiveStock = Annotated[int, Field(ge=0)]


class AP2Offer(BaseModel):
    """The price and availability information exposed for a product."""

    model_config = ConfigDict(populate_by_name=True)

    context: str = Field(
        default="https://schema.org/", alias="@context", exclude=True
    )
    type: Literal["Offer"] = Field(default="Offer", alias="@type")
    price: Money
    price_currency: Literal["INR"] = Field(default="INR", alias="priceCurrency")
    availability: str = "https://schema.org/InStock"


class AP2Product(BaseModel):
    """An AP2 data-feed product entry."""

    model_config = ConfigDict(populate_by_name=True)

    context: str = Field(
        default="https://schema.org/", alias="@context", exclude=True
    )
    type: Literal["Product"] = Field(default="Product", alias="@type")
    sku: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=2000)
    price: Money
    currency: Literal["INR"] = "INR"
    stock_quantity: PositiveStock
    category: str = Field(min_length=1, max_length=128)
    offers: AP2Offer | None = None


class AP2Catalog(BaseModel):
    """Top-level AP2 JSON-LD DataFeed."""

    model_config = ConfigDict(populate_by_name=True)

    context: str = Field(
        default="https://schema.org/", alias="@context"
    )
    type: Literal["DataFeed"] = Field(default="DataFeed", alias="@type")
    data_feed_element: list[AP2Product] = Field(
        default_factory=list, alias="dataFeedElement"
    )
