import type { LiveEvent } from "../lib/useLiveEvents";

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
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-sm tracking-wide">Live Event Feed</h2>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? "var(--color-signal-green)" : "var(--color-signal-red)" }}
          />
          <span className="text-[11px] font-mono" style={{ color: "var(--color-dim)" }}>
            {connected ? "connected" : "reconnecting…"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {events.length === 0 ? (
          <div className="p-4" style={{ color: "var(--color-dim)" }}>
            No events yet. Run the demo scenario to see the pipeline move.
          </div>
        ) : (
          events.map((e, i) => (
            <div
              key={i}
              className="px-4 py-2 border-b flex items-start gap-3 animate-slide-in"
              style={{ borderColor: "var(--color-hairline)", animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <span style={{ color: "var(--color-dim)" }} className="shrink-0">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
              <span className="shrink-0" style={{ color: eventColor(e.event_type) }}>
                {e.event_type}
              </span>
              <span style={{ color: "var(--color-muted)" }} className="truncate">
                {e.source}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
