
import { useMemo } from "react";
import { HeartPulse } from "lucide-react";

export default function HeartRateTrend({ history, telemetry }) {
  const points = useMemo(() => {
    if (history.length < 2) return "";

    const values = history.map((item) => item.heart_rate);
    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;
    const range = Math.max(max - min, 1);

    return history
      .map((point, index) => {
        const x = (index / (history.length - 1)) * 800;
        const y = 220 - ((point.heart_rate - min) / range) * 200;
        return `${x},${y}`;
      })
      .join(" ");
  }, [history]);

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">REAL-TIME</span>
          <h2>Heart Rate Trend</h2>
        </div>
        <HeartPulse size={20} />
      </div>

      <div className="chart">
        {points ? (
          <svg
            viewBox="0 0 800 240"
            preserveAspectRatio="none"
            className="chart-svg"
            role="img"
            aria-label="Heart rate over the last 60 readings"
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              points={points}
            />
          </svg>
        ) : (
          <div className="chart-empty">
            Waiting for telemetry...
          </div>
        )}
      </div>

      <div className="chart-footer">
        <span>Last 60 readings</span>
        <strong>{telemetry?.heart_rate ?? "--"} bpm</strong>
      </div>
    </section>
  );
}
