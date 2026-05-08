from datetime import datetime, UTC
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class ScanLog(Base):
    __tablename__ = "scan_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), index=True)
    solution_id: Mapped[str] = mapped_column(String(36), ForeignKey("solutions.id"), index=True)
    event: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
