
import { useEffect, useState } from "react";
import { WS_URL } from "../api/astraApi";

export default function useTelemetry() {
  const [data, setData] = useState(null);
  const [connection, setConnection] = useState("CONNECTING");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;
    let socket = null;
    let reconnectTimer = null;

    function connect() {
      if (!active) return;

      setConnection("CONNECTING");
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        if (active) setConnection("ONLINE");
      };

      socket.onmessage = (event) => {
        if (!active) return;

        try {
          const incoming = JSON.parse(event.data);
          setData(incoming);

          const telemetry = incoming.telemetry;

          if (telemetry && Number.isFinite(telemetry.heart_rate)) {
            setHistory((previous) =>
              [
                ...previous,
                {
                  timestamp: telemetry.timestamp,
                  heart_rate: telemetry.heart_rate,
                },
              ].slice(-60)
            );
          }
        } catch (error) {
          console.error("Invalid telemetry message:", error);
        }
      };

      socket.onerror = () => {
        if (active) setConnection("OFFLINE");
      };

      socket.onclose = () => {
        if (!active) return;

        setConnection("OFFLINE");
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return {
    data,
    connection,
    history,
    telemetry: data?.telemetry,
    health: data?.health,
  };
}
