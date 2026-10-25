"use client";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { caseUi } from "@/lib/case-ui";
import { caseApi, dueLabel, loadDefinitions, money, relativeTime, type CaseItem, type CaseModule } from "@/lib/cases";
import { httpRequest } from "@/lib/http-client";
import { CaseDrawer, StatusBadge } from "./case-drawer";

type LeaveItem = { id: string; status: string; submitted_at: string; employee: string; title: string; detail: string };

export function ApprovalsHub() {
  const [modules, setModules] = useState<CaseModule[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<CaseItem | null>(null);
  const [deciding, setDeciding] = useState<{ item: LeaveItem; note: string } | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [definitions, inbox] = await Promise.all([loadDefinitions(), caseApi.inbox()]);
      setModules(definitions.items);
      setCases(inbox.items);
      const isApprover = definitions.viewer.isHr || definitions.viewer.roles.includes("MANAGER");
      setLeaves(isApprover ? (await httpRequest<{ items: LeaveItem[] }>("/api/v2/approvals/leaves").catch(() => ({ items: [] }))).items : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your inbox.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decideLeave = async (decision: "APPROVED" | "REJECTED") => {
    if (!deciding) return;
    if (decision === "REJECTED" && !deciding.note.trim()) { setError("Add a note before rejecting leave."); return; }
    try {
      await httpRequest(`/api/v2/approvals/leaves/${deciding.item.id}/decision`, { method: "POST", body: { decision, note: deciding.note } });
      setDeciding(null); setToast(`Leave ${decision.toLowerCase()}`); window.setTimeout(() => setToast(""), 2600); load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save decision."); }
  };

  const byModule = new Map(modules.map((module) => [module.key, module]));
  const counts: Record<string, number> = { leave: leaves.length };
  for (const item of cases) counts[item.module] = (counts[item.module] || 0) + 1;
  const total = cases.length + leaves.length;
  const visibleCases = filter === "all" ? cases : filter === "leave" ? [] : cases.filter((item) => item.module === filter);
  const visibleLeaves = filter === "all" || filter === "leave" ? leaves : [];
  const overdue = cases.filter((item) => item.overdue).length;
  const pendingValue = cases.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><CheckCircle2 size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">OVERVIEW · UNIFIED INBOX</p>
          <h1>Approvals & tasks</h1>
          <p>Everything waiting on you — leave, claims, travel, assets, tickets, letters, hiring and exits — in one prioritised queue.</p>
        </div>
      </header>
      <section className="cw-stats">
        <article className={total ? "attention" : ""}><small>Waiting on you</small><b>{total}</b><span>{total ? "oldest first" : "inbox zero"}</span></article>
        <article><small>Past SLA</small><b>{overdue}</b><span>{overdue ? "respond first" : "none overdue"}</span></article>
        <article><small>Leave requests</small><b>{leaves.length}</b><span>from your team</span></article>
        <article><small>Value in queue</small><b>{money(pendingValue)}</b><span>claims, travel & offers</span></article>
      </section>
      <div className="cw-chips">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <b>{total}</b></button>
        {Object.entries(counts).filter(([, count]) => count).map(([key, count]) => (
          <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{key === "leave" ? "Leave" : byModule.get(key)?.label || key} <b>{count}</b></button>
        ))}
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {loading && !total ? <div className="cw-list-skeleton"><i /><i /><i /></div>
        : !total ? (
          <div className="cw-empty"><span><CheckCircle2 size={26} /></span><h2>You’re all caught up</h2><p>New requests that need your decision will appear here the moment they’re submitted.</p></div>
        ) : (
          <div className="cw-table">
            {visibleLeaves.map((item) => (
              <button key={item.id} className="cw-inbox-item" style={{ ["--accent" as string]: "#0b615c" }} onClick={() => setDeciding({ item, note: "" })}>
                <span className="cw-inbox-icon"><CalendarDays size={19} /></span>
                <p><small>LEAVE · {item.employee}</small><b>{item.title}</b><em>{item.detail}</em></p>
                <span className="cw-sla"><Clock3 size={13} /> {relativeTime(item.submitted_at)}</span>
                <ChevronRight size={16} />
              </button>
            ))}
            {visibleCases.map((item) => {
              const module = byModule.get(item.module);
              const ui = caseUi[item.module];
              const Icon = ui?.icon || CheckCircle2;
              return (
                <button key={item.id} className="cw-inbox-item" style={{ ["--accent" as string]: ui?.accent }} onClick={() => setOpen(item)}>
                  <span className="cw-inbox-icon"><Icon size={19} /></span>
                  <p>
                    <small>{module?.label.toUpperCase()} · {item.caseNumber} · {item.relation === "mine" ? "your request" : item.requester.name}</small>
                    <b>{item.title}</b>
                    <em>{[item.category, item.amount !== null ? money(item.amount) : "", item.actions.filter((action) => !action.optional).map((action) => action.label).join(" / ")].filter(Boolean).join(" · ")}</em>
                  </p>
                  <span className="cw-head-meta">
                    <StatusBadge tone={item.tone} label={item.statusLabel} />
                    {item.dueAt && <span className={item.overdue ? "cw-sla over" : "cw-sla"}><Clock3 size={13} /> {dueLabel(item.dueAt, item.slaStopped)}</span>}
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        )}
      {open && byModule.get(open.module) && <CaseDrawer id={open.id} module={byModule.get(open.module)!} onClose={() => setOpen(null)} onChanged={load} />}
      {deciding && (
        <>
          <button className="flow-backdrop" aria-label="Close" onClick={() => setDeciding(null)} />
          <section className="flow-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-decision-title">
            <p className="cw-eyebrow" style={{ color: "var(--teal)" }}>LEAVE · {deciding.item.employee.toUpperCase()}</p>
            <h2 id="leave-decision-title">{deciding.item.title}</h2>
            <p className="cw-head-note">{deciding.item.detail}</p>
            <label className="cw-note" style={{ margin: "18px 0" }}>
              <span>Decision note <small>required to reject</small></span>
              <textarea rows={3} value={deciding.note} onChange={(event) => setDeciding({ ...deciding, note: event.target.value })} />
            </label>
            <div className="cw-action-row">
              <button className="cw-btn ghost" onClick={() => setDeciding(null)}>Cancel</button>
              <button className="cw-btn danger" onClick={() => decideLeave("REJECTED")}>Reject</button>
              <button className="cw-btn primary" style={{ ["--accent" as string]: "#0b615c" }} onClick={() => decideLeave("APPROVED")}>Approve</button>
            </div>
          </section>
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
