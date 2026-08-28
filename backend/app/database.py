"""Async SQLite engine, session dependency, and local catalog bootstrap."""

from collections.abc import AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings
from .models import Base, PolicyConfig, Product
from .schemas.policy import PolicySettings

settings = get_settings()
engine = create_async_engine(settings.database_url, future=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DEFAULT_PRODUCTS = (
    Product(
        sku="SKU-NVIDIA-H100-HR", name="NVIDIA H100 PCIe (80GB) Compute Instance - 1 Hour",
        description="Dedicated PCIe Gen5 H100 tensor core instance for distributed training and low-latency inference.",
        price=3450, currency="INR", stock_quantity=48, category="Hardware Compute / Cloud Node",
    ),
    Product(
        sku="SKU-INFER-EDGE-DEDICATED", name="Ultra-Low Latency Inference Edge Worker (24h Lease)",
        description="Dedicated edge proxy node with sub-5ms routing to tier-1 exchange endpoints.",
        price=1890, currency="INR", stock_quantity=120, category="Edge Infrastructure",
    ),
    Product(
        sku="SKU-TOKEN-PACK-100M", name="Enterprise Agent Token Quota (100 Million Tokens)",
        description="Prepaid rate-limit bypass token capacity for autonomous agent orchestration pipelines.",
        price=8200, currency="INR", stock_quantity=999, category="LLM Runtime Quota",
    ),
    Product(
        sku="SKU-PROXY-RESIDENTIAL-CLUSTER", name="Autonomous Web Agent Proxy Cluster (500 Dedicated IPs)",
        description="Clean ASN dedicated static residential IP cluster with built-in AP2 verification headers.",
        price=14500, currency="INR", stock_quantity=14, category="Network & Scraping",
    ),
    Product(
        sku="SKU-CUSTOM-EMBED-INDEX-1B", name="Vector Database Shard (1B Vector Capacity, NVMe SSD)",
        description="Dedicated memory-mapped HNSW graph index partition with instant semantic search throughput.",
        price=28000, currency="INR", stock_quantity=5, category="Storage & Vector Index",
    ),
    Product(
        sku="SKU-SECURITY-AUDIT-AGENT-PASS", name="Cryptographic Agent Mandate Verifier Pass (Monthly)",
        description="Real-time validation against the AP2 distributed intent registry and revocation lists.",
        price=4999, currency="INR", stock_quantity=450, category="Security Protocol",
    ),
    # Small local defaults retained for existing installations that already use them.
    Product(
        sku="SKU-SERVO-01", name="Industrial Servo Motor",
        description="High-torque industrial servo motor.", price=4500,
        currency="INR", stock_quantity=12, category="automation",
    ),
    Product(
        sku="SKU-SENSOR-01", name="Precision Proximity Sensor",
        description="Non-contact proximity sensor for factory automation.", price=1250,
        currency="INR", stock_quantity=25, category="sensors",
    ),
    Product(
        sku="SKU-CONTROLLER-01", name="Automation Controller",
        description="Programmable controller for industrial equipment.", price=7500,
        currency="INR", stock_quantity=6, category="automation",
    ),
)


async def init_db() -> None:
    """Create tables and seed a catalog for a fresh local database."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        existing_skus = set((await session.scalars(select(Product.sku))).all())
        missing_products = [
            Product(
                sku=product.sku, name=product.name, description=product.description,
                price=product.price, currency=product.currency,
                stock_quantity=product.stock_quantity, category=product.category,
                is_active=product.is_active,
            )
            for product in DEFAULT_PRODUCTS
            if product.sku not in existing_skus
        ]
        if missing_products:
            session.add_all(missing_products)
        if await session.get(PolicyConfig, 1) is None:
            defaults = PolicySettings()
            session.add(PolicyConfig(
                id=1,
                max_transaction_limit_inr=defaults.max_transaction_limit_inr,
                max_quantity_per_item=defaults.max_quantity_per_item,
                allowed_currency=defaults.allowed_currency,
                velocity_limit=defaults.velocity_limit,
                velocity_window_seconds=defaults.velocity_window_seconds,
            ))
        await session.commit()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
