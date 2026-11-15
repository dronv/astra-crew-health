
from datetime import datetime, timezone, timedelta

from app.database import get_connection

FITNESS_METRICS = [
    "vo2max",
    "premission_vo2max",
    "deadlift_kg",
    "bench_press_kg",
    "bodyweight_kg",
    "muscle_strength",
    "premission_muscle_strength",
]

BASELINE_METRICS = {
    "premission_vo2max",
    "premission_muscle_strength",
}

FRESHNESS_DAYS = {
    "vo2max": 90,
    "premission_vo2max": 365,
    "deadlift_kg": 90,
    "bench_press_kg": 90,
    "bodyweight_kg": 30,
    "muscle_strength": 90,
    "premission_muscle_strength": 365,
}


def utc_datetime(value):
    if value is None:
        return datetime.now(timezone.utc)

    if isinstance(value, str):
        value = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

    if value.tzinfo is None:
        raise ValueError(
            "Datetime must include timezone information"
        )

    return value.astimezone(timezone.utc)


def resolve_measurements(
    astronaut_id,
    phase="in_mission",
    as_of_utc=None,
    include_synthetic=False,
    mission_id=None,
):
    cutoff = utc_datetime(as_of_utc)

    measurements = {}
    evidence = {}

    with get_connection() as db:
        sql = """
            SELECT *
            FROM crew_fitness_measurements
            WHERE astronaut_id = ?
              AND measured_at_utc <= ?
              AND (? = 1 OR is_synthetic = 0)
        """

        params = [
            astronaut_id,
            cutoff.isoformat(),
            int(include_synthetic),
        ]

        if mission_id is not None:
            sql += " AND (mission_id = ? OR mission_id IS NULL)"
            params.append(mission_id)

        sql += """
            ORDER BY measured_at_utc DESC, id DESC
        """

        fitness_rows = db.execute(
            sql, params
        ).fetchall()

        telemetry_rows = db.execute(
            """
            SELECT *
            FROM crew_telemetry_observations
            WHERE astronaut_id = ?
              AND metric = 'vo2max'
              AND measured_at_utc <= ?
              AND (? = 1 OR is_synthetic = 0)
            ORDER BY measured_at_utc DESC, id DESC
            """,
            (
                astronaut_id,
                cutoff.isoformat(),
                int(include_synthetic),
            ),
        ).fetchall()

    candidates = []

    for row in fitness_rows:
        row_phase = row["assessment_phase"]

        for metric in FITNESS_METRICS:
            value = row[metric]

            if value is None:
                continue

            if metric in BASELINE_METRICS:
                if row_phase != "pre_mission":
                    continue
            elif row_phase != phase:
                continue

            candidates.append({
                "metric": metric,
                "value": value,
                "measured_at_utc": row["measured_at_utc"],
                "source": "fitness_assessment",
                "is_synthetic": bool(row["is_synthetic"]),
                "record_id": row["id"],
            })

    # Only use telemetry VO2max when the telemetry
    # producer explicitly supplies this metric.
    if phase == "in_mission":
        for row in telemetry_rows:
            candidates.append({
                "metric": "vo2max",
                "value": row["value"],
                "measured_at_utc": row["measured_at_utc"],
                "source": row["source"],
                "is_synthetic": bool(row["is_synthetic"]),
                "record_id": row["id"],
            })

    # Select the latest eligible observation.
    candidates.sort(
        key=lambda row: row["measured_at_utc"],
        reverse=True,
    )

    for candidate in candidates:
        metric = candidate["metric"]

        if metric in measurements:
            continue

        measured_at = utc_datetime(
            candidate["measured_at_utc"]
        )

        age = cutoff - measured_at

        if age < timedelta(0):
            continue

        max_age = timedelta(
            days=FRESHNESS_DAYS.get(metric, 30)
        )

        if age > max_age:
            continue

        measurements[metric] = candidate["value"]

        evidence[metric] = {
            "record_id": candidate["record_id"],
            "measured_at_utc": candidate["measured_at_utc"],
            "source": candidate["source"],
            "is_synthetic": candidate["is_synthetic"],
            "age_hours": round(
                age.total_seconds() / 3600,
                2,
            ),
        }

    return {
        "astronaut_id": astronaut_id,
        "phase": phase,
        "as_of_utc": cutoff.isoformat(),
        "measurements": measurements,
        "evidence": evidence,
    }
