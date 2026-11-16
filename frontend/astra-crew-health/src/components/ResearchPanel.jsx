
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import "./ResearchPanel.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";;

export default function ResearchPanel({ systemId }) {
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadResearch() {
      setLoading(true);
      setError("");
      setResearch(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/research/systems/${systemId}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to load research");
        }

        const data = await response.json();
        setResearch(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadResearch();

    return () => controller.abort();
  }, [systemId]);

  return (
    <section className="astra-research">
      <div className="astra-research-heading">
        <BookOpen size={19} />
        <h3>NASA & CSA Research Context</h3>
      </div>

      {loading && <p>Loading research...</p>}

      {error && (
        <p className="astra-research-error">{error}</p>
      )}

      {research && !loading && (
        <>
          <p className="astra-research-description">
            {research.guidance.description}
          </p>

          <h4>Relevant Spaceflight Hazards</h4>

          <div className="astra-research-hazards">
            {research.hazards.map((hazard) => (
              <article
                key={hazard.id}
                className="astra-research-hazard"
              >
                <strong>{hazard.name}</strong>
                <p>{hazard.description}</p>
              </article>
            ))}
          </div>

          <h4>Monitoring Considerations</h4>

          <ul>
            {[
              ...new Set(
                research.hazards.flatMap(
                  (hazard) => hazard.monitoring_context
                )
              ),
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h4>Research Sources</h4>

          <div className="astra-research-sources">
            {research.sources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.organization}: {source.title}
                <ExternalLink size={13} />
              </a>
            ))}
          </div>

          <p className="astra-research-disclaimer">
            {research.disclaimer}
          </p>
        </>
      )}
    </section>
  );
}
