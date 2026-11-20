import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from api.v1.auth import require_session
from main import app


@pytest.fixture
def authenticated_client():
    async def authenticated_account():
        return {"account_id": "account-1", "email": "owner@example.test"}

    app.dependency_overrides[require_session] = authenticated_account
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(require_session, None)


def test_list_notifications_rejects_unowned_profile_ids(authenticated_client, monkeypatch):
    from api.v1 import notifications

    monkeypatch.setattr(
        notifications.crud_user,
        "list_profiles_by_account",
        lambda _account_id: [{"profile_id": "profile-1", "profile_displayname": "Ana"}],
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/notifications",
        params={"profile_ids": ["profile-1", "other-profile"]},
    )
    assert response.status_code == 404


def test_list_notifications_builds_due_reminders(authenticated_client, monkeypatch):
    from api.v1 import notifications

    now = datetime(2026, 5, 1, 8, 0, 0)
    monkeypatch.setattr(
        notifications.crud_user,
        "list_profiles_by_account",
        lambda _account_id: [{"profile_id": "profile-1", "profile_displayname": "Ana"}],
    )
    monkeypatch.setattr(
        notifications.crud_medicine,
        "list_schedules_by_profile",
        lambda _account_id, _profile_id: [
            {
                "schedule_id": 13,
                "profile_id": "profile-1",
                "fda_id": 71,
                "sched_is_active": True,
                "sched_frequency_type": "daily",
                "sched_reminder_time": [time(9, 0)],
                "sched_start_date": date(2026, 5, 1),
                "sched_end_date": None,
                "fda_genericname": "Paracetamol",
                "fda_brandname": "Biogesic",
            }
        ],
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/notifications",
        params={"profile_ids": ["profile-1"], "local_now": now.isoformat()},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert len(payload["data"]) >= 1
    assert payload["data"][0]["type"] == "medication_reminder"
    assert "Biogesic" in payload["data"][0]["message"]


def test_register_device_token_persists_for_account(authenticated_client, monkeypatch):
    from api.v1 import notifications

    calls = {}

    def insert(account_id, push_token, platform):
        calls["args"] = (account_id, push_token, platform)

    monkeypatch.setattr(notifications, "_insert_device_token", insert)
    response = authenticated_client.post(
        "/api/v1/accounts/me/notifications/device-token",
        json={"push_token": "ExponentPushToken[abc]", "platform": "android"},
    )
    assert response.status_code == 200
    assert calls["args"] == (
        "account-1",
        "ExponentPushToken[abc]",
        "android",
    )


def test_revoke_device_token_deletes_owned_token(authenticated_client, monkeypatch):
    from api.v1 import notifications

    calls = {}

    def delete(account_id, push_token):
        calls["args"] = (account_id, push_token)
        return True

    monkeypatch.setattr(notifications, "_delete_device_token", delete)
    response = authenticated_client.request(
        "DELETE",
        "/api/v1/accounts/me/notifications/device-token",
        json={"push_token": "ExponentPushToken[abc]"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Device notification token revoked."
    assert calls["args"] == ("account-1", "ExponentPushToken[abc]")


def test_revoke_device_token_is_idempotent_when_missing(authenticated_client, monkeypatch):
    from api.v1 import notifications

    monkeypatch.setattr(notifications, "_delete_device_token", lambda *_: False)
    response = authenticated_client.request(
        "DELETE",
        "/api/v1/accounts/me/notifications/device-token",
        json={"push_token": "ExponentPushToken[gone]"},
    )
    assert response.status_code == 200
    assert "not registered" in response.json()["message"]


def test_list_notifications_excludes_past_and_respects_horizon(
    authenticated_client, monkeypatch
):
    from api.v1 import notifications

    now = datetime(2026, 5, 1, 10, 0, 0)
    monkeypatch.setattr(
        notifications.crud_user,
        "list_profiles_by_account",
        lambda _account_id: [{"profile_id": "profile-1", "profile_displayname": "Ana"}],
    )
    monkeypatch.setattr(
        notifications.crud_medicine,
        "list_schedules_by_profile",
        lambda _account_id, _profile_id: [
            {
                "schedule_id": 13,
                "profile_id": "profile-1",
                "fda_id": 71,
                "sched_is_active": True,
                "sched_frequency_type": "daily",
                "sched_reminder_time": [time(9, 0), time(11, 0)],
                "sched_start_date": date(2026, 5, 1),
                "sched_end_date": date(2026, 5, 2),
                "fda_genericname": "Paracetamol",
                "fda_brandname": "Biogesic",
            }
        ],
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/notifications",
        params={
            "profile_ids": ["profile-1"],
            "local_now": now.isoformat(),
            "horizon_days": 1,
        },
    )
    assert response.status_code == 200
    scheduled = [item["scheduled_at"] for item in response.json()["data"]]
    assert all("2026-05-01T09:00" not in value for value in scheduled)
    assert any("2026-05-01T11:00" in value for value in scheduled)


def test_list_notifications_stable_ids_are_idempotent(
    authenticated_client, monkeypatch
):
    from api.v1 import notifications

    now = datetime(2026, 5, 1, 8, 0, 0)
    monkeypatch.setattr(
        notifications.crud_user,
        "list_profiles_by_account",
        lambda _account_id: [{"profile_id": "profile-1", "profile_displayname": "Ana"}],
    )
    monkeypatch.setattr(
        notifications.crud_medicine,
        "list_schedules_by_profile",
        lambda _account_id, _profile_id: [
            {
                "schedule_id": 13,
                "profile_id": "profile-1",
                "fda_id": 71,
                "sched_is_active": True,
                "sched_frequency_type": "daily",
                "sched_reminder_time": [time(9, 0)],
                "sched_start_date": date(2026, 5, 1),
                "sched_end_date": None,
                "fda_genericname": "Paracetamol",
                "fda_brandname": "Biogesic",
            }
        ],
    )
    params = {"profile_ids": ["profile-1"], "local_now": now.isoformat()}
    first = authenticated_client.get("/api/v1/accounts/me/notifications", params=params)
    second = authenticated_client.get("/api/v1/accounts/me/notifications", params=params)
    assert first.json()["data"][0]["id"] == second.json()["data"][0]["id"]
