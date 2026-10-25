"use client";
import { httpRequest } from "@/lib/http-client";

export type Tone = "info" | "warning" | "success" | "danger" | "neutral";
export type Flag = { code: string; tone: "info" | "warning" | "danger"; message: string; blocking?: boolean };
export type Line = { code: string; label: string; amount: number; full?: number; note?: string; taxable?: boolean };
export type StructureComponent = { code: string; label: string; kind: "EARNING" | "EMPLOYER" | "VARIABLE"; monthly: number; annual: number; note?: string };
export type Template = { basicPct: number; hraPct: number; conveyance: number; otherAllowance: number; variablePct: number; includeGratuity: boolean };
export type AgeCategory = "BELOW_60" | "SENIOR" | "SUPER_SENIOR";
export type Declarations = { section80C?: number; section80D?: number; rentPaidAnnual?: number; homeLoanInterest?: number; otherIncome?: number; previousEmployerSalary?: number; previousEmployerTds?: number;
  previousEmployerPf?: number; previousEmployerPt?: number; rentedInMetro?: boolean; ageCategory?: AgeCategory };
export type StatutoryFlags = { epsEligible: boolean; disabled: boolean; vpfRate: number; internationalWorker: boolean; ageCategory: AgeCategory };
/** pan / uan / esiNumber / bankAccount arrive MASKED (e.g. XXXXXX234F); full values only via payrollApi.reveal (audited). */
export type PiiField = "pan" | "uan" | "esiNumber" | "bankAccount";
export type Profile = {
  stateCode: string | null; taxRegime: "NEW" | "OLD"; pan: string | null; uan: string | null; esiNumber: string | null; bankName: string | null;
  bankAccount: string | null; ifsc: string | null; pfApplicable: boolean; ptCategory: "STANDARD" | "WOMAN" | "EXEMPT"; declarations: Declarations; version: number;
  statutoryFlags?: StatutoryFlags;
};
export type Structure = {
  id: string; employeeId: string; effectiveFrom: string; annualCtc: number; isMetro: boolean; template: Template; components: StructureComponent[];
  fixedMonthlyGross: number; monthlyCtc: number; annualVariable: number; rulesetVersion: string; reason: string; notes: string | null;
  createdBy: string | null; createdAt: string; used?: boolean; current?: boolean; upcoming?: boolean;
};
export type Tax = {
  regime: "NEW" | "OLD"; projectedAnnualIncome: number; taxableIncome: number; annualLiability: number; cess: number; rebate: number; marginalRelief: number;
  surcharge: number; standardDeduction: number; exemptions: number; deductions: number; tdsDeductedSoFar: number; monthsRemaining: number;
  regularShare: number; oneTimeTax: number; monthlyTds: number; remainingAfterThisMonth: number; bands: { from: number; to: number | null; rate: number; taxable: number; tax: number }[];
};
export type Breakdown = {
  employee: { number: string; name: string; department: string | null; designation: string | null; location: string | null; joiningDate: string; pan: string | null; uan: string | null; esiNumber: string | null; bank: string | null; state: string; stateSource: string; regime: string };
  period: string; fiscalYear: string; rulesetVersion: string; included: boolean;
  structure: { id: string; effectiveFrom: string; annualCtc: number; fixedMonthlyGross: number } | null;
  lopLeaves: { id: string; type: string; startDate: string; endDate: string; days: number }[];
  days: { daysInMonth: number; employedDays: number; lopDays: number; payableDays: number; joinedThisMonth: boolean };
  flags: Flag[]; earnings?: Line[]; oneTime?: Line[]; reimbursements?: Line[]; deductions?: Line[]; employer?: Line[];
  totals?: { regularGross: number; gross: number; reimbursements: number; deductions: number; net: number; employerContributions: number; employerCost: number; taxable: number };
  statutory?: {
    pf: { applicable: boolean; pfWage: number; epsWage: number; employee: number; employerTotal: number; employerEps: number; employerEpf: number; edli: number; admin: number };
    esi: { covered: boolean; reason: string; wages: number; employee: number; employer: number; lowWageExempt: boolean; rateOfWages: number };
    pt: { state: string; stateName: string; amount: number; rule: string; category: string; source: string };
    tds: { amount: number; regime: string };
  };
  tax?: Tax; ytd?: { gross: number; taxable: number; tds: number; pf: number; pt: number; net: number };
};
export type RunAction = { action: string; label: string; intent: "primary" | "neutral" | "danger"; noteRequired?: boolean; disabledReason?: string };
export type Totals = {
  headcount: number; payable: number; held: number; excluded: number; gross: number; reimbursements: number; deductions: number; net: number; employerCost: number;
  tds: number; pfEmployee: number; pfEmployer: number; esiEmployee: number; esiEmployer: number; pt: number; lopDays: number; blocking: number; flagged: number; flags: Record<string, number>;
};
export type Run = {
  id: string; period: string; label: string; status: string; payDate: string; includeExpenses: boolean; needsRecalc: boolean; notes: string | null;
  totals: Partial<Totals>; rulesetVersion: string | null; version: number; createdAt: string; updatedAt: string; editable: boolean; steps: string[]; actions: RunAction[];
  bankFile?: { allowed: boolean; reason: string | null };
  people: Record<string, string | null>;
};
export type RunLine = {
  id: string; employeeId: string; number: string; name: string; department: string | null; designation: string | null; location: string | null; state: string | null;
  status: "INCLUDED" | "EXCLUDED"; held: boolean; holdReason: string | null; daysInMonth: number; payableDays: number; lopDays: number; gross: number;
  reimbursements: number; deductions: number; net: number; employerCost: number; tds: number; pf: number; esi: number; pt: number; flags: Flag[];
  previousNet: number | null; variancePct: number | null; publishedAt: string | null; releasedAt: string | null;
};
export type RunInput = {
  id: string; employeeId: string; employeeName: string; employeeNumber: string; kind: string; code: string; label: string; amount: number; days: number | null;
  taxable: boolean; source: string; sourceRef: string | null; note: string | null; createdBy: string | null; createdAt: string;
};
export type InputCode = { kind: "EARNING" | "DEDUCTION" | "REIMBURSEMENT" | "LOP"; label: string; taxable: boolean; esiWage: boolean };
export type RunDetail = Run & { lines: RunLine[]; inputs: RunInput[]; history: { id: string; action: string; data: any; at: string; actor: string | null }[]; inputCodes: Record<string, InputCode> };
export type LineDetail = {
  runId: string; period: string; runStatus: string; employeeId: string; number: string; name: string; status: string; held: boolean; holdReason: string | null;
  flags: Flag[]; breakdown: Breakdown; inputs: { id: string; kind: string; code: string; label: string; amount: number; days: number | null; taxable: boolean; source: string; note: string | null }[];
  publishedAt: string | null; previousNet: number | null; variancePct: number | null;
};
export type Settings = { pfWageMode: "CEILING" | "ACTUAL"; defaultState: string; includeExpenses: boolean; pfEstablishmentCode: string | null; esiEmployerCode: string | null; debitAccount: string | null; version: number;
  labourCodeWages?: "AUTO" | "ON" | "OFF"; lwfEnabled?: boolean; minimumWageMonthly?: number | null };
export type Meta = {
  ruleset: { version: string; fiscalYear: string; disclaimer: string; pf: { note: string; sources: string[] }; esi: { note: string; sources: string[] }; pt: { note: string; states: { code: string; name: string; note: string; source: string; frequency: string }[] }; labourCodes: string; rounding: string };
  disclaimer: string; settings: Settings | null; viewer: { employeeId: string; roles: string[]; canManage: boolean };
};
export type StructureListItem = {
  id: string; number: string; name: string; department: string | null; designation: string | null; location: string | null; joiningDate: string; state: string; taxRegime: string;
  hasBank: boolean; hasPan: boolean; revisions: number; current: { id: string; annualCtc: number; fixedMonthlyGross: number; effectiveFrom: string } | null;
  upcoming: { effectiveFrom: string; annualCtc: number } | null;
};
export type EmployeeStructures = {
  employee: { id: string; number: string; name: string; department: string | null; designation: string | null; location: string | null; joiningDate: string; state: string; stateSource: string; metro: boolean };
  profile: Profile; structures: Structure[]; settings: Settings | null; lockedThrough: string | null;
};
export type Preview = {
  annualCtc: number; annualVariable: number; monthlyCtc: number; fixedMonthlyGross: number; esiApplicable: boolean; components: StructureComponent[];
  check: { componentsAnnual: number; difference: number; ok: boolean }; errors: string[]; warnings: string[]; template: Template; isMetro: boolean;
  state: string; stateName: string; regime: string;
  takeHome: { gross: number; pfEmployee: number; esiEmployee: number; pt: number; annualPt: number; tds: number; deductions: number; net: number; annualTax: number; taxableIncome: number };
};
export type MyPayroll = {
  employee: { id: string; number: string; name: string; department: string | null; designation: string | null; location: string | null; joiningDate: string; state: string };
  profile: Profile; structure: Structure | null; fiscalYear: string;
  ytd: { gross: number; deductions: number; net: number; tds: number; pf: number; reimbursements: number; months: number };
  taxProjection: (Tax & { period: string }) | null;
  payslips: { id: string; period: string; label: string; gross: number; deductions: number; net: number; tds: number; payableDays: number | null; lopDays: number | null; publishedAt: string; detailed: boolean }[];
  disclaimer: string;
};
export type Payslip = {
  id: string; period: string; label: string; gross: number; deductions: number; net: number; publishedAt: string; runId: string | null; organizationName: string;
  breakdown: Breakdown | null; employee: { id: string; number: string; name: string; designation: string | null; department: string | null; location: string | null; joiningDate: string };
  periods: string[]; disclaimer: string;
};

const base = "/api/v2/payroll";
export const payrollApi = {
  meta: () => httpRequest<Meta>(`${base}/meta`),
  me: () => httpRequest<MyPayroll>(`${base}/me`),
  payslip: (period: string, employeeId?: string) => httpRequest<Payslip>(`${base}/payslips/${period}${employeeId ? `?employeeId=${employeeId}` : ""}`),
  payslipDocumentPath: (period: string, employeeId?: string) => `${base}/payslips/${period}/document${employeeId ? `?employeeId=${employeeId}` : ""}`,
  runs: () => httpRequest<{ items: Run[]; suggestions: string[]; disclaimer: string }>(`${base}/runs`),
  createRun: (body: { period: string; payDate?: string; includeExpenses?: boolean; notes?: string }) => httpRequest<Run>(`${base}/runs`, { method: "POST", body }),
  run: (id: string) => httpRequest<RunDetail>(`${base}/runs/${id}`),
  calculate: (id: string, version: number) => httpRequest<Run>(`${base}/runs/${id}/calculate`, { method: "POST", body: { version } }),
  transition: (id: string, body: { action: string; version: number; note?: string }) => httpRequest<Run>(`${base}/runs/${id}/transitions`, { method: "POST", body }),
  line: (id: string, employeeId: string) => httpRequest<LineDetail>(`${base}/runs/${id}/lines/${employeeId}`),
  hold: (id: string, employeeId: string, body: { hold: boolean; reason?: string }) => httpRequest<{ held: boolean; released?: boolean }>(`${base}/runs/${id}/lines/${employeeId}/hold`, { method: "POST", body }),
  addInput: (id: string, body: { employeeId: string; code: string; label?: string; amount?: number; days?: number; taxable?: boolean; note?: string }) => httpRequest<{ id: string }>(`${base}/runs/${id}/inputs`, { method: "POST", body }),
  removeInput: (id: string, inputId: string) => httpRequest<{ removed: boolean }>(`${base}/runs/${id}/inputs/${inputId}`, { method: "DELETE" }),
  exportPath: (id: string, kind: string) => `${base}/runs/${id}/exports/${kind}`,
  structures: (search = "") => httpRequest<{ items: StructureListItem[]; settings: Settings }>(`${base}/structures${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  employee: (employeeId: string) => httpRequest<EmployeeStructures>(`${base}/employees/${employeeId}`),
  preview: (body: Record<string, unknown>) => httpRequest<Preview>(`${base}/structures/preview`, { method: "POST", body }),
  createStructure: (body: Record<string, unknown>) => httpRequest<Structure & { warnings: string[] }>(`${base}/structures`, { method: "POST", body }),
  deleteStructure: (id: string) => httpRequest<{ deleted: boolean }>(`${base}/structures/${id}`, { method: "DELETE" }),
  reveal: (employeeId: string, field: PiiField, reason?: string) =>
    httpRequest<{ field: PiiField; value: string; masked: string | null }>(`${base}/employees/${employeeId}/reveal`, { method: "POST", body: { field, reason } }),
  updateProfile: (employeeId: string, body: Record<string, unknown>) => httpRequest<Profile>(`${base}/employees/${employeeId}/profile`, { method: "PUT", body }),
  updateSettings: (body: Record<string, unknown>) => httpRequest<Settings>(`${base}/settings`, { method: "PUT", body }),
};

export const inr = (value: number | null | undefined, empty = "—") =>
  value === null || value === undefined || Number.isNaN(value) ? empty : `₹${Math.round(value).toLocaleString("en-IN")}`;
/** Compact Indian notation for KPI cards: ₹8.4L, ₹1.2Cr. */
export const inrShort = (value: number | null | undefined) => {
  const v = Math.round(Number(value) || 0);
  if (Math.abs(v) >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100_000) return `₹${(v / 100_000).toFixed(2)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
};
export const monthLabel = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export const shortMonth = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
export const errorText = (reason: unknown, fallback: string) => (reason instanceof Error && reason.message ? reason.message : fallback);

export const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" }, CALCULATED: { label: "Calculated", tone: "info" }, SUBMITTED: { label: "Awaiting approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" }, PUBLISHED: { label: "Published", tone: "success" }, LOCKED: { label: "Locked", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};
export const STEP_LABELS: Record<string, string> = { DRAFT: "Draft", CALCULATED: "Calculated", SUBMITTED: "Submitted", APPROVED: "Approved", PUBLISHED: "Published", LOCKED: "Locked" };
export const FLAG_LABELS: Record<string, string> = {
  VARIANCE: ">10% change", NEW_JOINER: "New joiner", MISSING_STRUCTURE: "No structure", NEGATIVE_NET: "Negative net", LOP: "LOP", HELD: "On hold",
  MISSING_BANK: "No bank", MISSING_PAN: "No PAN", ZERO_PAYABLE: "0 payable days", ESI_CONTINUED: "ESI continued",
};
export const STATE_NAMES: Record<string, string> = { KA: "Karnataka", MH: "Maharashtra", TN: "Tamil Nadu", TS: "Telangana", AP: "Andhra Pradesh", WB: "West Bengal", GJ: "Gujarat", DL: "Delhi", HR: "Haryana", KL: "Kerala", UP: "Uttar Pradesh", RJ: "Rajasthan", PB: "Punjab", GA: "Goa" };
