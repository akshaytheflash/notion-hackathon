import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { api, type Approval } from "../../lib/incident-command/api";

function statusColor(status: string): string {
  if (status === "APPROVED") return "var(--color-signal-green)";
  if (status === "REJECTED") return "var(--color-signal-red)";
  return "var(--color-signal-amber)";
}

interface ApprovalsPanelProps {
  approvals: Approval[];
  onAction?: () => void;
}

export function ApprovalsPanel({ approvals, onAction }: ApprovalsPanelProps) {
  const pending = approvals.filter((a) => !a.processed);
  const resolved = approvals.filter((a) => a.processed);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      await api.approveApproval(id);
      onAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      await api.rejectApproval(id);
      onAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-base tracking-wide">Approvals</h2>
        {pending.length > 0 && (
          <span
            className="text-xs font-mono font-semibold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center"
            style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}
          >
            {pending.length}
          </span>
        )}
      </div>
      {error && (
        <div className="mx-4 mt-3 rounded-md px-3 py-2 text-xs font-mono" style={{ color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.08)", border: "1px solid var(--color-signal-red)" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}
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
                onClick={() => handleApprove(a.id)}
                disabled={loadingId === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-signal-green)", color: "var(--color-ink)" }}
              >
                {loadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {loadingId === a.id ? "Processing…" : "Approve"}
              </button>
              <button
                onClick={() => handleReject(a.id)}
                disabled={loadingId === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
              >
                {loadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                {loadingId === a.id ? "Processing…" : "Reject"}
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
