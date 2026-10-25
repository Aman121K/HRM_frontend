"use client";
import { downloadFile, httpRequest } from "@/lib/http-client";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type Issue = { level: "error" | "warning"; code: string; message: string; ref?: string };
export type Forms = { act: string; section: string; sectionOld: string; yearLabel: string; quarterly: string; quarterlyOld: string; certificate: string; certificateOld: string; perquisites: string; perquisitesOld: string; note: string };
export type Address = { line1?: string; line2?: string; line3?: string; line4?: string; line5?: string; stateCode?: string; pincode?: string };
export type Deductor = {
  tan: string | null; pan: string | null; name: string | null; category: string; gstin: string | null; address: Address; email: string | null; phone: string | null;
  responsible: { name?: string; designation?: string; email?: string; phone?: string; address?: Address; panMasked?: string | null };
  version: number; issues: Issue[];
};
export type Challan = {
  id: string; period: string; bsrCode: string; challanSerial: string; depositDate: string; mode: "C" | "B"; minorHead: string;
  tax: number; surcharge: number; cess: number; interest: number; fee: number; penalty: number; notes: string | null; version: number;
  total: number; taxDeposited: number; allocated: number; late: boolean; daysLate: number;
};
export type MonthRow = {
  period: string; dueDate: string; run: { id: string; status: string; payDate: string } | null; deducted: number; deposited: number; allocated: number;
  estimatedInterest: number; employees: number; flags: { tone: "danger" | "warning" | "info"; message: string }[]; challans: Challan[];
};
export type Overview = {
  fy: number; fyLabel: string; quarter: Quarter; periods: string[]; forms: Forms; today: string; dueDates: { statement: string; certificate: string };
  deductor: Deductor; months: MonthRow[]; totals: { deducted: number; deposited: number; allocated: number; estimatedInterest: number };
  validation: { errors: Issue[]; warnings: Issue[]; deducteeRows: number; deductees: number; challans: number; challanTotal: number; deducteeTotal: number };
  statement: { status: string; tokenNumber: string | null; filedOn: string | null; filedExternally: boolean; generatedAt: string | null; textAvailable: boolean; textNote: string | null };
  quarters: { quarter: Quarter; status: string; tokenNumber: string | null; dueDate: string }[];
  documents: { status: string; total: number; generated: number; publishedAt: string | null };
};
export type CertificateItem = {
  id: string; employeeId: string; number: string; name: string; employeeStatus: string; regime: string; gross: number; tax: number; tds: number; balance: number;
  warnings: string[]; generatedAt: string | null; partA: { id: string; name: string } | null;
};
export type Certificates = {
  fy: number; fyLabel: string; forms: Forms; dueDate: string; canPublish: boolean; publishBlockedReason: string | null;
  set: { id?: string; status: string; total: number; generated: number; generatedBy?: string | null; generatedAt?: string | null; publishedBy?: string | null; publishedAt?: string | null; version?: number };
  items: CertificateItem[];
};
export type MyDocuments = { employeeId: string; items: { fy: number; fyLabel: string; forms: Forms; publishedAt: string; tax: number; tds: number; regime: string; partA: boolean }[] };
export type ChallanInput = { period: string; bsrCode: string; challanSerial: string; depositDate: string; mode?: "C" | "B"; minorHead?: "200" | "400"; tax: number; surcharge?: number; cess?: number; interest?: number; fee?: number; penalty?: number; notes?: string };

const base = "/api/v2/payroll/returns";
export const returnsApi = {
  overview: (fy: number, quarter: Quarter) => httpRequest<Overview>(`${base}/overview?fy=${fy}&quarter=${quarter}`),
  saveDeductor: (body: unknown) => httpRequest<Deductor>(`${base}/deductor`, { method: "PUT", body }),
  createChallan: (body: ChallanInput) => httpRequest<{ id: string }>(`${base}/challans`, { method: "POST", body }),
  updateChallan: (id: string, body: ChallanInput & { version: number }) => httpRequest<{ id: string }>(`${base}/challans/${id}`, { method: "PUT", body }),
  deleteChallan: (id: string) => httpRequest<{ deleted: boolean }>(`${base}/challans/${id}`, { method: "DELETE" }),
  allocate: (fy: number, quarter: Quarter) => httpRequest<{ allocations: number; allocated: number; unallocated: number; deducted: number }>(`${base}/quarters/${fy}/${quarter}/allocate`, { method: "POST", body: {} }),
  filing: (fy: number, quarter: Quarter, body: { status: "DRAFT" | "FILED"; tokenNumber?: string; filedOn?: string; filedExternally?: boolean }) =>
    httpRequest(`${base}/quarters/${fy}/${quarter}/filing`, { method: "PUT", body }),
  file: (fy: number, quarter: Quarter, kind: string) => downloadFile(`${base}/quarters/${fy}/${quarter}/files/${kind}`, `${kind}-${fy}-${quarter}`),
  certificates: (fy: number) => httpRequest<Certificates>(`${base}/certificates/${fy}`),
  generate: (fy: number, restart: boolean) => httpRequest<{ status: string; total: number; generated: number }>(`${base}/certificates/${fy}/generate`, { method: "POST", body: { restart } }),
  publish: (fy: number, version: number) => httpRequest<{ employees: number }>(`${base}/certificates/${fy}/publish`, { method: "POST", body: { version } }),
  uploadPartA: (fy: number, employeeId: string, body: { originalName: string; mimeType: string; base64: string }) =>
    httpRequest<{ partA: { id: string; name: string } }>(`${base}/certificates/${fy}/${employeeId}/part-a`, { method: "POST", body }),
  document: (fy: number, employeeId: string, kind: "certificate" | "perquisites" | "tds-summary" | "part-a") => downloadFile(`${base}/documents/${fy}/${employeeId}/${kind}`, `${kind}-${fy}.pdf`),
  mine: () => httpRequest<MyDocuments>(`${base}/mine`),
};

export const inr = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `₹${Math.round(value).toLocaleString("en-IN")}`);
export const monthLabel = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
export const dateLabel = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
export const errorText = (reason: unknown, fallback: string) => (reason instanceof Error && reason.message ? reason.message : fallback);
export const currentFy = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };
export const currentQuarter = (): Quarter => { const m = new Date().getMonth() + 1; return m >= 4 && m <= 6 ? "Q1" : m >= 7 && m <= 9 ? "Q2" : m >= 10 ? "Q3" : "Q4"; };
/** Protean Annexure 1 state codes (Form 138 file format). */
export const STATE_CODES: [string, string][] = [["01", "Andaman & Nicobar"], ["02", "Andhra Pradesh"], ["03", "Arunachal Pradesh"], ["04", "Assam"], ["05", "Bihar"], ["06", "Chandigarh"], ["07", "Dadra & Nagar Haveli and Daman & Diu"], ["09", "Delhi"], ["10", "Goa"], ["11", "Gujarat"], ["12", "Haryana"], ["13", "Himachal Pradesh"], ["14", "Jammu & Kashmir"], ["15", "Karnataka"], ["16", "Kerala"], ["17", "Lakshadweep"], ["18", "Madhya Pradesh"], ["19", "Maharashtra"], ["20", "Manipur"], ["21", "Meghalaya"], ["22", "Mizoram"], ["23", "Nagaland"], ["24", "Odisha"], ["25", "Puducherry"], ["26", "Punjab"], ["27", "Rajasthan"], ["28", "Sikkim"], ["29", "Tamil Nadu"], ["30", "Tripura"], ["31", "Uttar Pradesh"], ["32", "West Bengal"], ["33", "Chhattisgarh"], ["34", "Uttarakhand"], ["35", "Jharkhand"], ["36", "Telangana"], ["37", "Ladakh"]];
