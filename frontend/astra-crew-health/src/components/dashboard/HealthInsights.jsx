
import { useEffect, useMemo, useState } from "react";
import {
  Play, RefreshCw, HeartPulse, Wind, Brain, Dumbbell, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from "lucide-react";

import { getHealthChanges, getStatusClass, } from "../../utils/healthUtils";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const VALID_STATUSES = [
  "NORMAL",
  "ATTENTION",
  "ACTION",
  "UNAVAILABLE",
];

const ICONS = {
  heart: HeartPulse,
  lungs: Wind,
  brain: Brain,
  bones: Dumbbell,
};

function normalizeStatus(value) {
  const status = String(value || "").toUpperCase();

  return VALID_STATUSES.includes(status)
    ? status
    : "UNAVAILABLE";
}

function findMetric(metrics, keys) {
  if (!metrics || typeof metrics !== "object") {
    return null;
  }

  for (const key of keys) {
    if (metrics[key] != null) {
      return metrics[key];
    }
  }

  return null;
}

function getMetricValue(metric) {
  if (typeof metric === "number") {
    return Number.isFinite(metric) ? metric : null;
  }

  if (!metric || typeof metric !== "object") {
    return null;
  }

  const value =
    metric.value ??
    metric.current ??
    metric.reading ??
    null;

  if (value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getMetricStatus(metric) {
  if (!metric || typeof metric !== "object") {
    return "UNAVAILABLE";
  }

  return normalizeStatus(
    metric.status ??
    metric.level ??
    metric.health_status
  );
}

function buildIndicators(health, cognitive) {
  const metrics = health?.metrics || {};

  const heart = findMetric(metrics, [
    "heart_rate",
    "heartRate",
    "hr",
    "bpm",
  ]);

  const lungs = findMetric(metrics, [
    "respiratory_rate",
    "respiratoryRate",
    "respiration_rate",
    "breathing_rate",
    "rpm",
  ]);

  const heartValue = getMetricValue(heart);
  const lungsValue = getMetricValue(lungs);

  const cognitiveStatus = normalizeStatus(
    cognitive?.status ??
    cognitive?.assessment?.status
  );

  return {
    heart: {
      status: getMetricStatus(heart),
      value: heartValue,
      unit: "BPM",
      context: "Live telemetry",
    },
    lungs: {
      status: getMetricStatus(lungs),
      value: lungsValue,
      unit: "breaths/min",
      context: "Live telemetry",
    },
    brain: {
      status: cognitiveStatus,
      context: "Cognitive assessment",
    },
  };
}

export default function HealthInsights({
  health,
  cognitive = null,
  status,
  astronautId = "CREW-001",
  onStartAssessment,
}) {
  const changes = getHealthChanges(health?.metrics);

  const indicators = useMemo(
    () => buildIndicators(health, cognitive),
    [health, cognitive]
  );

  const indicatorsKey = JSON.stringify({
    heart: {
      status: indicators.heart.status,
    },
    lungs: {
      status: indicators.lungs.status,
    },
    brain: {
      status: indicators.brain.status,
    },
  });

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPlans() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/awareness/evaluate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              astronaut_id: astronautId,
              indicators: {
                heart: {
                  ...indicators.heart,
                },
                lungs: {
                  ...indicators.lungs,
                },
                brain: {
                  ...indicators.brain,
                },
              },
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Awareness API error: ${response.status}`
          );
        }

        const result = await response.json();

        if (!controller.signal.aborted) {
          setPlans(result.plans || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPlans();

    return () => controller.abort();
  }, [astronautId, indicatorsKey]);

  function togglePlan(system) {
    setExpanded((previous) => ({
      ...previous,
      [system]: !previous[system],
    }));
  }

  const activePlans = plans.filter(
    (plan) =>
      plan.status === "ATTENTION" ||
      plan.status === "ACTION"
  );

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">ANALYSIS</span>
            <h2>What Changed?</h2>
          </div>

          <RefreshCw size={19} />
        </div>

        <div className="changes">
          {changes.map((change, index) => (
            <div className="change" key={index}>
              <span
                className={`change-icon ${change.level}`}
              >
                {change.level === "normal" ? "✓" : "!"}
              </span>

              <span>{change.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel action-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">
              NASA-INFORMED CREW GUIDANCE
            </span>
            <h2>Astronaut Action Plan</h2>
          </div>
        </div>

        {loading && plans.length === 0 && (
          <p>Evaluating crew health indicators...</p>
        )}

        {error && (
          <p className="awareness-error">{error}</p>
        )}

        {!loading && !error && activePlans.length === 0 && (
          <div
            className={`recommendation ${getStatusClass(status)
              }`}
          >
            <div className="recommendation-icon">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <h3>No active action plans</h3>
              <p>
                No ATTENTION or ACTION status has been
                received for the available system indicators.
                Continue monitoring. Missing indicators
                are not considered normal.
              </p>
            </div>
          </div>
        )}

        <div className="awareness-plans">
          {activePlans.map((plan) => {
            const Icon =
              ICONS[plan.system] || AlertTriangle;

            const isExpanded =
              expanded[plan.system] ?? true;

            return (
              <div
                className={`awareness-plan ${plan.status.toLowerCase()
                  }`}
                key={plan.system}
              >
                <button
                  type="button"
                  className="awareness-plan-header"
                  onClick={() =>
                    togglePlan(plan.system)
                  }
                  aria-expanded={isExpanded}
                >
                  <div className="awareness-plan-heading">
                    <Icon size={19} />

                    <div>
                      <strong>{plan.title}</strong>
                      <span>{plan.headline}</span>
                    </div>
                  </div>

                  <div className="awareness-plan-right">
                    <span
                      className={`awareness-plan-badge ${plan.status.toLowerCase()
                        }`}
                    >
                      {plan.status}
                    </span>

                    {isExpanded ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="awareness-plan-body">
                    {plan.value != null && (
                      <div className="awareness-reading">
                        Current reading:{" "}
                        <strong>
                          {plan.value} {plan.unit}
                        </strong>
                      </div>
                    )}

                    <h4>Why this matters</h4>
                    <p>{plan.why_it_matters}</p>

                    <h4>Recommended crew actions</h4>

                    <ol>
                      {plan.actions.map(
                        (action, index) => (
                          <li key={index}>
                            <strong>
                              {action.title}
                            </strong>
                            <p>
                              {action.description}
                            </p>
                          </li>
                        )
                      )}
                    </ol>

                    <h4>NASA research references</h4>

                    <div className="awareness-references">
                      {plan.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.title}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="assessment-button"
          onClick={onStartAssessment}
        >
          <Play size={17} />
          START SELF-ASSESSMENT
        </button>

        <p className="awareness-disclaimer">
          Research demonstration only. Recommendations
          are not medical diagnoses or certified
          NASA flight procedures.
        </p>
      </div>
    </section>
  );
}
