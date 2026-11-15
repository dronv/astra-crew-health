
import { useEffect, useState } from "react";
import {
    Brain,
    HeartPulse,
    Wind,
    Bone,
    Info,
    Activity,
} from "lucide-react";
import { evaluateCognitiveReadiness } from "../utils/cognitiveReadiness";
import ResearchPanel from "./ResearchPanel";
import "./BodyHealthMap.css";

const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SYSTEMS = [
    {
        id: "brain",
        label: "Brain & Cognition",
        icon: Brain,
        next:
            "Review sleep, fatigue, workload and reported symptoms. Consult crew medical support for concerning symptoms.",
    },
    {
        id: "heart",
        label: "Cardiovascular",
        icon: HeartPulse,
        next:
            "Review recent physical activity and compare heart rate with the personal baseline.",
    },
    {
        id: "lungs",
        label: "Respiratory",
        icon: Wind,
        next:
            "Check sensor placement and assess breathing symptoms if readings change.",
    },
    {
        id: "bones",
        label: "Musculoskeletal",
        icon: Bone,
        next:
            "Review recent exercise adherence, including resistance and cardiovascular training. Consult the crew exercise protocol if the target is not being met.",
    },
];

function formatState(value) {
    return String(value || "NOT ANALYZED").replaceAll("_", " ");
}

function metricSummary(metric, unit) {
    if (!metric || typeof metric !== "object") {
        return "No reading available";
    }

    const value =
        metric.value ?? metric.current ?? metric.current_value;

    if (value == null) {
        return "Reading unavailable";
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return "Reading unavailable";
    }

    return `${numericValue.toFixed(1)} ${unit}`.trim();
}

function getMetricStatus(metric) {
    if (!metric) return "UNAVAILABLE";

    return metric.status || "UNAVAILABLE";
}

function getSystemStatus(systemId, metrics) {
    const systemMetrics = {
        heart: ["heart_rate"],
        lungs: ["respiration_rate", "oxygen_saturation"],
    };

    const fields = systemMetrics[systemId];

    if (!fields) return "UNAVAILABLE";

    const statuses = fields.map((field) =>
        getMetricStatus(metrics[field])
    );

    if (statuses.includes("ACTION")) {
        return "ACTION";
    }

    if (statuses.includes("ATTENTION")) {
        return "ATTENTION";
    }

    if (statuses.includes("UNAVAILABLE")) {
        return "UNAVAILABLE";
    }

    return "NORMAL";
}

function formatMinutes(value) {
    if (value == null || !Number.isFinite(Number(value))) {
        return "—";
    }

    return `${Number(value).toFixed(1)} min`;
}

function MusculoskeletalDetails({ data, loading, error }) {
    if (loading) {
        return (
            <p role="status">
                Loading recent exercise history...
            </p>
        );
    }

    if (error) {
        return (
            <p role="alert">
                Exercise history could not be loaded: {error}
            </p>
        );
    }

    if (!data) {
        return (
            <p>
                No exercise assessment is available.
            </p>
        );
    }

    const adherence = Number.isFinite(
        Number(data.adherence_percent)
    ) && data.adherence_percent != null
        ? Number(data.adherence_percent)
        : 0;

    const progress = Math.min(
        100,
        Math.max(0, adherence)
    );

    return (
        <div className="body-musculoskeletal">
            <div className="body-exercise-stats">
                <div className="body-exercise-stat">
                    <span>Daily average</span>
                    <strong>
                        {formatMinutes(data.average_minutes)}
                    </strong>
                </div>

                <div className="body-exercise-stat">
                    <span>Daily target</span>
                    <strong>
                        {data.target_minutes} min
                    </strong>
                </div>

                <div className="body-exercise-stat">
                    <span>Target adherence</span>
                    <strong>
                        {data.adherence_percent != null
                            ? `${adherence.toFixed(1)}%`
                            : "—"}
                    </strong>
                </div>

                <div className="body-exercise-stat">
                    <span>Days below target</span>
                    <strong>
                        {data.days_below_target} / {data.days}
                    </strong>
                </div>
            </div>

            <div className="body-exercise-progress">
                <div className="body-exercise-progress-heading">
                    <span>Exercise adherence</span>
                    <strong>
                        {data.adherence_percent != null
                            ? `${adherence.toFixed(1)}%`
                            : "No data"}
                    </strong>
                </div>

                <div
                    className="body-exercise-progress-track"
                    role="progressbar"
                    aria-label="Exercise target adherence"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                        data.adherence_percent != null
                            ? progress
                            : undefined
                    }
                >
                    <div
                        className={`body-exercise-progress-fill ${data.status}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="body-exercise-days">
                <span className="body-detail-label">
                    Recent exercise history
                </span>

                {data.daily?.map((day) => (
                    <div
                        className="body-exercise-day"
                        key={day.date}
                    >
                        <span>{day.date}</span>

                        <span>
                            {day.recorded
                                ? formatMinutes(day.exercise_minutes)
                                : "Missing log"}
                        </span>

                        <span>
                            {!day.recorded
                                ? "UNAVAILABLE"
                                : day.meets_target
                                    ? "TARGET MET"
                                    : "BELOW TARGET"}
                        </span>
                    </div>
                ))}
            </div>

            <p>{data.message}</p>

            {data.missing_days > 0 && (
                <p>
                    {data.missing_days} daily exercise
                    {data.missing_days === 1 ? " log is" : " logs are"}
                    {" "}missing from this assessment window.
                </p>
            )}

            {data.synthetic && (
                <p>
                    This assessment uses synthetic demonstration
                    exercise records.
                </p>
            )}

            <div className="body-exercise-science">
                <strong>Microgravity and bone health</strong>

                <p>
                    In microgravity, weight-bearing bones may lose
                    approximately 1–2% of bone mineral density per
                    month without adequate countermeasures.
                    Resistance and cardiovascular exercise are
                    important parts of spaceflight health programs.
                </p>

                <p>
                    This assessment evaluates exercise duration only.
                    It does not measure bone density, muscle strength,
                    or actual bone loss.
                </p>
            </div>
        </div>
    );
}

export default function BodyHealthMap({
    health,
    astronautId = "CREW-001",
}) {
    const [selected, setSelected] = useState("heart");
    const [musculoskeletal, setMusculoskeletal] = useState(null);
    const [exerciseLoading, setExerciseLoading] = useState(true);
    const [exerciseError, setExerciseError] = useState(null);
    const [cognitive, setCognitive] = useState(null);
    const [latestAssessment, setLatestAssessment] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchExercise() {
            setExerciseLoading(true);
            setExerciseError(null);
            setMusculoskeletal(null);

            try {
                const response = await fetch(
                    `${API_BASE}/api/crew/daily-log/${encodeURIComponent(
                        astronautId
                    )}?limit=30`,
                    {
                        signal: controller.signal,
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to retrieve exercise logs: ${response.status}`
                    );
                }

                const result = await response.json();
                const logs = result.logs || [];

                const days = 3;
                const targetMinutes = 120;

                const today = new Date();
                const todayUTC = new Date(
                    Date.UTC(
                        today.getUTCFullYear(),
                        today.getUTCMonth(),
                        today.getUTCDate()
                    )
                );

                const daily = [];

                for (let offset = days - 1; offset >= 0; offset--) {
                    const currentDate = new Date(todayUTC);

                    currentDate.setUTCDate(
                        currentDate.getUTCDate() - offset
                    );

                    const dateKey = currentDate
                        .toISOString()
                        .slice(0, 10);

                    const log = logs.find(
                        (item) => item.log_date === dateKey
                    );

                    const hours =
                        log?.exercise_hours == null
                            ? null
                            : Number(log.exercise_hours);

                    const validHours =
                        hours !== null &&
                        Number.isFinite(hours) &&
                        hours >= 0 &&
                        hours <= 24;

                    const minutes = validHours
                        ? Math.round(hours * 60 * 10) / 10
                        : null;

                    daily.push({
                        date: dateKey,
                        recorded: minutes !== null,
                        exercise_minutes: minutes,
                        exercise_type:
                            minutes !== null
                                ? log.exercise_type
                                : null,
                        meets_target:
                            minutes === null
                                ? null
                                : minutes >= targetMinutes,
                    });
                }

                const recorded = daily.filter(
                    (day) => day.recorded
                );

                const recordedDays = recorded.length;
                const missingDays = days - recordedDays;

                const averageMinutes = recordedDays
                    ? recorded.reduce(
                        (sum, day) =>
                            sum + day.exercise_minutes,
                        0
                    ) / recordedDays
                    : null;

                const average =
                    averageMinutes === null
                        ? null
                        : Math.round(averageMinutes * 10) / 10;

                const adherencePercent =
                    average === null
                        ? null
                        : Math.round(
                            (average / targetMinutes) * 1000
                        ) / 10;

                const daysBelowTarget = recorded.filter(
                    (day) => !day.meets_target
                ).length;

                let status = "UNAVAILABLE";
                let message =
                    "Exercise records are incomplete.";

                if (missingDays === 0) {
                    if (average < 60) {
                        status = "ACTION";
                        message =
                            "Recent exercise duration is substantially below the configured daily target.";
                    } else if (average < targetMinutes) {
                        status = "ATTENTION";
                        message =
                            "Recent exercise duration is below the configured daily target.";
                    } else {
                        status = "NORMAL";
                        message =
                            "Average exercise duration meets the configured daily target.";
                    }
                }

                const assessment = {
                    astronaut_id: astronautId,
                    status,
                    days,
                    recorded_days: recordedDays,
                    missing_days: missingDays,
                    average_minutes: average,
                    target_minutes: targetMinutes,
                    adherence_percent: adherencePercent,
                    days_below_target: daysBelowTarget,
                    daily,
                    message,
                    bone_density_measured: false,
                    assessment_type: "exercise_adherence",
                    synthetic: recorded.some((day) => {
                        const log = logs.find(
                            (item) => item.log_date === day.date
                        );

                        return (log?.notes || "").includes(
                            "[SYNTHETIC DEMO]"
                        );
                    }),
                };

                if (!controller.signal.aborted) {
                    setMusculoskeletal(assessment);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setExerciseError(error.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setExerciseLoading(false);
                }
            }
        }

        fetchExercise();

        return () => controller.abort();
    }, [astronautId]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadCognitiveReadiness() {
            try {
                const [dailyResponse, assessmentResponse] =
                    await Promise.all([
                        fetch(
                            `${API_BASE}/api/crew/daily-log/${encodeURIComponent(astronautId)}?limit=30`,
                            { signal: controller.signal }
                        ),
                        fetch(
                            `${API_BASE}/api/assessment/${encodeURIComponent(astronautId)}/latest?include_synthetic=true`,
                            { signal: controller.signal }
                        ),
                    ]);

                if (!dailyResponse.ok || !assessmentResponse.ok) {
                    throw new Error("Unable to load crew assessment");
                }

                const dailyData = await dailyResponse.json();
                const assessmentData = await assessmentResponse.json();

                const latestLog = [...(dailyData.logs || [])]
                    .sort((a, b) =>
                        String(b.log_date).localeCompare(String(a.log_date))
                    )[0] || null;

                if (!controller.signal.aborted) {
                    setLatestAssessment(assessmentData);

                    setCognitive(
                        evaluateCognitiveReadiness(
                            latestLog,
                            assessmentData
                        )
                    );
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setCognitive({
                        status: "UNAVAILABLE",
                        reason: "Unable to retrieve assessment",
                        indicators: {},
                    });
                }
            }
        }

        loadCognitiveReadiness();

        const refresh = () => loadCognitiveReadiness();

        window.addEventListener("astra:assessment-saved", refresh);

        return () => {
            controller.abort();
            window.removeEventListener("astra:assessment-saved", refresh);
        };
    }, [astronautId]);

    const system = SYSTEMS.find(
        (item) => item.id === selected
    );

    const Icon = system.icon;
    const metrics = health?.metrics || {};

    const systemStatuses = {
        brain: cognitive?.status || "UNAVAILABLE",
        heart: getSystemStatus("heart", metrics),
        lungs: getSystemStatus("lungs", metrics),
        bones:
            exerciseLoading || exerciseError
                ? "UNAVAILABLE"
                : musculoskeletal?.status || "UNAVAILABLE",
    };

    const details = {
        brain: {
            title: "Sleep, Fatigue & Cognitive Readiness",

            value:
                cognitive?.status === "UNAVAILABLE"
                    ? "Assessment unavailable"
                    : `Fatigue ${cognitive?.indicators?.fatigue_level ?? "—"
                    }/5 · Sleep ${cognitive?.indicators?.sleep_hours ?? "—"
                    } hrs`,

            note:
                cognitive?.reason ||
                "Awaiting daily health observations.",
        },

        heart: {
            title: "Heart rate",
            value: metricSummary(
                metrics.heart_rate,
                "bpm"
            ),
            note:
                "Simulated telemetry. Compare readings with activity and a personal baseline. These values cannot diagnose cardiovascular disease.",
        },

        lungs: {
            title: "Oxygen saturation / respiration",
            value: `${metricSummary(
                metrics.oxygen_saturation,
                "%"
            )} · ${metricSummary(
                metrics.respiration_rate,
                "breaths/min"
            )}`,
            note:
                "Simulated telemetry. These measurements are indicators, not a complete respiratory assessment.",
        },

        bones: {
            title: "3-day average daily exercise",
            value:
                musculoskeletal?.average_minutes != null
                    ? `${musculoskeletal.average_minutes} min/day`
                    : "Exercise data unavailable",
            note:
                "Exercise adherence is an indirect countermeasure indicator, not a direct measurement of bone or muscle condition.",
        },
    };

    const detail = details[selected];

    return (
        <section
            className="panel body-health-panel"
            aria-label="Interactive body health map"
        >
            <div className="panel-header">
                <div>
                    <span className="eyebrow">
                        BODY SYSTEM EXPLORER
                    </span>

                    <h2>Interactive Health Map</h2>
                </div>

                <Activity size={20} aria-hidden="true" />
            </div>

            <div className="body-health-layout">
                <div className="body-map-figure">
                    <svg
                        viewBox="0 0 240 380"
                        role="group"
                        aria-label="Interactive human body diagram"
                    >
                        <g
                            className="body-outline"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="120" cy="43" r="27" />

                            <path
                                d="M104 69 L100 83 L76 89
                L53 173 L66 179 L89 119
                L91 229 L83 350 L104 354
                L120 251 L136 354 L157 350
                L149 229 L151 119 L174 179
                L187 173 L164 89 L140 83
                L136 69"
                            />

                            <path d="M91 229 Q120 240 149 229" />
                        </g>

                        <g
                            className="body-structure"
                            fill="none"
                            strokeLinecap="round"
                        >
                            <path
                                d="M120 91 V220
                M95 129 H145
                M98 151 H142
                M101 173 H139
                M104 195 H136"
                            />
                        </g>

                        <g
                            className={`body-region ${selected === "brain" ? "selected" : ""
                                } ${systemStatuses.brain}`}
                        >
                            <ellipse
                                cx="120"
                                cy="40"
                                rx="17"
                                ry="13"
                                fill="#3c94aa"
                            />
                        </g>

                        <g
                            className={`body-region ${selected === "lungs" ? "selected" : ""
                                } ${systemStatuses.lungs}`}
                            fill="#4b8295"
                        >
                            <path d="M115 111 Q99 104 95 127 L94 157 Q107 164 115 146Z" />
                            <path d="M125 111 Q141 104 145 127 L146 157 Q133 164 125 146Z" />
                        </g>

                        <g
                            className={`body-region ${selected === "heart" ? "selected" : ""
                                } ${systemStatuses.heart}`}
                            fill="#df788a"
                        >
                            <path
                                d="M121 137
                C109 124 101 137 106 146
                L121 161 L136 146
                C141 137 133 124 121 137Z"
                            />
                        </g>

                        <g
                            className={`body-region ${selected === "bones" ? "selected" : ""
                                } ${systemStatuses.bones}`}
                            fill="none"
                            stroke="#b7a47c"
                            strokeWidth="6"
                            strokeLinecap="round"
                        >
                            <path
                                d="M107 253 L97 334
                M133 253 L143 334
                M80 105 L63 164
                M160 105 L177 164"
                            />
                        </g>

                        {[
                            { id: "brain", x: 120, y: 40, r: 26 },
                            { id: "lungs", x: 120, y: 124, r: 30 },
                            { id: "heart", x: 121, y: 144, r: 18 },
                            { id: "bones", x: 120, y: 280, r: 38 },
                        ].map((region) => (
                            <circle
                                key={region.id}
                                className="body-hit-area"
                                cx={region.x}
                                cy={region.y}
                                r={region.r}
                                tabIndex={0}
                                role="button"
                                aria-label={`Select ${SYSTEMS.find(
                                    (item) => item.id === region.id
                                ).label
                                    }`}
                                aria-pressed={selected === region.id}
                                onClick={() => setSelected(region.id)}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                    ) {
                                        event.preventDefault();
                                        setSelected(region.id);
                                    }
                                }}
                            />
                        ))}
                    </svg>

                    <p className="body-map-hint">
                        Select a body region or a system below
                    </p>
                </div>

                <div className="body-map-details">
                    <div
                        className="body-system-tabs"
                        aria-label="Body systems"
                    >
                        {SYSTEMS.map((item) => {
                            const ItemIcon = item.icon;

                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    className={`body-system-tab ${selected === item.id ? "active" : ""
                                        }`}
                                    onClick={() => setSelected(item.id)}
                                    aria-pressed={selected === item.id}
                                >
                                    <ItemIcon
                                        size={17}
                                        aria-hidden="true"
                                    />

                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className="body-system-detail"
                        aria-live="polite"
                    >
                        <div className="body-detail-heading">
                            <Icon size={21} aria-hidden="true" />
                            <h3>{system.label}</h3>
                        </div>

                        <div
                            className={`body-status-badge ${systemStatuses[selected]
                                }`}
                        >
                            {systemStatuses[selected] === "UNAVAILABLE"
                                ? "NOT MONITORED"
                                : systemStatuses[selected]}
                        </div>

                        <span className="body-detail-label">
                            {detail.title}
                        </span>

                        <strong className="body-detail-value">
                            {detail.value}
                        </strong>

                        <p>{detail.note}</p>

                        {selected === "bones" && (
                            <MusculoskeletalDetails
                                data={musculoskeletal}
                                loading={exerciseLoading}
                                error={exerciseError}
                            />
                        )}

                        <div className="body-next-step">
                            <Info size={17} aria-hidden="true" />

                            <div>
                                <strong>Suggested next step</strong>
                                <p>{system.next}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ResearchPanel systemId={selected} />

            <p className="body-map-disclaimer">
                Prototype decision-support interface.
                Simulated telemetry and recorded NASA pilot data
                are separate sources. No medical diagnosis is provided.
            </p>
        </section>
    );
}
