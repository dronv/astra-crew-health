
import { useEffect, useState } from "react";
import "./AstronautActionPlan.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const ORDER = {
  ACTION: 0,
  ATTENTION: 1,
  UNAVAILABLE: 2,
  NORMAL: 3,
};

export default function AstronautActionPlan({
  astronautId = "CREW-001",
  indicators = {},
}) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const indicatorsKey = JSON.stringify(indicators);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlans() {
      setLoading(true);
      setError(null);

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
              indicators: JSON.parse(indicatorsKey),
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Awareness API returned ${response.status}`
          );
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setPlans(
            [...(data.plans || [])].sort(
              (a, b) =>
                ORDER[a.status] - ORDER[b.status]
            )
          );
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

    loadPlans();

    return () => controller.abort();
  }, [astronautId, indicatorsKey]);

  const toggle = (system) => {
    setExpanded((prev) => ({
      ...prev,
      [system]: !prev[system],
    }));
  };

  return (
    <section className="astra-awareness">
      <header className="astra-awareness-header">
        <div>
          <span className="astra-awareness-eyebrow">
            CREW DECISION SUPPORT
          </span>
          <h2>Astronaut Awareness & Action Plan</h2>
          <p>
            Health indicator interpretation and
            NASA-informed countermeasure guidance
          </p>
        </div>
      </header>

      {loading && <p>Evaluating crew indicators...</p>}

      {error && (
        <p className="astra-awareness-error">{error}</p>
      )}

      {!loading && !error && plans.map((plan) => (
        <article
          key={plan.system}
          className={`astra-awareness-card ${
            plan.status.toLowerCase()
          }`}
        >
          <button
            type="button"
            className="astra-awareness-toggle"
            onClick={() => toggle(plan.system)}
            aria-expanded={Boolean(expanded[plan.system])}
          >
            <div>
              <span className="astra-awareness-system">
                {plan.title}
              </span>
              <h3>{plan.headline}</h3>
              {plan.value != null && (
                <span className="astra-awareness-reading">
                  {plan.value} {plan.unit || ""}
                </span>
              )}
            </div>
            <span
              className={`astra-awareness-status ${
                plan.status.toLowerCase()
              }`}
            >
              {plan.status}
            </span>
          </button>

          {(expanded[plan.system] ||
            plan.status === "ACTION" ||
            plan.status === "ATTENTION") && (
            <div className="astra-awareness-content">
              <h4>Why this matters</h4>
              <p>{plan.why_it_matters}</p>

              <h4>Recommended Action Plan</h4>
              <ol>
                {plan.actions.map((item, index) => (
                  <li key={index}>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </li>
                ))}
              </ol>

              <h4>NASA Research References</h4>
              <div className="astra-awareness-sources">
                {plan.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}

      <p className="astra-awareness-disclaimer">
        Research demonstration only. Not a medical
        diagnosis or certified in-flight decision system.
        Crew medical protocols take precedence.
      </p>
    </section>
  );
}
