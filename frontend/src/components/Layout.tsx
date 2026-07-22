import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type IntegrationsStatus } from "../lib/api";
import { IntegrationStrip } from "./IntegrationStrip";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/incidents", label: "Incidents" },
  { to: "/workflows", label: "Workflows" },
  { to: "/decisions", label: "Decisions" },
  { to: "/policies", label: "Policies" },
  { to: "/action-log", label: "Action Log" },
];

export function Layout() {
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const st = await api.integrationsStatus();
      setIntegrations(st);
    } catch {
      // fail quietly
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("P0 Production Outage - Payment Gateway");
  const [severity, setSeverity] = useState("P0");
  const [desc, setDesc] = useState("Critical payment gateway failure affecting all transactions. Emergency infrastructure scaling required.");
  const [revenueRisk, setRevenueRisk] = useState(400000);
  const formRef = useRef<HTMLDivElement>(null);

  async function runDemo() {
    setRunning(true);
    setDemoError(null);
    try {
      await api.runPrimaryScenario();
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : "Demo run failed");
    } finally {
      setRunning(false);
    }
  }

  async function runCustom() {
    setRunning(true);
    setDemoError(null);
    try {
      await api.runPrimaryScenario({
        name,
        severity,
        description: desc,
        revenue_risk_per_day: revenueRisk,
      });
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : "Custom run failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowForm(false);
      }
    }
    if (showForm) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showForm]);

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-56 shrink-0 flex flex-col border-r"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
            Enterprise AI OS
          </p>
          <h1 className="text-sm font-semibold mt-0.5">Command Center</h1>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium transition-all duration-200 ease-out ${
                  isActive ? "border-r-2" : ""
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--color-text)" : "var(--color-muted)",
                backgroundColor: isActive ? "rgba(69, 217, 200, 0.06)" : "transparent",
                borderRightColor: isActive ? "var(--color-signal-cyan)" : "transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--color-hairline)" }}>
          <IntegrationStrip status={integrations} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header
          className="flex items-center justify-between px-6 py-3 border-b shrink-0"
          style={{ borderColor: "var(--color-hairline)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
              Incident Command Center
            </h2>
          </div>
          <div className="flex items-center gap-4" ref={formRef}>
            {demoError && (
              <span className="text-[11px] font-mono" style={{ color: "var(--color-signal-red)" }}>
                {demoError}
              </span>
            )}

            {showForm ? (
              <div className="flex items-end gap-2 p-2 rounded-lg" style={{ backgroundColor: "var(--color-panel)", border: "1px solid var(--color-hairline)" }}>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="rounded px-2 py-1 text-xs w-48" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>Severity</label>
                  <select value={severity} onChange={e => setSeverity(e.target.value)}
                    className="rounded px-2 py-1 text-xs" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
                    <option>P0</option><option>P1</option><option>P2</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>Description</label>
                  <input value={desc} onChange={e => setDesc(e.target.value)}
                    className="rounded px-2 py-1 text-xs w-64" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>Rev Risk/Day ($)</label>
                  <input type="number" value={revenueRisk} onChange={e => setRevenueRisk(Number(e.target.value))}
                    className="rounded px-2 py-1 text-xs w-24" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <button onClick={runCustom} disabled={running}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}>
                  {running ? "Running\u2026" : "Run"}
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setShowForm(true)}
                  className="rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:opacity-90"
                  style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}>
                  Custom Incident
                </button>
                <button onClick={runDemo} disabled={running}
                  className="rounded-md px-4 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}>
                  {running ? "Running\u2026" : "Run P0 Incident Demo"}
                </button>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
