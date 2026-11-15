function MetricCard({ icon: Icon, title, metric, unit }) {
  if (!metric) {
    return (
      <div className="metric-card">
        <div className="metric-header">
          <Icon size={20} />
          <span>{title}</span>
        </div>
        <div className="metric-loading">Waiting...</div>
      </div>
    );
  }

  const deviation = metric.deviation_percent ?? 0;

  let state = "stable";

  if (Math.abs(deviation) >= 20) {
    state = "action";
  } else if (Math.abs(deviation) >= 10) {
    state = "attention";
  }

  return (
    <div className={`metric-card ${state}`}>
      <div className="metric-header">
        <div className="metric-title">
          <Icon size={20} />
          <span>{title}</span>
        </div>

        <span className={`metric-dot ${state}`} />
      </div>

      <div className="metric-value">
        {metric.current}
        <span>{unit}</span>
      </div>

      <div className="metric-baseline">
        Baseline {metric.baseline} {unit}
      </div>

      <div className={`metric-deviation ${state}`}>
        {deviation >= 0 ? "+" : ""}
        {deviation}% from baseline
      </div>
    </div>
  );
}

export default MetricCard;