import uuid

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ForbiddenError, UnauthorizedError
from app.models.user import User, UserRole
from app.security import decode_token


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing or malformed Authorization header.")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Access token has expired.")
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid access token.")

    if payload.get("type") != "access":
        raise UnauthorizedError("Use an access token here, not a refresh token.")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or deactivated.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise ForbiddenError("Admin role required.")
    return user
