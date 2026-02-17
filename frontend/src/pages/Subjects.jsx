import { useState } from "react";

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");

  const addSubject = () => {
    if (!name.trim()) return;
    setSubjects((prev) => [
      {
        id: crypto.randomUUID(),
        name,
        durationMinutes: 30,
        priority: 3,
        totalTopics: 10,
        completedTopics: 0,
      },
      ...prev,
    ]);
    setName("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-[360px_1fr]">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Add Subject</h2>

        <label className="block text-sm text-slate-600 mt-4">Subject Name</label>
        <input
          className="mt-2 w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Data Structures"
        />

        <button
          className="mt-4 w-full rounded-xl bg-blue-600 text-white py-3 font-medium hover:bg-blue-700"
          onClick={addSubject}
        >
          Add
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Subjects</h2>
          <span className="text-sm text-slate-500">{subjects.length} total</span>
        </div>

        {subjects.length === 0 ? (
          <p className="mt-4 text-slate-500 text-sm">No subjects yet. Add your first subject.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">Priority</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-3 font-medium">{s.name}</td>
                    <td className="py-3">{s.durationMinutes} min</td>
                    <td className="py-3">{s.priority}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
