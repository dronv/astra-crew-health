
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/api/research",
    tags=["Spaceflight Research"]
)

DATA_FILE = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "nasa_research.json"
)


def load_research():
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


@router.get("")
def get_all_research():
    return load_research()


@router.get("/systems/{system_id}")
def get_system_research(system_id: str):
    data = load_research()

    guidance = data["system_guidance"].get(system_id)

    if guidance is None:
        raise HTTPException(
            status_code=404,
            detail="Unknown body system"
        )

    hazards = [
        hazard
        for hazard in data["hazards"]
        if system_id in hazard["systems"]
    ]

    source_ids = {
        source_id
        for hazard in hazards
        for source_id in hazard["source_ids"]
    }

    sources = [
        source
        for source in data["sources"]
        if source["id"] in source_ids
    ]

    return {
        "system_id": system_id,
        "guidance": guidance,
        "hazards": hazards,
        "sources": sources,
        "disclaimer": data["disclaimer"]
    }
