from datetime import date, datetime, time
import sys
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


def _schedule_row():
    return {
        "schedule_id": 13,
        "profile_id": "profile-1",
        "fda_id": 71,
        "sched_is_active": True,
        "sched_frequency_type": "daily",
        "sched_reminder_time": [time(9, 0)],
        "sched_start_date": date(2026, 5, 1),
        "sched_end_date": None,
        "sched_notes": None,
        "sched_created_at": datetime(2026, 5, 1, 8),
        "sched_updated_at": datetime(2026, 5, 1, 8),
        "fda_genericname": "Generic",
        "fda_brandname": "Brand",
        "fda_dosage_form": "Tablet",
        "fda_dosage_strength": "500 mg",
    }


def test_list_schedules_requires_owned_profile(authenticated_client, monkeypatch):
    from api.v1 import schedules

    calls = []
    monkeypatch.setattr(
        schedules.crud_user,
        "get_profile_by_id",
        lambda account_id, profile_id: calls.append((account_id, profile_id)) or {"profile_id": profile_id},
    )
    monkeypatch.setattr(
        schedules.crud_medicine,
        "list_schedules_by_profile",
        lambda account_id, profile_id: [_schedule_row()],
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/profiles/profile-1/schedules"
    )

    assert response.status_code == 200
    assert calls == [("account-1", "profile-1")]
    assert response.json()["data"][0]["fda_genericname"] == "Generic"


def test_create_schedule_persists_fda_record_and_reminder_fields(
    authenticated_client, monkeypatch
):
    from api.v1 import schedules

    monkeypatch.setattr(
        schedules.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    calls = {}

    def create(*args):
        calls["args"] = args
        return _schedule_row()

    monkeypatch.setattr(schedules.crud_medicine, "create_schedule", create)
    response = authenticated_client.post(
        "/api/v1/accounts/me/profiles/profile-1/schedules",
        json={
            "fda_id": 71,
            "sched_frequency_type": "daily",
            "sched_reminder_time": ["09:00:00"],
            "sched_start_date": "2026-05-01",
            "sched_notes": "Take with food",
        },
    )

    assert response.status_code == 201
    assert calls["args"] == (
        "account-1",
        "profile-1",
        71,
        "daily",
        [time(9, 0)],
        date(2026, 5, 1),
        None,
        "Take with food",
    )
    assert response.json()["data"]["schedule_id"] == 13


def test_patch_schedule_updates_only_the_owned_record(
    authenticated_client, monkeypatch
):
    from api.v1 import schedules

    monkeypatch.setattr(
        schedules.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    monkeypatch.setattr(
        schedules.crud_medicine,
        "get_schedule_by_id",
        lambda *_args: _schedule_row(),
    )
    calls = {}

    def update(*args):
        calls["args"] = args
        return {**_schedule_row(), "sched_is_active": False}

    monkeypatch.setattr(schedules.crud_medicine, "update_schedule", update)
    response = authenticated_client.patch(
        "/api/v1/accounts/me/profiles/profile-1/schedules/13",
        json={"sched_is_active": False},
    )

    assert response.status_code == 200
    assert calls["args"] == (
        "account-1",
        "profile-1",
        13,
        71,
        False,
        "daily",
        [time(9, 0)],
        date(2026, 5, 1),
        None,
        None,
    )
    assert response.json()["data"]["sched_is_active"] is False


def test_delete_schedule_scopes_delete_to_authenticated_account(
    authenticated_client, monkeypatch
):
    from api.v1 import schedules

    monkeypatch.setattr(
        schedules.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    calls = {}

    def delete(account_id, profile_id, schedule_id):
        calls["args"] = (account_id, profile_id, schedule_id)
        return True

    monkeypatch.setattr(schedules.crud_medicine, "delete_schedule", delete)
    response = authenticated_client.delete(
        "/api/v1/accounts/me/profiles/profile-1/schedules/13"
    )

    assert response.status_code == 200
    assert calls["args"] == ("account-1", "profile-1", 13)
