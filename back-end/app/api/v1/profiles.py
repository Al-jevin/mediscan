"""Profile management for the logged-in account."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from api.v1.auth import require_router_access, require_session
from crud import crud_user


router = APIRouter()
router.dependencies.append(Depends(require_router_access))


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


_ProfileId = Path(min_length=1, max_length=16)


def _to_profile(row: dict[str, Any]) -> Profile:
    return Profile(
        profile_id=row["profile_id"],
        profile_icon=row["profile_icon"],
        profile_fullname=row["profile_fullname"],
        profile_displayname=row["profile_displayname"],
        profile_birthdate=row["profile_birthdate"],
    )


def _profile_response(row: dict[str, Any] | None, code: int, message: str) -> ProfileResponse:
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ProfileResponse(success=True, code=code, message=message, data=_to_profile(row))


@router.get("/", response_model=ProfilesResponse, status_code=status.HTTP_200_OK)
async def get_profiles(account: dict[str, str] = Depends(require_session)) -> ProfilesResponse:
    rows = await run_in_threadpool(crud_user.list_profiles_by_account, account["account_id"])
    return ProfilesResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Profiles retrieved successfully.",
        data=AccountProfiles(
            account_id=account["account_id"],
            email=account["email"],
            profiles=[_to_profile(row) for row in rows],
        ),
    )


@router.post("/", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileCreate,
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    row = await run_in_threadpool(
        crud_user.create_profile, account["account_id"], **payload.model_dump()
    )
    return _profile_response(row, status.HTTP_201_CREATED, "Profile created successfully.")


@router.put("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
async def replace_profile(
    payload: ProfileUpdate,
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    row = await run_in_threadpool(
        crud_user.update_profile, account["account_id"], profile_id, **payload.model_dump()
    )
    return _profile_response(row, status.HTTP_200_OK, "Profile updated successfully.")


@router.patch("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
async def patch_profile(
    payload: ProfilePatch,
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> ProfileResponse:
    try:
        row = await run_in_threadpool(
            crud_user.patch_profile,
            account["account_id"],
            profile_id,
            **payload.model_dump(exclude_unset=True),
        )
    except crud_user.ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    return _profile_response(row, status.HTTP_200_OK, "Profile updated successfully.")


@router.delete("/{profile_id}", response_model=ProfileDeleteResponse, status_code=status.HTTP_200_OK)
async def delete_profile(
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> ProfileDeleteResponse:
    deleted = await run_in_threadpool(crud_user.delete_profile, account["account_id"], profile_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ProfileDeleteResponse(
        success=True,
        code=status.HTTP_200_OK,
        message=f"Profile {profile_id} deleted successfully.",
    )
