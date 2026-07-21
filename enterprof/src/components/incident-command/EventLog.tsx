import { formatDistanceToNowStrict } from "date-fns";
import { Activity, Circle } from "lucide-react";
import type { LiveEvent } from "../../lib/incident-command/useLiveEvents";

function eventColor(eventType: string): string {
  if (eventType.startsWith("STATE_COMPLETED")) return "var(--color-signal-green)";
  if (eventType.startsWith("STATE_FAILED") || eventType.startsWith("STATE_REJECTED")) return "var(--color-signal-red)";
  if (eventType.includes("APPROVAL")) return "var(--color-signal-amber)";
  if (eventType.startsWith("STATE_")) return "var(--color-signal-cyan)";
  return "var(--color-dim)";
}

export function EventLog({ events, connected }: { events: LiveEvent[]; connected: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: "var(--color-muted)" }} />
          <h2 className="font-semibold text-base tracking-wide">Live Event Feed</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle
            className="w-2.5 h-2.5"
            fill={connected ? "var(--color-signal-green)" : "var(--color-signal-red)"}
            style={{ color: connected ? "var(--color-signal-green)" : "var(--color-signal-red)" }}
          />
          <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
            {connected ? "connected" : "reconnecting…"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto text-sm">
        {events.length === 0 ? (
          <div className="p-5" style={{ color: "var(--color-dim)" }}>
            No events yet. Run the demo scenario to see the pipeline move.
          </div>
        ) : (
          events.map((e, i) => (
            <div
              key={i}
              className="px-5 py-3 border-b flex items-center gap-3 animate-slide-in"
              style={{ borderColor: "var(--color-hairline)", animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <span className="font-mono shrink-0 text-xs" style={{ color: "var(--color-dim)" }}>
                {formatDistanceToNowStrict(new Date(e.created_at), { addSuffix: true })}
              </span>
              <span className="flex-1 truncate" style={{ color: "var(--color-text)" }}>
                {e.event_type}
              </span>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded shrink-0"
                style={{ color: eventColor(e.event_type), border: `1px solid ${eventColor(e.event_type)}` }}
              >
                {e.source}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
