import { useMemo } from "react";

export default function Report({ schedule = [], subjects = [], missedLog = [] }) {
  const data = useMemo(() => {
    const studyMin = schedule.filter((s) => s.type === "study").reduce((a, s) => a + Number(s.durationMinutes || 0), 0);
    const breakMin = schedule.filter((s) => s.type === "break").reduce((a, s) => a + Number(s.durationMinutes || 0), 0);

    // missed per subject
    const missedMap = new Map();
    for (const m of missedLog) {
      const key = String(m.subjectId);
      missedMap.set(key, (missedMap.get(key) || 0) + 1);
    }

    // table rows for subjects (include missed count)
    const rows = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      priority: s.priority,
      completedTopics: Number(s.completedTopics || 0),
      totalTopics: Number(s.totalTopics || 0),
      missedCount: missedMap.get(String(s.id)) || 0,
    }));

    const totalTopics = rows.reduce((a, r) => a + r.totalTopics, 0);
    const completedTopics = rows.reduce((a, r) => a + r.completedTopics, 0);
    const completionPct = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;

    const missedCount = missedLog.length;

    return { studyMin, breakMin, completionPct, totalTopics, completedTopics, missedCount, rows };
  }, [schedule, subjects, missedLog]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card label="Study Time" value={`${data.studyMin} min`} />
        <Card label="Break Time" value={`${data.breakMin} min`} />
        <Card label="Completion" value={`${data.completionPct}%`} />
        <Card label="Missed Sessions" value={`${data.missedCount}`} />
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Subject Progress</div>
            <div className="mt-1 text-sm text-slate-500">Completed vs Total + Missed counts</div>
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {data.completedTopics}/{data.totalTopics} topics
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-3">Subject</th>
                <th className="py-3">Priority</th>
                <th className="py-3">Completed</th>
                <th className="py-3">Total</th>
                <th className="py-3">%</th>
                <th className="py-3">Missed</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const pct = r.totalTopics ? Math.round((r.completedTopics / r.totalTopics) * 100) : 0;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="py-3 text-slate-700">{r.priority}/5</td>
                    <td className="py-3 text-slate-700">{r.completedTopics}</td>
                    <td className="py-3 text-slate-700">{r.totalTopics}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-700">{r.missedCount}</td>
                  </tr>
                );
              })}
              {data.rows.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={6}>
                    No subjects found.
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

function Card({ label, value }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}