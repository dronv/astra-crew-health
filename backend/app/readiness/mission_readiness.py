
from datetime import date, datetime, time, timezone, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.crew.daily_logs import fetch_logs
from app.mission import get_active_mission, mission_clock

router = APIRouter(
    prefix="/api/readiness",
    tags=["Mission Readiness"]
)


def get_mission_phase(day_number, planned_days):
    if day_number == 0:
        return {
            "name": "PRE-LAUNCH",
            "focus": "Mission preparation",
            "actions": [
                "Confirm mission-specific health and fitness requirements.",
                "Review baseline physiological measurements.",
                "Complete crew readiness checks with the medical team."
            ]
        }

    if day_number <= 7:
        return {
            "name": "INITIAL ADAPTATION",
            "focus": "Establish personal baselines",
            "actions": [
                "Record sleep, fatigue, exercise, and workload daily.",
                "Review changes in physiological telemetry.",
                "Follow the mission-approved adaptation and exercise plan."
            ]
        }

    if planned_days - day_number <= 14:
        return {
            "name": "MISSION TRANSITION",
            "focus": "Prepare for upcoming mission transitions",
            "actions": [
                "Review accumulated fatigue and exercise history.",
                "Confirm required medical and operational assessments.",
                "Coordinate transition activities with mission control."
            ]
        }

    if day_number <= 30:
        return {
            "name": "ADAPTATION REVIEW",
            "focus": "Review early mission trends",
            "actions": [
                "Compare recent health logs with established baselines.",
                "Review exercise consistency and reported fatigue.",
                "Discuss persistent changes with the crew medical team."
            ]
        }

    return {
        "name": "SUSTAINED OPERATIONS",
        "focus": "Maintain long-term mission health",
        "actions": [
            "Continue mission-approved exercise and monitoring.",
            "Review multi-week sleep and fatigue trends.",
            "Complete scheduled mission-specific readiness assessments."
        ]
    }


def analyze_health_logs(logs, expected_days):
    count = len(logs)

    if count == 0:
        return {
            "status": "INSUFFICIENT_DATA",
            "coverage": 0,
            "observations": [],
            "actions": [
                "Complete daily health logs to establish a trend."
            ]
        }

    ordered = sorted(logs, key=lambda row: row["log_date"])

    avg_sleep = sum(
        row["sleep_hours"] for row in logs
    ) / count

    avg_fatigue = sum(
        row["fatigue_level"] for row in logs
    ) / count

    avg_exercise = sum(
        row["exercise_hours"] for row in logs
    ) / count

    observations = []
    actions = []
    needs_review = False

    # These are configurable prototype review indicators,
    # not NASA medical or flight-readiness thresholds.
    if avg_sleep < 6:
        needs_review = True
        observations.append(
            "Average reported sleep duration is below "
            "the prototype's 6-hour review indicator."
        )
        actions.append(
            "Review sleep opportunity, workload, and recent schedule."
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
                "Reported sleep duration decreased by more "
                "than two hours across the recorded period."
            )

        if last["fatigue_level"] > first["fatigue_level"]:
            observations.append(
                "Self-reported fatigue increased across "
                "the recorded period."
            )

    coverage = round(count / expected_days * 100, 1)

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
        "actions": actions
    }


@router.get("/{astronaut_id}")
def get_readiness(
    astronaut_id: str,
    end_date: date | None = None,
    days: int = Query(default=7, ge=1, le=90)
):
    mission = get_active_mission()

    if not mission:
        raise HTTPException(
            status_code=404,
            detail="No active mission configured."
        )

    if mission["astronaut_id"] != astronaut_id:
        raise HTTPException(
            status_code=404,
            detail="Astronaut is not assigned to the active mission."
        )

    # Historical simulation is evaluated at the end
    # of the selected UTC date.
    if end_date:
        evaluation_time = datetime.combine(
            end_date,
            time.max,
            tzinfo=timezone.utc
        )
    else:
        evaluation_time = datetime.now(timezone.utc)

    clock = mission_clock(mission, now=evaluation_time)

    evaluation_date = evaluation_time.date()
    start_date = evaluation_date - timedelta(days=days - 1)

    logs = fetch_logs(
        astronaut_id,
        start_date=start_date,
        end_date=evaluation_date
    )

    # Exclude observations dated before mission launch.
    mission_start = datetime.fromisoformat(
        mission["start_utc"].replace("Z", "+00:00")
    ).date()

    logs = [
        row for row in logs
        if row["log_date"] >= mission_start.isoformat()
    ]

    elapsed_calendar_days = max(
        0,
        (evaluation_date - mission_start).days + 1
    )

    expected_days = min(days, elapsed_calendar_days)

    if expected_days == 0:
        health_review = {
            "status": "INSUFFICIENT_DATA",
            "coverage": 0,
            "records_found": 0,
            "observations": [],
            "actions": [
                "Daily mission health monitoring begins at launch."
            ]
        }
    else:
        health_review = analyze_health_logs(
            logs, expected_days
        )

    phase = get_mission_phase(
        clock["day_number"],
        mission["planned_days"]
    )

    # Required measurements are not available in daily logs.
    # Do not interpret this as a pass or fail.
    fitness = {
        "status": "NOT_ASSESSED",
        "required_measurements": [
            "VO2max",
            "VO2max relative to premission baseline",
            "Mission-applicable strength measurements"
        ],
        "message": (
            "Mission-specific fitness requirements must "
            "be evaluated using measured values."
        )
    }

    return {
        "astronaut_id": astronaut_id,
        "mission": clock,
        "evaluation_date": evaluation_date.isoformat(),
        "period_days": days,
        "mission_phase": phase,
        "health_review": health_review,
        "fitness_readiness": fitness,
        "overall_status": "NOT_CLEARED",
        "overall_message": (
            "ASTRA provides prototype decision support. "
            "Daily health logs do not establish medical "
            "or EVA flight readiness."
        )
    }
