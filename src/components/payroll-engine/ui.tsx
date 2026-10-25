"use client";
import { AlertTriangle, Check, Eye, EyeOff, Info, Loader2, Lock, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { Breakdown, Flag, Line, PiiField, Tone } from "./api";
import { FLAG_LABELS, RUN_STATUS, STEP_LABELS, errorText, inr, payrollApi } from "./api";

export const ACCENT = "#0b615c";

export function Badge({ tone, label }: { tone: Tone | string; label: string }) {
  return <span className={`cw-badge tone-${tone}`}><i />{label}</span>;
}
export function RunBadge({ status }: { status: string }) {
  const meta = RUN_STATUS[status] || { label: status, tone: "neutral" };
  return <Badge tone={meta.tone} label={meta.label} />;
}

export function FlagChips({ flags, compact = false }: { flags: Flag[]; compact?: boolean }) {
  if (!flags.length) return compact ? <span className="pe-muted">—</span> : null;
  return (
    <span className="pe-flags">
      {flags.map((flag) => (
        <span key={flag.code} className={`pe-flag tone-${flag.tone === "danger" ? "danger" : flag.tone === "warning" ? "warning" : "info"}`} title={flag.message}>
          {FLAG_LABELS[flag.code] || flag.code}
        </span>
      ))}
    </span>
  );
}

export function RunStepper({ steps, status }: { steps: string[]; status: string }) {
  const index = steps.indexOf(status);
  const cancelled = status === "CANCELLED";
  return (
    <ol className={`cw-stepper pe-stepper ${cancelled ? "is-off" : ""}`} aria-label="Payroll run progress">
      {steps.map((step, i) => {
        const done = i < index || (status === "LOCKED" && i === index);
        return (
          <li key={step} className={done ? "done" : i === index ? "current" : ""} aria-current={i === index ? "step" : undefined}>
            <span>{done ? <Check size={12} /> : step === "LOCKED" ? <Lock size={11} /> : i + 1}</span>
            <small>{STEP_LABELS[step] || step}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function Disclaimer({ text, version }: { text: string; version?: string | null }) {
  return (
    <p className="cw-alert warn pe-disclaimer" role="note">
      <ShieldAlert size={15} />
      <span><b>Validate before real use.</b> {text}{version ? <> Rule set <code>{version}</code>.</> : null}</span>
    </p>
  );
}

export function PermissionState({ title, body }: { title: string; body: string }) {
  return (
    <div className="cw-empty">
      <span><Lock size={24} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="cw-btn ghost" href="/payroll">Go to my payroll</Link>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="cw-alert" role="alert">
      <AlertTriangle size={15} />
      <span>{message} {onRetry && <button className="pe-link" onClick={onRetry}>Try again</button>}</span>
    </div>
  );
}

/** Masked identifier with an audited "Show" (calls the reveal endpoint; the value is hidden again after 30 s). */
export function SensitiveValue({ employeeId, field, masked, empty = "Not on file" }: { employeeId: string; field: PiiField; masked: string | null; empty?: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setValue(null); }, [employeeId, field, masked]);
  useEffect(() => { if (!value) return; const timer = window.setTimeout(() => setValue(null), 30_000); return () => window.clearTimeout(timer); }, [value]);
  if (!masked) return <>{empty}</>;
  const toggle = async () => {
    if (value) { setValue(null); return; }
    setBusy(true); setError("");
    try { setValue((await payrollApi.reveal(employeeId, field)).value); } catch (reason) { setError(errorText(reason, "Unable to show")); } finally { setBusy(false); }
  };
  return (
    <span className="pe-sensitive">
      <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" }}>{value || masked}</span>{" "}
      <button type="button" className="cw-btn ghost" style={{ padding: "2px 8px", minHeight: 0, fontSize: 12 }} onClick={toggle} disabled={busy}
        aria-label={value ? "Hide full value" : "Show full value (this is recorded in the audit log)"} title={value ? "Hide" : "Show — viewing is recorded in the audit log"}>
        {busy ? <Loader2 size={13} className="spin" /> : value ? <EyeOff size={13} /> : <Eye size={13} />} {value ? "Hide" : "Show"}
      </button>
      {error && <small role="alert" style={{ color: "var(--danger, #b42318)", marginLeft: 6 }}>{error}</small>}
    </span>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="pe-note"><Info size={13} /> <span>{children}</span></p>;
}

function Rows({ items, showRate }: { items: Line[]; showRate?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <tr key={`${item.code}-${item.label}`}>
          <th scope="row">{item.label}{item.note && <small>{item.note}</small>}</th>
          {showRate && <td className="num pe-muted">{item.full !== undefined ? inr(item.full) : ""}</td>}
          <td className="num">{inr(item.amount)}</td>
        </tr>
      ))}
    </>
  );
}

/** Earnings / deductions / employer contribution tables shared by the run drill-down and the payslip. */
export function BreakdownTables({ breakdown }: { breakdown: Breakdown }) {
  const t = breakdown.totals;
  if (!t) return null;
  const earnings = [...(breakdown.earnings || []), ...(breakdown.oneTime || [])];
  return (
    <div className="pe-breakdown">
      <section className="pe-table-card">
        <header><h3>Earnings</h3><span>Rate · Earned</span></header>
        <table>
          <caption className="sr-only">Earnings</caption>
          <tbody><Rows items={earnings} showRate /></tbody>
          <tfoot><tr><th scope="row">Gross earnings</th><td /><td className="num">{inr(t.gross)}</td></tr></tfoot>
        </table>
        {!!breakdown.reimbursements?.length && (
          <table className="pe-sub">
            <caption>Reimbursements · not taxable</caption>
            <tbody><Rows items={breakdown.reimbursements} /></tbody>
          </table>
        )}
      </section>
      <section className="pe-table-card">
        <header><h3>Deductions</h3><span>This month</span></header>
        <table>
          <caption className="sr-only">Deductions</caption>
          <tbody>{breakdown.deductions?.length ? <Rows items={breakdown.deductions} /> : <tr><th scope="row" className="pe-muted">No deductions</th><td /></tr>}</tbody>
          <tfoot><tr><th scope="row">Total deductions</th><td className="num">{inr(t.deductions)}</td></tr></tfoot>
        </table>
      </section>
      <div className="pe-equation" aria-label="Net pay calculation">
        <div><small>Gross</small><b>{inr(t.gross)}</b></div><i>+</i>
        <div><small>Reimbursements</small><b>{inr(t.reimbursements)}</b></div><i>−</i>
        <div><small>Deductions</small><b>{inr(t.deductions)}</b></div><i>=</i>
        <div className={`pe-net ${t.net < 0 ? "neg" : ""}`}><small>Net pay</small><b>{inr(t.net)}</b></div>
      </div>
      {!!breakdown.employer?.length && (
        <section className="pe-table-card pe-employer">
          <header><h3>Employer contributions</h3><span>Not part of take-home</span></header>
          <table>
            <caption className="sr-only">Employer contributions</caption>
            <tbody><Rows items={breakdown.employer} /></tbody>
            <tfoot><tr><th scope="row">Cost to company this month</th><td className="num">{inr(t.employerCost)}</td></tr></tfoot>
          </table>
        </section>
      )}
    </div>
  );
}

export function TaxCard({ tax, title = "Income-tax projection" }: { tax: NonNullable<Breakdown["tax"]>; title?: string }) {
  const paid = tax.tdsDeductedSoFar + tax.monthlyTds;
  const pct = tax.annualLiability ? Math.min(100, Math.round((paid / tax.annualLiability) * 100)) : 100;
  return (
    <section className="pe-tax">
      <header>
        <h3>{title}</h3>
        <Badge tone="info" label={`${tax.regime === "OLD" ? "Old" : "New"} regime`} />
      </header>
      <div className="pe-tax-bar" role="img" aria-label={`${pct}% of the projected annual tax deducted`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <dl>
        <div><dt>Projected annual income</dt><dd>{inr(tax.projectedAnnualIncome)}</dd></div>
        <div><dt>Deductions &amp; exemptions</dt><dd>{inr(tax.standardDeduction + tax.exemptions + tax.deductions)}</dd></div>
        <div><dt>Taxable income</dt><dd>{inr(tax.taxableIncome)}</dd></div>
        <div><dt>Annual tax (incl. cess)</dt><dd><b>{inr(tax.annualLiability)}</b>{tax.rebate ? <small>after ₹{tax.rebate.toLocaleString("en-IN")} s.87A rebate</small> : null}{tax.marginalRelief ? <small>marginal relief {inr(tax.marginalRelief)}</small> : null}</dd></div>
        <div><dt>Deducted before this month</dt><dd>{inr(tax.tdsDeductedSoFar)}</dd></div>
        <div><dt>This month</dt><dd>{inr(tax.monthlyTds)}{tax.oneTimeTax ? <small>incl. {inr(tax.oneTimeTax)} on one-time pay</small> : null}</dd></div>
        <div className="wide"><dt>Still to deduct ({Math.max(0, tax.monthsRemaining - 1)} more months)</dt><dd>{inr(tax.remainingAfterThisMonth)}</dd></div>
      </dl>
    </section>
  );
}

export function Drawer({ title, eyebrow, onClose, children, wide, head }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode; wide?: boolean; head?: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  // Keep the focus trap stable while parents re-render with new inline onClose callbacks.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stableClose = useCallback(() => closeRef.current(), []);
  useDialogFocus(true, stableClose, ref);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className={`cw-drawer ${wide ? "pe-drawer-wide" : ""}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pe-drawer-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: ACCENT }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{eyebrow}</p>
          <h2 id="pe-drawer-title">{title}</h2>
          {head}
        </header>
        <div className="cw-drawer-body">{children}</div>
      </aside>
    </>
  );
}
