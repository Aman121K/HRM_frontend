"use client";
import { httpRequest } from "@/lib/http-client";

export type LoanKind = "LOAN" | "ADVANCE";
export type LoanStatus = "REQUESTED" | "APPROVED" | "ACTIVE" | "CLOSED" | "REJECTED" | "CANCELLED";
export type Installment = { id?: string; seq: number; period: string; amount: number; status: "DUE" | "DEDUCTED" | "SKIPPED" | "PREPAID" | "PLANNED"; note?: string | null };
export type Loan = {
  id: string; number: string; kind: LoanKind; purpose: string; reason: string; status: LoanStatus;
  employee: { id: string; name: string; number: string; department: string | null };
  principal: number; tenureMonths: number; emi: number; firstPeriod: string; recovered: number; outstanding: number;
  requestedBy: string; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null;
  disbursedOn: string | null; disbursementRef: string | null; closedAt: string | null; closureNote: string | null;
  createdAt: string; version: number; perquisite: string | null;
};
export type LoanDetail = Loan & { installments: Installment[]; history?: { action: string; after_data: any; created_at: string; actor: string | null }[]; warnings?: string[] };
export type LoanContext = {
  viewer: { employeeId: string; isAdmin: boolean };
  purposes: string[]; policy: { ADVANCE: { maxGrossMultiple: number; maxTenure: number }; LOAN: { maxGrossMultiple: number; maxTenure: number } };
  monthlyGross: number | null; defaultFirstPeriod: string; outstanding: number; limits: { ADVANCE: number; LOAN: number } | null;
};
export type LoanSummary = { pending: number; to_disburse: number; active: number; active_principal: number; outstanding: number; due_next: number };

const base = "/api/v2/loans";
export const loansApi = {
  context: () => httpRequest<LoanContext>(`${base}/context`),
  list: (scope: "mine" | "all", status?: string) => httpRequest<{ items: Loan[]; summary: LoanSummary | null }>(`${base}?scope=${scope}${status ? `&status=${status}` : ""}`),
  get: (id: string) => httpRequest<LoanDetail>(`${base}/${id}`),
  request: (body: { kind: LoanKind; purpose: string; reason: string; principal: number; tenureMonths: number; firstPeriod?: string; employeeId?: string }) =>
    httpRequest<LoanDetail>(base, { method: "POST", body }),
  decide: (id: string, body: { decision: "approve" | "reject"; note?: string; tenureMonths?: number; firstPeriod?: string; version: number }) =>
    httpRequest<LoanDetail>(`${base}/${id}/decision`, { method: "POST", body }),
  disburse: (id: string, body: { disbursedOn: string; reference: string; version: number }) => httpRequest<LoanDetail>(`${base}/${id}/disburse`, { method: "POST", body }),
  skip: (id: string, body: { period: string; note: string; version: number }) => httpRequest<LoanDetail>(`${base}/${id}/skip`, { method: "POST", body }),
  foreclose: (id: string, body: { reference: string; note?: string; version: number }) => httpRequest<LoanDetail>(`${base}/${id}/foreclose`, { method: "POST", body }),
  cancel: (id: string, version: number) => httpRequest<LoanDetail>(`${base}/${id}/cancel`, { method: "POST", body: { version } }),
};

export const LOAN_STATUS: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: "Awaiting approval", tone: "info" }, APPROVED: { label: "Approved · to disburse", tone: "warning" }, ACTIVE: { label: "Recovering", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" }, REJECTED: { label: "Rejected", tone: "danger" }, CANCELLED: { label: "Cancelled", tone: "neutral" },
};
export const INSTALLMENT_STATUS: Record<string, { label: string; tone: string }> = {
  DUE: { label: "Due", tone: "info" }, DEDUCTED: { label: "Deducted", tone: "success" }, SKIPPED: { label: "Skipped", tone: "warning" },
  PREPAID: { label: "Prepaid", tone: "neutral" }, PLANNED: { label: "Planned", tone: "neutral" },
};
