import type { Workflow } from "./api";

const TERMINAL_SUCCESS = "COMPLETED";
const TERMINAL_FAIL = new Set(["FAILED", "REJECTED"]);

export interface DashboardMetrics {
  /** Mean time to resolution, formatted like "8m 42s", or null if no completed workflows. */
  mttrLabel: string | null;
  /** Count of workflows not yet in a terminal state. */
  activeCount: number;
  /** Percentage of workflows that ended COMPLETED, or null if there are no workflows at all. */
  autoResolvedPercent: number | null;
}

function isTerminal(state: string): boolean {
  return state === TERMINAL_SUCCESS || TERMINAL_FAIL.has(state);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function computeDashboardMetrics(workflows: Workflow[]): DashboardMetrics {
  const completed = workflows.filter((w) => w.state === TERMINAL_SUCCESS && w.completed_at);
  const mttrLabel =
    completed.length > 0
      ? formatDuration(
          completed.reduce((sum, w) => {
            const start = new Date(w.created_at).getTime();
            const end = new Date(w.completed_at as string).getTime();
            return sum + Math.max(0, end - start);
          }, 0) / completed.length
        )
      : null;

  const activeCount = workflows.filter((w) => !isTerminal(w.state)).length;

  const autoResolvedPercent =
    workflows.length > 0 ? (completed.length / workflows.length) * 100 : null;

  return { mttrLabel, activeCount, autoResolvedPercent };
}
