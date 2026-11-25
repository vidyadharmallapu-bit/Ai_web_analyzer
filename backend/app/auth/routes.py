import os
import secrets
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.db.database import get_db
from app.db.models import User, OAuthAccount

router = APIRouter(prefix="/auth", tags=["authentication"])

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

_oauth_states = {}

def _generate_state():
    return secrets.token_urlsafe(32)

def _store_state(state, provider, data=None):
    _oauth_states[state] = {
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
        "data": data or {}
    }

def _validate_state(state, provider):
    stored = _oauth_states.pop(state, None)
    if not stored:
        return False
    if stored["provider"] != provider:
        return False
    if datetime.now(timezone.utc) - stored["created_at"] > timedelta(minutes=10):
        return False
    return True

def _create_session_cookie(response, user_id, email, name):
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

def _clear_session_cookie(response):
    response.delete_cookie(key="session", path="/", httponly=True, secure=os.getenv("ENVIRONMENT") == "production", samesite="lax")

async def _get_current_user(request, db):
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

class SocialLoginRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    provider_user_id: str
    provider: str
    avatar_url: Optional[str] = None

class LoginResponse(BaseModel):
    status: str
    user_id: str
    email: str
    full_name: str
    plan: str
    avatar_url: Optional[str] = None

def _get_or_create_user_from_oauth(db, email, full_name, provider, provider_user_id, avatar_url=None):
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
        id=str(uuid.uuid4()),
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

import uuid

@router.get("/google")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    state = _generate_state()
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

@router.get("/google/callback")
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

@router.get("/microsoft")
async def microsoft_login(request: Request):
    if not MICROSOFT_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    state = _generate_state()
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

@router.get("/microsoft/callback")
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

@router.get("/x")
async def x_login(request: Request):
    if not X_CLIENT_ID:
        raise HTTPException(status_code=500, detail="X OAuth not configured")
    state = _generate_state()
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

@router.get("/x/callback")
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

@router.post("/logout")
async def logout(request: Request, response: Response):
    _clear_session_cookie(response)
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me")
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

@router.post("/link")
async def link_oauth_account(request: Request, data: SocialLoginRequest, db: Session = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    existing = db.query(OAuthAccount).filter(
        OAuthAccount.provider == data.provider,
        OAuthAccount.provider_user_id == data.provider_user_id
    ).first()
    if existing and existing.user_id != user.id:
        raise HTTPException(status_code=400, detail="This account is already linked to another user")
    oauth_account = db.query(OAuthAccount).filter(
        OAuthAccount.user_id == user.id,
        OAuthAccount.provider == data.provider
    ).first()
    if not oauth_account:
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider=data.provider,
            provider_user_id=data.provider_user_id,
            provider_email=data.provider_email,
        )
        db.add(oauth_account)
    if data.avatar_url and not user.avatar_url:
        user.avatar_url = data.avatar_url
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"status": "success", "message": f"Linked {data.provider} account"}

@router.delete("/unlink/{provider}")
async def unlink_oauth_account(request: Request, provider: str, db: Session = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if provider not in ["google", "microsoft", "x"]:
        raise HTTPException(status_code=400, detail="Invalid provider")
    has_password = bool(user.hashed_password)
    other_oauth = db.query(OAuthAccount).filter(
        OAuthAccount.user_id == user.id,
        OAuthAccount.provider != provider
    ).count()
    if not has_password and other_oauth == 0:
        raise HTTPException(status_code=400, detail="Cannot unlink: you must have at least one login method")
    oauth_account = db.query(OAuthAccount).filter(
        OAuthAccount.user_id == user.id,
        OAuthAccount.provider == provider
    ).first()
    if oauth_account:
        db.delete(oauth_account)
        db.commit()
    return {"status": "success", "message": f"Unlinked {provider} account"}