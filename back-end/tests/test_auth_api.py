"""Auth and session contract tests (no production credentials)."""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from api.v1 import auth as auth_module
from db.database import get_db
from main import app


@pytest.fixture(autouse=True)
def clear_rate_buckets():
    auth_module._rate_buckets.clear()
    yield
    auth_module._rate_buckets.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_register_rejects_missing_terms_acceptance(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new-user@example.test",
            "password": "SecurePass1!",
            "terms_accepted": False,
            "terms_version": "",
        },
    )
    assert response.status_code == 400
    assert "Terms" in response.json()["detail"]


def test_register_rejects_common_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new-user@example.test",
            "password": "password123",
            "terms_accepted": True,
            "terms_version": "1.0",
        },
    )
    assert response.status_code == 422


def test_register_rejects_malformed_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "SecurePass1!",
            "terms_accepted": True,
            "terms_version": "1.0",
        },
    )
    assert response.status_code == 422


def test_login_requires_database(client):
    async def no_db():
        yield None

    app.dependency_overrides[get_db] = no_db
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.test", "password": "SecurePass1!"},
        )
        assert response.status_code == 503
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_protected_route_rejects_missing_bearer(client):
    response = client.get("/api/v1/accounts/me/profiles/")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired session."


def test_protected_route_rejects_malformed_bearer(client):
    response = client.get(
        "/api/v1/accounts/me/profiles/",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401


def test_protected_route_rejects_expired_or_unknown_session(client):
    session = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.first.return_value = None
    session.execute = AsyncMock(return_value=result)

    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        # secrets.token_urlsafe(32) → 43 url-safe characters
        token = "a" * 43
        response = client.get(
            "/api/v1/accounts/me/profiles/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired session."
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_login_rejects_invalid_credentials(client):
    session = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.first.return_value = None
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()

    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "missing@example.test", "password": "SecurePass1!"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_login_rejects_unverified_account(client):
    session = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.first.return_value = {
        "account_id": "9f5e8b2c-2fab-41b5-8c5a-b066c71d2eba",
        "password_hash": auth_module._dummy_password_hash,
        "account_is_verified": False,
        "account_is_deleted": False,
    }
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()

    async def fake_db():
        yield session

    # Force password match against dummy hash path by monkeypatching verify.
    original = auth_module._matches_password
    auth_module._matches_password = lambda _hash, _password: True
    app.dependency_overrides[get_db] = fake_db
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.test", "password": "SecurePass1!"},
        )
        assert response.status_code == 403
        assert "verify" in response.json()["detail"].lower()
    finally:
        auth_module._matches_password = original
        app.dependency_overrides.pop(get_db, None)


def test_verify_code_rejects_invalid_otp(client):
    response = client.post(
        "/api/v1/auth/verifyCode",
        json={"email": "owner@example.test", "code": "000000"},
    )
    assert response.status_code == 400
