"use client";
import { AlertTriangle, ArrowLeft, Banknote, ChevronRight, Download, FileSpreadsheet, FileText, Landmark, Loader2, Lock, Pause, Play, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadFile } from "@/lib/http-client";
import { initials, relativeTime, shortDate } from "@/lib/cases";
import { payrollApi, errorText, inr, inrShort, FLAG_LABELS, STATE_NAMES, type LineDetail, type RunAction, type RunDetail, type RunLine } from "./api";
import { ACCENT, Badge, BreakdownTables, Disclaimer, Drawer, ErrorState, FlagChips, Note, PermissionState, RunBadge, RunStepper, TaxCard } from "./ui";

type Tab = "employees" | "inputs" | "exports" | "activity";
type Filter = "all" | "flagged" | "held" | "excluded" | string;

export function RunReview({ id }: { id: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>("employees");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [openEmployee, setOpenEmployee] = useState<string | null>(null);
  const [pending, setPending] = useState<RunAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [addingInput, setAddingInput] = useState(false);

  const load = useCallback(async () => {
    try { setRun(await payrollApi.run(id)); setError(""); }
    catch (reason: any) { if (reason?.status === 403) setForbidden(true); else setError(errorText(reason, "Unable to load this run.")); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3400); };

  const lines = run?.lines || [];
  const counts = useMemo(() => {
    const byFlag: Record<string, number> = {};
    for (const line of lines) for (const flag of line.flags) byFlag[flag.code] = (byFlag[flag.code] || 0) + 1;
    return { flagged: lines.filter((line) => line.flags.some((flag) => flag.code !== "HELD")).length, held: lines.filter((line) => line.held).length, excluded: lines.filter((line) => line.status === "EXCLUDED").length, byFlag };
  }, [lines]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lines.filter((line) => {
      if (filter === "flagged" && !line.flags.some((flag) => flag.code !== "HELD")) return false;
      if (filter === "held" && !line.held) return false;
      if (filter === "excluded" && line.status !== "EXCLUDED") return false;
      if (!["all", "flagged", "held", "excluded"].includes(filter) && !line.flags.some((flag) => flag.code === filter)) return false;
      return !term || `${line.name} ${line.number} ${line.department || ""} ${line.location || ""}`.toLowerCase().includes(term);
    });
  }, [lines, filter, search]);

  if (forbidden) return <div className="cw-page pe-page"><PermissionState title="Payroll runs are restricted" body="Only payroll and HR administrators can review payroll runs." /></div>;
  if (error && !run) return <div className="cw-page pe-page"><ErrorState message={error} onRetry={load} /></div>;
  if (!run) return <div className="cw-page pe-page"><div className="cw-hero-skeleton" aria-label="Loading" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /><i /></div></div>;

  const t = run.totals;
  const act = async (action: RunAction, withNote = "") => {
    if (action.disabledReason) return;
    if (action.noteRequired && !withNote.trim()) { setActionError("Please add a note for this action."); return; }
    setBusy(true); setActionError("");
    try {
      if (action.action === "calculate") { await payrollApi.calculate(run.id, run.version); flash("Payroll calculated for every employee"); }
      else { const next = await payrollApi.transition(run.id, { action: action.action, version: run.version, note: withNote.trim() || undefined }); flash(`${run.label}: ${action.label.toLowerCase()} — now ${next.status.toLowerCase()}`); }
      setPending(null); setNote("");
      await load();
    } catch (reason) { setActionError(errorText(reason, "That action failed.")); await load(); } finally { setBusy(false); }
  };
  const start = (action: RunAction) => {
    setActionError("");
    if (action.noteRequired || ["publish", "approve", "lock", "cancel"].includes(action.action)) { setPending(action); setNote(""); return; }
    act(action);
  };
  const confirmText: Record<string, string> = {
    publish: `Publish ${t.payable || 0} payslips (net ${inr(t.net)})? Employees are notified and the payslips become visible to them.${t.held ? ` ${t.held} held salar${t.held === 1 ? "y stays" : "ies stay"} unpublished until released.` : ""}`,
    approve: `Approve ${run.label} payroll: ${t.payable || 0} employees, net ${inr(t.net)}, employer cost ${inr(t.employerCost)}.`,
    lock: "Lock this period? Nothing in the run can change afterwards and held salaries can no longer be released through it.",
    cancel: "Cancel this run? Inputs are voided and expense claims become available to a new run.",
    reject: "Send the run back to the maker for changes.",
  };

  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/payroll/admin" className="pe-back"><ArrowLeft size={15} /> All payroll runs</Link>
      <header className="cw-hero pe-run-hero">
        <span className="cw-hero-icon"><Banknote size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAYROLL RUN · PAY DATE {shortDate(run.payDate).toUpperCase()}</p>
          <h1>{run.label}</h1>
          <p className="pe-hero-meta"><RunBadge status={run.status} />
            {run.people.submittedBy && <span>Submitted by <b>{run.people.submittedBy}</b></span>}
            {run.people.approvedBy && <span>Approved by <b>{run.people.approvedBy}</b></span>}
            {run.people.publishedBy && <span>Published by <b>{run.people.publishedBy}</b> {run.people.publishedAt ? relativeTime(run.people.publishedAt) : ""}</span>}
            {run.rulesetVersion && <span>Rules <code>{run.rulesetVersion}</code></span>}
          </p>
        </div>
      </header>

      <RunStepper steps={run.steps} status={run.status} />

      {run.status === "CANCELLED" && <p className="cw-alert" role="status"><X size={15} /> Cancelled by {run.people.cancelledBy}: {run.people.cancelReason}</p>}
      {run.needsRecalc && <p className="cw-alert warn" role="status"><RefreshCw size={15} /> Salary structures, profiles or inputs changed after the last calculation. Recalculate before submitting.</p>}
      {!!t.blocking && run.editable && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {t.blocking} employee{t.blocking === 1 ? " has" : "s have"} a negative net pay — hold them or adjust their recoveries to submit.</p>}

      {!!run.actions.length && (
        <section className="cw-action-panel pe-actions" aria-label="Run actions">
          {!pending ? (
            <>
              <div className="cw-action-row">
                {run.actions.map((action) => (
                  <button key={action.action} disabled={busy || Boolean(action.disabledReason)} title={action.disabledReason}
                    className={`cw-btn ${action.intent === "primary" ? "primary" : action.intent === "danger" ? "danger" : "ghost"}`} onClick={() => start(action)}>
                    {busy && action.action === "calculate" ? <Loader2 size={15} className="spin" /> : action.action === "calculate" ? <RefreshCw size={15} /> : action.action === "lock" ? <Lock size={15} /> : null}
                    {action.label}
                  </button>
                ))}
              </div>
              {run.actions.filter((action) => action.disabledReason).map((action) => <p key={action.action} className="pe-note"><AlertTriangle size={13} /> <span>{action.label}: {action.disabledReason}</span></p>)}
            </>
          ) : (
            <form className="cw-action-form" onSubmit={(event) => { event.preventDefault(); act(pending, note); }}>
              <b>{pending.label}</b>
              <p className="cw-head-note">{confirmText[pending.action] || ""}</p>
              {(pending.noteRequired || pending.action !== "publish") && (
                <label className="cw-note">
                  <span>Note{pending.noteRequired ? <em> *</em> : <small> optional</small>}</span>
                  <textarea rows={3} value={note} required={pending.noteRequired} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Recorded in the run's activity" />
                </label>
              )}
              <div className="cw-action-row">
                <button type="button" className="cw-btn ghost" onClick={() => setPending(null)}>Back</button>
                <button disabled={busy} className={`cw-btn ${pending.intent === "danger" ? "danger" : "primary"}`}>{busy ? "Working…" : `Confirm · ${pending.label}`}</button>
              </div>
            </form>
          )}
          {actionError && <ErrorState message={actionError} />}
        </section>
      )}

      {run.status === "DRAFT" ? (
        <div className="cw-empty">
          <span><Play size={26} /></span>
          <h2>Ready to calculate</h2>
          <p>Add one-time earnings, deductions or manual LOP in the Inputs tab, then calculate. Approved unpaid leave and approved expense claims are picked up automatically.</p>
          <div className="pe-row-actions">
            <button className="cw-btn ghost" onClick={() => { setTab("inputs"); setAddingInput(true); }}><Plus size={15} /> Add input</button>
            <button className="cw-btn primary" disabled={busy} onClick={() => act({ action: "calculate", label: "Calculate", intent: "primary" })}>{busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Calculate payroll</button>
          </div>
        </div>
      ) : (
        <>
          <section className="cw-stats pe-totals" aria-label="Run totals">
            <article className="attention"><small>Net pay</small><b>{inrShort(t.net)}</b><span>{t.payable} employees{t.held ? ` · ${t.held} held` : ""}{t.excluded ? ` · ${t.excluded} excluded` : ""}</span></article>
            <article><small>Gross earnings</small><b>{inrShort(t.gross)}</b><span>+ {inr(t.reimbursements)} reimbursements</span></article>
            <article><small>Deductions</small><b>{inrShort(t.deductions)}</b><span>TDS {inrShort(t.tds)} · PT {inrShort(t.pt)}</span></article>
            <article><small>Employer cost</small><b>{inrShort(t.employerCost)}</b><span>PF {inrShort(t.pfEmployer)} · ESI {inrShort(t.esiEmployer)}</span></article>
          </section>
          <section className="pe-statutory" aria-label="Statutory totals">
            <div><small>PF · employee + employer</small><b>{inr((t.pfEmployee || 0) + (t.pfEmployer || 0))}</b></div>
            <div><small>ESI · employee + employer</small><b>{inr((t.esiEmployee || 0) + (t.esiEmployer || 0))}</b></div>
            <div><small>Professional tax</small><b>{inr(t.pt)}</b></div>
            <div><small>TDS (s.192)</small><b>{inr(t.tds)}</b></div>
            <div><small>Loss-of-pay days</small><b>{t.lopDays || 0}</b></div>
            <div><small>Needs review</small><b className={t.flagged ? "warn" : ""}>{t.flagged || 0}</b></div>
          </section>
        </>
      )}

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Run sections">
          {([["employees", `Employees · ${lines.length}`], ["inputs", `Inputs · ${run.inputs.length}`], ["exports", "Exports"], ["activity", "Activity"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {tab === "employees" && (
          <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" aria-label="Search employees" />{search && <button aria-label="Clear" onClick={() => setSearch("")}><X size={13} /></button>}</label>
        )}
      </div>

      {tab === "employees" && (
        <>
          <div className="cw-chips" aria-label="Filter employees">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <b>{lines.length}</b></button>
            <button className={filter === "flagged" ? "active" : ""} onClick={() => setFilter("flagged")}><i className="dot tone-warning" />Needs review <b>{counts.flagged}</b></button>
            {!!counts.held && <button className={filter === "held" ? "active" : ""} onClick={() => setFilter("held")}><i className="dot tone-warning" />On hold <b>{counts.held}</b></button>}
            {!!counts.excluded && <button className={filter === "excluded" ? "active" : ""} onClick={() => setFilter("excluded")}><i className="dot tone-danger" />Excluded <b>{counts.excluded}</b></button>}
            {Object.entries(counts.byFlag).filter(([code]) => code !== "HELD").map(([code, count]) => (
              <button key={code} className={filter === code ? "active" : ""} onClick={() => setFilter(filter === code ? "all" : code)}>{FLAG_LABELS[code] || code} <b>{count}</b></button>
            ))}
          </div>
          {!lines.length ? <div className="cw-empty"><span><Search size={24} /></span><h2>No employees calculated yet</h2><p>Calculate the run to see every employee's pay.</p></div>
            : !visible.length ? <div className="cw-empty"><span><Search size={24} /></span><h2>No matches</h2><p>Try a different search or filter.</p></div>
            : <ReviewTable lines={visible} onOpen={setOpenEmployee} />}
        </>
      )}
      {tab === "inputs" && <InputsTab run={run} adding={addingInput} setAdding={setAddingInput} onChanged={async (message) => { flash(message); await load(); }} />}
      {tab === "exports" && <ExportsTab run={run} onError={setActionError} />}
      {tab === "activity" && <ActivityTab run={run} />}

      {openEmployee && <LineDrawer run={run} employeeId={openEmployee} onClose={() => setOpenEmployee(null)} onChanged={async (message) => { flash(message); await load(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ReviewTable({ lines, onOpen }: { lines: RunLine[]; onOpen: (id: string) => void }) {
  const sum = (key: keyof RunLine) => lines.filter((line) => line.status === "INCLUDED" && !line.held).reduce((total, line) => total + Number(line[key] || 0), 0);
  return (
    <div className="cw-table pe-review" role="table" aria-label="Employee pay review">
      <div className="cw-row head" role="row">
        <span role="columnheader">Employee</span><span role="columnheader" className="num">Days</span><span role="columnheader" className="num">Gross</span>
        <span role="columnheader" className="num">PF · ESI · PT</span><span role="columnheader" className="num">TDS</span><span role="columnheader" className="num">Net pay</span>
        <span role="columnheader" className="num">vs last month</span><span role="columnheader">Flags</span><span />
      </div>
      {lines.map((line) => {
        const excluded = line.status === "EXCLUDED";
        return (
          <button key={line.employeeId} role="row" className={`cw-row ${line.flags.some((flag) => flag.tone === "danger") ? "pe-danger-row" : line.flags.some((flag) => flag.tone === "warning") ? "actionable" : ""} ${line.held || excluded ? "pe-dim" : ""}`} onClick={() => onOpen(line.employeeId)}>
            <span className="cw-person" role="cell"><span className="cw-avatar small">{initials(line.name)}</span><span>{line.name}<small>{line.number} · {line.designation || line.department}{line.state ? ` · ${line.state}` : ""}</small></span></span>
            <span role="cell" className="num">{excluded ? "—" : <>{line.payableDays}<small className="pe-muted">/{line.daysInMonth}</small>{line.lopDays ? <small className="pe-lop">−{line.lopDays} LOP</small> : null}</>}</span>
            <span role="cell" className="num">{excluded ? "—" : inr(line.gross)}{line.reimbursements ? <small className="pe-muted">+{inr(line.reimbursements)}</small> : null}</span>
            <span role="cell" className="num pe-stat-cell">{excluded ? "—" : `${inr(line.pf, "0")} · ${inr(line.esi, "0")} · ${inr(line.pt, "0")}`}</span>
            <span role="cell" className="num">{excluded ? "—" : inr(line.tds)}</span>
            <span role="cell" className={`num pe-net-cell ${line.net < 0 ? "neg" : ""}`}>{excluded ? "—" : inr(line.net)}</span>
            <span role="cell" className="num">{line.variancePct === null ? <span className="pe-muted">new</span> : <span className={Math.abs(line.variancePct) > 10 ? "pe-var warn" : "pe-var"}>{line.variancePct > 0 ? "▲" : line.variancePct < 0 ? "▼" : ""} {Math.abs(line.variancePct).toFixed(1)}%</span>}</span>
            <span role="cell"><FlagChips flags={line.flags} compact /></span>
            <span role="cell" className="cw-row-cta"><ChevronRight size={16} /></span>
          </button>
        );
      })}
      <div className="cw-row pe-foot" role="row">
        <span role="cell"><b>Total payable</b><small className="pe-muted"> excl. held &amp; excluded</small></span><span role="cell" />
        <span role="cell" className="num">{inr(sum("gross"))}</span>
        <span role="cell" className="num">{inr(sum("pf"))} · {inr(sum("esi"))} · {inr(sum("pt"))}</span>
        <span role="cell" className="num">{inr(sum("tds"))}</span>
        <span role="cell" className="num pe-net-cell">{inr(sum("net"))}</span><span role="cell" /><span role="cell" /><span />
      </div>
    </div>
  );
}

function LineDrawer({ run, employeeId, onClose, onChanged }: { run: RunDetail; employeeId: string; onClose: () => void; onChanged: (message: string) => Promise<void> }) {
  const [line, setLine] = useState<LineDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holding, setHolding] = useState(false);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    try { setLine(await payrollApi.line(run.id, employeeId)); setError(""); } catch (reason) { setError(errorText(reason, "Unable to load this employee.")); }
  }, [run.id, employeeId]);
  useEffect(() => { load(); }, [load, run.version]);
  const summary = run.lines.find((item) => item.employeeId === employeeId);
  const b = line?.breakdown;
  const canHold = run.editable && line?.status === "INCLUDED";
  const canRelease = line?.held && (run.editable || run.status === "PUBLISHED");

  const toggleHold = async (hold: boolean) => {
    setBusy(true); setError("");
    try {
      const result = await payrollApi.hold(run.id, employeeId, { hold, reason: hold ? holdReason.trim() : undefined });
      setHolding(false); setHoldReason("");
      await onChanged(hold ? `${line?.name}'s salary is on hold` : result.released ? `${line?.name}'s payslip released and published` : `${line?.name} is back in the run`);
      await load();
    } catch (reason) { setError(errorText(reason, "Unable to change the hold.")); } finally { setBusy(false); }
  };
  const removeInput = async (inputId: string) => {
    setBusy(true); setError("");
    try { await payrollApi.removeInput(run.id, inputId); await onChanged("Input removed — recalculate to apply"); await load(); }
    catch (reason) { setError(errorText(reason, "Unable to remove the input.")); } finally { setBusy(false); }
  };

  return (
    <Drawer wide title={summary?.name || "Employee"} eyebrow={`${summary?.number || ""} · ${run.label.toUpperCase()}`} onClose={onClose}
      head={summary && <div className="cw-head-meta">
        {summary.status === "EXCLUDED" ? <Badge tone="danger" label="Excluded" /> : summary.held ? <Badge tone="warning" label="On hold" /> : summary.publishedAt ? <Badge tone="success" label="Payslip published" /> : <Badge tone="info" label="Included" />}
        <span>{summary.designation || "—"} · {summary.department || "—"}</span>
        {summary.status === "INCLUDED" && <span>Net <b>{inr(summary.net)}</b></span>}
      </div>}>
      {error && <ErrorState message={error} onRetry={load} />}
      {!line && !error && <div className="cw-skeleton" aria-label="Loading"><i /><i /><i /></div>}
      {line && b && (
        <>
          {!!line.flags.length && (
            <ul className="pe-flag-list" aria-label="Review flags">
              {line.flags.map((flag) => <li key={flag.code} className={`tone-${flag.tone === "danger" ? "danger" : flag.tone === "warning" ? "warning" : "info"}`}><b>{FLAG_LABELS[flag.code] || flag.code}</b> {flag.message}</li>)}
            </ul>
          )}

          {(canHold || canRelease) && (
            <section className="cw-action-panel">
              {!holding ? (
                <div className="cw-action-row">
                  {canHold && !line.held && <button className="cw-btn ghost" disabled={busy} onClick={() => setHolding(true)}><Pause size={15} /> Hold salary</button>}
                  {canRelease && <button className="cw-btn primary" disabled={busy} onClick={() => toggleHold(false)}><Play size={15} /> {run.status === "PUBLISHED" ? "Release & publish payslip" : "Remove hold"}</button>}
                  {run.editable && <button className="cw-btn ghost" disabled={busy} onClick={() => setAdding(true)}><Plus size={15} /> Add input</button>}
                </div>
              ) : (
                <form className="cw-action-form" onSubmit={(event) => { event.preventDefault(); toggleHold(true); }}>
                  <b>Hold {line.name}&apos;s salary</b>
                  <p className="cw-head-note">A held salary is left out of the bank file and is not published. You can release it later — even after the run is published.</p>
                  <label className="cw-note"><span>Reason <em>*</em></span><textarea rows={2} required maxLength={300} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="e.g. Bank details under verification" /></label>
                  <div className="cw-action-row"><button type="button" className="cw-btn ghost" onClick={() => setHolding(false)}>Back</button><button className="cw-btn primary" disabled={busy || !holdReason.trim()}>Confirm hold</button></div>
                </form>
              )}
            </section>
          )}
          {!canHold && !canRelease && run.editable && <div className="cw-action-row pe-left"><button className="cw-btn ghost" onClick={() => setAdding(true)}><Plus size={15} /> Add input</button></div>}
          {adding && <InputForm run={run} employeeId={employeeId} onCancel={() => setAdding(false)} onSaved={async (message) => { setAdding(false); await onChanged(message); await load(); }} />}

          <dl className="cw-facts">
            <div><dt>Payable days</dt><dd>{b.days.payableDays} of {b.days.daysInMonth}<small>{b.days.lopDays ? `${b.days.lopDays} LOP` : "no LOP"}{b.days.employedDays < b.days.daysInMonth ? ` · employed ${b.days.employedDays} days` : ""}</small></dd></div>
            <div><dt>Salary structure</dt><dd>{b.structure ? <>{inr(b.structure.annualCtc)} CTC<small>effective {shortDate(b.structure.effectiveFrom)} · gross {inr(b.structure.fixedMonthlyGross)}/mo</small></> : "None in effect"}</dd></div>
            <div><dt>PT state</dt><dd>{STATE_NAMES[b.employee.state] || b.employee.state}<small>from {b.employee.stateSource}</small></dd></div>
            <div><dt>Tax regime</dt><dd>{b.employee.regime === "OLD" ? "Old regime" : "New regime"}<small>PAN {b.employee.pan || "missing"}</small></dd></div>
            <div><dt>Bank</dt><dd>{b.employee.bank || "Not on file"}</dd></div>
            <div><dt>Previous month</dt><dd>{line.previousNet === null ? "No earlier payslip" : inr(line.previousNet)}{line.variancePct !== null && <small>{line.variancePct > 0 ? "+" : ""}{line.variancePct.toFixed(1)}% change</small>}</dd></div>
          </dl>

          {b.totals && <BreakdownTables breakdown={b} />}

          {b.statutory && (
            <section className="pe-statutory-detail">
              <p className="cw-section-label">How statutory amounts were worked out</p>
              <ul>
                <li><b>PF</b> {b.statutory.pf.applicable ? <>PF wage {inr(b.statutory.pf.pfWage)} → employee {inr(b.statutory.pf.employee)}; employer EPS {inr(b.statutory.pf.employerEps)} + EPF {inr(b.statutory.pf.employerEpf)}; EDLI {inr(b.statutory.pf.edli)}, admin {inr(b.statutory.pf.admin)}.</> : "Not applicable (excluded employee)."}</li>
                <li><b>ESI</b> {b.statutory.esi.covered ? <>{b.statutory.esi.reason}. On wages {inr(b.statutory.esi.wages)}: employee {inr(b.statutory.esi.employee)}{b.statutory.esi.lowWageExempt ? " (low-wage exempt)" : ""}, employer {inr(b.statutory.esi.employer)}.</> : <>Not covered — rate of wages {inr(b.statutory.esi.rateOfWages)} is above ₹21,000.</>}</li>
                <li><b>Professional tax</b> {b.statutory.pt.stateName}: {inr(b.statutory.pt.amount)}. <span className="pe-muted">{b.statutory.pt.rule}</span></li>
              </ul>
            </section>
          )}
          {b.tax && <TaxCard tax={b.tax} />}

          {!!b.lopLeaves.length && (
            <section>
              <p className="cw-section-label">Approved unpaid leave this month</p>
              <ul className="pe-simple-list">{b.lopLeaves.map((leave) => <li key={leave.id}><b>{leave.type}</b> {shortDate(leave.startDate)} – {shortDate(leave.endDate)} <span>{leave.days} day{leave.days === 1 ? "" : "s"}</span></li>)}</ul>
            </section>
          )}
          <section>
            <p className="cw-section-label">Inputs for this run</p>
            {!line.inputs.length ? <p className="pe-muted">No one-time earnings, deductions or manual LOP.</p> : (
              <ul className="pe-simple-list">
                {line.inputs.map((input) => (
                  <li key={input.id}>
                    <b>{input.label}</b> <small className="pe-muted">{input.kind.toLowerCase()}{input.source === "EXPENSE_CLAIM" ? " · expense claim" : ""}{input.kind === "EARNING" && !input.taxable ? " · non-taxable" : ""}</small>
                    <span>{input.kind === "LOP" ? `${input.days} day${input.days === 1 ? "" : "s"}` : inr(input.amount)}</span>
                    {run.editable && <button className="cw-icon-button" aria-label={`Remove ${input.label}`} disabled={busy} onClick={() => removeInput(input.id)}><Trash2 size={14} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {line.publishedAt && <Link className="cw-btn ghost" href={`/payroll/payslips/${run.period}?employeeId=${employeeId}`}><FileText size={15} /> View published payslip</Link>}
        </>
      )}
      {line && !b?.totals && line.status === "EXCLUDED" && (
        <div className="cw-empty"><span><AlertTriangle size={24} /></span><h2>No salary structure</h2><p>Add a structure effective on or before this month, then recalculate.</p><Link className="cw-btn primary" href={`/payroll/structures?employee=${employeeId}`}>Open salary structures</Link></div>
      )}
    </Drawer>
  );
}

function InputForm({ run, employeeId, onCancel, onSaved }: { run: RunDetail; employeeId?: string; onCancel: () => void; onSaved: (message: string) => Promise<void> }) {
  const codes = Object.entries(run.inputCodes);
  const [employee, setEmployee] = useState(employeeId || "");
  const [code, setCode] = useState("BONUS");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const def = run.inputCodes[code];
  useEffect(() => { setTaxable(def?.taxable ?? true); }, [code, def]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const value = Number(amount);
      await payrollApi.addInput(run.id, { employeeId: employee, code, label: label.trim() || undefined, ...(def.kind === "LOP" ? { days: value } : { amount: value }), ...(def.kind === "EARNING" ? { taxable } : {}), note: note.trim() || undefined });
      await onSaved(`${label.trim() || def.label} added — recalculate to apply`);
    } catch (reason) { setError(errorText(reason, "Unable to add the input.")); } finally { setBusy(false); }
  };
  const groups = [["EARNING", "One-time earnings"], ["REIMBURSEMENT", "Reimbursements"], ["DEDUCTION", "Deductions"], ["LOP", "Loss of pay"]];
  return (
    <form className="cw-action-panel cw-action-form" onSubmit={submit}>
      <b>Add a one-time input</b>
      {error && <ErrorState message={error} />}
      <div className="cw-fields">
        {!employeeId && (
          <label className="wide"><span>Employee <em>*</em></span>
            <select required value={employee} onChange={(event) => setEmployee(event.target.value)}>
              <option value="">Choose an employee</option>
              {run.lines.map((line) => <option key={line.employeeId} value={line.employeeId}>{line.name} · {line.number}</option>)}
            </select>
          </label>
        )}
        <label><span>Type <em>*</em></span>
          <select value={code} onChange={(event) => setCode(event.target.value)}>
            {groups.map(([kind, name]) => <optgroup key={kind} label={name}>{codes.filter(([, item]) => item.kind === kind).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</optgroup>)}
          </select>
        </label>
        <label><span>{def?.kind === "LOP" ? "LOP days" : "Amount (₹)"} <em>*</em></span>
          <input required type="number" min={def?.kind === "LOP" ? 0.5 : 1} step={def?.kind === "LOP" ? 0.5 : 1} max={def?.kind === "LOP" ? 31 : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="wide"><span>Label on payslip <small>optional</small></span><input maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={def?.label} /></label>
        {def?.kind === "EARNING" && <label className="wide pe-check"><input type="checkbox" checked={taxable} onChange={(event) => setTaxable(event.target.checked)} /><span>Taxable — include in the TDS projection</span></label>}
        <label className="wide"><span>Internal note <small>optional</small></span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      <p className="pe-note">{def?.kind === "EARNING" ? (def.esiWage ? "Counts as wages for ESI; tax on it is deducted in full this month." : "Excluded from ESI wages (bonus); tax on it is deducted in full this month.") : def?.kind === "LOP" ? "Added to approved unpaid leave; pay is prorated by calendar days." : def?.kind === "REIMBURSEMENT" ? "Paid with salary; not taxable and not part of PF/ESI wages." : "Deducted from net pay after tax."}</p>
      <div className="cw-action-row"><button type="button" className="cw-btn ghost" onClick={onCancel}>Cancel</button><button className="cw-btn primary" disabled={busy || !employee || !amount}>{busy ? "Adding…" : "Add input"}</button></div>
    </form>
  );
}

function InputsTab({ run, adding, setAdding, onChanged }: { run: RunDetail; adding: boolean; setAdding: (value: boolean) => void; onChanged: (message: string) => Promise<void> }) {
  const [error, setError] = useState("");
  const remove = async (inputId: string) => {
    setError("");
    try { await payrollApi.removeInput(run.id, inputId); await onChanged("Input removed — recalculate to apply"); } catch (reason) { setError(errorText(reason, "Unable to remove the input.")); }
  };
  return (
    <div className="pe-tab">
      {error && <ErrorState message={error} />}
      {run.editable && !adding && <div className="pe-row-actions"><button className="cw-btn primary" onClick={() => setAdding(true)}><Plus size={15} /> Add input</button></div>}
      {adding && <InputForm run={run} onCancel={() => setAdding(false)} onSaved={async (message) => { setAdding(false); await onChanged(message); }} />}
      {!run.editable && <Note>Inputs are frozen once the run is submitted. Send it back to change them.</Note>}
      {!run.inputs.length ? (
        <div className="cw-empty"><span><Plus size={24} /></span><h2>No inputs</h2><p>One-time bonuses, arrears, incentives, recoveries, reimbursements and manual LOP appear here. Approved expense claims are added automatically when the run is calculated.</p></div>
      ) : (
        <div className="cw-table pe-inputs" role="table" aria-label="Run inputs">
          <div className="cw-row head" role="row"><span role="columnheader">Employee</span><span role="columnheader">Input</span><span role="columnheader">Type</span><span role="columnheader" className="num">Amount</span><span role="columnheader">Added by</span><span /></div>
          {run.inputs.map((input) => (
            <div key={input.id} className="cw-row" role="row">
              <span className="cw-person" role="cell"><span className="cw-avatar small">{initials(input.employeeName)}</span><span>{input.employeeName}<small>{input.employeeNumber}</small></span></span>
              <span className="cw-title-cell" role="cell"><b>{input.label}</b>{input.note && <small>{input.note}</small>}</span>
              <span role="cell"><Badge tone={input.kind === "DEDUCTION" ? "danger" : input.kind === "LOP" ? "warning" : input.kind === "REIMBURSEMENT" ? "success" : "info"} label={`${input.kind.toLowerCase()}${input.source === "EXPENSE_CLAIM" ? " · claim" : ""}`} /></span>
              <span role="cell" className="num">{input.kind === "LOP" ? `${input.days} d` : inr(input.amount)}</span>
              <span role="cell" className="pe-muted">{input.source === "EXPENSE_CLAIM" ? "Expense claims" : input.createdBy} · {relativeTime(input.createdAt)}</span>
              <span role="cell" className="cw-row-cta">{run.editable && <button className="cw-icon-button" aria-label={`Remove ${input.label}`} onClick={() => remove(input.id)}><Trash2 size={14} /></button>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EXPORTS = [
  { kind: "bank", title: "Bank transfer file", body: "Beneficiary, account, IFSC and net amount for every payable employee with bank details (held salaries excluded).", icon: Landmark, when: ["APPROVED", "PUBLISHED", "LOCKED"] },
  { kind: "register", title: "Payroll register", body: "Every employee with days, each earning and deduction, employer contributions, variance and flags.", icon: FileSpreadsheet },
  { kind: "pf-ecr", title: "PF ECR (text)", body: "EPFO ECR 2.0 layout: UAN, wages, EPF/EPS contributions and NCP days, #~# separated.", icon: FileText },
  { kind: "esi", title: "ESI contribution summary", body: "IP number, days paid, wages and employee/employer ESI for covered employees, with totals.", icon: FileText },
  { kind: "pt", title: "Professional tax summary", body: "Per-employee PT with a state-wise summary for the return.", icon: FileText },
];
function ExportsTab({ run, onError }: { run: RunDetail; onError: (message: string) => void }) {
  const [busy, setBusy] = useState("");
  const calculated = !["DRAFT", "CANCELLED"].includes(run.status);
  const get = async (kind: string) => {
    setBusy(kind);
    try { await downloadFile(payrollApi.exportPath(run.id, kind), `${kind}-${run.period}.csv`); } catch (reason) { onError(errorText(reason, "Download failed.")); } finally { setBusy(""); }
  };
  return (
    <div className="pe-export-grid">
      {EXPORTS.map((item) => {
        const Icon = item.icon;
        // The bank file follows the server's segregation-of-duties rule (approved run, payroll admin/owner, not the preparer).
        const bankBlocked = item.kind === "bank" && run.bankFile && !run.bankFile.allowed ? run.bankFile.reason : null;
        const available = calculated && (!item.when || item.when.includes(run.status)) && !bankBlocked;
        return (
          <article key={item.kind} className="pe-export">
            <span className="pe-export-icon"><Icon size={20} /></span>
            <div><h3>{item.title}</h3><p>{item.body}</p>{!available && <small>{!calculated ? "Calculate the run first." : bankBlocked || "Available once the run is approved."}</small>}</div>
            <button className="cw-btn ghost" disabled={!available || busy === item.kind} onClick={() => get(item.kind)}>{busy === item.kind ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Download</button>
          </article>
        );
      })}
    </div>
  );
}

const ACTION_TEXT: Record<string, string> = {
  PAYROLL_RUN_CREATED: "created the run", PAYROLL_RUN_CALCULATED: "calculated payroll", PAYROLL_RUN_RECALCULATED: "recalculated payroll", PAYROLL_RUN_SUBMIT: "submitted for approval",
  PAYROLL_RUN_APPROVE: "approved the run", PAYROLL_RUN_REJECT: "sent the run back", PAYROLL_RUN_REOPEN: "reopened the run", PAYROLL_RUN_PUBLISH: "published payslips", PAYROLL_RUN_LOCK: "locked the period",
  PAYROLL_RUN_CANCEL: "cancelled the run", PAYROLL_INPUT_ADDED: "added an input", PAYROLL_INPUT_REMOVED: "removed an input", PAYROLL_LINE_HELD: "held a salary", PAYROLL_LINE_UNHELD: "removed a hold",
  PAYROLL_LINE_RELEASED: "released a held salary", PAYROLL_EXPORTED: "downloaded an export",
};
function ActivityTab({ run }: { run: RunDetail }) {
  if (!run.history.length) return <div className="cw-empty"><h2>No activity yet</h2></div>;
  return (
    <section className="cw-timeline pe-tab">
      <ol>
        {run.history.map((item) => (
          <li key={item.id}>
            <span className="cw-avatar small">{initials(item.actor || "System")}</span>
            <div>
              <p><b>{item.actor || "System"}</b> {ACTION_TEXT[item.action] || item.action.toLowerCase().replace(/_/g, " ")}<time dateTime={item.at}>{relativeTime(item.at)}</time></p>
              {item.data?.note && <blockquote>{item.data.note}</blockquote>}
              {item.data && (item.data.employee || item.data.kind || item.data.reason || item.data.net !== undefined) && (
                <small className="cw-event-data">{[item.data.employee, item.data.code, item.data.amount ? inr(item.data.amount) : null, item.data.days ? `${item.data.days} days` : null, item.data.kind, item.data.reason, item.data.net !== undefined ? `net ${inr(item.data.net)}` : null, item.data.employees !== undefined ? `${item.data.employees} employees` : null].filter(Boolean).join(" · ")}</small>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
