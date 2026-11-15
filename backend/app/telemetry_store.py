
from datetime import datetime, timezone
import math
import sqlite3

from app.database import get_connection

TELEMETRY_UNITS = {
    "heart_rate": "bpm",
    "respiration_rate": "breaths/min",
    "temperature": "degC",
    "oxygen_saturation": "%",
    "activity": "simulated_activity_index",
}

def save_telemetry_snapshot(
    astronaut_id: str,
    telemetry: dict,
    mission_id: str | None = None,
):
    """
    Persist a snapshot from ASTRA's simulated
    physiological telemetry generator.

    This function must not be called for every
    WebSocket message.
    """

    timestamp = telemetry.get("timestamp")

    if timestamp is None:
        measured_at = datetime.now(timezone.utc)
    else:
        measured_at = datetime.fromtimestamp(
            float(timestamp),
            tz=timezone.utc,
        )

    measured_at_utc = measured_at.isoformat()

    rows = []

    for metric, unit in TELEMETRY_UNITS.items():
        value = telemetry.get(metric)

        if value is None:
            continue

        if isinstance(value, bool):
            continue

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue

        if not math.isfinite(numeric_value):
            continue

        rows.append((
            astronaut_id,
            mission_id,
            measured_at_utc,
            metric,
            numeric_value,
            unit,
            "astra_simulator",
            1,
        ))

    if not rows:
        return 0

    with get_connection() as db:
        db.executemany("""
            INSERT INTO crew_telemetry_observations (
                astronaut_id,
                mission_id,
                measured_at_utc,
                metric,
                value,
                unit,
                source,
                is_synthetic
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)

    return len(rows)


def get_latest_telemetry(
    astronaut_id: str,
    include_synthetic: bool = True,
):
    with get_connection() as db:
        rows = db.execute("""
            SELECT *
            FROM crew_telemetry_observations
            WHERE astronaut_id = ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
        """, (
            astronaut_id,
            int(include_synthetic),
        )).fetchall()

    latest = {}

    for row in rows:
        metric = row["metric"]

        if metric not in latest:
            latest[metric] = dict(row)

    return {
        "astronaut_id": astronaut_id,
        "metrics": latest,
    }
