import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  GitBranch,
  LayoutDashboard,
  LogIn,
  Moon,
  Play,
  Plus,
  Scale,
  ScrollText,
  Search,
  ShieldCheck,
  Siren,
  SunMedium,
  Terminal,
} from "lucide-react";
import { api, type IntegrationsStatus, type Workflow } from "../../lib/incident-command/api";
import { useIccTheme } from "../../lib/incident-command/useIccTheme";
import { IntegrationStrip } from "./IntegrationStrip";

const NAV = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", Icon: Siren, showBadge: true },
  { to: "/workflows", label: "Workflows", Icon: GitBranch },
  { to: "/decisions", label: "Decisions", Icon: ShieldCheck },
  { to: "/policies", label: "Policies", Icon: Scale },
  { to: "/action-log", label: "Action Log", Icon: ScrollText },
];

const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "REJECTED"]);

export function Layout() {
  const { theme, toggleTheme } = useIccTheme();
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [running, setRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [st, wf] = await Promise.all([api.integrationsStatus(), api.listWorkflows()]);
      setIntegrations(st);
      setWorkflows(wf);
    } catch {
      // fail quietly
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const activeCount = workflows.filter((w) => !TERMINAL_STATES.has(w.state)).length;

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
    <div className="icc-root min-h-screen flex" data-theme={theme}>
      <aside
        className="w-64 shrink-0 flex flex-col border-r"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
      >
        <div className="px-5 py-6 border-b flex items-center gap-3" style={{ borderColor: "var(--color-hairline)" }}>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--color-signal-amber)" }}
          >
            <Terminal className="w-5 h-5" style={{ color: "var(--color-ink)" }} />
          </div>
          <div>
            <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
              Enterprise AI OS
            </p>
            <h1 className="text-base font-semibold mt-0.5">Command Center</h1>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2.5 border"
            style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-dim)" }} />
            <input
              type="text"
              placeholder="Search incidents..."
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: "var(--color-text)" }}
            />
            <kbd
              className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
              style={{ color: "var(--color-dim)", border: "1px solid var(--color-hairline)" }}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        <nav className="flex-1 py-4">
          <p
            className="px-5 pb-2 text-[11px] font-mono tracking-widest uppercase"
            style={{ color: "var(--color-dim)" }}
          >
            Navigate
          </p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all duration-200 ease-out ${
                  isActive ? "border-r-2" : ""
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--color-text)" : "var(--color-muted)",
                backgroundColor: isActive ? "rgba(69, 217, 200, 0.06)" : "transparent",
                borderRightColor: isActive ? "var(--color-signal-cyan)" : "transparent",
              })}
            >
              <item.Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.showBadge && activeCount > 0 && (
                <span
                  className="text-[11px] font-mono font-semibold rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-signal-red)", color: "#fff" }}
                >
                  {activeCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--color-hairline)" }}>
          <p
            className="pb-2 text-[11px] font-mono tracking-widest uppercase"
            style={{ color: "var(--color-dim)" }}
          >
            Integrations
          </p>
          <IntegrationStrip status={integrations} />
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--color-hairline)" }}>
          <NavLink
            to="/sign-in"
            className="flex items-center gap-2.5 text-sm font-medium transition-all duration-200 hover:opacity-80"
            style={{ color: "var(--color-muted)" }}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-hairline)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-mono tracking-widest uppercase"
              style={{ color: "var(--color-signal-cyan)" }}
            >
              Incident
            </span>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Command Center
            </h2>
            <span
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
              style={{
                color: activeCount === 0 ? "var(--color-signal-green)" : "var(--color-signal-amber)",
                backgroundColor: activeCount === 0 ? "rgba(62, 207, 142, 0.1)" : "rgba(245, 166, 35, 0.1)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: activeCount === 0 ? "var(--color-signal-green)" : "var(--color-signal-amber)" }}
              />
              {activeCount === 0 ? "All systems nominal" : `${activeCount} active incident${activeCount === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="flex items-center gap-3" ref={formRef}>
            {demoError && (
              <span className="text-xs font-mono" style={{ color: "var(--color-signal-red)" }}>
                {demoError}
              </span>
            )}

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-md flex items-center justify-center transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
            >
              {theme === "dark" ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              aria-label="Notifications"
              className="w-9 h-9 rounded-md flex items-center justify-center transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
            >
              <Bell className="w-4 h-4" />
            </button>

            {showForm ? (
              <div className="flex items-end gap-2 p-2.5 rounded-lg" style={{ backgroundColor: "var(--color-panel)", border: "1px solid var(--color-hairline)" }}>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="rounded px-2.5 py-1.5 text-sm w-48" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Severity</label>
                  <select value={severity} onChange={e => setSeverity(e.target.value)}
                    className="rounded px-2.5 py-1.5 text-sm" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
                    <option>P0</option><option>P1</option><option>P2</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Description</label>
                  <input value={desc} onChange={e => setDesc(e.target.value)}
                    className="rounded px-2.5 py-1.5 text-sm w-64" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Rev Risk/Day ($)</label>
                  <input type="number" value={revenueRisk} onChange={e => setRevenueRisk(Number(e.target.value))}
                    className="rounded px-2.5 py-1.5 text-sm w-24" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
                </div>
                <button onClick={runCustom} disabled={running}
                  className="rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}>
                  {running ? "Running…" : "Run"}
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 rounded-md px-3.5 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90"
                  style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}>
                  <Plus className="w-4 h-4" />
                  Custom Incident
                </button>
                <button onClick={runDemo} disabled={running}
                  className="flex items-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}>
                  <Play className="w-4 h-4" />
                  {running ? "Running…" : "Run P0 Incident Demo"}
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
