"""Async SQLite engine, session dependency, and local catalog bootstrap."""

from collections.abc import AsyncGenerator
from decimal import Decimal
import hashlib
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings
from .models import AuditLedger, Base, ExecutionStatus, Merchant, PolicyStatus, Product, TransactionItem

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

ADDITIONAL_LOCAL_PRODUCTS = (
    ("EDGE-GATEWAY-01", "Secure Edge API Gateway Node", "Dedicated API gateway node with request signing and rate limiting.", Decimal("3200.00"), 30, "Edge Infrastructure"),
    ("VECTOR-SHARD-01", "Managed Vector Search Shard", "NVMe-backed vector search shard for production semantic retrieval workloads.", Decimal("9600.00"), 10, "Storage & Vector Index"),
    ("AGENT-AUDIT-01", "Agent Activity Audit Package", "Monthly audit and trace package for autonomous agent operations.", Decimal("2400.00"), 75, "Security Protocol"),
    ("DATA-PIPELINE-01", "Real-time Data Pipeline Connector", "Managed connector for reliable event ingestion and transformation.", Decimal("6800.00"), 18, "Data Infrastructure"),
    ("GPU-BURST-01", "GPU Inference Burst Pack", "Short-duration GPU inference capacity for traffic spikes and experiments.", Decimal("5100.00"), 40, "Hardware Compute / Cloud Node"),
    ("WORKFLOW-RUNNER-01", "Autonomous Workflow Runner License", "Monthly license for isolated, policy-aware workflow execution.", Decimal("3999.00"), 60, "Agent Runtime"),
)


async def init_db() -> None:
    """Create tables and seed a catalog for a fresh local database."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        if connection.dialect.name == "mysql":
            # create_all does not alter tables that already exist. These
            # additive migrations keep existing local MySQL data intact.
            for table, column in (
                ("products", "merchant_id"),
                ("audit_ledger", "merchant_id"),
                ("policy_config", "merchant_id"),
            ):
                exists = await connection.execute(text(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table "
                    "AND COLUMN_NAME = :column"
                ), {"table": table, "column": column})
                if not exists.scalar_one():
                    await connection.execute(text(
                        f"ALTER TABLE `{table}` ADD COLUMN `{column}` CHAR(32) NULL"
                    ))
            legacy_policy_id = await connection.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'policy_config' "
                "AND COLUMN_NAME = 'id'"
            ))
            if legacy_policy_id.scalar_one():
                await connection.execute(text(
                    "ALTER TABLE `policy_config` MODIFY COLUMN `id` INT NOT NULL AUTO_INCREMENT"
                ))
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
        if settings.demo_data and settings.environment.lower() != "production":
            merchants = (await session.scalars(select(Merchant.id))).all()
            for merchant_id in merchants:
                await seed_additional_local_products(session, merchant_id)
                await seed_demo_data_for_merchant(session, merchant_id)
        await session.commit()


async def seed_demo_data_for_merchant(session: AsyncSession, merchant_id: uuid.UUID) -> None:
    """Add one clearly-labelled demo item and transaction, once per local merchant."""
    if not settings.demo_data or settings.environment.lower() == "production":
        return
    suffix = merchant_id.hex[:8]
    sku = f"DEMO-SERVO-{suffix}"
    if await session.scalar(select(Product).where(Product.sku == sku)):
        return
    product = Product(
        sku=sku,
        merchant_id=merchant_id,
        name="Demo Industrial Servo Motor",
        description="Development-only sample product for testing catalog and checkout flows.",
        price=Decimal("4500.00"), currency="INR", stock_quantity=20,
        category="Demo / Testing", is_active=True,
    )
    session.add(product)
    await session.flush()
    transaction_id = uuid.uuid4()
    session.add(AuditLedger(
        transaction_id=transaction_id,
        merchant_id=merchant_id,
        buyer_agent_id="demo-agent",
        intent_hash=hashlib.sha256(f"demo-{merchant_id}".encode()).hexdigest(),
        requested_amount=product.price,
        policy_status=PolicyStatus.APPROVED,
        razorpay_payment_id=f"pay_demo_{suffix}",
        execution_status=ExecutionStatus.SETTLED,
    ))
    await session.flush()
    session.add(TransactionItem(
        transaction_id=transaction_id, sku=product.sku, name=product.name,
        quantity=1, unit_price=product.price,
    ))


async def seed_additional_local_products(session: AsyncSession, merchant_id: uuid.UUID) -> None:
    """Add useful development catalog entries once for each local merchant."""
    if not settings.demo_data or settings.environment.lower() == "production":
        return
    suffix = merchant_id.hex[:8]
    for base_sku, name, description, price, stock, category in ADDITIONAL_LOCAL_PRODUCTS:
        sku = f"{base_sku}-{suffix}"
        if await session.scalar(select(Product).where(Product.sku == sku)):
            continue
        session.add(Product(
            sku=sku, merchant_id=merchant_id, name=name, description=description,
            price=price, currency="INR", stock_quantity=stock, category=category,
            is_active=True,
        ))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
