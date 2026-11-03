"use client";
import { AlertTriangle, Banknote, CheckCircle2, ChevronRight, HandCoins, Info, Loader2, Plus, SkipForward, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { errorText, inr, inrShort, monthLabel } from "../payroll-engine/api";
import { ACCENT, Badge, Drawer, ErrorState } from "../payroll-engine/ui";
import { INSTALLMENT_STATUS, LOAN_STATUS, loansApi, type Loan, type LoanContext, type LoanDetail, type LoanKind, type LoanSummary } from "./api";

type Tab = "mine" | "queue" | "active" | "closed";
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function LoansWorkspace() {
  const [context, setContext] = useState<LoanContext | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [items, setItems] = useState<Loan[] | null>(null);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<{ kind: "request"; forOther?: boolean } | { kind: "loan"; id: string } | null>(null);
  const [toast, setToast] = useState("");
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  const load = useCallback(async () => {
    setError("");
    try {
      const ctx = await loansApi.context();
      setContext(ctx);
      const scope = tab === "mine" ? "mine" : "all";
      const data = await loansApi.list(scope);
      const filter: Record<Tab, (loan: Loan) => boolean> = {
        mine: () => true, queue: (l) => l.status === "REQUESTED" || l.status === "APPROVED", active: (l) => l.status === "ACTIVE",
        closed: (l) => ["CLOSED", "REJECTED", "CANCELLED"].includes(l.status),
      };
      setItems(data.items.filter(filter[tab])); setSummary(data.summary);
    } catch (reason) { setError(errorText(reason, "Unable to load loans.")); }
  }, [tab]);
  useEffect(() => { void load(); }, [load]);

  const mine = tab === "mine";
  const myActive = useMemo(() => (mine ? (items || []).filter((l) => l.status === "ACTIVE") : []), [items, mine]);

  return (
    <div className="cw-page pe-page loan-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><HandCoins size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAY &amp; CLAIMS · LOANS</p>
          <h1>Loans &amp; salary advances</h1>
          <p>Request an advance or an interest-free loan. Once approved and paid out, the EMI is recovered automatically from your monthly salary.</p>
        </div>
        <div className="pe-hero-actions">
          {context?.viewer.isAdmin && <button className="cw-btn ghost" onClick={() => setPanel({ kind: "request", forOther: true })}><Plus size={16} /> Raise for an employee</button>}
          <button className="cw-btn primary lg" onClick={() => setPanel({ kind: "request" })}><Plus size={17} /> Request advance or loan</button>
        </div>
      </header>

      {context?.viewer.isAdmin && (
        <nav className="cw-tabs" role="tablist" aria-label="Loan views" style={{ borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
          {([["mine", "My loans"], ["queue", `Approvals & payouts${summary && summary.pending + summary.to_disburse ? ` (${summary.pending + summary.to_disburse})` : ""}`], ["active", "Recovering"], ["closed", "Closed"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => { setItems(null); setTab(key); }}>{label}</button>
          ))}
        </nav>
      )}

      {mine && context && (
        <section className="cw-stats" aria-label="Your limits">
          <article><small>Outstanding</small><b>{inr(context.outstanding)}</b><span>{myActive.length ? `${myActive.length} recovering · EMI ${inr(myActive.reduce((t, l) => t + l.emi, 0))}/month` : "nothing to repay"}</span></article>
          <article><small>Advance limit</small><b>{context.limits ? inrShort(context.limits.ADVANCE) : "—"}</b><span>{context.policy.ADVANCE.maxGrossMultiple}× monthly gross · up to {context.policy.ADVANCE.maxTenure} months</span></article>
          <article><small>Loan limit</small><b>{context.limits ? inrShort(context.limits.LOAN) : "—"}</b><span>{context.policy.LOAN.maxGrossMultiple}× monthly gross · up to {context.policy.LOAN.maxTenure} months</span></article>
          <article><small>Interest</small><b className="text">Interest-free</b><span>recovered as equal monthly EMIs</span></article>
        </section>
      )}
      {!mine && summary && (
        <section className="cw-stats" aria-label="Loan book">
          <article className={summary.pending ? "attention" : ""}><small>Awaiting approval</small><b>{summary.pending}</b><span>requests</span></article>
          <article className={summary.to_disburse ? "attention" : ""}><small>To disburse</small><b>{summary.to_disburse}</b><span>approved, not paid out</span></article>
          <article><small>Outstanding book</small><b>{inrShort(summary.outstanding)}</b><span>{summary.active} active loans</span></article>
          <article><small>Recovery next month</small><b>{inrShort(summary.due_next)}</b><span>added to the payroll run as EMI deductions</span></article>
        </section>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!items ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !items.length ? (
        <div className="cw-empty">
          <span><Banknote size={26} /></span>
          <h2>{mine ? "No loans or advances" : "Nothing here"}</h2>
          <p>{mine ? "Need money before payday? Request a salary advance — it's recovered from your next few salaries." : "Requests appear here as employees raise them."}</p>
          {mine && <button className="cw-btn primary" onClick={() => setPanel({ kind: "request" })}><Plus size={16} /> Request advance or loan</button>}
        </div>
      ) : (
        <div className="cw-table loan-table" role="table" aria-label="Loans">
          <div className="cw-row head" role="row">
            <span role="columnheader">{mine ? "Loan" : "Employee"}</span><span role="columnheader">Status</span><span role="columnheader" className="num">Amount</span>
            <span role="columnheader" className="num">EMI</span><span role="columnheader">Recovery</span><span role="columnheader" className="num">Outstanding</span><span />
          </div>
          {items.map((loan) => {
            const meta = LOAN_STATUS[loan.status];
            const pct = loan.principal ? Math.round((loan.recovered / loan.principal) * 100) : 0;
            return (
              <button key={loan.id} role="row" className={`cw-row ${!mine && (loan.status === "REQUESTED" || loan.status === "APPROVED") ? "actionable" : ""}`} onClick={() => setPanel({ kind: "loan", id: loan.id })}>
                <span className="cw-title-cell" role="cell"><small>{loan.number} · {loan.kind === "ADVANCE" ? "Salary advance" : "Loan"} · {loan.purpose}</small><b>{mine ? loan.reason : `${loan.employee.name} (${loan.employee.number})`}</b></span>
                <span role="cell"><Badge tone={meta.tone} label={meta.label} />{loan.perquisite && <em className="cw-flag" title={loan.perquisite}>Perquisite</em>}</span>
                <span role="cell" className="num">{inr(loan.principal)}</span>
                <span role="cell" className="num">{inr(loan.emi)}<small className="pe-muted"> × {loan.tenureMonths}</small></span>
                <span role="cell">{loan.status === "ACTIVE" || loan.status === "CLOSED"
                  ? <span className="loan-meter" aria-label={`${pct}% recovered`}><i style={{ width: `${pct}%` }} /><small>{pct}% · from {monthLabel(loan.firstPeriod)}</small></span>
                  : <small className="pe-muted">from {monthLabel(loan.firstPeriod)}</small>}</span>
                <span role="cell" className="num">{loan.status === "ACTIVE" ? inr(loan.outstanding) : "—"}</span>
                <span role="cell" className="cw-row-cta">{!mine && loan.status === "REQUESTED" ? <em>Decide</em> : !mine && loan.status === "APPROVED" ? <em>Disburse</em> : null}<ChevronRight size={16} /></span>
              </button>
            );
          })}
        </div>
      )}

      {panel?.kind === "request" && context && <RequestDrawer context={context} forOther={panel.forOther} onClose={() => setPanel(null)}
        onDone={(loan) => { setPanel({ kind: "loan", id: loan.id }); flash(`${loan.number} submitted for approval`); void load(); }} />}
      {panel?.kind === "loan" && context && <LoanDrawer id={panel.id} context={context} onClose={() => setPanel(null)} onChanged={(message) => { flash(message); void load(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function RequestDrawer({ context, forOther, onClose, onDone }: { context: LoanContext; forOther?: boolean; onClose: () => void; onDone: (loan: LoanDetail) => void }) {
  const [kind, setKind] = useState<LoanKind>("ADVANCE");
  const [purpose, setPurpose] = useState(context.purposes[0]);
  const [reason, setReason] = useState("");
  const [principal, setPrincipal] = useState<number>(context.limits ? Math.min(context.limits.ADVANCE, 10000) : 10000);
  const [tenure, setTenure] = useState(2);
  const [firstPeriod, setFirstPeriod] = useState(context.defaultFirstPeriod);
  const [employee, setEmployee] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const policy = context.policy[kind];
  const limit = forOther ? null : context.limits?.[kind] ?? null;
  const emi = tenure ? Math.ceil(principal / tenure) : 0;
  useEffect(() => { setTenure((t) => Math.min(t, policy.maxTenure)); }, [policy.maxTenure]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const loan = await loansApi.request({ kind, purpose, reason, principal, tenureMonths: tenure, firstPeriod, employeeId: forOther ? employee?.id : undefined });
      onDone(loan);
    } catch (reason) { setError(errorText(reason, "Unable to submit the request.")); } finally { setBusy(false); }
  };
  return (
    <Drawer title={forOther ? "Raise a loan for an employee" : "Request an advance or loan"} eyebrow="LOANS · NEW REQUEST" onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="cw-chips" role="radiogroup" aria-label="Type">
          <button type="button" role="radio" aria-checked={kind === "ADVANCE"} className={kind === "ADVANCE" ? "active" : ""} onClick={() => setKind("ADVANCE")}>Salary advance</button>
          <button type="button" role="radio" aria-checked={kind === "LOAN"} className={kind === "LOAN" ? "active" : ""} onClick={() => setKind("LOAN")}>Loan</button>
        </div>
        <div className="cw-fields">
          {forOther && <EmployeePicker value={employee} onChange={setEmployee} />}
          <label><span>Amount (₹) <em>*</em></span><input type="number" min={500} step={500} required value={principal || ""} onChange={(e) => setPrincipal(Number(e.target.value))} />
            {limit !== null && <small className={principal > limit ? "loan-over" : "pe-muted"}>Limit {inr(limit)}</small>}</label>
          <label><span>Recover over <em>*</em></span>
            <select value={tenure} onChange={(e) => setTenure(Number(e.target.value))}>
              {Array.from({ length: policy.maxTenure }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} month{n > 1 ? "s" : ""}</option>)}
            </select></label>
          <label><span>Purpose <em>*</em></span><select value={purpose} onChange={(e) => setPurpose(e.target.value)}>{context.purposes.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label><span>First EMI month</span><input type="month" value={firstPeriod} min={context.defaultFirstPeriod.slice(0, 7)} onChange={(e) => setFirstPeriod(e.target.value)} /></label>
          <label className="wide"><span>Reason <em>*</em></span><textarea rows={3} required minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hospital bills for my father's surgery" /></label>
        </div>
        <div className="loan-preview" aria-live="polite">
          <div><small>Monthly EMI</small><b>{inr(emi)}</b></div>
          <div><small>Recovered</small><b>{monthLabel(firstPeriod)} → {monthLabel(addMonths(firstPeriod, tenure - 1))}</b></div>
          <div><small>Interest</small><b>Nil</b></div>
        </div>
        {context.monthlyGross !== null && !forOther && emi > context.monthlyGross * 0.5 && <p className="cw-alert warn"><AlertTriangle size={15} /><span>The EMI is more than half your gross pay. A longer tenure keeps more of your salary in hand.</span></p>}
        <p className="pe-note"><Info size={13} /><span>HR or payroll approves the request and records the payout. The EMI is then deducted automatically in each payroll run; you'll see it on your payslip as “{kind === "ADVANCE" ? "Salary advance" : "Loan EMI"}”.</span></p>
        <div className="cw-create-foot">
          <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy || !principal || !reason.trim() || (forOther && !employee)}>{busy ? "Submitting…" : "Submit for approval"}</button>
        </div>
      </form>
    </Drawer>
  );
}

function EmployeePicker({ value, onChange }: { value: { id: string; label: string } | null; onChange: (value: { id: string; label: string } | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; employeeNumber: string; fullName: string; designation: string }[]>([]);
  useEffect(() => {
    if (value || query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      try { setResults((await httpRequest<{ items: any[] }>(`/api/v2/employees?${new URLSearchParams({ search: query.trim(), limit: "8" })}`)).items.filter((e) => e.status === "ACTIVE")); } catch { setResults([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, value]);
  if (value) return <label className="wide"><span>Employee</span><span className="loan-picked">{value.label} <button type="button" className="pe-link" onClick={() => { onChange(null); setQuery(""); }}>Change</button></span></label>;
  return (
    <label className="wide loan-picker"><span>Employee <em>*</em></span>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or employee ID" autoComplete="off" />
      {!!results.length && <ul role="listbox">{results.map((r) => (
        <li key={r.id}><button type="button" onClick={() => onChange({ id: r.id, label: `${r.fullName} (${r.employeeNumber})` })}><b>{r.fullName}</b><small>{r.employeeNumber} · {r.designation || "—"}</small></button></li>
      ))}</ul>}
    </label>
  );
}

function LoanDrawer({ id, context, onClose, onChanged }: { id: string; context: LoanContext; onClose: () => void; onChanged: (message: string) => void }) {
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [mode, setMode] = useState<"" | "approve" | "reject" | "disburse" | "foreclose" | { skip: string }>("");
  const [note, setNote] = useState("");
  const [tenure, setTenure] = useState(0);
  const [firstPeriod, setFirstPeriod] = useState("");
  const [disbursedOn, setDisbursedOn] = useState(today());
  const [reference, setReference] = useState("");
  const load = useCallback(async () => {
    try { const data = await loansApi.get(id); setLoan(data); setTenure(data.tenureMonths); setFirstPeriod(data.firstPeriod); } catch (reason) { setError(errorText(reason, "Unable to load the loan.")); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, work: () => Promise<LoanDetail>, message: string) => {
    setBusy(key); setError("");
    try { const data = await work(); setLoan({ ...data, history: loan?.history }); setMode(""); setNote(""); setReference(""); onChanged(message); void load(); }
    catch (reason) { setError(errorText(reason, "That didn't work.")); } finally { setBusy(""); }
  };

  if (!loan) return <Drawer title="Loan" eyebrow="LOANS" onClose={onClose}>{error ? <ErrorState message={error} onRetry={load} /> : <div className="cw-list-skeleton"><i /><i /></div>}</Drawer>;
  const admin = context.viewer.isAdmin;
  const isOwn = loan.employee.id === context.viewer.employeeId;
  const meta = LOAN_STATUS[loan.status];
  const pct = loan.principal ? Math.round((loan.recovered / loan.principal) * 100) : 0;
  return (
    <Drawer wide title={`${loan.kind === "ADVANCE" ? "Salary advance" : "Loan"} ${loan.number}`} eyebrow={`LOANS · ${loan.employee.name.toUpperCase()}`} onClose={onClose}
      head={<Badge tone={meta.tone} label={meta.label} />}>
      {error && <ErrorState message={error} />}
      {loan.warnings?.map((w) => <p key={w} className="cw-alert warn"><AlertTriangle size={15} /><span>{w}</span></p>)}
      {loan.perquisite && <p className="cw-alert warn"><AlertTriangle size={15} /><span>{loan.perquisite}</span></p>}
      <section className="loan-facts">
        <div><small>Amount</small><b>{inr(loan.principal)}</b></div>
        <div><small>EMI</small><b>{inr(loan.emi)} × {loan.tenureMonths}</b></div>
        <div><small>Recovered</small><b>{inr(loan.recovered)} <em>{pct}%</em></b></div>
        <div><small>Outstanding</small><b>{inr(loan.outstanding)}</b></div>
      </section>
      <dl className="loan-dl">
        <dt>Purpose</dt><dd>{loan.purpose} — {loan.reason}</dd>
        <dt>Requested</dt><dd>{dateLabel(loan.createdAt)} by {loan.requestedBy}</dd>
        {loan.decidedBy && <><dt>{loan.status === "REJECTED" ? "Rejected" : "Approved"}</dt><dd>{dateLabel(loan.decidedAt)} by {loan.decidedBy}{loan.decisionNote ? ` — “${loan.decisionNote}”` : ""}</dd></>}
        {loan.disbursedOn && <><dt>Paid out</dt><dd>{dateLabel(loan.disbursedOn)} · ref {loan.disbursementRef}</dd></>}
        {loan.closureNote && <><dt>Closed</dt><dd>{dateLabel(loan.closedAt)} · {loan.closureNote}</dd></>}
      </dl>

      {admin && !isOwn && loan.status === "REQUESTED" && !mode && (
        <div className="cw-create-foot loan-actions">
          <button className="cw-btn ghost" onClick={() => setMode("reject")}><XCircle size={15} /> Reject</button>
          <button className="cw-btn primary" onClick={() => setMode("approve")}><CheckCircle2 size={15} /> Approve</button>
        </div>
      )}
      {(mode === "approve" || mode === "reject") && (
        <form className="cw-create loan-inline" onSubmit={(e) => { e.preventDefault(); void act(mode, () => loansApi.decide(loan.id, { decision: mode, note: note || undefined, tenureMonths: tenure, firstPeriod, version: loan.version }), mode === "approve" ? "Approved — record the payout next" : "Request rejected"); }}>
          <div className="cw-fields">
            {mode === "approve" && <>
              <label><span>Recover over</span><input type="number" min={1} max={60} value={tenure} onChange={(e) => setTenure(Number(e.target.value))} /></label>
              <label><span>First EMI month</span><input type="month" value={firstPeriod} onChange={(e) => setFirstPeriod(e.target.value)} /></label>
            </>}
            <label className="wide"><span>Note {mode === "reject" ? <em>*</em> : <small>optional</small>}</span><textarea rows={2} maxLength={1000} required={mode === "reject"} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={() => setMode("")}>Back</button>
            <button className={`cw-btn ${mode === "reject" ? "danger" : "primary"}`} disabled={!!busy}>{busy ? <Loader2 size={15} className="spin" /> : null} {mode === "approve" ? `Approve · EMI ${inr(Math.ceil(loan.principal / (tenure || 1)))}` : "Reject request"}</button></div>
        </form>
      )}
      {admin && loan.status === "APPROVED" && !mode && (
        <div className="cw-create-foot loan-actions">
          <button className="cw-btn ghost" onClick={() => { if (window.confirm("Cancel this approved loan?")) void act("cancel", () => loansApi.cancel(loan.id, loan.version), "Loan cancelled"); }}>Cancel loan</button>
          <button className="cw-btn primary" onClick={() => setMode("disburse")}><Banknote size={15} /> Record payout</button>
        </div>
      )}
      {mode === "disburse" && (
        <form className="cw-create loan-inline" onSubmit={(e) => { e.preventDefault(); void act("disburse", () => loansApi.disburse(loan.id, { disbursedOn, reference, version: loan.version }), "Payout recorded — EMIs scheduled"); }}>
          <div className="cw-fields">
            <label><span>Paid on <em>*</em></span><input type="date" max={today()} required value={disbursedOn} onChange={(e) => setDisbursedOn(e.target.value)} /></label>
            <label><span>UTR / reference <em>*</em></span><input required minLength={2} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. HDFC N123456789" /></label>
          </div>
          <p className="pe-note"><Info size={13} /><span>If payroll for {monthLabel(loan.firstPeriod)} is already submitted or published, the first EMI moves to the next open month.</span></p>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={() => setMode("")}>Back</button><button className="cw-btn primary" disabled={!!busy}>{busy ? <Loader2 size={15} className="spin" /> : null} Record payout &amp; schedule EMIs</button></div>
        </form>
      )}
      {loan.status === "REQUESTED" && isOwn && !mode && (
        <div className="cw-create-foot loan-actions"><button className="cw-btn ghost" onClick={() => { if (window.confirm("Withdraw this request?")) void act("cancel", () => loansApi.cancel(loan.id, loan.version), "Request withdrawn"); }}>Withdraw request</button></div>
      )}
      {admin && loan.status === "ACTIVE" && !mode && (
        <div className="cw-create-foot loan-actions"><button className="cw-btn ghost" onClick={() => setMode("foreclose")}>Foreclose (repaid outside payroll)</button></div>
      )}
      {mode === "foreclose" && (
        <form className="cw-create loan-inline" onSubmit={(e) => { e.preventDefault(); void act("foreclose", () => loansApi.foreclose(loan.id, { reference, note: note || undefined, version: loan.version }), "Loan closed"); }}>
          <p className="pe-note"><Info size={13} /><span>Use this when {loan.employee.name} has repaid the outstanding {inr(loan.outstanding)} directly (bank transfer, F&amp;F settlement). Remaining EMIs are cancelled.</span></p>
          <div className="cw-fields">
            <label><span>Receipt / UTR <em>*</em></span><input required minLength={2} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
            <label><span>Note</span><input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={() => setMode("")}>Back</button><button className="cw-btn primary" disabled={!!busy}>Close loan</button></div>
        </form>
      )}
      {typeof mode === "object" && (
        <form className="cw-create loan-inline" onSubmit={(e) => { e.preventDefault(); void act("skip", () => loansApi.skip(loan.id, { period: mode.skip, note, version: loan.version }), `${monthLabel(mode.skip)} EMI skipped`); }}>
          <p className="pe-note"><Info size={13} /><span>Skip the {monthLabel(mode.skip)} EMI. One more installment is added at the end of the schedule.</span></p>
          <div className="cw-fields"><label className="wide"><span>Reason <em>*</em></span><input required minLength={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Long unpaid leave this month" /></label></div>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={() => setMode("")}>Back</button><button className="cw-btn primary" disabled={!!busy}>Skip EMI</button></div>
        </form>
      )}

      <section className="pe-table-card loan-schedule">
        <header><h3>{loan.status === "REQUESTED" ? "Proposed EMI schedule" : "EMI schedule"}</h3><span>{loan.installments.length} installments</span></header>
        <table>
          <thead><tr><th>#</th><th>Month</th><th className="num">EMI</th><th>Status</th>{admin && loan.status === "ACTIVE" && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>{loan.installments.map((row) => {
            const st = INSTALLMENT_STATUS[row.status];
            return (
              <tr key={`${row.seq}-${row.period}`}>
                <td>{row.seq}</td><td>{monthLabel(row.period)}{row.note && <small className="pe-muted"> · {row.note}</small>}</td><td className="num">{inr(row.amount)}</td>
                <td><Badge tone={st.tone} label={st.label} /></td>
                {admin && loan.status === "ACTIVE" && <td>{row.status === "DUE" && <button className="pe-link" onClick={() => { setNote(""); setMode({ skip: row.period }); }}><SkipForward size={13} /> Skip</button>}</td>}
              </tr>
            );
          })}</tbody>
        </table>
      </section>

      {!!loan.history?.length && (
        <section className="pe-table-card">
          <header><h3>Audit trail</h3></header>
          <ol className="loan-history">{loan.history.map((h, i) => <li key={i}><b>{h.action.replace(/^LOAN_/, "").replace(/_/g, " ").toLowerCase()}</b> <span>{h.actor || "System"} · {dateLabel(h.created_at)}</span></li>)}</ol>
        </section>
      )}
    </Drawer>
  );
}

function addMonths(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
