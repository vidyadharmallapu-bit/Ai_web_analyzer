import os
import hmac
import hashlib
import json
import base64
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException


class PhonePeGateway:
    def __init__(self):
        self.merchant_id = os.getenv("PHONEPE_MERCHANT_ID", "")
        self.salt_key = os.getenv("PHONEPE_SALT_KEY", "")
        self.salt_index = os.getenv("PHONEPE_SALT_INDEX", "1")
        self.env = os.getenv("PHONEPE_ENV", "uat")
        
        # Check if credentials are configured
        if not self.merchant_id or not self.salt_key:
            self._is_configured = False
        else:
            self._is_configured = True

        if self.env == "production":
            self.base_url = "https://api.phonepe.com/apis/hermes"
        else:
            self.base_url = "https://api-preprod.phonepe.com/apis/pg-sandbox"

    def check_configuration(self):
        if not self._is_configured:
            raise HTTPException(
                status_code=500,
                detail="Payment gateway is not configured. Add PhonePe credentials to the server environment."
            )

    def create_order(self, amount: int, currency: str = "INR", receipt: Optional[str] = None, callback_url: Optional[str] = None, redirect_url: Optional[str] = None, customer_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a real PhonePe payment order. Amount must be in paise (e.g. ₹299 = 29900)."""
        self.check_configuration()

        merchant_transaction_id = f"MT_{receipt or 'sub'}_{int(datetime.now(timezone.utc).timestamp())}_{os.urandom(3).hex()}"
        
        payload = {
            "merchantId": self.merchant_id,
            "merchantTransactionId": merchant_transaction_id,
            "merchantUserId": customer_id or f"MUID_{int(datetime.now(timezone.utc).timestamp())}",
            "amount": amount,
            "redirectUrl": redirect_url or "http://localhost:5173/payment?status=success",
            "redirectMode": "REDIRECT",
            "callbackUrl": callback_url or "http://localhost:8000/api/payments/phonepe/callback",
            "mobileNumber": "9999999999",
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }

        try:
            payload_bytes = json.dumps(payload).encode('utf-8')
            base64_payload = base64.b64encode(payload_bytes).decode('utf-8')
            
            string_to_hash = base64_payload + "/pg/v1/pay" + self.salt_key
            checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest() + "###" + self.salt_index
            
            headers = {
                "Content-Type": "application/json",
                "X-VERIFY": checksum
            }
            
            response = requests.post(f"{self.base_url}/pg/v1/pay", json={"request": base64_payload}, headers=headers, timeout=15)
            res_data = response.json()
            
            if res_data.get("success") and res_data.get("data"):
                instrument_response = res_data["data"].get("instrumentResponse", {})
                redirect_info = instrument_response.get("redirectInfo", {})
                intent_url = instrument_response.get("intentUrl")
                
                payment_url = redirect_info.get("url") or intent_url
                
                return {
                    "order_id": merchant_transaction_id,
                    "amount": amount,
                    "currency": currency,
                    "status": "created",
                    "provider": "phonepe",
                    "redirect_url": payment_url,
                    "key_id": self.merchant_id,
                    "is_mock": False,
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail=res_data.get("message", "Failed to initiate PhonePe payment request.")
                )
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Payment gateway communication error: {str(e)}"
            )

    def check_status(self, order_id: str) -> Dict[str, Any]:
        """Check payment status from PhonePe gateway API."""
        self.check_configuration()
        try:
            url = f"{self.base_url}/pg/v1/status/{self.merchant_id}/{order_id}"
            string_to_hash = f"/pg/v1/status/{self.merchant_id}/{order_id}" + self.salt_key
            checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest() + "###" + self.salt_index
            headers = {
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
                "X-MERCHANT-ID": self.merchant_id
            }
            response = requests.get(url, headers=headers, timeout=15)
            data = response.json()
            
            success = data.get("success", False)
            code = data.get("code", "PENDING")
            
            status = "pending"
            if success or code == "PAYMENT_SUCCESS":
                status = "paid"
            elif code in ["PAYMENT_ERROR", "PAYMENT_FAILED", "FAILED"]:
                status = "failed"
            elif code in ["CANCELLED", "EXPIRED"]:
                status = "cancelled"
                
            return {
                "order_id": order_id,
                "status": status,
                "code": code,
                "success": success,
                "raw": data
            }
        except Exception as e:
            return {
                "order_id": order_id,
                "status": "pending",
                "error": str(e)
            }

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        """Verify PhonePe webhook signature (X-VERIFY header)."""
        if not self.salt_key:
            return False
        try:
            # PhonePe webhook signature calculation or header verification
            # X-VERIFY is sha256(response_body + salt_key) + "###" + salt_index
            string_to_hash = body.decode('utf-8', errors='ignore') + self.salt_key
            calculated_checksum = hashlib.sha256(string_to_hash.encode('utf-8')).hexdigest() + "###" + self.salt_index
            return hmac.compare_digest(calculated_checksum, signature)
        except Exception:
            return False
