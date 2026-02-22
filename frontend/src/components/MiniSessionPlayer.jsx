import React from "react";

function format(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MiniSessionPlayer({
  visible,
  session,
  running,
  secondsLeft,
  onOpenSchedule,
}) {
  if (!visible || !session) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] rounded-3xl border bg-white p-4 shadow-xl">
      <div className="text-xs font-semibold text-slate-500">
        {running ? "SESSION RUNNING" : "PAUSED"}
      </div>

      <div className="mt-2 text-lg font-semibold text-slate-900 truncate">
        {session.type === "study" ? session.subjectName : "Break"}
      </div>

      <div className="mt-1 text-sm text-slate-600">
        Time left:{" "}
        <span className="font-semibold text-slate-900">
          {format(secondsLeft)}
        </span>
      </div>

      <div className="mt-3">
        <button
          onClick={onOpenSchedule}
          className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Open Session
        </button>
      </div>
    </div>
  );
}