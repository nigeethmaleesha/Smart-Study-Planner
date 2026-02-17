import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <Sidebar />
          <div className="rounded-2xl bg-white shadow-sm border">
            <Topbar />
            <main className="p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
