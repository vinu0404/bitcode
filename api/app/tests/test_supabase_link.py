import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.deps import get_db
from app.errors import ConflictError, UnauthorizedError
from app.main import app
from app.models.user import User, UserRole
from app.security import hash_password
from app.services import supabase_auth
from app.services.supabase_auth import SupabaseIdentity, sign_in_with_supabase


def _ident(email="ada@example.com", uid=None, name="Ada", avatar="http://a/p.png"):
    return SupabaseIdentity(id=uid or uuid.uuid4(), email=email, name=name, avatar_url=avatar)


def _profile(db, uid, is_admin):
    db.execute(text('INSERT INTO public.profile (id, "isAdmin") VALUES (:i, :a)'), {"i": str(uid), "a": is_admin})
    db.commit()


def test_new_supabase_user_is_created_without_a_password(db):
    ident = _ident()
    user = sign_in_with_supabase(db, ident)
    assert (user.email, user.supabase_id, user.password_hash) == ("ada@example.com", ident.id, None)
    assert (user.display_name, user.avatar_url, user.role) == ("Ada", "http://a/p.png", UserRole.student)


def test_existing_password_account_is_linked_by_email_and_keeps_its_password(db):
    db.add(User(email="ada@example.com", password_hash=hash_password("hunter2hunter2")))
    db.commit()
    ident = _ident()
    user = sign_in_with_supabase(db, ident)
    assert user.supabase_id == ident.id and user.password_hash
    assert db.query(User).count() == 1


def test_second_sign_in_finds_the_user_by_uid_even_if_the_email_changed(db):
    ident = _ident()
    first = sign_in_with_supabase(db, ident)
    again = sign_in_with_supabase(db, _ident(email="new@example.com", uid=ident.id))
    assert again.id == first.id and db.query(User).count() == 1


def test_email_linked_to_another_supabase_account_is_refused(db):
    sign_in_with_supabase(db, _ident())
    with pytest.raises(ConflictError):
        sign_in_with_supabase(db, _ident(uid=uuid.uuid4()))


def test_deactivated_account_cannot_sign_in(db):
    db.add(User(email="ada@example.com", password_hash=None, is_active=False))
    db.commit()
    with pytest.raises(UnauthorizedError):
        sign_in_with_supabase(db, _ident())


def test_admin_on_the_main_site_becomes_admin_here(db):
    ident = _ident()
    _profile(db, ident.id, True)
    assert sign_in_with_supabase(db, ident).role == UserRole.admin


def test_losing_admin_on_the_main_site_demotes_here(db):
    ident = _ident()
    _profile(db, ident.id, True)
    sign_in_with_supabase(db, ident)
    db.execute(text('UPDATE public.profile SET "isAdmin" = false'))
    db.commit()
    assert sign_in_with_supabase(db, ident).role == UserRole.student


def test_missing_profile_row_leaves_the_role_alone(db):
    db.add(User(email="ada@example.com", password_hash=None, role=UserRole.admin))
    db.commit()
    assert sign_in_with_supabase(db, _ident()).role == UserRole.admin


def test_missing_profile_table_never_blocks_sign_in(db):
    db.execute(text("ALTER TABLE public.profile RENAME TO profile_gone"))
    db.commit()
    try:
        user = sign_in_with_supabase(db, _ident())
        assert user.role == UserRole.student
        assert db.query(User).count() == 1  # the transaction survived the failed lookup
    finally:
        db.rollback()
        db.execute(text("ALTER TABLE public.profile_gone RENAME TO profile"))
        db.commit()


def test_password_only_account_is_never_touched_by_role_sync(db):
    db.add(User(email="boss@example.com", password_hash=hash_password("hunter2hunter2"), role=UserRole.admin))
    db.commit()
    other = _ident(email="other@example.com")
    _profile(db, other.id, False)
    sign_in_with_supabase(db, other)
    assert db.query(User).filter(User.email == "boss@example.com").one().role == UserRole.admin


@pytest.fixture()
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_password_login_rejects_an_account_with_no_password(client, db):
    db.add(User(email="ada@example.com", password_hash=None))
    db.commit()
    res = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "anything-at-all"})
    assert res.status_code == 401
    assert res.json()["message"] == "Incorrect email or password."


def test_password_login_still_works(client, db):
    db.add(User(email="ada@example.com", password_hash=hash_password("hunter2hunter2")))
    db.commit()
    res = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "hunter2hunter2"})
    assert res.status_code == 200 and res.json()["access_token"]


def test_supabase_endpoint_issues_bitcode_tokens(client, db, monkeypatch):
    ident = _ident()
    monkeypatch.setattr("app.routers.auth.verified_identity", lambda token: ident)
    res = client.post("/api/auth/supabase", json={"access_token": "t" * 20})
    assert res.status_code == 200 and res.json()["refresh_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["email"] == "ada@example.com" and me.json()["display_name"] == "Ada"
