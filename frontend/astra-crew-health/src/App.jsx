
import { useState } from "react";
import "./App.css";

import useTelemetry from "./hooks/useTelemetry";
import {
  getCognitiveScenario,
  setSimulationMode,
} from "./api/astraApi";

import DashboardNav from "./components/dashboard/DashboardNav";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import HealthStatusBanner from "./components/dashboard/HealthStatusBanner";
import PhysiologicalIndicators from "./components/dashboard/PhysiologicalIndicators";
import HeartRateTrend from "./components/dashboard/HeartRateTrend";
import CognitivePanel from "./components/dashboard/CognitivePanel";
import HealthInsights from "./components/dashboard/HealthInsights";
import SimulationPanel from "./components/dashboard/SimulationPanel";

import BodyHealthMap from "./components/BodyHealthMap";
import CrewDailyLog from "./components/CrewDailyLog";
import AstronautSelfAssessment from "./components/AstronautSelfAssessment";
import CrewHealthTrends from "./components/crew/CrewHealthTrends";
import MissionReadiness from "./components/readiness/MissionReadiness";

function App() {
  const {
    data,
    connection,
    history,
    telemetry,
    health,
  } = useTelemetry();

  const [activeTab, setActiveTab] = useState("overview");
  const [showAssessment, setShowAssessment] = useState(false);

  const [mode, setMode] = useState("NORMAL");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");

  const [cognitive, setCognitive] = useState(null);
  const [cognitiveScenario, setCognitiveScenario] = useState("normal");
  const [cognitiveLoading, setCognitiveLoading] = useState(false);
  const [cognitiveError, setCognitiveError] = useState("");

  const status = health?.status || "CALIBRATING";

  async function changeMode(newMode) {
    setSimulationLoading(true);
    setSimulationError("");

    try {
      await setSimulationMode(newMode);
      setMode(newMode);
    } catch (error) {
      setSimulationError(error.message);
    } finally {
      setSimulationLoading(false);
    }
  }

  async function loadCognitiveScenario(scenario) {
    setCognitiveLoading(true);
    setCognitiveError("");

    try {
      const result = await getCognitiveScenario(scenario);
      setCognitive(result);
      setCognitiveScenario(scenario);
    } catch (error) {
      setCognitiveError(error.message);
    } finally {
      setCognitiveLoading(false);
    }
  }

  return (
    <div className="app">
      <DashboardHeader connection={connection} />

      <main className="dashboard astra-dashboard">
        <DashboardNav
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "overview" && (
          <div className="astra-page">
            <div className="astra-page-intro">
              <div>
                <span className="eyebrow">
                  MISSION HEALTH OVERVIEW
                </span>
                <h2>Crew Monitoring</h2>
                <p>
                  Live physiological telemetry and
                  autonomous health observations.
                </p>
              </div>

              <button
                className="astra-secondary-button"
                onClick={() => setActiveTab("daily")}
              >
                Open Daily Health
              </button>
            </div>

            <HealthStatusBanner
              status={status}
              mode={mode}
            />

            <PhysiologicalIndicators health={health} />

            <section className="content-grid">
              <HeartRateTrend
                history={history}
                telemetry={telemetry}
              />

              <CognitivePanel
                cognitive={cognitive}
                scenario={cognitiveScenario}
                loading={cognitiveLoading}
                error={cognitiveError}
                onScenarioChange={loadCognitiveScenario}
              />
            </section>

            <HealthInsights
              health={health}
              status={status}
              onStartAssessment={() => setShowAssessment(true)}
            />
          </div>
        )}

        {activeTab === "body" && (
          <div className="astra-page">
            <div className="astra-page-intro">
              <div>
                <span className="eyebrow">
                  PHYSIOLOGICAL SYSTEMS
                </span>
                <h2>Body Health Map</h2>
                <p>
                  Explore monitored body systems and
                  research-based spaceflight considerations.
                </p>
              </div>
            </div>

            <BodyHealthMap
              health={health}
              cognitive={cognitive}
            />
          </div>
        )}

        {activeTab === "daily" && (
          <div className="astra-page">
            <div className="astra-page-intro">
              <div>
                <span className="eyebrow">
                  CREW HEALTH HISTORY
                </span>
                <h2>Daily Health Journal</h2>
                <p>
                  Record sleep, exercise, fatigue, and
                  mission workload.
                </p>
              </div>
            </div>

            <CrewDailyLog astronautId="CREW-001" />
          </div>
        )}

        {activeTab === "simulator" && (
          <div className="astra-page">
            <div className="astra-page-intro">
              <div>
                <span className="eyebrow">
                  ASTRA DEMONSTRATION
                </span>
                <h2>Mission Simulator</h2>
                <p>
                  Change simulated telemetry conditions
                  and observe health responses.
                </p>
              </div>
            </div>

            <SimulationPanel
              mode={mode}
              onModeChange={changeMode}
              loading={simulationLoading}
              error={simulationError}
            />

            <HealthStatusBanner
              status={status}
              mode={mode}
            />

            <PhysiologicalIndicators health={health} />

            <HeartRateTrend
              history={history}
              telemetry={telemetry}
            />
          </div>
        )}
        {activeTab === "trends" && (
          <div className="astra-page">
            <CrewHealthTrends astronautId="CREW-001" />
          </div>
        )}

        {activeTab === "readiness" && (
          <div className="astra-page">
            <MissionReadiness astronautId="CREW-001" />
          </div>
        )}
      </main>

      <footer>
        <span>ASTRA v0.2</span>
        <span>
          Decision-support prototype · Simulation data
        </span>
      </footer>

      {showAssessment && (
        <AstronautSelfAssessment
          health={data?.health}
          onClose={() => setShowAssessment(false)}
        />
      )}
    </div>
  );
}

export default App;
