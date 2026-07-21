import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WorkflowEvent } from "../lib/incident-command/api";
import { SkeletonCardList } from "../components/incident-command/Skeleton";

function decisionLabel(eventType: string): string {
  switch (eventType) {
    case "ENGINEERING_ANALYSIS_COMPLETED": return "Engineering Analysis";
    case "FINANCE_DECISION_CREATED": return "Finance Decision";
    case "ENGINEERING_APPEAL_CREATED": return "Engineering Appeal";
    case "OPERATIONS_REVIEW_COMPLETED": return "Operations Review";
    default: return eventType;
  }
}

function decisionColor(eventType: string): string {
  if (eventType.includes("ENGINEERING")) return "var(--color-signal-cyan)";
  if (eventType.includes("FINANCE")) return "var(--color-signal-amber)";
  if (eventType.includes("OPERATIONS")) return "var(--color-signal-green)";
  return "var(--color-muted)";
}

export default function Decisions() {
  const [decisions, setDecisions] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listDecisions();
      setDecisions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Decisions
        </span>
        <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>
          AI agent decisions recorded across all workflow stages.
        </p>
      </div>

      {loading && <SkeletonCardList items={4} />}

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm font-mono"
          style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && decisions.length === 0 && (
        <div
          className="rounded-lg border px-6 py-12 text-center"
          style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}
        >
          <p className="text-base" style={{ color: "var(--color-dim)" }}>No decisions recorded yet.</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Run the demo to generate AI agent decisions.</p>
        </div>
      )}

      {!loading && decisions.length > 0 && (
        <div className="space-y-3">
          {decisions.map((d) => {
            const payload = d.payload_json as Record<string, unknown>;
            return (
              <div
                key={d.id}
                className="icc-card rounded-lg border p-5"
                style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ color: decisionColor(d.event_type), border: `1px solid ${decisionColor(d.event_type)}` }}
                    >
                      {decisionLabel(d.event_type)}
                    </span>
                    {typeof payload.agent === "string" && (
                      <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                        {payload.agent}
                      </span>
                    )}
                    {typeof payload.department === "string" && (
                      <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                        / {payload.department}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/workflows/${d.workflow_id}`}
                      className="text-xs font-mono"
                      style={{ color: "var(--color-signal-cyan)" }}
                    >
                      wf_{d.workflow_id.slice(0, 8)}
                    </Link>
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                      {new Date(d.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {typeof payload.decision === "string" && (
                  <div className="mb-2">
                    <label className="text-xs font-mono uppercase tracking-wider mb-0.5 block" style={{ color: "var(--color-dim)" }}>Decision</label>
                    <p className="text-sm" style={{ color: "var(--color-text)" }}>{payload.decision}</p>
                  </div>
                )}

                {typeof payload.reasoning_summary === "string" && (
                  <div className="mb-2">
                    <label className="text-xs font-mono uppercase tracking-wider mb-0.5 block" style={{ color: "var(--color-dim)" }}>Reasoning</label>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>{payload.reasoning_summary}</p>
                  </div>
                )}

                {typeof payload.evidence === "string" && (
                  <div className="mb-2">
                    <label className="text-xs font-mono uppercase tracking-wider mb-0.5 block" style={{ color: "var(--color-dim)" }}>Evidence</label>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>{payload.evidence}</p>
                  </div>
                )}

                {typeof payload.confidence === "number" && (
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>Confidence</label>
                    <div className="w-28 h-2 rounded-full" style={{ backgroundColor: "var(--color-hairline)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(payload.confidence * 100)}%`,
                          backgroundColor: payload.confidence >= 0.8 ? "var(--color-signal-green)" : payload.confidence >= 0.5 ? "var(--color-signal-amber)" : "var(--color-signal-red)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                      {Math.round(payload.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
