import type { IntegrationsStatus } from "../lib/api";

const LABELS: Record<keyof IntegrationsStatus, string> = {
  gemini: "Gemini",
  notion: "Notion",
  github: "GitHub",
  slack: "Slack",
};

export function IntegrationStrip({ status }: { status: IntegrationsStatus | null }) {
  const keys = Object.keys(LABELS) as (keyof IntegrationsStatus)[];
  return (
    <div className="flex items-center gap-4">
      {keys.map((k) => {
        const configured = status?.[k]?.configured ?? false;
        return (
          <div key={k} className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: configured ? "var(--color-signal-green)" : "var(--color-signal-red)",
              }}
            />
            <span className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>
              {LABELS[k]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
