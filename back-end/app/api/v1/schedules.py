"""Authenticated medication schedule endpoints for the Expo client."""

from datetime import date, time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth import require_owned_profile, require_session
from crud import crud_medicine as medicine_crud
from crud.crud_medicine import ForeignKeyError, ValidationError
from db.database import get_db


router = APIRouter(prefix="/schedules", tags=["schedules"])


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: str = Field(min_length=1, max_length=32)
    fda_id: int = Field(ge=1)
    frequency_type: str = Field(min_length=1, max_length=40)
    reminder_times: list[str] = Field(min_length=1)
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int = Field(ge=1)
    is_active: bool = True
    frequency_type: str = Field(min_length=1, max_length=40)
    reminder_times: list[str] = Field(min_length=1)
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class ScheduleResponse(BaseModel):
    success: bool
    code: int
    message: str
    data: dict[str, Any] | list[dict[str, Any]] | None = None


def _serialize(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    out = dict(row)
    for key, value in list(out.items()):
        if isinstance(value, list):
            out[key] = [
                item.isoformat() if hasattr(item, "isoformat") else item for item in value
            ]
        elif hasattr(value, "isoformat"):
            out[key] = value.isoformat()
    return out


def _parse_times(values: list[str]) -> list[time]:
    parsed: list[time] = []
    for value in values:
        text = value.strip()
        if len(text) == 5:
            text = f"{text}:00"
        parsed.append(time.fromisoformat(text))
    return parsed


@router.get("/{profile_id}", response_model=ScheduleResponse)
async def list_schedules(
    profile_id: str = Path(min_length=1, max_length=32),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> ScheduleResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    rows = medicine_crud.list_schedules_by_profile(account["account_id"], profile_id)
    return ScheduleResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Schedules retrieved successfully.",
        data=[_serialize(row) or {} for row in rows],
    )


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleCreate,
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> ScheduleResponse:
    await require_owned_profile(payload.profile_id, account["account_id"], db)
    try:
        row = medicine_crud.create_schedule(
            account["account_id"],
            payload.profile_id,
            payload.fda_id,
            payload.frequency_type,
            _parse_times(payload.reminder_times),
            payload.start_date,
            payload.end_date,
            payload.notes,
        )
    except (ForeignKeyError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return ScheduleResponse(
        success=True,
        code=status.HTTP_201_CREATED,
        message="Schedule created successfully.",
        data=_serialize(row),
    )


@router.put("/{profile_id}/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    payload: ScheduleUpdate,
    profile_id: str = Path(min_length=1, max_length=32),
    schedule_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> ScheduleResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    try:
        row = medicine_crud.update_schedule(
            account["account_id"],
            profile_id,
            schedule_id,
            payload.fda_id,
            payload.is_active,
            payload.frequency_type,
            _parse_times(payload.reminder_times),
            payload.start_date,
            payload.end_date,
            payload.notes,
        )
    except (ForeignKeyError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")
    return ScheduleResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Schedule updated successfully.",
        data=_serialize(row),
    )


@router.delete("/{profile_id}/{schedule_id}", response_model=ScheduleResponse)
async def delete_schedule(
    profile_id: str = Path(min_length=1, max_length=32),
    schedule_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
    db: AsyncSession | None = Depends(get_db),
) -> ScheduleResponse:
    await require_owned_profile(profile_id, account["account_id"], db)
    deleted = medicine_crud.delete_schedule(account["account_id"], profile_id, schedule_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")
    return ScheduleResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Schedule deleted successfully.",
        data=None,
    )
