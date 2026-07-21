import { Check, X } from "lucide-react";
import type { Approval } from "../../lib/incident-command/api";

function statusColor(status: string): string {
  if (status === "APPROVED") return "var(--color-signal-green)";
  if (status === "REJECTED") return "var(--color-signal-red)";
  return "var(--color-signal-amber)";
}

export function ApprovalsPanel({ approvals }: { approvals: Approval[] }) {
  const pending = approvals.filter((a) => !a.processed);
  const resolved = approvals.filter((a) => a.processed);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-base tracking-wide">Approvals</h2>
        {approvals.length > 0 && (
          <span
            className="text-xs font-mono font-semibold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center"
            style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}
          >
            {approvals.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {approvals.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>
            No approval requests yet.
          </p>
        )}
        {pending.map((a) => (
          <div
            key={a.id}
            className="icc-card rounded-lg border p-4 animate-border-pulse"
            style={{ borderColor: "var(--color-signal-amber)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-mono" style={{ color: "var(--color-signal-amber)" }}>
                PENDING
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                {a.approval_id.slice(0, 8)}
              </span>
            </div>
            <p className="text-xs font-mono mb-3" style={{ color: "var(--color-muted)" }}>
              workflow {a.workflow_id.slice(0, 8)} — waiting on human decision
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Connect a backend to enable approvals"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold opacity-50 cursor-not-allowed"
                style={{ backgroundColor: "var(--color-signal-green)", color: "var(--color-ink)" }}
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                disabled
                title="Connect a backend to enable approvals"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold opacity-50 cursor-not-allowed"
                style={{ backgroundColor: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
        {resolved.map((a) => (
          <div
            key={a.id}
            className="icc-card rounded-lg border p-4"
            style={{ borderColor: "var(--color-hairline)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-mono" style={{ color: statusColor(a.last_known_status) }}>
                {a.last_known_status}
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
                {a.approval_id.slice(0, 8)}
              </span>
            </div>
            <p className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>
              workflow {a.workflow_id.slice(0, 8)} — resolved
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
