import type { IntegrationsStatus } from "../../lib/incident-command/api";

const LABELS: Record<keyof IntegrationsStatus, string> = {
  gemini: "Gemini",
  notion: "Notion",
  github: "GitHub",
  slack: "Slack",
  pagerduty: "PagerDuty",
};

export function IntegrationStrip({ status }: { status: IntegrationsStatus | null }) {
  const keys = Object.keys(LABELS) as (keyof IntegrationsStatus)[];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {keys.map((k) => {
        const configured = status?.[k]?.configured ?? false;
        return (
          <div key={k} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full transition-colors duration-300 shrink-0"
              style={{
                backgroundColor: configured ? "var(--color-signal-green)" : "var(--color-signal-red)",
              }}
            />
            <span className="text-xs font-mono truncate" style={{ color: "var(--color-muted)" }}>
              {LABELS[k]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
