
import { useState } from "react";
import {
    Brain,
    HeartPulse,
    Wind,
    Bone,
    Info,
    Activity,
} from "lucide-react";

import ResearchPanel from "./ResearchPanel";
import "./BodyHealthMap.css";

const SYSTEMS = [
    {
        id: "brain",
        label: "Brain & Cognition",
        icon: Brain,
        next: "Review cognitive-state results and consider a fatigue and attention self-assessment.",
    },
    {
        id: "heart",
        label: "Cardiovascular",
        icon: HeartPulse,
        next: "Review recent physical activity and compare heart rate with the personal baseline.",
    },
    {
        id: "lungs",
        label: "Respiratory",
        icon: Wind,
        next: "Check sensor placement and assess breathing symptoms if readings change.",
    },
    {
        id: "bones",
        label: "Musculoskeletal",
        icon: Bone,
        next: "Review exercise and movement history; direct bone and muscle assessments are not connected yet.",
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
        lungs: [
            "respiration_rate",
            "oxygen_saturation",
        ],
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

export default function BodyHealthMap({ health, cognitive }) {
    const [selected, setSelected] = useState("heart");

    const system = SYSTEMS.find((item) => item.id === selected);
    const Icon = system.icon;

    const metrics = health?.metrics || {};
    const systemStatuses = {
        brain: "UNAVAILABLE",
        heart: getSystemStatus('heart', metrics),
        lungs: getSystemStatus("lungs", metrics),
        bones: "UNAVAILABLE",
    };

    const details = {
        brain: {
            title: "Cognitive state",
            value: cognitive?.prediction
                ? formatState(cognitive.prediction.state)
                : "Not analyzed",

            note: cognitive?.prediction
                ? `NASA pilot-recording demonstration. Model score: ${cognitive.prediction.confidence}%. This is not a diagnosis.`
                : "Run a NASA cognitive scenario to see a prediction. This is not live astronaut brain monitoring.",
        },

        heart: {
            title: "Heart rate",
            value: metricSummary(metrics.heart_rate, "bpm"),

            note: "Simulated telemetry. Compare readings with activity and a personal baseline. These values cannot diagnose cardiovascular disease.",
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

            note: "Simulated telemetry. These measurements are indicators, not a complete respiratory assessment.",
        },

        bones: {
            title: "Bone and muscle condition",
            value: "Not measured",

            note: "ASTRA currently has no bone-density or muscle-strength measurements. Status cannot be determined from these signals.",
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
                        {/* Human body outline */}
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

                        {/* Skeleton structure */}
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

                        {/* Brain */}
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

                        {/* Lungs */}
                        <g
                            className={`body-region ${selected === "lungs" ? "selected" : ""
                                } ${systemStatuses.lungs}`}
                            fill="#4b8295"
                        >
                            <path d="M115 111 Q99 104 95 127 L94 157 Q107 164 115 146Z" />
                            <path d="M125 111 Q141 104 145 127 L146 157 Q133 164 125 146Z" />
                        </g>

                        {/* Heart */}
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

                        {/* Bones */}
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

                        {/* Clickable regions */}
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
                        <div className={`body-status-badge ${systemStatuses[selected]}`}>
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
