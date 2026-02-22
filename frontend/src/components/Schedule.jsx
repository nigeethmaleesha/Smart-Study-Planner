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

  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // ✅ message when expired subjects are replaced
  const [expiredMsg, setExpiredMsg] = useState("");

  const timeUpHandledRef = useRef(false);
  const actionLockRef = useRef(false);
  const applyingRef = useRef(false);

  const current = schedule?.[currentIndex] || null;
  const next = schedule?.[currentIndex + 1] || null;

  useEffect(() => {
    return PlannerTimer.subscribe(({ running, secondsLeft }) => {
      setRunning(running);
      setSecondsLeft(secondsLeft);
    });
  }, []);

  useEffect(() => {
    timeUpHandledRef.current = false;
    actionLockRef.current = false;
    setExpiredMsg("");
  }, [currentIndex]);

  useEffect(() => {
    if ((schedule || []).length === 0) {
      setCurrentIndex(0);
      PlannerTimer.stop(true);
      return;
    }
    if (currentIndex >= (schedule || []).length) {
      setCurrentIndex(0);
      PlannerTimer.stop(true);
    }
  }, [schedule.length]);

  // ==========================
  // ✅ Target date passed helpers
  // ==========================
  function startOfToday() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
  }

  function parseDateLoose(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

    const s = String(v).trim();
    if (!s) return null;

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d, 0, 0, 0, 0);
      return isNaN(dt.getTime()) ? null : dt;
    }

    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function getSubjectById(subjectId, list = subjects) {
    return (list || []).find((s) => String(s.id) === String(subjectId)) || null;
  }

  function guessTargetDateFromSubject(subj) {
    if (!subj || typeof subj !== "object") return null;

    const directKeys = [
      "targetDate",
      "target_date",
      "targetdate",
      "deadline",
      "dead_line",
      "dueDate",
      "due_date",
      "duedate",
      "endDate",
      "end_date",
      "enddate",
    ];

    for (const k of directKeys) {
      if (subj[k]) return subj[k];
    }

    const keys = Object.keys(subj);
    const candidates = [];

    for (const k of keys) {
      const lk = k.toLowerCase();
      const val = subj[k];

      const looks =
        lk.includes("target") || lk.includes("deadline") || lk.includes("due") || lk.includes("end");
      const hasDateWord = lk.includes("date") || lk.includes("day");

      if (looks || hasDateWord) {
        const dt = parseDateLoose(val);
        if (dt) candidates.push({ key: k, dt });
      }
    }

    candidates.sort((a, b) => {
      const score = (k) => {
        const x = k.toLowerCase();
        return (
          (x.includes("target") ? 4 : 0) +
          (x.includes("deadline") ? 3 : 0) +
          (x.includes("due") ? 2 : 0) +
          (x.includes("end") ? 1 : 0) +
          (x.includes("date") ? 1 : 0)
        );
      };
      return score(b.key) - score(a.key);
    });

    return candidates.length ? candidates[0].dt : null;
  }

  function isSubjectExpiredByObj(subj) {
    if (!subj) return false;
    const raw = guessTargetDateFromSubject(subj);
    const dt = raw instanceof Date ? raw : parseDateLoose(raw);
    if (!dt) return false;
    return dt.getTime() < startOfToday().getTime();
  }

  function isSubjectExpired(subjectId, list = subjects) {
    const subj = getSubjectById(subjectId, list);
    if (!subj) return false;
    return isSubjectExpiredByObj(subj);
  }

  function remainingTopics(subj) {
    const total = Number(subj?.totalTopics || 0);
    const done = Number(subj?.completedTopics || 0);
    return Math.max(0, total - done);
  }

  // ==========================
  // ✅ MAIN FIX:
  // Replace expired subject sessions WITHOUT removing time slots
  // ==========================
  function buildActivePool(list) {
    const arr = Array.isArray(list) ? list : [];

    const active = arr
      .filter((s) => s && !isSubjectExpiredByObj(s))
      .filter((s) => remainingTopics(s) > 0);

    // order: earliest target date first (if exists), else by more remaining topics
    active.sort((a, b) => {
      const da = guessTargetDateFromSubject(a);
      const db = guessTargetDateFromSubject(b);
      const dta = da instanceof Date ? da : parseDateLoose(da);
      const dtb = db instanceof Date ? db : parseDateLoose(db);

      const aHas = !!dta;
      const bHas = !!dtb;

      if (aHas && bHas) return dta.getTime() - dtb.getTime();
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      return remainingTopics(b) - remainingTopics(a);
    });

    return active;
  }

  function replaceExpiredSessions(plainSchedule, list) {
    const sch = Array.isArray(plainSchedule) ? plainSchedule : [];
    if (!sch.length) return { nextSchedule: sch, changed: false, removedNames: [] };

    const activePool = buildActivePool(list);

    // If no active subjects, we cannot replace study sessions
    if (activePool.length === 0) {
      // just blank out expired study sessions subjectName/Id so user cannot go to it
      let changed = false;
      const removedNames = [];

      const nextSchedule = sch.map((item) => {
        if (!item) return item;
        if (item.type !== "study") return item;

        const subj = getSubjectById(item.subjectId, list);
        const expired = item.subjectId ? isSubjectExpired(item.subjectId, list) : false;

        if (expired) {
          if (subj?.name) removedNames.push(subj.name);
          changed = true;
          return { ...item, subjectId: null, subjectName: "—" };
        }
        return item;
      });

      return { nextSchedule, changed, removedNames };
    }

    let cursor = 0;
    let changed = false;
    const removedNames = [];

    const nextSchedule = sch.map((item) => {
      if (!item) return item;
      if (item.type !== "study") return item;

      const expired = item.subjectId ? isSubjectExpired(item.subjectId, list) : false;

      if (!expired) return item;

      const oldSubj = getSubjectById(item.subjectId, list);
      if (oldSubj?.name) removedNames.push(oldSubj.name);

      // pick next active subject (round-robin)
      const pick = activePool[cursor % activePool.length];
      cursor += 1;

      changed = true;
      return {
        ...item,
        subjectId: pick.id,
        subjectName: pick.name,
      };
    });

    return { nextSchedule, changed, removedNames };
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr || []) {
      const k = String(x || "");
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

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

  // ✅ Apply replacement when subjects are available (so expired never appears)
  useEffect(() => {
    if (applyingRef.current) return;
    if (!Array.isArray(subjects) || subjects.length === 0) return;
    if (!Array.isArray(schedule) || schedule.length === 0) return;

    applyingRef.current = true;

    const { nextSchedule, changed, removedNames } = replaceExpiredSessions(schedule, subjects);

    if (changed) {
      stopTimer(true);
      setSchedule(nextSchedule);

      const uniqueRemoved = uniq(removedNames);
      setExpiredMsg(
        uniqueRemoved.length
          ? `⚠️ Target date passed: ${uniqueRemoved.join(", ")}. Removed from schedule and replaced with other subjects.`
          : `⚠️ Some subjects target date passed. Removed from schedule and replaced with other subjects.`
      );

      // keep currentIndex safe
      const safeIdx = Math.min(currentIndex, Math.max(0, nextSchedule.length - 1));
      setCurrentIndex(safeIdx);
    }

    setTimeout(() => {
      applyingRef.current = false;
    }, 0);
  }, [subjects, schedule?.length]);

  // Ensure subjects are loaded when day starts
  useEffect(() => {
    if (!dayStarted) return;
    if (Array.isArray(subjects) && subjects.length > 0) return;
    refreshSubjects();
  }, [dayStarted]);

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

  // Auto start BREAK only
  useEffect(() => {
    if (!current) return;
    if (current.type !== "break") return;
    if (running) return;

    startTimerForCurrent();
  }, [currentIndex, current?.type]);

  function toggleTimer() {
    if (!current) return;
    if (current.type === "break") return;

    // if somehow a blank study slipped (no subjectId), block
    if (current.type === "study" && !current.subjectId) {
      setExpiredMsg(`⚠️ This study session cannot run because its subject target date has passed and no replacement is available.`);
      return;
    }

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

    const keepIdx = typeof desiredIndex === "number" ? desiredIndex : currentIndex;

    setBusy(true);
    try {
      const latestSubjects = await refreshSubjects();
      const data = await plannerApi.generateSchedule(normalizeSettings(settings));

      if (Array.isArray(data) && data.length > 0) {
        const { nextSchedule, changed, removedNames } = replaceExpiredSessions(data, latestSubjects);

        setSchedule(nextSchedule);
        const safeIdx = Math.min(keepIdx, Math.max(0, nextSchedule.length - 1));
        setCurrentIndex(safeIdx);

        if (changed) {
          const uniqueRemoved = uniq(removedNames);
          setExpiredMsg(
            uniqueRemoved.length
              ? `⚠️ Target date passed: ${uniqueRemoved.join(", ")}. Removed from schedule and replaced with other subjects.`
              : `⚠️ Some subjects target date passed. Removed from schedule and replaced with other subjects.`
          );
        } else {
          setExpiredMsg("");
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
    if (!current.subjectId) {
      setExpiredMsg(`⚠️ This study session cannot be completed because its subject is not available.`);
      return;
    }
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
    if (!current.subjectId) {
      setExpiredMsg(`⚠️ This study session cannot be skipped because its subject is not available.`);
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    stopTimer(true);

    setMissedLog((prev) => {
      const key = `${current.subjectId}__${current.startTime}__${currentIndex}`;
      const already = prev.some((x) => `${x.subjectId}__${x.startTime}__${x.index}` === key);
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

    const completedTopicsToday = mergedRows.reduce((a, r) => a + r.completedToday, 0);
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
            <div className="text-xs font-semibold text-slate-500">CURRENT SESSION</div>

            {!current ? (
              <div className="mt-2 text-slate-700">No schedule available.</div>
            ) : (
              <>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {current.type === "study" ? current.subjectName : "Break"}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Start: {current.startTime} • Duration: {current.durationMinutes} min
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-900">{statusText}</div>

                {expiredMsg ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {expiredMsg}
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
              disabled={!current || current?.type !== "study" || !current?.subjectId}
              className="rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              Complete
            </button>

            <button
              onClick={skipSession}
              disabled={!current || current?.type !== "study" || !current?.subjectId}
              className="rounded-2xl border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-slate-600">
            Missed :{" "}
            <span className="font-semibold text-slate-900">{missed?.length || 0}</span>
            <span className="mx-2">•</span>
            Skips today :{" "}
            <span className="font-semibold text-slate-900">{missedLog?.length || 0}</span>
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
            <div className="text-base font-semibold text-slate-900">Today Plan</div>
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
                  className={["border-t", idx === currentIndex ? "bg-slate-50" : ""].join(" ")}
                  onClick={() => {
                    stopTimer(true);
                    setExpiredMsg("");
                    setCurrentIndex(idx);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td className="py-3 text-slate-700">{idx + 1}</td>
                  <td className="py-3 font-semibold text-slate-900">{s.type}</td>
                  <td className="py-3 text-slate-700">{s.startTime}</td>
                  <td className="py-3 text-slate-700">{s.durationMinutes} min</td>
                  <td className="py-3 text-slate-700">
                    {s.type === "study" ? (s.subjectName || "—") : "-"}
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