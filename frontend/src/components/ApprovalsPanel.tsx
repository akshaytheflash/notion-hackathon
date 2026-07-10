import type { Approval } from "../lib/api";

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
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-sm tracking-wide">Approvals</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {approvals.length === 0 && (
          <p className="text-xs" style={{ color: "var(--color-dim)" }}>
            No approval requests yet.
          </p>
        )}
        {pending.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border p-3 animate-border-pulse"
            style={{ borderColor: "var(--color-signal-amber)", backgroundColor: "var(--color-panel-raised)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono" style={{ color: "var(--color-signal-amber)" }}>
                PENDING
              </span>
              <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                {a.approval_id.slice(0, 8)}
              </span>
            </div>
            <p className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>
              workflow {a.workflow_id.slice(0, 8)} — waiting on human decision in Notion
            </p>
          </div>
        ))}
        {resolved.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--color-hairline)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono" style={{ color: statusColor(a.last_known_status) }}>
                {a.last_known_status}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                {a.approval_id.slice(0, 8)}
              </span>
            </div>
            <p className="text-[11px] font-mono" style={{ color: "var(--color-dim)" }}>
              workflow {a.workflow_id.slice(0, 8)} — resolved
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
