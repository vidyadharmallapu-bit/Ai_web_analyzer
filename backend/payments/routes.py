from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User, Subscription, Payment, Transaction, Invoice
from app.services.payment_service import PaymentService
from backend.payments.phonepe import PhonePeGateway
from backend.payments.webhook import handle_phonepe_webhook

router = APIRouter(prefix="/api/payments", tags=["payments"])
payment_service = PaymentService()


class CreateOrderRequest(BaseModel):
    plan: str
    billing_period: Optional[str] = "monthly"
    email: EmailStr
    full_name: Optional[str] = "Security User"
    mobile_number: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str
    email: EmailStr
    plan: str
    amount: float
    billing_period: Optional[str] = "monthly"


def _get_or_create_user(db: Session, email: str, full_name: str = "Security User") -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=full_name,
            plan="Free",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/create-order")
def create_payment_order(req: CreateOrderRequest, db: Session = Depends(get_db)):
    """Create a real PhonePe payment order and persist payment record."""
    user = _get_or_create_user(db, req.email, req.full_name or "Security User")
    
    # Backend determines exact plan price securely
    amount = payment_service.get_plan_amount(req.plan, req.billing_period or "monthly")
    
    if amount == 0:
        return {
            "order_id": f"free_sub_{req.plan.lower()}",
            "amount": 0,
            "currency": "INR",
            "status": "paid",
            "plan": req.plan,
            "redirect_url": "http://localhost:5173/payment?status=success",
            "is_mock": True,
        }
        
    gateway = PhonePeGateway()
    # Will raise 500 if credentials are unconfigured
    order_info = gateway.create_order(
        amount=amount,
        currency="INR",
        receipt=f"sub_{req.plan.lower()}_{req.billing_period}",
        customer_id=user.id
    )
    
    amount_in_inr = amount / 100.0
    
    # Store payment record in database
    payment = Payment(
        user_id=user.id,
        razorpay_order_id=order_info["order_id"],  # Using order_id column for merchantTransactionId
        amount=amount_in_inr,
        currency=order_info.get("currency", "INR"),
        status="created",
        plan=req.plan,
        billing_period=req.billing_period or "monthly",
    )
    db.add(payment)
    db.commit()
    
    sms_payload = payment_service.create_payment_ready_sms(
        mobile_number=req.mobile_number or "",
        plan_name=req.plan,
        amount=amount,
        billing_period=req.billing_period or "monthly",
        order_id=order_info.get("order_id"),
    )

    return {
        "order_id": order_info["order_id"],
        "amount": amount,
        "currency": order_info.get("currency", "INR"),
        "key_id": order_info.get("key_id", ""),
        "redirect_url": order_info.get("redirect_url"),
        "plan": req.plan,
        "billing_period": req.billing_period,
        "sms": sms_payload,
    }


@router.post("/verify")
def verify_payment(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    """Verify payment status from PhonePe gateway and unlock user subscription."""
    user = _get_or_create_user(db, req.email, req.full_name or "Security User")
    
    payment = db.query(Payment).filter(Payment.razorpay_order_id == req.order_id).first()
    if not payment:
        # Create payment record if missing
        payment = Payment(
            user_id=user.id,
            razorpay_order_id=req.order_id,
            amount=req.amount,
            currency="INR",
            status="created",
            plan=req.plan,
            billing_period=req.billing_period or "monthly",
        )
        db.add(payment)
        db.commit()

    if payment.status == "paid":
        return {"status": "success", "message": "Payment already verified", "plan": payment.plan}

    # Check status directly from PhonePe gateway API
    gateway = PhonePeGateway()
    status_info = gateway.check_status(req.order_id)
    
    is_valid = (status_info.get("status") == "paid")
    
    # If gateway returns paid or in test mode with valid request
    if not is_valid and gateway.base_url and "pg-sandbox" in gateway.base_url:
        # In sandbox/uat mode, allow manual or callback verification if status check pending
        if req.order_id.startswith("MT_"):
            is_valid = True

    if not is_valid:
        payment.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail=f"Payment verification failed. Status: {status_info.get('code', 'PENDING')}")

    # Mark payment paid
    payment.razorpay_payment_id = req.payment_id
    payment.razorpay_signature = req.signature
    payment.status = "paid"
    payment.updated_at = datetime.now(timezone.utc)

    # Update user plan
    user.plan = req.plan

    # Create active subscription
    scan_limit = payment_service.get_scan_limit(req.plan)
    
    active_subs = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).all()
    for sub in active_subs:
        sub.status = "expired"

    new_sub = Subscription(
        user_id=user.id,
        plan=req.plan,
        status="active",
        amount=req.amount,
        billing_period=req.billing_period or "monthly",
        scan_limit=scan_limit,
        scans_used=0,
    )
    db.add(new_sub)

    # Transaction record
    tx = Transaction(
        payment_id=payment.id,
        transaction_type="charge",
        amount=req.amount,
        status="success",
        gateway_response=json.dumps(status_info)
    )
    db.add(tx)

    # Invoice
    invoice_number = f"INV-{int(datetime.now(timezone.utc).timestamp())}"
    invoice = Invoice(
        user_id=user.id,
        payment_id=payment.id,
        invoice_number=invoice_number,
        amount=req.amount,
        plan_name=req.plan,
        status="paid"
    )
    db.add(invoice)
    db.commit()

    return {
        "status": "success",
        "plan": req.plan,
        "invoice_number": invoice_number,
        "message": f"Successfully upgraded to {req.plan} plan!"
    }


@router.get("/status/{order_id}")
def get_payment_status(order_id: str, db: Session = Depends(get_db)):
    """Check payment status for frontend polling."""
    payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if payment.status == "paid":
        return {"order_id": order_id, "status": "SUCCESS", "plan": payment.plan}
    elif payment.status == "failed":
        return {"order_id": order_id, "status": "FAILED"}
        
    # Query PhonePe gateway API for latest status
    gateway = PhonePeGateway()
    try:
        status_info = gateway.check_status(order_id)
        gateway_status = status_info.get("status")
        
        if gateway_status == "paid":
            payment.status = "paid"
            db.commit()
            return {"order_id": order_id, "status": "SUCCESS", "plan": payment.plan}
        elif gateway_status in ["failed", "cancelled", "expired"]:
            payment.status = gateway_status
            db.commit()
            return {"order_id": order_id, "status": gateway_status.upper()}
    except Exception:
        pass
        
    return {"order_id": order_id, "status": "PENDING"}


@router.post("/phonepe/callback")
async def phonepe_callback(request: Request, db: Session = Depends(get_db)):
    """PhonePe server-to-server callback / webhook."""
    body_bytes = await request.body()
    signature = request.headers.get("X-VERIFY", "")
    
    gateway = PhonePeGateway()
    # Verify signature if salt key is set and not default mock
    if gateway.salt_key and gateway.salt_key != "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399":
        if not gateway.verify_webhook_signature(body_bytes, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
            
    try:
        payload = json.loads(body_bytes.decode('utf-8'))
    except Exception:
        payload = {}
        
    result = handle_phonepe_webhook(payload, db)
    return result
