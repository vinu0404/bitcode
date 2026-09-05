import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def _encode(payload: dict, minutes: int | None = None, days: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    exp = now + (timedelta(minutes=minutes) if minutes is not None else timedelta(days=days))
    return jwt.encode({**payload, "iat": now, "exp": exp}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    return _encode({"sub": str(user_id), "role": role, "type": "access"}, minutes=settings.access_token_minutes)


def decode_token(token: str) -> dict:
    """Raises jwt.PyJWTError on any invalid/expired token — callers catch it."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def new_refresh_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, sha256_hash, expires_at). Only the hash is stored —
    a stolen database dump doesn't hand over usable refresh tokens."""
    raw = secrets.token_urlsafe(48)
    digest = hash_refresh_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    return raw, digest, expires_at


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
