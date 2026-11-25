import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models import User, Subscription, Payment, Transaction, Invoice
from backend.payments.phonepe import PhonePeGateway


def handle_phonepe_webhook(data: dict, db: Session) -> dict:
    """Handle PhonePe webhook callback securely and idempotently."""
    gateway = PhonePeGateway()
    
    response_data = data.get("response", {})
    if isinstance(response_data, str):
        try:
            import base64
            response_data = json.loads(base64.b64decode(response_data).decode('utf-8'))
        except Exception:
            pass
            
    merchant_transaction_id = response_data.get("data", {}).get("merchantTransactionId") or response_data.get("merchantTransactionId")
    code = response_data.get("code") or data.get("code")
    
    if not merchant_transaction_id:
        return {"status": "ignored", "reason": "no_merchant_transaction_id"}
        
    payment = db.query(Payment).filter(Payment.razorpay_order_id == merchant_transaction_id).first()
    if not payment:
        return {"status": "ignored", "reason": "payment_not_found"}
        
    # Idempotency check: if already paid or failed, return success without re-processing
    if payment.status in ["paid", "failed"]:
        return {"status": "success", "message": "already_processed", "payment_status": payment.status}
        
    is_success = (code == "PAYMENT_SUCCESS")
    
    if is_success:
        payment.status = "paid"
        payment.razorpay_payment_id = response_data.get("data", {}).get("transactionId", f"pay_phonepe_{int(datetime.now(timezone.utc).timestamp())}")
        payment.updated_at = datetime.now(timezone.utc)
        
        # Update user plan & subscription
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            user.plan = payment.plan
            
        # Create active subscription
        scan_limits = {"Free": 5, "Pro": 100, "Business": 500}
        limit = scan_limits.get(payment.plan, 100)
        
        # Expire old active subscriptions
        active_subs = db.query(Subscription).filter(
            Subscription.user_id == payment.user_id,
            Subscription.status == "active"
        ).all()
        for sub in active_subs:
            sub.status = "expired"
            
        new_sub = Subscription(
            user_id=payment.user_id,
            plan=payment.plan,
            status="active",
            amount=payment.amount,
            billing_period=payment.billing_period,
            scan_limit=limit,
            scans_used=0,
        )
        db.add(new_sub)
        
        # Create transaction record
        tx = Transaction(
            payment_id=payment.id,
            transaction_type="charge",
            amount=payment.amount,
            status="success",
            gateway_response=json.dumps(response_data)
        )
        db.add(tx)
        
        # Create invoice record
        invoice_number = f"INV-{int(datetime.now(timezone.utc).timestamp())}"
        inv = Invoice(
            user_id=payment.user_id,
            payment_id=payment.id,
            invoice_number=invoice_number,
            amount=payment.amount,
            plan_name=payment.plan,
            status="paid"
        )
        db.add(inv)
        db.commit()
        
        return {"status": "success", "order_id": merchant_transaction_id, "payment_status": "paid"}
    else:
        payment.status = "failed"
        payment.updated_at = datetime.now(timezone.utc)
        
        tx = Transaction(
            payment_id=payment.id,
            transaction_type="charge",
            amount=payment.amount,
            status="failure",
            gateway_response=json.dumps(response_data)
        )
        db.add(tx)
        db.commit()
        
        return {"status": "success", "order_id": merchant_transaction_id, "payment_status": "failed"}
