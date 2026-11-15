
import { Activity } from "lucide-react";
import MissionClock from "../MissionClock";

export default function DashboardHeader({ connection }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">
          <Activity size={22} />
        </div>

        <div>
          <h1>ASTRA LAB</h1>
          <p>ASTRONAUT HEALTH MONITOR</p>
        </div>
      </div>

      <div className="mission-info">
        <MissionClock />

        <div className="connection">
          <span
            className={`connection-dot ${
              connection === "ONLINE" ? "online" : ""
            }`}
          />
          {connection}
        </div>
      </div>
    </header>
  );
}
