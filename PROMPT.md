You are a senior full-stack engineer, autonomous coding agent, AI systems architect, product designer, QA engineer, and security-conscious integration engineer.

Build a complete hackathon-ready project named:

ENTERPRISE AI OS

This is not a kernel, Linux distribution, desktop environment, or machine operating system.

It is an AI-native Enterprise Operating System: a central coordination, policy, memory, approval, and execution layer for autonomous AI departments inside a company.

Do not build a chatbot.

Do not build a fake dashboard.

Do not hardcode workflow outcomes.

Do not simulate agent negotiation in one prewritten sequence.

Build a real orchestrated multi-agent system.

==================================================
PRIMARY PRODUCT REQUIREMENTS
============================

The system must demonstrate:

1. Multiple autonomous department agents.
2. Separate real LLM invocations for agent decisions.
3. Structured agent-to-agent communication.
4. Genuine disagreement and negotiation.
5. Deterministic organizational policy enforcement.
6. Human-in-the-loop approval for high-impact actions.
7. Workflow pause while human authorization is pending.
8. Automatic workflow resumption after Notion approval or rejection.
9. Durable organizational memory in Notion.
10. Real GitHub REST API actions.
11. Real Slack Incoming Webhook notifications.
12. Complete traceability of agent decisions, policy results, human decisions, and external actions.
13. A polished real-time enterprise operations dashboard.
14. Persistent execution state capable of recovering paused workflows after backend restart.

==================================================
TECHNOLOGY
==========

Frontend:

React
Vite
TypeScript
Tailwind CSS

Backend:

Python
FastAPI
Pydantic
SQLAlchemy or SQLModel
SQLite
httpx
asyncio

AI:

Gemini Developer API

Use the official current Google GenAI SDK.

The intended model configuration is:

GEMINI_MODEL=gemini-2.5-flash

Before implementation, verify the configured model is accepted by the installed SDK/API.

If the configured model is unavailable, do not silently substitute a model.

Report the configuration problem clearly.

Use structured JSON responses.

Validate all LLM output with Pydantic.

Implement malformed JSON recovery and bounded retries.

Do not use LangChain.

Do not use CrewAI.

Implement orchestration directly.

==================================================
CREDENTIAL HANDLING
===================

Never hardcode credentials into source files.

Never commit secrets.

Never expose secrets to the frontend.

Never print secrets.

Never include authorization headers in logs.

Create backend/.env.example.

The actual backend/.env is local and gitignored.

Require:

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

NOTION_TOKEN=
NOTION_INCIDENTS_DATA_SOURCE_ID=
NOTION_POLICIES_DATA_SOURCE_ID=
NOTION_DECISIONS_DATA_SOURCE_ID=
NOTION_APPROVALS_DATA_SOURCE_ID=
NOTION_ACTION_LOG_DATA_SOURCE_ID=

GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=notion-system

SLACK_WEBHOOK_URL=

APPROVAL_POLL_INTERVAL_SECONDS=5

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

At startup, validate credential configuration.

Expose:

GET /api/integrations/status

Return only configuration status.

Example:

{
"gemini": {"configured": true},
"notion": {"configured": true},
"github": {"configured": true},
"slack": {"configured": true}
}

Never return credential values.

==================================================
NOTION API VERSION
==================

Implement against the current Notion API data source model.

Use Notion-Version:

2025-09-03

The application receives Notion DATA SOURCE IDs, not legacy database IDs, for the five organizational tables.

Use /v1/data_sources APIs when querying data source rows.

When creating a row/page under a data source, use the current parent data source semantics required by the current Notion API.

Do not copy outdated Notion examples based only on legacy database query APIs.

==================================================
NOTION SCHEMA
=============

The user manually creates the following Notion data sources.

The code must expect these exact property names.

INCIDENTS:

Name: title
Incident ID: rich_text
Severity: select
Description: rich_text
Revenue Risk Per Day: number
Status: select
Workflow ID: rich_text
Created At: date

POLICIES:

Name: title
Policy ID: rich_text
Department: select
Policy Type: select
Limit: number
Required Action: select
Active: checkbox

DECISIONS:

Name: title
Decision ID: rich_text
Workflow ID: rich_text
Incident ID: rich_text
Agent: rich_text
Department: select
Decision: rich_text
Reasoning Summary: rich_text
Evidence: rich_text
Confidence: number
Created At: date

APPROVALS:

Name: title
Approval ID: rich_text
Workflow ID: rich_text
Incident ID: rich_text
Requested By: rich_text
Amount: number
Reason: rich_text
Status: select
Human Note: rich_text
Created At: date
Resolved At: date

ACTION LOG:

Name: title
Action ID: rich_text
Workflow ID: rich_text
Incident ID: rich_text
Agent: rich_text
Action: rich_text
Tool: select
Execution Mode: select
Result: rich_text
Created At: date

At application startup or through a diagnostic endpoint, retrieve the five data source schemas.

Validate required property names and property types.

If the user's Notion schema is incorrect, report the exact mismatch.

Example:

APPROVALS schema invalid:
Expected property "Status" of type select.
Found property "Status" of type rich_text.

Do not fail with a generic Notion API error when a useful schema error can be produced.

==================================================
PRIMARY BUSINESS SCENARIO
=========================

The fictional company has three autonomous AI departments:

Engineering
Finance
Operations

Implement a production incident and emergency infrastructure resource allocation workflow.

Primary scenario:

A P0 production incident occurs.

Estimated revenue risk:

₹4,00,000 per day.

Engineering investigates.

Engineering determines emergency infrastructure scaling is required.

Engineering requests:

₹80,000.

The active organizational policy stored in Notion is:

Policy ID:
POLICY-ENG-SPEND-001

Department:
Engineering

Policy Type:
AUTONOMOUS_SPENDING_LIMIT

Limit:
₹50,000

Required Action:
HUMAN_APPROVAL_REQUIRED

Engineering submits its structured resource request.

The deterministic policy engine evaluates:

80000 > 50000

The policy engine returns a policy violation.

Finance receives:

* Engineering's request
* Engineering's reasoning summary
* Engineering's evidence
* deterministic policy result

Finance performs a separate Gemini invocation.

Finance rejects autonomous execution because Engineering exceeded autonomous spending authority.

Engineering receives Finance's structured decision.

Engineering performs a new separate Gemini invocation.

Engineering challenges the rejection.

Engineering submits an appeal containing:

Severity: P0
Revenue risk: ₹4,00,000/day
Requested budget: ₹80,000
Mitigation: emergency infrastructure scaling

Finance receives the appeal.

Finance performs another separate Gemini invocation.

Finance determines:

The exception is economically justified.

Finance does not have autonomous authority to approve it.

Human authorization is required.

The Orchestrator creates a Notion APPROVALS row.

Status:

PENDING

The workflow enters:

WAITING_FOR_APPROVAL

The workflow stops.

No GitHub infrastructure execution issue may be created.

Operations may not execute.

The ApprovalWatcher monitors Notion.

A human changes:

PENDING -> APPROVED

or:

PENDING -> REJECTED

If APPROVED:

Resume the exact persisted workflow.

Create a real GitHub issue in:

GITHUB_OWNER / notion-system

Send a real Slack notification.

Invoke Operations.

Record all actions.

Mark the workflow COMPLETED.

If REJECTED:

Do not create the approved infrastructure GitHub execution issue.

Send the appropriate Slack notification.

Record the human rejection.

Mark the workflow REJECTED.

==================================================
ORCHESTRATOR
============

Implement a central Orchestrator.

Agents never directly mutate workflow state.

Agents return proposals and decisions.

The Orchestrator:

validates agent output
enforces state transitions
routes structured messages
invokes policy evaluation
invokes agents
creates approvals
pauses workflows
resumes workflows
invokes integrations
records events
records audit data

Implement an explicit state machine.

States:

CREATED
ENGINEERING_ANALYSIS
RESOURCE_REQUESTED
FINANCE_REVIEW
FINANCE_REJECTED
ENGINEERING_APPEAL
FINANCE_REEVALUATION
APPROVAL_REQUIRED
WAITING_FOR_APPROVAL
APPROVED
REJECTED
EXECUTING
OPERATIONS_REVIEW
COMPLETED
FAILED

Define legal transitions.

Invalid transitions must raise a domain-specific error.

Every state transition must generate a WorkflowEvent.

==================================================
AGENTS
======

Implement:

BaseAgent
EngineeringAgent
FinanceAgent
OperationsAgent

Each agent has:

name
department
role
responsibilities
allowed_tools
system_prompt
output_schema

Agent context contains:

incident
current workflow state
relevant policies
policy evaluation results
previous decisions
previous department messages
relevant organizational memory

Agent output must be structured.

Use Pydantic schemas.

Shared fields:

agent
department
decision
reasoning_summary
evidence
requested_action
confidence
requires_escalation
message_to_department

Do not store or request hidden chain-of-thought.

Store concise audit-oriented reasoning summaries.

Agents must not receive integration credentials.

Agents must not directly call GitHub, Slack, or Notion.

Only controlled backend adapters may invoke integrations.

==================================================
ENGINEERING AGENT
=================

Engineering handles:

incident analysis
severity classification
technical mitigation
resource requests
technical evidence
business impact evidence
appeals

Engineering cannot approve spending.

Engineering cannot bypass Finance.

Engineering cannot bypass human approval.

For the primary scenario, Engineering should reason from the seeded incident context and produce a structured request for emergency scaling.

The primary scenario must reliably demonstrate the ₹80,000 request.

After Finance rejection, Engineering must receive the rejection and perform a new invocation.

The appeal must include the ₹4,00,000/day revenue-risk evidence.

Do not create the initial request and appeal in the same Gemini call.

==================================================
FINANCE AGENT
=============

Finance evaluates:

resource requests
policy evaluation results
business impact
exception justification
escalation requirements

Finance does not use the LLM to decide whether 80000 > 50000.

Python policy code determines that.

Finance receives the deterministic result.

Initial Finance invocation:

Autonomous execution is rejected because the policy engine reports authority exceeded.

Second Finance invocation:

Receives Engineering's appeal.

Evaluates economic justification.

For the primary scenario, Finance should determine that the exception is justified but human approval is mandatory.

Finance cannot override HUMAN_APPROVAL_REQUIRED.

==================================================
OPERATIONS AGENT
================

Operations executes only after APPROVED.

Operations receives:

incident
Engineering decision
Finance decision
human approval result
approved budget
GitHub action result

Operations creates a structured execution summary.

Operations cannot bypass approval.

The Orchestrator must prevent Operations invocation before APPROVED.

==================================================
DETERMINISTIC POLICY ENGINE
===========================

Create a pure Python policy engine.

Read active policies from Notion.

Convert Notion properties into validated Pydantic policy models.

Evaluate:

AUTONOMOUS_SPENDING_LIMIT

Example result:

{
"policy_id": "POLICY-ENG-SPEND-001",
"policy_name": "Autonomous Infrastructure Spending Limit",
"passed": false,
"requested_amount": 80000,
"limit": 50000,
"violation": "Requested amount exceeds autonomous spending authority",
"required_action": "HUMAN_APPROVAL_REQUIRED"
}

The LLM cannot alter the result.

The Orchestrator treats required_action as authoritative.

Log POLICY_EVALUATED.

Record the result in organizational audit history.

==================================================
NOTION ADAPTER
==============

Implement a NotionAdapter using httpx.

Keep Notion API code separate from business logic.

Implement:

validate_schemas()
create_incident()
get_incident()
update_incident_status()
get_active_policies()
record_decision()
create_approval()
get_approval_status()
record_action()

Use:

Authorization: Bearer <token>

Notion-Version: 2025-09-03

Content-Type: application/json

Never log Authorization.

Use async HTTP.

Use timeouts.

Implement bounded exponential-backoff retry for transient failures.

Do not retry permanent validation or authorization errors indefinitely.

Use UUIDs generated by the application for:

Incident ID
Decision ID
Approval ID
Action ID
Workflow ID

Use these identifiers for idempotency.

Avoid duplicate Notion rows.

==================================================
APPROVAL WATCHER
================

Implement ApprovalWatcher.

It is asynchronous.

It periodically finds persisted workflows in:

WAITING_FOR_APPROVAL

For every workflow:

retrieve ApprovalTracking
query the Notion approval status
compare with last_known_status

Detect:

PENDING -> APPROVED
PENDING -> REJECTED

On APPROVED:

atomically mark the approval transition for processing
invoke orchestrator.resume_approved_workflow()

On REJECTED:

atomically mark the approval transition for processing
invoke orchestrator.resume_rejected_workflow()

Prevent duplicate resume.

The watcher must survive backend restart.

On startup, it must rediscover persisted WAITING_FOR_APPROVAL workflows.

Polling interval:

APPROVAL_POLL_INTERVAL_SECONDS

Default:

5

Do not use a synchronous while loop inside a FastAPI request.

==================================================
SQLITE EXECUTION STATE
======================

Notion is organizational memory.

SQLite is runtime execution persistence.

Create:

Workflow
WorkflowEvent
IntegrationAction
ApprovalTracking

Workflow:

id
incident_id
state
context_json
pending_approval_id
created_at
updated_at
completed_at

WorkflowEvent:

id
workflow_id
event_type
source
payload_json
created_at

IntegrationAction:

id
workflow_id
action_type
idempotency_key
status
external_reference
error
created_at
updated_at

ApprovalTracking:

id
workflow_id
approval_id
last_known_status
processed
created_at
updated_at

Persist workflow context before WAITING_FOR_APPROVAL.

After restart, resume from persisted state.

==================================================
GITHUB ADAPTER
==============

Use the GitHub REST API.

Repository configuration:

GITHUB_OWNER from environment.

GITHUB_REPO defaults to:

notion-system

Authentication:

Bearer token from GITHUB_TOKEN.

Never log the token.

After approval create:

[P0] Emergency infrastructure scaling approved

Issue body includes:

Incident ID
Workflow ID
Severity
Approved Budget
Revenue Risk Per Day
Engineering Rationale
Finance Decision
Approval ID
Execution Status

Store issue number and issue URL.

Implement idempotency.

Idempotency key:

github:create_issue:<workflow_id>

Before creation, check IntegrationAction.

If SUCCESS exists for the key, return the stored external reference.

A duplicated approval event must not create a second issue.

==================================================
SLACK ADAPTER
=============

Use Slack Incoming Webhooks.

Read the URL only from:

SLACK_WEBHOOK_URL

Never log it.

Send notifications for:

P0 incident created
Finance rejected autonomous execution
Human approval required
Human approved
Human rejected
Execution started
Workflow completed
External integration failure

Include:

Incident ID
Workflow ID

Implement bounded retry.

Record success or failure.

Do not mark a failed HTTP response as successful.

==================================================
EVENTS
======

Implement structured events:

INCIDENT_CREATED
ENGINEERING_ANALYSIS_COMPLETED
RESOURCE_REQUEST_CREATED
POLICY_EVALUATED
FINANCE_DECISION_CREATED
ENGINEERING_APPEAL_CREATED
APPROVAL_REQUEST_CREATED
WORKFLOW_PAUSED
APPROVAL_APPROVED
APPROVAL_REJECTED
EXECUTION_STARTED
GITHUB_ISSUE_CREATED
SLACK_NOTIFICATION_SENT
OPERATIONS_REVIEW_COMPLETED
WORKFLOW_COMPLETED
INTEGRATION_FAILED

Every major workflow action emits an event.

Persist events before streaming them.

==================================================
FASTAPI API
===========

Implement:

GET /health

GET /api/integrations/status

GET /api/notion/schema-status

POST /api/incidents

GET /api/incidents

GET /api/incidents/{incident_id}

GET /api/workflows

GET /api/workflows/{workflow_id}

GET /api/workflows/{workflow_id}/events

GET /api/approvals

POST /api/demo/seed

POST /api/demo/run-primary-scenario

POST /api/workflows/{workflow_id}/retry-failed-actions

WebSocket:

/ws/workflows/{workflow_id}

The WebSocket streams actual persisted workflow events.

Frontend polling fallback is required.

==================================================
FRONTEND
========

Build a polished enterprise AI operations control plane.

Do not use a chatbot UI.

Do not use a fake terminal as the primary interface.

Use a dark professional enterprise interface.

Create:

Command Center
Incident Detail
Workflow Detail
Decisions
Approvals
Policies
Action Log
Integration Status

Command Center displays:

active incidents
active workflows
waiting human approvals
completed workflows
integration health
recent agent activity

Include:

RUN P0 INCIDENT DEMO

The button calls the real backend.

The UI sequence must be derived from workflow events.

Never animate a hardcoded fake workflow.

==================================================
WORKFLOW VISUALIZATION
======================

Visualize:

Engineering
↓
Policy Engine
↓
Finance
↓
Engineering Appeal
↓
Finance Reevaluation
↓
Human Approval
↓
Operations

Show:

completed
active
pending
failed

Display structured department messages.

Clearly visually distinguish:

AI DECISION
POLICY ENFORCEMENT
HUMAN DECISION
EXTERNAL ACTION

When waiting for approval show:

WORKFLOW PAUSED

Human authorization required.

Display:

Requested amount
₹80,000

Autonomous limit
₹50,000

Revenue risk
₹4,00,000/day

Engineering rationale

Finance rationale

Current Notion approval status

If the Notion page URL is available display:

OPEN APPROVAL IN NOTION

The primary flow must not have an Approve button in the React dashboard.

The human changes Status in Notion.

The UI updates automatically when the watcher detects the change.

==================================================
ACTION LOG UI
=============

Display:

Notion writes
GitHub issue creation
Slack notifications

Status:

PENDING
SUCCESS
FAILED

Execution mode:

REAL
SIMULATED

Never display a simulated action as real.

==================================================
TESTING
=======

Use pytest.

Test:

policy allows below ₹50,000
policy blocks above ₹50,000
invalid transition rejected
Finance cannot bypass required approval
Operations cannot execute before approval
approval pauses workflow
APPROVED resumes workflow
REJECTED follows rejection path
duplicate approval processing is idempotent
duplicate resume does not duplicate GitHub issue
malformed Gemini JSON recovery
missing credentials reported
Notion schema mismatch clearly reported
Notion transient failure retry
Notion permanent failure not infinitely retried
GitHub failure not marked SUCCESS
Slack failure not marked SUCCESS

Mock external APIs.

Tests must not require live credentials.

Run frontend type checking.

Run frontend linting.

Run frontend production build.

==================================================
AUTONOMOUS IMPROVEMENT LOOP
===========================

You are an autonomous coding agent.

Do not stop after scaffolding.

Do not stop after making the UI.

Do not stop because the happy path works once.

Repeatedly execute:

INSPECT
PLAN
IMPLEMENT
VERIFY
AUDIT
IMPROVE
REPEAT

INSPECT:

Read the complete repository.

Inspect source code, tests, configuration, environment templates, and documentation.

Search for:

TODO
FIXME
pass
NotImplementedError
placeholder
mock
fake
hardcoded

Identify incomplete or fake implementation.

PLAN:

Prioritize:

1. build failures
2. runtime failures
3. workflow safety
4. approval correctness
5. state persistence
6. integration correctness
7. idempotency
8. tests
9. frontend event correctness
10. UI quality
11. documentation

IMPLEMENT:

Fix the highest-value concrete problems.

Do not rewrite correct working code for personal stylistic preference.

VERIFY:

Run backend tests.

Import the FastAPI application.

Start the backend when possible.

Call /health.

Call integration status.

Call Notion schema status when credentials are configured.

Exercise the primary demo API.

Run frontend lint.

Run TypeScript checks.

Run the frontend production build.

AUDIT:

Compare the repository against every requirement in this prompt.

Classify requirements:

PASS
PARTIAL
FAIL
BLOCKED_BY_EXTERNAL_CREDENTIAL

Do not mark PASS without inspecting implementation.

Specifically verify:

Agent negotiation uses separate Gemini invocations.

The policy engine performs deterministic numeric enforcement.

Finance cannot override HUMAN_APPROVAL_REQUIRED.

The approval creates a real Notion row when configured.

The workflow genuinely stops at WAITING_FOR_APPROVAL.

Operations is not invoked before approval.

Approval watcher reads actual Notion status.

Workflow resumes from persisted SQLite state.

Duplicate approval processing is safe.

GitHub issue creation is idempotent.

Dashboard workflow data comes from backend events.

No fake hardcoded event sequence exists.

No secret exists in tracked source.

IMPROVE:

Fix all locally fixable FAIL items.

Improve meaningful PARTIAL items.

For credential-blocked items:

validate adapters using mocks
validate configuration
validate error handling
document exact manual verification steps

REPEAT:

Start another inspection cycle.

Every cycle must resolve a concrete defect, test failure, incomplete requirement, or material risk.

Do not enter an infinite cosmetic-refactoring loop.

If no actionable local defect remains, evaluate the completion gate.

==================================================
COMPLETION GATE
===============

Do not declare completion until:

backend imports
backend tests pass
frontend production build passes
policy tests pass
state machine tests pass
approval pause tests pass
approval resume tests pass
rejection tests pass
idempotency tests pass
primary scenario can start
primary scenario reaches WAITING_FOR_APPROVAL
Operations does not execute before approval
automated approval test resumes workflow
GitHub adapter tests pass
Slack adapter tests pass
Notion adapter tests pass
Notion schema validation exists
missing credentials are reported
.env.example is complete
.env is gitignored
README matches implementation
no critical requirement remains FAIL

Then perform one final repository-wide audit.

Return:

1. What was built
2. Architecture
3. Commands executed
4. Actual test/build results
5. Credential-dependent verification still required
6. Known limitations
7. Exact startup commands
8. Exact primary demo procedure

Never fabricate command output.

Never fabricate test results.

Never claim a real GitHub issue was created unless the API actually returned success.

Never claim a Slack notification was delivered unless Slack returned success.

Never claim a Notion page was created unless Notion returned success.

Begin immediately.

Inspect the current repository.

If empty, initialize the entire project and enter the implementation loop.
