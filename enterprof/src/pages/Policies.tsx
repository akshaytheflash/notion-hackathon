import { useCallback, useEffect, useState } from "react";
import { api, type Policy, type WorkflowEvent } from "../lib/incident-command/api";
import { Pagination } from "../components/incident-command/Pagination";

export default function Policies() {
  const [activePolicies, setActivePolicies] = useState<Policy[]>([]);
  const [evaluations, setEvaluations] = useState<WorkflowEvent[]>([]);
  const [evalTotal, setEvalTotal] = useState(0);
  const [evalPage, setEvalPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    policy_id: "POLICY-002",
    name: "",
    department: "Engineering",
    policy_type: "SPENDING_LIMIT",
    limit: 25000,
    required_action: "HUMAN_APPROVAL_REQUIRED",
    active: true,
  });
  const [adding, setAdding] = useState(false);
  const evalPageSize = 20;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [policies, evals] = await Promise.all([
        api.listActivePolicies(signal),
        api.listPolicies(signal, evalPage, evalPageSize),
      ]);
      setActivePolicies(policies);
      setEvaluations(evals.data);
      setEvalTotal(evals.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, [evalPage]);

  useEffect(() => {
    setLoading(true);
    const ac = new AbortController();
    refresh(ac.signal);
    const id = setInterval(() => refresh(ac.signal), 5000);
    return () => { clearInterval(id); ac.abort(); };
  }, [refresh]);

  async function handleAddPolicy() {
    if (!newPolicy.name.trim()) return;
    setAdding(true);
    setSuccess(null);
    try {
      await api.createPolicy(newPolicy);
      setNewPolicy({
        policy_id: `POLICY-${String(activePolicies.length + 2).padStart(3, "0")}`,
        name: "",
        department: "Engineering",
        policy_type: "SPENDING_LIMIT",
        limit: 25000,
        required_action: "HUMAN_APPROVAL_REQUIRED",
        active: true,
      });
      setShowAddForm(false);
      setSuccess("Policy created successfully");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add policy");
    } finally {
      setAdding(false);
    }
  }

  function getPolicyName(policy: Policy): string {
    const nameProp = policy.properties?.Name;
    if (nameProp?.title?.[0]?.text?.content) return nameProp.title[0].text.content;
    return "Unnamed Policy";
  }

  function getPolicyId(policy: Policy): string {
    const idProp = policy.properties?.["Policy ID"];
    if (idProp?.rich_text?.[0]?.text?.content) return idProp.rich_text[0].text.content;
    return policy.id;
  }

  function getDepartment(policy: Policy): string { return policy.properties?.Department?.select?.name || "N/A"; }
  function getLimit(policy: Policy): number { return policy.properties?.Limit?.number || 0; }
  function getRequiredAction(policy: Policy): string { return policy.properties?.["Required Action"]?.select?.name || "N/A"; }
  function isActive(policy: Policy): boolean { return policy.properties?.Active?.checkbox || false; }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>Policy Engine</span>
          <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Active policies and enforcement rules for autonomous spending limits.</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="rounded-md px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90" style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}>
          {showAddForm ? "Cancel" : "+ Add Policy"}
        </button>
      </div>

      {success && (
        <div className="rounded-lg border px-4 py-3 text-xs font-mono mb-4 flex items-center justify-between" style={{ borderColor: "var(--color-signal-green)", color: "var(--color-signal-green)", backgroundColor: "rgba(62, 207, 142, 0.06)" }}>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-3 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border px-4 py-3 text-xs font-mono mb-4 flex items-center justify-between" style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss error">Dismiss</button>
        </div>
      )}

      {showAddForm && (
        <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-signal-cyan)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>Add New Policy</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Policy Name</label>
              <input value={newPolicy.name} onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })} placeholder="e.g., DATA_ACCESS_LIMIT" className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Policy ID</label>
              <input value={newPolicy.policy_id} onChange={(e) => setNewPolicy({ ...newPolicy, policy_id: e.target.value })} className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Department</label>
              <select value={newPolicy.department} onChange={(e) => setNewPolicy({ ...newPolicy, department: e.target.value })} className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
                <option>Engineering</option><option>Finance</option><option>Operations</option><option>All Departments</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Policy Type</label>
              <select value={newPolicy.policy_type} onChange={(e) => setNewPolicy({ ...newPolicy, policy_type: e.target.value })} className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
                <option>SPENDING_LIMIT</option><option>TIME_LIMIT</option><option>ACCESS_CONTROL</option><option>COMPLIANCE</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Limit ($)</label>
              <input type="number" value={newPolicy.limit} onChange={(e) => setNewPolicy({ ...newPolicy, limit: Number(e.target.value) })} className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: "var(--color-dim)" }}>Required Action</label>
              <select value={newPolicy.required_action} onChange={(e) => setNewPolicy({ ...newPolicy, required_action: e.target.value })} className="rounded px-3.5 py-2.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
                <option>HUMAN_APPROVAL_REQUIRED</option><option>MANAGER_APPROVAL_REQUIRED</option><option>AUTO_APPROVE</option><option>REVIEW_REQUIRED</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newPolicy.active} onChange={(e) => setNewPolicy({ ...newPolicy, active: e.target.checked })} className="rounded" />
              <span className="text-sm" style={{ color: "var(--color-text)" }}>Active</span>
            </label>
            <button onClick={handleAddPolicy} disabled={adding || !newPolicy.name.trim()} className="rounded-md px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--color-signal-green)", color: "var(--color-ink)" }}>
              {adding ? "Adding..." : "Add Policy"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>Active Policies ({activePolicies.length})</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (<div key={i} className="rounded-lg border p-4 skeleton h-24" style={{ borderColor: "var(--color-hairline)" }} />))}
          </div>
        ) : activePolicies.length === 0 ? (
          <div className="rounded-lg border px-6 py-12 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
            <p className="text-base" style={{ color: "var(--color-dim)" }}>No active policies configured.</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Add a policy to enforce spending limits.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activePolicies.map((policy) => (
              <div key={policy.id} className="icc-card rounded-lg border p-5" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2.5 py-1 rounded" style={{ color: isActive(policy) ? "var(--color-signal-green)" : "var(--color-dim)", border: `1px solid ${isActive(policy) ? "var(--color-signal-green)" : "var(--color-dim)"}` }}>{isActive(policy) ? "ACTIVE" : "INACTIVE"}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{getPolicyName(policy)}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{getPolicyId(policy)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <PolicyMetric label="Department" value={getDepartment(policy)} />
                  <PolicyMetric label="Type" value={policy.properties?.["Policy Type"]?.select?.name || "N/A"} />
                  <PolicyMetric label="Limit" value={`$${getLimit(policy).toLocaleString()}`} />
                  <PolicyMetric label="Required Action" value={getRequiredAction(policy)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>Recent Policy Evaluations ({evalTotal})</h3>
        {evaluations.length === 0 ? (
          <div className="rounded-lg border px-6 py-12 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
            <p className="text-base" style={{ color: "var(--color-dim)" }}>No policy evaluations recorded yet.</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Run the demo to trigger spending limit checks.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.map((evaluation) => {
              const payload = evaluation.payload_json as Record<string, unknown>;
              const passed = payload.passed === true;
              const requested = typeof payload.requested_amount === "number" ? payload.requested_amount : null;
              const limit = typeof payload.limit === "number" ? payload.limit : null;

              return (
                <div key={evaluation.id} className="icc-card rounded-lg border p-5" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2.5 py-1 rounded" style={{ color: passed ? "var(--color-signal-green)" : "var(--color-signal-red)", border: `1px solid ${passed ? "var(--color-signal-green)" : "var(--color-signal-red)"}` }}>{passed ? "PASSED" : "FAILED"}</span>
                      {typeof payload.policy_name === "string" && <span className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{payload.policy_name}</span>}
                    </div>
                    <span className="text-xs font-mono" style={{ color: "var(--color-dim)" }}>{new Date(evaluation.created_at).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <PolicyMetric label="Requested" value={requested != null ? `$${requested.toLocaleString()}` : "—"} />
                    <PolicyMetric label="Limit" value={limit != null ? `$${limit.toLocaleString()}` : "—"} />
                    <PolicyMetric label="Required Action" value={typeof payload.required_action === "string" ? payload.required_action : "—"} />
                  </div>
                  {typeof payload.violation === "string" && payload.violation && (
                    <div className="mt-3">
                      <label className="text-xs font-mono uppercase tracking-wider mb-0.5 block" style={{ color: "var(--color-dim)" }}>Violation</label>
                      <p className="text-sm" style={{ color: "var(--color-signal-red)" }}>{payload.violation}</p>
                    </div>
                  )}
                </div>
              );
            })}
            <Pagination page={evalPage} total={evalTotal} pageSize={evalPageSize} onPageChange={setEvalPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3.5 py-2.5" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel-raised)" }}>
      <label className="text-xs font-mono uppercase tracking-wider block mb-0.5" style={{ color: "var(--color-dim)" }}>{label}</label>
      <span className="text-sm font-mono" style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
