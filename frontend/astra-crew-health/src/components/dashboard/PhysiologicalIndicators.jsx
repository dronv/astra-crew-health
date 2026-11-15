
import {
  Activity,
  HeartPulse,
  Radio,
  Thermometer,
  Wind,
} from "lucide-react";

import MetricCard from "../MetricCard";

const indicators = [
  { key: "heart_rate", title: "Heart Rate", unit: "bpm", icon: HeartPulse },
  { key: "respiration_rate", title: "Respiration", unit: "rpm", icon: Wind },
  { key: "temperature", title: "Temperature", unit: "°C", icon: Thermometer },
  { key: "oxygen_saturation", title: "Oxygen Saturation", unit: "%", icon: Activity },
  { key: "activity", title: "Activity", unit: "", icon: Activity },
];

export default function PhysiologicalIndicators({ health }) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LIVE MONITORING</span>
          <h2>Physiological Indicators</h2>
        </div>
        <Radio size={20} />
      </div>

      <div className="metric-grid">
        {indicators.map(({ key, title, unit, icon }) => (
          <MetricCard
            key={key}
            icon={icon}
            title={title}
            metric={health?.metrics?.[key]}
            unit={unit}
          />
        ))}
      </div>
    </section>
  );
}
