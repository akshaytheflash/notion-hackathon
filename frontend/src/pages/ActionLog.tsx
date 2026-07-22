import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WorkflowEvent } from "../lib/api";
import { SkeletonTable } from "../components/Skeleton";

function eventColor(eventType: string): string {
  if (eventType.includes("COMPLETED")) return "var(--color-signal-green)";
  if (eventType.includes("FAILED") || eventType.includes("REJECTED")) return "var(--color-signal-red)";
  if (eventType.includes("APPROVAL") || eventType.includes("PAUSED")) return "var(--color-signal-amber)";
  if (eventType.includes("STATE_")) return "var(--color-signal-cyan)";
  if (eventType.includes("POLICY")) return "var(--color-signal-violet)";
  return "var(--color-dim)";
}

function sourceIcon(source: string): string {
  switch (source) {
    case "orchestrator": return "\u2699";
    case "engineering": return "\u2692";
    case "finance": return "\u20A0";
    case "operations": return "\u2699";
    case "github": return "\u2B24";
    case "slack": return "\u25CE";
    case "policy_engine": return "\u2630";
    case "approval_watcher": return "\u270B";
    default: return "\u2022";
  }
}

export default function ActionLog() {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const refresh = useCallback(async () => {
    try {
      const data = await api.listActionLog();
      setEvents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load action log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const sources = Array.from(new Set(events.map((e) => e.source))).sort();
  const filtered = filter === "ALL" ? events : events.filter((e) => e.source === filter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
            Action Log
          </span>
          <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>
            Complete audit trail of all workflow events and system actions.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <FilterButton label="All" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
          {sources.map((s) => (
            <FilterButton key={s} label={s} active={filter === s} onClick={() => setFilter(s)} />
          ))}
        </div>
      </div>

      {loading && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <SkeletonTable rows={8} />
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-xs font-mono"
          style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div
          className="rounded-lg border px-6 py-12 text-center"
          style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>
            {events.length === 0 ? "No events recorded yet." : "No events match the selected filter."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <div className="divide-y" style={{ borderColor: "var(--color-hairline)" }}>
            {filtered.map((ev) => {
              const payload = ev.payload_json as Record<string, unknown>;
              return (
                <div
                  key={ev.id}
                  className="px-4 py-3 flex items-start gap-4 transition-all duration-200 hover:bg-white/[0.03]"
                  style={{ borderColor: "var(--color-hairline)" }}
                >
                  <span className="text-sm shrink-0 mt-0.5" title={ev.source}>
                    {sourceIcon(ev.source)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-medium" style={{ color: eventColor(ev.event_type) }}>
                        {ev.event_type}
                      </span>
                      <span
                        className="text-[9px] font-mono px-1 py-0.5 rounded"
                        style={{ color: "var(--color-dim)", backgroundColor: "var(--color-panel-raised)" }}
                      >
                        {ev.source}
                      </span>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed" style={{ color: "var(--color-muted)", maxHeight: "120px", overflow: "hidden" }}>
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-mono block" style={{ color: "var(--color-dim)" }}>
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                    <Link
                      to={`/workflows/${ev.workflow_id}`}
                      className="text-[10px] font-mono block mt-0.5"
                      style={{ color: "var(--color-signal-cyan)" }}
                    >
                      wf_{ev.workflow_id.slice(0, 8)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-mono px-2 py-1 rounded transition-all duration-200 ease-out"
      style={{
        color: active ? "var(--color-ink)" : "var(--color-muted)",
        backgroundColor: active ? "var(--color-signal-cyan)" : "transparent",
        border: active ? "none" : "1px solid var(--color-hairline)",
      }}
    >
      {label}
    </button>
  );
}
