"""Authenticated live medication notifications and device token registration."""

from datetime import datetime, timedelta
from typing import Literal

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from api.v1.auth import require_session
from crud import crud_medicine, crud_user
from db.database import connection_cursor


router = APIRouter()


class NotificationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal["medication_reminder"]
    title: str
    message: str
    profile_id: str
    profile_display_name: str
    scheduled_at: datetime


class NotificationFeedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str
    data: list[NotificationItem]


class DeviceTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    push_token: str = Field(min_length=1, max_length=4096)
    platform: Literal["ios", "android"]

    @field_validator("push_token")
    @classmethod
    def require_nonempty_token(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("The push token cannot be blank.")
        return token


class DeviceTokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int
    message: str


async def _run_database(function, *args):
    try:
        return await run_in_threadpool(function, *args)
    except (RuntimeError, psycopg2.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Notification database is unavailable.",
        ) from error


def _insert_device_token(account_id: str, push_token: str, platform: str) -> None:
    with connection_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO notification_push_tokens (
                account_id, push_token, platform, token_updated_at
            )
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (push_token) DO UPDATE
            SET account_id = EXCLUDED.account_id,
                platform = EXCLUDED.platform,
                token_updated_at = CURRENT_TIMESTAMP
            """,
            (account_id, push_token, platform),
        )


def _notifications_for_profile(
    profile: dict,
    schedules: list[dict],
    now: datetime,
    cutoff: datetime,
) -> list[NotificationItem]:
    items: list[NotificationItem] = []
    display_name = profile["profile_displayname"]

    for schedule in schedules:
        if not schedule["sched_is_active"]:
            continue
        frequency = schedule["sched_frequency_type"]
        if frequency == "as_needed":
            continue
        if frequency not in ("daily", "weekly"):
            continue

        start_date = schedule["sched_start_date"]
        end_date = schedule["sched_end_date"]
        first_date = max(start_date, now.date())
        last_date = min(end_date, cutoff.date()) if end_date else cutoff.date()
        if first_date > last_date:
            continue

        reminder_times = schedule["sched_reminder_time"]
        current_date = first_date
        while current_date <= last_date:
            days_since_start = (current_date - start_date).days
            if frequency == "daily" or days_since_start % 7 == 0:
                for reminder_time in reminder_times:
                    scheduled_at = datetime.combine(current_date, reminder_time)
                    if now < scheduled_at <= cutoff:
                        medicine = (
                            schedule.get("fda_brandname")
                            or schedule["fda_genericname"]
                        )
                        items.append(
                            NotificationItem(
                                id=(
                                    f"{schedule['schedule_id']}:"
                                    f"{profile['profile_id']}:"
                                    f"{scheduled_at.isoformat(timespec='minutes')}"
                                ),
                                type="medication_reminder",
                                title="Medication reminder",
                                message=f"Time to take {medicine} for {display_name}.",
                                profile_id=profile["profile_id"],
                                profile_display_name=display_name,
                                scheduled_at=scheduled_at,
                            )
                        )
            current_date += timedelta(days=1)

    return items


@router.get(
    "/notifications",
    response_model=NotificationFeedResponse,
    status_code=status.HTTP_200_OK,
)
async def list_notifications(
    profile_ids: list[str] | None = Query(default=None, max_length=100),
    horizon_days: int = Query(default=7, ge=1, le=30),
    local_now: datetime | None = Query(default=None),
    account: dict[str, str] = Depends(require_session),
) -> NotificationFeedResponse:
    account_id = account["account_id"]
    profiles = await _run_database(crud_user.list_profiles_by_account, account_id)
    if profile_ids is not None:
        requested_ids = set(profile_ids)
        profile_by_id = {profile["profile_id"]: profile for profile in profiles}
        if requested_ids - profile_by_id.keys():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more profiles were not found.",
            )
        profiles = [profile for profile in profiles if profile["profile_id"] in requested_ids]

    now = (local_now or datetime.now()).replace(second=0, microsecond=0)
    cutoff = now + timedelta(days=horizon_days)
    notifications: list[NotificationItem] = []
    for profile in profiles:
        schedules = await _run_database(
            crud_medicine.list_schedules_by_profile,
            account_id,
            profile["profile_id"],
        )
        notifications.extend(
            _notifications_for_profile(profile, schedules, now, cutoff)
        )

    notifications.sort(key=lambda item: item.scheduled_at)
    return NotificationFeedResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Notifications retrieved successfully.",
        data=notifications,
    )


@router.post(
    "/notifications/device-token",
    response_model=DeviceTokenResponse,
    status_code=status.HTTP_200_OK,
)
async def register_device_token(
    payload: DeviceTokenRequest,
    account: dict[str, str] = Depends(require_session),
) -> DeviceTokenResponse:
    await _run_database(
        _insert_device_token,
        account["account_id"],
        payload.push_token.strip(),
        payload.platform,
    )
    return DeviceTokenResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="Device notification token registered.",
    )
