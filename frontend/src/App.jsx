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
  if (!Number.isFinite(safe.dailyMaxHours) || safe.dailyMaxHours <= 0) safe.dailyMaxHours = 2;
  if (!Number.isFinite(safe.breakEveryMinutes) || safe.breakEveryMinutes < 15) safe.breakEveryMinutes = 50;
  if (!Number.isFinite(safe.breakDurationMinutes) || safe.breakDurationMinutes < 5) safe.breakDurationMinutes = 10;

  return safe;
}

export default function App() {
  const [tab, setTab] = useState("Subjects");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [subjects, setSubjects] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [missed, setMissed] = useState([]);

  // ✅ Actual planner: day starts once, schedule auto builds
  const [dayStarted, setDayStarted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // Load from localStorage
  useEffect(() => {
    const saved = loadState();
    if (saved?.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
    if (saved?.subjects) setSubjects(saved.subjects);
    if (saved?.schedule) setSchedule(saved.schedule);
    if (saved?.missed) setMissed(saved.missed);
    if (typeof saved?.dayStarted === "boolean") setDayStarted(saved.dayStarted);
  }, []);

  // Save to localStorage
  useEffect(() => {
    saveState({ settings, subjects, schedule, missed, dayStarted });
  }, [settings, subjects, schedule, missed, dayStarted]);

  const canStartDay = useMemo(() => {
    if (!subjects.length) return false;
    return subjects.some((s) => Number(s.totalTopics || 0) - Number(s.completedTopics || 0) > 0);
  }, [subjects]);

  const stats = useMemo(() => {
    const totalTopics = subjects.reduce((a, s) => a + Number(s.totalTopics || 0), 0);
    const completedTopics = subjects.reduce((a, s) => a + Number(s.completedTopics || 0), 0);
    const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    const studyMin = (schedule || [])
      .filter((x) => x.type === "study")
      .reduce((sum, x) => sum + Number(x.durationMinutes || 0), 0);

    const breakMin = (schedule || [])
      .filter((x) => x.type === "break")
      .reduce((sum, x) => sum + Number(x.durationMinutes || 0), 0);

    return { pct, studyMin, breakMin };
  }, [subjects, schedule]);

  async function generateSchedule() {
    setApiError("");

    if (!canStartDay) {
      setApiError("Add at least one subject with remaining topics.");
      return;
    }

    // basic validation
    for (const s of subjects) {
      if (!s.name?.trim()) return setApiError("Subject name cannot be empty.");
      if (Number(s.durationMinutes) <= 0) return setApiError("Duration must be > 0.");
      if (Number(s.totalTopics) < 1) return setApiError("Total topics must be >= 1.");
      if (Number(s.completedTopics) < 0 || Number(s.completedTopics) > Number(s.totalTopics))
        return setApiError("Completed topics must be between 0 and total topics.");
    }

    setLoading(true);
    try {
      // refresh subjects from backend (optional, helps with ID sync)
      try {
        const latest = await plannerApi.getSubjects();
        if (Array.isArray(latest)) setSubjects(latest);
      } catch {}

      const payload = normalizeSettings(settings);
      const data = await plannerApi.generateSchedule(payload);

      if (!Array.isArray(data) || data.length === 0) {
        setApiError("No schedule generated. Check planner settings and subjects.");
        return;
      }

      setSchedule(data);
      setTab("Schedule");
    } catch (e) {
      setApiError(e.message || "Failed to generate schedule.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ One-click practical start: Start Day => auto generate schedule
  async function startDay() {
    setApiError("");
    setDayStarted(true);
    setTab("Schedule");
    await generateSchedule();
  }

  function resetDay() {
    setApiError("");
    setDayStarted(false);
    setSchedule([]);
    setMissed([]);
    setTab("Planner");
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
              Practical planner (Start Day → plan → current session).
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

            {!dayStarted ? (
              <button
                onClick={startDay}
                disabled={!canStartDay || loading}
                className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-white font-semibold shadow-sm hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Starting..." : "Start Day"}
              </button>
            ) : (
              <button
                onClick={resetDay}
                className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Reset Day
              </button>
            )}
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
                  onClick={() => {
                    // ✅ prevent opening Schedule before Start Day
                    if (t.key === "Schedule" && !dayStarted) return setTab("Planner");
                    setTab(t.key);
                  }}
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
                <MiniStat label="Day" value={dayStarted ? "Started" : "Not"} />
                <MiniStat label="Subjects" value={subjects.length} />
                <MiniStat label="Missed" value={missed.length} />
                <MiniStat label="Study min" value={stats.studyMin} />
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="space-y-5">
            {tab === "Subjects" && (
              <Panel title="Subjects" subtitle="Add and manage subjects, topics, and durations.">
                <Subjects subjects={subjects} setSubjects={setSubjects} />
              </Panel>
            )}

            {tab === "Planner" && (
              <Panel title="Planner Settings" subtitle="Set start time, daily limits, and breaks.">
                <PlannerSettings settings={settings} setSettings={setSettings} />
              </Panel>
            )}

            {tab === "Schedule" && dayStarted && (
              <Panel title="Daily Planner" subtitle="Current session view + skip/complete + auto re-plan.">
                <Schedule
                  settings={settings}
                  schedule={schedule}
                  setSchedule={setSchedule}
                  missed={missed}
                  setMissed={setMissed}
                  subjects={subjects}
                  setSubjects={setSubjects}
                  dayStarted={dayStarted}
                />
              </Panel>
            )}

            {tab === "Report" && (
              <Panel title="Daily Report" subtitle="Summary of progress + missed sessions.">
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