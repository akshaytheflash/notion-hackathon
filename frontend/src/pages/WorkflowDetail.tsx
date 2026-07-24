import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Workflow, type WorkflowEvent } from "../lib/incident-command/api";
import { stateColor, eventColor } from "../lib/incident-command/workflow-status";
import { WorkflowTimeline } from "../components/incident-command/WorkflowTimeline";
import { SkeletonDetail } from "../components/incident-command/Skeleton";
import { AgentThinking } from "../components/incident-command/AgentThinking";
import { useLiveEvents } from "../lib/incident-command/useLiveEvents";
import { Loader2, RefreshCw } from "lucide-react";

const RETRYABLE_STATES = new Set(["WAITING_FOR_APPROVAL", "COMPLETED"]);

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const { events: liveEvents } = useLiveEvents();

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!workflowId) return;
    try {
      const [wf, evRes] = await Promise.all([
        api.getWorkflow(workflowId, signal),
        api.getWorkflowEvents(workflowId, signal, 1, 200),
      ]);
      setWorkflow(wf);
      setEvents(evRes.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    const id = setInterval(() => load(ac.signal), 4000);
    return () => { clearInterval(id); ac.abort(); };
  }, [load]);

  async function handleRetry() {
    if (!workflowId) return;
    setRetrying(true);
    setRetryResult(null);
    try {
      const res = await api.retryFailedActions(workflowId);
      setRetryResult(`Retried ${res.retried_count} failed action(s)`);
      await load();
    } catch (e) {
      setRetryResult(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  if (loading) return <SkeletonDetail />;
  if (error) return (
    <div className="p-6">
      <div className="rounded-lg border px-4 py-3 text-sm font-mono" style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}>{error}</div>
    </div>
  );
  if (!workflow) return null;

  const hasFailedActions = events.some((e) => e.event_type === "INTEGRATION_ACTION_FAILED");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm font-mono" style={{ color: "var(--color-dim)" }}>
        <Link to="/workflows" style={{ color: "var(--color-signal-cyan)" }}>Workflows</Link>
        <span>/</span>
        <span>{workflow.id.slice(0, 8)}</span>
      </div>

      <div><span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>Workflow Detail</span></div>

      <div className="icc-card rounded-lg border p-6" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base" style={{ color: "var(--color-text)" }}>wf_{workflow.id.slice(0, 8)}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: stateColor(workflow.state), border: `1px solid ${stateColor(workflow.state)}` }}>{workflow.state}</span>
          </div>
          <div className="flex items-center gap-3">
            {hasFailedActions && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}
              >
                {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {retrying ? "Retrying…" : "Retry Failed"}
              </button>
            )}
            <Link to={`/incidents/${workflow.incident_id}`} className="text-sm font-mono" style={{ color: "var(--color-signal-cyan)" }}>View Incident →</Link>
          </div>
        </div>

        {retryResult && (
          <div className="mb-4 rounded-md px-3 py-2 text-xs font-mono" style={{ color: "var(--color-signal-cyan)", backgroundColor: "rgba(69, 217, 200, 0.08)", border: "1px solid var(--color-signal-cyan)" }}>
            {retryResult}
            <button onClick={() => setRetryResult(null)} className="ml-2 opacity-60 hover:opacity-100">Dismiss</button>
          </div>
        )}

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
          <div className="rounded-md border p-4" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}>
            <WorkflowTimeline currentState={workflow.state} events={events} />
          </div>
        </div>
      </div>

      <div className="icc-card rounded-lg border" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
          <h2 className="font-semibold text-base tracking-wide">Event Timeline</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-dim)" }}>{events.length} event{events.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-hairline)" }}>
          {events.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--color-dim)" }}>No events recorded for this workflow.</p>
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="px-5 py-3.5 flex items-start gap-4 animate-slide-in" style={{ borderColor: "var(--color-hairline)" }}>
                <div className="shrink-0 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: eventColor(ev.event_type) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-medium" style={{ color: eventColor(ev.event_type) }}>{ev.event_type}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{ev.source}</span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--color-muted)" }}>{JSON.stringify(ev.payload_json, null, 2)}</pre>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-dim)" }}>{new Date(ev.created_at).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <AgentThinking workflowId={workflow.id} enabled={true} liveEvents={liveEvents} />
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3.5 py-2.5" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}>
      <label className="text-xs font-mono uppercase tracking-wider block mb-0.5" style={{ color: "var(--color-dim)" }}>{label}</label>
      <span className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
