import { useEffect, useState } from "react";
import { api, type DashboardAnalytics } from "../../lib/incident-command/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#3ecf8e", "#ef5350", "#f5a623"];
const CYAN = "#45d9c8";
const AMBER = "#f5a623";

export function AnalyticsCharts() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const d = await api.getDashboardAnalytics();
        if (!cancelled) setData(d);
      } catch {
        setError("Failed to load analytics");
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error) return null;
  if (!data || data.total_incidents === 0) return null;

  const statusPie = [
    { name: "Completed", value: data.completed_incidents },
    { name: "Failed", value: data.failed_incidents },
    { name: "Active", value: data.active_incidents },
  ].filter(d => d.value > 0);

  const confBuckets = [0, 0, 0, 0, 0];
  for (const c of data.confidence_scores) {
    const idx = Math.min(Math.floor(c * 5), 4);
    confBuckets[idx]++;
  }
  const confData = confBuckets.map((v, i) => ({
    range: `${(i * 20).toString()}%`,
    count: v,
  }));

  const policyData = [
    { name: "Passed", value: data.policy_passed },
    { name: "Rejected", value: data.policy_failed },
  ].filter(d => d.value > 0);

  return (
    <section className="icc-card col-span-12 rounded-lg border" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-base tracking-wide">Analytics</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 p-5">
        <ChartCard title="Incidents Over Time">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.incidents_over_time}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="count" fill={CYAN} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Distribution">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Confidence Distribution">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={confData}>
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="count" fill={AMBER} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Policy Evaluations">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={policyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {policyData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="SLA Compliance">
          <div className="flex items-center justify-center h-[180px]">
            <div className="text-center">
              <span className="text-4xl font-bold" style={{ color: data.sla_compliance >= 90 ? "var(--color-signal-green)" : "var(--color-signal-red)" }}>
                {data.sla_compliance}%
              </span>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--color-dim)" }}>SLA compliance rate</p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Revenue at Risk">
          <div className="flex items-center justify-center h-[180px]">
            <div className="text-center">
              <span className="text-3xl font-bold" style={{ color: "var(--color-signal-red)" }}>
                ${(data.revenue_at_risk / 1000).toFixed(0)}k
              </span>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--color-dim)" }}>/day total exposure</p>
              {data.mttr_seconds != null && (
                <p className="text-xs font-mono mt-1" style={{ color: "var(--color-muted)" }}>
                  MTTR: {(data.mttr_seconds / 60).toFixed(1)}m
                </p>
              )}
            </div>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--color-panel-raised)", borderColor: "var(--color-hairline)" }}>
      <h3 className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--color-dim)" }}>{title}</h3>
      {children}
    </div>
  );
}