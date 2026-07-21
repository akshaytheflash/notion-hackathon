import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WorkflowSummary } from "../lib/incident-command/api";
import { stateColor } from "../lib/incident-command/workflow-status";
import { SkeletonTable } from "../components/incident-command/Skeleton";
import { Pagination } from "../components/incident-command/Pagination";

export default function IncidentList() {
  const [incidents, setIncidents] = useState<WorkflowSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.listIncidents(signal, page, pageSize);
      setIncidents(res.data);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    const ac = new AbortController();
    refresh(ac.signal);
    const id = setInterval(() => refresh(ac.signal), 5000);
    return () => { clearInterval(id); ac.abort(); };
  }, [refresh]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>Incidents</span>
        <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>All tracked incidents and their current workflow state.</p>
      </div>

      {loading && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
          <SkeletonTable rows={5} />
        </div>
      )}

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm font-mono" style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}>
          {error}
        </div>
      )}

      {!loading && !error && incidents.length === 0 && (
        <div className="rounded-lg border px-6 py-12 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
          <p className="text-base" style={{ color: "var(--color-dim)" }}>No incidents recorded yet.</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Run the demo scenario to create the first incident.</p>
        </div>
      )}

      {!loading && !error && incidents.length > 0 && (
        <div className="icc-card rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                  <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Incident ID</th>
                  <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Workflow</th>
                  <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>State</th>
                  <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Created</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.incident_id} className="transition-all duration-200 hover:bg-white/[0.03]" style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--color-muted)" }}>{inc.incident_id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--color-dim)" }}>wf_{inc.workflow_id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: stateColor(inc.state), border: `1px solid ${stateColor(inc.state)}` }}>{inc.state}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--color-dim)" }}>{new Date(inc.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/incidents/${inc.incident_id}`} className="font-mono" style={{ color: "var(--color-signal-cyan)" }}>Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
