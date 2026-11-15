
import sqlite3
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from app.mission import get_active_mission, mission_clock
from app.database import get_connection

router = APIRouter(
    prefix="/api/crew",
    tags=["Crew Daily Health"]
)


class DailyLog(BaseModel):
    astronaut_id: str = Field(min_length=1, max_length=100)
    log_date: date
    mission_day: int | None = Field(default=None, ge=0)

    sleep_hours: float = Field(ge=0, le=24)
    sleep_quality: Literal[
        "excellent", "good", "fair", "poor"
    ]

    exercise_hours: float = Field(ge=0, le=24)
    exercise_type: Literal[
        "aerobic", "resistance", "mixed", "none"
    ]

    fatigue_level: int = Field(ge=1, le=5)
    workload: Literal["low", "moderate", "high"]

    notes: str | None = Field(default=None, max_length=2000)


def fetch_logs(astronaut_id, start_date=None, end_date=None):
    query = """
        SELECT *
        FROM crew_daily_logs
        WHERE astronaut_id = ?
    """

    params = [astronaut_id]

    if start_date:
        query += " AND log_date >= ?"
        params.append(start_date.isoformat())

    if end_date:
        query += " AND log_date <= ?"
        params.append(end_date.isoformat())

    query += " ORDER BY log_date DESC"

    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    return [dict(row) for row in rows]



@router.post("/daily-log")
def save_daily_log(log: DailyLog):
    if log.exercise_type == "none" and log.exercise_hours != 0:
        raise HTTPException(
            status_code=422,
            detail="Exercise hours must be zero when exercise type is none."
        )

    if log.exercise_type != "none" and log.exercise_hours == 0:
        raise HTTPException(
            status_code=422,
            detail="Select none when no exercise was completed."
        )

    values = log.model_dump(mode="json")
    mission = get_active_mission()

    if mission:
        # Use the end of the selected UTC date for a
        # consistent calendar-date-based demo assignment.
        selected_date = datetime.combine(
            log.log_date,
            datetime.min.time(),
            tzinfo=timezone.utc
        )

        clock = mission_clock(mission, now=selected_date)

        values["mission_day"] = (
            clock["day_number"] if clock["started"] else None
        )

    with get_connection() as db:
        existing = db.execute("""
            SELECT id
            FROM crew_daily_logs
            WHERE astronaut_id = ? AND log_date = ?
        """, (
            values["astronaut_id"],
            values["log_date"]
        )).fetchone()

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
            """, (
                values["mission_day"],
                values["sleep_hours"],
                values["sleep_quality"],
                values["exercise_hours"],
                values["exercise_type"],
                values["fatigue_level"],
                values["workload"],
                values["notes"],
                existing["id"]
            ))

            record_id = existing["id"]

        else:
            cursor = db.execute("""
                INSERT INTO crew_daily_logs (
                    astronaut_id, log_date, mission_day,
                    sleep_hours, sleep_quality,
                    exercise_hours, exercise_type,
                    fatigue_level, workload, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                values["notes"]
            ))

            record_id = cursor.lastrowid

    return {
        "success": True,
        "id": record_id,
        "message": "Daily crew health log saved",
        "astronaut_id": log.astronaut_id,
        "log_date": log.log_date.isoformat()
    }


@router.get("/daily-log/{astronaut_id}")
def get_daily_logs(
    astronaut_id: str,
    limit: int = Query(default=30, ge=1, le=365)
):
    logs = fetch_logs(astronaut_id)

    return {
        "astronaut_id": astronaut_id,
        "count": min(len(logs), limit),
        "logs": logs[:limit]
    }



@router.get("/trends/{astronaut_id}")
def get_crew_trends(
    astronaut_id: str,
    days: int = Query(default=7, ge=1, le=90),
    end_date: date | None = None
):
    end = end_date or datetime.now(timezone.utc).date()
    start = end - timedelta(days=days - 1)

    logs = fetch_logs(
        astronaut_id,
        start_date=start,
        end_date=end
    )

    # One row per UTC calendar date.
    by_date = {log["log_date"]: log for log in logs}

    daily = []
    missing_dates = []

    for offset in range(days):
        current_date = start + timedelta(days=offset)
        key = current_date.isoformat()
        log = by_date.get(key)

        if not log:
            missing_dates.append(key)

        daily.append({
            "date": key,
            "recorded": log is not None,
            "mission_day": log["mission_day"] if log else None,
            "sleep_hours": log["sleep_hours"] if log else None,
            "exercise_hours": log["exercise_hours"] if log else None,
            "fatigue_level": log["fatigue_level"] if log else None,
            "sleep_quality": log["sleep_quality"] if log else None,
            "workload": log["workload"] if log else None,
        })

    count = len(logs)

    def average(field):
        if not count:
            return None
        return round(
            sum(row[field] for row in logs) / count, 2
        )

    return {
        "astronaut_id": astronaut_id,
        "days": days,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "records_found": count,
        "missing_days": len(missing_dates),
        "missing_dates": missing_dates,
        "coverage_percent": round(count / days * 100, 1),
        "average_sleep_hours": average("sleep_hours"),
        "average_exercise_hours": average("exercise_hours"),
        "average_fatigue": average("fatigue_level"),
        "exercise_total_hours": round(
            sum(row["exercise_hours"] for row in logs), 2
        ),
        "daily": daily,
        "logs": sorted(
            logs,
            key=lambda item: item["log_date"]
        )
    }

