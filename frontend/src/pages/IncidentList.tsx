import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WorkflowSummary } from "../lib/api";
import { SkeletonTable } from "../components/Skeleton";

function stateColor(state: string): string {
  if (state === "COMPLETED") return "var(--color-signal-green)";
  if (state === "FAILED" || state === "REJECTED") return "var(--color-signal-red)";
  if (state === "WAITING_FOR_APPROVAL") return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}

export default function IncidentList() {
  const [incidents, setIncidents] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listIncidents();
      setIncidents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents");
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
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Incidents
        </span>
        <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>
          All tracked incidents and their current workflow state.
        </p>
      </div>

      {loading && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <SkeletonTable rows={5} />
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

      {!loading && !error && incidents.length === 0 && (
        <div
          className="rounded-lg border px-6 py-12 text-center"
          style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>No incidents recorded yet.</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>Run the demo scenario to create the first incident.</p>
        </div>
      )}

      {!loading && !error && incidents.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                <th className="text-left px-4 py-3 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Incident ID</th>
                <th className="text-left px-4 py-3 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Workflow</th>
                <th className="text-left px-4 py-3 font-mono font-medium" style={{ color: "var(--color-muted)" }}>State</th>
                <th className="text-left px-4 py-3 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc.incident_id}
                  className="transition-all duration-200 hover:bg-white/[0.03]"
                  style={{ borderBottom: "1px solid var(--color-hairline)" }}
                >
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--color-muted)" }}>
                    {inc.incident_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--color-dim)" }}>
                    wf_{inc.workflow_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ color: stateColor(inc.state), border: `1px solid ${stateColor(inc.state)}` }}
                    >
                      {inc.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--color-dim)" }}>
                    {new Date(inc.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/incidents/${inc.incident_id}`}
                      className="font-mono"
                      style={{ color: "var(--color-signal-cyan)" }}
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
