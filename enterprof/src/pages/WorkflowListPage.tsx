import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Workflow } from "../lib/incident-command/api";
import { stateColor } from "../lib/incident-command/workflow-status";
import { StateRail } from "../components/incident-command/StateRail";
import { SkeletonCardList } from "../components/incident-command/Skeleton";
import { Pagination } from "../components/incident-command/Pagination";

export default function WorkflowListPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.listWorkflows(signal, page, pageSize);
      setWorkflows(res.data);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    const ac = new AbortController();
    refresh(ac.signal);
    const id = setInterval(() => refresh(ac.signal), 4000);
    return () => { clearInterval(id); ac.abort(); };
  }, [refresh]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>Workflows</span>
        <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Active and completed workflow pipelines.</p>
      </div>

      {loading && <SkeletonCardList items={3} />}

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm font-mono" style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}>{error}</div>
      )}

      {!loading && !error && workflows.length === 0 && (
        <div className="rounded-lg border px-6 py-12 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
          <p className="text-base" style={{ color: "var(--color-dim)" }}>No workflows found.</p>
        </div>
      )}

      {!loading && workflows.length > 0 && (
        <div className="space-y-4">
          {workflows.map((w) => (
            <Link key={w.id} to={`/workflows/${w.id}`} className="icc-card block rounded-lg border p-5 transition-all duration-200 hover:bg-white/[0.03]" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm" style={{ color: "var(--color-muted)" }}>wf_{w.id.slice(0, 8)}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: stateColor(w.state), border: `1px solid ${stateColor(w.state)}` }}>{w.state}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>incident_{w.incident_id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{new Date(w.updated_at).toLocaleString()}</span>
                  {w.completed_at && (
                    <span className="text-xs font-mono" style={{ color: "var(--color-signal-green)" }}>Completed {new Date(w.completed_at).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
              <StateRail currentState={w.state} />
            </Link>
          ))}
          <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
