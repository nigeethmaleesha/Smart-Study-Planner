export default function PlannerSettings({ settings, setSettings }) {
  function update(k, v) {
    setSettings((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <Label>Start Time</Label>
        <input
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          type="time"
          value={settings.startTime}
          onChange={(e) => update("startTime", e.target.value)}
        />
      </Card>

      <Card>
        <Label>Daily Max Hours</Label>
        <input
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          min={1}
          step={0.5}
          value={settings.dailyMaxHours}
          onChange={(e) => update("dailyMaxHours", Number(e.target.value))}
        />
      </Card>

      <Card>
        <Label>Break Every (minutes)</Label>
        <input
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          min={15}
          step={5}
          value={settings.breakEveryMinutes}
          onChange={(e) => update("breakEveryMinutes", Number(e.target.value))}
        />
      </Card>

      <Card>
        <Label>Break Duration (minutes)</Label>
        <input
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          min={5}
          step={5}
          value={settings.breakDurationMinutes}
          onChange={(e) => update("breakDurationMinutes", Number(e.target.value))}
        />
      </Card>

      
    </div>
  );
}

function Card({ children }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-sm">{children}</div>;
}

function Label({ children }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}
