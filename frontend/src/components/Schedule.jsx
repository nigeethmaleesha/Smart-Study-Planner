import { useEffect, useRef, useState } from "react";
import { plannerApi } from "../api/plannerApi";

function normalizeSettings(s) {
  const safe = {
    startTime: s?.startTime || "08:00",
    dailyMaxHours: Number(s?.dailyMaxHours || 2),
    breakEveryMinutes: Number(s?.breakEveryMinutes || 50),
    breakDurationMinutes: Number(s?.breakDurationMinutes || 10),
  };

  if (safe.dailyMaxHours <= 0) safe.dailyMaxHours = 2;
  if (safe.breakEveryMinutes < 15) safe.breakEveryMinutes = 50;
  if (safe.breakDurationMinutes < 5) safe.breakDurationMinutes = 10;

  return safe;
}

export default function Schedule({
  settings,
  schedule,
  setSchedule,
  missed,
  setMissed,
  subjects,
  setSubjects,
}) {
  const [busy, setBusy] = useState(false);

  // timer state
  const [runningIdx, setRunningIdx] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef(null);

  // load missed list once
  useEffect(() => {
    (async () => {
      try {
        const data = await plannerApi.getMissed();
        setMissed(Array.isArray(data) ? data : []);
      } catch {
        setMissed([]);
      }
    })();
  }, [setMissed]);

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function refreshSubjects() {
    try {
      const data = await plannerApi.getSubjects();
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const payload = normalizeSettings(settings);
      const data = await plannerApi.generateSchedule(payload);

      if (Array.isArray(data) && data.length > 0) {
        setSchedule(data);
      } else {
        alert("No schedule generated. Check: subjects added + settings values.");
      }
    } catch (e) {
      alert(`Schedule generation failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  function startTimer(idx) {
    const item = schedule?.[idx];
    if (!item || item.type !== "study") return;

    // stop previous if running
    stopTimer();

    setRunningIdx(idx);
    setSecondsLeft(Number(item.durationMinutes || 0) * 60);

    intervalRef.current = setInterval(async () => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // end
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          // handle end in next tick
          setTimeout(() => onSlotFinished(idx), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunningIdx(null);
    setSecondsLeft(0);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function onSlotFinished(idx) {
    const item = schedule?.[idx];
    if (!item || item.type !== "study") return;

    setRunningIdx(null);
    setSecondsLeft(0);

    // Ask user what happened
    const ok = window.confirm(`Time finished for "${item.subjectName}".\n\nPress OK if you completed topics.\nPress Cancel if missed.`);
    if (!ok) {
      await markMissed(item);
      return;
    }

    // ask completed topics count
    const input = window.prompt(`How many topics did you complete for "${item.subjectName}"?`, "1");
    const done = Math.max(0, Number(input || 0));

    // update subject in backend
    const current = subjects.find((s) => s.id === item.subjectId);
    if (current) {
      const updated = {
        ...current,
        completedTopics: Math.min(Number(current.totalTopics || 0), Number(current.completedTopics || 0) + done),
      };
      try {
        await plannerApi.updateSubject(current.id, updated);
        await refreshSubjects();
      } catch {
        // ignore, but try refresh
        await refreshSubjects();
      }
    }

    // regenerate schedule with new priorities
    await generate();
  }

  async function markMissed(item) {
    if (!item?.subjectId) return;
    try {
      await plannerApi.markMissed(item.subjectId);
      const data = await plannerApi.getMissed();
      setMissed(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }

  async function completeNow(idx) {
    const item = schedule?.[idx];
    if (!item || item.type !== "study") return;

    // if running, stop it
    if (runningIdx === idx) stopTimer();

    const input = window.prompt(`Complete now: How many topics did you finish for "${item.subjectName}"?`, "1");
    const done = Math.max(0, Number(input || 0));

    const current = subjects.find((s) => s.id === item.subjectId);
    if (current) {
      const updated = {
        ...current,
        completedTopics: Math.min(Number(current.totalTopics || 0), Number(current.completedTopics || 0) + done),
      };
      try {
        await plannerApi.updateSubject(current.id, updated);
        await refreshSubjects();
      } catch {
        await refreshSubjects();
      }
    }

    await generate();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Daily Schedule</div>
            <div className="mt-1 text-sm text-slate-500">
              Generated by backend using Circular Linked List → MaxHeap (array).
            </div>
          </div>

          <button
            onClick={generate}
            disabled={busy}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Generating..." : "Generate Schedule"}
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Session Timer</div>
        <div className="mt-1 text-sm text-slate-500">
          {runningIdx === null ? "No active session." : `Running: #${runningIdx + 1} (${formatTime(secondsLeft)})`}
        </div>
        {runningIdx !== null ? (
          <button
            onClick={stopTimer}
            className="mt-3 rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Stop
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Today Plan</div>
            <div className="mt-1 text-sm text-slate-500">Study + break blocks</div>
          </div>
          <div className="text-sm font-semibold text-slate-900">{(schedule || []).length} items</div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-3">Type</th>
                <th className="py-3">Start</th>
                <th className="py-3">Duration</th>
                <th className="py-3">Subject</th>
                <th className="py-3">Priority</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(schedule || []).map((s, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-3 font-semibold text-slate-900">{s.type}</td>
                  <td className="py-3 text-slate-700">{s.startTime}</td>
                  <td className="py-3 text-slate-700">{s.durationMinutes} min</td>
                  <td className="py-3 text-slate-700">{s.type === "study" ? s.subjectName : "-"}</td>
                  <td className="py-3 text-slate-700">{s.type === "study" ? `${s.priority}/5` : "-"}</td>

                  <td className="py-3">
                    {s.type === "study" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startTimer(idx)}
                          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                          Start
                        </button>

                        <button
                          onClick={() => completeNow(idx)}
                          className="rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Complete
                        </button>

                        <button
                          onClick={() => markMissed(s)}
                          className="rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Missed
                        </button>
                      </div>
                    ) : null}
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

        <div className="mt-5 rounded-3xl border bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Missed sessions</div>
          <div className="mt-1 text-sm text-slate-600">
            {missed?.length ? `${missed.length} missed item(s) recorded in backend.` : "No missed sessions recorded."}
          </div>
        </div>
      </div>
    </div>
  );
}