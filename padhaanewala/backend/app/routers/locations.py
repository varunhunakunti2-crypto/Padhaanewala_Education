from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import City, District, State
from app.schemas.catalog import CityResponse, DistrictResponse, StateResponse

router = APIRouter(prefix="/api/v1", tags=["locations"])


@router.get("/locations/states", response_model=list[StateResponse])
def list_states(db: Session = Depends(get_db)):
    return db.scalars(select(State).where(State.is_active).order_by(State.name)).all()


@router.get(
    "/locations/states/{state_id}/districts",
    response_model=list[DistrictResponse],
)
def list_districts(state_id: int, db: Session = Depends(get_db)):
    state = db.get(State, state_id)
    if state is None:
        raise HTTPException(status_code=404, detail="State not found")
    return (
        db.scalars(
            select(District)
            .where(District.state_id == state_id)
            .order_by(District.name)
        )
        .all()
    )


@router.get(
    "/locations/districts/{district_id}/cities",
    response_model=list[CityResponse],
)
def list_cities(district_id: int, db: Session = Depends(get_db)):
    district = db.get(District, district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    return (
        db.scalars(
            select(City).where(City.district_id == district_id).order_by(City.name)
        )
        .all()
    )