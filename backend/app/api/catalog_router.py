"""Merchant catalog management endpoints."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models.product import Product
from ..models import Merchant
from ..security import get_current_merchant

router = APIRouter(prefix="/api/v1/merchant/catalog", tags=["Merchant Catalog"])


class MerchantProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    name: str
    description: str
    price: Decimal
    currency: str
    stock_quantity: int
    category: str
    is_active: bool


class ProductInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=2000)
    price: Decimal = Field(gt=0, decimal_places=2, max_digits=12)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    stock_quantity: int = Field(ge=0)
    category: str = Field(min_length=1, max_length=128)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, gt=0, decimal_places=2, max_digits=12)
    stock_quantity: int | None = Field(default=None, ge=0)
    category: str | None = Field(default=None, min_length=1, max_length=128)
    is_active: bool | None = None


@router.get("", response_model=list[MerchantProduct])
async def list_merchant_products(
    session: AsyncSession = Depends(get_session),
    merchant: Merchant = Depends(get_current_merchant),
) -> list[MerchantProduct]:
    rows = await session.execute(select(Product).where(Product.merchant_id == merchant.id).order_by(Product.sku))
    return [MerchantProduct.model_validate(product) for product in rows.scalars().all()]


@router.post("", response_model=MerchantProduct, status_code=status.HTTP_201_CREATED)
async def create_merchant_product(
    product_input: ProductInput,
    session: AsyncSession = Depends(get_session),
    merchant: Merchant = Depends(get_current_merchant),
) -> MerchantProduct:
    if await session.get(Product, product_input.sku):
        raise HTTPException(status_code=409, detail="A product with this SKU already exists.")
    product = Product(**product_input.model_dump(), merchant_id=merchant.id)
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return MerchantProduct.model_validate(product)


@router.patch("/{sku}", response_model=MerchantProduct)
async def update_merchant_product(
    sku: str,
    product_input: ProductUpdate,
    session: AsyncSession = Depends(get_session),
    merchant: Merchant = Depends(get_current_merchant),
) -> MerchantProduct:
    product = await session.get(Product, sku)
    if product is not None and product.merchant_id != merchant.id:
        product = None
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")
    for field, value in product_input.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await session.commit()
    await session.refresh(product)
    return MerchantProduct.model_validate(product)


@router.delete("/{sku}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_merchant_product(
    sku: str,
    session: AsyncSession = Depends(get_session),
    merchant: Merchant = Depends(get_current_merchant),
) -> None:
    product = await session.get(Product, sku)
    if product is not None and product.merchant_id != merchant.id:
        product = None
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")
    product.is_active = False
    await session.commit()
