import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Moon, SunMedium, Terminal } from "lucide-react";
import { useIccTheme } from "../lib/incident-command/useIccTheme";

export default function SignIn() {
  const { theme, toggleTheme } = useIccTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/");
  }

  return (
    <div className="icc-root min-h-screen flex items-center justify-center p-6" data-theme={theme}>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="fixed top-6 right-6 w-10 h-10 rounded-md flex items-center justify-center transition-all duration-200 hover:opacity-80"
        style={{ color: "var(--color-muted)", border: "1px solid var(--color-hairline)" }}
      >
        {theme === "dark" ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ backgroundColor: "var(--color-signal-amber)" }}
          >
            <Terminal className="w-6 h-6" style={{ color: "var(--color-ink)" }} />
          </div>
          <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-signal-cyan)" }}>
            Enterprise AI OS
          </p>
          <h1 className="text-xl font-semibold mt-0.5" style={{ color: "var(--color-text)" }}>
            Command Center
          </h1>
        </div>

        <div
          className="icc-card rounded-lg border p-8"
          style={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-hairline)" }}
        >
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text)" }}>
            Sign in to your workspace
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-dim)" }}>
            Access the incident command dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1.5" style={{ color: "var(--color-muted)" }}>
                Email
              </label>
              <div
                className="flex items-center gap-2.5 rounded-md px-3.5 py-3 border"
                style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-surface)" }}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--color-dim)" }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 bg-transparent text-sm outline-none min-w-0"
                  style={{ color: "var(--color-text)" }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider block mb-1.5" style={{ color: "var(--color-muted)" }}>
                Password
              </label>
              <div
                className="flex items-center gap-2.5 rounded-md px-3.5 py-3 border"
                style={{ borderColor: "var(--color-hairline)", backgroundColor: "var(--color-surface)" }}
              >
                <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--color-dim)" }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm outline-none min-w-0"
                  style={{ color: "var(--color-text)" }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-md px-4 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: "var(--color-signal-amber)", color: "var(--color-ink)" }}
            >
              Sign In
            </button>
          </form>

          <p className="text-xs mt-5 leading-relaxed" style={{ color: "var(--color-dim)" }}>
            Authentication requires Enter Cloud — currently running in demo mode.
          </p>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-mono" style={{ color: "var(--color-signal-cyan)" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
