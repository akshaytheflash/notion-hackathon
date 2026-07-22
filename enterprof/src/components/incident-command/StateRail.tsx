export const PIPELINE: { state: string; label: string }[] = [
  { state: "CREATED", label: "Created" },
  { state: "ENGINEERING_ANALYSIS", label: "Eng. Analysis" },
  { state: "RESOURCE_REQUESTED", label: "Resource Req." },
  { state: "FINANCE_REVIEW", label: "Finance Review" },
  { state: "FINANCE_REJECTED", label: "Finance Rejects" },
  { state: "ENGINEERING_APPEAL", label: "Eng. Appeal" },
  { state: "FINANCE_REEVALUATION", label: "Finance Re-eval" },
  { state: "APPROVAL_REQUIRED", label: "Approval Req." },
  { state: "WAITING_FOR_APPROVAL", label: "Awaiting Human" },
  { state: "APPROVED", label: "Approved" },
  { state: "EXECUTING", label: "Executing" },
  { state: "OPERATIONS_REVIEW", label: "Ops Review" },
  { state: "COMPLETED", label: "Completed" },
];

const TERMINAL_FAIL = new Set(["REJECTED", "FAILED"]);

/** Returns 0-100 based on the workflow state's position in the pipeline. */
export function getProgressPercent(state: string): number {
  if (state === "COMPLETED") return 100;
  if (TERMINAL_FAIL.has(state)) return 100;
  const index = PIPELINE.findIndex((p) => p.state === state);
  if (index === -1) return 0;
  return Math.round((index / (PIPELINE.length - 1)) * 100);
}

function colorForState(state: string, isCurrent: boolean, isPast: boolean) {
  if (state === "COMPLETED" && isCurrent) return "var(--color-signal-green)";
  if (state === "WAITING_FOR_APPROVAL" && isCurrent) return "var(--color-signal-amber)";
  if ((state === "FINANCE_REJECTED" || state === "ENGINEERING_APPEAL" || state === "FINANCE_REEVALUATION") && isCurrent)
    return "var(--color-signal-violet)";
  if (isCurrent) return "var(--color-signal-cyan)";
  if (isPast) return "var(--color-muted)";
  return "var(--color-hairline)";
}

export function StateRail({ currentState }: { currentState: string }) {
  const failed = TERMINAL_FAIL.has(currentState);
  const currentIndex = failed ? PIPELINE.length : PIPELINE.findIndex((p) => p.state === currentState);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max px-1">
        {PIPELINE.map((step, i) => {
          const isCurrent = !failed && step.state === currentState;
          const isPast = !failed && currentIndex > i;
          const dotColor = colorForState(step.state, isCurrent, isPast);
          return (
            <div key={step.state} className="flex items-center">
              <div className="flex flex-col items-center gap-2 w-[104px]">
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isCurrent ? "animate-pulse-dot" : ""}`}
                  style={{
                    borderColor: dotColor,
                    backgroundColor: isCurrent || isPast ? dotColor : "transparent",
                    boxShadow: isCurrent ? `0 0 12px 2px ${dotColor}` : "none",
                  }}
                />
                <span
                  className="text-[11px] font-mono text-center leading-tight"
                  style={{ color: isCurrent ? "var(--color-text)" : "var(--color-dim)" }}
                >
                  {step.label}
                </span>
              </div>
              {i < PIPELINE.length - 1 && (
                <div
                  className="h-[2px] w-8 -mt-5 transition-colors duration-300"
                  style={{ backgroundColor: isPast ? "var(--color-muted)" : "var(--color-hairline)" }}
                />
              )}
            </div>
          );
        })}
        {failed && (
          <div className="flex items-center">
            <div
              className="h-[2px] w-8 -mt-5"
              style={{ backgroundColor: "var(--color-signal-red)" }}
            />
            <div className="flex flex-col items-center gap-2 w-[104px]">
              <div
                className="w-4 h-4 rounded-full border-2"
                style={{
                  borderColor: "var(--color-signal-red)",
                  backgroundColor: "var(--color-signal-red)",
                  boxShadow: "0 0 12px 2px var(--color-signal-red)",
                }}
              />
              <span className="text-[11px] font-mono text-center leading-tight" style={{ color: "var(--color-text)" }}>
                {currentState === "REJECTED" ? "Rejected" : "Failed"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
