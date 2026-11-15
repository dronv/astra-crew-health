
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_connection
from app.mission import get_active_mission, mission_clock

router = APIRouter(
    prefix="/api/demo",
    tags=["Demo Simulation"]
)


SCENARIOS = {
    "nominal": {
        "sleep": [7.5, 7.8, 7.2, 7.6, 7.4, 7.7, 7.5],
        "exercise": [1.5, 2.0, 1.75, 2.0, 1.5, 2.0, 1.75],
        "fatigue": [2, 1, 2, 2, 2, 1, 2],
    },
    "sleep_deprivation": {
        "sleep": [7.5, 6.8, 6.0, 5.5, 4.5, 3.5, 2.5],
        "exercise": [2.0, 1.75, 1.5, 1.5, 1.0, 0.5, 0.25],
        "fatigue": [1, 2, 2, 3, 4, 4, 5],
    },
    "exercise_decline": {
        "sleep": [7.5, 7.4, 7.6, 7.2, 7.3, 7.5, 7.4],
        "exercise": [2.0, 1.75, 1.5, 1.0, 0.5, 0.25, 0.0],
        "fatigue": [2, 2, 2, 3, 3, 3, 4],
    }
}


@router.post("/seed/{scenario}")
def seed_demo(
    scenario: str,
    days: int = 7,
    replace: bool = False
):
    if scenario not in SCENARIOS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scenario: {scenario}"
        )

    if not 1 <= days <= 90:
        raise HTTPException(
            status_code=422,
            detail="days must be between 1 and 90"
        )

    mission = get_active_mission()

    if not mission:
        raise HTTPException(
            status_code=400,
            detail="Create a mission first."
        )

    astronaut_id = mission["astronaut_id"]
    data = SCENARIOS[scenario]

    # Seed the most recent days of the mission, ending
    # on the current UTC date.
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=days - 1)

    created = 0
    skipped = 0

    with get_connection() as db:
        for index in range(days):
            log_date = start_date + timedelta(days=index)

            timestamp = datetime.combine(
                log_date,
                datetime.min.time(),
                tzinfo=timezone.utc
            )

            clock = mission_clock(mission, timestamp)

            if not clock["started"]:
                continue

            existing = db.execute("""
                SELECT id FROM crew_daily_logs
                WHERE astronaut_id = ? AND log_date = ?
            """, (
                astronaut_id,
                log_date.isoformat()
            )).fetchone()

            if existing and not replace:
                skipped += 1
                continue

            # Progress through the scenario from beginning to end.
            # For more than seven days, repeat the seven-day pattern.
            pattern_index = index % 7

            sleep = data["sleep"][pattern_index]
            exercise = data["exercise"][pattern_index]
            fatigue = data["fatigue"][pattern_index]

            values = (
                clock["day_number"],
                sleep,
                "poor" if sleep < 5 else "fair" if sleep < 7 else "good",
                exercise,
                "mixed" if exercise > 0 else "none",
                fatigue,
                "high" if fatigue >= 4 else "moderate",
                f"[SYNTHETIC DEMO] Scenario: {scenario}"
            )

            if existing:
                db.execute("""
                    UPDATE crew_daily_logs
                    SET mission_day = ?,
                        sleep_hours = ?,
                        sleep_quality = ?,
                        exercise_hours = ?,
                        exercise_type = ?,
                        fatigue_level = ?,
                        workload = ?,
                        notes = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (*values, existing["id"]))
            else:
                db.execute("""
                    INSERT INTO crew_daily_logs (
                        astronaut_id, log_date, mission_day,
                        sleep_hours, sleep_quality,
                        exercise_hours, exercise_type,
                        fatigue_level, workload, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    astronaut_id,
                    log_date.isoformat(),
                    *values
                ))

            created += 1

    return {
        "success": True,
        "scenario": scenario,
        "astronaut_id": astronaut_id,
        "records_written": created,
        "records_skipped": skipped,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "synthetic": True
    }
