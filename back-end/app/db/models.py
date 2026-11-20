"""SQLAlchemy ORM models used by the backend."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class NotificationPushToken(Base):
    __tablename__ = "notification_push_tokens"

    token_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    account_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=False,
    )
    push_token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    token_updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
