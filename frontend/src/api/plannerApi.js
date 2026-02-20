const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  return body;
}

export const plannerApi = {
  getSubjects: () => req("/subjects"),
  addSubject: (subject) => req("/subjects", { method: "POST", body: JSON.stringify(subject) }),
  updateSubject: (id, subject) => req(`/subjects/${id}`, { method: "PUT", body: JSON.stringify(subject) }),
  deleteSubject: (id) => req(`/subjects/${id}`, { method: "DELETE" }),

  generateSchedule: (settings) => req("/schedule/generate", { method: "POST", body: JSON.stringify(settings) }),

  getMissed: () => req("/missed"),
  markMissed: (subjectId) => req(`/missed/${subjectId}`, { method: "POST" }),
};