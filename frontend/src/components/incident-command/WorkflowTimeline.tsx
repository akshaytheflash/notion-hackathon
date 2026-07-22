import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Check, X, Clock, AlertTriangle } from "lucide-react";

interface TimelineNode {
  state: string;
  label: string;
  status: "past" | "current" | "future" | "skipped" | "failed";
}

function nodeColor(status: string) {
  switch (status) {
    case "past": return { dot: "var(--color-signal-cyan)", bg: "var(--color-signal-cyan)" };
    case "current": return { dot: "var(--color-signal-amber)", bg: "rgba(245, 166, 35, 0.15)" };
    case "failed": return { dot: "var(--color-signal-red)", bg: "rgba(239, 83, 80, 0.15)" };
    case "skipped": return { dot: "var(--color-hairline)", bg: "transparent" };
    default: return { dot: "var(--color-hairline)", bg: "transparent" };
  }
}

function getStatus(step: string, stateSeq: string[], current: string): TimelineNode["status"] {
  if (current === "FAILED") return stateSeq.includes(step) ? "past" : "skipped";
  if (current === "REJECTED") {
    if (step === current) return "failed";
    return stateSeq.includes(step) ? "past" : "skipped";
  }
  if (step === current) return "current";
  return stateSeq.includes(step) ? "past" : "future";
}

export function WorkflowTimeline({ currentState, events }: { currentState: string; events: { event_type: string; payload_json: Record<string, unknown>; created_at: string }[] }) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const { mainPath, branchPath, branched } = useMemo(() => {
    const stateEvents = events.filter(e => e.event_type.startsWith("STATE_"));
    const stateSeq = stateEvents.map(e => e.event_type.replace("STATE_", ""));

    const wentThroughAppeal = stateSeq.includes("FINANCE_REJECTED") || stateSeq.includes("ENGINEERING_APPEAL");
    const isOnAppealPath = wentThroughAppeal || ["FINANCE_REJECTED", "ENGINEERING_APPEAL", "FINANCE_REEVALUATION", "APPROVAL_REQUIRED", "WAITING_FOR_APPROVAL"].includes(currentState);

    const MAIN_PIPELINE = [
      "CREATED", "ENGINEERING_ANALYSIS", "RESOURCE_REQUESTED",
      "FINANCE_REVIEW", "APPROVED", "EXECUTING", "OPERATIONS_REVIEW", "COMPLETED",
    ];

    const BRANCH_PIPELINE = [
      "FINANCE_REJECTED", "ENGINEERING_APPEAL", "FINANCE_REEVALUATION",
      "APPROVAL_REQUIRED", "WAITING_FOR_APPROVAL",
    ];

    const mainPath: TimelineNode[] = MAIN_PIPELINE.map(s => ({
      state: s,
      label: s === "ENGINEERING_ANALYSIS" ? "Eng. Analysis" :
             s === "RESOURCE_REQUESTED" ? "Resource Req." :
             s === "FINANCE_REVIEW" ? "Finance Review" :
             s === "OPERATIONS_REVIEW" ? "Ops Review" :
             s === "COMPLETED" ? "Completed" :
             s.charAt(0) + s.slice(1).toLowerCase(),
      status: getStatus(s, stateSeq, currentState),
    }));

    const branchPath: TimelineNode[] = isOnAppealPath
      ? BRANCH_PIPELINE.map(s => ({
          state: s,
          label: s === "FINANCE_REJECTED" ? "Finance Rejects" :
                 s === "ENGINEERING_APPEAL" ? "Eng. Appeal" :
                 s === "FINANCE_REEVALUATION" ? "Re-evaluation" :
                 s === "APPROVAL_REQUIRED" ? "Approval Req." :
                 s === "WAITING_FOR_APPROVAL" ? "Human Approval" : s,
          status: getStatus(s, stateSeq, currentState),
        }))
      : [];

    return { mainPath, branchPath, branched: branchPath.length > 0 };
  }, [currentState, events]);

  function renderNode(node: TimelineNode, index: number, isBranch: boolean) {
    const colors = nodeColor(node.status);
    const list = isBranch ? branchPath : mainPath;
    const isLast = index === list.length - 1;
    const showConnector = !isLast;
    const isExpanded = expandedNode === `${isBranch ? "b" : "m"}-${index}`;
    const nodeEvents = events.filter(e => e.event_type.endsWith(node.state) || e.event_type === node.state);
    const stateDiff = nodeEvents.length > 0 ? nodeEvents[0].payload_json : null;

    return (
      <div key={`${isBranch ? "b" : "m"}-${index}`} className="flex items-start">
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.08, type: "spring", stiffness: 200 }}
            className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 cursor-pointer"
            style={{
              borderColor: colors.dot,
              backgroundColor: node.status === "current" ? colors.bg : colors.dot,
              boxShadow: node.status === "current" ? `0 0 16px 3px ${colors.dot}` : "none",
            }}
            onClick={() => setExpandedNode(isExpanded ? null : `${isBranch ? "b" : "m"}-${index}`)}
          >
            {node.status === "current" ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.dot }} />
            ) : node.status === "past" ? (
              <Check className="w-4 h-4" style={{ color: "#fff" }} />
            ) : node.status === "failed" ? (
              <X className="w-4 h-4" style={{ color: "#fff" }} />
            ) : (
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
            )}
          </motion.div>
          {showConnector && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: isExpanded ? 80 : 28 }}
              className="w-0.5 my-1 transition-all duration-300"
              style={{ backgroundColor: node.status === "future" || node.status === "skipped" ? "var(--color-hairline)" : "var(--color-signal-cyan)" }}
            />
          )}
        </div>
        <div className="ml-3 flex-1 min-w-0" style={{ marginTop: node.status === "future" || node.status === "skipped" ? 6 : 4 }}>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setExpandedNode(isExpanded ? null : `${isBranch ? "b" : "m"}-${index}`)}
          >
            <span className="text-sm font-mono font-medium" style={{ color: node.status === "future" || node.status === "skipped" ? "var(--color-dim)" : "var(--color-text)" }}>
              {node.label}
            </span>
            {node.status === "current" && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--color-signal-amber)", color: "#000" }}
              >
                ACTIVE
              </motion.span>
            )}
            {node.status === "failed" && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-signal-red)", color: "#fff" }}>
                REJECTED
              </span>
            )}
            <button className="ml-auto" style={{ color: "var(--color-dim)" }}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </motion.div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 overflow-hidden"
              >
                <div className="rounded-md p-3 space-y-2" style={{ backgroundColor: "var(--color-panel-raised)", border: "1px solid var(--color-hairline)" }}>
                  {stateDiff && (
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>State Data</span>
                      <pre className="text-xs font-mono mt-1 whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
                        {JSON.stringify(stateDiff, null, 2)}
                      </pre>
                    </div>
                  )}
                  {nodeEvents.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>Events</span>
                      {nodeEvents.map((ev, i) => (
                        <p key={i} className="text-xs font-mono mt-1" style={{ color: "var(--color-muted)" }}>
                          {ev.event_type} — {new Date(ev.created_at).toLocaleTimeString()}
                        </p>
                      ))}
                    </div>
                  )}
                  {!stateDiff && nodeEvents.length === 0 && (
                    <p className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>No details available for this state.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const terminal = currentState === "FAILED" ? "FAILED" : currentState === "REJECTED" ? "REJECTED" : null;

  return (
    <div>
      <div className="space-y-0">
        {mainPath.map((node, i) => renderNode(node, i, false))}
      </div>

      {branched && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="ml-4 mt-2 pl-4 border-l-2"
          style={{ borderColor: "var(--color-signal-violet)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--color-signal-violet)" }} />
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: "var(--color-signal-violet)" }}>
              Appeal Branch
            </span>
          </div>
          {branchPath.map((node, i) => renderNode(node, i, true))}
        </motion.div>
      )}

      {terminal && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
          className="mt-4 rounded-lg p-4 text-center"
          style={{
            backgroundColor: terminal === "FAILED" ? "rgba(239, 83, 80, 0.1)" : "rgba(239, 83, 80, 0.06)",
            border: "1px solid var(--color-signal-red)",
          }}
        >
          <span className="text-sm font-mono font-bold" style={{ color: "var(--color-signal-red)" }}>
            {terminal === "FAILED" ? "Workflow Failed" : "Workflow Rejected"}
          </span>
        </motion.div>
      )}
    </div>
  );
}