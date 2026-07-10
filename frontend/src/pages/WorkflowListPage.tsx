import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Workflow } from "../lib/api";
import { StateRail } from "../components/StateRail";
import { SkeletonCardList } from "../components/Skeleton";

function stateColor(state: string): string {
  if (state === "COMPLETED") return "var(--color-signal-green)";
  if (state === "FAILED" || state === "REJECTED") return "var(--color-signal-red)";
  if (state === "WAITING_FOR_APPROVAL") return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}

export default function WorkflowListPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listWorkflows();
      setWorkflows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Workflows
        </span>
        <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>
          Active and completed workflow pipelines.
        </p>
      </div>

      {loading && <SkeletonCardList items={3} />}

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-xs font-mono"
          style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && workflows.length === 0 && (
        <div
          className="rounded-lg border px-6 py-12 text-center"
          style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>No workflows found.</p>
        </div>
      )}

      {!loading && workflows.length > 0 && (
        <div className="space-y-4">
          {workflows.map((w) => (
            <Link
              key={w.id}
              to={`/workflows/${w.id}`}
              className="block rounded-lg border p-4 transition-all duration-200 hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(69,217,200,0.08)]"
              style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
                    wf_{w.id.slice(0, 8)}
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ color: stateColor(w.state), border: `1px solid ${stateColor(w.state)}` }}
                  >
                    {w.state}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                    incident_{w.incident_id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                    {new Date(w.updated_at).toLocaleString()}
                  </span>
                  {w.completed_at && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-signal-green)" }}>
                      Completed {new Date(w.completed_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              <StateRail currentState={w.state} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
