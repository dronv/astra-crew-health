
import { useCallback, useEffect, useState } from "react";
import { evaluateFitness } from "../../api/astraApi";

function StatusLabel({ status }) {
  const colors = {
    MET: "#4ade80",
    NOT_MET: "#f87171",
    NOT_ASSESSED: "#fbbf24",
  };

  return (
    <span
      style={{
        color: colors[status] || "#cbd5e1",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {String(status || "NOT_ASSESSED").replaceAll("_", " ")}
    </span>
  );
}

export default function FitnessRequirements({
  astronautId = "CREW-001",
  missionType = "ISS_EVA",
  endDate = "",
  refreshKey = 0,
}) {
  const [phase, setPhase] = useState("in_mission");
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!missionType) return;

    setLoading(true);
    setError("");

    try {
      const response = await evaluateFitness({
        astronautId,
        missionType,
        phase,
        includeSynthetic,
        endDate,
      });

      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    astronautId,
    missionType,
    phase,
    includeSynthetic,
    endDate,
  ]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="readiness-card fitness-panel">
      <div className="readiness-card-heading">
        <h3>NASA Fitness Requirements</h3>
      </div>

      <p>
        Evaluate applicable fitness rules using recorded measurements.
        Results are prototype decision support, not medical clearance.
      </p>

      <div className="fitness-toolbar">
        <label>
          Assessment phase
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="pre_mission">Premission</option>
            <option value="in_mission">In mission</option>
          </select>
        </label>

        <label className="fitness-checkbox">
          <input
            type="checkbox"
            checked={includeSynthetic}
            onChange={(event) =>
              setIncludeSynthetic(event.target.checked)
            }
          />
          Include synthetic data
        </label>

        <button
          type="button"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Evaluating..." : "Refresh evaluation"}
        </button>
      </div>

      {loading && <p>Evaluating requirements...</p>}
      {error && <p role="alert">{error}</p>}

      {result && (
        <>
          <div className="fitness-summary">
            <div>
              <strong>{result.counts?.MET ?? 0}</strong>
              <span>Met</span>
            </div>

            <div>
              <strong>{result.counts?.NOT_MET ?? 0}</strong>
              <span>Not Met</span>
            </div>

            <div>
              <strong>{result.counts?.NOT_ASSESSED ?? 0}</strong>
              <span>Not Assessed</span>
            </div>
          </div>

          <div className="fitness-results">
            {(result.results || []).map((rule) => (
              <div className="fitness-rule" key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <small>
                    {rule.id} · {rule.source?.standard}
                  </small>
                </div>

                <div className="fitness-rule-value">
                  <span>
                    {rule.actual ?? "—"} {rule.unit}
                  </span>
                  <small>
                    Required: {rule.operator} {rule.threshold}
                  </small>
                </div>

                <StatusLabel status={rule.status} />
              </div>
            ))}
          </div>

          <p className="fitness-disclaimer">
            {result.disclaimer ||
              "ASTRA provides prototype fitness decision support only."}
          </p>
        </>
      )}
    </section>
  );
}
