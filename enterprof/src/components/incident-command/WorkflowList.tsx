import type { Workflow } from "../../lib/incident-command/api";
import { stateColor } from "../../lib/incident-command/workflow-status";
import { StateRail } from "./StateRail";

export function WorkflowList({ workflows }: { workflows: Workflow[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-hairline)" }}>
        <h2 className="font-semibold text-sm tracking-wide">Workflows</h2>
      </div>
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--color-hairline)" }}>
        {workflows.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--color-dim)" }}>
            No workflows yet. Run the demo scenario below to create one.
          </p>
        )}
        {workflows.map((w) => (
          <div key={w.id} className="p-4" style={{ borderColor: "var(--color-hairline)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
                  wf_{w.id.slice(0, 8)}
                </span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: stateColor(w.state),
                    border: `1px solid ${stateColor(w.state)}`,
                  }}
                >
                  {w.state}
                </span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                {new Date(w.updated_at).toLocaleTimeString()}
              </span>
            </div>
            <StateRail currentState={w.state} />
          </div>
        ))}
      </div>
    </div>
  );
}
