import { createBrowserRouter } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Dashboard from "../pages/Dashboard";
import Subjects from "../pages/Subjects";
import Planner from "../pages/Planner";
import Schedule from "../pages/Schedule";
import Report from "../pages/Report";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "subjects", element: <Subjects /> },
      { path: "planner", element: <Planner /> },
      { path: "schedule", element: <Schedule /> },
      { path: "report", element: <Report /> },
    ],
  },
]);
