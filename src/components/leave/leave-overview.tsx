"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Eye, FileText, Plus, Undo2, X } from "lucide-react";
import { httpRequest } from "@/lib/http-client";
import { LeaveDetailPanel } from "./leave-detail";
import "./leave-overview.css";

type LeaveType = { id: string; code: string; name: string; annual_quota: string; balance: number | null; opening_balance: number | null; balance_as_of: string | null };
type LeaveRequest = {
  id: string; leave_type: string; start_date: string; end_date: string; days: string; reason: string; status: string;
  decision_note: string | null; submitted_at: string; decided_at: string | null;
};
const STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
type Filter = (typeof STATUSES)[number];
const LABEL: Record<string, string> = { ALL: "All", PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" };
const UNPAID = /LOP|UNPAID/i;

const fmtDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtWhen = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const days = (value: string | number) => { const n = Number(value); return `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`; };

/** The employee's own leave: live balances, every request with its decision, and a way into team approvals for approvers. */
export function LeaveOverview() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [teamPending, setTeamPending] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [isHr, setIsHr] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        httpRequest<{ items: LeaveType[] }>("/api/v2/leave-types"),
        httpRequest<{ items: LeaveRequest[] }>("/api/v2/leaves"),
      ]);
      setTypes(t.items); setRequests(r.items); setState("ready"); setError("");
      // Managers and HR also get a shortcut to what is waiting for them; everyone else gets a 403 here, which is fine.
      httpRequest<{ items: unknown[] }>("/api/v2/approvals/leaves").then((q) => setTeamPending(q.items.length), () => setTeamPending(null));
      httpRequest("/api/v2/leaves/register?status=PENDING").then(() => setIsHr(true), () => setIsHr(false));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your leave."); setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: requests.length };
    for (const r of requests) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [requests]);
  const pendingByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) if (r.status === "PENDING") m.set(r.leave_type, (m.get(r.leave_type) || 0) + Number(r.days));
    return m;
  }, [requests]);
  const shown = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);
  // Paid types with a tracked balance first; loss of pay last.
  const cards = types.filter((t) => t.balance !== null || ["CL", "SL", "EL"].includes(t.code))
    .sort((a, b) => Number(UNPAID.test(a.code)) - Number(UNPAID.test(b.code)));

  const withdraw = async (id: string) => {
    setBusy(id);
    try { await httpRequest(`/api/v2/leaves/${id}/withdraw`, { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't withdraw this request."); }
    finally { setBusy(""); }
  };

  return (
    <div className="core-page leave-overview">
      <header className="core-heading">
        <div>
          <p className="eyebrow">TIME AWAY</p>
          <h1>Leave</h1>
          <p>Your balances and every leave request, with the manager's decision.</p>
        </div>
        <div className="lo-actions">
          {isHr && <Link className="lo-secondary" href="/leave/register"><FileText size={16} /> Leave register</Link>}
          {teamPending !== null && (
            <Link className="lo-secondary" href="/approvals">
              <Check size={16} /> Team approvals{teamPending ? ` (${teamPending})` : ""}
            </Link>
          )}
          <Link className="core-primary lo-primary" href="/leave/apply"><Plus size={16} /> Request leave</Link>
        </div>
      </header>

      {error && <p className="core-error">{error}</p>}
      {state === "loading" && <p className="lo-muted">Loading your leave…</p>}

      {state === "ready" && (
        <>
          <section className="lo-balances" aria-label="Leave balances">
            {cards.map((t) => {
              const pending = pendingByType.get(t.name) || 0;
              const available = t.balance ?? Number(t.annual_quota);
              return (
                <article key={t.id} className="lo-balance">
                  <p>{t.name}</p>
                  <strong>{UNPAID.test(t.code) ? "—" : days(available)}</strong>
                  <span>
                    {UNPAID.test(t.code) ? "Unpaid — deducted from salary"
                      : pending ? `${days(pending)} pending approval`
                      : t.opening_balance !== null ? `Opening ${days(t.opening_balance)} as of ${fmtDate(t.balance_as_of || "")}`
                      : `${days(t.annual_quota)} a year`}
                  </span>
                </article>
              );
            })}
          </section>

          <section className="lo-history">
            <div className="lo-history-head">
              <h2>My leave requests</h2>
              <div className="lo-tabs" role="tablist">
                {STATUSES.map((s) => (
                  <button key={s} role="tab" aria-selected={filter === s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
                    {LABEL[s]} <span>{counts[s] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {!shown.length ? (
              <div className="lo-empty">
                <CalendarDays size={22} />
                <p>{requests.length ? `No ${LABEL[filter].toLowerCase()} requests.` : "You haven't requested any leave yet."}</p>
              </div>
            ) : (
              <ul className="lo-list">
                {shown.map((r) => (
                  <li key={r.id} className="lo-item">
                    <div className="lo-item-main">
                      <div className="lo-item-title">
                        <b>{r.leave_type}</b>
                        <span className={`lo-pill ${r.status.toLowerCase()}`}>{LABEL[r.status] || r.status}</span>
                      </div>
                      <p className="lo-dates">
                        {fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ""} · {days(r.days)}
                      </p>
                      <p className="lo-reason">{r.reason}</p>
                      {r.decision_note && <p className="lo-note"><b>Manager's note:</b> {r.decision_note}</p>}
                    </div>
                    <div className="lo-item-side">
                      <span><Clock3 size={13} /> Applied {fmtWhen(r.submitted_at)}</span>
                      {r.decided_at && <span>{r.status === "APPROVED" ? <Check size={13} /> : <X size={13} />} {LABEL[r.status]} {fmtWhen(r.decided_at)}</span>}
                      <button className="lo-view" onClick={() => setOpen(r.id)}><Eye size={13} /> View details</button>
                      {r.status === "PENDING" && (
                        <button className="lo-withdraw" disabled={busy === r.id} onClick={() => withdraw(r.id)}>
                          <Undo2 size={13} /> {busy === r.id ? "Withdrawing…" : "Withdraw"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {open && <LeaveDetailPanel id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
