
import { Play, RefreshCw } from "lucide-react";

import {
  getHealthChanges,
  getRecommendation,
  getStatusClass,
} from "../../utils/healthUtils";

export default function HealthInsights({
  health,
  status,
  onStartAssessment,
}) {
  const changes = getHealthChanges(health?.metrics);
  const recommendation = getRecommendation(status);

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
              <span className={`change-icon ${change.level}`}>
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
            <span className="eyebrow">ASTRA GUIDANCE</span>
            <h2>Recommended Action</h2>
          </div>
        </div>

        <div className={`recommendation ${getStatusClass(status)}`}>
          <div className="recommendation-icon">
            {status === "NORMAL" ? "✓" : "!"}
          </div>

          <div>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.description}</p>
          </div>
        </div>

        <button
          className="assessment-button"
          onClick={onStartAssessment}
        >
          <Play size={17} />
          START SELF-ASSESSMENT
        </button>
      </div>
    </section>
  );
}
