"""Authenticated, profile-scoped medication schedule APIs."""

from datetime import date, datetime, time
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
Frequency = Literal["daily", "weekly", "as_needed"]


async def _run_crud(function, *args):
    try:
        return await run_in_threadpool(function, *args)
    except (RuntimeError, psycopg2.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reminder database is unavailable.",
        ) from error


async def _require_owned_profile(account_id: str, profile_id: str) -> None:
    profile = await _run_crud(crud_user.get_profile_by_id, account_id, profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schedule_id: int = Field(ge=1)
    profile_id: str
    fda_id: int = Field(ge=1)
    sched_is_active: bool
    sched_frequency_type: Frequency
    sched_reminder_time: list[time] = Field(min_length=1)
    sched_start_date: date
    sched_end_date: date | None = None
    sched_notes: str | None = None
    sched_created_at: datetime
    sched_updated_at: datetime
    fda_genericname: str
    fda_brandname: str | None = None
    fda_dosage_form: str | None = None
    fda_dosage_strength: str | None = None


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int = Field(ge=1)
    sched_frequency_type: Frequency
    sched_reminder_time: list[time] = Field(min_length=1)
    sched_start_date: date
    sched_end_date: date | None = None
    sched_notes: str | None = None


class SchedulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fda_id: int | None = Field(default=None, ge=1)
    sched_is_active: bool | None = None
    sched_frequency_type: Frequency | None = None
    sched_reminder_time: list[time] | None = Field(default=None, min_length=1)
    sched_start_date: date | None = None
    sched_end_date: date | None = None
    sched_notes: str | None = None

    @model_validator(mode="after")
    def require_a_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one reminder field must be provided.")
        return self


class ScheduleListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: list[Schedule]


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: Schedule


class ScheduleDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str


def _schedule_response(row: dict | None, code: int, message: str) -> ScheduleResponse:
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ScheduleResponse(
        success=True,
        code=code,
        message=message,
        data=Schedule.model_validate(row),
    )


@router.get(
    "/{profile_id}/schedules",
    response_model=ScheduleListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_schedules(
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> ScheduleListResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    rows = await _run_crud(
        crud_medicine.list_schedules_by_profile,
        account["account_id"],
        profile_id,
    )
    return ScheduleListResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Reminders retrieved successfully.",
        data=[Schedule.model_validate(row) for row in rows],
    )


@router.post(
    "/{profile_id}/schedules",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_schedule(
    payload: ScheduleCreate,
    profile_id: str = _ProfileId,
    account: dict[str, str] = Depends(require_session),
) -> ScheduleResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    try:
        row = await _run_crud(
            crud_medicine.create_schedule,
            account["account_id"],
            profile_id,
            payload.fda_id,
            payload.sched_frequency_type,
            payload.sched_reminder_time,
            payload.sched_start_date,
            payload.sched_end_date,
            payload.sched_notes,
        )
    except (ForeignKeyError, crud_medicine.ValidationError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return _schedule_response(
        row, status.HTTP_201_CREATED, "Reminder created successfully."
    )


@router.patch(
    "/{profile_id}/schedules/{schedule_id}",
    response_model=ScheduleResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_schedule(
    payload: SchedulePatch,
    profile_id: str = _ProfileId,
    schedule_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
) -> ScheduleResponse:
    account_id = account["account_id"]
    await _require_owned_profile(account_id, profile_id)
    existing = await _run_crud(
        crud_medicine.get_schedule_by_id,
        account_id,
        profile_id,
        schedule_id,
    )
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    values = payload.model_dump(exclude_unset=True)
    try:
        row = await _run_crud(
            crud_medicine.update_schedule,
            account_id,
            profile_id,
            schedule_id,
            values.get("fda_id", existing["fda_id"]),
            values.get("sched_is_active", existing["sched_is_active"]),
            values.get("sched_frequency_type", existing["sched_frequency_type"]),
            values.get("sched_reminder_time", existing["sched_reminder_time"]),
            values.get("sched_start_date", existing["sched_start_date"]),
            values.get("sched_end_date", existing["sched_end_date"]),
            values.get("sched_notes", existing["sched_notes"]),
        )
    except (ForeignKeyError, crud_medicine.ValidationError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return _schedule_response(row, status.HTTP_200_OK, "Reminder updated successfully.")


@router.delete(
    "/{profile_id}/schedules/{schedule_id}",
    response_model=ScheduleDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_schedule(
    profile_id: str = _ProfileId,
    schedule_id: int = Path(ge=1),
    account: dict[str, str] = Depends(require_session),
) -> ScheduleDeleteResponse:
    await _require_owned_profile(account["account_id"], profile_id)
    deleted = await _run_crud(
        crud_medicine.delete_schedule,
        account["account_id"],
        profile_id,
        schedule_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return ScheduleDeleteResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Reminder deleted successfully.",
    )
