"""Catalog resolver that converts live products to AP2 JSON-LD."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.product import Product
from ..schemas.ap2_catalog import AP2Catalog, AP2Offer, AP2Product


async def get_catalog(session: AsyncSession) -> AP2Catalog:
    rows = await session.execute(
        select(Product).where(Product.is_active.is_(True)).order_by(Product.sku)
    )
    products = []
    for product in rows.scalars().all():
        products.append(
            AP2Product(
                sku=product.sku,
                name=product.name,
                description=product.description,
                price=product.price,
                currency=product.currency,
                stock_quantity=product.stock_quantity,
                category=product.category,
                offers=AP2Offer(
                    price=product.price,
                    priceCurrency=product.currency,
                    availability=(
                        "https://schema.org/InStock"
                        if product.stock_quantity > 0
                        else "https://schema.org/OutOfStock"
                    ),
                ),
            )
        )
    return AP2Catalog(dataFeedElement=products)
