
const modes = [
  ["NORMAL", "NORMAL"],
  ["WORKLOAD", "WORKLOAD"],
  ["HEALTH_DEVIATION", "HEALTH DEVIATION"],
];

export default function SimulationPanel({
  mode,
  onModeChange,
  loading,
  error,
}) {
  return (
    <section className="simulation">
      <div>
        <span className="eyebrow">MISSION SIMULATOR</span>
        <h2>Test Health Scenarios</h2>
        <p>
          Synthetic telemetry for demonstration purposes.
        </p>
      </div>

      <div className="simulation-buttons">
        {modes.map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={loading}
            className={mode === value ? "active" : ""}
            onClick={() => onModeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
