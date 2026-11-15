
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
