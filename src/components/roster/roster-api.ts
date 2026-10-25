import { httpRequest } from "@/lib/http-client";

export type Template = {
  id: string; code: string; name: string; startTime: string; endTime: string; breakMinutes: number; color: string;
  minHeadcount: number; active: boolean; sortOrder: number; version: number; paidHours: number; overnight: boolean;
};
export type Settings = { minRestHours: number; maxWeeklyHours: number; maxConsecutiveDays: number; version: number };
export type Warning = { code: string; severity: "warning" | "danger"; message: string };
export type Kind = "SHIFT" | "WEEKLY_OFF";
export type Assignment = { id?: string; kind: Kind; templateId: string | null; location: string | null; note: string | null; version?: number; source?: string; caseId?: string | null };
export type LeaveMark = { type: string; code: string; status: "APPROVED" | "PENDING" };
export type Cell = {
  date: string; assignment: Assignment | null; leave: LeaveMark | null; warnings: Warning[]; changed: boolean;
  request: { id: string; caseNumber: string; label: string | null; applied: boolean; role: "requester" | "swap" } | null;
};
export type PublicationState = "EMPTY" | "DRAFT" | "PUBLISHED" | "CHANGED";
export type Employee = { id: string; name: string; number: string; designation: string | null; department: string | null; location: string | null };
export type PersonRow = {
  employee: Employee; cells: Cell[]; hours: number; shifts: number; offs: number; warnings: Warning[]; warningCount: number;
  publication: { state: PublicationState; publishedAt: string | null; revision: number; changes: number };
};
export type CoverageDay = { date: string; working: number; off: number; leave: number; gaps: number; slots: { templateId: string; code: string; name: string; color: string; count: number; min: number; short: number }[] };
export type ShiftRequest = {
  id: string; caseNumber: string; title: string; category: string | null; startDate: string; endDate: string;
  requester: { id: string; name: string }; subject: { id: string; name: string } | null;
  target: { kind: Kind; templateId: string | null; label: string } | null; appliedDays: number; eligibleDays: number; applied: boolean;
};
export type Week = {
  weekStart: string; weekEnd: string; previousWeek: string; nextWeek: string; today: string; scope: "team" | "all";
  days: { date: string; isToday: boolean; isPast: boolean }[];
  settings: Settings; templates: Template[]; people: PersonRow[]; coverage: CoverageDay[]; requests: ShiftRequest[];
  publication: { state: PublicationState; lastPublishedAt: string | null; pendingChanges: number; draftPeople: number; changedPeople: number; publishedPeople: number };
  summary: { hours: number; shifts: number; warnings: number; gaps: number; unplanned: number; onLeave: number; pendingRequests: number };
};
export type Context = {
  viewer: { employeeId: string; roles: string[]; isHr: boolean; reportCount: number; canPlan: boolean };
  templates: Template[]; settings: Settings; departments: string[]; locations: string[]; today: string; currentWeekStart: string;
};
export type SnapshotEntry = { date: string; kind: Kind; templateId: string | null; location: string | null; note: string | null; code?: string; name?: string; startTime?: string; endTime?: string; breakMinutes?: number; color?: string; hours?: number };
export type MyWeek = { weekStart: string; weekEnd: string; published: boolean; publishedAt: string | null; revision: number; shifts: number; hours: number; days: { date: string; isToday: boolean; entry: SnapshotEntry | null; leave: LeaveMark | null }[] };
export type MyRoster = { employee: { name: string; designation: string | null; location: string | null } | null; today: string; weeks: MyWeek[]; settings: Settings };

export type SaveItem = { employeeId: string; date: string; kind: Kind | "CLEAR"; templateId?: string; location?: string; note?: string; version?: number };
export type SaveResult = { saved: number; cleared: number; unchanged: number; skipped: { employeeId: string; date: string; reason: string }[] };

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const rosterApi = {
  context: () => httpRequest<Context>("/api/v2/roster/context"),
  week: (params: { start: string; scope?: string; department?: string; location?: string; search?: string }) => httpRequest<Week>(`/api/v2/roster/week${qs(params)}`),
  mine: (start?: string) => httpRequest<MyRoster>(`/api/v2/roster/me${qs({ start })}`),
  save: (items: SaveItem[], options: { skipConflicts?: boolean; source?: "MANUAL" | "PATTERN" } = {}) =>
    httpRequest<SaveResult>("/api/v2/roster/assignments", { method: "PUT", body: { items, ...options } }),
  copyPrevious: (start: string, employeeIds: string[], overwrite = false) =>
    httpRequest<SaveResult & { kept: number; inactive: number }>("/api/v2/roster/weeks/copy-previous", { method: "POST", body: { start, employeeIds, overwrite } }),
  clear: (start: string, employeeIds: string[]) => httpRequest<{ cleared: number }>("/api/v2/roster/weeks/clear", { method: "POST", body: { start, employeeIds } }),
  publish: (start: string, employeeIds: string[]) =>
    httpRequest<{ published: number; updated: number; unchanged: number; empty: number; notified: number }>("/api/v2/roster/weeks/publish", { method: "POST", body: { start, employeeIds } }),
  applyRequest: (id: string) => httpRequest<SaveResult & { caseNumber: string; target: string; swapped: number }>(`/api/v2/roster/shift-requests/${id}/apply`, { method: "POST", body: {} }),
  templates: () => httpRequest<{ items: Template[]; settings: Settings }>("/api/v2/roster/templates"),
  createTemplate: (body: TemplateInput) => httpRequest<Template>("/api/v2/roster/templates", { method: "POST", body }),
  updateTemplate: (id: string, body: TemplateInput & { version: number }) => httpRequest<Template>(`/api/v2/roster/templates/${id}`, { method: "PATCH", body }),
  updateSettings: (body: Settings) => httpRequest<Settings>("/api/v2/roster/settings", { method: "PUT", body }),
};
export type TemplateInput = { code: string; name: string; startTime: string; endTime: string; breakMinutes: number; color: string; minHeadcount: number; active: boolean };

// ---- dates (all ISO yyyy-mm-dd, treated as calendar dates) ----------------------------------------
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(parse(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(parse(iso));
export const weekday = (iso: string) => fmt(iso, { weekday: "short" });
export const weekdayLong = (iso: string) => fmt(iso, { weekday: "long" });
export const dayNum = (iso: string) => fmt(iso, { day: "numeric" });
export const dayMonth = (iso: string) => fmt(iso, { day: "numeric", month: "short" });
export const fullDay = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });
export function weekRange(start: string) {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${sameMonth ? dayNum(start) : dayMonth(start)} – ${dayMonth(end)} ${end.slice(0, 4)}`;
}
export const timeRange = (template: Pick<Template, "startTime" | "endTime">) => `${template.startTime}–${template.endTime}`;
export const compactTime = (value: string) => (value.endsWith(":00") ? value.slice(0, 2) : value);
export const hoursLabel = (value: number) => `${Math.round(value * 10) / 10} h`;
export function ago(value: string | null) {
  if (!value) return "";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}
