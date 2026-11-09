"""Profile management endpoints backed by Postgres CRUD."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field

from api.v1.auth import require_session
from crud import crud_user as user_crud
from crud.crud_user import DuplicateError, ValidationError


router = APIRouter()


class Profile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str
    profile_icon: int = Field(ge=0)
    profile_fullname: str = Field(min_length=1, max_length=255)
    profile_displayname: str = Field(min_length=1, max_length=10)
    profile_birthdate: date


class AccountProfiles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: str
    email: str
    profiles: list[Profile] | None = None


class ProfilesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: AccountProfiles


class ProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_icon: int = Field(ge=0)
    profile_fullname: str = Field(min_length=1, max_length=255)
    profile_birthdate: date
    profile_displayname: str = Field(min_length=1, max_length=10)


class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: Profile


class ProfileUpdate(ProfileCreate):
    pass


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_icon: int | None = Field(default=None, ge=0)
    profile_fullname: str | None = Field(default=None, min_length=1, max_length=255)
    profile_birthdate: date | None = None
    profile_displayname: str | None = Field(default=None, min_length=1, max_length=10)


class ProfileDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str


def _row_to_profile(row: dict[str, Any]) -> Profile:
    birth = row.get("profile_birthdate")
    if hasattr(birth, "isoformat"):
        birth = birth.isoformat()
    return Profile(
        profile_id=str(row["profile_id"]),
        profile_icon=int(row["profile_icon"]),
        profile_fullname=str(row["profile_fullname"]),
        profile_displayname=str(row["profile_displayname"]),
        profile_birthdate=date.fromisoformat(str(birth)[:10]),
    )


@router.get("/", response_model=ProfilesResponse, status_code=status.HTTP_200_OK)
async def get_profiles(
    account: dict[str, str] = Depends(require_session),
) -> ProfilesResponse:
    rows = user_crud.list_profiles_by_account(account["account_id"])
    return ProfilesResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Profiles retrieved successfully.",
        data=AccountProfiles(
            account_id=account["account_id"],
            email=account["email"],
            profiles=[_row_to_profile(row) for row in rows],
        ),
    )


@router.post(
    "/",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_profile(
    payload: ProfileCreate,
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    try:
        row = user_crud.create_profile(
            account["account_id"],
            payload.profile_icon,
            payload.profile_fullname,
            payload.profile_displayname,
            payload.profile_birthdate,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DuplicateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    return ProfileResponse(
        success=True,
        code=status.HTTP_201_CREATED,
        message="Profile created successfully.",
        data=_row_to_profile(row),
    )


@router.put(
    "/{profile_id}",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
)
async def replace_profile(
    payload: ProfileUpdate,
    profile_id: str = Path(min_length=1, max_length=32),
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    try:
        row = user_crud.update_profile(
            account["account_id"],
            profile_id,
            payload.profile_icon,
            payload.profile_fullname,
            payload.profile_displayname,
            payload.profile_birthdate,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ProfileResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Profile updated successfully.",
        data=_row_to_profile(row),
    )


@router.patch(
    "/{profile_id}",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_profile(
    payload: ProfilePatch,
    profile_id: str = Path(min_length=1, max_length=32),
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    try:
        row = user_crud.patch_profile(
            account["account_id"],
            profile_id,
            profile_icon=payload.profile_icon,
            profile_fullname=payload.profile_fullname,
            profile_displayname=payload.profile_displayname,
            profile_birthdate=payload.profile_birthdate,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ProfileResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Profile updated successfully.",
        data=_row_to_profile(row),
    )


@router.delete(
    "/{profile_id}",
    response_model=ProfileDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_profile(
    profile_id: str = Path(min_length=1, max_length=32),
    account: dict[str, str] = Depends(require_session),
) -> ProfileDeleteResponse:
    deleted = user_crud.delete_profile(account["account_id"], profile_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ProfileDeleteResponse(
        success=True,
        code=status.HTTP_200_OK,
        message=f"Profile {profile_id} deleted successfully.",
    )
