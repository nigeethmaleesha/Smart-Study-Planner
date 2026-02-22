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

  missedLog,
  setMissedLog,
  daySnapshot,
  onDayFinished,
}) {
  const [busy, setBusy] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef(null);
  const timeUpHandledRef = useRef(false);

  // ✅ anti-double-click guard for Skip/Complete
  const actionLockRef = useRef(false);

  const current = schedule?.[currentIndex] || null;
  const next = schedule?.[currentIndex + 1] || null;

  useEffect(() => {
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, []);

  // reset time up guard & lock when session changes
  useEffect(() => {
    timeUpHandledRef.current = false;
    actionLockRef.current = false;
    stopTimer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // keep index valid
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

  // ✅ Auto start BREAK only
  useEffect(() => {
    if (!current) return;
    if (current.type !== "break") return;
    if (running) return;
    startTimerForCurrent(); // break auto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, current?.type]);

  async function refreshSubjects() {
    try {
      const data = await plannerApi.getSubjects();
      setSubjects(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function refreshMissed() {
    try {
      const data = await plannerApi.getMissed();
      setMissed(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
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

  function startTimerForCurrent() {
    if (!current) return;

    timeUpHandledRef.current = false;

    const startSeconds =
      secondsLeft > 0 ? secondsLeft : Number(current.durationMinutes || 0) * 60;

    setSecondsLeft(startSeconds);
    setRunning(true);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timeUpHandledRef.current) return 0;
          timeUpHandledRef.current = true;

          stopTimer(true);

          if (current?.type === "study") {
            setTimeout(() => completeCurrentStudy(true), 0);
          } else {
            setTimeout(() => moveToNextOrEnd(), 0);
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function toggleTimer() {
    if (!current) return;
    if (current.type === "break") return; // break auto only

    if (running) {
      stopTimer(false);
      return;
    }
    startTimerForCurrent();
  }

  function moveToNextOrEnd() {
    stopTimer(true);

    if (!schedule?.length) return;

    const isLast = currentIndex >= schedule.length - 1;
    if (isLast) {
      finishDayNow();
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  async function regenerateScheduleKeepIndex(desiredIndex = null) {
    if (!dayStarted) return;

    const keepIdx =
      typeof desiredIndex === "number" ? desiredIndex : currentIndex;

    setBusy(true);
    try {
      const data = await plannerApi.generateSchedule(
        normalizeSettings(settings)
      );

      if (Array.isArray(data) && data.length > 0) {
        const safeIdx = Math.min(keepIdx, data.length - 1);
        setSchedule(data);
        setCurrentIndex(safeIdx);
      } else {
        setSchedule([]);
        setCurrentIndex(0);
      }
    } catch (e) {
      alert(`Rebuild failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // ✅ MUST show confirm when 100% complete
  async function confirmDeleteIfComplete(subjectId) {
    // refresh latest subjects to avoid stale object
    const latestSubjects = await refreshSubjects();
    const subj = latestSubjects.find(
      (s) => String(s.id) === String(subjectId)
    );
    if (!subj) return;

    const remaining = Math.max(
      0,
      Number(subj.totalTopics || 0) - Number(subj.completedTopics || 0)
    );

    if (remaining > 0) return;

    const yes = window.confirm(
      `✅ "${subj.name}" is 100% complete.\nDo you want to delete it permanently from the schedule?`
    );

    if (!yes) return;

    try {
      await plannerApi.deleteSubject(subj.id);
    } catch {}

    await refreshSubjects();
  }

  // ✅ Complete study session
  // moveNextAfter = true => go to next slot immediately
  async function completeCurrentStudy(moveNextAfter = true) {
    if (!current || current.type !== "study") return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    stopTimer(true);

    const input = window.prompt(
      `✅ Complete session: "${current.subjectName}"\nHow many topics did you complete?`,
      "1"
    );

    const done = Math.max(0, Number(input || 0));

    // find subject
    const subj = subjects.find(
      (s) => String(s.id) === String(current.subjectId)
    );

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

      // ✅ show confirm if completed
      await confirmDeleteIfComplete(subj.id);
    }

    // move next first (as you requested)
    if (moveNextAfter) {
      const nextIdx = Math.min(
        currentIndex + 1,
        Math.max(0, (schedule?.length || 1) - 1)
      );
      setCurrentIndex(nextIdx);

      await regenerateScheduleKeepIndex(nextIdx);
      actionLockRef.current = false;
      return;
    }

    // else rebuild in same index
    await regenerateScheduleKeepIndex(currentIndex);
    actionLockRef.current = false;
  }

  // ✅ Skip current study session
  async function skipSession() {
    if (!current || current.type !== "study") return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    stopTimer(true);

    // ✅ Add to missedLog ONLY ONCE (no duplicates for same index & startTime)
    setMissedLog((prev) => {
      const key = `${current.subjectId}__${current.startTime}__${currentIndex}`;
      const already = prev.some(
        (x) => `${x.subjectId}__${x.startTime}__${x.index}` === key
      );
      if (already) return prev;

      return [
        ...prev,
        {
          at: new Date().toISOString(),
          subjectId: current.subjectId,
          subjectName: current.subjectName,
          startTime: current.startTime,
          index: currentIndex,
        },
      ];
    });

    // backend unique set (ok)
    try {
      await plannerApi.markMissed(current.subjectId);
    } catch {}

    await refreshMissed();

    // go next slot immediately
    const nextIdx = Math.min(
      currentIndex + 1,
      Math.max(0, (schedule?.length || 1) - 1)
    );
    const isLast = currentIndex >= (schedule?.length || 1) - 1;

    if (isLast) {
      await finishDayNow();
      actionLockRef.current = false;
      return;
    }

    setCurrentIndex(nextIdx);
    await regenerateScheduleKeepIndex(nextIdx);
    actionLockRef.current = false;
  }

  async function finishDayNow() {
    stopTimer(true);

    const snap = daySnapshot || {};

    // completed today
    const subjectRowsBase = subjects.map((s) => {
      const before = Number(snap[String(s.id)] || 0);
      const after = Number(s.completedTopics || 0);
      const completedToday = Math.max(0, after - before);
      return {
        subjectId: s.id,
        subjectName: s.name,
        completedToday,
      };
    });

    // missed per subject
    const missCountMap = new Map();
    for (const m of missedLog || []) {
      const key = String(m.subjectId);
      missCountMap.set(key, (missCountMap.get(key) || 0) + 1);
    }

    const mergedRows = subjectRowsBase
      .map((r) => ({
        ...r,
        missedCount: missCountMap.get(String(r.subjectId)) || 0,
      }))
      .filter((r) => r.completedToday > 0 || r.missedCount > 0);

    const completedTopicsToday = mergedRows.reduce(
      (a, r) => a + r.completedToday,
      0
    );

    const missedCount = (missedLog || []).length;

    const now = new Date();
    const dateLabel = now.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

    const report = {
      dateISO: now.toISOString(),
      dateLabel,
      completedTopicsToday,
      missedCount,
      subjectRows: mergedRows.sort((a, b) => b.completedToday - a.completedToday),
    };

    onDayFinished(report);
  }

  const statusText = (() => {
    if (!current) return "No plan yet.";
    if (!running && secondsLeft === 0)
      return current.type === "break" ? "Break: auto timer" : "Timer: stopped";
    if (running) return `Time left: ${format(secondsLeft)}`;
    return `Paused: ${format(secondsLeft)}`;
  })();

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              CURRENT SESSION
            </div>

            {!current ? (
              <div className="mt-2 text-slate-700">No schedule available.</div>
            ) : (
              <>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {current.type === "study" ? current.subjectName : "Break"}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Start: {current.startTime} • Duration:{" "}
                  {current.durationMinutes} min
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-900">
                  {statusText}
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">
                    NEXT
                  </div>
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleTimer}
              disabled={!current || current?.type === "break"}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              title={current?.type === "break" ? "Break auto starts" : ""}
            >
              {running ? "Pause" : "Start"}
            </button>

            <button
              onClick={() => completeCurrentStudy(true)}
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

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-slate-600">
            Missed (backend unique):{" "}
            <span className="font-semibold text-slate-900">
              {missed?.length || 0}
            </span>
            <span className="mx-2">•</span>
            Skips today (every click):{" "}
            <span className="font-semibold text-slate-900">
              {missedLog?.length || 0}
            </span>
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

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">
              Today Plan
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Click a row to jump to that session.
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
                  className={[
                    "border-t",
                    idx === currentIndex ? "bg-slate-50" : "",
                  ].join(" ")}
                  onClick={() => {
                    stopTimer(true);
                    setCurrentIndex(idx);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td className="py-3 text-slate-700">{idx + 1}</td>
                  <td className="py-3 font-semibold text-slate-900">{s.type}</td>
                  <td className="py-3 text-slate-700">{s.startTime}</td>
                  <td className="py-3 text-slate-700">
                    {s.durationMinutes} min
                  </td>
                  <td className="py-3 text-slate-700">
                    {s.type === "study" ? s.subjectName : "-"}
                  </td>
                </tr>
              ))}

              {(schedule || []).length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={6}>
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