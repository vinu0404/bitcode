from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.errors import ConflictError, UnauthorizedError
from app.models.user import RefreshToken, User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, SupabaseLoginRequest, TokenPair, UserOut
from app.security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.services.supabase_auth import sign_in_with_supabase, verified_identity

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_token_pair(db: Session, user: User) -> TokenPair:
    access = create_access_token(user.id, user.role.value)
    raw_refresh, digest, expires_at = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=expires_at))
    db.commit()
    return TokenPair(access_token=access, refresh_token=raw_refresh)


@router.post("/register", response_model=TokenPair, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenPair:
    email = body.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ConflictError("An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token_pair(db, user)


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    # A Supabase-only account has no password hash: same answer as a wrong password.
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash) or not user.is_active:
        raise UnauthorizedError("Incorrect email or password.")
    return _issue_token_pair(db, user)


@router.post("/supabase", response_model=TokenPair)
def supabase_login(body: SupabaseLoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = sign_in_with_supabase(db, verified_identity(body.access_token))
    return _issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    digest = hash_refresh_token(body.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == digest).first()
    now = datetime.now(timezone.utc)
    if not stored or stored.revoked_at is not None or stored.expires_at < now:
        raise UnauthorizedError("Refresh token is invalid, expired, or already used.")

    # Single-use rotation: this token is burned the instant it's redeemed,
    # whether or not the caller ever sees the new pair.
    stored.revoked_at = now
    db.commit()

    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or deactivated.")
    return _issue_token_pair(db, user)


@router.post("/logout", status_code=204)
def logout(body: LogoutRequest, db: Session = Depends(get_db)) -> None:
    digest = hash_refresh_token(body.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == digest).first()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
