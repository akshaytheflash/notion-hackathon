import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
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
          <div className="flex items-center gap-4">
            {demoError && (
              <span className="text-[11px] font-mono" style={{ color: "var(--color-signal-red)" }}>
                {demoError}
              </span>
            )}
            <button
              onClick={runDemo}
              disabled={running}
              className="rounded-md px-4 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-signal-amber)",
                color: "var(--color-ink)",
              }}
            >
              {running ? "Running\u2026" : "Run P0 Incident Demo"}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
