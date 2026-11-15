
from datetime import datetime, timezone, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import get_connection
from app.readiness.requirements_evaluator import (evaluate_requirements)
from app.readiness.measurement_resolver import (resolve_measurements)

router = APIRouter(
    prefix="/api/fitness",
    tags=["Crew Fitness"],
)

METRIC_FIELDS = [
    "vo2max",
    "premission_vo2max",
    "deadlift_kg",
    "bench_press_kg",
    "bodyweight_kg",
    "muscle_strength",
    "premission_muscle_strength",
]

BASELINE_FIELDS = {
    "premission_vo2max",
    "premission_muscle_strength",
}


def utc_now():
    return datetime.now(timezone.utc)


def normalize_datetime(value: datetime):
    if value.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="Datetime must include a timezone",
        )

    return value.astimezone(timezone.utc)


class FitnessMeasurement(BaseModel):
    astronaut_id: str = Field(min_length=1, max_length=100)
    mission_id: int | None = None
    measured_at_utc: datetime | None = None

    assessment_phase: Literal[
        "pre_mission",
        "in_mission",
    ]

    vo2max: float | None = Field(default=None, ge=0)
    premission_vo2max: float | None = Field(
        default=None, gt=0
    )

    deadlift_kg: float | None = Field(default=None, ge=0)
    bench_press_kg: float | None = Field(default=None, ge=0)
    bodyweight_kg: float | None = Field(default=None, gt=0)

    muscle_strength: float | None = Field(default=None, ge=0)
    premission_muscle_strength: float | None = Field(
        default=None, gt=0
    )

    is_synthetic: bool = False
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/measurements", status_code=201)
def save_measurement(payload: FitnessMeasurement):
    measured_at = normalize_datetime(
        payload.measured_at_utc or utc_now()
    )

    if measured_at > utc_now() + timedelta(minutes=5):
        raise HTTPException(
            status_code=422,
            detail="Future measurements are not allowed",
        )

    measurements = payload.model_dump()

    if not any(
        measurements[field] is not None
        for field in METRIC_FIELDS
    ):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one fitness measurement",
        )

    if payload.assessment_phase != "pre_mission":
        if any(
            measurements[field] is not None
            for field in BASELINE_FIELDS
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Premission baseline measurements must "
                    "be recorded in the pre_mission phase"
                ),
            )

    measurements["measured_at_utc"] = (
        measured_at.isoformat()
    )
    measurements["created_at_utc"] = utc_now().isoformat()
    measurements["is_synthetic"] = int(
        payload.is_synthetic
    )

    columns = list(measurements.keys())
    placeholders = ", ".join("?" for _ in columns)

    with get_connection() as db:
        cursor = db.execute(
            f"""
            INSERT INTO crew_fitness_measurements
            ({", ".join(columns)})
            VALUES ({placeholders})
            """,
            [measurements[column] for column in columns],
        )

        measurement_id = cursor.lastrowid

    return {
        "id": measurement_id,
        "astronaut_id": payload.astronaut_id,
        "message": "Fitness measurement saved",
    }


@router.get("/measurements/{astronaut_id}")
def list_measurements(
    astronaut_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
):
    with get_connection() as db:
        rows = db.execute(
            """
            SELECT *
            FROM crew_fitness_measurements
            WHERE astronaut_id = ?
            ORDER BY measured_at_utc DESC, id DESC
            LIMIT ?
            """,
            (astronaut_id, limit),
        ).fetchall()

    return [dict(row) for row in rows]



@router.get("/evaluate/{astronaut_id}")
def evaluate_fitness(
    astronaut_id: str,
    mission_type: Literal[
        "ISS_EVA",
        "LUNAR_EVA",
        "MARS_EVA",
    ],
    phase: Literal[
        "pre_mission",
        "in_mission",
    ],
    as_of_utc: datetime | None = None,
    include_synthetic: bool = Query(default=False),
):
    if as_of_utc is not None and as_of_utc.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="as_of_utc must include a timezone",
        )

    snapshot = resolve_measurements(
        astronaut_id=astronaut_id,
        phase=phase,
        as_of_utc=as_of_utc,
        include_synthetic=include_synthetic,
    )

    result = evaluate_requirements(
        mission_type=mission_type,
        phase=phase,
        measurements=snapshot["measurements"],
    )

    result["astronaut_id"] = astronaut_id
    result["as_of_utc"] = snapshot["as_of_utc"]
    result["evidence"] = snapshot["evidence"]
    result["includes_synthetic"] = include_synthetic

    return result
