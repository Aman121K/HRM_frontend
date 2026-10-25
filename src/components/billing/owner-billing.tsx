"use client";
import { AlertTriangle, CreditCard, Download, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { MODULE_LABELS } from "@/components/org/platform-console";
import styles from "./billing.module.css";
import { day, inr, monthLabel, PAYMENT_LABEL, PAYMENT_TONE, type InvoiceRow } from "./format";
import { UsageChart } from "./usage-chart";

type Summary = {
  brand: { id: string; name: string; status: string };
  rule: string; liveCount: number;
  thisMonth: { day: string; count: number }[];
  months: { month: string; peak: number; average: number; days: number }[];
  viaGroup: { name: string; visible: boolean } | null;
  account: { kind: string; legalName: string; gstin: string | null; billingAddress: string; stateCode: string; contactName: string | null; contactEmail: string; brands: number } | null;
  subscription: {
    planName: string; includedModules: string[]; pepmPaise: number; listPepmPaise: number; minimumPaise: number; cycle: string; usageBasis: string; committedSeats: number | null;
    contractStart: string; contractEnd: string | null; trialEnds: string | null;
    estimate: { pepmPaise: number; usagePaise: number; minimumPaise: number; monthlyPaise: number; annual: boolean };
  } | null;
  invoices: InvoiceRow[];
  creditNotes: { id: string; number: string; issueDate: string; reason: string; totalPaise: number; invoiceNumber: string; isDemo: boolean }[];
  outstandingPaise: number; overduePaise: number;
  suspension: { suspendOn: string; suspendedAt: string | null } | null;
  payTo: { bankDetails: string; legalName: string } | null;
};

/** "Your plan & usage" for the brand OWNER: plan, live billable headcount, usage history, invoices and payment status. */
export function OwnerBilling() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { httpRequest<Summary>("/api/v2/orgs/billing/summary").then(setData).catch((reason) => setError(reason.message)); }, []);
  const download = (path: string, name: string) => downloadFile(path, name).catch((reason) => setError(reason.message));
  if (error && !data) return <div className="cw-page"><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p></div>;
  if (!data) return <div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  const sub = data.subscription;
  const peak = data.thisMonth.length ? Math.max(...data.thisMonth.map((point) => point.count)) : null;
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><CreditCard size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · BILLING</p>
          <h1>Your plan &amp; usage</h1>
          <p>What {data.brand.name} is subscribed to, how many people are billable, and your invoices. Only owners see this page.</p>
        </div>
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {data.suspension && (
        <p className="cw-alert" role="alert"><AlertTriangle size={15} />
          {data.suspension.suspendedAt ? " Access is paused because of an overdue invoice. Your data is safe; access returns as soon as the payment is recorded."
            : ` An invoice is overdue. Access will be paused on ${day(data.suspension.suspendOn)} unless it is paid. No data is ever deleted.`}</p>
      )}
      {data.viaGroup && !data.viaGroup.visible && (
        <p className={styles.warn}><Info size={14} /> {data.brand.name} is billed together with the other brands of {data.viaGroup.name}. Invoices are visible to that group's administrators.</p>
      )}

      <section className="cw-stats">
        <article><small>Plan</small><b className="text">{sub?.planName || "Not assigned"}</b><span>{sub ? `${sub.cycle === "ANNUAL" ? "Annual" : "Monthly"} · since ${day(sub.contractStart)}` : "Contact Northstar to choose a plan"}</span></article>
        <article><small>Billable today</small><b>{data.liveCount}</b><span>employees</span></article>
        <article><small>Price per employee</small><b className="text">{sub ? inr(sub.pepmPaise) : "—"}</b><span>{sub ? `per month · minimum ${inr(sub.minimumPaise)}` : ""}</span></article>
        <article className={data.overduePaise ? "attention" : ""}><small>Balance due</small><b className="text">{inr(data.outstandingPaise)}</b><span>{data.overduePaise ? `${inr(data.overduePaise)} overdue` : "nothing overdue"}</span></article>
      </section>

      <p className={styles.rule}><b>Who counts as billable:</b> {data.rule} {sub ? `Each month is billed on the ${sub.usageBasis === "PEAK" ? "highest" : "average"} daily count.` : ""}</p>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>This month</h2><p>Billable employees per day{peak !== null ? ` · peak so far ${peak}` : ""}{sub?.estimate && !sub.estimate.annual ? ` · at today's headcount this month comes to about ${inr(sub.estimate.monthlyPaise)} + GST` : ""}</p></div></div>
        <UsageChart title="Billable employees per day this month" peak={peak}
          points={data.thisMonth.map((point) => ({ label: String(Number(point.day.slice(8, 10))), value: point.count, title: `${day(point.day)}: ${point.count} employees` }))} />
      </section>
      {data.months.length > 1 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><h2>Last six months</h2><p>Peak daily billable employees per month</p></div></div>
          <UsageChart title="Peak billable employees per month" points={data.months.map((month) => ({ label: monthLabel(month.month).slice(0, 3), value: month.peak, title: `${monthLabel(month.month)}: peak ${month.peak}, average ${month.average}` }))} />
        </section>
      )}

      {sub && (
        <section className={styles.section}>
          <div className={styles.sectionHead}><h2>Plan details</h2></div>
          <div className={styles.card}>
            <dl className={styles.facts}>
              <div><dt>Plan</dt><dd>{sub.planName}</dd></div>
              <div><dt>Contract</dt><dd>{day(sub.contractStart)} – {sub.contractEnd ? day(sub.contractEnd) : "ongoing"}</dd></div>
              {sub.trialEnds && <div><dt>Free trial until</dt><dd>{day(sub.trialEnds)}</dd></div>}
              {sub.committedSeats !== null && <div><dt>Committed seats</dt><dd>{sub.committedSeats}</dd></div>}
              <div><dt>Billed to</dt><dd>{data.account?.legalName}</dd></div>
              <div><dt>GSTIN</dt><dd>{data.account?.gstin || "Unregistered"}</dd></div>
              <div><dt>Invoices sent to</dt><dd>{data.account?.contactEmail}</dd></div>
            </dl>
            <div className={styles.chips} aria-label="Included modules">{sub.includedModules.map((key) => <span key={key}>{MODULE_LABELS[key] || key}</span>)}</div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>Invoices</h2><p>Tax invoices with GST. Download the PDF for your accounts team.</p></div></div>
        {!data.invoices.length ? <p className="cw-help">No invoices yet.</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Invoice</th><th>Period</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th><span className="sr-only">PDF</span></th></tr></thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><b>{invoice.number}</b>{invoice.isDemo && <span className={styles.demo}>DEMO</span>}<small>{day(invoice.issueDate)}</small></td>
                    <td>{monthLabel(invoice.periodStart)}</td>
                    <td>{day(invoice.dueDate)}{invoice.overdue && <small style={{ color: "#a2402f" }}>{invoice.daysOverdue} days overdue</small>}</td>
                    <td className="num">{inr(invoice.totalPaise)}</td>
                    <td className="num">{inr(invoice.outstandingPaise)}</td>
                    <td><span className={`cw-badge ${invoice.overdue ? "tone-danger" : PAYMENT_TONE[invoice.paymentState]}`}><i />{invoice.overdue ? "Overdue" : PAYMENT_LABEL[invoice.paymentState]}</span></td>
                    <td><button className="cw-btn ghost" onClick={() => download(`/api/v2/orgs/billing/invoices/${invoice.id}/pdf`, `${invoice.number}.pdf`)} aria-label={`Download invoice ${invoice.number} as PDF`}><Download size={14} /> PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.creditNotes.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">Credit notes</caption>
              <thead><tr><th>Credit note</th><th>Against</th><th>Reason</th><th className="num">Amount</th><th><span className="sr-only">PDF</span></th></tr></thead>
              <tbody>{data.creditNotes.map((note) => (
                <tr key={note.id}>
                  <td><b>{note.number}</b>{note.isDemo && <span className={styles.demo}>DEMO</span>}<small>{day(note.issueDate)}</small></td><td>{note.invoiceNumber}</td><td>{note.reason}</td>
                  <td className="num">{inr(note.totalPaise)}</td>
                  <td><button className="cw-btn ghost" onClick={() => download(`/api/v2/orgs/billing/credit-notes/${note.id}/pdf`, `${note.number}.pdf`)} aria-label={`Download credit note ${note.number}`}><Download size={14} /> PDF</button></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
        {data.payTo && data.outstandingPaise > 0 && (
          <div className={styles.card}><h3>How to pay</h3><p style={{ whiteSpace: "pre-line" }}>{data.payTo.bankDetails}</p><p>Quote the invoice number as the payment reference. Payments are recorded by Northstar within one working day.</p></div>
        )}
      </section>
    </div>
  );
}
