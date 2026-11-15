
import { useState } from "react";
import {
  ClipboardList,
  Activity,
  CheckCircle2,
  AlertTriangle,
  X,
  HeartPulse,
  Dumbbell,
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react";

import "./AstronautSelfAssessment.css";

import {
  saveAstronautAssessment,
} from "../api/astraApi";

const ASTRONAUT_ID = "CREW-001";

const QUESTIONS = [
  {
    id: "activity",
    title: "Recent Physical Activity",
    question: "What were you doing before this assessment?",
    options: [
      "Resting",
      "Light activity",
      "Exercise",
      "High-intensity workload",
    ],
  },
  {
    id: "symptoms",
    title: "Current Symptoms",
    question: "Are you experiencing any symptoms?",
    options: [
      "No symptoms",
      "Unusual fatigue",
      "Dizziness",
      "Breathing discomfort",
      "Other discomfort",
    ],
  },
  {
    id: "sleep",
    title: "Sleep Quality",
    question: "How would you describe your last sleep period?",
    options: [
      "Good",
      "Fair",
      "Poor",
      "Very poor",
    ],
  },
  {
    id: "stress",
    title: "Perceived Workload",
    question: "How demanding is your current workload?",
    options: [
      "Low",
      "Moderate",
      "High",
      "Very high",
    ],
  },
];

const INITIAL_HEALTH = {
  sleep_hours: "",
  exercise_hours: "",
  exercise_type: "none",
  fatigue_level: 2,
  systolic_bp: "",
  diastolic_bp: "",
  blood_glucose_mg_dl: "",
  mood: 3,
};

const INITIAL_FITNESS = {
  vo2max: "",
  premission_vo2max: "",
  deadlift_kg: "",
  bench_press_kg: "",
  bodyweight_kg: "",
  muscle_strength: "",
  premission_muscle_strength: "",
};

function numberOrNull(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function assessResponses(answers, health) {
  const metrics = health?.metrics || {};

  const telemetryFlags = Object.values(metrics).some(
    (metric) =>
      metric?.status === "ATTENTION" ||
      metric?.status === "ACTION"
  );

  const symptomsReported = [
    "Dizziness",
    "Breathing discomfort",
    "Other discomfort",
  ].includes(answers.symptoms);

  const fatigue =
    answers.symptoms === "Unusual fatigue";

  const poorSleep = [
    "Poor",
    "Very poor",
  ].includes(answers.sleep);

  const highWorkload = [
    "High",
    "Very high",
  ].includes(answers.stress);

  const exercise = [
    "Exercise",
    "High-intensity workload",
  ].includes(answers.activity);

  const observations = [];
  const recommendations = [];

  if (telemetryFlags) {
    observations.push(
      "One or more monitored physiological values differ from the prototype baseline."
    );
  }

  if (exercise) {
    observations.push(
      "Recent physical activity may help explain physiological changes."
    );
  }

  if (fatigue || poorSleep) {
    observations.push(
      "Reported fatigue or poor sleep may affect perceived readiness."
    );
  }

  if (highWorkload) {
    observations.push(
      "The astronaut reports elevated workload."
    );
  }

  if (symptomsReported) {
    recommendations.push(
      "Report symptoms through the designated crew medical support process."
    );
  }

  if (telemetryFlags) {
    recommendations.push(
      "Verify sensor readings and review physiological trends."
    );
  }

  if (poorSleep || fatigue || highWorkload) {
    recommendations.push(
      "Review rest, fatigue, and workload with crew support."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue routine monitoring and scheduled assessments."
    );
  }

  return {
    priority: symptomsReported
      ? "MEDICAL REVIEW"
      : telemetryFlags ||
          fatigue ||
          poorSleep ||
          highWorkload
        ? "REVIEW"
        : "ROUTINE",
    observations:
      observations.length > 0
        ? observations
        : ["No additional questionnaire concerns identified."],
    recommendations,
  };
}

function Field({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  placeholder = "Optional",
}) {
  return (
    <label className="assessment-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

export default function AstronautSelfAssessment({
  health,
  onClose,
  onSaved,
  astronautId = ASTRONAUT_ID,
  missionType = "MARS_EVA",
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [healthForm, setHealthForm] = useState(
    INITIAL_HEALTH
  );
  const [fitnessForm, setFitnessForm] = useState(
    INITIAL_FITNESS
  );

  const [assessmentPhase, setAssessmentPhase] =
    useState("in_mission");

  const [logDate, setLogDate] = useState(todayUTC());

  const [isSynthetic, setIsSynthetic] =
    useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const question = QUESTIONS[step];

  const questionnaireComplete =
    step >= QUESTIONS.length;

  const isComplete = result !== null;

  function updateHealth(field, value) {
    setHealthForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateFitness(field, value) {
    setFitnessForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function selectAnswer(value) {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: value,
    }));
  }

  function next() {
    if (!answers[question.id]) return;

    setStep((previous) => previous + 1);
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setHealthForm({ ...INITIAL_HEALTH });
    setFitnessForm({ ...INITIAL_FITNESS });
    setResult(null);
    setError("");
  }

  function buildHealthObservations() {
    const observations = [];

    const add = (metric, value) => {
      const number = numberOrNull(value);

      if (number !== null) {
        observations.push({
          metric,
          value: number,
        });
      }
    };

    add(
      "systolic_bp",
      healthForm.systolic_bp
    );

    add(
      "diastolic_bp",
      healthForm.diastolic_bp
    );

    add(
      "blood_glucose_mg_dl",
      healthForm.blood_glucose_mg_dl
    );

    const stressScore = {
      Low: 1,
      Moderate: 2,
      High: 4,
      "Very high": 5,
    };

    add(
      "stress",
      stressScore[answers.stress]
    );

    add(
      "mood",
      healthForm.mood
    );

    return observations;
  }

  function buildFitness() {
    const measurements = {};

    for (const [field, value] of Object.entries(
      fitnessForm
    )) {
      if (
        assessmentPhase !== "pre_mission" &&
        [
          "premission_vo2max",
          "premission_muscle_strength",
        ].includes(field)
      ) {
        continue;
      }

      measurements[field] = numberOrNull(value);
    }

    const hasValues = Object.values(
      measurements
    ).some((value) => value !== null);

    if (!hasValues) return null;

    return {
      astronaut_id: astronautId,
      mission_id: null,
      assessment_phase: assessmentPhase,
      is_synthetic: isSynthetic,
      ...measurements,
      notes: "ASTRA astronaut self-assessment",
    };
  }

  function buildDailyLog() {
    const sleepHours = numberOrNull(
      healthForm.sleep_hours
    );

    const exerciseHours = numberOrNull(
      healthForm.exercise_hours
    );

    // DailyLog requires both durations.
    // If either is missing, do not create a partial log.
    if (
      sleepHours === null ||
      exerciseHours === null
    ) {
      return null;
    }

    const sleepQuality = {
      Good: "good",
      Fair: "fair",
      Poor: "poor",
      "Very poor": "poor",
    };

    const workload = {
      Low: "low",
      Moderate: "moderate",
      High: "high",
      "Very high": "high",
    };

    const exerciseType =
      exerciseHours === 0
        ? "none"
        : healthForm.exercise_type === "none"
          ? "mixed"
          : healthForm.exercise_type;

    return {
      astronaut_id: astronautId,
      log_date: logDate,
      sleep_hours: sleepHours,
      sleep_quality:
        sleepQuality[answers.sleep] || "fair",
      exercise_hours: exerciseHours,
      exercise_type: exerciseType,
      fatigue_level: Number(
        healthForm.fatigue_level
      ),
      workload:
        workload[answers.stress] || "moderate",
      notes: [
        `Recent activity: ${answers.activity}`,
        `Symptoms: ${answers.symptoms}`,
        `Sleep report: ${answers.sleep}`,
        `Workload report: ${answers.stress}`,
        "Recorded through ASTRA Self-Assessment",
      ].join("; "),
    };
  }

  async function submitAssessment() {
    setSaving(true);
    setError("");

    try {
      const dailyLog = buildDailyLog();
      const fitness = buildFitness();
      const observations =
        buildHealthObservations();

      const payload = {
        astronaut_id: astronautId,
        mission_id: null,
        mission_type: missionType,
        assessment_phase: assessmentPhase,
        measured_at_utc:
          new Date().toISOString(),
        is_synthetic: isSynthetic,
        daily_log: dailyLog,
        fitness,
        health_observations: observations,
        questionnaire: answers,
      };

      const response =
        await saveAstronautAssessment(payload);

      const questionnaireResult =
        assessResponses(answers, health);

      setResult({
        ...questionnaireResult,
        readiness:
          response.fitness_readiness,
        saved: response.saved,
      });

      window.dispatchEvent(
        new CustomEvent(
          "astra:assessment-saved",
          {
            detail: {
              astronautId,
              readiness:
                response.fitness_readiness,
            },
          }
        )
      );

      onSaved?.(response);

    } catch (err) {
      setError(
        err.message ||
        "Unable to save assessment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="assessment-overlay">
      <section
        className="assessment-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Astronaut self-assessment"
      >
        <div className="assessment-header">
          <div>
            <span className="assessment-eyebrow">
              ASTRA CREW HEALTH
            </span>

            <h2>
              <ClipboardList size={21} />
              Astronaut Self-Assessment
            </h2>
          </div>

          <button
            type="button"
            className="assessment-close"
            onClick={onClose}
            aria-label="Close assessment"
          >
            <X size={20} />
          </button>
        </div>

        {!questionnaireComplete && !isComplete && (
          <>
            <div className="assessment-progress">
              <span>
                Question {step + 1} of{" "}
                {QUESTIONS.length}
              </span>

              <div className="assessment-progress-track">
                <div
                  style={{
                    width: `${
                      ((step + 1) /
                        QUESTIONS.length) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="assessment-question">
              <span className="assessment-eyebrow">
                {question.title}
              </span>

              <h3>{question.question}</h3>

              <div className="assessment-options">
                {question.options.map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        answers[question.id] ===
                        option
                          ? "assessment-option selected"
                          : "assessment-option"
                      }
                      onClick={() =>
                        selectAnswer(option)
                      }
                    >
                      <span>{option}</span>

                      {answers[
                        question.id
                      ] === option && (
                        <CheckCircle2
                          size={18}
                        />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="assessment-actions">
              <button
                type="button"
                disabled={step === 0}
                onClick={() =>
                  setStep(
                    (previous) =>
                      previous - 1
                  )
                }
                className="assessment-secondary"
              >
                <ArrowLeft size={15} />
                Back
              </button>

              <button
                type="button"
                disabled={
                  !answers[question.id]
                }
                onClick={next}
                className="assessment-primary"
              >
                {step ===
                QUESTIONS.length - 1
                  ? "Continue to Measurements"
                  : "Continue"}
              </button>
            </div>
          </>
        )}

        {questionnaireComplete && !isComplete && (
          <div className="assessment-measurements">
            <div className="assessment-progress">
              <span>
                Health & Fitness Measurements
              </span>
            </div>

            <div className="assessment-field-grid">
              <label className="assessment-field">
                <span>
                  Assessment Phase
                </span>

                <select
                  value={assessmentPhase}
                  onChange={(event) =>
                    setAssessmentPhase(
                      event.target.value
                    )
                  }
                >
                  <option value="pre_mission">
                    Pre-Mission
                  </option>
                  <option value="in_mission">
                    In-Mission
                  </option>
                </select>
              </label>

              <label className="assessment-field">
                <span>Log Date (UTC)</span>

                <input
                  type="date"
                  value={logDate}
                  onChange={(event) =>
                    setLogDate(
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <h3>
              <HeartPulse size={18} />
              Daily Health
            </h3>

            <div className="assessment-field-grid">
              <Field
                label="Sleep Hours"
                value={
                  healthForm.sleep_hours
                }
                max={24}
                onChange={(value) =>
                  updateHealth(
                    "sleep_hours",
                    value
                  )
                }
              />

              <Field
                label="Exercise Hours"
                value={
                  healthForm.exercise_hours
                }
                max={24}
                onChange={(value) =>
                  updateHealth(
                    "exercise_hours",
                    value
                  )
                }
              />

              <label className="assessment-field">
                <span>Exercise Type</span>

                <select
                  value={
                    healthForm.exercise_type
                  }
                  onChange={(event) =>
                    updateHealth(
                      "exercise_type",
                      event.target.value
                    )
                  }
                >
                  <option value="none">
                    None
                  </option>
                  <option value="aerobic">
                    Aerobic
                  </option>
                  <option value="resistance">
                    Resistance
                  </option>
                  <option value="mixed">
                    Mixed
                  </option>
                </select>
              </label>

              <Field
                label="Fatigue Level (1-5)"
                value={
                  healthForm.fatigue_level
                }
                min={1}
                max={5}
                step={1}
                onChange={(value) =>
                  updateHealth(
                    "fatigue_level",
                    value
                  )
                }
              />

              <Field
                label="Systolic BP (mmHg)"
                value={
                  healthForm.systolic_bp
                }
                onChange={(value) =>
                  updateHealth(
                    "systolic_bp",
                    value
                  )
                }
              />

              <Field
                label="Diastolic BP (mmHg)"
                value={
                  healthForm.diastolic_bp
                }
                onChange={(value) =>
                  updateHealth(
                    "diastolic_bp",
                    value
                  )
                }
              />

              <Field
                label="Blood Glucose (mg/dL)"
                value={
                  healthForm.blood_glucose_mg_dl
                }
                onChange={(value) =>
                  updateHealth(
                    "blood_glucose_mg_dl",
                    value
                  )
                }
              />

              <Field
                label="Mood (1-5)"
                value={healthForm.mood}
                min={1}
                max={5}
                step={1}
                onChange={(value) =>
                  updateHealth(
                    "mood",
                    value
                  )
                }
              />
            </div>

            <h3>
              <Dumbbell size={18} />
              Fitness Measurements
            </h3>

            <div className="assessment-field-grid">
              <Field
                label="VO₂max"
                value={
                  fitnessForm.vo2max
                }
                onChange={(value) =>
                  updateFitness(
                    "vo2max",
                    value
                  )
                }
              />

              {assessmentPhase ===
                "pre_mission" && (
                <Field
                  label="Premission VO₂max"
                  value={
                    fitnessForm.premission_vo2max
                  }
                  onChange={(value) =>
                    updateFitness(
                      "premission_vo2max",
                      value
                    )
                  }
                />
              )}

              <Field
                label="Deadlift (kg)"
                value={
                  fitnessForm.deadlift_kg
                }
                onChange={(value) =>
                  updateFitness(
                    "deadlift_kg",
                    value
                  )
                }
              />

              <Field
                label="Bench Press (kg)"
                value={
                  fitnessForm.bench_press_kg
                }
                onChange={(value) =>
                  updateFitness(
                    "bench_press_kg",
                    value
                  )
                }
              />

              <Field
                label="Bodyweight (kg)"
                value={
                  fitnessForm.bodyweight_kg
                }
                onChange={(value) =>
                  updateFitness(
                    "bodyweight_kg",
                    value
                  )
                }
              />

              <Field
                label="Muscle Strength"
                value={
                  fitnessForm.muscle_strength
                }
                onChange={(value) =>
                  updateFitness(
                    "muscle_strength",
                    value
                  )
                }
              />

              {assessmentPhase ===
                "pre_mission" && (
                <Field
                  label="Premission Muscle Strength"
                  value={
                    fitnessForm.premission_muscle_strength
                  }
                  onChange={(value) =>
                    updateFitness(
                      "premission_muscle_strength",
                      value
                    )
                  }
                />
              )}
            </div>

            <label className="assessment-field">
              <span>
                Data Classification
              </span>

              <select
                value={
                  isSynthetic
                    ? "synthetic"
                    : "recorded"
                }
                onChange={(event) =>
                  setIsSynthetic(
                    event.target.value ===
                      "synthetic"
                  )
                }
              >
                <option value="synthetic">
                  Synthetic Demo Data
                </option>
                <option value="recorded">
                  Manually Recorded Data
                </option>
              </select>
            </label>

            {error && (
              <div
                className="assessment-note"
                role="alert"
              >
                <AlertTriangle
                  size={16}
                />
                {error}
              </div>
            )}

            <div className="assessment-actions">
              <button
                type="button"
                className="assessment-secondary"
                onClick={() =>
                  setStep(
                    QUESTIONS.length - 1
                  )
                }
              >
                <ArrowLeft size={15} />
                Back
              </button>

              <button
                type="button"
                className="assessment-primary"
                disabled={saving}
                onClick={
                  submitAssessment
                }
              >
                {saving ? (
                  <Loader2
                    size={16}
                    className="mr-spin"
                  />
                ) : (
                  <Save size={16} />
                )}

                {saving
                  ? "Saving..."
                  : "Save & Evaluate"}
              </button>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="assessment-result">
            <div className="assessment-result-heading">
              {result.priority ===
              "ROUTINE" ? (
                <CheckCircle2 size={25} />
              ) : (
                <AlertTriangle size={25} />
              )}

              <div>
                <span className="assessment-eyebrow">
                  ASSESSMENT SAVED
                </span>

                <h3>
                  {result.priority}
                </h3>
              </div>
            </div>

            <h4>Observations</h4>

            <ul>
              {result.observations.map(
                (item) => (
                  <li key={item}>
                    {item}
                  </li>
                )
              )}
            </ul>

            <h4>Suggested Next Steps</h4>

            <ul>
              {result.recommendations.map(
                (item) => (
                  <li key={item}>
                    {item}
                  </li>
                )
              )}
            </ul>

            {result.readiness && (
              <>
                <h4>
                  Fitness Requirements
                </h4>

                <p>
                  Status:{" "}
                  <strong>
                    {
                      result.readiness
                        .overall_status
                    }
                  </strong>
                </p>

                <p>
                  Met:{" "}
                  {
                    result.readiness
                      .counts?.MET ?? 0
                  }{" "}
                  | Not Met:{" "}
                  {
                    result.readiness
                      .counts?.NOT_MET ?? 0
                  }{" "}
                  | Not Assessed:{" "}
                  {
                    result.readiness
                      .counts
                      ?.NOT_ASSESSED ?? 0
                  }
                </p>
              </>
            )}

            <div className="assessment-note">
              <Activity size={16} />
              Prototype decision support.
              Questionnaire recommendations
              are not a medical diagnosis
              or EVA clearance.
            </div>

            <div className="assessment-actions">
              <button
                type="button"
                className="assessment-secondary"
                onClick={restart}
              >
                Start Again
              </button>

              <button
                type="button"
                className="assessment-primary"
                onClick={onClose}
              >
                Finish
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
