from datetime import date, datetime, timezone, timedelta
from typing import Literal
import math
import sqlite3

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from app.database import get_connection
from app.crew.daily_logs import DailyLog
from app.mission import get_active_mission, mission_clock
from app.readiness.fitness_api import (
    FitnessMeasurement,
    evaluate_fitness,
)

router = APIRouter(
    prefix="/api/assessment",
    tags=["Astronaut Self-Assessment"],
)

Phase = Literal["pre_mission", "in_mission"]
MissionType = Literal["ISS_EVA", "LUNAR_EVA", "MARS_EVA"]

# These are additional manual health indicators.
# Daily-log and fitness metrics use their existing tables.
HEALTH_METRICS = {
    "systolic_bp": ("mmHg", 50, 250),
    "diastolic_bp": ("mmHg", 30, 150),
    "blood_glucose_mg_dl": ("mg/dL", 20, 600),
    "stress": ("score_1_to_5", 1, 5),
    "mood": ("score_1_to_5", 1, 5),
}

FITNESS_COLUMNS = [
    "astronaut_id",
    "mission_id",
    "measured_at_utc",
    "assessment_phase",
    "vo2max",
    "premission_vo2max",
    "deadlift_kg",
    "bench_press_kg",
    "bodyweight_kg",
    "muscle_strength",
    "premission_muscle_strength",
    "is_synthetic",
    "notes",
    "created_at_utc",
]

FITNESS_VALUE_FIELDS = [
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


def normalize_timestamp(value):
    if value is None:
        value = utc_now()

    if value.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="Measurement timestamp must include a timezone",
        )

    return value.astimezone(timezone.utc).isoformat(
        timespec="microseconds"
    )


class HealthObservation(BaseModel):
    metric: Literal[
        "systolic_bp",
        "diastolic_bp",
        "blood_glucose_mg_dl",
        "stress",
        "mood",
    ]
    value: float
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_value(self):
        _, minimum, maximum = HEALTH_METRICS[self.metric]

        if (
            not math.isfinite(self.value)
            or not minimum <= self.value <= maximum
        ):
            raise ValueError(
                f"{self.metric} must be between "
                f"{minimum} and {maximum}"
            )

        if self.metric in {"stress", "mood"}:
            if not self.value.is_integer():
                raise ValueError(
                    f"{self.metric} must be a whole number"
                )

        return self

class QuestionnaireAnswers(BaseModel):
    activity: Literal[
        "Resting",
        "Light activity",
        "Exercise",
        "High-intensity workload",
    ]

    symptoms: Literal[
        "No symptoms",
        "Unusual fatigue",
        "Dizziness",
        "Breathing discomfort",
        "Other discomfort",
    ]

    sleep: Literal[
        "Good",
        "Fair",
        "Poor",
        "Very poor",
    ]

    stress: Literal[
        "Low",
        "Moderate",
        "High",
        "Very high",
    ]

class AssessmentSubmission(BaseModel):
    astronaut_id: str = Field(min_length=1, max_length=100)
    mission_id: int | None = None
    mission_type: MissionType = "MARS_EVA"
    assessment_phase: Phase = "in_mission"
    measured_at_utc: datetime | None = None
    is_synthetic: bool = False

    daily_log: DailyLog | None = None
    fitness: FitnessMeasurement | None = None
    health_observations: list[HealthObservation] = Field(
        default_factory=list,
        max_length=20,
    )
    questionnaire: QuestionnaireAnswers | None = None

    @model_validator(mode="after")
    def validate_submission(self):
        if (
            self.daily_log is None
            and self.fitness is None
            and not self.health_observations
            and self.questionnaire is None
        ):
            raise ValueError(
                "Provide questionnaire answers or at least one measurement"
            )

        if self.daily_log is not None:
            if self.daily_log.astronaut_id != self.astronaut_id:
                raise ValueError(
                    "Daily log astronaut_id does not match"
                )

            if (
                self.daily_log.exercise_type == "none"
                and self.daily_log.exercise_hours != 0
            ):
                raise ValueError(
                    "Exercise hours must be zero when "
                    "exercise type is none"
                )

            if (
                self.daily_log.exercise_type != "none"
                and self.daily_log.exercise_hours == 0
            ):
                raise ValueError(
                    "Select none when exercise hours are zero"
                )

        if self.fitness is not None:
            if self.fitness.astronaut_id != self.astronaut_id:
                raise ValueError(
                    "Fitness astronaut_id does not match"
                )

            if self.fitness.assessment_phase != self.assessment_phase:
                raise ValueError(
                    "Fitness assessment phase does not match"
                )

            if self.fitness.mission_id != self.mission_id:
                raise ValueError(
                    "Fitness mission_id does not match"
                )

            if self.fitness.is_synthetic != self.is_synthetic:
                raise ValueError(
                    "Fitness synthetic flag does not match"
                )

            if self.fitness.measured_at_utc is not None:
                if self.measured_at_utc is None:
                    raise ValueError(
                        "Set the timestamp at the assessment level"
                    )
                if (
                    self.fitness.measured_at_utc
                    != self.measured_at_utc
                ):
                    raise ValueError(
                        "Fitness timestamp does not match"
                    )

            if not any(
                getattr(self.fitness, field) is not None
                for field in FITNESS_VALUE_FIELDS
            ):
                raise ValueError(
                    "Fitness assessment has no measurements"
                )

            if self.assessment_phase != "pre_mission":
                if any(
                    getattr(self.fitness, field) is not None
                    for field in BASELINE_FIELDS
                ):
                    raise ValueError(
                        "Premission baselines must be recorded "
                        "during pre_mission"
                    )

        return self


def save_daily_log_in_transaction(db, log):
    values = log.model_dump(mode="json")
    values.setdefault("mission_day", None)
    mission = get_active_mission()

    if mission:
        selected_date = datetime.combine(
            log.log_date,
            datetime.min.time(),
            tzinfo=timezone.utc,
        )

        clock = mission_clock(mission, now=selected_date)

        values["mission_day"] = (
            clock["day_number"] if clock["started"] else None
        )

    db.execute("""
        INSERT INTO crew_daily_logs (
            astronaut_id, log_date, mission_day,
            sleep_hours, sleep_quality,
            exercise_hours, exercise_type,
            fatigue_level, workload, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(astronaut_id, log_date)
        DO UPDATE SET
            mission_day = excluded.mission_day,
            sleep_hours = excluded.sleep_hours,
            sleep_quality = excluded.sleep_quality,
            exercise_hours = excluded.exercise_hours,
            exercise_type = excluded.exercise_type,
            fatigue_level = excluded.fatigue_level,
            workload = excluded.workload,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
    """, (
        values["astronaut_id"],
        values["log_date"],
        values["mission_day"],
        values["sleep_hours"],
        values["sleep_quality"],
        values["exercise_hours"],
        values["exercise_type"],
        values["fatigue_level"],
        values["workload"],
        values["notes"],
    ))


def save_fitness_in_transaction(
    db, fitness, measured_at_utc
):
    values = fitness.model_dump()

    values["measured_at_utc"] = measured_at_utc
    values["created_at_utc"] = normalize_timestamp(utc_now())
    values["is_synthetic"] = int(fitness.is_synthetic)

    placeholders = ", ".join(
        "?" for _ in FITNESS_COLUMNS
    )

    cursor = db.execute(
        f"""
        INSERT INTO crew_fitness_measurements (
            {", ".join(FITNESS_COLUMNS)}
        )
        VALUES ({placeholders})
        """,
        [values[column] for column in FITNESS_COLUMNS],
    )

    return cursor.lastrowid


def save_health_in_transaction(
    db, payload, measured_at_utc
):
    count = 0

    for observation in payload.health_observations:
        unit, _, _ = HEALTH_METRICS[observation.metric]

        db.execute("""
            INSERT INTO crew_health_observations (
                astronaut_id,
                mission_id,
                measured_at_utc,
                assessment_phase,
                metric,
                value,
                unit,
                source,
                is_synthetic,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            payload.astronaut_id,
            (
                str(payload.mission_id)
                if payload.mission_id is not None
                else None
            ),
            measured_at_utc,
            payload.assessment_phase,
            observation.metric,
            observation.value,
            unit,
            "manual_assessment",
            int(payload.is_synthetic),
            observation.notes,
        ))

        count += 1

    return count


def save_questionnaire_in_transaction(
    db, payload, measured_at_utc
):
    if payload.questionnaire is None:
        return None

    answers = payload.questionnaire

    cursor = db.execute("""
        INSERT INTO crew_questionnaire_responses (
            astronaut_id,
            mission_id,
            assessment_phase,
            measured_at_utc,
            activity,
            symptoms,
            sleep,
            stress,
            is_synthetic
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payload.astronaut_id,
        payload.mission_id,
        payload.assessment_phase,
        measured_at_utc,
        answers.activity,
        answers.symptoms,
        answers.sleep,
        answers.stress,
        int(payload.is_synthetic),
    ))

    return cursor.lastrowid


@router.post("", status_code=201)
def save_assessment(payload: AssessmentSubmission):
    measured_at = payload.measured_at_utc or utc_now()

    if measured_at.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="measured_at_utc must include a timezone",
        )

    if measured_at > utc_now() + timedelta(minutes=5):
        raise HTTPException(
            status_code=422,
            detail="Assessment timestamp is too far in the future",
        )

    measured_at_utc = normalize_timestamp(measured_at)

    fitness_id = None
    health_count = 0
    questionnaire_id = None

    try:
        # All writes use the same SQLite connection.
        # If any write fails, the transaction rolls back.
        with get_connection() as db:
            if payload.daily_log is not None:
                save_daily_log_in_transaction(
                    db, payload.daily_log
                )

            if payload.fitness is not None:
                fitness_id = save_fitness_in_transaction(
                    db,
                    payload.fitness,
                    measured_at_utc,
                )

            if payload.health_observations:
                health_count = save_health_in_transaction(
                    db,
                    payload,
                    measured_at_utc,
                )

            if payload.questionnaire is not None:
                questionnaire_id = save_questionnaire_in_transaction(
                    db,
                    payload,
                    measured_at_utc,
                )

    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to save assessment",
        ) from exc

    # Evaluation occurs after the transaction commits.
    readiness = evaluate_fitness(
        astronaut_id=payload.astronaut_id,
        mission_type=payload.mission_type,
        phase=payload.assessment_phase,
        as_of_utc=measured_at,
        include_synthetic=payload.is_synthetic,
    )

    return {
        "success": True,
        "message": "Astronaut self-assessment saved",
        "astronaut_id": payload.astronaut_id,
        "mission_id": payload.mission_id,
        "assessment_phase": payload.assessment_phase,
        "measured_at_utc": measured_at_utc,
        "saved": {
            "daily_log": payload.daily_log is not None,
            "fitness_measurement_id": fitness_id,
            "health_observations": health_count,
            "questionnaire_id": questionnaire_id,
        },
        "fitness_readiness": readiness,
    }


@router.get("/{astronaut_id}/readiness")
def get_assessment_readiness(
    astronaut_id: str,
    mission_type: MissionType = "MARS_EVA",
    phase: Phase = "in_mission",
    as_of_utc: datetime | None = None,
    include_synthetic: bool = Query(default=False),
):
    return evaluate_fitness(
        astronaut_id=astronaut_id,
        mission_type=mission_type,
        phase=phase,
        as_of_utc=as_of_utc,
        include_synthetic=include_synthetic,
    )


@router.get("/{astronaut_id}/latest")
def get_latest_assessment(
    astronaut_id: str,
    include_synthetic: bool = Query(default=False),
):
    with get_connection() as db:
        daily = db.execute("""
            SELECT *
            FROM crew_daily_logs
            WHERE astronaut_id = ?
            ORDER BY log_date DESC
            LIMIT 1
        """, (astronaut_id,)).fetchone()

        fitness = db.execute("""
            SELECT *
            FROM crew_fitness_measurements
            WHERE astronaut_id = ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
            LIMIT 1
        """, (
            astronaut_id,
            int(include_synthetic),
        )).fetchone()

        health_rows = db.execute("""
            SELECT *
            FROM crew_health_observations
            WHERE astronaut_id = ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
        """, (
            astronaut_id,
            int(include_synthetic),
        )).fetchall()

        telemetry_rows = db.execute("""
            SELECT *
            FROM crew_telemetry_observations
            WHERE astronaut_id = ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
        """, (
            astronaut_id,
            int(include_synthetic),
        )).fetchall()


        questionnaire = db.execute("""
            SELECT *
            FROM crew_questionnaire_responses
            WHERE astronaut_id = ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
            LIMIT 1
        """, (
            astronaut_id,
            int(include_synthetic),
        )).fetchone()


    def latest_per_metric(rows):
        result = {}

        for row in rows:
            metric = row["metric"]
            if metric not in result:
                result[metric] = dict(row)

        return result

    return {
        "astronaut_id": astronaut_id,
        "daily_log": dict(daily) if daily else None,
        "fitness": dict(fitness) if fitness else None,
        "health": latest_per_metric(health_rows),
        "telemetry": latest_per_metric(telemetry_rows),
        "questionnaire": dict(questionnaire) if questionnaire else None,
    }
