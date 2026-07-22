export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowSummary {
  workflow_id: string;
  incident_id: string;
  state: string;
  created_at: string;
  name?: string;
}

export interface Workflow {
  id: string;
  incident_id: string;
  state: string;
  pending_approval_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface WorkflowEvent {
  id: string;
  workflow_id: string;
  event_type: string;
  source: string;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface Approval {
  id: string;
  workflow_id: string;
  approval_id: string;
  last_known_status: string;
  processed: boolean;
  notion_url: string;
}

export interface IntegrationsStatus {
  gemini: { configured: boolean };
  notion: { configured: boolean };
  github: { configured: boolean };
  slack: { configured: boolean };
  pagerduty: { configured: boolean };
}

export interface IncidentDetail {
  workflow_id: string;
  incident_id: string;
  state: string;
  context: {
    name?: string;
    severity?: string;
    description?: string;
    revenue_risk_per_day?: number;
    requested_amount?: number;
    incident_id?: string;
    approval_id?: string;
  };
  created_at: string;
}

export interface Policy {
  id: string;
  properties: {
    Name?: { title: Array<{ text: { content: string } }> };
    "Policy ID"?: { rich_text: Array<{ text: { content: string } }> };
    Department?: { select: { name: string } };
    "Policy Type"?: { select: { name: string } };
    Limit?: { number: number };
    "Required Action"?: { select: { name: string } };
    Active?: { checkbox: boolean };
  };
}

export interface DashboardAnalytics {
  total_incidents: number;
  active_incidents: number;
  completed_incidents: number;
  failed_incidents: number;
  mttr_seconds: number | null;
  revenue_at_risk: number;
  sla_compliance: number;
  policy_passed: number;
  policy_failed: number;
  confidence_scores: number[];
  incidents_over_time: Array<{ date: string; count: number }>;
}

export interface SearchResult {
  incidents: WorkflowSummary[];
  workflows: { id: string; incident_id: string; state: string; name: string; created_at: string }[];
  decisions: { id: string; workflow_id: string; event_type: string; payload: Record<string, unknown>; created_at: string }[];
  policies: { id: string; policy_id: string; name: string; department: string; limit: number }[];
  events: { id: string; workflow_id: string; event_type: string; source: string; created_at: string }[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${body}`);
  }
  return res.json();
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  return entries.length ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : "";
}

export const api = {
  health: () => req<{ status: string }>("/health"),
  integrationsStatus: () => req<IntegrationsStatus>("/api/integrations/status"),
  notionSchemaStatus: () => req<{ status: string; data_source_id?: string }>("/api/notion/schema-status"),

  listWorkflows: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<Workflow>>(`/api/workflows${qs({ page, pageSize })}`, { signal }),
  getWorkflow: (id: string, signal?: AbortSignal) =>
    req<Workflow>(`/api/workflows/${id}`, { signal }),
  getWorkflowEvents: (workflowId: string, signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<WorkflowEvent>>(`/api/workflows/${workflowId}/events${qs({ page, pageSize })}`, { signal }),

  listIncidents: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<WorkflowSummary>>(`/api/incidents${qs({ page, pageSize })}`, { signal }),
  getIncident: (id: string, signal?: AbortSignal) =>
    req<IncidentDetail>(`/api/incidents/${id}`, { signal }),

  listApprovals: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<Approval>>(`/api/approvals${qs({ page, pageSize })}`, { signal }),
  approveApproval: (approvalId: string) =>
    req<Approval>(`/api/approvals/${approvalId}/approve`, { method: "POST" }),
  rejectApproval: (approvalId: string) =>
    req<Approval>(`/api/approvals/${approvalId}/reject`, { method: "POST" }),

  listDecisions: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<WorkflowEvent>>(`/api/decisions${qs({ page, pageSize })}`, { signal }),
  listPolicies: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<WorkflowEvent>>(`/api/policies${qs({ page, pageSize })}`, { signal }),
  listActionLog: (signal?: AbortSignal, page?: number, pageSize?: number) =>
    req<PaginatedResponse<WorkflowEvent>>(`/api/action-log${qs({ page, pageSize })}`, { signal }),
  listActivePolicies: (signal?: AbortSignal) =>
    req<Policy[]>("/api/policies/active", { signal }),

  createIncident: (body: { name: string; severity: string; description: string; revenue_risk_per_day: number }) =>
    req<{ workflow_id: string; incident_id: string }>("/api/incidents", { method: "POST", body: JSON.stringify(body) }),
  runPrimaryScenario: (body?: { name: string; severity: string; description: string; revenue_risk_per_day: number }) =>
    req<{ workflow_id: string; status: string; incident_id?: string; error?: string }>(
      "/api/demo/run-primary-scenario",
      { method: "POST", body: body ? JSON.stringify(body) : undefined }
    ),
  clearDatabase: () =>
    req<{ status: string; message: string }>("/api/admin/clear-database", { method: "POST" }),

  createPolicy: (body: {
    policy_id: string;
    name: string;
    department: string;
    policy_type: string;
    limit: number;
    required_action: string;
    active: boolean;
  }) =>
    req<Policy>("/api/policies", { method: "POST", body: JSON.stringify(body) }),

  search: (q: string, signal?: AbortSignal) =>
    req<SearchResult>(`/api/search${qs({ q })}`, { signal }),

  retryFailedActions: (workflowId: string) =>
    req<{ status: string; workflow_id: string; retried_count: number }>(`/api/workflows/${workflowId}/retry-failed-actions`, { method: "POST" }),

  pauseWorkflow: (workflowId: string) =>
    req<{ workflow_id: string; status: string }>(`/api/workflows/${workflowId}/pause`, { method: "POST" }),
  resumeWorkflow: (workflowId: string) =>
    req<{ workflow_id: string; status: string }>(`/api/workflows/${workflowId}/resume`, { method: "POST" }),
  cancelWorkflow: (workflowId: string) =>
    req<{ workflow_id: string; status: string }>(`/api/workflows/${workflowId}/cancel`, { method: "POST" }),

  getDashboardAnalytics: (signal?: AbortSignal) =>
    req<DashboardAnalytics>("/api/analytics/dashboard", { signal }),

  getWorkflowThinking: (workflowId: string, signal?: AbortSignal) =>
    req<PaginatedResponse<WorkflowEvent>>(`/api/workflows/${workflowId}/thinking`, { signal }),

  startSimulation: (count = 20, concurrency = 5, interval = 2.0) =>
    req<{ simulation_id: string; total: number; status: string }>(
      `/api/simulation/start${qs({ count, concurrency, interval })}`, { method: "POST" }
    ),
  listSimulations: (signal?: AbortSignal) =>
    req<{ data: Array<Record<string, unknown>> }>("/api/simulations", { signal }),
  getSimulation: (simId: string, signal?: AbortSignal) =>
    req<Record<string, unknown>>(`/api/simulation/${simId}`, { signal }),
  cancelSimulation: (simId: string) =>
    req<{ status: string; simulation_id: string }>(`/api/simulation/${simId}/cancel`, { method: "POST" }),
  pauseSimulation: (simId: string) =>
    req<{ status: string; simulation_id: string }>(`/api/simulation/${simId}/pause`, { method: "POST" }),
  resumeSimulation: (simId: string) =>
    req<{ status: string; simulation_id: string }>(`/api/simulation/${simId}/resume`, { method: "POST" }),
};
