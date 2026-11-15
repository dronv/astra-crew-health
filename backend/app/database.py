
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "astra.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(
        DB_PATH,
        timeout=10,
        check_same_thread=False
    )

    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout = 10000")
    connection.execute("PRAGMA journal_mode = WAL")

    return connection


def init_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS crew_daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                astronaut_id TEXT NOT NULL,
                log_date TEXT NOT NULL,
                mission_day INTEGER,
                sleep_hours REAL NOT NULL,
                sleep_quality TEXT NOT NULL,
                exercise_hours REAL NOT NULL,
                exercise_type TEXT NOT NULL,
                fatigue_level INTEGER NOT NULL,
                workload TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(astronaut_id, log_date)
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_crew_logs_astronaut_date
            ON crew_daily_logs(astronaut_id, log_date)
        """)

        connection.execute("""
        CREATE TABLE IF NOT EXISTS crew_fitness_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_id TEXT NOT NULL,
            mission_id INTEGER,
            measured_at_utc TEXT NOT NULL,
            assessment_phase TEXT NOT NULL,
            vo2max REAL,
            premission_vo2max REAL,
            deadlift_kg REAL,
            bench_press_kg REAL,
            bodyweight_kg REAL,
            muscle_strength REAL,
            premission_muscle_strength REAL,
            is_synthetic INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at_utc TEXT NOT NULL
        )
    """)

        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS crew_health_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                astronaut_id TEXT NOT NULL,
                mission_id TEXT,
                measured_at_utc TEXT NOT NULL,
                assessment_phase TEXT NOT NULL
                    CHECK (assessment_phase IN (
                        'pre_mission', 'in_mission'
                    )),
                metric TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'manual',
                is_synthetic INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at_utc TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS
                idx_health_observations_lookup
            ON crew_health_observations (
                astronaut_id,
                metric,
                measured_at_utc DESC
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS crew_telemetry_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                astronaut_id TEXT NOT NULL,
                mission_id TEXT,
                measured_at_utc TEXT NOT NULL,
                metric TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'telemetry',
                is_synthetic INTEGER NOT NULL DEFAULT 1,
                created_at_utc TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS
                idx_telemetry_observations_lookup
            ON crew_telemetry_observations (
                astronaut_id,
                metric,
                measured_at_utc DESC
            )
        """)


        connection.execute("""
            CREATE TABLE IF NOT EXISTS crew_questionnaire_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                astronaut_id TEXT NOT NULL,
                mission_id INTEGER,
                assessment_phase TEXT NOT NULL
                    CHECK (assessment_phase IN (
                        'pre_mission', 'in_mission'
                    )),
                measured_at_utc TEXT NOT NULL,
                activity TEXT NOT NULL,
                symptoms TEXT NOT NULL,
                sleep TEXT NOT NULL,
                stress TEXT NOT NULL,
                is_synthetic INTEGER NOT NULL DEFAULT 0,
                created_at_utc TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS
                idx_questionnaire_astronaut_date
            ON crew_questionnaire_responses (
                astronaut_id,
                measured_at_utc DESC
            )
        """)


