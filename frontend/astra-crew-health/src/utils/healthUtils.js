
export function getStatusClass(status) {
  if (status === "ACTION") return "action";
  if (status === "ATTENTION") return "attention";
  if (status === "CALIBRATING") return "calibrating";
  return "normal";
}

export function getStatusMessage(status) {
  switch (status) {
    case "ACTION":
      return "Health indicators require further review.";
    case "ATTENTION":
      return "Health indicators are deviating from personal baseline.";
    case "CALIBRATING":
      return "Building personal baseline...";
    default:
      return "Health indicators within the prototype baseline range.";
  }
}

export function formatMetricName(name) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getHealthChanges(metrics) {
  if (!metrics) return [];

  const changes = [];

  Object.entries(metrics).forEach(([key, metric]) => {
    const deviation = Number(metric?.deviation_percent);

    if (!Number.isFinite(deviation)) return;

    const absolute = Math.abs(deviation);

    if (absolute >= 20) {
      changes.push({
        level: "action",
        text: `${formatMetricName(key)} has changed ${absolute.toFixed(1)}% from baseline.`,
      });
    } else if (absolute >= 10) {
      changes.push({
        level: "attention",
        text: `${formatMetricName(key)} is ${absolute.toFixed(1)}% from baseline.`,
      });
    }
  });

  if (changes.length === 0) {
    changes.push({
      level: "normal",
      text: "No significant deviations detected.",
    });
  }

  return changes;
}

export function getRecommendation(status) {
  switch (status) {
    case "ACTION":
      return {
        title: "Further assessment recommended",
        description:
          "Review telemetry and reported symptoms. Follow established crew medical procedures for concerning findings.",
      };
    case "ATTENTION":
      return {
        title: "Review physiological changes",
        description:
          "Check sensor readings, recent workload, and changes from the astronaut's baseline.",
      };
    case "CALIBRATING":
      return {
        title: "Continue calibration",
        description:
          "Collect additional telemetry before interpreting baseline deviations.",
      };
    default:
      return {
        title: "Continue monitoring",
        description:
          "Current indicators remain close to the astronaut's prototype baseline.",
      };
  }
}
