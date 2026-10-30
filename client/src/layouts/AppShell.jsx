import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <Topbar />
      <main className="min-h-screen pl-[195px] pt-12">
        <Outlet />
      </main>
    </div>
  );
}
