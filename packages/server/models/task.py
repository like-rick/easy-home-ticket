import uuid
from datetime import date, time, datetime
from sqlalchemy import String, Date, Time, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), default="")
    from_station: Mapped[str] = mapped_column(String(16))
    to_station: Mapped[str] = mapped_column(String(16))
    travel_date: Mapped[date] = mapped_column(Date)
    time_start: Mapped[str] = mapped_column(String(8), default="00:00")
    time_end: Mapped[str] = mapped_column(String(8), default="23:59")
    max_extra_fee: Mapped[int] = mapped_column(Integer, default=30)
    seat_types: Mapped[str] = mapped_column(Text, default='["二等座"]')
    train_nos: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategies: Mapped[str] = mapped_column(Text, default='["direct","split","longer","cross"]')
    passengers: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
