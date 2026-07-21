import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Clock, Gauge, TrendingUp } from "lucide-react";
import { api, type Workflow, type Approval } from "../lib/incident-command/api";
import { useLiveEvents } from "../lib/incident-command/useLiveEvents";
import { computeDashboardMetrics } from "../lib/incident-command/dashboard-metrics";
import { getWorkflowStatusMeta } from "../lib/incident-command/workflow-status";
import { getProgressPercent } from "../components/incident-command/StateRail";
import { EventLog } from "../components/incident-command/EventLog";
import { ApprovalsPanel } from "../components/incident-command/ApprovalsPanel";

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const { events, connected } = useLiveEvents();

  const refresh = useCallback(async () => {
    try {
      const [wf, ap] = await Promise.all([api.listWorkflows(), api.listApprovals()]);
      setWorkflows(wf);
      setApprovals(ap);
      setLastUpdated(new Date());
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

  // Re-render every second so the "updated Xs ago" label ticks.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const metrics = computeDashboardMetrics(workflows);

  return (
    <div className="flex flex-col h-full animate-enter">
      <div className="p-6 pb-0">
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Overview
        </span>
        <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--color-text)" }}>
          Real-time workflow status across all active incidents
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>
          {lastUpdated
            ? `Updated ${formatDistanceToNowStrict(lastUpdated, { addSuffix: true })}`
            : "Waiting for first update…"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 p-6 pb-0">
        <StatCard
          Icon={Clock}
          label="MTTR"
          value={metrics.mttrLabel ?? "—"}
        />
        <StatCard
          Icon={Gauge}
          label="Active Incidents"
          value={String(metrics.activeCount)}
        />
        <StatCard
          Icon={TrendingUp}
          label="Auto-Resolved"
          value={metrics.autoResolvedPercent != null ? `${metrics.autoResolvedPercent.toFixed(1)}%` : "—"}
        />
      </div>

      <main className="flex-1 grid grid-cols-12 gap-4 p-6 min-h-0">
        <section
          className="icc-card col-span-7 rounded-lg border min-h-0 flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-hairline)" }}>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base tracking-wide">Workflows</h2>
              {workflows.length > 0 && (
                <span
                  className="text-xs font-mono font-semibold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}
                >
                  {workflows.length}
                </span>
              )}
            </div>
            <Link to="/workflows" className="flex items-center gap-1 text-sm font-mono" style={{ color: "var(--color-signal-cyan)" }}>
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--color-hairline)" }}>
            {workflows.length === 0 ? (
              <p className="text-sm p-5" style={{ color: "var(--color-dim)" }}>
                No workflows yet. Run the demo scenario to create one.
              </p>
            ) : (
              workflows.map((w) => {
                const meta = getWorkflowStatusMeta(w.state);
                const progress = getProgressPercent(w.state);
                return (
                  <Link
                    key={w.id}
                    to={`/workflows/${w.id}`}
                    className="block p-5 transition-all duration-200 hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(69,217,200,0.08)]"
                    style={{ borderColor: "var(--color-hairline)" }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded shrink-0"
                          style={{ color: meta.colorVar, border: `1px solid ${meta.colorVar}` }}
                        >
                          <meta.Icon className="w-3.5 h-3.5" />
                          {meta.group}
                        </span>
                        <span className="font-mono text-sm truncate" style={{ color: "var(--color-text)" }}>
                          {w.state}
                        </span>
                      </div>
                      <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-dim)" }}>
                        {formatDistanceToNowStrict(new Date(w.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-hairline)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, backgroundColor: meta.colorVar }}
                      />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section
          className="icc-card col-span-5 rounded-lg border min-h-0 flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <ApprovalsPanel approvals={approvals} />
        </section>

        <section
          className="icc-card col-span-12 rounded-lg border min-h-[280px] max-h-[360px] flex flex-col"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <EventLog events={events} connected={connected} />
        </section>
      </main>
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
}: {
  Icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div
      className="icc-card rounded-lg border p-5"
      style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-dim)" }}>
          {label}
        </span>
        <Icon className="w-4 h-4" style={{ color: "var(--color-muted)" }} />
      </div>
      <p className="text-3xl font-semibold" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}
