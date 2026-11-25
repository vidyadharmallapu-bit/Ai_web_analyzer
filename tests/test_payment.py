import unittest
import os
from unittest.mock import patch
from backend.app.services.payment_service import PaymentService, PhonePeGateway

class TestPaymentService(unittest.TestCase):
    def setUp(self):
        os.environ["PHONEPE_MERCHANT_ID"] = "PGTESTPAYUAT"
        os.environ["PHONEPE_SALT_KEY"] = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399"
        self.payment_service = PaymentService(gateway=PhonePeGateway())

    def test_create_subscription_order_free(self):
        order = self.payment_service.create_subscription_order("Free")
        self.assertEqual(order["amount"], 0)
        self.assertEqual(order["status"], "paid")

    @patch("backend.payments.phonepe.requests.post")
    def test_create_subscription_order_pro(self, mock_post):
        mock_post.return_value.json.return_value = {
            "success": True,
            "code": "PAYMENT_INITIATED",
            "data": {
                "instrumentResponse": {
                    "redirectInfo": {
                        "url": "https://api-preprod.phonepe.com/pay?id=123"
                    }
                }
            }
        }
        mock_post.return_value.status_code = 200
        order = self.payment_service.create_subscription_order("Pro", "monthly")
        self.assertEqual(order["amount"], 29900)
        self.assertIn("order_id", order)

    @patch("backend.payments.phonepe.requests.post")
    def test_create_subscription_order_business(self, mock_post):
        mock_post.return_value.json.return_value = {
            "success": True,
            "code": "PAYMENT_INITIATED",
            "data": {
                "instrumentResponse": {
                    "redirectInfo": {
                        "url": "https://api-preprod.phonepe.com/pay?id=123"
                    }
                }
            }
        }
        mock_post.return_value.status_code = 200
        order = self.payment_service.create_subscription_order("Business", "monthly")
        self.assertEqual(order["amount"], 99900)
        self.assertIn("order_id", order)

    @patch("backend.payments.phonepe.requests.get")
    def test_verify_payment_success(self, mock_get):
        mock_get.return_value.json.return_value = {
            "success": True,
            "code": "PAYMENT_SUCCESS",
            "message": "Your payment is successful."
        }
        mock_get.return_value.status_code = 200
        is_valid = self.payment_service.verify_payment("order_phonepe_123", "pay_123", "sig_123")
        self.assertTrue(is_valid)

    def test_payment_ready_sms_message(self):
        sms = self.payment_service.create_payment_ready_sms(
            mobile_number="+919876543210",
            plan_name="Pro",
            amount=29900,
            billing_period="monthly",
            order_id="MT_TEST_1",
        )
        self.assertEqual(sms["status"], "ready")
        self.assertIn("Pro", sms["message"])
        self.assertIn("299", sms["message"])
        self.assertIn("+919876543210", sms["message"])


if __name__ == "__main__":
    unittest.main()
