import os
import sys
import secrets
import hashlib
import base64
import json
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

# Make the backend package available before importing application modules.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import httpx
import jwt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.services.scanner import scan_website
from app.services.security_checker import validate_url_and_ip
from app.services.payment_service import PaymentService
from app.db.database import Base, engine, get_db
from app.db.models import User, Subscription, Payment, Transaction, Invoice, ScanHistory, OAuthAccount
from backend.payments.routes import router as payments_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CyberShield AI — Enterprise Security & Payment API",
    version="2.0.0",
    description="Production-ready website analyzer, vulnerability scanner, PhonePe payment gateway, and enterprise dashboard API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(payments_router)

payment_service = PaymentService()


# ── OAuth / Social Login Configuration ────────────────────────────────────────

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "common")

X_CLIENT_ID = os.getenv("X_CLIENT_ID")
X_CLIENT_SECRET = os.getenv("X_CLIENT_SECRET")

SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_urlsafe(32))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

_oauth_states: Dict[str, Dict[str, Any]] = {}

def _generate_state() -> str:
    return secrets.token_urlsafe(32)

def _store_state(state: str, provider: str, data: Optional[Dict] = None):
    _oauth_states[state] = {
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
        "data": data or {}
    }

def _validate_state(state: str, provider: str) -> bool:
    stored = _oauth_states.pop(state, None)
    if not stored:
        return False
    if stored["provider"] != provider:
        return False
    if datetime.now(timezone.utc) - stored["created_at"] > timedelta(minutes=10):
        return False
    return True

def _create_session_cookie(response: Response, user_id: str, email: str, name: str):
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, SESSION_SECRET, algorithm="HS256")
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",
        samesite="lax",
        max_age=30 * 24 * 60 * 60,
        path="/",
    )

def _clear_session_cookie(response: Response):
    response.delete_cookie(key="session", path="/", httponly=True, secure=os.getenv("ENVIRONMENT") == "production", samesite="lax")

async def _get_current_user(request: Request, db: Session) -> Optional[User]:
    session_cookie = request.cookies.get("session")
    if not session_cookie:
        return None
    try:
        payload = jwt.decode(session_cookie, SESSION_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except jwt.PyJWTError:
        return None

def _get_or_create_user_from_oauth(db: Session, email: str, full_name: str, provider: str, provider_user_id: str, avatar_url: Optional[str] = None) -> User:
    oauth_account = db.query(OAuthAccount).filter(
        OAuthAccount.provider == provider,
        OAuthAccount.provider_user_id == provider_user_id
    ).first()
    if oauth_account:
        user = oauth_account.user
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            user.updated_at = datetime.now(timezone.utc)
            db.commit()
        return user

    user = db.query(User).filter(User.email == email).first()
    if user:
        existing_oauth = db.query(OAuthAccount).filter(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == provider
        ).first()
        if not existing_oauth:
            oauth_account = OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                provider_email=email,
            )
            db.add(oauth_account)
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user

    user = User(
        id=str(uuid4()),
        email=email,
        full_name=full_name,
        avatar_url=avatar_url,
        plan="Free",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=email,
    )
    db.add(oauth_account)
    db.commit()

    return user


# ── OAuth Routes ──────────────────────────────────────────────────────────────

@app.get("/auth/google")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    state = secrets.token_urlsafe(32)
    _store_state(state, "google")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@app.get("/auth/google/callback")
async def google_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_cancelled")
    if not code or not state or not _validate_state(state, "google"):
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
    }
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_token_failed")
        tokens = token_response.json()
        id_token = tokens.get("id_token")
        if not id_token:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_no_id_token")
        try:
            id_info = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
        except Exception:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_invalid_token")
        email = id_info.get("email")
        if not email:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_no_email")
        full_name = id_info.get("name", email.split("@")[0])
        provider_user_id = id_info.get("sub")
        avatar_url = id_info.get("picture")
        user = _get_or_create_user_from_oauth(
            db=db,
            email=email,
            full_name=full_name,
            provider="google",
            provider_user_id=provider_user_id,
            avatar_url=avatar_url
        )
        response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard")
        _create_session_cookie(response, user.id, user.email, user.full_name or "")
        return response


@app.get("/auth/microsoft")
async def microsoft_login(request: Request):
    if not MICROSOFT_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    state = secrets.token_urlsafe(32)
    _store_state(state, "microsoft")
    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/microsoft/callback",
        "response_type": "code",
        "scope": "openid email profile User.Read",
        "state": state,
        "response_mode": "query",
    }
    auth_url = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@app.get("/auth/microsoft/callback")
async def microsoft_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_cancelled")
    if not code or not state or not _validate_state(state, "microsoft"):
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")
    token_url = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
    token_data = {
        "client_id": MICROSOFT_CLIENT_ID,
        "client_secret": MICROSOFT_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": f"{BACKEND_URL}/auth/microsoft/callback",
        "scope": "openid email profile User.Read",
    }
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_token_failed")
        tokens = token_response.json()
        id_token = tokens.get("id_token")
        if not id_token:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_no_id_token")
        try:
            jwks_url = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/discovery/v2.0/keys"
            jwks_response = await client.get(jwks_url)
            jwks = jwks_response.json()
            unverified_header = jwt.get_unverified_header(id_token)
            kid = unverified_header.get("kid")
            key = None
            for k in jwks.get("keys", []):
                if k.get("kid") == kid:
                    key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
                    break
            if not key:
                return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_key_not_found")
            id_info = jwt.decode(
                id_token,
                key,
                algorithms=["RS256"],
                audience=MICROSOFT_CLIENT_ID,
                issuer=f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/v2.0",
            )
        except Exception:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_invalid_token")
        email = id_info.get("email") or id_info.get("preferred_username")
        if not email:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=microsoft_no_email")
        full_name = id_info.get("name", email.split("@")[0])
        provider_user_id = id_info.get("sub") or id_info.get("oid")
        avatar_url = None
        user = _get_or_create_user_from_oauth(
            db=db,
            email=email,
            full_name=full_name,
            provider="microsoft",
            provider_user_id=provider_user_id,
            avatar_url=avatar_url
        )
        response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard")
        _create_session_cookie(response, user.id, user.email, user.full_name or "")
        return response


@app.get("/auth/x")
async def x_login(request: Request):
    if not X_CLIENT_ID:
        raise HTTPException(status_code=500, detail="X OAuth not configured")
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip("=")
    _store_state(state, "x", {"code_verifier": code_verifier})
    params = {
        "client_id": X_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/x/callback",
        "response_type": "code",
        "scope": "tweet.read users.read offline.access",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"https://twitter.com/i/oauth2/authorize?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@app.get("/auth/x/callback")
async def x_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=x_cancelled")
    if not code or not state or not _validate_state(state, "x"):
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")
    stored = _oauth_states.get(state, {})
    code_verifier = stored.get("data", {}).get("code_verifier")
    if not code_verifier:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=x_missing_verifier")
    token_url = "https://api.twitter.com/2/oauth2/token"
    token_data = {
        "client_id": X_CLIENT_ID,
        "client_secret": X_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": f"{BACKEND_URL}/auth/x/callback",
        "code_verifier": code_verifier,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data, headers=headers)
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=x_token_failed")
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=x_no_access_token")
        user_url = "https://api.twitter.com/2/users/me"
        user_params = {"user.fields": "id,name,username,profile_image_url"}
        user_headers = {"Authorization": f"Bearer {access_token}"}
        user_response = await client.get(user_url, params=user_params, headers=user_headers)
        if user_response.status_code != 200:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=x_user_failed")
        user_data = user_response.json().get("data", {})
        email = user_data.get("email")
        if not email:
            username = user_data.get("username", "x_user")
            email = f"{username}@x.placeholder"
        full_name = user_data.get("name", email.split("@")[0])
        provider_user_id = user_data.get("id")
        avatar_url = user_data.get("profile_image_url")
        user = _get_or_create_user_from_oauth(
            db=db,
            email=email,
            full_name=full_name,
            provider="x",
            provider_user_id=provider_user_id,
            avatar_url=avatar_url
        )
        response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard")
        _create_session_cookie(response, user.id, user.email, user.full_name or "")
        return response


@app.post("/auth/logout")
async def logout(request: Request, response: Response):
    _clear_session_cookie(response)
    return {"status": "success", "message": "Logged out successfully"}


@app.get("/auth/me")
async def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "avatar_url": user.avatar_url,
    }


# ── Plan scan limits (mirrors PaymentService.PLANS) ──────────────────────────

PLAN_SCAN_LIMITS = {
    "Free":     5,
    "Pro":      100,
    "Business": 500,
}


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = "Security Admin"
    password: Optional[str] = "securepass123"

class CreateOrderRequest(BaseModel):
    plan: str
    billing_period: Optional[str] = "monthly"
    email: EmailStr
    full_name: Optional[str] = "Security User"

class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str
    email: EmailStr
    plan: str
    amount: float
    billing_period: Optional[str] = "monthly"

class SaveScanHistoryRequest(BaseModel):
    email: Optional[str] = None
    target: str
    score: int
    risk_level: Optional[str] = None
    findings_count: int
    scan_mode: str = "passive"

class CheckoutRequest(BaseModel):
    plan: str
    price: str
    period: str
    payment_method: str
    full_name: str
    email: str
    phone: str


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_or_create_user(db: Session, email: str, full_name: str = "Security User") -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=str(uuid4()),
            email=email,
            full_name=full_name,
            plan="Free",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def _get_active_subscription(db: Session, user_id: str) -> Optional[Subscription]:
    return (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status == "active",
        )
        .order_by(Subscription.start_date.desc())
        .first()
    )


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "CyberShield AI Enterprise API running",
        "version": "2.0.0",
        "payment_mode": os.getenv("PAYMENT_MODE", "test"),
        "features": ["Scanner", "Razorpay Payments", "Subscriptions", "Invoices", "OWASP Top 10"],
    }


# ── Scan ──────────────────────────────────────────────────────────────────────

@app.post("/scan")
def run_scan(req: ScanRequest, db: Session = Depends(get_db)):
    """Run a security scan. Enforces strict URL validation and per-subscription scan limits."""
    valid, _, reason = validate_url_and_ip(req.url)
    if not valid:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "INVALID_URL",
                "message": "Please enter a valid website URL, for example: https://example.com"
            }
        )

    if req.email:
        user = db.query(User).filter(User.email == req.email).first()
        if user:
            sub = _get_active_subscription(db, user.id)
            if sub:
                limit = sub.scan_limit or PLAN_SCAN_LIMITS.get(user.plan, 5)
                if sub.scans_used >= limit:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Scan limit reached ({limit} scans). Please upgrade your plan.",
                    )
                sub.scans_used += 1
                db.commit()

    result = scan_website(req.url)
    return result


# ── Scan History ──────────────────────────────────────────────────────────────

@app.post("/api/scan-history")
def save_scan_history(req: SaveScanHistoryRequest, db: Session = Depends(get_db)):
    """Persist a completed scan result to scan history."""
    user_id = None
    if req.email:
        user = db.query(User).filter(User.email == req.email).first()
        if user:
            user_id = user.id

    if not user_id:
        user_id = "guest"

    history = ScanHistory(
        id=str(uuid4()),
        user_id=user_id,
        target=req.target,
        score=req.score,
        risk_level=req.risk_level,
        findings_count=req.findings_count,
        scan_mode=req.scan_mode,
    )
    db.add(history)
    db.commit()
    return {"status": "saved", "id": history.id}


@app.get("/api/scan-history")
def get_scan_history(email: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieve scan history for a user."""
    if not email:
        return {"scans": []}

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"scans": []}

    scans = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user.id)
        .order_by(ScanHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "scans": [
            {
                "id": s.id,
                "target": s.target,
                "score": s.score,
                "risk_level": s.risk_level,
                "findings_count": s.findings_count,
                "scan_mode": s.scan_mode,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in scans
        ]
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
def login_user(user_data: UserCreate, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_data.email, user_data.full_name or "Security Admin")
    return {
        "status": "success",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
    }


# ── Payments ──────────────────────────────────────────────────────────────────

@app.post("/api/payments/create-order")
def create_payment_order(req: CreateOrderRequest, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, req.email, req.full_name or "Security User")

    order_info = payment_service.create_subscription_order(req.plan, req.billing_period or "monthly")

    amount_in_inr = order_info["amount"] / 100.0
    payment = Payment(
        id=str(uuid4()),
        user_id=user.id,
        razorpay_order_id=order_info["order_id"],
        amount=amount_in_inr,
        currency=order_info.get("currency", "INR"),
        status="created",
        plan=req.plan,
        billing_period=req.billing_period or "monthly",
    )
    db.add(payment)
    db.commit()

    return {
        "order_id": order_info["order_id"],
        "amount": order_info["amount"],
        "currency": order_info.get("currency", "INR"),
        "plan": req.plan,
        "key_id": order_info.get("key_id", "PGTESTPAYUAT"),
        "redirect_url": order_info.get("redirect_url"),
        "status": "created",
        "is_test_mode": payment_service.is_test_mode(),
        "is_mock": order_info.get("is_mock", False),
    }


@app.post("/api/payments/verify")
def verify_payment(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    is_valid = payment_service.verify_payment(req.order_id, req.payment_id, req.signature)

    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    payment = db.query(Payment).filter(Payment.razorpay_order_id == req.order_id).first()
    if not payment:
        payment = Payment(
            id=str(uuid4()),
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

    if not is_valid:
        payment.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid payment verification. Payment not verified.")

    if payment.status == "paid":
        return {
            "status": "success",
            "message": f"Subscription already active for {req.plan}.",
            "plan": req.plan,
        }

    payment.razorpay_payment_id = req.payment_id
    payment.razorpay_signature = req.signature
    payment.status = "paid"

    transaction = Transaction(
        id=str(uuid4()),
        payment_id=payment.id,
        transaction_type="charge",
        amount=req.amount,
        status="success",
        gateway_response="Verified via PhonePe Gateway",
    )
    db.add(transaction)

    user.plan = req.plan

    billing = req.billing_period or "monthly"
    days = 365 if billing == "yearly" else 30
    end_dt = datetime.now(timezone.utc) + timedelta(days=days)
    scan_limit = payment_service.get_scan_limit(req.plan)

    old_subs = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active",
    ).all()
    for s in old_subs:
        s.status = "cancelled"

    subscription = Subscription(
        id=str(uuid4()),
        user_id=user.id,
        plan=req.plan,
        status="active",
        amount=req.amount,
        billing_period=billing,
        end_date=end_dt,
        scan_limit=scan_limit,
        scans_used=0,
    )
    db.add(subscription)

    invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    invoice = Invoice(
        id=str(uuid4()),
        user_id=user.id,
        payment_id=payment.id,
        invoice_number=invoice_number,
        amount=req.amount,
        plan_name=req.plan,
        status="paid",
        pdf_url=f"/api/invoices/{invoice_number}/pdf",
    )
    db.add(invoice)
    db.commit()

    return {
        "status": "success",
        "message": f"Account upgraded to {req.plan}!",
        "plan": req.plan,
        "invoice_number": invoice_number,
        "scan_limit": scan_limit,
        "expires_at": end_dt.isoformat(),
    }


@app.post("/api/payments/phonepe/callback")
async def phonepe_callback(request: Request, db: Session = Depends(get_db)):
    """Handle PhonePe server-to-server callback / webhook."""
    body = await request.body()
    try:
        data = json.loads(body)
    except Exception:
        data = {}

    response_code = data.get("code") or data.get("responseCode")
    merchant_transaction_id = data.get("data", {}).get("merchantTransactionId") or data.get("merchantTransactionId")

    if merchant_transaction_id:
        payment = db.query(Payment).filter(Payment.razorpay_order_id == merchant_transaction_id).first()
        if payment:
            if response_code == "PAYMENT_SUCCESS":
                payment.status = "paid"
                payment.razorpay_payment_id = data.get("data", {}).get("transactionId", "pay_phonepe_" + uuid4().hex[:8])
                db.commit()
            else:
                payment.status = "failed"
                db.commit()

    return {"status": "received"}


# ── Subscription / User ──────────────────────────────────────────────────────

@app.get("/api/subscription")
def get_subscription(email: str, db: Session = Depends(get_db)):
    """Return active subscription details for a user email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {
            "plan": "Free",
            "status": "none",
            "scan_limit": PLAN_SCAN_LIMITS["Free"],
            "scans_used": 0,
            "expires_at": None,
        }

    sub = _get_active_subscription(db, user.id)
    if not sub:
        return {
            "plan": user.plan,
            "status": "none",
            "scan_limit": PLAN_SCAN_LIMITS.get(user.plan, 5),
            "scans_used": 0,
            "expires_at": None,
        }

    return {
        "plan": sub.plan,
        "status": sub.status,
        "scan_limit": sub.scan_limit,
        "scans_used": sub.scans_used,
        "expires_at": sub.end_date.isoformat() if sub.end_date else None,
        "billing_period": sub.billing_period,
        "amount": sub.amount,
    }


@app.get("/api/user")
def get_user_info(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    payments = db.query(Payment).filter(Payment.user_id == user.id).all()

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "plan": user.plan,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "subscriptions": [
            {
                "id": s.id,
                "plan": s.plan,
                "status": s.status,
                "amount": s.amount,
                "billing_period": s.billing_period,
                "start_date": s.start_date.isoformat() if s.start_date else None,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "scan_limit": s.scan_limit,
                "scans_used": s.scans_used,
            }
            for s in db.query(Subscription).filter(Subscription.user_id == user.id).all()
        ],
        "payments": [
            {
                "id": p.id,
                "order_id": p.razorpay_order_id,
                "payment_id": p.razorpay_payment_id,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "plan": p.plan,
                "billing_period": p.billing_period,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ],
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "amount": inv.amount,
                "plan_name": inv.plan_name,
                "status": inv.status,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in db.query(Invoice).filter(Invoice.user_id == user.id).all()
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)