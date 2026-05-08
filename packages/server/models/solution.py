import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from . import Base

class Solution(Base):
    __tablename__ = "solutions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"))
    plan_type: Mapped[str] = mapped_column(String(16))
    train_no: Mapped[str] = mapped_column(String(16))
    segments: Mapped[str] = mapped_column(Text)
    total_price: Mapped[float] = mapped_column(Float, default=0.0)
    extra_fee: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    ticket_status: Mapped[str] = mapped_column(String(16), default="pending")
    locked_segment_index: Mapped[int] = mapped_column(Integer, default=-1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
