
import { useEffect, useState } from "react";
import {
  Brain,
  Moon,
  BatteryLow,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import "./CognitivePanel.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

function evaluate(log, assessment) {
  const fatigue = log?.fatigue_level;
  const sleep = log?.sleep_hours;
  const workload = log?.workload;

  const stress = assessment?.health?.stress?.value;
  const symptoms = assessment?.questionnaire?.symptoms;

  const warnings = [];

  if (fatigue != null && Number(fatigue) >= 4) {
    warnings.push("Elevated fatigue");
  }

  if (sleep != null && Number(sleep) < 6) {
    warnings.push("Reduced sleep");
  }

  if (
    stress != null &&
    Number(stress) >= 4
  ) {
    warnings.push("Elevated stress");
  }

  if (
    ["high", "very high"].includes(
      String(workload || "").toLowerCase()
    )
  ) {
    warnings.push("High workload");
  }

  const hasData =
    fatigue != null ||
    sleep != null ||
    workload != null ||
    stress != null;

  return {
    status: !hasData
      ? "UNAVAILABLE"
      : warnings.length
        ? "ATTENTION"
        : "NORMAL",
    warnings,
    fatigue,
    sleep,
    workload,
    stress,
    symptoms,
    date: log?.log_date,
  };
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="cognitive-metric">
      <Icon size={16} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function CognitivePanel({
  astronautId = "CREW-001",
  onUpdate,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(signal) {
    setLoading(true);
    setError("");

    try {
      const id = encodeURIComponent(astronautId);

      const [dailyRes, assessmentRes] =
        await Promise.all([
          fetch(
            `${API_BASE}/api/crew/daily-log/${id}?limit=30`,
            { signal, cache: "no-store" }
          ),
          fetch(
            `${API_BASE}/api/assessment/${id}/latest?include_synthetic=true`,
            { signal, cache: "no-store" }
          ),
        ]);

      if (!dailyRes.ok || !assessmentRes.ok) {
        throw new Error("Unable to load assessment data");
      }

      const daily = await dailyRes.json();
      const assessment = await assessmentRes.json();

      const latest = [...(daily.logs || [])].sort(
        (a, b) =>
          String(b.log_date).localeCompare(
            String(a.log_date)
          )
      )[0] || null;

      const result = evaluate(latest, assessment);

      if (!signal?.aborted) {
        setData(result);
        onUpdate?.(result);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.message);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    const refresh = () => load(controller.signal);

    refresh();

    window.addEventListener(
      "astra:assessment-saved",
      refresh
    );

    return () => {
      controller.abort();
      window.removeEventListener(
        "astra:assessment-saved",
        refresh
      );
    };
  }, [astronautId]);

  return (
    <div className="panel cognitive-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">
            CREW SELF-ASSESSMENT
          </span>
          <h2>Sleep & Cognitive Readiness</h2>
        </div>

        <Brain size={21} />
      </div>

      {loading && (
        <p>Loading crew health observations...</p>
      )}

      {error && (
        <p className="awareness-error">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          <div className="cognitive-summary">
            <span
              className={`body-status-badge ${data.status}`}
            >
              {data.status === "UNAVAILABLE"
                ? "NOT ASSESSED"
                : data.status}
            </span>

            <span className="cognitive-date">
              {data.date || "No log date"}
            </span>
          </div>

          <div className="cognitive-metrics">
            <Metric
              icon={Moon}
              label="Sleep"
              value={
                data.sleep != null
                  ? `${data.sleep} hours`
                  : "—"
              }
            />

            <Metric
              icon={BatteryLow}
              label="Fatigue"
              value={
                data.fatigue != null
                  ? `${data.fatigue} / 5`
                  : "—"
              }
            />

            <Metric
              icon={Activity}
              label="Workload"
              value={data.workload || "—"}
            />

            <Metric
              icon={Brain}
              label="Stress"
              value={
                data.stress != null
                  ? `${data.stress} / 5`
                  : "—"
              }
            />
          </div>

          {data.warnings.length > 0 && (
            <div className="cognitive-warning">
              <AlertTriangle size={17} />
              <span>
                {data.warnings.join(" · ")}
              </span>
            </div>
          )}

          {data.symptoms &&
            data.symptoms !== "No symptoms" && (
              <p className="cognitive-symptoms">
                Reported symptoms: {data.symptoms}.
                Review with crew medical support.
              </p>
            )}

          <p className="cognitive-disclaimer">
            Based on reported sleep, fatigue, workload,
            and stress. Prototype screening only;
            not a cognitive performance test or diagnosis.
          </p>
        </>
      )}
    </div>
  );
}
