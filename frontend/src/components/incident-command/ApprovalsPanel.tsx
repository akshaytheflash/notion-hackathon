import { ExternalLink } from "lucide-react";
import type { Approval } from "../../lib/incident-command/api";
import { useEffect, useState } from "react";

function statusColor(status: string): string {
  if (status === "APPROVED") return "var(--color-signal-green)";
  if (status === "REJECTED") return "var(--color-signal-red)";
  return "var(--color-signal-amber)";
}

interface ApprovalsPanelProps {
  approvals: Approval[];
}

export function ApprovalsPanel({ approvals }: ApprovalsPanelProps) {
  const pending = approvals.filter((a) => !a.processed);
  const resolved = approvals.filter((a) => a.processed);
  const [notionUrl, setNotionUrl] = useState("");

  useEffect(() => {
    if (!notionUrl && approvals.length > 0 && approvals[0].notion_url) {
      setNotionUrl(approvals[0].notion_url);
    }
  }, [approvals]);

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
            <p className="text-xs font-mono mb-2" style={{ color: "var(--color-muted)" }}>
              workflow {a.workflow_id.slice(0, 8)} — waiting on human decision
            </p>
            <p className="text-xs font-mono mb-3" style={{ color: "var(--color-muted)" }}>
              Approve or reject in Notion — the system will pick up the change automatically.
            </p>
            {a.notion_url && (
              <a
                href={a.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View in Notion
              </a>
            )}
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