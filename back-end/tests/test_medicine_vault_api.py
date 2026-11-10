from datetime import date, datetime
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from api.v1.auth import require_session
from main import app


def test_api_root_status_is_public_and_harmless():
    response = TestClient(app).get("/api/v1/")
    assert response.status_code == 200
    assert response.json()["status"]


@pytest.fixture
def authenticated_client():
    async def authenticated_account():
        return {"account_id": "account-1", "email": "owner@example.test"}

    app.dependency_overrides[require_session] = authenticated_account
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(require_session, None)


def _medicine_row(fda_id=71):
    return {
        "fda_id": fda_id,
        "fda_registration_id": "REG-71",
        "fda_approval_id": "APP-71",
        "fda_brandname": "Brand",
        "fda_genericname": "Generic",
        "fda_dosage_form": "Tablet",
        "fda_dosage_strength": "500 mg",
        "fda_manufacturer": "Maker",
        "fda_pharmacologic_category": "Analgesic",
        "fda_classification": "Over-the-Counter (OTC)",
        "fda_created_at": datetime(2026, 1, 1),
        "fda_updated_at": datetime(2026, 1, 2),
    }


def _vault_row():
    return {
        "vault_id": 9,
        "profile_id": "profile-1",
        "fda_id": 71,
        "vault_expiry_date": date(2027, 5, 1),
        "vault_created_at": datetime(2026, 1, 1),
        "vault_updated_at": datetime(2026, 1, 2),
        "fda_registration_id": "REG-71",
        "fda_approval_id": "APP-71",
        "fda_genericname": "Generic",
        "fda_brandname": "Brand",
        "fda_dosage_form": "Tablet",
        "fda_dosage_strength": "500 mg",
        "fda_manufacturer": "Maker",
        "fda_pharmacologic_category": "Analgesic",
        "fda_classification": "Over-the-Counter (OTC)",
        "fda_created_at": datetime(2026, 1, 1),
        "fda_updated_at": datetime(2026, 1, 2),
    }


def test_fda_search_maps_current_registry_fields(authenticated_client, monkeypatch):
    from api.v1 import medicines

    monkeypatch.setattr(
        medicines.crud_medicine, "search_fda_medicines", lambda q, limit, offset: [_medicine_row()]
    )
    response = authenticated_client.get("/api/v1/medicines/search?q=brand")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"][0] == {
        **_medicine_row(),
        "fda_created_at": "2026-01-01T00:00:00",
        "fda_updated_at": "2026-01-02T00:00:00",
    }


def test_fda_search_empty_query_is_empty_without_database_call(
    authenticated_client, monkeypatch
):
    from api.v1 import medicines

    def unexpected_search(*_args):
        raise AssertionError("Blank searches must not query or invent rows.")

    monkeypatch.setattr(medicines.crud_medicine, "search_fda_medicines", unexpected_search)
    response = authenticated_client.get("/api/v1/medicines/search?q=%20%20")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_fda_search_no_matches_returns_empty_data(authenticated_client, monkeypatch):
    from api.v1 import medicines

    monkeypatch.setattr(medicines.crud_medicine, "search_fda_medicines", lambda *_args: [])
    response = authenticated_client.get("/api/v1/medicines/search?q=not-a-medicine")

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_medicine_search_requires_authentication():
    response = TestClient(app).get("/api/v1/medicines/search?q=brand")
    assert response.status_code == 401


def test_vault_create_requires_fda_id_and_maps_database_row(
    authenticated_client, monkeypatch
):
    from api.v1 import vault

    calls = {}
    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda account_id, profile_id: {"profile_id": profile_id},
    )

    def create(account_id, profile_id, fda_id, expiry_date):
        calls.update(
            account_id=account_id,
            profile_id=profile_id,
            fda_id=fda_id,
            expiry_date=expiry_date,
        )
        return _vault_row()

    monkeypatch.setattr(vault.crud_medicine, "create_vault_item", create)
    response = authenticated_client.post(
        "/api/v1/accounts/me/profiles/profile-1/vault",
        json={"fda_id": 71, "vault_expiry_date": "2027-05-01"},
    )

    assert response.status_code == 201
    assert calls == {
        "account_id": "account-1",
        "profile_id": "profile-1",
        "fda_id": 71,
        "expiry_date": date(2027, 5, 1),
    }
    assert response.json()["data"]["fda_id"] == 71
    assert response.json()["data"]["fda_genericname"] == "Generic"


def test_vault_create_rejects_missing_fda_id(authenticated_client):
    response = authenticated_client.post(
        "/api/v1/accounts/me/profiles/profile-1/vault",
        json={"vault_expiry_date": "2027-05-01"},
    )
    assert response.status_code == 422


def test_vault_list_rejects_unowned_profile(authenticated_client, monkeypatch):
    from api.v1 import vault

    monkeypatch.setattr(vault.crud_user, "get_profile_by_id", lambda *_args: None)
    monkeypatch.setattr(
        vault.crud_medicine,
        "list_vault_items_by_profile",
        lambda *_args: pytest.fail("Must not list an unowned profile's vault."),
    )
    response = authenticated_client.get(
        "/api/v1/accounts/me/profiles/foreign-profile/vault"
    )
    assert response.status_code == 404


def test_vault_list_returns_empty_for_owned_profile_without_items(
    authenticated_client, monkeypatch
):
    from api.v1 import vault

    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    monkeypatch.setattr(vault.crud_medicine, "list_vault_items_by_profile", lambda *_args: [])
    response = authenticated_client.get(
        "/api/v1/accounts/me/profiles/profile-1/vault"
    )

    assert response.status_code == 200
    assert response.json()["data"] == []


def test_vault_patch_rejects_item_not_owned_by_selected_profile(
    authenticated_client, monkeypatch
):
    from api.v1 import vault

    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda account_id, profile_id: {"profile_id": profile_id},
    )
    monkeypatch.setattr(
        vault.crud_medicine, "get_vault_item_by_id", lambda *_args: None
    )
    monkeypatch.setattr(
        vault.crud_medicine,
        "update_vault_item",
        lambda *_args: pytest.fail("Must not update an unowned vault row."),
    )
    response = authenticated_client.patch(
        "/api/v1/accounts/me/profiles/profile-1/vault/9",
        json={"vault_expiry_date": "2028-01-01"},
    )
    assert response.status_code == 404


def test_vault_patch_allows_partial_expiry_update(authenticated_client, monkeypatch):
    from api.v1 import vault

    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    monkeypatch.setattr(
        vault.crud_medicine, "get_vault_item_by_id", lambda *_args: _vault_row()
    )
    calls = {}

    def update(account_id, profile_id, vault_id, fda_id, expiry_date):
        calls.update(
            account_id=account_id,
            profile_id=profile_id,
            vault_id=vault_id,
            fda_id=fda_id,
            expiry_date=expiry_date,
        )
        return {**_vault_row(), "vault_expiry_date": expiry_date}

    monkeypatch.setattr(vault.crud_medicine, "update_vault_item", update)
    response = authenticated_client.patch(
        "/api/v1/accounts/me/profiles/profile-1/vault/9",
        json={"vault_expiry_date": "2028-01-01"},
    )

    assert response.status_code == 200
    assert calls["account_id"] == "account-1"
    assert calls["profile_id"] == "profile-1"
    assert calls["fda_id"] == 71
    assert calls["expiry_date"] == date(2028, 1, 1)


def test_vault_delete_scopes_delete_to_authenticated_account(
    authenticated_client, monkeypatch
):
    from api.v1 import vault

    monkeypatch.setattr(
        vault.crud_user,
        "get_profile_by_id",
        lambda _account_id, profile_id: {"profile_id": profile_id},
    )
    calls = {}

    def delete(account_id, profile_id, vault_id):
        calls.update(account_id=account_id, profile_id=profile_id, vault_id=vault_id)
        return True

    monkeypatch.setattr(vault.crud_medicine, "delete_vault_item", delete)
    response = authenticated_client.delete(
        "/api/v1/accounts/me/profiles/profile-1/vault/9"
    )

    assert response.status_code == 200
    assert calls == {
        "account_id": "account-1",
        "profile_id": "profile-1",
        "vault_id": 9,
    }
    assert response.json()["data"] == {"vault_id": 9}
