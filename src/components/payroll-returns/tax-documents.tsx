"use client";
import { Download, FileText, Info, Loader2, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/payroll-engine/ui";
import { dateLabel, errorText, inr, returnsApi, type MyDocuments } from "./api";
import s from "./returns.module.css";

const ACCENT = "#0b615c";

/**
 * Employee "Tax documents": Form 130 / Form 16 (Part A + B), perquisites (12BA) and the quarterly TDS summary for every
 * year the employer has published. Embed on the employee payroll/tax page with <TaxDocuments embedded />.
 */
export function TaxDocuments({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<MyDocuments | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => { setError(""); try { setData(await returnsApi.mine()); } catch (reason) { setError(errorText(reason, "Unable to load your tax documents.")); } }, []);
  useEffect(() => { load(); }, [load]);
  const download = async (fy: number, kind: "certificate" | "perquisites" | "tds-summary" | "part-a") => {
    if (!data) return;
    setBusy(`${fy}-${kind}`); setError("");
    try { await returnsApi.document(fy, data.employeeId, kind); } catch (reason) { setError(errorText(reason, "Download failed.")); } finally { setBusy(""); }
  };

  const body = (
    <>
      {!embedded && <div className="pe-section-head"><h2>Tax documents</h2></div>}
      {error && <ErrorState message={error} onRetry={load} />}
      {!data ? (!error && <div className="cw-list-skeleton"><i /></div>) : !data.items.length ? (
        <div className="cw-empty"><span><ReceiptText size={24} /></span><h2>No tax documents yet</h2><p>Your Form 16 / Form 130, perquisite statement and TDS summary appear here once payroll publishes them for the year (certificates are due by 15 June after the tax year).</p></div>
      ) : (
        <div className={s.docCards}>
          {data.items.map((item) => {
            const links: { kind: "certificate" | "perquisites" | "tds-summary" | "part-a"; label: string; note: string }[] = [
              { kind: "certificate", label: `${item.forms.certificate} (${item.forms.certificateOld})`, note: item.partA ? "Salary computation with the TRACES Part A attached" : "Salary computation (Part A from TRACES not attached yet)" },
              ...(item.partA ? [{ kind: "part-a" as const, label: "Part A from TRACES", note: "Original digitally signed PDF" }] : []),
              { kind: "perquisites", label: `${item.forms.perquisitesOld} — perquisites`, note: item.forms.perquisites },
              { kind: "tds-summary", label: "Quarterly TDS summary", note: "Month-wise TDS, quarterly statements and challans" },
            ];
            return (
              <article key={item.fy} className={s.docCard}>
                <div><p className="cw-eyebrow" style={{ margin: 0 }}>{item.forms.yearLabel.toUpperCase()}</p><h3>Tax year {item.fyLabel}</h3></div>
                <p>Published {dateLabel(item.publishedAt)} · {item.regime === "OLD" ? "Old" : "New"} regime · tax {inr(item.tax)} · TDS {inr(item.tds)}</p>
                <div className={s.docLinks}>
                  {links.map((link) => (
                    <button key={link.kind} className={s.fileBtn} onClick={() => download(item.fy, link.kind)} disabled={!!busy}>
                      <span><FileText size={14} style={{ verticalAlign: -2, marginRight: 6, color: ACCENT }} />{link.label}<small>{link.note}</small></span>
                      {busy === `${item.fy}-${link.kind}` ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="pe-note" style={{ marginTop: 12 }}><Info size={13} /><span>Check the TDS against Form 26AS / the Annual Information Statement on the income-tax portal before filing your return. From tax year 2026-27 Form 16 is called Form 130.</span></p>
    </>
  );
  if (embedded) return body;
  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><ReceiptText size={26} strokeWidth={1.7} /></span>
        <div><p className="cw-eyebrow">PAY &amp; TAX</p><h1>My tax documents</h1><p>Download your annual TDS certificate, perquisite statement and quarterly TDS summary.</p></div>
      </header>
      {body}
    </div>
  );
}
