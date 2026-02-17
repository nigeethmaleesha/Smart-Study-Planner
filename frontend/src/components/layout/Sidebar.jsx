import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/subjects", label: "Subjects" },
  { to: "/planner", label: "Planner Settings" },
  { to: "/schedule", label: "Daily Schedule" },
  { to: "/report", label: "Report" },
];

export default function Sidebar() {
  return (
    <aside className="rounded-2xl bg-white shadow-sm border">
      <div className="p-5">
        <div className="text-lg font-bold">Smart Study Planner</div>
        <div className="text-sm text-slate-500">CLL + MaxHeap Planner</div>
      </div>

      <nav className="px-2 pb-4 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              [
                "block rounded-xl px-3 py-2 text-sm transition",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
