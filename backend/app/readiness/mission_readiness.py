
from datetime import date, datetime, time, timezone, timedelta

from fastapi import APIRouter, Query

from app.database import get_connection
from app.crew.daily_logs import fetch_logs
from app.mission import get_active_mission, mission_clock
from app.readiness.fitness_api import evaluate_fitness


router = APIRouter(
    prefix="/api/readiness",
    tags=["Mission Readiness"],
)


def get_mission_phase(day_number, planned_days):
    if day_number == 0:
        return {
            "name": "PRE-LAUNCH",
            "focus": "Mission preparation",
            "actions": [
                "Confirm mission-specific health and fitness requirements.",
                "Review baseline physiological measurements.",
                "Complete crew readiness checks with the medical team.",
            ],
        }

    if day_number <= 7:
        return {
            "name": "INITIAL ADAPTATION",
            "focus": "Establish personal baselines",
            "actions": [
                "Record sleep, fatigue, exercise, and workload daily.",
                "Review changes in physiological telemetry.",
                "Follow the mission-approved adaptation and exercise plan.",
            ],
        }

    if planned_days - day_number <= 14:
        return {
            "name": "MISSION TRANSITION",
            "focus": "Prepare for upcoming mission transitions",
            "actions": [
                "Review accumulated fatigue and exercise history.",
                "Confirm required medical and operational assessments.",
                "Coordinate transition activities with mission control.",
            ],
        }

    if day_number <= 30:
        return {
            "name": "ADAPTATION REVIEW",
            "focus": "Review early mission trends",
            "actions": [
                "Compare recent health logs with established baselines.",
                "Review exercise consistency and reported fatigue.",
                "Discuss persistent changes with the crew medical team.",
            ],
        }

    return {
        "name": "SUSTAINED OPERATIONS",
        "focus": "Maintain long-term mission health",
        "actions": [
            "Continue mission-approved exercise and monitoring.",
            "Review multi-week sleep and fatigue trends.",
            "Complete scheduled mission-specific readiness assessments.",
        ],
    }


def analyze_health_logs(logs, expected_days):
    count = len(logs)

    if count == 0:
        return {
            "status": "INSUFFICIENT_DATA",
            "coverage": 0,
            "records_found": 0,
            "observations": [],
            "actions": [
                "Complete daily health logs to establish a trend."
            ],
        }

    ordered = sorted(logs, key=lambda row: row["log_date"])

    avg_sleep = sum(row["sleep_hours"] for row in logs) / count
    avg_fatigue = sum(row["fatigue_level"] for row in logs) / count
    avg_exercise = sum(row["exercise_hours"] for row in logs) / count

    observations = []
    actions = []
    needs_review = False

    # Prototype review indicators, not NASA clearance thresholds.
    if avg_sleep < 6:
        needs_review = True
        observations.append(
            "Average reported sleep is below the prototype "
            "6-hour review indicator."
        )
        actions.append(
            "Review sleep opportunity, workload, and schedule."
        )

    if avg_fatigue >= 4:
        needs_review = True
        observations.append(
            "Average self-reported fatigue is elevated."
        )
        actions.append(
            "Review fatigue before demanding mission activities."
        )

    if count >= 2:
        first = ordered[0]
        last = ordered[-1]

        if last["sleep_hours"] < first["sleep_hours"] - 2:
            needs_review = True
            observations.append(
                "Reported sleep decreased by more than two hours "
                "across the recorded period."
            )

        if last["fatigue_level"] > first["fatigue_level"]:
            observations.append(
                "Self-reported fatigue increased across the period."
            )

    coverage = round(
        min(count / max(expected_days, 1) * 100, 100),
        1,
    )

    if coverage < 70:
        observations.append(
            "Daily log coverage is limited for this period."
        )

    if not observations:
        observations.append(
            "No prototype review indicators were triggered "
            "by the available daily logs."
        )

    if not actions:
        actions.append(
            "Continue daily monitoring and follow the "
            "mission-approved health plan."
        )

    return {
        "status": (
            "REVIEW_RECOMMENDED"
            if needs_review
            else "INSUFFICIENT_DATA"
            if coverage < 70
            else "NO_FLAGS_DETECTED"
        ),
        "coverage": coverage,
        "records_found": count,
        "average_sleep_hours": round(avg_sleep, 2),
        "average_exercise_hours": round(avg_exercise, 2),
        "average_fatigue": round(avg_fatigue, 2),
        "observations": observations,
        "actions": actions,
    }



def get_latest_questionnaire(
    astronaut_id,
    evaluation_time,
    phase,
    include_synthetic,
):
    with get_connection() as db:
        row = db.execute(
            """
            SELECT *
            FROM crew_questionnaire_responses
            WHERE astronaut_id = ?
              AND (? IS NULL OR assessment_phase = ?)
              AND (? = 1 OR is_synthetic = 0)
              AND julianday(measured_at_utc) <= julianday(?)
            ORDER BY julianday(measured_at_utc) DESC, id DESC
            LIMIT 1
            """,
            (
                astronaut_id,
                phase,
                phase,
                int(include_synthetic),
                evaluation_time.isoformat(),
            ),
        ).fetchone()

    return dict(row) if row else None


def analyze_questionnaire(questionnaire):
    if questionnaire is None:
        return {
            "status": "NOT_ASSESSED",
            "record": None,
            "observations": [],
            "actions": [
                "Complete an astronaut self-assessment "
                "for the selected mission phase."
            ],
        }

    observations = []
    actions = []
    status = "NO_FLAGS_DETECTED"

    symptoms = questionnaire["symptoms"]
    sleep = questionnaire["sleep"]
    stress = questionnaire["stress"]
    activity = questionnaire["activity"]

    concerning_symptoms = {
        "Dizziness",
        "Breathing discomfort",
        "Other discomfort",
    }

    if symptoms in concerning_symptoms:
        status = "MEDICAL_REVIEW_RECOMMENDED"
        observations.append(
            f"Astronaut reported: {symptoms}."
        )
        actions.append(
            "Report symptoms through the designated "
            "crew medical support process."
        )

    elif symptoms == "Unusual fatigue":
        status = "REVIEW_RECOMMENDED"
        observations.append(
            "Astronaut reported unusual fatigue."
        )
        actions.append(
            "Review fatigue, rest, and recent workload."
        )

    if sleep in {"Poor", "Very poor"}:
        if status == "NO_FLAGS_DETECTED":
            status = "REVIEW_RECOMMENDED"

        observations.append(
            f"Astronaut reported {sleep.lower()} sleep."
        )
        actions.append(
            "Review sleep quality and recovery."
        )

    if stress in {"High", "Very high"}:
        if status == "NO_FLAGS_DETECTED":
            status = "REVIEW_RECOMMENDED"

        observations.append(
            f"Astronaut reported {stress.lower()} workload."
        )
        actions.append(
            "Review workload and fatigue management."
        )

    if activity in {"Exercise", "High-intensity workload"}:
        observations.append(
            f"Recent activity: {activity}."
        )

    if not observations:
        observations.append(
            "No questionnaire review indicators were triggered."
        )

    if not actions:
        actions.append(
            "Continue routine monitoring and scheduled assessments."
        )

    return {
        "status": status,
        "record": questionnaire,
        "observations": observations,
        "actions": actions,
    }


@router.get("/{astronaut_id}")
def get_readiness(
    astronaut_id: str,
    end_date: date | None = None,
    days: int = Query(default=7, ge=1, le=90),
    mission_type: str = Query(default="MARS_EVA"),
    include_synthetic: bool = Query(default=True),
):
    if end_date:
        evaluation_time = datetime.combine(
            end_date,
            time.max,
            tzinfo=timezone.utc,
        )
    else:
        evaluation_time = datetime.now(timezone.utc)

    evaluation_date = evaluation_time.date()
    start_date = evaluation_date - timedelta(days=days - 1)

    active_mission = get_active_mission()

    mission = (
        active_mission
        if active_mission
        and active_mission["astronaut_id"] == astronaut_id
        else None
    )

    clock = None
    mission_phase = None
    phase = "in_mission"
    selected_mission_type = mission_type

    if mission:
        clock = mission_clock(mission, now=evaluation_time)

        mission_phase = get_mission_phase(
            clock["day_number"],
            mission["planned_days"],
        )

        phase = (
            "pre_mission"
            if clock["day_number"] == 0
            else "in_mission"
        )

        selected_mission_type = mission["mission_type"]

        mission_start = datetime.fromisoformat(
            mission["start_utc"].replace("Z", "+00:00")
        ).date()

        if mission_start > start_date:
            start_date = mission_start

    else:
        # Assessment-only mode when no matching active mission exists.
        # The latest questionnaire determines the displayed phase.
        with get_connection() as db:
            latest = db.execute(
                """
                SELECT assessment_phase
                FROM crew_questionnaire_responses
                WHERE astronaut_id = ?
                  AND (? = 1 OR is_synthetic = 0)
                  AND julianday(measured_at_utc) <= julianday(?)
                ORDER BY julianday(measured_at_utc) DESC, id DESC
                LIMIT 1
                """,
                (
                    astronaut_id,
                    int(include_synthetic),
                    evaluation_time.isoformat(),
                ),
            ).fetchone()

        if latest:
            phase = latest["assessment_phase"]

        mission_phase = {
            "name": "ASSESSMENT ONLY",
            "focus": "Crew health and fitness review",
            "actions": [
                "Review saved health and fitness assessments.",
                "Confirm the appropriate mission type and phase.",
                "Complete mission configuration when available.",
            ],
        }

    logs = []

    if start_date <= evaluation_date:
        logs = fetch_logs(
            astronaut_id,
            start_date=start_date,
            end_date=evaluation_date,
        )

    expected_days = (
        (evaluation_date - start_date).days + 1
        if start_date <= evaluation_date
        else 0
    )

    if expected_days:
        health_review = analyze_health_logs(
            logs,
            expected_days,
        )
    else:
        health_review = analyze_health_logs([], 0)

    
    # Latest questionnaire for the selected mission phase.
    phase_questionnaire = get_latest_questionnaire(
        astronaut_id,
        evaluation_time,
        phase,
        include_synthetic,
    )

    # Latest questionnaire across all mission phases.
    latest_questionnaire = get_latest_questionnaire(
        astronaut_id,
        evaluation_time,
        None,
        include_synthetic,
    )

    questionnaire_review = analyze_questionnaire(
        phase_questionnaire
    )

    latest_questionnaire_review = analyze_questionnaire(
        latest_questionnaire
    )


    fitness = evaluate_fitness(
        astronaut_id=astronaut_id,
        mission_type=selected_mission_type,
        phase=phase,
        as_of_utc=evaluation_time,
        include_synthetic=include_synthetic,
    )

    health_status = health_review["status"]
    questionnaire_status = questionnaire_review["status"]
    fitness_status = fitness.get("overall_status", "INCOMPLETE")

    review_needed = (
        health_status == "REVIEW_RECOMMENDED"
        or questionnaire_status in {
            "REVIEW_RECOMMENDED",
            "MEDICAL_REVIEW_RECOMMENDED",
        }
        or fitness.get("counts", {}).get("NOT_MET", 0) > 0
    )

    return {
        "astronaut_id": astronaut_id,
        "mission": clock,
        "evaluation_date": evaluation_date.isoformat(),
        "period_days": days,
        "assessment_phase": phase,
        "mission_type": selected_mission_type,
        "mission_phase": mission_phase,
        "health_review": health_review,
        "questionnaire_review": questionnaire_review,
        "latest_questionnaire_review": latest_questionnaire_review,
        "latest_questionnaire_phase": (
            latest_questionnaire["assessment_phase"]
            if latest_questionnaire else None
        ),
        "fitness_readiness": fitness,
        "fitness_status": fitness_status,
        "overall_status": (
            "REVIEW_RECOMMENDED"
            if review_needed
            else "NOT_CLEARED"
        ),
        "overall_message": (
            "ASTRA provides prototype decision support only. "
            "Questionnaire findings, health logs, and fitness "
            "evaluations do not establish medical or EVA flight clearance."
        ),
    }
