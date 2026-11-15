
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export const WS_URL =
  API_BASE.replace(/^http/, "ws") + "/ws/telemetry";

async function request(path, options = {}) {
  const headers = {
    ...options.headers,
  };

  if (options.body != null && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let message = `ASTRA API error (${response.status})`;

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item) => item.msg || "Validation error")
        .join("; ");
    }

    throw new Error(message);
  }

  return data;
}

// Simulation and cognitive APIs

export function getCognitiveScenario(scenario) {
  return request(
    `/api/cognitive/demo/${encodeURIComponent(scenario)}`
  );
}

export function setSimulationMode(mode) {
  return request(
    `/api/simulation/${encodeURIComponent(mode)}`,
    { method: "POST" }
  );
}

// Crew health

export function getCrewTrends(
  astronautId,
  days = 7,
  endDate = null
) {
  const params = new URLSearchParams({
    days: String(days),
  });

  if (endDate) {
    params.set("end_date", endDate);
  }

  return request(
    `/api/crew/trends/${encodeURIComponent(astronautId)}?${params}`
  );
}

// Mission readiness

export function getMissionReadiness(
  astronautId,
  endDate = null
) {
  const params = new URLSearchParams();

  if (endDate) {
    params.set("end_date", endDate);
  }

  const suffix = params.toString();

  return request(
    `/api/readiness/${encodeURIComponent(astronautId)}${
      suffix ? `?${suffix}` : ""
    }`
  );
}

// Fitness

export function saveFitnessMeasurement(payload) {
  return request("/api/fitness/measurements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getFitnessMeasurements(astronautId) {
  return request(
    `/api/fitness/measurements/${encodeURIComponent(astronautId)}`
  );
}

export function evaluateFitness({
  astronautId,
  missionType,
  phase,
  includeSynthetic = false,
  endDate = "",
}) {
  const params = new URLSearchParams({
    mission_type: missionType,
    phase,
    include_synthetic: String(includeSynthetic),
  });

  if (endDate) {
    params.set("as_of_utc", `${endDate}T23:59:59Z`);
  }

  return request(
    `/api/fitness/evaluate/${encodeURIComponent(
      astronautId
    )}?${params}`
  );
}

// Astronaut self-assessment

export function saveAstronautAssessment(payload) {
  return request("/api/assessment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLatestAstronautAssessment(
  astronautId = "CREW-001",
  includeSynthetic = true
) {
  const params = new URLSearchParams({
    include_synthetic: String(includeSynthetic),
  });

  return request(
    `/api/assessment/${encodeURIComponent(
      astronautId
    )}/latest?${params}`
  );
}

export function getAstronautAssessmentReadiness({
  astronautId = "CREW-001",
  missionType = "MARS_EVA",
  phase = "in_mission",
  includeSynthetic = true,
  asOfUtc = null,
} = {}) {
  const params = new URLSearchParams({
    mission_type: missionType,
    phase,
    include_synthetic: String(includeSynthetic),
  });

  if (asOfUtc) {
    params.set("as_of_utc", asOfUtc);
  }

  return request(
    `/api/assessment/${encodeURIComponent(
      astronautId
    )}/readiness?${params}`
  );
}
