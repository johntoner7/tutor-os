import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app import db
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

ALGORITHM = "HS256"


# --- Models ---

class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkResponse(BaseModel):
    message: str
    debug_link: str | None = None  # only populated when debug_magic_link=True


class VerifyResponse(BaseModel):
    token: str
    user_id: str
    email: str


class MeResponse(BaseModel):
    user_id: str
    email: str


# --- JWT helpers ---

def _make_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- FastAPI dependency ---

def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    return decode_jwt(token)


def get_optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


# --- Endpoints ---

@router.post("/magic-link", response_model=MagicLinkResponse)
async def request_magic_link(body: MagicLinkRequest) -> MagicLinkResponse:
    token = secrets.token_urlsafe(32)
    db.create_magic_token(body.email, token)

    verify_url = f"{settings.allowed_origins_list[0]}/?token={token}"

    if settings.debug_magic_link:
        print(f"[DEBUG] Magic link for {body.email}: {verify_url}")
        return MagicLinkResponse(
            message="Magic link generated (debug mode — check server logs or debug_link field).",
            debug_link=verify_url,
        )

    # TODO: send real email here
    return MagicLinkResponse(message="Check your email for a login link.")


@router.get("/verify", response_model=VerifyResponse)
async def verify_magic_link(token: str) -> VerifyResponse:
    email = db.consume_magic_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired link. Please request a new one.")

    user = db.get_or_create_user(email)
    jwt_token = _make_jwt(user["id"], user["email"])
    return VerifyResponse(token=jwt_token, user_id=user["id"], email=user["email"])


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=current_user["sub"], email=current_user["email"])
