import httpx
import pytest

from app.errors import AppError, UnauthorizedError
from app.services import supabase_auth


class _Res:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


@pytest.fixture(autouse=True)
def _configured(monkeypatch):
    monkeypatch.setattr(supabase_auth.settings, "supabase_url", "https://x.supabase.co")
    monkeypatch.setattr(supabase_auth.settings, "supabase_publishable_key", "pk")


def _get(monkeypatch, res):
    monkeypatch.setattr(supabase_auth.httpx, "get", lambda *a, **k: res)


_UID = "6f1c1c9e-0000-4000-8000-000000000001"


def test_identity_is_lowercased_with_profile_fields(monkeypatch):
    _get(monkeypatch, _Res(200, {"id": _UID, "email": "A@B.com", "email_confirmed_at": "2026-01-01", "user_metadata": {"full_name": "Ada", "picture": "http://a/p.png"}}))
    ident = supabase_auth.verified_identity("tok" * 5)
    assert (ident.email, ident.name, ident.avatar_url) == ("a@b.com", "Ada", "http://a/p.png")


def test_unverified_email_rejected(monkeypatch):
    _get(monkeypatch, _Res(200, {"id": _UID, "email": "a@b.com"}))
    with pytest.raises(UnauthorizedError):
        supabase_auth.verified_identity("tok" * 5)


def test_bad_token_rejected(monkeypatch):
    _get(monkeypatch, _Res(401, {}))
    with pytest.raises(UnauthorizedError):
        supabase_auth.verified_identity("tok" * 5)


def test_upstream_down_is_502(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(supabase_auth.httpx, "get", boom)
    with pytest.raises(AppError) as e:
        supabase_auth.verified_identity("tok" * 5)
    assert e.value.status_code == 502
