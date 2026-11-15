import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# from app.ml.demo import run_demo
# from app.ml.predict import CognitiveModel
from app.research import router as research_router
from app.database import init_database
from app.crew.daily_logs import router as crew_router
from app.crew.demo import router as demo_router
from app.mission import (router as mission_router,init_mission_table)
from .health import HealthMonitor
from app.readiness.mission_readiness import (router as mission_readiness_router)
from .telemetry import AstronautTelemetry


astronaut = AstronautTelemetry()
health_monitor = HealthMonitor()
# cognitive_model = CognitiveModel()


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
    """Single source of truth generating telemetry once per second."""
    while True:
        telemetry = astronaut.generate()
        health = health_monitor.update(telemetry)

        if manager.active_connections:
            await manager.broadcast({
                "telemetry": telemetry,
                "health": health,
            })

        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):

    init_database()
    init_mission_table()
    # Start the single telemetry loop when the server boots
    task = asyncio.create_task(telemetry_loop())
    yield
    # Cancel the background task cleanly on shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


class AstronautAssessment(BaseModel):
    vo2max: float | None = None
    premission_vo2max: float | None = None
    deadlift_bodyweight_ratio: float | None = None
    bench_press_bodyweight_ratio: float | None = None


app = FastAPI(
    title="ASTRA LAB",
    description="Astronaut Health Monitoring System",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(research_router)
app.include_router(crew_router)
app.include_router(mission_router)
app.include_router(demo_router)
app.include_router(mission_readiness_router)

@app.get("/")
def root():
    return {
        "system": "ASTRA",
        "status": "online",
    }


@app.post("/api/readiness/{mission}")
def readiness(
    mission: str,
    astronaut_data: AstronautAssessment,
):
    return assess_readiness(
        mission,
        astronaut_data.model_dump(),
    )


@app.websocket("/ws/telemetry")
async def telemetry_stream(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print("WebSocket error:", repr(e))
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


# @app.get("/api/cognitive/test")
# def test_cognitive_model():
#     data_file = (
#         Path(__file__).resolve().parents[1]
#         / "data"
#         / "physiological"
#         / "nasa_crew"
#         / "raw"
#         / "26"
#         / "26_LOFT.csv"
#     )

#     df = pd.read_csv(data_file)

#     # 10 seconds * 256 Hz
#     window = df.iloc[:2560]

#     return cognitive_model.predict(window)


# @app.get("/api/cognitive/demo/{scenario}")
# def cognitive_demo(scenario: str):
#     try:
#         return run_demo(scenario)
#     except ValueError as exc:
#         raise HTTPException(
#             status_code=400,
#             detail=str(exc),
#         )
