import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import IncidentList from "./pages/IncidentList";
import IncidentDetailPage from "./pages/IncidentDetail";
import WorkflowListPage from "./pages/WorkflowListPage";
import WorkflowDetailPage from "./pages/WorkflowDetail";
import Decisions from "./pages/Decisions";
import Policies from "./pages/Policies";
import ActionLog from "./pages/ActionLog";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incidents" element={<IncidentList />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
          <Route path="/workflows" element={<WorkflowListPage />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/action-log" element={<ActionLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
