
import { useCallback, useEffect, useState } from "react";
import {
    Activity,
    CalendarDays,
    ClipboardCheck,
    ShieldCheck,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    ArrowRight,
    Orbit,
    HeartPulse,
    Moon,
    Brain,
    Footprints,
    FileHeart,
    Info,
} from "lucide-react";

import { getMissionReadiness } from "../../api/astraApi";
import FitnessRequirements from "./FitnessRequirements";
import "./MissionReadiness.css";

function formatStatus(value) {
    return String(value || "NOT_ASSESSED").replaceAll("_", " ");
}

function StatusPill({ status }) {
    const normalized = String(status || "INSUFFICIENT_DATA");

    const type =
        normalized === "NO_FLAGS_DETECTED" ||
            normalized === "ALL_CHECKS_MET"
            ? "good"
            : normalized === "REVIEW_RECOMMENDED" ||
                normalized === "MEDICAL_REVIEW_RECOMMENDED"
                ? "warning"
                : "neutral";

    return (
        <span className={`mr-status mr-status--${type}`}>
            <span className="mr-status-dot" />
            {formatStatus(normalized)}
        </span>
    );
}

function SummaryCard({
    icon: Icon,
    label,
    value,
    detail,
    tone = "cyan",
}) {
    return (
        <div className={`mr-summary-card mr-summary-card--${tone}`}>
            <div className="mr-summary-top">
                <span className="mr-summary-label">{label}</span>
                <span className="mr-summary-icon">
                    <Icon size={18} />
                </span>
            </div>

            <div className="mr-summary-value">{value}</div>
            <div className="mr-summary-detail">{detail}</div>
        </div>
    );
}

function SectionHeader({ icon: Icon, eyebrow, title }) {
    return (
        <div className="mr-section-header">
            <div className="mr-section-icon">
                <Icon size={19} />
            </div>

            <div>
                <span className="mr-eyebrow">{eyebrow}</span>
                <h3>{title}</h3>
            </div>
        </div>
    );
}

function QuestionnaireMetric({ icon: Icon, label, value, alert }) {
    return (
        <div
            className={`mr-questionnaire-metric ${alert ? "mr-questionnaire-metric--alert" : ""
                }`}
        >
            <div className="mr-questionnaire-metric-heading">
                <Icon size={17} />
                <span>{label}</span>
            </div>

            <strong>{value || "Not recorded"}</strong>
        </div>
    );
}

function QuestionnaireReview({
    review,
    title = "Astronaut Self-Assessment",
    eyebrow = "CREW SELF-REPORT",
}) {
    const record = review?.record;

    const status = review?.status || "NOT_ASSESSED";

    const needsReview = [
        "REVIEW_RECOMMENDED",
        "MEDICAL_REVIEW_RECOMMENDED",
    ].includes(status);

    const medicalReview =
        status === "MEDICAL_REVIEW_RECOMMENDED";

    const symptomsAlert =
        record?.symptoms &&
        record.symptoms !== "No symptoms";

    const sleepAlert = ["Poor", "Very poor"].includes(
        record?.sleep
    );

    const stressAlert = ["High", "Very high"].includes(
        record?.stress
    );

    return (
        <article className="mr-panel mr-questionnaire-panel">
            <div className="mr-panel-heading-row">
                <SectionHeader
                    icon={FileHeart}
                    eyebrow={eyebrow}
                    title={title}
                />

                <StatusPill status={status} />
            </div>

            {!record ? (
                <div className="mr-questionnaire-empty">
                    <ClipboardCheck size={28} />

                    <h4>No self-assessment available</h4>

                    <p>
                        Complete the Astronaut Self-Assessment to record
                        symptoms, sleep quality, stress, and recent activity.
                    </p>
                </div>
            ) : (
                <>
                    <div className="mr-questionnaire-meta">
                        <span>
                            <Clock3 size={14} />
                            {record.measured_at_utc
                                ? new Date(
                                    record.measured_at_utc
                                ).toLocaleString()
                                : "Unknown assessment time"}
                        </span>

                        <span>
                            <Orbit size={14} />
                            {formatStatus(record.assessment_phase)}
                        </span>

                        {Boolean(record.is_synthetic) && (
                            <span className="mr-questionnaire-synthetic">
                                <Info size={14} />
                                Simulated data
                            </span>
                        )}
                    </div>

                    <div className="mr-questionnaire-grid">
                        <QuestionnaireMetric
                            icon={Footprints}
                            label="Recent activity"
                            value={record.activity}
                        />

                        <QuestionnaireMetric
                            icon={HeartPulse}
                            label="Reported symptoms"
                            value={record.symptoms}
                            alert={symptomsAlert}
                        />

                        <QuestionnaireMetric
                            icon={Moon}
                            label="Sleep quality"
                            value={record.sleep}
                            alert={sleepAlert}
                        />

                        <QuestionnaireMetric
                            icon={Brain}
                            label="Stress level"
                            value={record.stress}
                            alert={stressAlert}
                        />
                    </div>

                    {needsReview && (
                        <div
                            className={`mr-questionnaire-alert ${medicalReview
                                ? "mr-questionnaire-alert--medical"
                                : ""
                                }`}
                            role="status"
                        >
                            <AlertTriangle size={20} />

                            <div>
                                <strong>
                                    {medicalReview
                                        ? "Medical review recommended"
                                        : "Follow-up recommended"}
                                </strong>

                                <p>
                                    {medicalReview
                                        ? "The self-assessment contains reported symptoms that warrant review through the crew medical support process."
                                        : "The self-assessment contains indicators that warrant additional review."}
                                </p>
                            </div>
                        </div>
                    )}

                    <h4 className="mr-subheading">
                        Assessment observations
                    </h4>

                    <div className="mr-observation-list">
                        {(review.observations || []).map(
                            (observation, index) => (
                                <div
                                    className="mr-observation"
                                    key={index}
                                >
                                    {needsReview ? (
                                        <AlertTriangle size={17} />
                                    ) : (
                                        <CheckCircle2 size={17} />
                                    )}

                                    <p>{observation}</p>
                                </div>
                            )
                        )}
                    </div>
                </>
            )}

            <h4 className="mr-subheading">
                Recommended follow-up
            </h4>

            <div className="mr-followup-list">
                {(review?.actions || []).map((action, index) => (
                    <div className="mr-followup" key={index}>
                        <Clock3 size={16} />
                        <p>{action}</p>
                    </div>
                ))}
            </div>
        </article>
    );
}

export default function MissionReadiness({
    astronautId = "CREW-001",
    refreshKey = 0,
}) {
    const [endDate, setEndDate] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedMissionType, setSelectedMissionType] =
        useState("");
    const [
        assessmentRefreshKey,
        setAssessmentRefreshKey,
    ] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getMissionReadiness(
                astronautId,
                endDate || null
            );

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [astronautId, endDate]);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    useEffect(() => {
        const refresh = (event) => {
            if (
                event.detail?.astronautId &&
                event.detail.astronautId !== astronautId
            ) {
                return;
            }

            load();

            setAssessmentRefreshKey(
                (previous) => previous + 1
            );
        };

        window.addEventListener(
            "astra:assessment-saved",
            refresh
        );

        return () => {
            window.removeEventListener(
                "astra:assessment-saved",
                refresh
            );
        };
    }, [load, astronautId]);

    const mission = result?.mission;
    const phase = result?.mission_phase;
    const health = result?.health_review;
    const questionnaire = result?.questionnaire_review;
    const latestQuestionnaire =
        result?.latest_questionnaire_review;

    const isDifferentAssessment =
        latestQuestionnaire?.record?.id != null &&
        latestQuestionnaire.record.id !==
        questionnaire?.record?.id;
    const fitness = result?.fitness_readiness;

    const coverage = Math.min(
        100,
        Math.max(0, Number(health?.coverage) || 0)
    );

    const healthNeedsReview =
        health?.status === "REVIEW_RECOMMENDED";

    const questionnaireNeedsReview = [
        "REVIEW_RECOMMENDED",
        "MEDICAL_REVIEW_RECOMMENDED",
    ].includes(questionnaire?.status);

    const overallNeedsReview =
        result?.overall_status === "REVIEW_RECOMMENDED";

    const fitnessCounts = fitness?.counts || {};

    const fitnessMet = fitnessCounts.MET ?? 0;
    const fitnessTotal = fitness?.total_requirements ?? 0;

    const hasSyntheticFitness = Boolean(
        fitness?.includes_synthetic
    );

    const missionType =
        selectedMissionType ||
        mission?.mission_type ||
        result?.mission_type ||
        "MARS_EVA";

    return (
        <section className="mr-page">
            <header className="mr-hero">
                <div className="mr-hero-content">
                    <div className="mr-hero-eyebrow">
                        <Orbit size={14} />
                        ASTRA / MISSION INTELLIGENCE
                    </div>

                    <h1>Mission Readiness</h1>

                    <p>
                        A unified view of crew health, mission-phase
                        guidance, self-assessment findings, and fitness
                        requirement evaluations.
                    </p>

                    <div className="mr-hero-tags">
                        <span>
                            <Activity size={13} />
                            {astronautId}
                        </span>

                        {(mission?.mission_type ||
                            result?.mission_type) && (
                                <span>
                                    <Orbit size={13} />
                                    {formatStatus(
                                        mission?.mission_type ||
                                        result?.mission_type
                                    )}
                                </span>
                            )}

                        <span>
                            <ShieldCheck size={13} />
                            Prototype Decision Support
                        </span>
                    </div>
                </div>

                <div className="mr-hero-actions">
                    <label className="mr-date-field">
                        <span>Mission Type</span>

                        <select
                            className="mr-mission-select"
                            value={selectedMissionType}
                            onChange={(event) =>
                                setSelectedMissionType(event.target.value)
                            }
                        >
                            <option value="">Active Mission</option>
                            <option value="ISS_EVA">
                                ISS — Microgravity EVA
                            </option>
                            <option value="LUNAR_EVA">
                                Moon — Lunar EVA
                            </option>
                            <option value="MARS_EVA">
                                Mars — Surface EVA
                            </option>
                        </select>
                    </label>

                    <label className="mr-date-field">
                        <span>Evaluation date (UTC)</span>

                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) =>
                                setEndDate(event.target.value)
                            }
                        />
                    </label>

                    <button
                        type="button"
                        className="mr-refresh-button"
                        onClick={load}
                        disabled={loading}
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "mr-spin" : ""}
                        />
                        Refresh
                    </button>
                </div>
            </header>

            {error && (
                <div className="mr-error" role="alert">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {loading && !result && (
                <div className="mr-loading">
                    <RefreshCw size={22} className="mr-spin" />
                    Evaluating mission readiness...
                </div>
            )}

            {result && phase && health && (
                <>
                    <div className="mr-overall-banner">
                        <div className="mr-overall-icon">
                            {overallNeedsReview ? (
                                <AlertTriangle size={23} />
                            ) : (
                                <ShieldCheck size={23} />
                            )}
                        </div>

                        <div className="mr-overall-content">
                            <span className="mr-eyebrow">
                                UNIFIED CREW READINESS REVIEW
                            </span>

                            <h3>
                                {formatStatus(result.overall_status)}
                            </h3>

                            <p>
                                {overallNeedsReview
                                    ? "One or more assessment indicators require additional review."
                                    : "No overall clearance determination has been made."}
                            </p>
                        </div>

                        <StatusPill status={result.overall_status} />
                    </div>

                    <div className="mr-summary-grid">
                        <SummaryCard
                            icon={CalendarDays}
                            label={
                                mission?.day_label || "MISSION STATUS"
                            }
                            value={
                                mission
                                    ? String(
                                        mission.day_number ?? 0
                                    ).padStart(3, "0")
                                    : "N/A"
                            }
                            detail={formatStatus(phase.name)}
                            tone="cyan"
                        />

                        <SummaryCard
                            icon={Activity}
                            label="CREW HEALTH REVIEW"
                            value={formatStatus(health.status)}
                            detail={`${health.records_found ?? 0
                                } health logs analyzed`}
                            tone={
                                healthNeedsReview ? "amber" : "blue"
                            }
                        />

                        <SummaryCard
                            icon={ClipboardCheck}
                            label="HEALTH LOG COVERAGE"
                            value={`${coverage}%`}
                            detail={`${health.records_found ?? 0
                                } recorded observations`}
                            tone="violet"
                        />
                    </div>

                    <div className="mr-content-grid">
                        <article className="mr-panel">
                            <SectionHeader
                                icon={Orbit}
                                eyebrow="MISSION OPERATIONS"
                                title="Current Mission Phase"
                            />

                            <div className="mr-phase-banner">
                                <div>
                                    <span>ACTIVE PHASE</span>
                                    <strong>
                                        {formatStatus(phase.name)}
                                    </strong>
                                </div>

                                <ArrowRight size={20} />
                            </div>

                            <p className="mr-panel-description">
                                {phase.focus}
                            </p>

                            <h4 className="mr-subheading">
                                Recommended activities
                            </h4>

                            <div className="mr-action-list">
                                {(phase.actions || []).map(
                                    (action, index) => (
                                        <div
                                            className="mr-action-item"
                                            key={index}
                                        >
                                            <span className="mr-action-number">
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </span>
                                            <p>{action}</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </article>

                        <article className="mr-panel">
                            <div className="mr-panel-heading-row">
                                <SectionHeader
                                    icon={Activity}
                                    eyebrow="CREW MONITORING"
                                    title="Health Assessment"
                                />

                                <StatusPill status={health.status} />
                            </div>

                            <div className="mr-coverage">
                                <div className="mr-coverage-top">
                                    <span>
                                        Daily log completeness
                                    </span>
                                    <strong>{coverage}%</strong>
                                </div>

                                <div className="mr-progress-track">
                                    <div
                                        className="mr-progress-fill"
                                        style={{
                                            width: `${coverage}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <h4 className="mr-subheading">
                                Observations
                            </h4>

                            <div className="mr-observation-list">
                                {(health.observations || []).map(
                                    (observation, index) => (
                                        <div
                                            className="mr-observation"
                                            key={index}
                                        >
                                            {healthNeedsReview ? (
                                                <AlertTriangle size={17} />
                                            ) : (
                                                <CheckCircle2 size={17} />
                                            )}

                                            <p>{observation}</p>
                                        </div>
                                    )
                                )}
                            </div>

                            <h4 className="mr-subheading">
                                Recommended follow-up
                            </h4>

                            <div className="mr-followup-list">
                                {(health.actions || []).map(
                                    (action, index) => (
                                        <div
                                            className="mr-followup"
                                            key={index}
                                        >
                                            <Clock3 size={16} />
                                            <p>{action}</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </article>
                    </div>


                    <div className="mr-questionnaire-section">
                        <div className="mr-assessment-context">
                            <Info size={17} />
                            <p>
                                Mission readiness uses the latest assessment
                                recorded for the selected mission phase:
                                <strong>
                                    {" "}
                                    {formatStatus(result.assessment_phase)}
                                </strong>
                                .
                                {isDifferentAssessment &&
                                    " A newer assessment from another phase is shown separately below."}
                            </p>
                        </div>

                        <div
                            className={`mr-assessment-comparison ${isDifferentAssessment
                                    ? "mr-assessment-comparison--two"
                                    : ""
                                }`}
                        >
                            <QuestionnaireReview
                                review={questionnaire}
                                eyebrow="MISSION-PHASE ASSESSMENT"
                                title={`Latest ${formatStatus(
                                    result.assessment_phase
                                )} Assessment`}
                            />

                            {isDifferentAssessment && (
                                <QuestionnaireReview
                                    review={latestQuestionnaire}
                                    eyebrow="MOST RECENT SELF-REPORT"
                                    title="Latest Overall Assessment"
                                />
                            )}
                        </div>

                        {isDifferentAssessment && (
                            <div className="mr-assessment-context">
                                <Info size={17} />
                                <p>
                                    The latest overall assessment belongs to
                                    the{" "}
                                    <strong>
                                        {formatStatus(
                                            result.latest_questionnaire_phase
                                        )}
                                    </strong>{" "}
                                    phase. It does not replace the active
                                    mission-phase evaluation or automatically
                                    resolve previously reported symptoms.
                                </p>
                            </div>
                        )}
                    </div>


                    <div className="mr-fitness-section">
                        <div className="mr-fitness-heading">
                            <div>
                                <span className="mr-eyebrow">
                                    NASA-STANDARD-ALIGNED RULE EVALUATION
                                </span>

                                <h2>Fitness Requirements</h2>

                                <p>
                                    Review mission-specific aerobic and
                                    strength measurements against configured
                                    requirements.
                                </p>

                                {hasSyntheticFitness && (
                                    <span className="mr-fitness-synthetic">
                                        <Info size={14} />
                                        Evaluation includes simulated evidence
                                    </span>
                                )}
                            </div>

                            <span className="mr-fitness-tag">
                                <ShieldCheck size={15} />
                                {fitnessTotal > 0
                                    ? `${fitnessMet}/${fitnessTotal} checks met`
                                    : "Evidence-based checks"}
                            </span>
                        </div>

                        <FitnessRequirements
                            astronautId={astronautId}
                            missionType={missionType}
                            endDate={endDate}
                            refreshKey={`${refreshKey}-${assessmentRefreshKey}`}
                        />
                    </div>

                    <footer className="mr-disclaimer">
                        <ShieldCheck size={17} />
                        <span>
                            {result.overall_message ||
                                "ASTRA is a prototype decision-support system and does not provide medical or EVA clearance."}
                        </span>
                    </footer>
                </>
            )}
        </section>
    );
}
