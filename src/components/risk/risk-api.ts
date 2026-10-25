import { httpRequest } from "@/lib/http-client";

export type Area = "compliance" | "attendance" | "labour" | "payroll" | "expenses" | "people" | "service";
export type Severity = "critical" | "high" | "medium" | "low";
export type SignalStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export type Person = { id: string | null; name: string; number?: string; designation?: string | null; location?: string | null; redacted?: boolean };
export type CellKind = "text" | "person" | "money" | "date" | "datetime" | "number" | "km" | "hours" | "percent";
export type Evidence = {
  facts?: { label: string; value: string }[];
  columns?: { key: string; label: string; kind?: CellKind }[];
  rows?: Record<string, unknown>[];
  note?: string;
};
export type Signal = {
  id: string; detector: string; detectorLabel: string; area: Area; severity: Severity; status: SignalStatus;
  title: string; explanation: string; people: Person[]; action: { label: string; href: string }; dueDate: string | null;
  firstDetectedAt: string; lastDetectedAt: string; clearedAt: string | null; detections: number;
  statusNote: string | null; statusAt: string | null; statusBy: string | null; version: number; canClose: boolean; autoResolves: boolean;
};
export type SignalEvent = { action: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string; actor: string; automated: boolean };
export type SignalDetail = Signal & { evidence: Evidence; records: { type: string; id: string; label: string }[]; events: SignalEvent[] };
export type CalendarItem = {
  key: string; kind: string; label: string; authority: string; period: string; periodLabel: string; dueDate: string; state?: string; verify: boolean; note: string;
  status: "FILED" | "READY" | "PENDING" | "NO_PAYROLL" | "AWAITING_PAYROLL" | "NOT_APPLICABLE" | "VERIFY"; statusLabel: string; detail: string; amount: number | null; runId: string | null;
  daysLeft: number; bucket: "overdue" | "this_week" | "upcoming" | "done"; mark: { reference: string | null; markedAt: string; markedBy: string | null } | null;
};
export type Detector = { key: string; area: Area; label: string; description: string; autoResolve?: boolean; enabled: boolean };
export type Overview = {
  viewer: { isHr: boolean; isPayroll: boolean; isManager: boolean; reportCount: number; canScan: boolean; canConfigure: boolean };
  lastScan: { at: string | null; result: { signals: number; created: number; errors: string[] } | null } | null;
  counts: { byArea: Record<Area, Record<Severity | "total", number>>; bySeverity: Record<Severity, number>; byStatus: Record<SignalStatus, number>; active: number };
  top: Signal[];
  calendar: { today: string; states: string[]; disclaimer: string; counts: Record<CalendarItem["bucket"], number>; horizonDays: number; items: CalendarItem[] } | null;
  detectors: Detector[];
  skipped: { key: string; area: Area; label: string; reason: string }[];
};
export type LabourLimits = { weeklyHours: number; dailyHours: number; spreadOverHours: number; minRestHours: number; maxConsecutiveDays: number };
export type Thresholds = {
  compliance: { horizonDays: number; lookbackDays: number; reminderDays: number[]; gratuityWindowDays: number };
  attendance: Record<string, number>;
  labour: { lookbackDays: number; overtimeGraceMinutes: number; default: LabourLimits; states: Record<string, Partial<LabourLimits>> };
  payroll: { netChangePct: number; minimumWageCategory: string };
  expenses: Record<string, number>;
  people: Record<string, number>;
  service: Record<string, number>;
  disabled: string[];
};
export type MinimumWage = { stateCode: string; category: string; monthlyAmount: number; effectiveFrom: string; isExample: boolean; note: string | null };
export type RiskSettings = {
  thresholds: Thresholds; defaults: Thresholds; version: number; minimumWages: MinimumWage[]; categories: string[];
  detectors: Detector[]; canEdit: boolean; minimumWageWarning: string;
};
export type ScanResult = { detectors: number; signals: number; created: number; reopened: number; refreshed: number; autoResolved: number; cleared: number; errors: string[]; ms: number };

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const riskApi = {
  overview: () => httpRequest<Overview>("/api/v2/risk/overview"),
  signals: (params: { area?: string; severity?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    httpRequest<{ items: Signal[]; total: number }>(`/api/v2/risk/signals${qs(params)}`),
  signal: (id: string) => httpRequest<SignalDetail>(`/api/v2/risk/signals/${id}`),
  act: (id: string, action: "acknowledge" | "resolve" | "dismiss" | "reopen", body: { note?: string; version: number }) =>
    httpRequest<{ id: string; status: SignalStatus; version: number }>(`/api/v2/risk/signals/${id}/${action}`, { method: "POST", body }),
  scan: () => httpRequest<ScanResult>("/api/v2/risk/scan", { method: "POST", body: {} }),
  settings: () => httpRequest<RiskSettings>("/api/v2/risk/settings"),
  saveSettings: (body: { thresholds?: Thresholds; minimumWages?: MinimumWage[]; version: number }) => httpRequest<{ version: number }>("/api/v2/risk/settings", { method: "PUT", body }),
  mark: (key: string, body: { filed: boolean; reference?: string; note?: string }) =>
    httpRequest<{ key: string; filed: boolean }>(`/api/v2/risk/compliance/${encodeURIComponent(key)}/mark`, { method: "POST", body }),
};

export const AREA_LABELS: Record<Area, string> = {
  compliance: "Statutory compliance", attendance: "Attendance integrity", labour: "Labour law & roster", payroll: "Payroll anomalies",
  expenses: "Expense claims", people: "People", service: "Service & approvals",
};
export const AREA_SHORT: Record<Area, string> = { compliance: "Compliance", attendance: "Attendance", labour: "Labour", payroll: "Payroll", expenses: "Expenses", people: "People", service: "Service" };
export const AREAS: Area[] = ["compliance", "attendance", "labour", "payroll", "expenses", "people", "service"];
export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
export const STATUS_LABEL: Record<SignalStatus, string> = { OPEN: "Open", ACKNOWLEDGED: "Acknowledged", RESOLVED: "Resolved", DISMISSED: "Dismissed" };
export const STATUS_TONE: Record<SignalStatus, string> = { OPEN: "tone-danger", ACKNOWLEDGED: "tone-warning", RESOLVED: "tone-success", DISMISSED: "tone-neutral" };
