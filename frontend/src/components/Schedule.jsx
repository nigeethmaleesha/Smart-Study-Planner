import { useEffect, useRef, useState } from "react";
import { plannerApi } from "../api/plannerApi";

function normalizeSettings(s) {
  return {
    startTime: s?.startTime || "08:00",
    dailyMaxHours: Number(s?.dailyMaxHours || 2),
    breakEveryMinutes: Math.max(15, Number(s?.breakEveryMinutes || 50)),
    breakDurationMinutes: Math.max(5, Number(s?.breakDurationMinutes || 10)),
  };
}

export default function Schedule({
  settings,
  schedule,
  setSchedule,
  missed,
  setMissed,
  subjects,
  setSubjects,
  dayStarted,
}) {
  const [busy, setBusy] = useState(false);

  // Current session pointer
  const [currentIndex, setCurrentIndex] = useState(0);

  // Timer
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef(null);

  const current = schedule?.[currentIndex] || null;
  const next = schedule?.[currentIndex + 1] || null;

  // Cleanup timer
  useEffect(() => {
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, []);

  // Keep index valid when schedule length changes
  useEffect(() => {
    if ((schedule || []).length === 0) {
      setCurrentIndex(0);
      stopTimer(true);
      return;
    }
    if (currentIndex >= schedule.length) {
      setCurrentIndex(0);
      stopTimer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.length]);

  async function refreshSubjects() {
    try {
      const data = await plannerApi.getSubjects();
      setSubjects(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function refreshMissed() {
    try {
      const data = await plannerApi.getMissed();
      setMissed(Array.isArray(data) ? data : []);
    } catch {}
  }

  function format(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function stopTimer(reset = false) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    if (reset) setSecondsLeft(0);
  }

  function toggleTimer() {
    if (!current) return;

    if (running) {
      stopTimer(false); // pause
      return;
    }

    const startSeconds =
      secondsLeft > 0 ? secondsLeft : Number(current.durationMinutes || 0) * 60;

    setSecondsLeft(startSeconds);
    setRunning(true);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopTimer(true);
          moveToNextSession(); // auto-next when time ends
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ✅ Always moves to next if possible
  function moveToNextSession() {
    stopTimer(true);
    if (!schedule?.length) return;

    const nextIdx = Math.min(currentIndex + 1, schedule.length - 1);
    setCurrentIndex(nextIdx);
    return nextIdx;
  }

  /**
   * ✅ Rebuild schedule but keep a chosen index (prevents jumping back)
   * If desiredIndex is null -> keep currentIndex
   */
  async function regenerateScheduleKeepIndex(desiredIndex = null) {
    if (!dayStarted) return;

    const keepIdx =
      typeof desiredIndex === "number" ? desiredIndex : currentIndex;

    setBusy(true);
    try {
      const data = await plannerApi.generateSchedule(normalizeSettings(settings));
      if (Array.isArray(data) && data.length > 0) {
        const safeIdx = Math.min(keepIdx, data.length - 1);
        setSchedule(data);
        setCurrentIndex(safeIdx);
      }
    } catch (e) {
      alert(`Rebuild failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function completeSession() {
    if (!current || current.type !== "study") return;

    stopTimer(true);

    const input = window.prompt(
      `How many topics did you complete for "${current.subjectName}"?`,
      "1"
    );
    const done = Math.max(0, Number(input || 0));

    const subj = subjects.find((s) => String(s.id) === String(current.subjectId));
    if (subj) {
      const updated = {
        ...subj,
        completedTopics: Math.min(
          Number(subj.totalTopics || 0),
          Number(subj.completedTopics || 0) + done
        ),
      };

      try {
        await plannerApi.updateSubject(subj.id, updated);
      } catch {}
      await refreshSubjects();
    }

    // keep same position (or you can move next if you want)
    await regenerateScheduleKeepIndex(currentIndex);
  }

  // ✅ FIXED Skip: move to next instantly AND keep that next after rebuild
  async function skipSession() {
    if (!current || current.type !== "study") return;

    // 1) calculate next index FIRST
    const nextIdx = schedule?.length
      ? Math.min(currentIndex + 1, schedule.length - 1)
      : currentIndex;

    // 2) move UI to next instantly
    stopTimer(true);
    setCurrentIndex(nextIdx);

    // 3) mark missed in backend
    try {
      await plannerApi.markMissed(current.subjectId);
    } catch {}
    await refreshMissed();

    // 4) rebuild schedule but KEEP next index (so it won't jump back)
    await regenerateScheduleKeepIndex(nextIdx);
  }

  const statusText = (() => {
    if (!current) return "No plan yet.";
    if (!running && secondsLeft === 0) return "Timer: stopped";
    if (running) return `Time left: ${format(secondsLeft)}`;
    return `Paused: ${format(secondsLeft)}`;
  })();

  return (
    <div className="space-y-5">
      {/* Current Session Card */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">CURRENT SESSION</div>

            {!current ? (
              <div className="mt-2 text-slate-700">
                No schedule available. Start Day should auto-generate the plan.
              </div>
            ) : (
              <>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {current.type === "study" ? current.subjectName : "Break"}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Start: {current.startTime} • Duration: {current.durationMinutes} min
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-900">
                  {statusText}
                </div>

                {/* Next preview */}
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">NEXT</div>
                  {next ? (
                    <div className="mt-1 text-sm text-slate-700">
                      {next.type === "study"
                        ? `${next.subjectName} • ${next.durationMinutes} min`
                        : `Break • ${next.durationMinutes} min`}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-slate-600">
                      No next session (end of plan).
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Only 3 actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleTimer}
              disabled={!current}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? "Pause" : "Start"}
            </button>

            <button
              onClick={completeSession}
              disabled={!current || current?.type !== "study"}
              className="rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              Complete
            </button>

            <button
              onClick={skipSession}
              disabled={!current || current?.type !== "study"}
              className="rounded-2xl border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>

        {/* small rebuild link */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-slate-600">
            Missed: <span className="font-semibold text-slate-900">{missed?.length || 0}</span>
          </div>

          <button
            onClick={() => regenerateScheduleKeepIndex(currentIndex)}
            disabled={busy || !dayStarted}
            className="text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
          >
            {busy ? "Rebuilding..." : "Rebuild plan"}
          </button>
        </div>
      </div>

      {/* Overview Table */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Today Plan</div>
            <div className="mt-1 text-sm text-slate-500">
              Click a row to jump to that session (optional).
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {(schedule || []).length} items
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-3">#</th>
                <th className="py-3">Type</th>
                <th className="py-3">Start</th>
                <th className="py-3">Duration</th>
                <th className="py-3">Subject</th>
              </tr>
            </thead>
            <tbody>
              {(schedule || []).map((s, idx) => (
                <tr
                  key={idx}
                  className={["border-t", idx === currentIndex ? "bg-slate-50" : ""].join(" ")}
                  onClick={() => {
                    stopTimer(true);
                    setCurrentIndex(idx);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td className="py-3 text-slate-700">{idx + 1}</td>
                  <td className="py-3 font-semibold text-slate-900">{s.type}</td>
                  <td className="py-3 text-slate-700">{s.startTime}</td>
                  <td className="py-3 text-slate-700">{s.durationMinutes} min</td>
                  <td className="py-3 text-slate-700">{s.type === "study" ? s.subjectName : "-"}</td>
                </tr>
              ))}

              {(schedule || []).length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={7}>
                    No schedule yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}