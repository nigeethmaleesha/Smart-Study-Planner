import { useMemo } from "react";

export default function Dashboard({ reports = [], subjects = [] }) {
  const latest = reports?.length ? reports[0] : null;

  const overall = useMemo(() => {
    const totalTopics = subjects.reduce((a, s) => a + Number(s.totalTopics || 0), 0);
    const completedTopics = subjects.reduce((a, s) => a + Number(s.completedTopics || 0), 0);
    const pct = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return { totalTopics, completedTopics, pct };
  }, [subjects]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Overall Completion" value={`${overall.pct}%`} sub={`${overall.completedTopics}/${overall.totalTopics} topics`} />
        <Card label="Reports Saved" value={`${reports.length}`} sub="Daily history stored" />
        <Card label="Subjects" value={`${subjects.length}`} sub="Active subjects" />
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-base font-semibold text-slate-900">Latest Day Report</div>
        <div className="mt-1 text-sm text-slate-500">After a day finishes, it is saved here automatically.</div>

        {!latest ? (
          <div className="mt-4 rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
            No report yet. Start Day → Complete/Skip sessions → End Day report will appear.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                Date: <span className="text-slate-700">{latest.dateLabel}</span>
              </div>
              <div className="text-sm font-semibold">
                Completed Topics Today: <span className="text-green-700">{latest.completedTopicsToday}</span> · Missed:{" "}
                <span className="text-red-700">{latest.missedCount}</span>
              </div>
            </div>

            <Banner latest={latest} />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-3">Subject</th>
                    <th className="py-3">Completed Today</th>
                    <th className="py-3">Missed Count</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.subjectRows.map((r) => (
                    <tr key={r.subjectId} className="border-t">
                      <td className="py-3 font-semibold text-slate-900">{r.subjectName}</td>
                      <td className="py-3 text-slate-700">{r.completedToday}</td>
                      <td className="py-3 text-slate-700">{r.missedCount}</td>
                    </tr>
                  ))}
                  {latest.subjectRows.length === 0 ? (
                    <tr>
                      <td className="py-6 text-slate-500" colSpan={3}>
                        No subjects in report.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-base font-semibold text-slate-900">Report History</div>
        <div className="mt-1 text-sm text-slate-500">You can compare day-by-day here.</div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-3">Date</th>
                <th className="py-3">Completed Today</th>
                <th className="py-3">Missed</th>
                <th className="py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-3 font-semibold text-slate-900">{r.dateLabel}</td>
                  <td className="py-3 text-slate-700">{r.completedTopicsToday}</td>
                  <td className="py-3 text-slate-700">{r.missedCount}</td>
                  <td className="py-3">
                    {r.completedTopicsToday >= r.missedCount ? (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                        Good day ✅
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
                        Improve ⚠️
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={4}>
                    No report history yet.
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

function Banner({ latest }) {
  const good = latest.completedTopicsToday >= latest.missedCount;

  if (good) {
    return (
      <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
        <div className="text-sm font-semibold text-green-800">🎉 Congratulations!</div>
        <div className="mt-1 text-sm text-green-700">
          You completed <b>{latest.completedTopicsToday}</b> topics today. Keep this momentum!
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
      <div className="text-sm font-semibold text-red-800">⚠️ Needs Improvement</div>
      <div className="mt-1 text-sm text-red-700">
        Missed sessions are higher than completed topics. Try shorter sessions or reduce daily max hours.
      </div>
    </div>
  );
}

function Card({ label, value, sub }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}