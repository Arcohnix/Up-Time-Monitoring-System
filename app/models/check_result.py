from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CheckResultModel(Base):
    """Historical record of an individual endpoint health check."""

    __tablename__ = "check_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    service_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship to parent Service
    service = relationship("Service", backref="check_results")

    @property
    def timestamp(self) -> datetime:
        """Backwards compatibility alias for checked_at."""
        return self.checked_at

    def __repr__(self) -> str:
        return (
            f"<CheckResultModel id={self.id} service_id={self.service_id} "
            f"checked_at={self.checked_at} success={self.success}>"
        )
