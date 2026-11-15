
import {
  getStatusClass,
  getStatusMessage,
} from "../../utils/healthUtils";

export default function HealthStatusBanner({ status, mode }) {
  const statusClass = getStatusClass(status);

  return (
    <section className={`status-banner ${statusClass}`}>
      <div className="status-symbol">
        {status === "CALIBRATING"
          ? "..."
          : status === "NORMAL"
            ? "✓"
            : "!"}
      </div>

      <div className="status-content">
        <span className="section-label">CREW HEALTH STATUS</span>
        <h2>{status}</h2>
        <p>{getStatusMessage(status)}</p>
      </div>

      <div className="status-mode">
        <span>TELEMETRY MODE</span>
        <strong>{mode.replaceAll("_", " ")}</strong>
      </div>
    </section>
  );
}
