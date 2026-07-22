import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Workflow, type Approval } from "../lib/api";
import { useLiveEvents } from "../lib/useLiveEvents";
import { WorkflowList } from "../components/WorkflowList";
import { EventLog } from "../components/EventLog";
import { ApprovalsPanel } from "../components/ApprovalsPanel";

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const { events, connected } = useLiveEvents();

  const refresh = useCallback(async () => {
    try {
      const [wf, ap] = await Promise.all([api.listWorkflows(), api.listApprovals()]);
      setWorkflows(wf);
      setApprovals(ap);
    } catch {
      // fail quietly
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (events.length > 0) refresh();
  }, [events.length, refresh]);

  return (
    <div className="flex flex-col h-full animate-enter">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
            Overview
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--color-dim)" }}>
          Real-time workflow status across all active incidents.
        </p>
      </div>

      <main className="flex-1 grid grid-cols-12 gap-4 p-6 min-h-0">
        <section
          className="col-span-7 rounded-lg border min-h-0 flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-hairline)" }}>
            <h2 className="font-semibold text-sm tracking-wide">Workflows</h2>
            <Link to="/workflows" className="text-[11px] font-mono" style={{ color: "var(--color-signal-cyan)" }}>
              View All
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--color-hairline)" }}>
            {workflows.length === 0 ? (
              <p className="text-xs p-4" style={{ color: "var(--color-dim)" }}>
                No workflows yet. Run the demo scenario to create one.
              </p>
            ) : (
              workflows.map((w) => (
                <Link
                  key={w.id}
                  to={`/workflows/${w.id}`}
                  className="block p-4 transition-all duration-200 hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(69,217,200,0.08)]"
                  style={{ borderColor: "var(--color-hairline)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
                        wf_{w.id.slice(0, 8)}
                      </span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          color: stateBadgeColor(w.state),
                          border: `1px solid ${stateBadgeColor(w.state)}`,
                        }}
                      >
                        {w.state}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                      {new Date(w.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section
          className="col-span-5 rounded-lg border min-h-0 flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <ApprovalsPanel approvals={approvals} />
        </section>

        <section
          className="col-span-12 rounded-lg border min-h-[280px] max-h-[360px] flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <EventLog events={events} connected={connected} />
        </section>
      </main>
    </div>
  );
}

function stateBadgeColor(state: string): string {
  if (state === "COMPLETED") return "var(--color-signal-green)";
  if (state === "FAILED" || state === "REJECTED") return "var(--color-signal-red)";
  if (state === "WAITING_FOR_APPROVAL") return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}
