import { useMemo } from "react";

export default function Report({ schedule, subjects, missed }) {
  const stats = useMemo(() => {
    const studyMin = (schedule || [])
      .filter((s) => s.type === "study")
      .reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    const breakMin = (schedule || [])
      .filter((s) => s.type === "break")
      .reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    const totalTopics = subjects.reduce((a, s) => a + Number(s.totalTopics || 0), 0);
    const completedTopics = subjects.reduce((a, s) => a + Number(s.completedTopics || 0), 0);

    const completionPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return { studyMin, breakMin, completionPct, totalTopics, completedTopics };
  }, [schedule, subjects]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card label="Study Time" value={`${stats.studyMin} min`} />
        <Card label="Break Time" value={`${stats.breakMin} min`} />
        <Card label="Completion" value={`${stats.completionPct}%`} />
        <Card label="Missed Sessions" value={`${missed.length}`} />
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Subject Progress</div>
            <div className="mt-1 text-sm text-slate-500">Topics done vs total topics</div>
          </div>

          <div className="text-sm font-semibold text-slate-900">
            {stats.completedTopics}/{stats.totalTopics} topics
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
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const pct = s.totalTopics ? Math.round((s.completedTopics / s.totalTopics) * 100) : 0;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="py-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3 text-slate-700">{s.priority}/5</td>
                    <td className="py-3 text-slate-700">{s.completedTopics}</td>
                    <td className="py-3 text-slate-700">{s.totalTopics}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {subjects.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={5}>
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
