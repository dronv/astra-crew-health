
export function evaluateCognitiveReadiness(
  log,
  assessment = null
) {
  if (!log && !assessment) {
    return {
      status: "UNAVAILABLE",
      reason: "No crew health assessment available",
      indicators: {},
    };
  }

  const daily = log || assessment?.daily_log || {};

  const fatigue = Number(daily.fatigue_level);
  const sleep = Number(daily.sleep_hours);

  const validFatigue =
    daily.fatigue_level != null &&
    Number.isFinite(fatigue) &&
    fatigue >= 1 &&
    fatigue <= 5;

  const validSleep =
    daily.sleep_hours != null &&
    Number.isFinite(sleep) &&
    sleep >= 0 &&
    sleep <= 24;

  const workload =
    assessment?.questionnaire?.stress ||
    daily.workload ||
    null;

  const stressObservation =
    assessment?.health?.stress?.value;

  const stress =
    stressObservation == null
      ? null
      : Number(stressObservation);

  const validStress =
    stress !== null &&
    Number.isFinite(stress) &&
    stress >= 1 &&
    stress <= 5;

  const symptoms =
    assessment?.questionnaire?.symptoms ||
    null;

  const warnings = [];

  if (validFatigue && fatigue >= 4) {
    warnings.push("Elevated reported fatigue");
  }

  if (validSleep && sleep < 6) {
    warnings.push("Reduced reported sleep");
  }

  if (
    validStress && stress >= 4 ||
    ["high", "very high"].includes(
      String(workload || "").toLowerCase()
    )
  ) {
    warnings.push("Elevated reported workload or stress");
  }

  if (
    ["Poor", "Very poor"].includes(
      assessment?.questionnaire?.sleep
    )
  ) {
    warnings.push("Poor reported sleep quality");
  }

  if (
    symptoms === "Unusual fatigue"
  ) {
    warnings.push("Unusual fatigue reported");
  }

  const hasData =
    validFatigue ||
    validSleep ||
    validStress ||
    workload != null;

  return {
    status: !hasData
      ? "UNAVAILABLE"
      : warnings.length
        ? "ATTENTION"
        : "NORMAL",
    reason: warnings.length
      ? warnings.join("; ")
      : hasData
        ? "No configured fatigue or sleep warning threshold exceeded"
        : "Insufficient assessment data",
    indicators: {
      sleep_hours: validSleep ? sleep : null,
      fatigue_level: validFatigue ? fatigue : null,
      workload,
      stress_level: validStress ? stress : null,
      symptoms,
    },
  };
}
