"use client";
import { httpRequest } from "@/lib/http-client";
import type { Tone } from "@/lib/cases";

export type Phase = "PRE_BOARDING" | "DAY_ONE" | "FIRST_WEEK" | "FIRST_90_DAYS";
export type OwnerType = "HR" | "IT" | "MANAGER" | "BUDDY" | "JOINER" | "FINANCE";
export type JoinerStatus = "PRE_BOARDING" | "READY_TO_JOIN" | "JOINED" | "COMPLETED" | "WITHDRAWN";
export type DocCategory = "PAN" | "AADHAAR" | "BANK_PROOF" | "EDUCATION" | "PHOTO" | "OTHER";
export type Viewer = { employeeId: string; roles: string[]; isHr: boolean; isManager: boolean };
export type PersonRef = { id: string; name: string; designation?: string | null };
export type PhaseProgress = { total: number; closed: number; overdue: number; percent: number };

export type JoinerCard = {
  id: string; fullName: string; designation: string; department: string; location: string | null;
  joiningDate: string; daysToJoin: number; employmentType: string;
  status: JoinerStatus; statusLabel: string; tone: Tone; version: number;
  manager: PersonRef | null; buddy: PersonRef | null; employee: { id: string; number: string } | null; fromCandidate: boolean;
  progress: (PhaseProgress & { phases: Partial<Record<Phase, PhaseProgress>> }) | null;
  nextTask: { title: string; ownerType: OwnerType; ownerName: string | null; dueDate: string; overdue: boolean } | null;
  relation: "hr" | "manager" | "buddy" | "owner";
};
export type Joiner = JoinerCard & {
  personalEmail: string | null; phone: string | null; notes: string | null; /** Always null now (PAN is encrypted); use panMasked + onboardingApi.revealPan (HR, audited). */ panNumber: string | null; panOnFile?: boolean; panMasked: string | null; aadhaarMasked: string | null;
  workEmail: string | null; templateName: string | null; templateId: string | null; candidateId: string | null; withdrawnReason: string | null;
  createdAt: string; readyAt: string | null; convertedAt: string | null; completedAt: string | null; withdrawnAt: string | null;
};
export type Task = {
  id: string; joinerId: string; phase: Phase; phaseLabel: string; title: string; description: string | null;
  ownerType: OwnerType; ownerTypeLabel: string; owner: PersonRef | null; dueDate: string; daysLeft: number; overdue: boolean;
  status: "PENDING" | "DONE" | "SKIPPED"; requiresDocument: boolean; documentCategory: DocCategory | null; documentLabel: string | null;
  completesOnConversion: boolean; note: string | null; completedAt: string | null; completedBy: string | null; version: number;
  mine: boolean; canAct: boolean; canEdit: boolean;
  joiner?: { id: string; name: string; designation: string; department: string; joiningDate: string; status: JoinerStatus };
};
export type DocFile = {
  id: string; category: string; originalName: string; mimeType: string; byteSize: number; createdAt: string; uploadedBy: string;
  reviewStatus: "VERIFIED" | "REJECTED" | null; reviewReason: string | null; reviewedAt: string | null; reviewedBy: string | null;
};
export type DocItem = { category: DocCategory; label: string; required: boolean; taskId: string | null; dueDate: string | null; status: "MISSING" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED"; files: DocFile[] };
export type Documents = { items: DocItem[]; otherFiles: DocFile[]; summary: { required: number; verified: number; missing: number; pendingReview: number }; canReview: boolean };
export type JoinerAction = { action: string; label: string; intent: "primary" | "danger" | "neutral"; blockedReason?: string; noteRequired?: boolean };
export type Activity = { id: string; action: string; entityType: string; data: Record<string, any> | null; createdAt: string; actorName: string | null };
export type JoinerDetail = {
  joiner: Joiner; tasks: Task[]; phases: ({ key: Phase; label: string } & PhaseProgress)[];
  documents: Documents | null; activity: Activity[]; access: "hr" | "manager" | "self" | "participant"; fileAccess: "read" | "write" | null;
  actions: JoinerAction[]; viewer: Viewer; welcomeMessage?: string;
};
export type PipelineStats = {
  joining_soon: number; joining_week: number; active: number; with_buddy: number; overdue_tasks: number; overdue_owners: number;
  pendingDocuments: number; preboardingAverage: number | null;
};
export type Pipeline = { items: JoinerCard[]; counts: { status: JoinerStatus; count: number }[]; departments: string[]; stats: PipelineStats; viewer: Viewer };
export type Candidate = { id: string; caseNumber: string; name: string; email: string; phone: string; joiningDate: string | null; position: string; designation: string; location: string; hiredAt: string };
export type TemplateSummary = { id: string; name: string; description: string | null; isDefault: boolean; version: number; updatedAt: string; taskCount: number; activeJoiners: number };
export type TemplateTask = { id?: string; phase: Phase; title: string; description: string | null; ownerType: OwnerType; dueOffsetDays: number; requiresDocument: boolean; documentCategory: DocCategory | null; completesOnConversion: boolean };
export type Template = { id: string; name: string; description: string | null; isDefault: boolean; version: number; updatedAt: string; tasks: TemplateTask[] };
export type Settings = {
  hrOwner: PersonRef | null; itOwner: PersonRef | null; financeOwner: PersonRef | null; employeeNumberPrefix: string; workEmailDomain: string | null;
  welcomeMessage: string; version: number; saved: boolean; viewer: Viewer;
};
export type Employee = { id: string; employeeNumber: string; fullName: string; designation: string | null; department: string | null; status: string };

const base = "/api/v2/onboarding";
export const onboardingApi = {
  pipeline: (params: URLSearchParams) => httpRequest<Pipeline>(`${base}/joiners?${params}`),
  upcoming: (days = 14) => httpRequest<{ items: JoinerCard[]; days: number; viewer: Viewer }>(`${base}/upcoming?days=${days}`),
  candidates: () => httpRequest<{ items: Candidate[] }>(`${base}/candidates`),
  joiner: (id: string) => httpRequest<JoinerDetail>(`${base}/joiners/${id}`),
  welcome: () => httpRequest<Partial<JoinerDetail> & { joiner: Joiner | null; viewer: Viewer }>(`${base}/welcome`),
  create: (body: Record<string, unknown>) => httpRequest<JoinerDetail>(`${base}/joiners`, { method: "POST", body }),
  revealPan: (id: string, reason?: string) => httpRequest<{ field: "pan"; value: string; masked: string | null }>(`${base}/joiners/${id}/reveal`, { method: "POST", body: { field: "pan", reason } }),
  update: (id: string, body: Record<string, unknown>) => httpRequest<JoinerDetail>(`${base}/joiners/${id}`, { method: "PATCH", body }),
  transition: (id: string, body: { action: string; version: number; note?: string; workEmail?: string }) =>
    httpRequest<JoinerDetail>(`${base}/joiners/${id}/transitions`, { method: "POST", body }),
  conversionPreview: (id: string) => httpRequest<{ workEmail: string; employeeNumber: string }>(`${base}/joiners/${id}/conversion-preview`),
  addTask: (id: string, body: Record<string, unknown>) => httpRequest<{ task: Task }>(`${base}/joiners/${id}/tasks`, { method: "POST", body }),
  taskAction: (id: string, body: { action: "complete" | "skip" | "reopen"; version: number; note?: string }) =>
    httpRequest<{ task: Task }>(`${base}/tasks/${id}/actions`, { method: "POST", body }),
  updateTask: (id: string, body: { version: number; ownerId?: string; dueDate?: string; title?: string }) =>
    httpRequest<{ task: Task }>(`${base}/tasks/${id}`, { method: "PATCH", body }),
  myTasks: (state: "open" | "done" | "all") =>
    httpRequest<{ items: Task[]; counts: { open: number; overdue: number; this_week: number; done_recently: number }; viewer: Viewer }>(`${base}/my-tasks?state=${state}`),
  review: (fileId: string, body: { decision: "VERIFIED" | "REJECTED"; reason?: string }) =>
    httpRequest<JoinerDetail>(`${base}/documents/${fileId}/review`, { method: "POST", body }),
  templates: () => httpRequest<{ items: TemplateSummary[]; viewer: Viewer }>(`${base}/templates`),
  template: (id: string) => httpRequest<Template>(`${base}/templates/${id}`),
  saveTemplate: (id: string | null, body: Record<string, unknown>) =>
    httpRequest<Template>(id ? `${base}/templates/${id}` : `${base}/templates`, { method: id ? "PUT" : "POST", body }),
  archiveTemplate: (id: string) => httpRequest(`${base}/templates/${id}/archive`, { method: "POST" }),
  settings: () => httpRequest<Settings>(`${base}/settings`),
  saveSettings: (body: Record<string, unknown>) => httpRequest<Settings>(`${base}/settings`, { method: "PUT", body }),
};

let employeeCache: Promise<Employee[]> | null = null;
export function loadEmployees() {
  if (!employeeCache)
    employeeCache = httpRequest<{ items: Employee[] }>("/api/v2/employees?limit=100")
      .then((data) => data.items.filter((item) => item.status === "ACTIVE"))
      .catch((error) => { employeeCache = null; throw error; });
  return employeeCache;
}

export const PHASES: { key: Phase; label: string; short: string }[] = [
  { key: "PRE_BOARDING", label: "Before joining", short: "Pre-boarding" },
  { key: "DAY_ONE", label: "Day one", short: "Day 1" },
  { key: "FIRST_WEEK", label: "First week", short: "Week 1" },
  { key: "FIRST_90_DAYS", label: "First 90 days", short: "90 days" },
];
export const OWNER_TYPES: { key: OwnerType; label: string }[] = [
  { key: "HR", label: "HR" }, { key: "IT", label: "IT" }, { key: "MANAGER", label: "Manager" },
  { key: "BUDDY", label: "Buddy" }, { key: "JOINER", label: "Joiner" }, { key: "FINANCE", label: "Finance" },
];
export const DOC_CATEGORIES: { key: DocCategory; label: string }[] = [
  { key: "PAN", label: "PAN card" }, { key: "AADHAAR", label: "Aadhaar card" }, { key: "BANK_PROOF", label: "Bank proof" },
  { key: "EDUCATION", label: "Education certificates" }, { key: "PHOTO", label: "Photo" }, { key: "OTHER", label: "Other document" },
];
export const EMPLOYMENT_TYPES = [
  { key: "FULL_TIME", label: "Full-time" }, { key: "PART_TIME", label: "Part-time" }, { key: "CONTRACT", label: "Contract" }, { key: "INTERN", label: "Intern" },
];
export const STATUS_COLUMNS: { key: JoinerStatus; label: string; hint: string }[] = [
  { key: "PRE_BOARDING", label: "Pre-boarding", hint: "Paperwork & prep" },
  { key: "READY_TO_JOIN", label: "Ready to join", hint: "All set for day one" },
  { key: "JOINED", label: "Joined", hint: "First 90 days" },
  { key: "COMPLETED", label: "Onboarded", hint: "Plan complete" },
  { key: "WITHDRAWN", label: "Withdrawn", hint: "Offer declined" },
];
export const employmentLabel = (key: string) => EMPLOYMENT_TYPES.find((item) => item.key === key)?.label || key;
export const errorText = (reason: unknown, fallback = "Something went wrong.") => reason instanceof Error ? reason.message : fallback;

export function countdown(days: number, status: JoinerStatus) {
  if (status === "WITHDRAWN") return "Withdrawn";
  if (status === "COMPLETED") return "Onboarded";
  if (days === 0) return "Joins today";
  if (days > 0) return days === 1 ? "Joins tomorrow" : `Joins in ${days} days`;
  const since = -days;
  return since === 1 ? "Day 2" : `Day ${since + 1}`;
}
export function dueText(task: Pick<Task, "status" | "daysLeft" | "overdue">) {
  if (task.status !== "PENDING") return "";
  if (task.overdue) return task.daysLeft === -1 ? "1 day overdue" : `${-task.daysLeft} days overdue`;
  if (task.daysLeft === 0) return "Due today";
  if (task.daysLeft === 1) return "Due tomorrow";
  return `Due in ${task.daysLeft} days`;
}
