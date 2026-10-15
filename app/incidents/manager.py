import logging
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.base import AlertEvent, AlertEventType
from app.alerts.service import AlertService, get_alert_service
from app.checker.schemas import CheckResult
from app.incidents.schemas import IncidentStatus, ServiceState
from app.models.incident import IncidentModel
from app.models.service import Service

logger = logging.getLogger("utms.incidents")


async def get_active_incident(db: AsyncSession, service_id: int) -> Optional[IncidentModel]:
    """Retrieve the current OPEN incident for a service, if one exists."""
    statement = (
        select(IncidentModel)
        .where(
            IncidentModel.service_id == service_id,
            IncidentModel.status == IncidentStatus.OPEN.value,
        )
        .order_by(desc(IncidentModel.started_at))
        .limit(1)
    )
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def get_incidents(
    db: AsyncSession,
    service_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[IncidentModel]:
    """Retrieve incident records with optional service and status filtering."""
    statement = select(IncidentModel).order_by(desc(IncidentModel.started_at)).offset(skip).limit(limit)

    if service_id is not None:
        statement = statement.where(IncidentModel.service_id == service_id)
    if status is not None:
        statement = statement.where(IncidentModel.status == status.upper())

    result = await db.execute(statement)
    return list(result.scalars().all())


async def get_incident_by_id(db: AsyncSession, incident_id: int) -> Optional[IncidentModel]:
    """Retrieve an incident by primary key."""
    statement = select(IncidentModel).where(IncidentModel.id == incident_id)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def process_check_result(
    db: AsyncSession,
    service: Service,
    result: CheckResult,
    alert_service: Optional[AlertService] = None,
) -> Optional[IncidentModel]:
    """Evaluate health check result against the service state machine and manage incident lifecycle.

    State Transition Matrix:
    - HEALTHY + Failure -> FAILING (consecutive_failures < threshold)
    - FAILING + Failure -> FAILING or DOWN (when consecutive_failures >= threshold)
    - FAILING + Success -> HEALTHY (consecutive_failures reset to 0)
    - DOWN (Incident OPEN) + Failure -> DOWN (incident failure_count incremented, no duplicate incident)
    - DOWN (Incident OPEN) + Success -> HEALTHY (active incident marked RESOLVED, failure_count reset)
    """
    # Ensure service is attached to db session so modifications are committed
    db_service = await db.get(Service, service.id)
    if db_service is not None:
        service = db_service

    if not result.success:
        # Failure detected
        service.consecutive_failures += 1

        if service.consecutive_failures < service.failure_threshold:
            # Below threshold: temporary failure (degraded/failing), no incident created yet
            service.current_state = ServiceState.FAILING.value
            logger.info(
                "Service %s (%s) failure count %d/%d (state=FAILING)",
                service.id,
                service.name,
                service.consecutive_failures,
                service.failure_threshold,
            )
            await db.commit()
            return None

        # Reached or exceeded failure threshold: service is DOWN
        service.current_state = ServiceState.DOWN.value

        active_incident = await get_active_incident(db, service.id)

        if active_incident is None:
            # Create brand new active incident
            active_incident = IncidentModel(
                service_id=service.id,
                status=IncidentStatus.OPEN.value,
                started_at=result.checked_at,
                failure_count=service.consecutive_failures,
                last_error_type=result.error_type,
                last_error_message=result.error_message,
                last_status_code=result.status_code,
                last_failed_at=result.checked_at,
            )
            db.add(active_incident)
            await db.commit()
            await db.refresh(active_incident)

            logger.warning(
                "INCIDENT OPENED: Service %s (%s) reached %d consecutive failures (DOWN). Error: %s",
                service.id,
                service.name,
                service.consecutive_failures,
                result.error_message,
            )

            # Record Prometheus incident metrics
            try:
                from app.core.metrics import record_incident_opened
                record_incident_opened(service.name)
            except Exception as m_exc:
                logger.debug("Metrics record_incident_opened failed: %s", m_exc)

            # Dispatch notification for incident creation (failure alert)
            try:
                dispatcher = alert_service or get_alert_service()
                event = AlertEvent(
                    event_type=AlertEventType.INCIDENT_CREATED,
                    incident_id=active_incident.id,
                    service_id=service.id,
                    service_name=service.name,
                    service_url=service.url,
                    timestamp=active_incident.started_at,
                    failure_count=active_incident.failure_count,
                    error_type=active_incident.last_error_type,
                    error_message=active_incident.last_error_message,
                    status_code=active_incident.last_status_code,
                )
                await dispatcher.dispatch(event)
            except Exception as alert_exc:
                logger.error(
                    "Notification dispatch error on incident open for service %s: %s",
                    service.id,
                    alert_exc,
                    exc_info=True,
                )

            return active_incident
        else:
            # Existing incident is already open: update failure details without creating duplicates
            active_incident.failure_count = service.consecutive_failures
            active_incident.last_error_type = result.error_type
            active_incident.last_error_message = result.error_message
            active_incident.last_status_code = result.status_code
            active_incident.last_failed_at = result.checked_at

            await db.commit()
            await db.refresh(active_incident)

            logger.warning(
                "INCIDENT ONGOING: Service %s (%s) consecutive failures=%d. Error: %s",
                service.id,
                service.name,
                service.consecutive_failures,
                result.error_message,
            )
            # Repeated failures while incident is already open do NOT trigger duplicate alerts
            return active_incident

    else:
        # Success detected
        active_incident = await get_active_incident(db, service.id)

        if active_incident is not None:
            # Resolve existing active incident
            active_incident.status = IncidentStatus.RESOLVED.value
            active_incident.resolved_at = result.checked_at
            latency_str = f" in {result.response_time_ms}ms" if result.response_time_ms is not None else ""
            active_incident.recovery_message = (
                f"Service recovered successfully with HTTP {result.status_code}{latency_str}."
            )

            service.consecutive_failures = 0
            service.current_state = ServiceState.HEALTHY.value

            await db.commit()
            await db.refresh(active_incident)

            logger.info(
                "INCIDENT RESOLVED: Service %s (%s) recovered after %d failures (state=HEALTHY)",
                service.id,
                service.name,
                active_incident.failure_count,
            )

            # Record Prometheus incident metrics
            try:
                from app.core.metrics import record_incident_resolved
                record_incident_resolved(service.name)
            except Exception as m_exc:
                logger.debug("Metrics record_incident_resolved failed: %s", m_exc)

            # Dispatch notification for incident recovery
            try:
                dispatcher = alert_service or get_alert_service()
                event = AlertEvent(
                    event_type=AlertEventType.INCIDENT_RESOLVED,
                    incident_id=active_incident.id,
                    service_id=service.id,
                    service_name=service.name,
                    service_url=service.url,
                    timestamp=active_incident.resolved_at,
                    failure_count=active_incident.failure_count,
                    status_code=result.status_code,
                    recovery_message=active_incident.recovery_message,
                )
                await dispatcher.dispatch(event)
            except Exception as alert_exc:
                logger.error(
                    "Notification dispatch error on incident resolve for service %s: %s",
                    service.id,
                    alert_exc,
                    exc_info=True,
                )

            return active_incident
        else:
            # Normal healthy check or recovery from transient failure below threshold
            if service.consecutive_failures > 0:
                logger.info(
                    "Service %s (%s) restored to HEALTHY after %d transient failure(s)",
                    service.id,
                    service.name,
                    service.consecutive_failures,
                )

            service.consecutive_failures = 0
            service.current_state = ServiceState.HEALTHY.value
            await db.commit()
            return None
