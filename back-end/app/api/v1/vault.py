"""Authenticated vault item endpoints for the Expo client."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict, Field

from api.v1.auth import require_owned_profile, require_session
from crud import crud_medicine as medicine_crud
from crud.crud_medicine import ForeignKeyError, ValidationError
from db.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/vault", tags=["vault"])


class VaultItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    vault_id: int
    profile_id: str
    fda_id: int
    vault_expiry_date: date | None = None
    fda_brandname: str | None = None
    fda_genericname: str | None = None
    fda_dosage_form: str | None = None
    fda_dosage_strength: str | None = None


class VaultListResponse(BaseModel):
    success: bool
    code: int
    message: str
    data: list[dict[str, Any]]


class VaultItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str = Field(min_length=1, max_length=32)
    fda_id: int = Field(ge=1)
    expiry_date: date


class VaultItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int = Field(ge=1)
    expiry_date: date


class VaultItemResponse(BaseModel):
    success: bool
    code: int
    message: str
    data: dict[str, Any] | None = None


def _serialize(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    out = dict(row)
    for key, value in list(out.items()):
        if hasattr(value, "isoformat"):
            out[key] = value.isoformat()
    return out


@router.get("/fda/search", response_model=VaultListResponse)
async def search_fda(
    q: str = Query(min_length=1, max_length=200),
    account: dict[str, str] = Depends(require_session),
) -> VaultListResponse:
    _ = account
    rows = medicine_crud.search_fda_medicines(q, limit=20, offset=0)
    return VaultListResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="FDA medicines retrieved successfully.",
        data=[_serialize(row) or {} for row in rows],
    )


@router.get("/{profile_id}", response_model=VaultListResponse)
async def list_vault(
    profile_id: str = Path(min_length=1, max_length=32),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> VaultListResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    rows = medicine_crud.list_vault_items_by_profile(account["account_id"], profile_id)
    return VaultListResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Vault items retrieved successfully.",
        data=[_serialize(row) or {} for row in rows],
    )


@router.post("/", response_model=VaultItemResponse, status_code=status.HTTP_201_CREATED)
async def create_vault(
    payload: VaultItemCreate,
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> VaultItemResponse:
    await require_owned_profile(payload.profile_id, account["account_id"], db)
    try:
        row = medicine_crud.create_vault_item(
            account["account_id"],
            payload.profile_id,
            payload.fda_id,
            payload.expiry_date,
        )
    except (ForeignKeyError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return VaultItemResponse(
        success=True,
        code=status.HTTP_201_CREATED,
        message="Vault item created successfully.",
        data=_serialize(row),
    )


@router.patch("/{profile_id}/{vault_id}", response_model=VaultItemResponse)
async def update_vault(
    payload: VaultItemUpdate,
    profile_id: str = Path(min_length=1, max_length=32),
    vault_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> VaultItemResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    try:
        row = medicine_crud.update_vault_item(
            account["account_id"],
            profile_id,
            vault_id,
            payload.fda_id,
            payload.expiry_date,
        )
    except (ForeignKeyError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault item not found.")
    return VaultItemResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Vault item updated successfully.",
        data=_serialize(row),
    )


@router.delete("/{profile_id}/{vault_id}", response_model=VaultItemResponse)
async def delete_vault(
    profile_id: str = Path(min_length=1, max_length=32),
    vault_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> VaultItemResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    deleted = medicine_crud.delete_vault_item(account["account_id"], profile_id, vault_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault item not found.")
    return VaultItemResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Vault item deleted successfully.",
        data=None,
    )
