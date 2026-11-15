from collections import deque
import statistics


class HealthMonitor:
    FIELDS = [
        "heart_rate",
        "respiration_rate",
        "temperature",
        "oxygen_saturation",
        "activity",
    ]

    # Define custom thresholds per metric type
    THRESHOLDS = {
        "heart_rate": {"type": "percent", "attention": 15.0, "action": 30.0},
        "respiration_rate": {"type": "percent", "attention": 15.0, "action": 30.0},
        "temperature": {"type": "absolute", "attention": 0.8, "action": 1.8},
        "oxygen_saturation": {"type": "drop", "attention": 2.5, "action": 4.5},
        "activity": {"type": "info_only"},
    }

    def __init__(self, baseline_size=60):
        self.baseline_size = baseline_size
        self.calibration = deque(maxlen=baseline_size)
        self.baseline = None

    def update(self, telemetry):
        if self.baseline is None:
            self.calibration.append(telemetry.copy())

            if len(self.calibration) < self.baseline_size:
                return {
                    "status": "CALIBRATING",
                    "message": (
                        f"Collecting baseline: "
                        f"{len(self.calibration)}/{self.baseline_size}"
                    ),
                    "metrics": {},
                }

            self.baseline = {
                field: statistics.mean(
                    reading[field] for reading in self.calibration
                )
                for field in self.FIELDS
            }

        metrics = {}

        for field in self.FIELDS:
            current = float(telemetry[field])
            baseline = self.baseline[field]

            if baseline == 0:
                deviation = None
                metric_status = "UNAVAILABLE"
            else:
                deviation = ((current - baseline) / baseline) * 100
                metric_status = self._evaluate_metric(field, current, baseline, deviation)

            metrics[field] = {
                "current": round(current, 2),
                "baseline": round(baseline, 2),
                "deviation_percent": (
                    round(deviation, 2) if deviation is not None else None
                ),
                "status": metric_status,
            }

        overall_status = self.calculate_status(metrics)

        messages = {
            "NORMAL": "No significant deviations detected.",
            "ATTENTION": "Multiple physiological indicators have shifted from baseline.",
            "ACTION": "Critical physiological deviations detected from baseline.",
        }

        return {
            "status": overall_status,
            "message": messages[overall_status],
            "metrics": metrics,
        }

    def _evaluate_metric(self, field, current, baseline, deviation_percent):
        rule = self.THRESHOLDS[field]
        rule_type = rule["type"]

        if rule_type == "info_only":
            return "NORMAL"

        if rule_type == "percent":
            diff = abs(deviation_percent)
        elif rule_type == "absolute":
            diff = abs(current - baseline)
        elif rule_type == "drop":
            # Only trigger on oxygen drops, not increases
            diff = max(0.0, baseline - current)
        else:
            return "NORMAL"

        if diff >= rule["action"]:
            return "ACTION"
        if diff >= rule["attention"]:
            return "ATTENTION"
        return "NORMAL"

    def calculate_status(self, metrics):
        attention = 0
        action = 0

        for field, metric in metrics.items():
            if field == "activity":
                continue
            if metric["status"] == "ACTION":
                action += 1
            elif metric["status"] == "ATTENTION":
                attention += 1

        if action >= 2:
            return "ACTION"

        # Count ACTION metrics toward total abnormal indicators
        if (action + attention) >= 2:
            return "ATTENTION"

        return "NORMAL"
