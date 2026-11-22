import logging
import secrets
import uuid
from dataclasses import dataclass

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError, ConflictError, UnauthorizedError
from app.models.user import User, UserRole

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class SupabaseIdentity:
    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None


def verified_identity(access_token: str) -> SupabaseIdentity:
    """Ask Supabase who this access token belongs to; return that identity.

    Calling /auth/v1/user is the check: Supabase rejects forged or expired
    tokens, so no JWT secret or secret key is needed here. The email must be
    confirmed, because it is later used to link an existing account.
    """
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise AppError("Google sign-in is not configured.", status_code=503, code="not_configured")
    try:
        res = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_publishable_key, "Authorization": f"Bearer {access_token}"},
            timeout=8,
        )
    except httpx.HTTPError:
        raise AppError("Could not reach the sign-in service. Try again.", status_code=502, code="upstream_unavailable")
    if res.status_code != 200:
        raise UnauthorizedError("Sign-in could not be verified. Try again.")
    data = res.json()
    email = (data.get("email") or "").strip().lower()
    confirmed = data.get("email_confirmed_at") or data.get("confirmed_at")
    if not email or not confirmed:
        raise UnauthorizedError("Your email is not verified.")
    try:
        uid = uuid.UUID(str(data.get("id")))
    except ValueError:
        raise UnauthorizedError("Sign-in could not be verified. Try again.")
    meta = data.get("user_metadata") or {}
    return SupabaseIdentity(
        id=uid,
        email=email,
        name=meta.get("full_name") or meta.get("name") or None,
        avatar_url=meta.get("avatar_url") or meta.get("picture") or None,
    )


def _profile_is_admin(db: Session, uid: uuid.UUID) -> bool | None:
    """Whether the bit_web site marks this account as an admin.

    Reads public.profile."isAdmin", the table the main site keeps in the same
    Supabase database. None when the table or row is missing (a database
    without that site, or a user who has not opened it yet) or on any error:
    role sync is best-effort and must never block a sign-in. The savepoint
    stops a failed query from aborting the surrounding transaction.
    """
    try:
        with db.begin_nested():
            row = db.execute(text('SELECT "isAdmin" FROM public.profile WHERE id = :uid'), {"uid": str(uid)}).first()
    except Exception as exc:  # noqa: BLE001
        log.info("admin role lookup skipped: %s", exc.__class__.__name__)
        return None
    return None if row is None else bool(row[0])


def sign_in_with_supabase(db: Session, identity: SupabaseIdentity) -> User:
    """The Bitcode user for a verified Supabase identity, created or linked.

    Order: already linked by uid, else an existing account with the same
    (verified) email, which gets linked, else a new account with no password.
    """
    user = db.query(User).filter(User.supabase_id == identity.id).first()
    if user is None:
        user = db.query(User).filter(User.email == identity.email).first()
        if user is not None and user.supabase_id not in (None, identity.id):
            raise ConflictError("This email is already linked to a different sign-in account.")
    if user is None:
        user = User(email=identity.email, password_hash=None)
        db.add(user)
    elif not user.is_active:
        raise UnauthorizedError("This account is deactivated.")

    user.supabase_id = identity.id
    user.display_name = user.display_name or identity.name
    user.avatar_url = identity.avatar_url or user.avatar_url

    # Admin on the main site means admin here. Every user on this path is
    # linked, so it may demote as well as promote; accounts that only ever use
    # a password never reach this code. A missing profile leaves the role alone.
    is_admin = _profile_is_admin(db, identity.id)
    if is_admin is not None:
        user.role = UserRole.admin if is_admin else UserRole.student

    db.commit()
    db.refresh(user)
    return user
