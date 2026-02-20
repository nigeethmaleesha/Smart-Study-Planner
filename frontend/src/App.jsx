import { useEffect, useMemo, useState } from "react";
import PlannerSettings from "./components/PlannerSettings";
import Subjects from "./components/Subjects";
import Schedule from "./components/Schedule";
import Report from "./components/Report";
import { loadState, saveState } from "./lib/storage";
import { plannerApi } from "./api/plannerApi";

const TABS = [
  { key: "Subjects", label: "Subjects" },
  { key: "Planner", label: "Planner" },
  { key: "Schedule", label: "Schedule" },
  { key: "Report", label: "Report" },
];

const DEFAULT_SETTINGS = {
  startTime: "08:00",
  dailyMaxHours: 4,
  breakEveryMinutes: 60,
  breakDurationMinutes: 10,
};

function normalizeSettings(s) {
  const safe = {
    startTime: s?.startTime || DEFAULT_SETTINGS.startTime,
    dailyMaxHours: Number(s?.dailyMaxHours ?? DEFAULT_SETTINGS.dailyMaxHours),
    breakEveryMinutes: Number(s?.breakEveryMinutes ?? DEFAULT_SETTINGS.breakEveryMinutes),
    breakDurationMinutes: Number(s?.breakDurationMinutes ?? DEFAULT_SETTINGS.breakDurationMinutes),
  };

  if (!safe.startTime) safe.startTime = "08:00";
  if (safe.dailyMaxHours <= 0) safe.dailyMaxHours = 2;
  if (safe.breakEveryMinutes < 15) safe.breakEveryMinutes = 50;
  if (safe.breakDurationMinutes < 5) safe.breakDurationMinutes = 10;

  return safe;
}

export default function App() {
  const [tab, setTab] = useState("Subjects");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [subjects, setSubjects] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [missed, setMissed] = useState([]);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // Load localStorage once (safe merge)
  useEffect(() => {
    const saved = loadState();
    if (saved?.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
    if (saved?.subjects) setSubjects(saved.subjects);
    if (saved?.schedule) setSchedule(saved.schedule);
    if (saved?.missed) setMissed(saved.missed);
  }, []);

  // Save to localStorage
  useEffect(() => {
    saveState({ settings, subjects, schedule, missed });
  }, [settings, subjects, schedule, missed]);

  const canGenerate = useMemo(() => {
    if (!subjects.length) return false;
    return subjects.some((s) => Number(s.totalTopics || 0) - Number(s.completedTopics || 0) > 0);
  }, [subjects]);

  const stats = useMemo(() => {
    const totalTopics = subjects.reduce((a, s) => a + Number(s.totalTopics || 0), 0);
    const completedTopics = subjects.reduce((a, s) => a + Number(s.completedTopics || 0), 0);
    const remainingTopics = Math.max(0, totalTopics - completedTopics);
    const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    const studyMin = (schedule || [])
      .filter((x) => x.type === "study")
      .reduce((sum, x) => sum + Number(x.durationMinutes || 0), 0);

    const breakMin = (schedule || [])
      .filter((x) => x.type === "break")
      .reduce((sum, x) => sum + Number(x.durationMinutes || 0), 0);

    return { totalTopics, completedTopics, remainingTopics, pct, studyMin, breakMin };
  }, [subjects, schedule]);

  // ✅ Correct backend generation call (POST /api/schedule/generate)
  async function generateSchedule() {
    setApiError("");

    if (!canGenerate) {
      setApiError("Add at least one subject with remaining topics to generate a schedule.");
      return;
    }

    // Validate subjects (same as yours)
    for (const s of subjects) {
      if (!s.name?.trim()) return setApiError("Subject name cannot be empty.");
      if (Number(s.durationMinutes) <= 0) return setApiError("Duration must be > 0.");
      if (Number(s.priority) < 1 || Number(s.priority) > 5) return setApiError("Priority must be 1–5.");
      if (Number(s.totalTopics) < 1) return setApiError("Total topics must be >= 1.");
      if (Number(s.completedTopics) < 0 || Number(s.completedTopics) > Number(s.totalTopics))
        return setApiError("Completed topics must be between 0 and total topics.");
    }

    setLoading(true);
    try {
      // ✅ Send only ScheduleRequest (backend expects this)
      const payload = normalizeSettings(settings);

      const data = await plannerApi.generateSchedule(payload);

      if (!Array.isArray(data) || data.length === 0) {
        setApiError("No schedule generated. Check planner settings and ensure subjects exist in backend.");
        return;
      }

      setSchedule(data);
      setMissed([]);
      setTab("Schedule");
    } catch (e) {
      setApiError(e.message || "Failed to generate schedule.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Smart Study Planner
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Rotation (Circular LL) + Priority (Max Heap) handled in backend.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500">Completion</div>
              <div className="text-sm font-semibold text-slate-900">{stats.pct}%</div>
              <div className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${stats.pct}%` }} />
              </div>
            </div>

            <button
              onClick={generateSchedule}
              disabled={!canGenerate || loading}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {loading ? "Generating..." : "Generate Schedule"}
            </button>
          </div>
        </div>

        {/* Error */}
        {apiError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="font-semibold">Error</div>
            <div className="mt-1">{apiError}</div>
          </div>
        ) : null}

        {/* Layout */}
        <div className="mt-6 grid gap-5 md:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="rounded-3xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">MENU</div>

            <div className="mt-3 space-y-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                    tab === t.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Today overview</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <MiniStat label="Subjects" value={subjects.length} />
                <MiniStat label="Missed" value={missed.length} />
                <MiniStat label="Study min" value={stats.studyMin} />
                <MiniStat label="Break min" value={stats.breakMin} />
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="space-y-5">
            {tab === "Subjects" && (
              <Panel title="Subjects" subtitle="Add and manage subjects, topics, and priorities.">
                <Subjects subjects={subjects} setSubjects={setSubjects} />
              </Panel>
            )}

            {tab === "Planner" && (
              <Panel title="Planner Settings" subtitle="Set time, breaks, and daily limits.">
                <PlannerSettings settings={settings} setSettings={setSettings} />
              </Panel>
            )}

            {tab === "Schedule" && (
              <Panel title="Daily Schedule" subtitle="Generated sessions from backend. Mark missed, update progress.">
                <Schedule
                  settings={settings}              // ✅ IMPORTANT
                  schedule={schedule}
                  setSchedule={setSchedule}
                  missed={missed}
                  setMissed={setMissed}
                  subjects={subjects}
                  setSubjects={setSubjects}
                />
              </Panel>
            )}

            {tab === "Report" && (
              <Panel title="Daily Report" subtitle="Summary based on sessions, missed items, and topic progress.">
                <Report schedule={schedule} subjects={subjects} missed={missed} />
              </Panel>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}