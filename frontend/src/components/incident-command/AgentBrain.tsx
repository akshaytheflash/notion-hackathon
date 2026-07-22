import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type WorkflowEvent } from "../../lib/incident-command/api";
import { Brain, Cpu, DollarSign, Wrench, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface AgentState {
  agent: string;
  department: string;
  status: "idle" | "thinking" | "done" | "failed";
  prompt?: string;
  output?: Record<string, unknown>;
  tokens?: string;
  workflowId?: string;
  updatedAt: number;
}

const AGENT_META: Record<string, { Icon: typeof Brain; color: string }> = {
  EngineeringAgent: { Icon: Wrench, color: "var(--color-signal-cyan)" },
  FinanceAgent: { Icon: DollarSign, color: "var(--color-signal-green)" },
  OperationsAgent: { Icon: Cpu, color: "var(--color-signal-violet)" },
};

function agentDepartment(name: string): string {
  const meta = AGENT_META[name];
  if (meta?.Icon === Wrench) return "Engineering";
  if (meta?.Icon === DollarSign) return "Finance";
  if (meta?.Icon === Cpu) return "Operations";
  return "";
}

export function AgentBrain() {
  const [agents, setAgents] = useState<Record<string, AgentState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<WorkflowEvent[]>([]);
  const loadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const res = await api.listDecisions(undefined, 1, 20);
        if (!cancelled) setRecentEvents(res.data);
      } catch { /* ignore */ }
      loadingRef.current = false;
    }
    load();
    const id = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (recentEvents.length === 0) return;
    setAgents(prev => {
      const updated = { ...prev };
      for (const ev of recentEvents) {
        const p = ev.payload_json as Record<string, unknown>;
        const agentName = (p.agent as string) || ev.source;
        const meta = AGENT_META[agentName];
        if (!meta) continue;

        const existing = updated[agentName];
        if (existing && existing.updatedAt > new Date(ev.created_at).getTime()) continue;

        updated[agentName] = {
          agent: agentName,
          department: agentDepartment(agentName) || (p.department as string) || "",
          status: "done",
          output: p,
          workflowId: ev.workflow_id,
          updatedAt: Date.now(),
        };
      }
      return updated;
    });
  }, [recentEvents]);

  useEffect(() => {
    let cancelled = false;
    async function pollThinking() {
      if (cancelled) return;
      try {
        const workflowsRes = await api.listWorkflows(undefined, 1, 50);
        const activeWfs = workflowsRes.data.filter(w => !["COMPLETED", "FAILED", "REJECTED"].includes(w.state));
        for (const wf of activeWfs) {
          const thinkingRes = await api.getWorkflowThinking(wf.id);
          const thinkingEvents = thinkingRes.data;
          for (const ev of thinkingEvents) {
            const p = ev.payload_json as Record<string, unknown>;
            const agentName = p.agent as string;
            if (!agentName || !AGENT_META[agentName]) continue;
            setAgents(prev => {
              const existing = prev[agentName];
              if (existing && existing.updatedAt > new Date(ev.created_at).getTime()) return prev;
              return {
                ...prev,
                [agentName]: {
                  agent: agentName,
                  department: agentDepartment(agentName) || (p.department as string) || "",
                  status: ev.event_type === "AGENT_THINKING_STARTED" ? "thinking" :
                          ev.event_type === "AGENT_THINKING_COMPLETED" ? "done" :
                          ev.event_type === "AGENT_THINKING_FAILED" ? "failed" : prev[agentName]?.status || "idle",
                  prompt: ev.event_type === "AGENT_THINKING_STARTED" ? (p.user_prompt as string) : prev[agentName]?.prompt,
                  output: ev.event_type === "AGENT_THINKING_COMPLETED" ? p.output as Record<string, unknown> : prev[agentName]?.output,
                  tokens: ev.event_type === "AGENT_THINKING_TOKEN" ? (prev[agentName]?.tokens || "") + (p.token as string) : prev[agentName]?.tokens,
                  workflowId: ev.workflow_id,
                  updatedAt: new Date(ev.created_at).getTime(),
                },
              };
            });
          }
        }
      } catch { /* ignore */ }
    }
    pollThinking();
    const id = setInterval(pollThinking, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const agentList = Object.values(agents).sort((a, b) => b.updatedAt - a.updatedAt);
  if (agentList.length === 0) return null;

  return (
    <div className="icc-card col-span-12 rounded-lg border" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
      <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--color-hairline)" }}>
        <Brain className="w-4 h-4" style={{ color: "var(--color-signal-violet)" }} />
        <h2 className="font-semibold text-base tracking-wide">Agent Brain</h2>
        <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
          {agentList.filter(a => a.status === "thinking").length} thinking
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {agentList.map((agent) => {
          const meta = AGENT_META[agent.agent] || { Icon: Brain, color: "var(--color-muted)" };
          const isExpanded = expanded === agent.agent;
          return (
            <motion.div
              key={agent.agent}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border p-4 cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: agent.status === "thinking" ? "rgba(245, 166, 35, 0.06)" : "var(--color-panel-raised)",
                borderColor: agent.status === "thinking" ? meta.color : "var(--color-hairline)",
              }}
              onClick={() => setExpanded(isExpanded ? null : agent.agent)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${meta.color}20` }}>
                  <meta.Icon className="w-5 h-5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {agent.agent.replace("Agent", "")}
                  </p>
                  <p className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{agent.department}</p>
                </div>
                {agent.status === "thinking" && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 className="w-4 h-4" style={{ color: meta.color }} />
                  </motion.div>
                )}
                {agent.status === "done" && <Sparkles className="w-4 h-4" style={{ color: "var(--color-signal-green)" }} />}
                {agent.status === "failed" && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-signal-red)" }} />}
              </div>

              {agent.output && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>Decision</span>
                    <span className="text-xs font-mono font-semibold" style={{ color: meta.color }}>
                      {(agent.output.confidence as number) > 0
                        ? `${Math.round((agent.output.confidence as number) * 100)}% confidence`
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    {agent.output.decision as string}
                  </p>
                  <p className="text-xs line-clamp-2" style={{ color: "var(--color-muted)" }}>
                    {agent.output.reasoning_summary as string}
                  </p>
                </div>
              )}

              {agent.status === "thinking" && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="h-0.5 rounded-full mt-2"
                  style={{ backgroundColor: meta.color }}
                />
              )}

              <AnimatePresence>
                {isExpanded && agent.prompt && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="rounded-md p-3 space-y-2" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-hairline)" }}>
                      <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>Prompt</label>
                      <pre className="text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto" style={{ color: "var(--color-muted)" }}>
                        {agent.prompt}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}