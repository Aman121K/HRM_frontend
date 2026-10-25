"use client";
import { ArrowRight, Calculator, ChevronRight, FileText, Receipt, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { shortDate } from "@/lib/cases";
import { payrollApi, errorText, inr, inrShort, shortMonth, type Meta, type MyPayroll } from "./api";
import { ACCENT, Badge, ErrorState, Note, SensitiveValue, TaxCard } from "./ui";

export function EmployeePayroll() {
  const [data, setData] = useState<MyPayroll | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { const [me, m] = await Promise.all([payrollApi.me(), payrollApi.meta()]); setData(me); setMeta(m); }
    catch (reason) { setError(errorText(reason, "Unable to load your payroll.")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="cw-page pe-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (!data) return <div className="cw-page pe-page"><div className="cw-hero-skeleton" aria-label="Loading" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /></div></div>;

  const latest = data.payslips[0];
  const s = data.structure;
  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero pe-me-hero">
        <span className="cw-hero-icon"><WalletCards size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAY &amp; TAX · FY {data.fiscalYear}</p>
          <h1>My payroll</h1>
          <p>Your payslips, salary structure, year-to-date totals and income-tax projection — straight from published payroll.</p>
        </div>
        {latest && (
          <Link className="pe-latest" href={`/payroll/payslips/${latest.period}`}>
            <small>{latest.label} · net pay</small>
            <b>{inr(latest.net)}</b>
            <span>View payslip <ArrowRight size={14} /></span>
          </Link>
        )}
      </header>
      {meta?.viewer.canManage && <p className="pe-admin-links"><Link href="/payroll/admin"><Calculator size={14} /> Payroll runs</Link><Link href="/payroll/structures"><WalletCards size={14} /> Salary structures</Link></p>}

      <section className="cw-stats" aria-label="Year to date">
        <article className="attention"><small>Net pay · YTD</small><b>{inrShort(data.ytd.net)}</b><span>{data.ytd.months} payslip{data.ytd.months === 1 ? "" : "s"} this FY</span></article>
        <article><small>Gross · YTD</small><b>{inrShort(data.ytd.gross)}</b><span>reimbursed {inr(data.ytd.reimbursements)}</span></article>
        <article><small>Tax deducted · YTD</small><b>{inrShort(data.ytd.tds)}</b><span>{data.taxProjection ? `of ${inr(data.taxProjection.annualLiability)} projected` : "no projection yet"}</span></article>
        <article><small>Provident fund · YTD</small><b>{inrShort(data.ytd.pf)}</b><span>your 12% share (employer adds the same)</span></article>
      </section>

      {!data.payslips.length ? (
        <div className="cw-empty">
          <span><FileText size={26} /></span>
          <h2>No payslips yet</h2>
          <p>Your payslip appears here as soon as payroll for the month is published. You&apos;ll get a notification.</p>
        </div>
      ) : (
        <div className="pe-me-grid">
          <section className="pe-card">
            <header className="pe-card-head"><h2>Payslips</h2><span>{data.payslips.length} published</span></header>
            {data.payslips.length > 1 && <NetChart slips={[...data.payslips].slice(0, 12).reverse()} />}
            <ul className="pe-slips">
              {data.payslips.map((slip) => (
                <li key={slip.id}>
                  <Link href={`/payroll/payslips/${slip.period}`}>
                    <span className="pe-slip-icon"><Receipt size={17} /></span>
                    <span className="pe-slip-main"><b>{slip.label}</b><small>{slip.payableDays !== null ? `${slip.payableDays} payable days${slip.lopDays ? ` · ${slip.lopDays} LOP` : ""}` : "Summary only"} · published {shortDate(slip.publishedAt)}</small></span>
                    <span className="num"><small>Gross</small>{inr(slip.gross)}</span>
                    <span className="num"><small>Deductions</small>{inr(slip.deductions)}</span>
                    <span className="num pe-net-cell"><small>Net</small>{inr(slip.net)}</span>
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <aside className="pe-side">
            {data.taxProjection && <TaxCard tax={data.taxProjection} title={`Tax projection · as of ${shortMonth(data.taxProjection.period)}`} />}
            {s && (
              <section className="pe-card">
                <header className="pe-card-head"><h2>Salary structure</h2><Badge tone="success" label={`from ${shortDate(s.effectiveFrom)}`} /></header>
                <p className="pe-ctc"><small>Annual CTC</small><b>{inr(s.annualCtc)}</b></p>
                <table className="pe-components compact">
                  <caption className="sr-only">Monthly salary components</caption>
                  <tbody>
                    {s.components.filter((item) => item.kind === "EARNING" && item.monthly > 0).map((item) => <tr key={item.code}><th scope="row">{item.label}</th><td className="num">{inr(item.monthly)}</td></tr>)}
                    <tr className="pe-subtotal"><th scope="row">Monthly gross</th><td className="num">{inr(s.fixedMonthlyGross)}</td></tr>
                    {s.components.filter((item) => item.kind !== "EARNING" && item.annual > 0).map((item) => <tr key={item.code}><th scope="row">{item.label}</th><td className="num">{item.kind === "VARIABLE" ? `${inr(item.annual)}/yr` : inr(item.monthly)}</td></tr>)}
                  </tbody>
                </table>
              </section>
            )}
            <section className="pe-card pe-profile-card">
              <header className="pe-card-head"><h2>Payroll details</h2></header>
              <dl>
                <div><dt>PAN</dt><dd><SensitiveValue employeeId={data.employee.id} field="pan" masked={data.profile.pan} /></dd></div>
                <div><dt>UAN</dt><dd><SensitiveValue employeeId={data.employee.id} field="uan" masked={data.profile.uan} /></dd></div>
                <div><dt>Bank</dt><dd>{data.profile.bankAccount ? <>{data.profile.bankName || "Bank"} · <SensitiveValue employeeId={data.employee.id} field="bankAccount" masked={data.profile.bankAccount} /></> : "Not on file"}</dd></div>
                <div><dt>Tax regime</dt><dd>{data.profile.taxRegime === "OLD" ? "Old regime" : "New regime"}</dd></div>
              </dl>
              <Note>Something wrong? Raise a Helpdesk ticket with Payroll. <Link href="/payroll/tax">Tax declarations</Link></Note>
            </section>
          </aside>
        </div>
      )}
      <p className="pe-footnote"><Link href="/payroll/returns/documents">Tax documents (Form 130 / Form 16, TDS summary) →</Link> · <Link href="/hris/import/previous-payslips">Payslips from your previous payroll system →</Link></p>
      <p className="pe-footnote">{data.disclaimer}</p>
    </div>
  );
}

function NetChart({ slips }: { slips: MyPayroll["payslips"] }) {
  const max = Math.max(...slips.map((slip) => slip.gross), 1);
  const w = 560, h = 120, step = w / slips.length, bar = Math.min(34, step - 12);
  return (
    <figure className="pe-chart pe-chart-small">
      <figcaption><span><i className="k-net" /> Net pay <i className="k-ded" /> Deductions</span></figcaption>
      <svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label="Net pay and deductions by month">
        <title>Net pay and deductions by month</title>
        {slips.map((slip, i) => {
          const x = i * step + (step - bar) / 2;
          const netH = (Math.max(0, slip.net) / max) * (h - 10), dedH = (slip.deductions / max) * (h - 10);
          return (
            <g key={slip.id}>
              <rect x={x} y={h - netH} width={bar} height={netH} className="net"><title>{`${slip.label}: net ${inr(slip.net)}`}</title></rect>
              <rect x={x} y={h - netH - dedH} width={bar} height={dedH} className="ded"><title>{`${slip.label}: deductions ${inr(slip.deductions)}`}</title></rect>
              <text x={x + bar / 2} y={h + 15} textAnchor="middle">{shortMonth(slip.period)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
