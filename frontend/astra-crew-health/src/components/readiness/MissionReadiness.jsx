
import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  ClipboardCheck,
  CalendarDays,
  Activity,
} from "lucide-react";

import { getMissionReadiness } from "../../api/astraApi";
import "./MissionReadiness.css";

export default function MissionReadiness({
  astronautId = "CREW-001",
  refreshKey = 0,
}) {
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getMissionReadiness(
        astronautId,
        endDate || null
      );
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [astronautId, endDate]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const phase = result?.mission_phase;
  const health = result?.health_review;
  const mission = result?.mission;

  return (
    <section className="readiness-page">
      <div className="readiness-header">
        <div>
          <span className="eyebrow">ASTRA MISSION INTELLIGENCE</span>
          <h2>Mission Readiness</h2>
          <p>
            Mission-phase guidance and crew health review.
          </p>
        </div>

        <label>
          Evaluation date (UTC)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>

      {loading && <p>Evaluating mission readiness...</p>}
      {error && <p role="alert">{error}</p>}

      {result && (
        <>
          <div className="readiness-summary">
            <div className="readiness-stat">
              <CalendarDays size={20} />
              <span>{mission.day_label}</span>
              <strong>
                {String(mission.day_number).padStart(3, "0")}
              </strong>
            </div>

            <div className="readiness-stat">
              <Activity size={20} />
              <span>Health Review</span>
              <strong>
                {health.status.replaceAll("_", " ")}
              </strong>
            </div>

            <div className="readiness-stat">
              <ShieldAlert size={20} />
              <span>EVA Fitness</span>
              <strong>NOT ASSESSED</strong>
            </div>
          </div>

          <div className="readiness-card">
            <div className="readiness-card-heading">
              <CalendarDays size={20} />
              <h3>{phase.name.replaceAll("_", " ")}</h3>
            </div>

            <p>{phase.focus}</p>

            <h4>Recommended mission activities</h4>

            <ul>
              {phase.actions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>

          <div className="readiness-card">
            <div className="readiness-card-heading">
              <Activity size={20} />
              <h3>Crew Health Assessment</h3>
            </div>

            <p>
              Log coverage: {health.coverage}%
            </p>

            <h4>Observations</h4>

            <ul>
              {health.observations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h4>Recommended follow-up</h4>

            <ul>
              {health.actions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="readiness-card">
            <div className="readiness-card-heading">
              <ClipboardCheck size={20} />
              <h3>EVA Fitness Requirements</h3>
            </div>

            <p>{result.fitness_readiness.message}</p>

            <ul>
              {result.fitness_readiness.required_measurements.map(
                (item) => (
                  <li key={item}>{item}</li>
                )
              )}
            </ul>

            <div className="readiness-notice">
              {result.overall_message}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
