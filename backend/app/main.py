
import asyncio
from contextlib import asynccontextmanager
import logging
import os
import time

from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware

from app.research import router as research_router
from app.telemetry_store import (
    save_telemetry_snapshot,
    get_latest_telemetry,
)
from app.database import init_database
from app.crew.daily_logs import router as crew_router
from app.crew.demo import router as demo_router
from app.mission import (
    router as mission_router,
    init_mission_table,
)
from app.readiness.mission_readiness import (
    router as mission_readiness_router,
)
from app.readiness.fitness_api import (
    router as fitness_router,
)
from app.assessment.api import router as assessment_router
from app.awareness.router import router as awareness_router

from .health import HealthMonitor
from .telemetry import AstronautTelemetry


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TELEMETRY_SAVE_INTERVAL = 30
SIMULATED_ASTRONAUT_ID = "CREW-001"

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

astronaut = AstronautTelemetry()
health_monitor = HealthMonitor()


class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()


async def telemetry_loop():
    """
    Generate simulated telemetry every second.

    Broadcast telemetry to connected clients.
    Save a synthetic snapshot every 30 seconds.
    """

    last_saved_at = None

    while True:
        try:
            telemetry = astronaut.generate()
            health = health_monitor.update(telemetry)

            now = time.monotonic()

            should_save = (
                last_saved_at is None
                or now - last_saved_at
                >= TELEMETRY_SAVE_INTERVAL
            )

            if should_save:
                try:
                    saved = await asyncio.to_thread(
                        save_telemetry_snapshot,
                        SIMULATED_ASTRONAUT_ID,
                        telemetry,
                    )

                    if saved > 0:
                        last_saved_at = now

                except Exception:
                    logger.exception(
                        "Unable to persist telemetry snapshot"
                    )

            if manager.active_connections:
                await manager.broadcast({
                    "telemetry": telemetry,
                    "health": health,
                })

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Telemetry generation failed"
            )

        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ASTRA database")

    init_database()
    init_mission_table()

    logger.info("Starting ASTRA telemetry simulator")

    task = asyncio.create_task(telemetry_loop())

    try:
        yield
    finally:
        logger.info("Stopping ASTRA telemetry simulator")

        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="ASTRA — Crew Health",
    description=(
        "Astronaut health monitoring and "
        "mission readiness decision-support system"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(research_router)
app.include_router(crew_router)
app.include_router(mission_router)
app.include_router(demo_router)
app.include_router(mission_readiness_router)
app.include_router(fitness_router)
app.include_router(assessment_router)
app.include_router(awareness_router)


@app.get("/")
def root():
    return {
        "system": "ASTRA",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "astra-backend",
    }


@app.websocket("/ws/telemetry")
async def telemetry_stream(websocket: WebSocket):
    origin = websocket.headers.get("origin")

    if origin and origin not in FRONTEND_ORIGINS:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        pass

    except Exception:
        logger.exception("WebSocket connection error")

    finally:
        manager.disconnect(websocket)


@app.post("/api/simulation/{mode}")
def simulation_mode(mode: str):
    try:
        astronaut.set_mode(mode.upper())

        return {
            "mode": astronaut.mode,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.get("/api/telemetry/latest/{astronaut_id}")
async def latest_telemetry(astronaut_id: str):
    return await asyncio.to_thread(
        get_latest_telemetry,
        astronaut_id,
        True,
    )
