export interface WorkflowSummary {
  workflow_id: string;
  incident_id: string;
  state: string;
  created_at: string;
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
}

export interface IntegrationsStatus {
  gemini: { configured: boolean };
  notion: { configured: boolean };
  github: { configured: boolean };
  slack: { configured: boolean };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
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

export const api = {
  health: () => req<{ status: string }>("/health"),
  integrationsStatus: () => req<IntegrationsStatus>("/api/integrations/status"),
  notionSchemaStatus: () => req<{ status: string; data_source_id?: string }>("/api/notion/schema-status"),
  listWorkflows: () => req<{ data: Workflow[] }>("/api/workflows").then(r => r.data),
  getWorkflow: (id: string) => req<Workflow>(`/api/workflows/${id}`),
  listIncidents: () => req<{ data: WorkflowSummary[] }>("/api/incidents").then(r => r.data),
  getIncident: (id: string) => req<IncidentDetail>(`/api/incidents/${id}`),
  getWorkflowEvents: (workflowId: string) => req<{ data: WorkflowEvent[] }>(`/api/workflows/${workflowId}/events`).then(r => r.data),
  listApprovals: () => req<{ data: Approval[] }>("/api/approvals").then(r => r.data),
  listDecisions: () => req<{ data: WorkflowEvent[] }>("/api/decisions").then(r => r.data),
  listPolicies: () => req<{ data: WorkflowEvent[] }>("/api/policies").then(r => r.data),
  listActionLog: () => req<{ data: WorkflowEvent[] }>("/api/action-log").then(r => r.data),
  runPrimaryScenario: (body?: { name: string; severity: string; description: string; revenue_risk_per_day: number }) =>
    req<{ workflow_id: string; status: string; incident_id?: string; error?: string }>(
      "/api/demo/run-primary-scenario",
      { method: "POST", body: body ? JSON.stringify(body) : undefined }
    ),
  clearDatabase: () =>
    req<{ status: string; message: string }>("/api/admin/clear-database", { method: "POST" }),
  listActivePolicies: () => req<Policy[]>("/api/policies/active"),
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
};
