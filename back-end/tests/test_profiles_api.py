"""Profile ownership and contract tests."""

import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from api.v1.auth import require_router_access, require_session
from main import app


@pytest.fixture
def authenticated_client():
    async def authenticated_account():
        return {"account_id": "account-1", "email": "owner@example.test"}

    async def allow_router_access():
        return None

    app.dependency_overrides[require_session] = authenticated_account
    app.dependency_overrides[require_router_access] = allow_router_access
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(require_session, None)
        app.dependency_overrides.pop(require_router_access, None)


def _profile_row(profile_id="profile-1"):
    return {
        "profile_id": profile_id,
        "profile_icon": 1,
        "profile_fullname": "Ana Owner",
        "profile_displayname": "Ana",
        "profile_birthdate": date(1990, 1, 1),
    }


def test_list_profiles_scoped_to_authenticated_account(authenticated_client, monkeypatch):
    from api.v1 import profiles

    calls = []
    monkeypatch.setattr(
        profiles.crud_user,
        "list_profiles_by_account",
        lambda account_id: calls.append(account_id) or [_profile_row()],
    )
    response = authenticated_client.get("/api/v1/accounts/me/profiles/")
    assert response.status_code == 200
    assert calls == ["account-1"]
    payload = response.json()
    assert payload["data"]["account_id"] == "account-1"
    assert payload["data"]["profiles"][0]["profile_id"] == "profile-1"


def test_update_profile_rejects_unowned_profile(authenticated_client, monkeypatch):
    from api.v1 import profiles

    monkeypatch.setattr(
        profiles.crud_user,
        "update_profile",
        lambda *_args, **_kwargs: None,
    )
    response = authenticated_client.put(
        "/api/v1/accounts/me/profiles/other-profile",
        json={
            "profile_icon": 1,
            "profile_fullname": "Other Person",
            "profile_birthdate": "1991-02-02",
            "profile_displayname": "Other",
        },
    )
    assert response.status_code == 404


def test_delete_profile_rejects_unowned_profile(authenticated_client, monkeypatch):
    from api.v1 import profiles

    monkeypatch.setattr(
        profiles.crud_user,
        "delete_profile",
        lambda *_args, **_kwargs: False,
    )
    response = authenticated_client.delete("/api/v1/accounts/me/profiles/other-profile")
    assert response.status_code == 404


def test_create_profile_rejects_malformed_payload(authenticated_client):
    response = authenticated_client.post(
        "/api/v1/accounts/me/profiles/",
        json={
            "profile_icon": -1,
            "profile_fullname": "",
            "profile_birthdate": "not-a-date",
            "profile_displayname": "TooLongName",
        },
    )
    assert response.status_code == 422


def test_vault_list_rejects_unowned_profile(authenticated_client, monkeypatch):
    from api.v1 import vault

    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda *_args, **_kwargs: None,
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/profiles/other-profile/vault"
    )
    assert response.status_code == 404


def test_schedules_list_rejects_unowned_profile(authenticated_client, monkeypatch):
    from api.v1 import schedules

    monkeypatch.setattr(
        schedules.crud_user,
        "get_profile_by_id",
        lambda *_args, **_kwargs: None,
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/profiles/other-profile/schedules"
    )
    assert response.status_code == 404


def test_notifications_reject_unowned_profile_ids(authenticated_client, monkeypatch):
    from api.v1 import notifications

    monkeypatch.setattr(
        notifications.crud_user,
        "list_profiles_by_account",
        lambda _account_id: [_profile_row("profile-1")],
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/notifications",
        params={"profile_ids": ["foreign-profile"]},
    )
    assert response.status_code == 404
