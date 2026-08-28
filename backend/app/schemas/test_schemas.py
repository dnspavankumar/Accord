"""Quick Pydantic schema tests for Phase 1 AP2 models."""

from decimal import Decimal

import pytest

from backend.app.schemas.ap2_catalog import AP2Product, AP2Catalog
from backend.app.schemas.ap2_mandate import CartItem, PaymentMethod, IntentMandate, CartMandate


def test_ap2_product_minimal():
    product = AP2Product(
        sku="ABC123",
        name="Test Widget",
        description="A nice widget",
        price=Decimal("10.00"),
        currency="INR",
        stock_quantity=5,
        category="widgets",
    )
    assert product.sku == "ABC123"
    assert product.name == "Test Widget"
    assert product.price == Decimal("10.00")
    assert product.stock_quantity == 5
    assert product.category == "widgets"


def test_ap2_catalog_roundtrip():
    products = [
        AP2Product(
            sku="SKU001",
            name="Item 1",
            price=Decimal("5.50"),
            currency="INR",
            stock_quantity=2,
            category="categoryA",
        )
    ]
    catalog = AP2Catalog(data_feed_element=products)
    assert len(catalog.data_feed_element) == 1
    assert catalog.data_feed_element[0].sku == "SKU001"


def test_cart_item_validation():
    item = CartItem(sku="SKU001", quantity=3, unit_price=Decimal("4.20"))
    assert item.sku == "SKU001"
    assert item.quantity == 3
    assert item.unit_price == Decimal("4.20")


def test_intent_mandate_all_fields():
    pm = PaymentMethod(provider="razorpay", token="tok_test_success", simulate_failure=False)
    mandate = IntentMandate(
        buyer_agent_id="agent-001",
        cart=[CartItem(sku="SKU001", quantity=2, unit_price=Decimal("10.00"))],
        max_authorized_amount=Decimal("100.00"),
        currency="INR",
        payment_method=pm,
    )
    assert mandate.buyer_agent_id == "agent-001"
    assert len(mandate.cart) == 1
    assert mandate.protocol_version == "AP2-2026"
    assert mandate.payment_method.token == "tok_test_success"


def test_cart_mandate_inherits_intent():
    pm = PaymentMethod(provider="razorpay", token="tok_test_success")
    cm = CartMandate(
        buyer_agent_id="agent-002",
        cart=[CartItem(sku="SKU002", quantity=1, unit_price=Decimal("7.50"))],
        max_authorized_amount=Decimal("50.00"),
        currency="INR",
        payment_method=pm,
    )
    assert isinstance(cm, IntentMandate)
    assert cm.buyer_agent_id == "agent-002"