import { useEffect, useRef, useState } from "react";
import { plannerApi } from "../api/plannerApi";

const PlannerTimer = (() => {
  let running = false;
  let secondsLeft = 0;
  let intervalId = null;

  let onFinish = null;
  const listeners = new Set();

  function notify() {
    const snap = { running, secondsLeft };
    listeners.forEach((fn) => fn(snap));
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn({ running, secondsLeft });
    return () => listeners.delete(fn);
  }

  function start(durationSeconds, finishCallback) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    stop(false);

    secondsLeft = durationSeconds;
    onFinish = finishCallback;
    running = true;
    notify();

    intervalId = setInterval(() => {
      secondsLeft -= 1;

      if (secondsLeft <= 0) {
        secondsLeft = 0;
        running = false;
        notify();

        const cb = onFinish;
        onFinish = null;

        if (intervalId) clearInterval(intervalId);
        intervalId = null;

        if (typeof cb === "function") cb();
        return;
      }

      notify();
    }, 1000);
  }

  function pause() {
    if (!running) return;
    running = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    notify();
  }

  function resume(finishCallback) {
    if (running) return;
    if (secondsLeft <= 0) return;

    onFinish = finishCallback || onFinish;
    running = true;
    notify();

    intervalId = setInterval(() => {
      secondsLeft -= 1;

      if (secondsLeft <= 0) {
        secondsLeft = 0;
        running = false;
        notify();

        const cb = onFinish;
        onFinish = null;

        if (intervalId) clearInterval(intervalId);
        intervalId = null;

        if (typeof cb === "function") cb();
        return;
      }

      notify();
    }, 1000);
  }

  function stop(reset = true) {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    running = false;
    onFinish = null;
    if (reset) secondsLeft = 0;
    notify();
  }

  function getState() {
    return { running, secondsLeft };
  }

  return { subscribe, start, pause, resume, stop, getState };
})();

export function usePlannerTimer() {
  const [state, setState] = useState(PlannerTimer.getState());
  useEffect(() => PlannerTimer.subscribe(setState), []);
  return state;
}

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

  currentIndex,
  setCurrentIndex,
}) {
  const [busy, setBusy] = useState(false);

  // ✅ message when expired target dates are skipped
  const [dateNotice, setDateNotice] = useState("");

  // from global timer store
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const timeUpHandledRef = useRef(false);
  const actionLockRef = useRef(false);

  const current = schedule?.[currentIndex] || null;
  const next = schedule?.[currentIndex + 1] || null;

  // ----------------------------
  // Target date / deadline helpers
  // ----------------------------
  function getStartOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseAnyDate(dateLike) {
    if (!dateLike) return null;

    // If already Date
    if (dateLike instanceof Date && !isNaN(dateLike.getTime())) return dateLike;

    // Numeric timestamp
    if (typeof dateLike === "number" && Number.isFinite(dateLike)) {
      const d = new Date(dateLike);
      return isNaN(d.getTime()) ? null : d;
    }

    // String date (supports YYYY-MM-DD / ISO / others)
    if (typeof dateLike === "string") {
      const trimmed = dateLike.trim();
      if (!trimmed) return null;

      // Common "YYYY-MM-DD" fix: treat as local date start
      const ymd = /^\d{4}-\d{2}-\d{2}$/;
      if (ymd.test(trimmed)) {
        const [y, m, day] = trimmed.split("-").map((x) => Number(x));
        const d = new Date(y, m - 1, day);
        return isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  // Tries multiple field names so it works even if your DB uses different column name
  function getSubjectTargetDate(subject) {
    if (!subject) return null;
    return (
      subject.targetDate ??
      subject.deadline ??
      subject.dueDate ??
      subject.endDate ??
      subject.target_date ??
      subject.deadline_date ??
      subject.due_date ??
      null
    );
  }

  function isTargetDatePassed(subject) {
    const raw = getSubjectTargetDate(subject);
    const d = parseAnyDate(raw);
    if (!d) return false; // if no date, don't block scheduling
    const today0 = getStartOfToday();
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    return cmp.getTime() < today0.getTime(); // strictly before today
  }

  function filterOutExpiredSessions(list, subjectList) {
    const subs = Array.isArray(subjectList) ? subjectList : [];
    const data = Array.isArray(list) ? list : [];

    const skippedNames = [];
    const filtered = data.filter((item) => {
      if (!item || item.type !== "study") return true;

      const subj = subs.find((s) => String(s.id) === String(item.subjectId));
      if (!subj) return true;

      if (isTargetDatePassed(subj)) {
        skippedNames.push(subj.name || item.subjectName || `Subject ${subj.id}`);
        return false;
      }
      return true;
    });

    return { filtered, skippedNames };
  }

  // Subscribe to timer updates
  useEffect(() => {
    return PlannerTimer.subscribe(({ running, secondsLeft }) => {
      setRunning(running);
      setSecondsLeft(secondsLeft);
    });
  }, []);

  useEffect(() => {
    timeUpHandledRef.current = false;
    actionLockRef.current = false;
  }, [currentIndex]);

  // keep index valid
  useEffect(() => {
    if ((schedule || []).length === 0) {
      setCurrentIndex(0);
      PlannerTimer.stop(true);
      return;
    }
    if (currentIndex >= schedule.length) {
      setCurrentIndex(0);
      PlannerTimer.stop(true);
    }
  }, [schedule.length]);

  // ✅ If schedule already contains expired target-date sessions (from backend or old state), remove them
  useEffect(() => {
    if (!Array.isArray(schedule) || schedule.length === 0) return;
    if (!Array.isArray(subjects) || subjects.length === 0) return;

    const { filtered, skippedNames } = filterOutExpiredSessions(schedule, subjects);

    if (filtered.length !== schedule.length) {
      stopTimer(true);

      // adjust index safely
      let newIdx = currentIndex;
      if (newIdx >= filtered.length) newIdx = Math.max(0, filtered.length - 1);

      setSchedule(filtered);
      setCurrentIndex(newIdx);

      if (skippedNames.length > 0) {
        const unique = Array.from(new Set(skippedNames));
        setDateNotice(
          `⛔ Not scheduled (target date passed): ${unique.join(
            ", "
          )}. Please update the target date to plan them again.`
        );
      }
    } else {
      // keep existing notice (don’t wipe while user reads)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, schedule]);

  // Auto start BREAK only
  useEffect(() => {
    if (!current) return;
    if (current.type !== "break") return;
    if (running) return;

    startTimerForCurrent();
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
    PlannerTimer.stop(reset);
  }

  function startTimerForCurrent() {
    if (!current) return;

    timeUpHandledRef.current = false;

    const durationSeconds = Number(current.durationMinutes || 0) * 60;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    PlannerTimer.start(durationSeconds, () => {
      if (timeUpHandledRef.current) return;
      timeUpHandledRef.current = true;

      if (current?.type === "study") {
        completeCurrentStudy(true);
      } else {
        moveToNextOrEnd();
      }
    });
  }

  function toggleTimer() {
    if (!current) return;
    if (current.type === "break") return;

    if (running) {
      PlannerTimer.pause();
      return;
    }

    if (secondsLeft > 0) {
      PlannerTimer.resume(() => {
        if (timeUpHandledRef.current) return;
        timeUpHandledRef.current = true;
        completeCurrentStudy(true);
      });
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
      const data = await plannerApi.generateSchedule(normalizeSettings(settings));

      if (Array.isArray(data) && data.length > 0) {
        // ✅ filter out sessions whose subject target date has passed
        const { filtered, skippedNames } = filterOutExpiredSessions(data, subjects);

        if (skippedNames.length > 0) {
          const unique = Array.from(new Set(skippedNames));
          const msg = `⛔ Not scheduled (target date passed): ${unique.join(
            ", "
          )}. Please update the target date to plan them again.`;
          setDateNotice(msg);

          // also show a popup message (so user can't miss it)
          window.alert(msg);
        }

        const safeData = filtered;
        if (safeData.length === 0) {
          setSchedule([]);
          setCurrentIndex(0);
        } else {
          const safeIdx = Math.min(keepIdx, safeData.length - 1);
          setSchedule(safeData);
          setCurrentIndex(safeIdx);
        }
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

  async function confirmDeleteIfComplete(subjectId) {
    const latestSubjects = await refreshSubjects();
    const subj = latestSubjects.find((s) => String(s.id) === String(subjectId));
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

      await confirmDeleteIfComplete(subj.id);
    }

    if (moveNextAfter) {
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
      return;
    }

    await regenerateScheduleKeepIndex(currentIndex);
    actionLockRef.current = false;
  }

  async function skipSession() {
    if (!current || current.type !== "study") return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    stopTimer(true);

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

    try {
      await plannerApi.markMissed(current.subjectId);
    } catch {}

    await refreshMissed();

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
                  Start: {current.startTime} • Duration: {current.durationMinutes}{" "}
                  min
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-900">
                  {statusText}
                </div>

                {/* ✅ message (only when needed) */}
                {dateNotice ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {dateNotice}
                  </div>
                ) : null}

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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleTimer}
              disabled={!current || current?.type === "break"}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              title={current?.type === "break" ? "Break auto starts" : ""}
            >
              {running ? "Pause" : secondsLeft > 0 ? "Resume" : "Start"}
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
            Missed :{" "}
            <span className="font-semibold text-slate-900">
              {missed?.length || 0}
            </span>
            <span className="mx-2">•</span>
            Skips today :{" "}
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