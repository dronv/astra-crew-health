import json
import math
from pathlib import Path

REQUIREMENTS_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "nasa_requirements.json"
)

SUPPORTED_OPERATORS = {
    ">=": lambda actual, expected: actual >= expected,
    ">": lambda actual, expected: actual > expected,
    "<=": lambda actual, expected: actual <= expected,
    "<": lambda actual, expected: actual < expected,
    "==": lambda actual, expected: actual == expected,
}

def load_requirements():
    with REQUIREMENTS_FILE.open("r", encoding="utf-8") as file:
        requirements = json.load(file)

    if not isinstance(requirements, list):
        raise ValueError("Requirements file must contain a JSON array")

    return requirements

def safe_ratio(numerator, denominator, multiplier=1):
    if numerator is None or denominator is None:
        return None

    try:
        numerator = float(numerator)
        denominator = float(denominator)
        multiplier = float(multiplier)
    except (TypeError, ValueError):
        return None

    if not all(math.isfinite(v) for v in (
        numerator, denominator, multiplier
    )):
        return None

    if denominator <= 0 or numerator < 0:
        return None

    return round(
        numerator / denominator * multiplier,
        3
    )

def calculate_metrics(measurements):
    values = dict(measurements or {})

    values["vo2max_percent_of_premission"] = safe_ratio(
        values.get("vo2max"),
        values.get("premission_vo2max"),
        100
    )

    values["deadlift_bodyweight_ratio"] = safe_ratio(
        values.get("deadlift_kg"),
        values.get("bodyweight_kg")
    )

    values["bench_press_bodyweight_ratio"] = safe_ratio(
        values.get("bench_press_kg"),
        values.get("bodyweight_kg")
    )

    values["muscle_strength_percent_of_baseline"] = safe_ratio(
        values.get("muscle_strength"),
        values.get("premission_muscle_strength"),
        100
    )

    return values

def evaluate_requirements(mission_type, phase, measurements):
    requirements = load_requirements()
    metrics = calculate_metrics(measurements)

    results = []

    for rule in requirements:
        if mission_type not in rule.get("missions", []):
            continue

        if rule.get("phase") != phase:
            continue

        metric_name = rule["metric"]
        actual = metrics.get(metric_name)
        threshold = rule["threshold"]
        operator = rule["operator"]

        if operator not in SUPPORTED_OPERATORS:
            raise ValueError(
                f"Unsupported operator in {rule['id']}: {operator}"
            )

        if actual is None:
            status = "NOT_ASSESSED"
        else:
            status = (
                "MET"
                if SUPPORTED_OPERATORS[operator](
                    float(actual),
                    float(threshold)
                )
                else "NOT_MET"
            )

        results.append({
            "id": rule["id"],
            "name": rule["name"],
            "category": rule["category"],
            "metric": metric_name,
            "actual": actual,
            "operator": operator,
            "threshold": threshold,
            "unit": rule["unit"],
            "phase": rule["phase"],
            "status": status,
            "source": rule.get("source", {}),
        })

    counts = {
        "MET": sum(r["status"] == "MET" for r in results),
        "NOT_MET": sum(r["status"] == "NOT_MET" for r in results),
        "NOT_ASSESSED": sum(
            r["status"] == "NOT_ASSESSED" for r in results
        ),
    }

    if not results:
        overall = "NO_APPLICABLE_REQUIREMENTS"
    elif counts["NOT_MET"] > 0:
        overall = "REVIEW_REQUIRED"
    elif counts["NOT_ASSESSED"] > 0:
        overall = "INCOMPLETE"
    else:
        overall = "ALL_CHECKS_MET"

    return {
        "mission_type": mission_type,
        "phase": phase,
        "overall_status": overall,
        "total_requirements": len(results),
        "counts": counts,
        "results": results,
        "measurements": metrics,
        "disclaimer": (
            "Prototype rule evaluation only. Passing these checks "
            "does not establish medical or EVA flight clearance."
        ),
    }