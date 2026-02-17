export default function Planner() {
  return (
    <div className="rounded-2xl border bg-white p-6 max-w-2xl">
      <h2 className="font-semibold">Planner Settings</h2>
      <p className="text-sm text-slate-500 mt-2">
        These settings will be sent to the backend to generate the schedule.
      </p>

      <div className="grid gap-4 mt-6 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-600">Start Time</label>
          <input className="mt-2 w-full rounded-xl border p-3" type="time" defaultValue="08:00" />
        </div>
        <div>
          <label className="text-sm text-slate-600">Daily Max Hours</label>
          <input className="mt-2 w-full rounded-xl border p-3" type="number" defaultValue={4} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Break Every (min)</label>
          <input className="mt-2 w-full rounded-xl border p-3" type="number" defaultValue={60} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Break Duration (min)</label>
          <input className="mt-2 w-full rounded-xl border p-3" type="number" defaultValue={10} />
        </div>
      </div>

      <button className="mt-6 rounded-xl bg-blue-600 text-white px-5 py-3 font-medium hover:bg-blue-700">
        Save Settings
      </button>
    </div>
  );
}
