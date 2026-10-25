import { httpRequest } from "@/lib/http-client";

export const BASE = "/api/v2/integrations";
export const get = <T,>(path: string) => httpRequest<T>(`${BASE}${path}`);
export const send = <T,>(path: string, body: unknown, method = "POST") => httpRequest<T>(`${BASE}${path}`, { method, body });

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export type Overview = {
  viewer: { roles: string[]; canManageDevices: boolean; canManageWebhooks: boolean; canManageFinance: boolean };
  security: { masterKeyConfigured: boolean };
  devices: null | { total: number; online: number; offline: number; unmatched: number; recorded24h: number; mappings: number };
  accounting: null | { configured: boolean; lastExportAt: string | null; exports: number; runsNotExported: number };
  payouts: null | { awaitingRelease: number; inFlight: number; needsAttention: number; lastReleasedAt: string | null; adapters: { key: string; label: string; configured: boolean; mode?: string }[] };
  webhooks: null | { active: number; disabled: number; failed24h: number; succeeded24h: number };
};

// ---------------------------------------------------------------- devices
export type Device = {
  id: string; serialNumber: string; name: string; vendor: string; siteId: string | null; siteName: string | null; timezone: string; status: string;
  lastSeenAt: string | null; lastIp: string | null; lastPunchAt: string | null; firmware: string | null; protocol: string | null; secretRotatedAt: string | null;
  secretHint: string | null; version: number; createdAt: string; punches24h: number; unmatched: number; rejected24h: number;
  health: "ONLINE" | "STALE" | "OFFLINE" | "NEVER_SEEN" | "INACTIVE";
};
export type DeviceList = { items: Device[]; sites: { id: string; name: string }[]; hourly: { hour: string; total: number; unmatched: number }[]; onlineMinutes: number };
export type DeviceSecret = { id: string; serialNumber: string; secret: string; commKey: string; secretNotice: string };
export type Punch = { id: string; externalId: string; deviceUserId: string; occurredAt: string; type: string | null; verifyMode: string | null; protocol: string; status: string; reason: string | null; receivedAt: string; employeeName: string | null; employeeNumber: string | null };
export type Mapping = { id: string; deviceUserId: string; deviceId: string | null; deviceName: string | null; deviceSerial: string | null; employeeId: string; employeeNumber: string; employeeName: string; department: string | null };
export type Unmatched = { deviceUserId: string; punches: number; firstAt: string; lastAt: string; devices: string[]; deviceIds: string[]; punchIds: string[] };
export type Employee = { id: string; number: string; name: string; department: string | null; location: string | null };
export type ImportResult = { dryRun: boolean; summary: { total: number; new: number; unchanged: number; errors: number }; rows: { line: number; employeeNumber: string; deviceUserId: string; deviceSerial: string; status: string; error?: string; employeeName?: string }[]; replayed?: number };

// ---------------------------------------------------------------- accounting
export type LedgerSettings = { companyName: string; ledgers: Record<string, string>; journalVoucherType: string; paymentVoucherType: string; version: number; configured: boolean; fields: { key: string; label: string }[] };
export type Run = { id: string; period: string; status: string; payDate: string | null; totals: Record<string, number>; exportable?: boolean; payable?: boolean; lastExportedAt?: string | null; batchId?: string | null; batchStatus?: string | null };
export type VoucherLine = { ledgerKey: string; ledger: string; debit: number; credit: number; note?: string };
export type Preview = {
  kind: string; period: string; runId: string | null; companyName: string; settingsConfigured: boolean; balanced: boolean; notes: string[];
  vouchers: { number: string; type: string; date: string; narration: string; reference?: string; lines: VoucherLine[] }[];
  totals: { debit: number; credit: number; lines: number; vouchers: number };
  checks: { label: string; expected: number; actual: number; ok: boolean }[];
};
export type ExportRow = { id: string; kind: string; format: string; runId: string | null; period: string; fileName: string; checksum: string; voucherCount: number; lineCount: number; totalDebit: number; totalCredit: number; createdAt: string; exportedBy: string };

// ---------------------------------------------------------------- payouts
export type PayoutConfig = {
  adapters: { key: string; kind: "FILE" | "API"; label: string; description: string; configured: boolean; detail: string; mode?: string }[];
  statusWebhook: { path: string; signatureHeader: string; configured: boolean; detail: string }; syncJob: { name: string; every: string };
};
export type Batch = {
  id: string; period: string; adapter: string; mode: string; status: string; runId: string; runNet: number; totalAmount: number; skippedAmount: number;
  payoutCount: number; skippedCount: number; reference: string; createdAt: string; releasedAt: string | null; createdBy: string; releasedBy: string | null;
  version: number; createdById: string; processed?: number; failed?: number;
};
export type BatchDetail = Batch & {
  fileChecksum: string | null; runStatus: string; adapterLabel: string; adapterKind: "FILE" | "API"; reconciled: boolean; canRelease: boolean; releaseBlockedReason: string | null;
  /** False for the run's preparer and non-payroll roles (segregation of duties). */
  canDownloadFile?: boolean;
  counts: Record<string, number>;
  items: { id: string; status: string; amount: number; skipReason: string | null; bankName: string | null; ifsc: string | null; account: string; reference: string; providerPayoutId: string | null; utr: string | null; failureReason: string | null; employeeNumber: string; employeeName: string; department: string | null; updatedAt: string }[];
  events: { id: number; status: string; note: string | null; source: string; createdAt: string; actor: string | null; employeeName: string | null; reference: string | null }[];
};

// ---------------------------------------------------------------- webhooks
export type Subscription = {
  id: string; name: string; url: string; eventTypes: string[]; status: string; consecutiveFailures: number; disabledReason: string | null; disabledAt: string | null;
  lastDeliveryAt: string | null; lastSuccessAt: string | null; version: number; createdAt: string; secretHint: string; createdBy: string;
  deliveries24h: number; failed24h: number; pending: number;
};
export type SubscriptionList = { items: Subscription[]; maxAttempts: number; disableAfter: number };
export type Delivery = { id: string; status: string; attempts: number; isTest: boolean; responseCode: number | null; responseMs: number | null; responseExcerpt: string | null; error: string | null; lastAttemptAt: string | null; deliveredAt: string | null; createdAt: string; eventId: string; eventType: string; payload: Record<string, unknown> };

// ---------------------------------------------------------------- shared formatting
export const statusTone: Record<string, Tone> = {
  ONLINE: "success", STALE: "warning", OFFLINE: "danger", NEVER_SEEN: "neutral", INACTIVE: "neutral",
  ACTIVE: "success", DISABLED: "neutral", REVOKED: "danger",
  RECORDED: "success", UNMATCHED: "warning", IGNORED: "neutral", REJECTED: "danger", DUPLICATE: "neutral",
  DRAFT: "info", RELEASED: "info", PROCESSING: "info", COMPLETED: "success", PARTIAL: "warning", FAILED: "danger", CANCELLED: "neutral",
  SKIPPED: "neutral", PENDING: "info", QUEUED: "info", PROCESSED: "success", REVERSED: "danger",
  SUCCEEDED: "success", RETRYING: "warning",
};
export const label = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const dateTime = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "—";
export const rupees = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const periodLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
};
