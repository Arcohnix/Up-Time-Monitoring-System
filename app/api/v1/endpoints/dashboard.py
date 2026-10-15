from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.incidents.schemas import IncidentResponse
from app.models.check_result import CheckResultModel
from app.models.incident import IncidentModel
from app.models.service import Service
from app.schemas.dashboard import DashboardOverview, DashboardServiceItem, LatencyPoint

router = APIRouter()


@router.get(
    "",
    response_model=DashboardOverview,
    summary="Get aggregated system overview metrics and service health for the dashboard",
    description="Returns system-wide uptime, average latency, service cards with individual metrics, active incidents, and recent latency history.",
)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
) -> DashboardOverview:
    # 1. Fetch all services
    services_result = await db.execute(select(Service).order_by(Service.id))
    services: List[Service] = list(services_result.scalars().all())

    # Map service id to name
    service_names: Dict[int, str] = {s.id: s.name for s in services}

    # 2. Aggregated stats per service in a single efficient SQL query
    stats_stmt = (
        select(
            CheckResultModel.service_id,
            func.count(CheckResultModel.id).label("total_checks"),
            func.sum(case((CheckResultModel.success.is_(True), 1), else_=0)).label("successful_checks"),
            func.sum(case((CheckResultModel.success.is_(False), 1), else_=0)).label("failed_checks"),
            func.avg(
                case(
                    (CheckResultModel.success.is_(True), CheckResultModel.response_time_ms),
                    else_=None,
                )
            ).label("avg_response_time"),
        )
        .group_by(CheckResultModel.service_id)
    )
    stats_rows = (await db.execute(stats_stmt)).all()
    stats_map = {row.service_id: row for row in stats_rows}

    # 3. Retrieve most recent check for each service
    recent_checks_stmt = (
        select(CheckResultModel)
        .order_by(desc(CheckResultModel.checked_at))
        .limit(200)
    )
    all_recent = (await db.execute(recent_checks_stmt)).scalars().all()
    last_check_map: Dict[int, CheckResultModel] = {}
    for r in all_recent:
        if r.service_id not in last_check_map:
            last_check_map[r.service_id] = r

    # 4. Construct service dashboard items
    dashboard_services: List[DashboardServiceItem] = []
    total_successful = 0
    total_checks_all = 0
    sum_latencies = 0.0
    count_latencies = 0

    healthy_count = 0
    degraded_count = 0
    down_count = 0

    for srv in services:
        stats = stats_map.get(srv.id)
        t_checks = int(stats.total_checks or 0) if stats else 0
        s_checks = int(stats.successful_checks or 0) if stats else 0
        f_checks = int(stats.failed_checks or 0) if stats else 0
        avg_lat = round(float(stats.avg_response_time), 2) if stats and stats.avg_response_time is not None else None

        uptime_pct = round((s_checks / t_checks) * 100.0, 2) if t_checks > 0 else 0.0

        total_successful += s_checks
        total_checks_all += t_checks
        if avg_lat is not None and s_checks > 0:
            sum_latencies += avg_lat * s_checks
            count_latencies += s_checks

        if srv.is_active:
            if srv.current_state == "HEALTHY":
                healthy_count += 1
            elif srv.current_state == "FAILING":
                degraded_count += 1
            elif srv.current_state == "DOWN":
                down_count += 1
            else:
                healthy_count += 1

        last_check = last_check_map.get(srv.id)

        dashboard_services.append(
            DashboardServiceItem(
                id=srv.id,
                name=srv.name,
                url=srv.url,
                http_method=srv.http_method,
                check_interval_seconds=srv.check_interval_seconds,
                timeout_seconds=srv.timeout_seconds,
                is_active=srv.is_active,
                current_state=srv.current_state,
                uptime_percentage=uptime_pct,
                avg_response_time_ms=avg_lat,
                total_checks=t_checks,
                successful_checks=s_checks,
                failed_checks=f_checks,
                consecutive_failures=srv.consecutive_failures,
                failure_threshold=srv.failure_threshold,
                last_status_code=last_check.status_code if last_check else None,
                last_checked_at=last_check.checked_at if last_check else None,
            )
        )

    # 5. Global Metrics
    overall_uptime = round((total_successful / total_checks_all) * 100.0, 2) if total_checks_all > 0 else 100.0
    overall_avg_latency = round(sum_latencies / count_latencies, 2) if count_latencies > 0 else None

    # System Status determination
    if down_count > 0:
        if down_count == len([s for s in services if s.is_active]) and down_count > 0:
            system_status = "MAJOR OUTAGE"
        else:
            system_status = "PARTIAL OUTAGE"
    elif degraded_count > 0:
        system_status = "DEGRADED"
    else:
        system_status = "SYSTEM ONLINE"

    # 6. Response Time History for Chart (last 40 data points, chronological)
    chart_points: List[LatencyPoint] = []
    # Take first 40 recent checks and reverse them for chronological display
    chart_sample = list(reversed(all_recent[:40]))
    for pt in chart_sample:
        chart_points.append(
            LatencyPoint(
                id=pt.id,
                service_id=pt.service_id,
                service_name=service_names.get(pt.service_id, f"Service {pt.service_id}"),
                timestamp=pt.checked_at,
                response_time_ms=pt.response_time_ms,
                success=pt.success,
                status_code=pt.status_code,
            )
        )

    # 7. Active Incidents
    incidents_stmt = (
        select(IncidentModel)
        .where(IncidentModel.status == "OPEN")
        .order_by(desc(IncidentModel.started_at))
    )
    incidents_rows = (await db.execute(incidents_stmt)).scalars().all()
    active_incidents = [IncidentResponse.model_validate(inc) for inc in incidents_rows]

    return DashboardOverview(
        system_status=system_status,
        overall_uptime_percentage=overall_uptime,
        overall_avg_response_time_ms=overall_avg_latency,
        total_services=len(services),
        healthy_services=healthy_count,
        degraded_services=degraded_count,
        down_services=down_count,
        services=dashboard_services,
        recent_response_times=chart_points,
        active_incidents=active_incidents,
    )
