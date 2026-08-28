"""Password hashing and signed bearer-token authentication."""

import base64
import hashlib
import hmac
import json
import os
import time
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_session
from .models import Merchant, MerchantUser, User

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters.")
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$16384$8$1$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        _, n, r, p, salt_value, digest_value = encoded.split("$")
        salt = base64.urlsafe_b64decode(salt_value.encode())
        expected = base64.urlsafe_b64decode(digest_value.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def issue_token(user_id: uuid.UUID) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": str(user_id), "exp": int(time.time()) + 86400}
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()
    unsigned = f"{encode(header)}.{encode(payload)}"
    signature = hmac.new(get_settings().auth_secret.encode(), unsigned.encode(), hashlib.sha256).digest()
    return f"{unsigned}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        encoded_header, encoded_payload, encoded_signature = credentials.credentials.split(".")
        unsigned = f"{encoded_header}.{encoded_payload}"
        expected = hmac.new(get_settings().auth_secret.encode(), unsigned.encode(), hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        if not hmac.compare_digest(expected, supplied):
            raise unauthorized
        payload = json.loads(base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4)))
        if int(payload["exp"]) < int(time.time()):
            raise unauthorized
        user = await session.get(User, uuid.UUID(payload["sub"]))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise unauthorized from None
    if user is None or not user.is_active:
        raise unauthorized
    return user


async def get_current_merchant(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Merchant:
    membership = await session.scalar(
        select(MerchantUser).where(MerchantUser.user_id == user.id)
    )
    if membership is None:
        raise HTTPException(status_code=403, detail="User is not assigned to a merchant.")
    merchant = await session.get(Merchant, membership.merchant_id)
    if merchant is None or not merchant.is_active:
        raise HTTPException(status_code=403, detail="Merchant account is inactive.")
    return merchant
