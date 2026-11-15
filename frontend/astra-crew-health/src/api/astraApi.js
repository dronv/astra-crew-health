
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws/telemetry";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  if (!response.ok) {
    throw new Error(`ASTRA API error: ${response.status}`);
  }

  return response.json();
}

export function getCognitiveScenario(scenario) {
  return request(`/api/cognitive/demo/${encodeURIComponent(scenario)}`);
}

export function setSimulationMode(mode) {
  return request(`/api/simulation/${encodeURIComponent(mode)}`, {
    method: "POST",
  });
}


export function getCrewTrends(
  astronautId,
  days = 7,
  endDate = null
) {
  const params = new URLSearchParams({
    days: String(days),
  });

  if (endDate) params.set("end_date", endDate);

  return request(
    `/api/crew/trends/${encodeURIComponent(astronautId)}?${params}`
  );
}

export function getMissionReadiness(astronautId, endDate = null) {
  const params = new URLSearchParams();

  if (endDate) params.set("end_date", endDate);

  const suffix = params.toString();

  return request(
    `/api/readiness/${encodeURIComponent(astronautId)}${
      suffix ? `?${suffix}` : ""
    }`
  );
}
