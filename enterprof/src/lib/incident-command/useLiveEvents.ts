import { useEffect, useRef, useState } from "react";

export interface LiveEvent {
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * The backend's /ws/workflows/{id} endpoint broadcasts every
 * workflow's events to every connected socket regardless of {id} — so a
 * single connection here is enough to drive a live command-center feed.
 * We use "live" as a placeholder workflow_id since the backend doesn't
 * filter events by workflow_id.
 */
export function useLiveEvents(maxEvents = 200) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryDelay = 1000;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/workflows/live`);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryDelay = 1000;
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as LiveEvent;
          setEvents((prev) => [data, ...prev].slice(0, maxEvents));
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 10000);
        }
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, [maxEvents]);

  return { events, connected };
}
