import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type IncidentDetail as IncidentDetailType } from "../lib/incident-command/api";
import { stateColor } from "../lib/incident-command/workflow-status";
import { StateRail } from "../components/incident-command/StateRail";
import { SkeletonDetail } from "../components/incident-command/Skeleton";

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [incident, setIncident] = useState<IncidentDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!incidentId) return;
    try {
      const data = await api.getIncident(incidentId, signal);
      setIncident(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    const id = setInterval(() => load(ac.signal), 4000);
    return () => { clearInterval(id); ac.abort(); };
  }, [load]);

  if (loading) {
    return <SkeletonDetail />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg border px-4 py-3 text-sm font-mono"
          style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!incident) return null;

  const ctx = incident.context;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm font-mono" style={{ color: "var(--color-dim)" }}>
        <Link to="/incidents" style={{ color: "var(--color-signal-cyan)" }}>Incidents</Link>
        <span>/</span>
        <span>{incident.incident_id.slice(0, 8)}</span>
      </div>

      <div>
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Incident Detail
        </span>
      </div>

      <div
        className="icc-card rounded-lg border p-6"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              {ctx.name || "Unnamed Incident"}
            </h2>
            <p className="text-sm font-mono mt-1" style={{ color: "var(--color-dim)" }}>
              {incident.incident_id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {ctx.severity && (
              <span
                className="text-xs font-mono px-2.5 py-1 rounded"
                style={{
                  color: ctx.severity === "P0" ? "var(--color-signal-red)" : "var(--color-signal-amber)",
                  border: `1px solid ${ctx.severity === "P0" ? "var(--color-signal-red)" : "var(--color-signal-amber)"}`,
                }}
              >
                {ctx.severity}
              </span>
            )}
            <span
              className="text-xs font-mono px-2.5 py-1 rounded"
              style={{
                color: stateColor(incident.state),
                border: `1px solid ${stateColor(incident.state)}`,
              }}
            >
              {incident.state}
            </span>
          </div>
        </div>

        {ctx.description && (
          <div className="mb-4">
            <label className="text-xs font-mono uppercase tracking-wider mb-1 block" style={{ color: "var(--color-dim)" }}>Description</label>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>{ctx.description}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-4">
          <FieldCard label="Revenue Risk" value={ctx.revenue_risk_per_day != null ? `$${ctx.revenue_risk_per_day.toLocaleString()}/day` : "—"} />
          <FieldCard label="Requested Amount" value={ctx.requested_amount != null ? `$${ctx.requested_amount.toLocaleString()}` : "—"} />
          <FieldCard label="Created" value={new Date(incident.created_at).toLocaleString()} />
        </div>

        <div className="mt-6">
          <label className="text-xs font-mono uppercase tracking-wider mb-2 block" style={{ color: "var(--color-dim)" }}>Pipeline Progress</label>
          <div
            className="rounded-md border p-4"
            style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <StateRail currentState={incident.state} />
          </div>
        </div>

        <div className="mt-4">
          <Link
            to={`/workflows/${incident.workflow_id}`}
            className="text-sm font-mono"
            style={{ color: "var(--color-signal-cyan)" }}
          >
            View Workflow Details →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border px-3.5 py-2.5"
      style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
    >
      <label className="text-xs font-mono uppercase tracking-wider block mb-0.5" style={{ color: "var(--color-dim)" }}>{label}</label>
      <span className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
