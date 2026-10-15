from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.incidents.manager import get_incident_by_id, get_incidents
from app.incidents.schemas import IncidentResponse

router = APIRouter()


@router.get(
    "",
    response_model=List[IncidentResponse],
    summary="List all incidents",
    description="Returns a paginated list of system incidents with optional service and status filtering.",
)
async def list_incidents(
    service_id: Optional[int] = Query(None, description="Filter incidents by service ID"),
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by incident status (OPEN or RESOLVED)",
    ),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    db: AsyncSession = Depends(get_db),
) -> List[IncidentResponse]:
    incidents = await get_incidents(
        db=db,
        service_id=service_id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return [IncidentResponse.model_validate(inc) for inc in incidents]


@router.get(
    "/{id}",
    response_model=IncidentResponse,
    summary="Get incident details",
    description="Retrieves a specific incident by its unique ID.",
)
async def get_incident(
    id: int,
    db: AsyncSession = Depends(get_db),
) -> IncidentResponse:
    incident = await get_incident_by_id(db=db, incident_id=id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with id {id} not found",
        )
    return IncidentResponse.model_validate(incident)
