import NotFound from "./pages/NotFound";
import { Layout } from "./components/incident-command/Layout";
import Dashboard from "./pages/Dashboard";
import IncidentList from "./pages/IncidentList";
import IncidentDetailPage from "./pages/IncidentDetail";
import WorkflowListPage from "./pages/WorkflowListPage";
import WorkflowDetailPage from "./pages/WorkflowDetail";
import Decisions from "./pages/Decisions";
import Policies from "./pages/Policies";
import ActionLog from "./pages/ActionLog";
import NotificationRecipients from "./pages/NotificationRecipients";

export const routers = [
  {
    path: "/",
    name: "command-center",
    element: <Layout />,
    children: [
      { index: true, name: "dashboard", element: <Dashboard /> },
      { path: "incidents", name: "incidents", element: <IncidentList /> },
      { path: "incidents/:incidentId", name: "incident-detail", element: <IncidentDetailPage /> },
      { path: "workflows", name: "workflows", element: <WorkflowListPage /> },
      { path: "workflows/:workflowId", name: "workflow-detail", element: <WorkflowDetailPage /> },
      { path: "decisions", name: "decisions", element: <Decisions /> },
      { path: "policies", name: "policies", element: <Policies /> },
      { path: "action-log", name: "action-log", element: <ActionLog /> },
      { path: "notification-recipients", name: "notification-recipients", element: <NotificationRecipients /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];
