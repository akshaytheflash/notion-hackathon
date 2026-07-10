import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WorkflowEvent } from "../lib/api";
import { SkeletonCardList } from "../components/Skeleton";

export default function Policies() {
  const [policies, setPolicies] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listPolicies();
      setPolicies(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
          Policy Engine
        </span>
        <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>
          Spending limit evaluations and policy enforcement results.
        </p>
      </div>

      {loading && <SkeletonCardList items={3} />}

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-xs font-mono"
          style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}
        >
          {error}
        </div>
      )}

      {!loading && !error && policies.length === 0 && (
        <div
          className="rounded-lg border px-6 py-12 text-center"
          style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>No policy evaluations recorded yet.</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-dim)" }}>Run the demo to trigger spending limit checks.</p>
        </div>
      )}

      {!loading && policies.length > 0 && (
        <div className="space-y-3">
          {policies.map((p) => {
            const payload = p.payload_json as Record<string, unknown>;
            const passed = payload.passed === true;
            const requested = typeof payload.requested_amount === "number" ? payload.requested_amount : null;
            const limit = typeof payload.limit === "number" ? payload.limit : null;

            return (
              <div
                key={p.id}
                className="rounded-lg border p-4"
                style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: passed ? "var(--color-signal-green)" : "var(--color-signal-red)",
                        border: `1px solid ${passed ? "var(--color-signal-green)" : "var(--color-signal-red)"}`,
                      }}
                    >
                      {passed ? "PASSED" : "FAILED"}
                    </span>
                    {typeof payload.policy_name === "string" && (
                      <span className="text-xs font-mono" style={{ color: "var(--color-text)" }}>
                        {payload.policy_name}
                      </span>
                    )}
                    {typeof payload.policy_id === "string" && (
                      <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                        {payload.policy_id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/workflows/${p.workflow_id}`}
                      className="text-[10px] font-mono"
                      style={{ color: "var(--color-signal-cyan)" }}
                    >
                      wf_{p.workflow_id.slice(0, 8)}
                    </Link>
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-dim)" }}>
                      {new Date(p.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <MetricCard
                    label="Requested"
                    value={requested != null ? `\u20B9${requested.toLocaleString()}` : "\u2014"}
                  />
                  <MetricCard
                    label="Limit"
                    value={limit != null ? `\u20B9${limit.toLocaleString()}` : "\u2014"}
                  />
                  <MetricCard
                    label="Required Action"
                    value={typeof payload.required_action === "string" ? payload.required_action : "\u2014"}
                  />
                </div>

                {typeof payload.violation === "string" && payload.violation && (
                  <div className="mt-3">
                    <label className="text-[10px] font-mono uppercase tracking-wider mb-0.5 block" style={{ color: "var(--color-dim)" }}>Violation</label>
                    <p className="text-xs" style={{ color: "var(--color-signal-red)" }}>{payload.violation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}
    >
      <label className="text-[10px] font-mono uppercase tracking-wider block mb-0.5" style={{ color: "var(--color-dim)" }}>{label}</label>
      <span className="text-xs font-mono" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
