from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from . import Base


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(8))
    pinyin: Mapped[str] = mapped_column(String(64), index=True)
    full_pinyin: Mapped[str] = mapped_column(String(64))
