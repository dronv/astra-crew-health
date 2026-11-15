
import { useEffect, useState } from "react";
import { Clock3, Orbit } from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function MissionClock() {
  const [mission, setMission] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function fetchMission() {
      try {
        const requestStarted = Date.now();

        const response = await fetch(
          `${API_BASE}/api/mission/clock`
        );

        if (!response.ok) {
          throw new Error("Unable to load mission clock");
        }

        const data = await response.json();
        const requestFinished = Date.now();

        // Approximate the server time at the midpoint
        // of the request to reduce network-latency error.
        const midpoint =
          (requestStarted + requestFinished) / 2;

        const offset =
          Date.parse(data.current_utc) - midpoint;

        if (mounted) {
          setMission(data);
          setServerOffset(offset);
          setError("");
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      }
    }

    fetchMission();

    // Periodically resynchronize with the backend.
    const syncInterval = setInterval(fetchMission, 60000);

    return () => {
      mounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mission) {
    return (
      <div className="mission-clock">
        {error || "Loading mission clock..."}
      </div>
    );
  }

  const currentTime = new Date(now + serverOffset);
  const startTime = Date.parse(mission.start_utc);

  const elapsedSeconds = Math.max(
    0,
    (currentTime.getTime() - startTime) / 1000
  );

  const isMars = mission.mission_type === "MARS_EVA";

  const dayLength = isMars
    ? 88775.244
    : 86400;

  const hasStarted =
    currentTime.getTime() >= startTime;

  const missionDay = hasStarted
    ? Math.floor(elapsedSeconds / dayLength) + 1
    : 0;

  const utcTime = currentTime.toLocaleString("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="mission-clock-live">
      <div className="mission-clock-title">
        <Orbit size={15} />
        <span>{mission.mission_name}</span>
      </div>

      <div className="mission-clock-details">
        <div className="mission-sol">
          <span>{isMars ? "MARS SOL" : "MISSION DAY"}</span>
          <strong>
            {hasStarted
              ? String(missionDay).padStart(3, "0")
              : "PRE-LAUNCH"}
          </strong>
        </div>

        <div className="mission-utc">
          <span>
            <Clock3 size={13} />
          </span>

          <strong>{utcTime} UTC</strong>
        </div>
      </div>

      {error && (
        <small className="mission-clock-warning">
          Clock synchronization unavailable
        </small>
      )}
    </div>
  );
}
