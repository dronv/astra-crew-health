
import { useEffect, useState } from "react";
import { Moon, Dumbbell, Activity, Save } from "lucide-react";
import "./CrewDailyLog.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyForm() {
  return {
    log_date: todayLocal(),
    sleep_hours: "",
    sleep_quality: "good",
    exercise_hours: "",
    exercise_type: "mixed",
    fatigue_level: 2,
    workload: "moderate",
    notes: "",
  };
}

export default function CrewDailyLog({
  astronautId = "CREW-001",
  onSaved,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadExisting() {
      try {
        const response = await fetch(
          `${API_BASE}/api/crew/daily-log/${encodeURIComponent(
            astronautId
          )}?limit=365`,
          { signal: controller.signal }
        );

        if (!response.ok) return;

        const data = await response.json();

        const existing = data.logs.find(
          (log) => log.log_date === form.log_date
        );

        if (existing) {
          setForm({
            log_date: existing.log_date,
            sleep_hours: String(existing.sleep_hours),
            sleep_quality: existing.sleep_quality,
            exercise_hours: String(existing.exercise_hours),
            exercise_type: existing.exercise_type,
            fatigue_level: existing.fatigue_level,
            workload: existing.workload,
            notes: existing.notes || "",
          });
        } else {
          setForm({
            ...emptyForm(),
            log_date: form.log_date,
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load existing daily log.");
        }
      }
    }

    setMessage("");
    setError("");
    loadExisting();

    return () => controller.abort();
  }, [astronautId, form.log_date]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        astronaut_id: astronautId,
        sleep_hours: Number(form.sleep_hours),
        exercise_hours: Number(form.exercise_hours),
        fatigue_level: Number(form.fatigue_level),
      };

      const response = await fetch(
        `${API_BASE}/api/crew/daily-log`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const details = await response.json();
        throw new Error(
          typeof details.detail === "string"
            ? details.detail
            : "Unable to save daily log."
        );
      }

      setMessage("Daily health log saved successfully.");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setForm(emptyForm)
    }
  }

  return (
    <section className="panel crew-log-panel">
      <div className="crew-log-header">
        <div>
          <span className="crew-log-eyebrow">
            ASTRA CREW HEALTH
          </span>
          <h2>Daily Health Log</h2>
        </div>

        <Activity size={22} />
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Log Date
          <input
            type="date"
            value={form.log_date}
            onChange={(event) =>
              update("log_date", event.target.value)
            }
            required
          />
        </label>

        <h3>
          <Moon size={18} />
          Sleep & Recovery
        </h3>

        <div className="crew-log-grid">
          <label>
            Sleep Duration (hours)
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={form.sleep_hours}
              onChange={(event) =>
                update("sleep_hours", event.target.value)
              }
              required
            />
          </label>

          <label>
            Sleep Quality
            <select
              value={form.sleep_quality}
              onChange={(event) =>
                update("sleep_quality", event.target.value)
              }
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </label>
        </div>

        <h3>
          <Dumbbell size={18} />
          Exercise & Conditioning
        </h3>

        <div className="crew-log-grid">
          <label>
            Exercise Duration (hours)
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={form.exercise_hours}
              onChange={(event) =>
                update("exercise_hours", event.target.value)
              }
              required
            />
          </label>

          <label>
            Exercise Type
            <select
              value={form.exercise_type}
              onChange={(event) =>
                update("exercise_type", event.target.value)
              }
            >
              <option value="aerobic">Aerobic</option>
              <option value="resistance">Resistance</option>
              <option value="mixed">Combined</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>

        <h3>
          <Activity size={18} />
          Fatigue & Workload
        </h3>

        <div className="crew-log-grid">
          <label>
            Fatigue Level (1–5)
            <select
              value={form.fatigue_level}
              onChange={(event) =>
                update("fatigue_level", Number(event.target.value))
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label>
            Workload
            <select
              value={form.workload}
              onChange={(event) =>
                update("workload", event.target.value)
              }
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label>
          Mission Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) =>
              update("notes", event.target.value)
            }
            placeholder="Exercise session, sleep interruptions, symptoms..."
          />
        </label>

        {message && (
          <p className="crew-log-success">{message}</p>
        )}

        {error && (
          <p className="crew-log-error">{error}</p>
        )}

        <button
          type="submit"
          className="crew-log-submit"
          disabled={saving}
        >
          <Save size={17} />
          {saving ? "Saving..." : "Save Daily Health Log"}
        </button>
      </form>
    </section>
  );
}
