"""Authenticated, profile-scoped medicine vault APIs."""

from datetime import date, datetime
from typing import Literal

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.concurrency import run_in_threadpool

from api.v1.auth import require_session
from crud import crud_medicine, crud_user
from crud.crud_user import ForeignKeyError


router = APIRouter()
_ProfileId = Path(min_length=1, max_length=16)


async def _run_crud(function, *args):
    try:
        return await run_in_threadpool(function, *args)
    except (RuntimeError, psycopg2.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vault database is unavailable.",
        ) from error


class VaultItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vault_id: int = Field(ge=1)
    profile_id: str
    fda_id: int = Field(ge=1)
    vault_expiry_date: date | None
    vault_created_at: datetime
    vault_updated_at: datetime
    vault_note: str
    vault_status: Literal["verified", "needs_verification"]
    vault_source: Literal["scan", "manual"]
    vault_confidence: int | None = Field(ge=0, le=100)
    fda_registration_id: str
    fda_approval_id: str
    fda_genericname: str
    fda_brandname: str | None = None
    fda_dosage_form: str | None = None
    fda_dosage_strength: str | None = None
    fda_manufacturer: str | None = None
    fda_pharmacologic_category: str | None = None
    fda_classification: str | None = None
    fda_created_at: datetime
    fda_updated_at: datetime


class VaultItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int = Field(ge=1)
    vault_expiry_date: date
    vault_note: str = ""
    vault_status: Literal["verified", "needs_verification"] = "verified"
    vault_source: Literal["scan", "manual"] = "scan"
    vault_confidence: int | None = Field(default=None, ge=0, le=100)


class VaultItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int | None = Field(default=None, ge=1)
    vault_expiry_date: date | None = None

    @model_validator(mode="after")
    def require_a_change(self):
        if self.fda_id is None and self.vault_expiry_date is None:
            raise ValueError("At least one vault field must be provided.")
        return self


class VaultItemsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: list[VaultItem]


class VaultItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: VaultItem


class VaultItemDeleteData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vault_id: int


class VaultItemDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: VaultItemDeleteData


async def _require_owned_profile(account_id: str, profile_id: str) -> None:
    profile = await _run_crud(
        crud_user.get_profile_by_id, account_id, profile_id
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )


def _item_response(
    row: dict | None, code: int, message: str
) -> VaultItemResponse:
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found.",
        )
    return VaultItemResponse(
        success=True,
        code=code,
        message=message,
        data=VaultItem.model_validate(row),
    )


@router.get(
    "/{profile_id}/vault",
    response_model=VaultItemsResponse,
    status_code=status.HTTP_200_OK,
)
async def list_vault_items(
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> VaultItemsResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    rows = await _run_crud(
        crud_medicine.list_vault_items_by_profile,
        account["account_id"],
        profile_id,
    )
    return VaultItemsResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Vault items retrieved successfully.",
        data=[VaultItem.model_validate(row) for row in rows],
    )


@router.post(
    "/{profile_id}/vault",
    response_model=VaultItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vault_item(
    payload: VaultItemCreate,
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> VaultItemResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    try:
        row = await _run_crud(
            crud_medicine.create_vault_item,
            account["account_id"],
            profile_id,
            payload.fda_id,
            payload.vault_expiry_date,
            payload.vault_note,
            payload.vault_status,
            payload.vault_source,
            payload.vault_confidence,
        )
    except ForeignKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return _item_response(
        row, status.HTTP_201_CREATED, "Vault item created successfully."
    )


@router.patch(
    "/{profile_id}/vault/{vault_id}",
    response_model=VaultItemResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_vault_item(
    payload: VaultItemPatch,
    profile_id: str = _ProfileId,
    vault_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
) -> VaultItemResponse:
    account_id = account["account_id"]
    await _require_owned_profile(account_id, profile_id)
    existing = await _run_crud(
        crud_medicine.get_vault_item_by_id, account_id, profile_id, vault_id
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found.",
        )
    try:
        row = await _run_crud(
            crud_medicine.update_vault_item,
            account_id,
            profile_id,
            vault_id,
            payload.fda_id if payload.fda_id is not None else existing["fda_id"],
            (
                payload.vault_expiry_date
                if payload.vault_expiry_date is not None
                else existing["vault_expiry_date"]
            ),
        )
    except ForeignKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return _item_response(row, status.HTTP_200_OK, "Vault item updated successfully.")


@router.delete(
    "/{profile_id}/vault/{vault_id}",
    response_model=VaultItemDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_vault_item(
    profile_id: str = _ProfileId,
    vault_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
) -> VaultItemDeleteResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    deleted = await _run_crud(
        crud_medicine.delete_vault_item,
        account["account_id"],
        profile_id,
        vault_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vault item not found.",
        )
    return VaultItemDeleteResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Vault item deleted successfully.",
        data=VaultItemDeleteData(vault_id=vault_id),
    )
