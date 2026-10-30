import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import AgentWorkspacePage from "./pages/AgentWorkspacePage";
import CreatePage from "./pages/CreatePage";
import {
  AgentsPage,
  ConversationDetailsPage,
  ConversationsPage,
  HomePage,
  TestsPage,
  VoicesPage,
} from "./pages/ReferencePages";
import TalkPage from "./pages/TalkPage";
import ToastProvider from "./components/ToastProvider";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<AppShell />}>
        <Route
          path="/create"
          element={<CreatePage />}
        />
        <Route path="/" element={<HomePage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:id" element={<AgentWorkspacePage />} />
        <Route path="/voices" element={<VoicesPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/conversations/:id" element={<ConversationDetailsPage />} />
        <Route path="/tests" element={<TestsPage />} />
        </Route>
        <Route path="/talk/:id" element={<TalkPage />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
    </ToastProvider>
  );
}
