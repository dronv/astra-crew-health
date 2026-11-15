
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_connection

router = APIRouter(
    prefix="/api/mission",
    tags=["Mission Management"]
)

EARTH_DAY_SECONDS = 86400
MARS_SOL_SECONDS = 88775.244


class MissionSetup(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    mission_type: Literal["ISS_EVA", "LUNAR_EVA", "MARS_EVA"]
    start_utc: datetime
    planned_days: int = Field(default=180, ge=1, le=2000)
    astronaut_id: str = Field(default="CREW-001", min_length=1)


def init_mission_table():
    with get_connection() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS missions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mission_type TEXT NOT NULL,
                start_utc TEXT NOT NULL,
                planned_days INTEGER NOT NULL,
                astronaut_id TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def mission_clock(mission, now=None):
    now = now or datetime.now(timezone.utc)

    start = datetime.fromisoformat(
        mission["start_utc"].replace("Z", "+00:00")
    )

    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    start = start.astimezone(timezone.utc)
    now = now.astimezone(timezone.utc)

    elapsed_seconds = (now - start).total_seconds()

    is_mars = mission["mission_type"] == "MARS_EVA"

    day_seconds = (
        MARS_SOL_SECONDS if is_mars else EARTH_DAY_SECONDS
    )

    elapsed_days = max(0, int(elapsed_seconds // day_seconds))
    day_number = elapsed_days + 1 if elapsed_seconds >= 0 else 0

    return {
        "mission_id": mission["id"],
        "mission_name": mission["name"],
        "mission_type": mission["mission_type"],
        "astronaut_id": mission["astronaut_id"],
        "start_utc": start.isoformat(),
        "current_utc": now.isoformat(),
        "day_label": "Sol" if is_mars else "Mission Day",
        "day_number": day_number,
        "elapsed_seconds": max(0, elapsed_seconds),
        "planned_days": mission["planned_days"],
        "remaining_days": max(
            0, mission["planned_days"] - elapsed_days
        ),
        "started": elapsed_seconds >= 0,
    }


def get_active_mission():
    with get_connection() as db:
        row = db.execute("""
            SELECT *
            FROM missions
            WHERE is_active = 1
            ORDER BY id DESC
            LIMIT 1
        """).fetchone()

    return dict(row) if row else None


@router.post("/setup")
def setup_mission(payload: MissionSetup):
    start = payload.start_utc

    if start.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="start_utc must include a timezone offset."
        )

    start = start.astimezone(timezone.utc).isoformat()

    with get_connection() as db:
        db.execute("UPDATE missions SET is_active = 0")

        cursor = db.execute("""
            INSERT INTO missions (
                name, mission_type, start_utc,
                planned_days, astronaut_id, is_active
            )
            VALUES (?, ?, ?, ?, ?, 1)
        """, (
            payload.name,
            payload.mission_type,
            start,
            payload.planned_days,
            payload.astronaut_id
        ))

        mission_id = cursor.lastrowid

    return {
        "success": True,
        "mission_id": mission_id
    }


@router.get("/active")
def active_mission():
    mission = get_active_mission()

    if not mission:
        raise HTTPException(
            status_code=404,
            detail="No active mission configured."
        )

    return mission_clock(mission)


@router.get("/clock")
def get_clock(at_utc: datetime | None = None):

    if at_utc is not None and at_utc.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="at_utc must include a timezone offset."
        )

    mission = get_active_mission()

    if not mission:
        return {
            "active": False,
            "mission_id": None,
            "mission_name": None,
            "mission_type": None,
            "astronaut_id": None,
            "start_utc": None,
            "current_utc": datetime.now(timezone.utc).isoformat(),
            "day_label": "Mission Day",
            "day_number": 0,
            "elapsed_seconds": 0,
            "planned_days": 0,
            "remaining_days": 0,
            "started": False,
            "message": "No active mission configured."
        }

    return {
        "active": True,
        **mission_clock(mission, now=at_utc)
    }