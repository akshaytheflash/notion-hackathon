import { useEffect, useRef, useState } from "react";
import { api, type WorkflowEvent } from "../../lib/incident-command/api";
import { Brain, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface ThinkingTrace {
  agent: string;
  department: string;
  workflowState: string;
  systemPrompt: string;
  userPrompt: string;
  tokens: string;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

function buildTraces(events: WorkflowEvent[]): ThinkingTrace[] {
  const traces: ThinkingTrace[] = [];
  let current: Partial<ThinkingTrace> | null = null;

  for (const ev of events) {
    const p = ev.payload_json as Record<string, unknown>;
    if (ev.event_type === "AGENT_THINKING_STARTED") {
      if (current) traces.push(current as ThinkingTrace);
      current = {
        agent: p.agent as string,
        department: p.department as string,
        workflowState: p.workflow_state as string,
        systemPrompt: p.system_prompt as string,
        userPrompt: p.user_prompt as string,
        tokens: "",
        startedAt: ev.created_at,
      };
    } else if (ev.event_type === "AGENT_THINKING_TOKEN" && current) {
      current.tokens = (current.tokens || "") + (p.token as string);
    } else if (ev.event_type === "AGENT_THINKING_COMPLETED" && current) {
      current.output = p.output as Record<string, unknown>;
      current.completedAt = ev.created_at;
      traces.push(current as ThinkingTrace);
      current = null;
    } else if (ev.event_type === "AGENT_THINKING_FAILED" && current) {
      current.error = p.error as string;
      traces.push(current as ThinkingTrace);
      current = null;
    }
  }
  if (current) traces.push(current as ThinkingTrace);
  return traces;
}

export function AgentThinking({ workflowId, enabled }: { workflowId: string; enabled: boolean }) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !workflowId) return;
    let cancelled = false;
    async function load() {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const res = await api.getWorkflowThinking(workflowId);
        if (!cancelled) setEvents(res.data);
      } catch { /* ignore */ }
      loadingRef.current = false;
    }
    load();
    const id = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [workflowId, enabled]);

  const traces = buildTraces(events);
  if (!enabled || traces.length === 0) return null;

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className="icc-card rounded-lg border" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
      <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--color-hairline)" }}>
        <Brain className="w-4 h-4" style={{ color: "var(--color-signal-cyan)" }} />
        <h2 className="font-semibold text-base tracking-wide">AI Thinking</h2>
        <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{traces.length} trace{traces.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-hairline)" }}>
        {traces.map((trace, i) => (
          <div key={i} className="px-5 py-3.5" style={{ borderColor: "var(--color-hairline)" }}>
            <button onClick={() => toggle(i)} className="flex items-center gap-2 w-full text-left">
              {expanded.has(i) ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-dim)" }} /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-dim)" }} />}
              <span className="text-sm font-mono font-medium" style={{ color: "var(--color-signal-cyan)" }}>{trace.agent}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--color-dim)", backgroundColor: "var(--color-hairline)" }}>{trace.department}</span>
              {!trace.completedAt && !trace.error && <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--color-signal-amber)" }} />}
              {trace.output && (
                <span className="text-xs font-mono ml-auto" style={{ color: "var(--color-signal-green)" }}>
                  {(trace.output.confidence as number) > 0 ? `Confidence: ${Math.round((trace.output.confidence as number) * 100)}%` : "Done"}
                </span>
              )}
              {trace.error && <span className="text-xs font-mono ml-auto" style={{ color: "var(--color-signal-red)" }}>Failed</span>}
            </button>

            {expanded.has(i) && (
              <div className="mt-3 space-y-3 pl-5">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>System Prompt</label>
                  <pre className="text-xs font-mono whitespace-pre-wrap rounded-md p-3 max-h-48 overflow-y-auto" style={{ backgroundColor: "var(--color-panel-raised)", color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}>{trace.systemPrompt}</pre>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>User Prompt</label>
                  <pre className="text-xs font-mono whitespace-pre-wrap rounded-md p-3 max-h-48 overflow-y-auto" style={{ backgroundColor: "var(--color-panel-raised)", color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}>{trace.userPrompt}</pre>
                </div>

                {trace.tokens && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Raw Response</label>
                    <pre className="text-xs font-mono whitespace-pre-wrap rounded-md p-3 max-h-64 overflow-y-auto" style={{ backgroundColor: "var(--color-panel-raised)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>{trace.tokens}</pre>
                  </div>
                )}

                {trace.output && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Structured Output</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>Decision:</span>
                        <span className="text-sm font-mono font-medium" style={{ color: "var(--color-signal-cyan)" }}>{trace.output.decision as string}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>Reasoning:</span>
                        <span className="text-sm" style={{ color: "var(--color-text)" }}>{trace.output.reasoning_summary as string}</span>
                      </div>
                      {(trace.output.confidence as number) > 0 && (
                        <div>
                          <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>Confidence</span>
                          <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-hairline)" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{
                              width: `${Math.round((trace.output.confidence as number) * 100)}%`,
                              backgroundColor: "var(--color-signal-cyan)",
                            }} />
                          </div>
                          <span className="text-xs font-mono mt-0.5 block" style={{ color: "var(--color-dim)" }}>{Math.round((trace.output.confidence as number) * 100)}%</span>
                        </div>
                      )}
                      {trace.output.evidence && (
                        <div>
                          <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>Evidence</span>
                          <p className="text-sm mt-0.5" style={{ color: "var(--color-text)" }}>{trace.output.evidence as string}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {trace.error && (
                  <div className="rounded-md px-3 py-2 text-xs font-mono" style={{ color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)", border: "1px solid var(--color-signal-red)" }}>
                    {trace.error}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}