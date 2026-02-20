import { useMemo, useState, useEffect } from "react";
import { plannerApi } from "../api/plannerApi";

export default function Subjects({ subjects, setSubjects }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Load subjects from backend once
  useEffect(() => {
    (async () => {
      try {
        const data = await plannerApi.getSubjects();
        setSubjects(Array.isArray(data) ? data : []);
      } catch {
        setSubjects([]);
      }
    })();
  }, [setSubjects]);

  const totals = useMemo(() => {
    const totalTopics = subjects.reduce((a, s) => a + Number(s.totalTopics || 0), 0);
    const completedTopics = subjects.reduce((a, s) => a + Number(s.completedTopics || 0), 0);
    const pct = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return { totalTopics, completedTopics, pct };
  }, [subjects]);

  async function refresh() {
    const data = await plannerApi.getSubjects();
    setSubjects(Array.isArray(data) ? data : []);
  }

  async function addSubject() {
    if (!name.trim()) return;

    setBusy(true);
    try {
      await plannerApi.addSubject({
        name: name.trim(),
        durationMinutes: 30,
        priority: 3,
        totalTopics: 10,
        completedTopics: 0,
        targetDate: "",
      });
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateSubject(id, patch) {
    // keep UI instant (optimistic) without changing style
    const current = subjects.find((s) => s.id === id);
    if (!current) return;

    const updated = { ...current, ...patch };
    setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));

    try {
      await plannerApi.updateSubject(id, updated);
    } catch {
      // rollback by reloading
      await refresh();
    }
  }

  async function removeSubject(id) {
    // optimistic
    setSubjects((prev) => prev.filter((s) => s.id !== id));

    try {
      await plannerApi.deleteSubject(id);
    } catch {
      await refresh();
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      {/* Add */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Add Subject</div>
        <p className="mt-1 text-sm text-slate-500">Create a subject node for the circular rotation.</p>

        <label className="mt-4 block text-sm font-semibold text-slate-700">Subject Name</label>
        <input
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Data Structures"
        />

        <button
          onClick={addSubject}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Adding..." : "Add Subject"}
        </button>

        <div className="mt-5 rounded-3xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">Overall completion</div>
            <div className="text-xs font-semibold text-slate-900">{totals.pct}%</div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-blue-600" style={{ width: `${totals.pct}%` }} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Mini label="Total topics" value={totals.totalTopics} />
            <Mini label="Completed" value={totals.completedTopics} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {subjects.length === 0 ? (
          <EmptyState />
        ) : (
          subjects.map((s) => {
            const remaining = Math.max(0, s.totalTopics - s.completedTopics);
            const pct = s.totalTopics ? Math.round((s.completedTopics / s.totalTopics) * 100) : 0;

            return (
              <div key={s.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-semibold text-slate-900">{s.name}</div>
                      <PriorityBadge value={s.priority} />
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Duration: <span className="font-semibold text-slate-700">{s.durationMinutes} min</span> · Remaining topics:{" "}
                      <span className="font-semibold text-slate-700">{remaining}</span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Progress</span>
                        <span className="font-semibold text-slate-900">{pct}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeSubject(s.id)}
                    className="rounded-2xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Field label="Duration (min)">
                    <input
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min={5}
                      step={5}
                      value={s.durationMinutes}
                      onChange={(e) => updateSubject(s.id, { durationMinutes: Number(e.target.value) })}
                    />
                  </Field>

                  <Field label="Priority (1–5)">
                    <input
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min={1}
                      max={5}
                      value={s.priority}
                      onChange={(e) => updateSubject(s.id, { priority: Number(e.target.value) })}
                    />
                  </Field>

                  <Field label="Total Topics">
                    <input
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min={1}
                      value={s.totalTopics}
                      onChange={(e) => updateSubject(s.id, { totalTopics: Number(e.target.value) })}
                    />
                  </Field>

                  <Field label="Completed Topics">
                    <input
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min={0}
                      max={s.totalTopics}
                      value={s.completedTopics}
                      onChange={(e) => updateSubject(s.id, { completedTopics: Number(e.target.value) })}
                    />
                  </Field>

                  <Field label="Target Date (optional)">
                    <input
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      type="date"
                      value={s.targetDate || ""}
                      onChange={(e) => updateSubject(s.id, { targetDate: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function PriorityBadge({ value }) {
  const text =
    value >= 5 ? "Very High" : value === 4 ? "High" : value === 3 ? "Medium" : value === 2 ? "Low" : "Very Low";

  const cls =
    value >= 5
      ? "bg-red-50 text-red-700 border-red-200"
      : value === 4
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : value === 3
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100" />
      <div className="mt-4 text-base font-semibold text-slate-900">No subjects yet</div>
      <div className="mt-2 text-sm text-slate-500">Add a subject to start building the circular rotation list.</div>
    </div>
  );
}
