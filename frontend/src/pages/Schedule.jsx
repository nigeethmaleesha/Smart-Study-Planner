export default function Schedule() {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="font-semibold">Daily Schedule</h2>
      <p className="text-sm text-slate-500 mt-2">
        This page will show sessions returned from backend <code>/plan/generate</code>.
      </p>
    </div>
  );
}
