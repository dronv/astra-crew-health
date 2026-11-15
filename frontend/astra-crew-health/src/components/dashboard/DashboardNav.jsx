
import {
  Activity,
  HeartPulse,
  CalendarDays,
  FlaskConical,
} from "lucide-react";
import { TrendingUp, ShieldCheck } from "lucide-react";
const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "body", label: "Body Health", icon: HeartPulse },
  { id: "daily", label: "Daily Health", icon: CalendarDays },
  { id: "simulator", label: "Simulator", icon: FlaskConical },
  { id: "trends", label: "Health Trends", icon: TrendingUp },
  { id: "readiness", label: "Mission Readiness", icon: ShieldCheck },
];

export default function DashboardNav({ activeTab, onChange }) {
  return (
    <nav className="astra-nav" aria-label="ASTRA sections">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`astra-nav-button ${activeTab === id ? "active" : ""
            }`}
          onClick={() => onChange(id)}
          aria-current={activeTab === id ? "page" : undefined}
        >
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
