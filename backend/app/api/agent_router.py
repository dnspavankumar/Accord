"""Optional local LLM assistance; deterministic controls remain authoritative."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Product
from ..security import get_current_merchant
from ..services.ollama_client import draft_purchase

router = APIRouter(prefix="/api/v1/accord/agent", tags=["Agent assistance"])


class DraftRequest(BaseModel):
    request: str = Field(min_length=2, max_length=2000)


@router.post("/draft")
async def create_draft(
    payload: DraftRequest,
    merchant=Depends(get_current_merchant),
    session: AsyncSession = Depends(get_session),
) -> dict:
    products = (await session.scalars(
        select(Product).where(Product.merchant_id == merchant.id, Product.is_active.is_(True))
    )).all()
    if not products:
        raise HTTPException(status_code=409, detail="The merchant catalog is empty.")
    catalog = [
        {"sku": p.sku, "name": p.name, "description": p.description,
         "price": float(p.price), "currency": p.currency, "stock": p.stock_quantity}
        for p in products
    ]
    try:
        draft = await draft_purchase(payload.request, catalog)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    product = next((p for p in products if p.sku == draft.get("sku")), None)
    try:
        quantity = int(draft.get("quantity", 0))
    except (TypeError, ValueError):
        quantity = 0
    if product is None or quantity < 1 or quantity > product.stock_quantity:
        raise HTTPException(status_code=502, detail="Ollama selected an invalid or unavailable catalog item.")
    return {
        "model": get_model_name(), "sku": product.sku, "product_name": product.name,
        "quantity": quantity, "unit_price": product.price,
        "total_amount": Decimal(product.price) * quantity,
        "reason": str(draft.get("reason", ""))[:1000],
        "payment_required": True,
        "message": "Draft only. Review it and add it to cart before payment.",
    }


def get_model_name() -> str:
    from ..config import get_settings
    return get_settings().ollama_model
