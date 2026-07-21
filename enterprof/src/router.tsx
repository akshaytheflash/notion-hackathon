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
import SignIn from "./pages/SignIn";

export const routers = [
  {
    path: "/sign-in",
    name: "sign-in",
    element: <SignIn />,
  },
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
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
