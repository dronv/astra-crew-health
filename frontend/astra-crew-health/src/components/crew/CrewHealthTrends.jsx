
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import { getCrewTrends } from "../../api/astraApi";
import "./CrewHealthTrends.css";

function Summary({ label, value, unit = "" }) {
  return (
    <div className="crew-trend-stat">
      <span>{label}</span>
      <strong>{value ?? "--"}{value != null ? unit : ""}</strong>
    </div>
  );
}

function TrendChart({ title, data, dataKey, color, unit }) {
  return (
    <div className="crew-trend-chart">
      <h3>{title}</h3>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid stroke="#253a4d" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(value) => value.slice(5)}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, title]}
            contentStyle={{
              background: "#0d1b2a",
              border: "1px solid #253a4d",
              color: "#e2e8f0",
            }}
          />
          <Legend />
          <Line
            name={title}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            connectNulls={false}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CrewHealthTrends({
  astronautId = "CREW-001",
  refreshKey = 0,
}) {
  const [days, setDays] = useState(7);
  const [endDate, setEndDate] = useState("");
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getCrewTrends(
        astronautId,
        days,
        endDate || null
      );
      setTrends(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [astronautId, days, endDate]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="crew-trends">
      <div className="crew-trends-header">
        <div>
          <span className="eyebrow">CREW HEALTH ANALYTICS</span>
          <h2>Health Trends</h2>
          <p>Recorded sleep, exercise, and fatigue history.</p>
        </div>

        <div className="crew-trends-controls">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>

          <label>
            End date (UTC)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <button type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <p>Loading health trends...</p>}
      {error && <p role="alert">{error}</p>}

      {trends && (
        <>
          <div className="crew-trend-stats">
            <Summary
              label="Average Sleep"
              value={trends.average_sleep_hours}
              unit=" h"
            />
            <Summary
              label="Total Exercise"
              value={trends.exercise_total_hours}
              unit=" h"
            />
            <Summary
              label="Average Fatigue"
              value={trends.average_fatigue}
              unit="/5"
            />
            <Summary
              label="Log Coverage"
              value={trends.coverage_percent}
              unit="%"
            />
          </div>

          <p className="crew-trend-coverage">
            {trends.records_found} of {trends.days} dates recorded
            {" · "}
            {trends.missing_days} missing
          </p>

          {trends.records_found === 0 ? (
            <div className="crew-trend-empty">
              No daily logs for the selected period.
            </div>
          ) : (
            <div className="crew-trend-grid">
              <TrendChart
                title="Sleep Duration"
                data={trends.daily}
                dataKey="sleep_hours"
                color="#22d3ee"
                unit="h"
              />

              <TrendChart
                title="Exercise Duration"
                data={trends.daily}
                dataKey="exercise_hours"
                color="#a78bfa"
                unit="h"
              />

              <TrendChart
                title="Fatigue Level"
                data={trends.daily}
                dataKey="fatigue_level"
                color="#f59e0b"
                unit="/5"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
