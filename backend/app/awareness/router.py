
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

router = APIRouter(
    prefix="/api/awareness",
    tags=["Astronaut Awareness"]
)

Status = Literal[
    "NORMAL", "ATTENTION", "ACTION", "UNAVAILABLE"
]

NASA_EXERCISE = (
    "https://www.nasa.gov/general/astronaut-exercise/"
)
NASA_BONE = (
    "https://www.nasa.gov/humans-in-space/"
    "counteracting-bone-and-muscle-loss-in-microgravity/"
)
NASA_FITNESS = (
    "https://www.nasa.gov/reference/"
    "risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/"
)
NASA_FATIGUE = (
    "https://www.nasa.gov/human-systems-integration-division/"
    "human-performance/fatigue-countermeasures-laboratory/"
)
NASA_COGNITION = (
    "https://www.nasa.gov/reference/4-0-human-performance/"
)
NASA_MEDICAL = (
    "https://www.nasa.gov/reference/6-0-medical-operations/"
)
NASA_SLEEP = (
    "https://www.nasa.gov/wp-content/uploads/2023/03/"
    "sleep-accomodations-technical-brief-ochmo.pdf"
)

class Indicator(BaseModel):
    status: Status = "UNAVAILABLE"
    value: float | None = None
    unit: str | None = None
    context: str | None = None

class AwarenessRequest(BaseModel):
    astronaut_id: str = "CREW-001"
    indicators: dict[str, Indicator] = Field(
        default_factory=dict
    )

def source(title, url):
    return {"title": title, "url": url}

def action(title, description):
    return {"title": title, "description": description}

GUIDANCE = {
    "heart": {
        "title": "Cardiovascular",
        "headline": "Cardiovascular indicator requires review",
        "why": (
            "Spaceflight can contribute to cardiovascular "
            "deconditioning. Elevated heart rate has multiple "
            "possible causes and requires activity and symptom context."
        ),
        "actions": [
            action(
                "Confirm activity context",
                "Determine whether the reading occurred during "
                "exercise, recovery, or rest."
            ),
            action(
                "Verify the measurement",
                "Check sensor placement and repeat the reading "
                "according to the crew monitoring procedure."
            ),
            action(
                "Review associated symptoms",
                "Check for dizziness, chest discomfort, "
                "palpitations, faintness, or unusual fatigue."
            ),
            action(
                "Request medical review",
                "If the abnormality persists or symptoms are "
                "present, notify the crew medical officer or "
                "flight surgeon and follow the mission protocol."
            )
        ],
        "sources": [
            source("NASA Exercise Overview", NASA_EXERCISE),
            source("NASA Medical Operations", NASA_MEDICAL)
        ]
    },
    "lungs": {
        "title": "Respiratory",
        "headline": "Respiratory indicator requires review",
        "why": (
            "Respiratory rate is a monitored vital sign. "
            "An elevated rate may reflect exertion, stress, "
            "or a medical concern; the reading alone "
            "does not identify a cause."
        ),
        "actions": [
            action(
                "Check activity context",
                "Determine whether breathing rate was measured "
                "during exertion, recovery, or rest."
            ),
            action(
                "Repeat the observation",
                "Confirm the sensor reading and check "
                "the trend against the crew baseline."
            ),
            action(
                "Assess breathing symptoms",
                "Check for breathlessness, chest discomfort, "
                "dizziness, or other concerning symptoms."
            ),
            action(
                "Escalate when appropriate",
                "Seek prompt crew medical evaluation for "
                "persistent abnormal readings or symptoms. "
                "Follow emergency protocols for severe symptoms."
            )
        ],
        "sources": [
            source("NASA Medical Operations", NASA_MEDICAL)
        ]
    },
    "bones": {
        "title": "Musculoskeletal",
        "headline": "Exercise countermeasure review recommended",
        "why": (
            "Microgravity reduces mechanical loading on bones "
            "and muscles. Without adequate countermeasures, "
            "bone density and muscle performance can decline. "
            "Exercise duration does not measure bone loss."
        ),
        "actions": [
            action(
                "Review exercise adherence",
                "Compare recent logged activity with the "
                "individual crew exercise prescription."
            ),
            action(
                "Review resistance exercise",
                "Check whether prescribed resistance training "
                "using available equipment was completed."
            ),
            action(
                "Review aerobic conditioning",
                "Check prescribed treadmill or cycling "
                "sessions and any missed workouts."
            ),
            action(
                "Consult the exercise team",
                "Discuss repeated missed sessions, pain, "
                "fatigue, or performance decline with the "
                "crew exercise specialist or medical team. "
                "Do not independently increase exercise intensity."
            )
        ],
        "sources": [
            source("NASA Astronaut Exercise", NASA_EXERCISE),
            source("NASA Bone and Muscle Loss", NASA_BONE),
            source("NASA Fitness Risk", NASA_FITNESS)
        ]
    },
    "brain": {
        "title": "Brain & Cognition",
        "headline": "Cognitive performance review recommended",
        "why": (
            "Sleep loss, circadian misalignment, fatigue, "
            "and workload can affect attention, decision-making, "
            "and operational performance."
        ),
        "actions": [
            action(
                "Review sleep history",
                "Check recent sleep duration, quality, "
                "and timing against the planned sleep opportunity."
            ),
            action(
                "Assess fatigue and workload",
                "Review self-reported fatigue, workload, "
                "and recent operational demands."
            ),
            action(
                "Review critical tasks",
                "Inform the crew lead of performance concerns "
                "and consider schedule or task adjustments "
                "through established mission procedures."
            ),
            action(
                "Consult behavioral health or medical support",
                "Escalate persistent cognitive changes, "
                "significant sleep disruption, or new symptoms "
                "to appropriate mission medical personnel."
            )
        ],
        "sources": [
            source("NASA Fatigue Countermeasures", NASA_FATIGUE),
            source("NASA Human Performance", NASA_COGNITION),
            source("NASA Sleep Accommodations", NASA_SLEEP)
        ]
    }
}

ALIASES = {
    "cardiovascular": "heart",
    "respiratory": "lungs",
    "musculoskeletal": "bones",
    "cognitive": "brain",
    "cognition": "brain"
}

@router.post("/evaluate")
def evaluate_awareness(payload: AwarenessRequest):
    plans = []

    for raw_key, indicator in payload.indicators.items():
        key = ALIASES.get(raw_key.lower(), raw_key.lower())

        if key not in GUIDANCE:
            continue

        guidance = GUIDANCE[key]
        status = indicator.status

        if status == "NORMAL":
            headline = "Indicator within configured range"
            actions = [
                action(
                    "Continue routine monitoring",
                    "Continue the established crew monitoring "
                    "and countermeasure plan."
                )
            ]
        elif status == "UNAVAILABLE":
            headline = "Insufficient monitoring data"
            actions = [
                action(
                    "Restore monitoring",
                    "Check data availability, sensor connection, "
                    "and the latest daily health log."
                )
            ]
        else:
            headline = guidance["headline"]
            actions = guidance["actions"]

        plans.append({
            "system": key,
            "title": guidance["title"],
            "status": status,
            "headline": headline,
            "value": indicator.value,
            "unit": indicator.unit,
            "context": indicator.context,
            "why_it_matters": guidance["why"],
            "actions": actions,
            "sources": guidance["sources"],
            "requires_review": status in (
                "ATTENTION", "ACTION"
            )
        })

    priority = {
        "ACTION": 0,
        "ATTENTION": 1,
        "UNAVAILABLE": 2,
        "NORMAL": 3
    }

    plans.sort(key=lambda p: priority[p["status"]])

    return {
        "astronaut_id": payload.astronaut_id,
        "assessment_type": "rule_based_decision_support",
        "clinical_validation": False,
        "plans": plans,
        "disclaimer": (
            "ASTRA is a research demonstration, not a "
            "certified medical device. Status thresholds are "
            "application-configured, not NASA clinical alarm "
            "limits. Guidance is adapted from NASA research "
            "and does not replace mission medical protocols."
        )
    }
