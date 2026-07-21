import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Workflow, type WorkflowEvent } from "../lib/incident-command/api";
import { StateRail } from "../components/incident-command/StateRail";
import { SkeletonDetail } from "../components/incident-command/Skeleton";

function stateColor(state: string): string {
  if (state === "COMPLETED") return "var(--color-signal-green)";
  if (state === "FAILED" || state === "REJECTED") return "var(--color-signal-red)";
  if (state === "WAITING_FOR_APPROVAL") return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}

function eventColor(eventType: string): string {
  if (eventType.includes("COMPLETED")) return "var(--color-signal-green)";
  if (eventType.includes("FAILED") || eventType.includes("REJECTED")) return "var(--color-signal-red)";
  if (eventType.includes("APPROVAL")) return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workflowId) return;
    try {
      const [wf, ev] = await Promise.all([
        api.getWorkflow(workflowId),
        api.getWorkflowEvents(workflowId),
      ]);
      setWorkflow(wf);
      setEvents(ev);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
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

  if (!workflow) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm font-mono" style={{ color: "var(--color-dim)" }}>
        <Link to="/workflows" style={{ color: "var(--color-signal-cyan)" }}>Workflows</Link>
        <span>/</span>
        <span>{workflow.id.slice(0, 8)}</span>
      </div>

      <div>
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Workflow Detail
        </span>
      </div>

      {/* Summary Card */}
      <div
        className="icc-card rounded-lg border p-6"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base" style={{ color: "var(--color-text)" }}>
              wf_{workflow.id.slice(0, 8)}
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: stateColor(workflow.state), border: `1px solid ${stateColor(workflow.state)}` }}
            >
              {workflow.state}
            </span>
          </div>
          <Link
            to={`/incidents/${workflow.incident_id}`}
            className="text-sm font-mono"
            style={{ color: "var(--color-signal-cyan)" }}
          >
            View Incident →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <FieldCard label="Workflow ID" value={workflow.id.slice(0, 8)} />
          <FieldCard label="Incident ID" value={workflow.incident_id.slice(0, 8)} />
          <FieldCard label="Created" value={new Date(workflow.created_at).toLocaleString()} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FieldCard label="Updated" value={new Date(workflow.updated_at).toLocaleString()} />
          <FieldCard label="Completed" value={workflow.completed_at ? new Date(workflow.completed_at).toLocaleString() : "—"} />
          <FieldCard label="Pending Approval" value={workflow.pending_approval_id ? workflow.pending_approval_id.slice(0, 8) : "—"} />
        </div>

        <div className="mt-6">
          <label className="text-xs font-mono uppercase tracking-wider mb-2 block" style={{ color: "var(--color-dim)" }}>Pipeline Progress</label>
          <div
            className="rounded-md border p-4"
            style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <StateRail currentState={workflow.state} />
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div
        className="icc-card rounded-lg border"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
          <h2 className="font-semibold text-base tracking-wide">Event Timeline</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-dim)" }}>
            {events.length} event{events.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-hairline)" }}>
          {events.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--color-dim)" }}>No events recorded for this workflow.</p>
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="px-5 py-3.5 flex items-start gap-4 animate-slide-in"
                style={{ borderColor: "var(--color-hairline)" }}
              >
                <div className="shrink-0 mt-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: eventColor(ev.event_type) }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-medium" style={{ color: eventColor(ev.event_type) }}>
                      {ev.event_type}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                      {ev.source}
                    </span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--color-muted)" }}>
                    {JSON.stringify(ev.payload_json, null, 2)}
                  </pre>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-dim)" }}>
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
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
