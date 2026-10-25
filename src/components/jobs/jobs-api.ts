import { httpRequest } from "@/lib/http-client";

export type LastRun = { status: "SUCCEEDED" | "FAILED" | "SKIPPED"; trigger: string; startedAt: string; finishedAt: string; durationMs: number; result: Record<string, unknown>; error: string | null };
export type Schedule = {
  name: string; description: string | null; schedule: string; every: number | null; cron: string | null; tz: string | null;
  nextRunAt: string | null; scheduled: boolean; canRunNow: boolean; lastRun: LastRun | null;
};
export type Overview = {
  redis: { status: "connected" | "unavailable" | "not_configured"; error?: string };
  queue: Partial<Record<"waiting" | "active" | "delayed" | "failed" | "completed" | "paused" | "prioritized", number>>;
  workers: { name: string; ageSeconds: number; idleSeconds: number }[];
  schedules: Schedule[];
  mail: { PENDING: number; PROCESSING: number; SENT: number; FAILED: number; gaveUp: number; mode: "smtp" | "mailbox"; maxAttempts: number };
  handlers: string[];
  checkedAt: string;
};
export type FailedJob = {
  id: string; name: string; scope: "organization" | "platform"; error: string; attemptsMade: number; attempts: number;
  createdAt: string; failedAt: string | null; data: string | null; description: string | null; known: boolean;
  /** False when the job belongs to the platform (or another brand) — only platform admins can retry it. */
  canRetry?: boolean;
};
export type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";
export type OutboxItem = {
  id: string; recipient: string; subject: string; status: OutboxStatus; attempts: number; availableAt: string; sentAt: string | null;
  lastError: string | null; createdAt: string; gaveUp: boolean;
};
export type JobRun = { id: string; name: string; trigger: string; status: LastRun["status"]; startedAt: string; finishedAt: string; durationMs: number; result: Record<string, unknown>; error: string | null };

export const jobsApi = {
  overview: () => httpRequest<Overview>("/api/v2/jobs/overview"),
  failed: () => httpRequest<{ items: FailedJob[] }>("/api/v2/jobs/failed?limit=100"),
  retry: (id: string) => httpRequest<{ id: string; retried: boolean }>(`/api/v2/jobs/failed/${encodeURIComponent(id)}/retry`, { method: "POST" }),
  run: (name: string) => httpRequest<{ queued: boolean; jobId?: string; workersOnline: number }>(`/api/v2/jobs/run/${encodeURIComponent(name)}`, { method: "POST" }),
  runs: (name = "") => httpRequest<{ items: JobRun[] }>(`/api/v2/jobs/runs?limit=100${name ? `&name=${encodeURIComponent(name)}` : ""}`),
  outbox: (status = "") => httpRequest<{ items: OutboxItem[]; counts: Record<string, number>; maxAttempts: number; mode: string }>(`/api/v2/jobs/outbox?limit=100${status ? `&status=${status}` : ""}`),
  requeue: (id: string) => httpRequest<{ id: string; status: string }>(`/api/v2/jobs/outbox/${encodeURIComponent(id)}/requeue`, { method: "POST" }),
};

/** "helpdesk.sla_watch" → "Helpdesk · SLA watch". */
export function jobLabel(name: string) {
  const [area, ...rest] = name.split(".");
  const words = rest.join(" ").replace(/[_-]+/g, " ").trim();
  const fix = (text: string) => text.replace(/\bsla\b/gi, "SLA").replace(/\blms\b/gi, "LMS");
  const title = (text: string) => fix(text.charAt(0).toUpperCase() + text.slice(1));
  return words ? `${title(area)} · ${fix(words)}` : title(area);
}

export function when(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

/** Relative time in either direction: "in 12 min", "3 h ago". */
export function relative(value: string | null) {
  if (!value) return "—";
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const text = abs < 45 ? "moments" : abs < 3600 ? `${Math.round(abs / 60)} min` : abs < 86400 ? `${Math.round(abs / 3600)} h` : `${Math.round(abs / 86400)} d`;
  if (text === "moments") return diff >= 0 ? "any moment" : "just now";
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function duration(ms: number) {
  return ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

/** Compact "dueSoon 1 · breached 2" summary of a run result (numbers first, zeros dropped). */
export function summarise(result: Record<string, unknown> | null | undefined) {
  if (!result) return "";
  if (result.skipped) return String(result.reason || "Skipped");
  const parts = Object.entries(result)
    .filter(([key, value]) => typeof value === "number" && value > 0 && key !== "organizations" && key !== "retentionDays")
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").toLowerCase()} ${value}`);
  return parts.length ? parts.join(" · ") : "Nothing to do";
}
