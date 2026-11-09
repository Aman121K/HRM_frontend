"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { httpRequest } from "@/lib/http-client";
import { LeaveDetailPanel } from "./leave-detail";
import "./leave-overview.css";

type Req = {
  id: string; status: string; days: number; reason: string; decisionNote: string | null; startDate: string; endDate: string;
  submittedAt: string; decidedAt: string | null; leaveType: string; employeeId: string; employeeName: string; employeeNumber: string;
  department: string | null; approverName: string | null;
};
type Person = { employeeId: string; employeeName: string; employeeNumber: string; department: string | null; managerName: string | null; balances: Record<string, { balance: number | null; pending: number }> };
type Data = { requests: Req[]; employees: Person[]; summary: { total: number; pending: number; approved: number; rejected: number; withdrawn: number; approvedDays: number } };

const date = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const n = (v: number | null | undefined) => v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1);

/** HR / owner view of every leave request in the brand plus everyone's CL / SL / EL balances. */
export function LeaveRegister() {
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (status) q.set("status", status); if (month) q.set("month", month); if (employeeId) q.set("employeeId", employeeId);
    try { setData(await httpRequest<Data>(`/api/v2/leaves/register?${q}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the leave register."); }
  }, [status, month, employeeId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="core-page leave-overview">
      <header className="core-heading">
        <div>
          <p className="eyebrow">HR · TIME AWAY</p>
          <h1>Leave register</h1>
          <p>Every leave request in the company, who approved it, and everyone's balances.</p>
        </div>
        <Link className="lo-secondary" href="/leave"><ArrowLeft size={16} /> My leave</Link>
      </header>
      {error && <p className="core-error">{error}</p>}

      <div className="lr-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option><option value="WITHDRAWN">Withdrawn</option>
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-label="Employee">
          <option value="">All employees</option>
          {data?.employees.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.employeeNumber} · {p.employeeName}</option>)}
        </select>
      </div>

      {data && (
        <>
          <div className="lr-summary">
            <div><span>Requests</span><b>{data.summary.total}</b></div>
            <div><span>Pending</span><b>{data.summary.pending}</b></div>
            <div><span>Approved</span><b>{data.summary.approved}</b></div>
            <div><span>Rejected</span><b>{data.summary.rejected}</b></div>
            <div><span>Approved days</span><b>{n(data.summary.approvedDays)}</b></div>
          </div>

          <h2 className="lr-section-title">Leave requests</h2>
          <div className="lr-table-wrap">
            <table className="lr-table">
              <thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th>Days</th><th>Status</th><th>Approver</th><th>Note</th><th /></tr></thead>
              <tbody>
                {data.requests.length ? data.requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employeeName}<small>{r.employeeNumber}{r.department ? ` · ${r.department}` : ""}</small></td>
                    <td>{r.leaveType}<small>{r.reason}</small></td>
                    <td>{date(r.startDate)}{r.endDate !== r.startDate ? ` – ${date(r.endDate)}` : ""}</td>
                    <td>{n(r.days)}</td>
                    <td><span className={`lo-pill ${r.status.toLowerCase()}`}>{r.status}</span></td>
                    <td>{r.approverName || "—"}</td>
                    <td>{r.decisionNote || "—"}</td>
                    <td><button className="lo-view" onClick={() => setOpen(r.id)}><Eye size={13} /> Details</button></td>
                  </tr>
                )) : <tr><td colSpan={8}>No leave requests match these filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 className="lr-section-title">Balances (days left)</h2>
          <div className="lr-table-wrap">
            <table className="lr-table">
              <thead><tr><th>Employee</th><th>Manager</th><th>Casual (CL)</th><th>Sick (SL)</th><th>Earned (EL)</th></tr></thead>
              <tbody>
                {data.employees.map((p) => (
                  <tr key={p.employeeId}>
                    <td>{p.employeeName}<small>{p.employeeNumber}{p.department ? ` · ${p.department}` : ""}</small></td>
                    <td>{p.managerName || "—"}</td>
                    {["CL", "SL", "EL"].map((c) => (
                      <td key={c}>{n(p.balances[c]?.balance)}{p.balances[c]?.pending ? <small>{n(p.balances[c].pending)} pending</small> : null}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {open && <LeaveDetailPanel id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
