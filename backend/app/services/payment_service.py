import os
import sys
from typing import Optional, Dict, Any

# Add project root to path for backend imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.payments.phonepe import PhonePeGateway


class PaymentService:
    """Plan definitions — amounts are in paise (INR × 100)."""

    PLANS = {
        "Free":     {"amount_monthly": 0,      "amount_yearly": 0,       "scan_limit": 5},
        "Pro":      {"amount_monthly": 29900,   "amount_yearly": 287040,  "scan_limit": 100},  # ₹299/mo, ₹2,870/yr
        "Business": {"amount_monthly": 99900,   "amount_yearly": 959040,  "scan_limit": 500},  # ₹999/mo, ₹9,590/yr
    }

    def __init__(self, gateway: Optional[PhonePeGateway] = None):
        self.gateway = gateway or PhonePeGateway()

    def get_plan_amount(self, plan_name: str, billing_period: str = "monthly") -> int:
        plan = self.PLANS.get(plan_name, self.PLANS["Free"])
        return plan["amount_yearly"] if billing_period == "yearly" else plan["amount_monthly"]

    def get_scan_limit(self, plan_name: str) -> int:
        return self.PLANS.get(plan_name, self.PLANS["Free"])["scan_limit"]

    def is_test_mode(self) -> bool:
        return self.gateway.env != "production"

    def create_payment_ready_sms(
        self,
        mobile_number: str,
        plan_name: str,
        amount: int,
        billing_period: str = "monthly",
        order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build a payment-ready SMS for a user on their mobile number."""
        normalized_number = (mobile_number or "").strip()
        if not normalized_number:
            return {
                "status": "error",
                "message": "Mobile number is required to send a payment SMS.",
            }

        amount_in_rupees = amount / 100.0
        billing_label = "yearly" if billing_period == "yearly" else "monthly"
        order_label = order_id or "payment"
        message = (
            f"Your payment is ready for the {plan_name} plan ({billing_label}). "
            f"Amount: ₹{amount_in_rupees:.2f}. Please complete payment on your mobile number {normalized_number} "
            f"to continue. Order ID: {order_label}."
        )

        return {
            "status": "ready",
            "mobile_number": normalized_number,
            "amount": amount,
            "amount_in_rupees": round(amount_in_rupees, 2),
            "plan_name": plan_name,
            "billing_period": billing_period,
            "order_id": order_label,
            "message": message,
        }

    def create_subscription_order(self, plan_name: str, billing_period: str = "monthly") -> Dict[str, Any]:
        amount = self.get_plan_amount(plan_name, billing_period)

        if amount == 0:
            return {
                "order_id": f"free_sub_{plan_name.lower()}",
                "amount": 0,
                "currency": "INR",
                "status": "paid",
                "plan": plan_name,
                "redirect_url": "http://localhost:5173/payment?status=success",
                "is_mock": True,
            }

        order = self.gateway.create_order(
            amount=amount,
            currency="INR",
            receipt=f"sub_{plan_name.lower()}_{billing_period}",
        )
        order["plan"] = plan_name
        order["billing_period"] = billing_period
        return order

    def verify_payment(self, order_id: str, payment_id: str, signature: str) -> bool:
        status_info = self.gateway.check_status(order_id)
        return status_info.get("status") == "paid"

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        return self.gateway.verify_webhook_signature(body, signature)
