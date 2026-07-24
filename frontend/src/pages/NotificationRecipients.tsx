import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/incident-command/api";
import { Plus, Trash2, Mail, Check, X } from "lucide-react";

type Recipient = {
  id: string;
  role: string;
  email: string;
  created_at: string;
};

const ROLE_OPTIONS = [
  "financial_head",
  "technical_head",
  "operations_head",
  "compliance_officer",
  "engineering_manager",
  "security_lead",
];

export default function NotificationRecipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await api.listRecipients(signal);
      setRecipients(data);
      setError(null);
    } catch (e) {
      if (!signal?.aborted) setError("Failed to load recipients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    refresh(ac.signal);
    return () => ac.abort();
  }, [refresh]);

  async function handleSave() {
    if (!role.trim() || !email.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await api.updateRecipient(editId, { role: role.trim(), email: email.trim() });
      } else {
        await api.createRecipient({ role: role.trim(), email: email.trim() });
      }
      setShowForm(false);
      setEditId(null);
      setRole("");
      setEmail("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteRecipient(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  function startEdit(r: Recipient) {
    setEditId(r.id);
    setRole(r.role);
    setEmail(r.email);
    setShowForm(true);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>Notifications</span>
          <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Manage email recipients for incident completion summaries.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setRole(""); setEmail(""); }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90"
          style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
        >
          <Plus className="w-4 h-4" />
          Add Recipient
        </button>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm font-mono mb-4" style={{ borderColor: "var(--color-signal-red)", color: "var(--color-signal-red)", backgroundColor: "rgba(239, 83, 80, 0.06)" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2"><X className="w-3 h-3 inline" /></button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border p-4 mb-4 flex items-end gap-3" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="rounded px-2.5 py-1.5 text-sm min-w-[180px]" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }}>
              <option value="">Select a role…</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
              className="rounded px-2.5 py-1.5 text-sm w-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-hairline)" }} />
          </div>
          <button onClick={handleSave} disabled={saving || !role || !email}
            className="rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-signal-cyan)", color: "var(--color-ink)" }}>
            {saving ? "Saving…" : editId ? "Update" : "Add"}
          </button>
          <button onClick={() => { setShowForm(false); setEditId(null); }}
            className="rounded-md px-3 py-2 text-sm" style={{ color: "var(--color-dim)" }}>
            Cancel
          </button>
        </div>
      )}

      {loading && recipients.length === 0 && (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
          <p className="text-sm font-mono" style={{ color: "var(--color-dim)" }}>Loading recipients…</p>
        </div>
      )}

      {!loading && recipients.length === 0 && (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-panel)" }}>
          <Mail className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-dim)" }} />
          <p className="text-base" style={{ color: "var(--color-dim)" }}>No recipients configured.</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-dim)" }}>Add recipients to receive incident completion summaries via email.</p>
        </div>
      )}

      {recipients.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Role</th>
                <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Email</th>
                <th className="text-left px-5 py-3.5 font-mono font-medium" style={{ color: "var(--color-muted)" }}>Added</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className="transition-all duration-200 hover:bg-white/[0.03]" style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                  <td className="px-5 py-3.5 font-mono capitalize" style={{ color: "var(--color-text)" }}>{r.role.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3.5 font-mono" style={{ color: "var(--color-dim)" }}>{r.email}</td>
                  <td className="px-5 py-3.5 font-mono" style={{ color: "var(--color-dim)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => startEdit(r)} className="text-xs font-mono mr-3" style={{ color: "var(--color-signal-cyan)" }}>Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs font-mono" style={{ color: "var(--color-signal-red)" }}><Trash2 className="w-3.5 h-3.5 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
