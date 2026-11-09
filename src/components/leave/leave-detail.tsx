"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { httpRequest } from "@/lib/http-client";

type Detail = {
  id: string; status: string; days: number; reason: string; decisionNote: string | null; startDate: string; endDate: string;
  submittedAt: string; decidedAt: string | null; leaveTypeCode: string; leaveType: string;
  employeeName: string; employeeNumber: string; department: string | null; designation: string | null;
  approverName: string | null; approverNumber: string | null;
  balance: { balance: number | null; opening_balance: number | null; balance_as_of: string | null; annual_quota: string } | null;
  timeline: { action: string; at: string; actor: string; note: string | null }[];
};
const ACTION: Record<string, string> = { LEAVE_SUBMITTED: "Applied", APPROVED: "Approved", REJECTED: "Rejected", LEAVE_WITHDRAWN: "Withdrawn" };
const date = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const when = (v: string) => new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const n = (v: number | string) => { const x = Number(v); return Number.isInteger(x) ? String(x) : x.toFixed(1); };

/** Side panel with everything about one leave request (employee, approver, HR all use it). */
export function LeaveDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    httpRequest<Detail>(`/api/v2/leaves/${id}`).then(setD, (e) => setError(e instanceof Error ? e.message : "Couldn't load this request."));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [id, onClose]);

  return (
    <>
      <button className="ld-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="ld-panel" role="dialog" aria-modal="true" aria-labelledby="ld-title">
        <div className="ld-head">
          <div>
            <p className="eyebrow">LEAVE REQUEST</p>
            <h2 id="ld-title">{d ? d.leaveType : "Loading…"}</h2>
          </div>
          <button className="ld-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {error && <p className="core-error">{error}</p>}
        {d && (
          <>
            <span className={`lo-pill ${d.status.toLowerCase()}`}>{d.status}</span>
            <dl className="ld-grid">
              <div><dt>Employee</dt><dd>{d.employeeName} · {d.employeeNumber}</dd></div>
              <div><dt>Department</dt><dd>{[d.department, d.designation].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Dates</dt><dd>{date(d.startDate)}{d.endDate !== d.startDate ? ` – ${date(d.endDate)}` : ""}</dd></div>
              <div><dt>Days</dt><dd>{n(d.days)}</dd></div>
              <div><dt>Approver (manager)</dt><dd>{d.approverName ? `${d.approverName} · ${d.approverNumber}` : "—"}</dd></div>
              <div><dt>Applied on</dt><dd>{when(d.submittedAt)}</dd></div>
              <div className="wide"><dt>Reason</dt><dd>{d.reason}</dd></div>
              {d.decidedAt && <div><dt>Decided on</dt><dd>{when(d.decidedAt)}</dd></div>}
              {d.decisionNote && <div className={d.decidedAt ? "" : "wide"}><dt>Decision note</dt><dd>{d.decisionNote}</dd></div>}
              <div className="wide">
                <dt>{d.leaveType} balance now</dt>
                <dd>
                  {/LOP|UNPAID/i.test(d.leaveTypeCode) ? "Unpaid leave — these days are deducted in payroll"
                    : d.balance?.balance != null ? `${n(d.balance.balance)} days left (opening ${n(d.balance.opening_balance ?? 0)} as of ${date(d.balance.balance_as_of || d.startDate)})`
                    : d.balance ? `${n(d.balance.annual_quota)} days a year` : "—"}
                </dd>
              </div>
            </dl>
            <h3>Timeline</h3>
            <ol className="ld-timeline">
              {d.timeline.map((t, i) => (
                <li key={i}>
                  <b>{ACTION[t.action] || t.action} by {t.actor}</b>
                  <span>{when(t.at)}{t.note ? ` · "${t.note}"` : ""}</span>
                </li>
              ))}
              {d.status === "PENDING" && <li><b>Waiting for {d.approverName || "the manager"}</b><span>Not decided yet</span></li>}
            </ol>
          </>
        )}
      </aside>
    </>
  );
}
