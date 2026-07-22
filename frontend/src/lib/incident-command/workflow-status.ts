import { Ban, CheckCircle2, Hourglass, Zap } from "lucide-react";
import type { ComponentType } from "react";

export type WorkflowStatusGroup = "RUNNING" | "WAITING" | "RESOLVED" | "FAILED";

export interface WorkflowStatusMeta {
  group: WorkflowStatusGroup;
  colorVar: string;
  Icon: ComponentType<{ className?: string }>;
}

const WAITING_STATES = new Set(["WAITING_FOR_APPROVAL", "APPROVAL_REQUIRED"]);
const FAILED_STATES = new Set(["FAILED", "REJECTED"]);

export function stateColor(state: string): string {
  if (state === "COMPLETED") return "var(--color-signal-green)";
  if (FAILED_STATES.has(state)) return "var(--color-signal-red)";
  if (WAITING_STATES.has(state)) return "var(--color-signal-amber)";
  return "var(--color-signal-cyan)";
}

export function eventColor(eventType: string): string {
  if (eventType.includes("COMPLETED")) return "var(--color-signal-green)";
  if (eventType.includes("FAILED") || eventType.includes("REJECTED")) return "var(--color-signal-red)";
  if (eventType.includes("APPROVAL") || eventType.includes("PAUSED")) return "var(--color-signal-amber)";
  if (eventType.includes("POLICY")) return "var(--color-signal-violet)";
  if (eventType.startsWith("STATE_")) return "var(--color-signal-cyan)";
  return "var(--color-dim)";
}

export function getWorkflowStatusMeta(state: string): WorkflowStatusMeta {
  if (state === "COMPLETED") {
    return { group: "RESOLVED", colorVar: "var(--color-signal-green)", Icon: CheckCircle2 };
  }
  if (FAILED_STATES.has(state)) {
    return { group: "FAILED", colorVar: "var(--color-signal-red)", Icon: Ban };
  }
  if (WAITING_STATES.has(state)) {
    return { group: "WAITING", colorVar: "var(--color-signal-amber)", Icon: Hourglass };
  }
  return { group: "RUNNING", colorVar: "var(--color-signal-cyan)", Icon: Zap };
}
