from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Service(Base):
    """Monitored Service entity representing an HTTP/HTTPS endpoint target."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    http_method: Mapped[str] = mapped_column(String(10), nullable=False, default="GET")
    check_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    expected_status_code: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # State tracking & incident thresholds
    failure_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_state: Mapped[str] = mapped_column(String(20), nullable=False, default="HEALTHY", index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Service id={self.id} name='{self.name}' state='{self.current_state}' "
            f"consecutive_failures={self.consecutive_failures}/{self.failure_threshold}>"
        )
