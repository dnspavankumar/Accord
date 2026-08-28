"""Small, test-safe adapter around the Razorpay Python SDK."""

from __future__ import annotations

import os
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


class RazorpayError(RuntimeError):
    """Raised when Razorpay cannot create or capture a payment."""


class RazorpayClient:
    """Razorpay gateway adapter with deterministic local test behavior."""

    def __init__(self, key_id: str | None = None, key_secret: str | None = None, client: Any | None = None) -> None:
        self.key_id = key_id or os.getenv("RAZORPAY_KEY_ID")
        self.key_secret = key_secret or os.getenv("RAZORPAY_KEY_SECRET")
        self._client = client
        if self._client is None and self.key_id and self.key_secret:
            try:
                import razorpay
                self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except ImportError as exc:
                raise RazorpayError("The razorpay package is required when credentials are configured.") from exc

    @property
    def simulated(self) -> bool:
        return self._client is None

    @staticmethod
    def to_paise(amount_inr: Decimal | int | float | str) -> int:
        """Convert INR to paise without floating-point rounding errors."""
        try:
            amount = Decimal(str(amount_inr))
        except (InvalidOperation, ValueError) as exc:
            raise RazorpayError("Amount must be a valid INR value.") from exc
        if not amount.is_finite() or amount <= 0:
            raise RazorpayError("Amount must be greater than zero.")
        rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if rounded != amount:
            raise RazorpayError("INR amounts must have at most two decimal places.")
        return int(rounded * 100)

    @staticmethod
    def _safe_receipt(receipt_id: str) -> str:
        receipt = re.sub(r"[^A-Za-z0-9_.-]", "-", receipt_id)
        if not receipt:
            raise RazorpayError("Receipt ID cannot be empty.")
        return receipt[:40]

    def create_order(self, amount_in_paise: int, currency: str, receipt_id: str) -> dict[str, Any]:
        """Create a Razorpay order using an integer amount in paise."""
        if not isinstance(amount_in_paise, int) or isinstance(amount_in_paise, bool) or amount_in_paise <= 0:
            raise RazorpayError("Razorpay order amounts must be positive integer paise.")
        if currency != "INR":
            raise RazorpayError("Accord only permits INR Razorpay orders.")
        receipt = self._safe_receipt(receipt_id)
        payload = {"amount": amount_in_paise, "currency": currency, "receipt": receipt}
        if self._client is not None:
            try:
                return dict(self._client.order.create(data=payload))
            except Exception as exc:
                raise RazorpayError(f"Razorpay order creation failed: {exc}") from exc
        return {"id": f"order_sim_{receipt}", "entity": "order", **payload, "status": "created"}

    def capture_payment(self, payment_id: str, amount_in_paise: int) -> dict[str, Any]:
        """Capture a payment for the supplied integer paise amount."""
        if not payment_id:
            raise RazorpayError("Payment token or ID cannot be empty.")
        if not isinstance(amount_in_paise, int) or amount_in_paise <= 0:
            raise RazorpayError("Payment capture amount must be positive integer paise.")
        if self._client is not None:
            try:
                return dict(self._client.payment.capture(payment_id, amount_in_paise))
            except Exception as exc:
                raise RazorpayError(f"Razorpay payment capture failed: {exc}") from exc
        if payment_id != "tok_test_card_success":
            raise RazorpayError("Primary payment token was declined by the test gateway.")
        return {"id": "pay_sim_card_success", "entity": "payment", "amount": amount_in_paise, "status": "captured"}
