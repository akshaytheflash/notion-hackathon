import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Siren, GitBranch, ShieldCheck, Scale, ScrollText, Terminal, Play, X } from "lucide-react";
import { api } from "../../lib/incident-command/api";

const COMMANDS = [
  { id: "dashboard", label: "Go to Dashboard", icon: Terminal, action: "/" },
  { id: "incidents", label: "Go to Incidents", icon: Siren, action: "/incidents" },
  { id: "workflows", label: "Go to Workflows", icon: GitBranch, action: "/workflows" },
  { id: "decisions", label: "Go to Decisions", icon: ShieldCheck, action: "/decisions" },
  { id: "policies", label: "Go to Policies", icon: Scale, action: "/policies" },
  { id: "action-log", label: "Go to Action Log", icon: ScrollText, action: "/action-log" },
  { id: "run-demo", label: "Run P0 Incident Demo", icon: Play, action: "run-demo" },
  { id: "clear", label: "Clear Database", icon: X, action: "clear" },
];

export function CommandPalette({ onRunDemo }: { onRunDemo?: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof COMMANDS>([]);
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((p) => !p);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(COMMANDS);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(COMMANDS);
      return;
    }
    const q = query.toLowerCase();
    setResults(COMMANDS.filter(c => c.label.toLowerCase().includes(q)));
    setSelected(0);
  }, [query]);

  const execute = useCallback(async (cmd: typeof COMMANDS[0]) => {
    setOpen(false);
    if (cmd.action === "run-demo") {
      onRunDemo?.();
    } else if (cmd.action === "clear") {
      if (confirm("Clear all data?")) {
        await api.clearDatabase();
        window.location.reload();
      }
    } else {
      navigate(cmd.action);
    }
  }, [navigate, onRunDemo]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); if (results[selected]) execute(results[selected]); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        ref={listRef}
        className="relative w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--color-hairline)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-dim)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--color-dim)", backgroundColor: "var(--color-hairline)" }}>ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm font-mono" style={{ color: "var(--color-dim)" }}>No results</div>
          ) : (
            results.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => execute(cmd)}
                onMouseEnter={() => setSelected(i)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{
                  backgroundColor: i === selected ? "rgba(69, 217, 200, 0.08)" : "transparent",
                  color: i === selected ? "var(--color-text)" : "var(--color-muted)",
                }}
              >
                <cmd.icon className="w-4 h-4 shrink-0" style={{ color: "var(--color-signal-cyan)" }} />
                <span>{cmd.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}