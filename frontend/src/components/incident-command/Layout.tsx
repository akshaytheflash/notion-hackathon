import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  GitBranch,
  LayoutDashboard,
  Mail,
  Mic,
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
  X,
} from "lucide-react";
import { api, type IntegrationsStatus, type Workflow, type SearchResult } from "../../lib/incident-command/api";
import { useIccTheme } from "../../lib/incident-command/useIccTheme";
import { useLiveEvents } from "../../lib/incident-command/useLiveEvents";
import { IntegrationStrip } from "./IntegrationStrip";
import { CommandPalette } from "./CommandPalette";
import { useVoiceCommands } from "../../hooks/useVoiceCommands";

const NAV = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", Icon: Siren, showBadge: true },
  { to: "/workflows", label: "Workflows", Icon: GitBranch },
  { to: "/decisions", label: "Decisions", Icon: ShieldCheck },
  { to: "/policies", label: "Policies", Icon: Scale },
  { to: "/action-log", label: "Action Log", Icon: ScrollText },
  { to: "/notification-recipients", label: "Email Recipients", Icon: Mail },
];

const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "REJECTED"]);

export function Layout() {
  const { theme, toggleTheme } = useIccTheme();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [running, setRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [st, wfRes] = await Promise.all([
        api.integrationsStatus(),
        api.listWorkflows(signal, 1, 100),
      ]);
      setIntegrations(st);
      setWorkflows(wfRes.data);
    } catch {
      // fail quietly
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    refresh(ac.signal);
    const id = setInterval(() => refresh(ac.signal), 8000);
    return () => { clearInterval(id); ac.abort(); };
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

  // --- Voice Commands ---
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [transcriptIsFinal, setTranscriptIsFinal] = useState(false);
  const transcriptTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const getAiResponse = useCallback(async (query: string): Promise<string | null> => {
    try {
      const [incidentsRes, workflowsRes, decisionsRes, policiesRes, approvalsRes, analytics] = await Promise.all([
        api.listIncidents(undefined, 1, 200),
        api.listWorkflows(undefined, 1, 200),
        api.listDecisions(undefined, 1, 200),
        api.listPolicies(undefined, 1, 200),
        api.listApprovals(undefined, 1, 200),
        api.getDashboardAnalytics(),
      ]);
      const dbContext = {
        incidents: incidentsRes.data,
        workflows: workflowsRes.data,
        decisions: decisionsRes.data,
        policies: policiesRes.data,
        approvals: approvalsRes.data,
        analytics,
        incident_creation_fields: {
          name: "string - incident title",
          severity: "string - P0, P1, or P2",
          description: "string - description of the incident",
          revenue_risk_per_day: "number - estimated daily revenue at risk in dollars",
        },
      };
      const res = await api.aiQuery(query, dbContext as unknown as Record<string, unknown>);
      return res.answer;
    } catch {
      speak("I had trouble looking that up.");
      return null;
    }
  }, []);

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const voiceCommands = useVoiceCommands(
    [
      { patterns: [/show dashboard/, /go to dashboard/, /home/], action: () => navigate("/"), feedback: "Navigating to dashboard" },
      { patterns: [/show incidents/, /go to incidents/, /incident list/], action: () => navigate("/incidents"), feedback: "Showing incidents" },
      { patterns: [/show workflows/, /go to workflows/, /workflow list/], action: () => navigate("/workflows"), feedback: "Showing workflows" },
      { patterns: [/show decisions/, /go to decisions/], action: () => navigate("/decisions"), feedback: "Showing decisions" },
      { patterns: [/show policies/, /go to policies/], action: () => navigate("/policies"), feedback: "Showing policies" },
      { patterns: [/show action log/, /go to action log/, /action log/], action: () => navigate("/action-log"), feedback: "Showing action log" },
      { patterns: [/run demo/, /start demo/, /fire drill/, /run scenario/], action: () => { runDemo(); }, feedback: "Running demo scenario" },
      {
        patterns: [/create incident/i, /new incident/i, /report incident/i, /open incident/i],
        action: async (transcript) => {
          try {
            const text = transcript ?? "";
            const cmdPats = [/create incident/i, /new incident/i, /report incident/i, /open incident/i];
            let name = "";
            for (const p of cmdPats) {
              const m = text.match(p);
              if (m && m.index !== undefined) {
                name = text.slice(m.index + m[0].length).trim();
                break;
              }
            }
            if (!name || name.length < 2) { speak("Please provide an incident name."); return; }
            const severity = transcript?.toLowerCase().includes("p0") ? "P0" : transcript?.toLowerCase().includes("p2") ? "P2" : "P1";
            await api.createIncident({
              name,
              severity,
              description: `Voice-created incident: ${name}`,
              revenue_risk_per_day: severity === "P0" ? 400000 : severity === "P1" ? 100000 : 25000,
            });
            navigate("/incidents");
          } catch (e) {
            speak("Failed to create incident. Please try again.");
          }
        },
        feedback: (transcript) => {
          const text = transcript ?? "";
          const cmdPats = [/create incident/i, /new incident/i, /report incident/i, /open incident/i];
          let name = "";
          for (const p of cmdPats) {
            const m = text.match(p);
            if (m && m.index !== undefined) {
              name = text.slice(m.index + m[0].length).trim();
              break;
            }
          }
          name = name || "New Incident";
          const severity = text.toLowerCase().includes("p0") ? "P0" : text.toLowerCase().includes("p2") ? "P2" : "P1";
          const risk = severity === "P0" ? "$400k/day" : severity === "P1" ? "$100k/day" : "$25k/day";
          return `${severity} incident "${name}" created with revenue risk ${risk}.`;
        },
      },
      { patterns: [/stop listening/, /go to sleep/, /shut up/, /silence/], action: () => voiceCommands.toggleListening(), feedback: "Voice control deactivated" },
    ],
    getAiResponse,
    (text: string, isFinal: boolean) => {
      setLiveTranscript(text);
      setTranscriptIsFinal(isFinal);
      if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
      if (isFinal) {
        transcriptTimerRef.current = setTimeout(() => setLiveTranscript(null), 5000);
      }
    },
  );

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults(null);
      setShowSearch(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search(value.trim());
        setSearchResults(res);
        setShowSearch(true);
      } catch {
        // fail quietly
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function goToSearchResult(path: string) {
    setShowSearch(false);
    setSearchQuery("");
    navigateRef.current(path);
  }

  const hasSearchResults = searchResults && (
    searchResults.incidents.length + searchResults.workflows.length +
    searchResults.decisions.length + searchResults.policies.length + searchResults.events.length
  ) > 0;

  // --- Notifications ---
  const { events } = useLiveEvents();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifDismissed, setNotifDismissed] = useState(0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const recentEvents = events.slice(0, 20);
  const unreadCount = Math.max(0, events.length - notifDismissed);

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

        <div className="px-4 pt-4" ref={searchRef}>
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2.5 border"
            style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-dim)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchResults && setShowSearch(true)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: "var(--color-text)" }}
              aria-label="Search incidents, workflows, decisions, policies"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults(null); setShowSearch(false); }} className="shrink-0" style={{ color: "var(--color-dim)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {showSearch && searchResults && (
            <div className="absolute z-50 mt-1 w-72 max-h-80 overflow-y-auto rounded-lg border shadow-lg" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
              {searching && <div className="p-3 text-xs font-mono" style={{ color: "var(--color-dim)" }}>Searching…</div>}
              {!searching && !hasSearchResults && (
                <div className="p-3 text-xs font-mono" style={{ color: "var(--color-dim)" }}>No results found.</div>
              )}
              {!searching && hasSearchResults && (
                <div className="py-1">
                  {searchResults.incidents.map((inc) => (
                    <button key={`inc-${inc.incident_id}`} onClick={() => goToSearchResult(`/incidents/${inc.incident_id}`)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <Siren className="w-3 h-3 shrink-0" style={{ color: "var(--color-signal-red)" }} />
                      <span className="truncate">Incident {inc.incident_id.slice(0, 8)}</span>
                      <span className="ml-auto shrink-0" style={{ color: "var(--color-dim)" }}>{inc.state}</span>
                    </button>
                  ))}
                  {searchResults.workflows.map((wf) => (
                    <button key={`wf-${wf.id}`} onClick={() => goToSearchResult(`/workflows/${wf.id}`)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <GitBranch className="w-3 h-3 shrink-0" style={{ color: "var(--color-signal-cyan)" }} />
                      <span className="truncate">Workflow {wf.id.slice(0, 8)}</span>
                      <span className="ml-auto shrink-0" style={{ color: "var(--color-dim)" }}>{wf.state}</span>
                    </button>
                  ))}
                  {searchResults.decisions.map((d) => (
                    <button key={`dec-${d.id}`} onClick={() => goToSearchResult(`/workflows/${d.workflow_id}`)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "var(--color-signal-amber)" }} />
                      <span className="truncate">{d.event_type}</span>
                      <span className="ml-auto shrink-0" style={{ color: "var(--color-dim)" }}>{new Date(d.created_at).toLocaleDateString()}</span>
                    </button>
                  ))}
                  {searchResults.policies.map((p) => (
                    <button key={`pol-${p.id}`} onClick={() => goToSearchResult("/policies")} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <Scale className="w-3 h-3 shrink-0" style={{ color: "var(--color-signal-green)" }} />
                      <span className="truncate">{p.name || p.policy_id}</span>
                    </button>
                  ))}
                  {searchResults.events.slice(0, 5).map((ev) => (
                    <button key={`ev-${ev.id}`} onClick={() => goToSearchResult(`/workflows/${ev.workflow_id}`)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] flex items-center gap-2" style={{ color: "var(--color-text)" }}>
                      <ScrollText className="w-3 h-3 shrink-0" style={{ color: "var(--color-muted)" }} />
                      <span className="truncate">{ev.event_type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

            <div className="relative">
              <button
                onClick={voiceCommands.toggleListening}
                aria-label={voiceCommands.isListening ? "Deactivate voice control" : "Activate voice control"}
                className="w-9 h-9 rounded-md flex items-center justify-center transition-all duration-200 hover:opacity-80"
                style={{
                  color: voiceCommands.isListening ? "var(--color-signal-red)" : "var(--color-muted)",
                  border: `1px solid ${voiceCommands.isListening ? "var(--color-signal-red)" : "var(--color-hairline)"}`,
                }}
              >
                <Mic className="w-4 h-4" />
                {voiceCommands.isListening && (
                  <motion.span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                    style={{ backgroundColor: "var(--color-signal-red)" }}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                )}
              </button>

              <AnimatePresence>
                {(liveTranscript || voiceCommands.lastAiResponse) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border shadow-lg overflow-hidden"
                    style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
                  >
                    {liveTranscript && (
                      <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          {!transcriptIsFinal && (
                            <motion.span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: "var(--color-signal-red)" }}
                              animate={{ opacity: [1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                            />
                          )}
                          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
                            {transcriptIsFinal ? "You said" : "Listening"}
                          </span>
                        </div>
                        <p className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{liveTranscript}</p>
                      </div>
                    )}
                    {voiceCommands.lastAiResponse && (
                      <div className="px-3 py-2.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-signal-cyan)" }}>AI Response</span>
                        <p className="text-sm" style={{ color: "var(--color-text)" }}>{voiceCommands.lastAiResponse}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) setNotifDismissed(events.length); }}
                aria-label={`Notifications: ${unreadCount} unread`}
                className="w-9 h-9 rounded-md flex items-center justify-center transition-all duration-200 hover:opacity-80 relative"
                style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-mono font-bold"
                    style={{ backgroundColor: "var(--color-signal-red)", color: "#fff" }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 z-50 mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border shadow-lg" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
                  <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-hairline)" }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-text)" }}>Notifications</span>
                    {events.length > 0 && (
                      <button onClick={() => setNotifDismissed(events.length)} className="text-[11px] font-mono" style={{ color: "var(--color-signal-cyan)" }}>Mark all read</button>
                    )}
                  </div>
                  {recentEvents.length === 0 ? (
                    <div className="p-4 text-xs font-mono" style={{ color: "var(--color-dim)" }}>No recent events.</div>
                  ) : (
                    recentEvents.map((ev, i) => {
                      const isNew = i >= (events.length - notifDismissed);
                      return (
                        <button
                          key={`${ev.created_at}-${i}`}
                          onClick={() => { goToSearchResult(`/workflows/${ev.workflow_id}`); }}
                          className="w-full text-left px-3 py-2.5 border-b flex items-start gap-2 hover:bg-white/[0.03]"
                          style={{ borderColor: "var(--color-hairline)" }}
                        >
                          {isNew && <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--color-signal-cyan)" }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono truncate" style={{ color: isNew ? "var(--color-text)" : "var(--color-dim)" }}>{ev.event_type}</p>
                            <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-dim)" }}>{ev.source}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

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
                <button onClick={() => { setShowForm(true); setDemoError(null); }}
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
      <CommandPalette onRunDemo={runDemo} />
    </div>
  );
}
