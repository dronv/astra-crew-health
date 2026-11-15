
import { Brain } from "lucide-react";

const scenarios = [
  ["normal", "NORMAL"],
  ["channelized", "CHANNELIZED"],
  ["diverted", "DIVERTED"],
  ["startle", "STARTLE"],
];

export default function CognitivePanel({
  cognitive,
  scenario,
  loading,
  error,
  onScenarioChange,
}) {
  const prediction = cognitive?.prediction;
  const confidence = Number(prediction?.confidence ?? 0);

  return (
    <section className="panel cognition-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">NASA DATASET · ML DEMO</span>
          <h2>Cognitive State</h2>
        </div>
        <Brain size={20} />
      </div>

      <div className="cognitive-state">
        <div className="brain-icon">
          <Brain size={34} />
        </div>

        <div>
          <span className="cognitive-label">
            PREDICTED STATE
          </span>
          <h3>
            {prediction?.state?.replaceAll("_", " ") ||
              "NOT ANALYZED"}
          </h3>
          <p>
            {prediction
              ? `Recorded physiological window: ${
                  prediction.window_seconds ?? "--"
                } seconds`
              : "Select a recorded scenario to run the model."}
          </p>
        </div>
      </div>

      <div className="cognitive-meter">
        <div className="meter-label">
          <span>Model confidence</span>
          <strong>
            {prediction ? `${confidence.toFixed(1)}%` : "--"}
          </strong>
        </div>

        <div className="meter">
          <div
            className="meter-fill"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, confidence)
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="cognitive-scenarios">
        <span className="eyebrow">RECORDED SCENARIOS</span>
        <div className="simulation-buttons">
          {scenarios.map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={loading}
              className={
                cognitive && scenario === value ? "active" : ""
              }
              onClick={() => onScenarioChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p>Analyzing recording...</p>}
      {error && <p role="alert">{error}</p>}

      <div className="data-source">
        <span>DATA SOURCE</span>
        <strong>NASA pilot physiological research dataset</strong>
        <p>
          Prototype classification of recorded pilot data;
          not a validated astronaut health assessment.
        </p>
      </div>
    </section>
  );
}
