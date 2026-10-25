"use client";
import { AlertTriangle, ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authHeaders, downloadFile } from "@/lib/http-client";
import { platformApiUrl } from "@/lib/api";
import { shortDate } from "@/lib/cases";
import { payrollApi, errorText, inr, monthLabel, STATE_NAMES, type Payslip } from "./api";
import { ACCENT, BreakdownTables, ErrorState, TaxCard } from "./ui";

function words(value: number) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const u100 = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
  const u1000 = (n: number) => (n < 100 ? u100(n) : `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${u100(n % 100)}` : ""}`);
  let rest = Math.max(0, Math.round(value));
  if (!rest) return "Zero rupees only";
  const parts: string[] = [];
  if (rest >= 10000000) { parts.push(`${u1000(Math.floor(rest / 10000000))} crore`); rest %= 10000000; }
  if (rest >= 100000) { parts.push(`${u100(Math.floor(rest / 100000))} lakh`); rest %= 100000; }
  if (rest >= 1000) { parts.push(`${u100(Math.floor(rest / 1000))} thousand`); rest %= 1000; }
  if (rest) parts.push(u1000(rest));
  return `${parts.join(" ")} rupees only`.replace(/^./, (c) => c.toUpperCase());
}

export function PayslipView({ period }: { period: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const employeeId = params.get("employeeId") || undefined;
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setError(""); setSlip(null);
    try { setSlip(await payrollApi.payslip(period, employeeId)); } catch (reason) { setError(errorText(reason, "Unable to load this payslip.")); }
  }, [period, employeeId]);
  useEffect(() => { load(); }, [load]);

  const download = async () => {
    setBusy("download");
    try { await downloadFile(payrollApi.payslipDocumentPath(period, employeeId), `payslip-${period}.html`); } catch (reason) { setError(errorText(reason, "Download failed.")); } finally { setBusy(""); }
  };
  const print = async () => {
    setBusy("print");
    const win = window.open("", "_blank");
    try {
      const response = await fetch(platformApiUrl(payrollApi.payslipDocumentPath(period, employeeId)), { headers: authHeaders() });
      if (!response.ok) throw new Error("Unable to prepare the printable payslip.");
      const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/html" }));
      if (win) { win.location.href = url; win.addEventListener("load", () => win.print(), { once: true }); } else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { win?.close(); setError(errorText(reason, "Print failed.")); } finally { setBusy(""); }
  };
  const back = employeeId ? "/payroll/admin" : "/payroll";

  if (error && !slip) return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href={back} className="pe-back"><ArrowLeft size={15} /> Back</Link>
      <div className="cw-empty"><span><AlertTriangle size={26} /></span><h2>Payslip not available</h2><p>{error}</p><Link className="cw-btn primary" href={back}>Back to payroll</Link></div>
    </div>
  );
  if (!slip) return <div className="cw-page pe-page"><div className="cw-hero-skeleton" aria-label="Loading payslip" /></div>;

  const b = slip.breakdown;
  const e = b?.employee;
  return (
    <div className="cw-page pe-page pe-payslip-page" style={{ ["--accent" as string]: ACCENT }}>
      <div className="pe-slip-toolbar">
        <Link href={back} className="pe-back"><ArrowLeft size={15} /> {employeeId ? "Payroll runs" : "My payroll"}</Link>
        <div>
          <label className="sr-only" htmlFor="pe-period">Pay month</label>
          <select id="pe-period" value={period} onChange={(event) => router.push(`/payroll/payslips/${event.target.value}${employeeId ? `?employeeId=${employeeId}` : ""}`)}>
            {slip.periods.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
          </select>
          <button className="cw-btn ghost" onClick={print} disabled={Boolean(busy)}><Printer size={15} /> Print / PDF</button>
          <button className="cw-btn primary" onClick={download} disabled={Boolean(busy)}><Download size={15} /> Download</button>
        </div>
      </div>
      {error && <ErrorState message={error} />}
      <article className="pe-slip" aria-label={`Payslip for ${slip.label}`}>
        <header className="pe-slip-head">
          <div><small>{slip.organizationName}</small><h1>Payslip · {slip.label}</h1><p>Published {shortDate(slip.publishedAt)}{b ? ` · FY ${b.fiscalYear}` : ""}</p></div>
          <div className="pe-slip-net"><small>Net pay</small><b>{inr(slip.net)}</b><span>{words(slip.net)}</span></div>
        </header>
        <dl className="pe-slip-facts">
          <div><dt>Employee</dt><dd>{slip.employee.name}</dd></div>
          <div><dt>Employee ID</dt><dd>{slip.employee.number}</dd></div>
          <div><dt>Designation</dt><dd>{slip.employee.designation || "—"}</dd></div>
          <div><dt>Department</dt><dd>{slip.employee.department || "—"}</dd></div>
          <div><dt>Location · PT state</dt><dd>{slip.employee.location || "—"}{e ? ` · ${STATE_NAMES[e.state] || e.state}` : ""}</dd></div>
          <div><dt>Date of joining</dt><dd>{shortDate(slip.employee.joiningDate)}</dd></div>
          <div><dt>PAN</dt><dd>{e?.pan || "—"}</dd></div>
          <div><dt>UAN</dt><dd>{e?.uan || "—"}</dd></div>
          <div><dt>Bank account</dt><dd>{e?.bank || "—"}</dd></div>
          <div><dt>Payable days</dt><dd>{b ? `${b.days.payableDays} of ${b.days.daysInMonth}` : "—"}</dd></div>
          <div><dt>Loss of pay</dt><dd>{b ? `${b.days.lopDays} day${b.days.lopDays === 1 ? "" : "s"}` : "—"}</dd></div>
          <div><dt>Tax regime</dt><dd>{e ? (e.regime === "OLD" ? "Old" : "New") : "—"}</dd></div>
        </dl>
        {b?.totals ? (
          <>
            <BreakdownTables breakdown={b} />
            <div className="pe-slip-lower">
              {b.ytd && (
                <section className="pe-table-card">
                  <header><h3>Year to date · FY {b.fiscalYear}</h3><span>Including this month</span></header>
                  <table>
                    <caption className="sr-only">Year to date totals</caption>
                    <tbody>
                      <tr><th scope="row">Gross earnings</th><td className="num">{inr(b.ytd.gross)}</td></tr>
                      <tr><th scope="row">Taxable salary</th><td className="num">{inr(b.ytd.taxable)}</td></tr>
                      <tr><th scope="row">Income tax deducted</th><td className="num">{inr(b.ytd.tds)}</td></tr>
                      <tr><th scope="row">Provident fund</th><td className="num">{inr(b.ytd.pf)}</td></tr>
                      <tr><th scope="row">Professional tax</th><td className="num">{inr(b.ytd.pt)}</td></tr>
                      <tr><th scope="row">Net pay</th><td className="num">{inr(b.ytd.net)}</td></tr>
                    </tbody>
                  </table>
                </section>
              )}
              {b.tax && <TaxCard tax={b.tax} />}
            </div>
          </>
        ) : (
          <div className="pe-equation">
            <div><small>Gross</small><b>{inr(slip.gross)}</b></div><i>−</i><div><small>Deductions</small><b>{inr(slip.deductions)}</b></div><i>=</i>
            <div className="pe-net"><small>Net pay</small><b>{inr(slip.net)}</b></div>
          </div>
        )}
        {!b && <p className="pe-note">This is a legacy payslip without a detailed breakdown.</p>}
        <footer className="pe-slip-foot">System-generated payslip; no signature required. Sensitive identifiers are masked.{b ? ` Statutory rule set ${b.rulesetVersion}.` : ""} {slip.disclaimer}</footer>
      </article>
    </div>
  );
}
