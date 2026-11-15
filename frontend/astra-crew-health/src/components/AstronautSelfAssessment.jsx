
import { useState } from "react";
import {
  ClipboardList,
  Activity,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import "./AstronautSelfAssessment.css";

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

function assessResponses(answers, health) {
  const metrics = health?.metrics || {};

  const telemetryFlags = Object.values(metrics).some(
    (metric) =>
      metric?.status === "ATTENTION" ||
      metric?.status === "ACTION"
  );

  const concerningSymptoms = [
    "Dizziness",
    "Breathing discomfort",
    "Other discomfort",
  ];

  const symptomsReported = concerningSymptoms.includes(
    answers.symptoms
  );

  const fatigue = answers.symptoms === "Unusual fatigue";
  const poorSleep = ["Poor", "Very poor"].includes(
    answers.sleep
  );

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
      "Recent physical activity may help explain changes in heart rate or respiration."
    );
  }

  if (fatigue || poorSleep) {
    observations.push(
      "Reported fatigue or poor sleep may affect perceived readiness and performance."
    );
  }

  if (highWorkload) {
    observations.push(
      "The astronaut reports elevated workload."
    );
  }

  if (symptomsReported) {
    recommendations.push(
      "Report the symptoms to the designated crew medical support process and follow mission medical procedures."
    );
  }

  if (telemetryFlags) {
    recommendations.push(
      "Verify sensor readings and review trends against the personal baseline."
    );
  }

  if (exercise) {
    recommendations.push(
      "Document recent activity when interpreting physiological changes."
    );
  }

  if (poorSleep || fatigue || highWorkload) {
    recommendations.push(
      "Review rest, workload, and fatigue with the appropriate crew support process."
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
      : telemetryFlags || fatigue || poorSleep || highWorkload
        ? "REVIEW"
        : "ROUTINE",
    observations:
      observations.length > 0
        ? observations
        : ["No additional concerns identified by this questionnaire."],
    recommendations,
  };
}

export default function AstronautSelfAssessment({
  health,
  onClose,
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const question = QUESTIONS[step];
  const isComplete = result !== null;

  function selectAnswer(value) {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: value,
    }));
  }

  function next() {
    if (!answers[question.id]) return;

    if (step < QUESTIONS.length - 1) {
      setStep((previous) => previous + 1);
    } else {
      setResult(assessResponses(answers, health));
    }
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setResult(null);
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

        {!isComplete ? (
          <>
            <div className="assessment-progress">
              <span>
                Question {step + 1} of {QUESTIONS.length}
              </span>
              <div className="assessment-progress-track">
                <div
                  style={{
                    width: `${
                      ((step + 1) / QUESTIONS.length) * 100
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
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      answers[question.id] === option
                        ? "assessment-option selected"
                        : "assessment-option"
                    }
                    onClick={() => selectAnswer(option)}
                  >
                    <span>{option}</span>
                    {answers[question.id] === option && (
                      <CheckCircle2 size={18} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="assessment-actions">
              <button
                type="button"
                disabled={step === 0}
                onClick={() =>
                  setStep((previous) => previous - 1)
                }
                className="assessment-secondary"
              >
                Back
              </button>

              <button
                type="button"
                disabled={!answers[question.id]}
                onClick={next}
                className="assessment-primary"
              >
                {step === QUESTIONS.length - 1
                  ? "Generate Assessment"
                  : "Continue"}
              </button>
            </div>
          </>
        ) : (
          <div className="assessment-result">
            <div className="assessment-result-heading">
              {result.priority === "ROUTINE" ? (
                <CheckCircle2 size={25} />
              ) : (
                <AlertTriangle size={25} />
              )}

              <div>
                <span className="assessment-eyebrow">
                  ASSESSMENT COMPLETE
                </span>
                <h3>{result.priority}</h3>
              </div>
            </div>

            <h4>Observations</h4>
            <ul>
              {result.observations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h4>Suggested Next Steps</h4>
            <ul>
              {result.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="assessment-note">
              <Activity size={16} />
              Prototype assessment using simulated telemetry
              and self-reported answers. Not a diagnosis or
              validated medical triage system.
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
