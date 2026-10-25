"use client";
import { AlertTriangle, Building2, CheckCircle2, Download, FileCheck2, FileText, Info, Landmark, Loader2, Paperclip, Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/http-client";
import { Badge, Drawer, ErrorState, PermissionState } from "@/components/payroll-engine/ui";
import {
  STATE_CODES, currentFy, currentQuarter, dateLabel, errorText, inr, monthLabel, returnsApi,
  type Certificates, type Challan, type ChallanInput, type Deductor, type Issue, type Overview, type Quarter,
} from "./api";
import { TaxDocuments } from "./tax-documents";
import s from "./returns.module.css";

const ACCENT = "#0b615c";
type Tab = "deposits" | "statement" | "certificates";
const STATUS_TONE: Record<string, string> = { DRAFT: "neutral", GENERATED: "info", FILED: "success", GENERATING: "warning", PUBLISHED: "success" };

export function ReturnsWorkspace() {
  const [fy, setFy] = useState(currentFy());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [tab, setTab] = useState<Tab>("deposits");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [panel, setPanel] = useState<null | { kind: "challan"; challan?: Challan; period?: string } | { kind: "deductor" }>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setData(await returnsApi.overview(fy, quarter)); }
    catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 403) setForbidden(true);
      else setError(errorText(reason, "Unable to load statutory returns."));
    }
  }, [fy, quarter]);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3500); };
  const run = async (label: string, work: () => Promise<unknown>, done?: string) => {
    setBusy(label); setError("");
    try { await work(); if (done) flash(done); await load(); } catch (reason) { setError(errorText(reason, "That didn't work.")); } finally { setBusy(""); }
  };

  if (forbidden) return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <PermissionState title="Statutory returns are for payroll administrators" body="Your own Form 16 / Form 130 and TDS summaries are below once your employer publishes them." />
      <div style={{ marginTop: 18 }}><TaxDocuments embedded /></div>
    </div>
  );

  const years = [currentFy() - 1, currentFy(), currentFy() + 1].filter((y) => y >= 2024);
  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Landmark size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAY &amp; CLAIMS · STATUTORY RETURNS</p>
          <h1>TDS deposits, returns &amp; certificates</h1>
          <p>Record challans, reconcile deducted vs deposited TDS, prepare the quarterly {data?.forms.quarterly || "Form 138"} ({data?.forms.quarterlyOld || "24Q"}) statement and issue {data?.forms.certificate || "Form 130"} ({data?.forms.certificateOld || "Form 16"}) to employees.</p>
        </div>
        <div className="pe-hero-actions">
          <button className="cw-btn ghost" onClick={() => setPanel({ kind: "deductor" })}><Building2 size={16} /> Deductor details</button>
          <button className="cw-btn primary lg" onClick={() => setPanel({ kind: "challan" })}><Plus size={17} /> Record challan</button>
        </div>
      </header>

      <div className={s.picker}>
        <label className={s.fy}>Tax year
          <select value={fy} onChange={(event) => setFy(Number(event.target.value))} aria-label="Tax year">
            {years.map((y) => <option key={y} value={y}>{y}-{String(y + 1).slice(2)}</option>)}
          </select>
        </label>
        <div className={s.quarters} role="tablist" aria-label="Quarter">
          {(["Q1", "Q2", "Q3", "Q4"] as Quarter[]).map((q) => {
            const info = data?.quarters.find((item) => item.quarter === q);
            return (
              <button key={q} role="tab" aria-selected={quarter === q} className={quarter === q ? s.active : ""} onClick={() => setQuarter(q)}>
                {q} · {({ Q1: "Apr–Jun", Q2: "Jul–Sep", Q3: "Oct–Dec", Q4: "Jan–Mar" })[q]}
                <small>{info?.status === "FILED" ? "Filed" : `Due ${dateLabel(info?.dueDate)}`}</small>
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <>
          {data.deductor.issues.some((i) => i.level === "error") && (
            <p className="cw-alert warn" role="note"><AlertTriangle size={15} /><span>Deductor details are incomplete ({data.deductor.issues.filter((i) => i.level === "error").length} missing) — the statement file can't be generated until they are filled in. <button className="pe-link" onClick={() => setPanel({ kind: "deductor" })}>Complete deductor details</button></span></p>
          )}
          <section className="cw-stats" aria-label={`${data.quarter} summary`}>
            <article><small>TDS deducted · {data.quarter}</small><b>{inr(data.totals.deducted)}</b><span>from published / locked payroll</span></article>
            <article className={data.totals.deposited + 0.5 < data.totals.deducted ? "attention" : ""}><small>Deposited (challans)</small><b>{inr(data.totals.deposited)}</b><span>{data.totals.deposited + 0.5 < data.totals.deducted ? `${inr(data.totals.deducted - data.totals.deposited)} not yet deposited` : "matches deductions"}</span></article>
            <article><small>Statement · {data.forms.quarterly}</small><b className="text">{data.statement.status === "FILED" ? "Filed" : data.validation.errors.length ? `${data.validation.errors.length} error${data.validation.errors.length === 1 ? "" : "s"}` : "Ready"}</b><span>due {dateLabel(data.dueDates.statement)}</span></article>
            <article><small>{data.forms.certificate} · {data.fyLabel}</small><b className="text">{({ DRAFT: "Not generated", GENERATING: "Generating", GENERATED: "Awaiting publish", PUBLISHED: "Published" } as Record<string, string>)[data.documents.status] || data.documents.status}</b><span>{data.documents.generated}/{data.documents.total} employees · due {dateLabel(data.dueDates.certificate)}</span></article>
          </section>

          <nav className="cw-tabs" role="tablist" aria-label="Returns sections" style={{ borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
            {([["deposits", "Deposits & challans"], ["statement", `Quarterly ${data.forms.quarterly}`], ["certificates", `Annual ${data.forms.certificate}`]] as [Tab, string][]).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
            ))}
          </nav>

          {tab === "deposits" && <Deposits data={data} busy={busy}
            onAdd={(period) => setPanel({ kind: "challan", period })} onEdit={(challan) => setPanel({ kind: "challan", challan })}
            onDelete={(challan) => { if (window.confirm(`Delete challan ${challan.bsrCode}/${challan.challanSerial} of ${dateLabel(challan.depositDate)}?`)) run("delete", () => returnsApi.deleteChallan(challan.id), "Challan deleted."); }}
            onAllocate={() => run("allocate", async () => { const r = await returnsApi.allocate(fy, quarter); flash(`Allocated ${inr(r.allocated)} to ${r.allocations} deductee rows${r.unallocated ? ` · ${inr(r.unallocated)} still not deposited` : ""}.`); })} />}
          {tab === "statement" && <Statement data={data} busy={busy} run={run} />}
          {tab === "certificates" && <CertificatesPanel fy={fy} flash={flash} onChanged={load} />}
          <p className="pe-note" style={{ marginTop: 18 }}><Info size={13} /><span>{data.forms.note} Due dates and interest follow secondary sources (Income-tax Rules 2026) — see the Returns section of the statutory review pack; have your CA confirm before filing.</span></p>
        </>
      )}

      {panel?.kind === "challan" && <ChallanDrawer fy={fy} quarter={quarter} challan={panel.challan} period={panel.period} onClose={() => setPanel(null)}
        onSaved={async (message) => { setPanel(null); flash(message); await load(); }} />}
      {panel?.kind === "deductor" && data && <DeductorDrawer deductor={data.deductor} onClose={() => setPanel(null)} onSaved={async () => { setPanel(null); flash("Deductor details saved."); await load(); }} />}
      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}

function Flag({ tone, message }: { tone: string; message: string }) {
  return <span className={`${s.flag} tone-${tone}`}>{tone === "info" ? <Info size={13} /> : <AlertTriangle size={13} />}{message}</span>;
}

function Deposits({ data, busy, onAdd, onEdit, onDelete, onAllocate }: { data: Overview; busy: string; onAdd: (period: string) => void; onEdit: (c: Challan) => void; onDelete: (c: Challan) => void; onAllocate: () => void }) {
  const filed = data.statement.status === "FILED";
  return (
    <>
      <div className="pe-section-head">
        <h2>Month-wise deposits · {data.quarter} {data.fyLabel}</h2>
        <button className="cw-btn ghost" onClick={onAllocate} disabled={!!busy || filed} title={filed ? "The quarter is marked as filed" : "Map deducted TDS to the challans"}>
          {busy === "allocate" ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Allocate to employees
        </button>
      </div>
      <div className={s.months}>
        {data.months.map((month) => (
          <section key={month.period} className={s.month} aria-label={monthLabel(month.period)}>
            <div className={s.monthHead}>
              <div className="cw-title-cell"><small>Deposit due {dateLabel(month.dueDate)}</small><b>{monthLabel(month.period)}</b></div>
              <div className={s.metric}><small>Payroll</small><span>{month.run ? <Badge tone={month.run.status === "LOCKED" ? "success" : month.run.status === "PUBLISHED" ? "info" : "warning"} label={month.run.status.toLowerCase()} /> : "—"}</span></div>
              <div className={s.metric}><small>Deducted</small><span>{inr(month.deducted)}</span></div>
              <div className={s.metric}><small>Deposited</small><span>{inr(month.deposited)}</span></div>
              <div className={s.metric}><small>Allocated · {month.employees} emp.</small><span>{inr(month.allocated)}</span></div>
              <button className="cw-btn ghost" onClick={() => onAdd(month.period)} disabled={filed}><Plus size={14} /> Challan</button>
            </div>
            {month.flags.length > 0 && <div className={s.flags}>{month.flags.map((flag, i) => <Flag key={i} tone={flag.tone} message={flag.message} />)}</div>}
            {month.challans.length ? (
              <div className={s.tableWrap}>
                <table className={s.challans}>
                  <thead><tr><th>BSR code</th><th>Challan no.</th><th>Deposited on</th><th className="num">Tax + cess</th><th className="num">Interest</th><th className="num">Fee</th><th className="num">Allocated</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{month.challans.map((c) => (
                    <tr key={c.id}>
                      <td>{c.bsrCode}</td><td>{c.challanSerial}</td>
                      <td>{dateLabel(c.depositDate)} {c.late && <Badge tone="danger" label={`${c.daysLate} day${c.daysLate === 1 ? "" : "s"} late`} />}</td>
                      <td className="num">{inr(c.taxDeposited)}</td><td className="num">{inr(c.interest)}</td><td className="num">{inr(c.fee)}</td><td className="num">{inr(c.allocated)}</td>
                      <td><span className={s.rowActions}>
                        <button className="pe-link" onClick={() => onEdit(c)} disabled={filed} aria-label={`Edit challan ${c.challanSerial}`}><Pencil size={13} /> Edit</button>
                        <button className="pe-link danger" onClick={() => onDelete(c)} disabled={filed} aria-label={`Delete challan ${c.challanSerial}`}><Trash2 size={13} /> Delete</button>
                      </span></td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            ) : <p className={s.emptyRow}>No challan recorded for {monthLabel(month.period)}.</p>}
          </section>
        ))}
      </div>
    </>
  );
}

function IssueList({ items, empty }: { items: Issue[]; empty: string }) {
  if (!items.length) return <p className="pe-note"><CheckCircle2 size={13} /> <span>{empty}</span></p>;
  return <ul className={s.issues}>{items.map((issue, i) => (
    <li key={`${issue.code}-${i}`} className={issue.level === "error" ? "tone-danger" : "tone-warning"}><AlertTriangle size={14} /><span><code>{issue.code}</code>{issue.message}</span></li>))}</ul>;
}

function Statement({ data, busy, run }: { data: Overview; busy: string; run: (label: string, work: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [token, setToken] = useState(data.statement.tokenNumber || "");
  const [filedOn, setFiledOn] = useState(data.statement.filedOn || data.today);
  const [external, setExternal] = useState(data.statement.filedExternally);
  useEffect(() => { setToken(data.statement.tokenNumber || ""); setFiledOn(data.statement.filedOn || data.today); setExternal(data.statement.filedExternally); }, [data]);
  const v = data.validation;
  const blocked = v.errors.length > 0;
  const files: { kind: string; label: string; note: string; disabled?: string }[] = [
    { kind: "form138", label: `${data.forms.quarterly} text file (.txt) for FVU`, note: "Protean Form 138 Q1–Q3 layout · validate with FVU 1.2 and the .csi file", disabled: !data.statement.textAvailable ? data.statement.textNote || "Not available" : blocked ? "Fix the validation errors first" : undefined },
    { kind: "review", label: "Review report (PDF)", note: "Totals, validation, challans and deductee rows — for sign-off" },
    { kind: "annexure1", label: "Annexure I — deductee details (CSV)", note: "Deductee-wise rows with full PAN (RPU entry / CA review)" },
    { kind: "challans", label: "Challan details (CSV)", note: "BSR, serial, date, amounts, allocated / unallocated" },
    ...(data.quarter === "Q4" ? [{ kind: "annexure2", label: "Annexure II — salary details (CSV)", note: "From the annual certificate computation · Q4 layout pending at Protean", disabled: data.documents.generated ? undefined : "Generate annual certificates first" }] : []),
  ];
  return (
    <div className={s.grid2}>
      <section className="pe-card">
        <div className="pe-card-head"><h2>Validation</h2><span>{v.deducteeRows} deductee rows · {v.deductees} employees · {v.challans} challans</span></div>
        <p className="pe-muted" style={{ margin: 0 }}>Challan tax {inr(v.challanTotal)} · mapped to deductees {inr(v.deducteeTotal)} · section 392 (code 1002) · no-PAN rows reported as PANNOTAVBL with remark C.</p>
        <IssueList items={v.errors} empty="No blocking errors." />
        {v.warnings.length > 0 && <><h3 style={{ margin: "6px 0 0", font: "750 var(--type-body-small) var(--font-app)" }}>Warnings</h3><IssueList items={v.warnings} empty="" /></>}
      </section>
      <div style={{ display: "grid", gap: 16 }}>
        <section className="pe-card">
          <div className="pe-card-head"><h2>Files</h2><Badge tone={STATUS_TONE[data.statement.status] || "neutral"} label={data.statement.status.toLowerCase()} /></div>
          <div className={s.files}>
            {files.map((file) => (
              <button key={file.kind} className={s.fileBtn} disabled={!!file.disabled || !!busy} title={file.disabled}
                onClick={() => run(`file-${file.kind}`, () => returnsApi.file(data.fy, data.quarter, file.kind))}>
                <span>{file.label}<small>{file.disabled || file.note}</small></span>
                {busy === `file-${file.kind}` ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              </button>
            ))}
          </div>
          {data.statement.textNote && <p className="pe-note"><Info size={13} /><span>{data.statement.textNote}</span></p>}
        </section>
        <section className="pe-card">
          <div className="pe-card-head"><h2>Filing</h2><span>due {dateLabel(data.dueDates.statement)}</span></div>
          {data.statement.status === "FILED" ? (
            <>
              <p style={{ margin: 0 }}><FileCheck2 size={15} style={{ verticalAlign: -2, color: ACCENT }} /> Filed on {dateLabel(data.statement.filedOn)} · token <b>{data.statement.tokenNumber}</b>{data.statement.filedExternally ? " · filed outside Northstar" : ""}</p>
              <div className={s.actions}><button className="cw-btn ghost" disabled={!!busy} onClick={() => run("filing", () => returnsApi.filing(data.fy, data.quarter, { status: "DRAFT" }), "Quarter reopened as draft.")}>Reopen as draft</button></div>
            </>
          ) : (
            <form className={s.form} onSubmit={(event) => { event.preventDefault(); run("filing", () => returnsApi.filing(data.fy, data.quarter, { status: "FILED", tokenNumber: token, filedOn, filedExternally: external }), "Filing recorded — challans for this quarter are now frozen."); }}>
              <div className={s.fieldGrid}>
                <label className={s.field}>Token / receipt number<input value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" placeholder="15 digits" required pattern="[0-9]{15}" /></label>
                <label className={s.field}>Filed on<input type="date" value={filedOn} max={data.today} onChange={(e) => setFiledOn(e.target.value)} required /></label>
              </div>
              <label className="pe-note" style={{ color: "var(--ink)" }}><input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} /> Filed through the previous payroll system or a CA (before the switch-over)</label>
              <div className={s.actions}><button className="cw-btn primary" disabled={!!busy || token.length !== 15}><Send size={15} /> Mark as filed</button></div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function CertificatesPanel({ fy, flash, onChanged }: { fy: number; flash: (message: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<Certificates | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ generated: number; total: number } | null>(null);
  const [busy, setBusy] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const load = useCallback(async () => { setError(""); try { setData(await returnsApi.certificates(fy)); } catch (reason) { setError(errorText(reason, "Unable to load certificates.")); } }, [fy]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setError(""); setProgress({ generated: 0, total: data?.set.total || 0 });
    try {
      let result = await returnsApi.generate(fy, true);
      setProgress(result);
      for (let guard = 0; result.status !== "GENERATED" && guard < 500; guard++) { result = await returnsApi.generate(fy, false); setProgress(result); }
      flash(`Generated ${result.generated} certificate${result.generated === 1 ? "" : "s"}. Another payroll admin or the owner must review and publish them.`);
    } catch (reason) { setError(errorText(reason, "Generation stopped.")); }
    finally { setProgress(null); await load(); onChanged(); }
  };
  const publish = async () => {
    if (!data?.set.version || !window.confirm(`Publish ${data.items.length} certificates for ${data.fyLabel}? Employees will be notified and the documents are frozen.`)) return;
    setBusy("publish"); setError("");
    try { const r = await returnsApi.publish(fy, data.set.version); flash(`Published to ${r.employees} employees.`); await load(); onChanged(); }
    catch (reason) { setError(errorText(reason, "Publishing failed.")); } finally { setBusy(""); }
  };
  const onFile = async (file: File | undefined) => {
    if (!file || !target) return;
    if (file.type !== "application/pdf") { setError("Part A must be the PDF downloaded from TRACES."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("PDF must be 8 MB or smaller."); return; }
    setBusy(`partA-${target}`); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("Couldn't read the file.")); reader.readAsDataURL(file); });
      await returnsApi.uploadPartA(fy, target, { originalName: file.name, mimeType: "application/pdf", base64 });
      flash("Part A attached."); await load();
    } catch (reason) { setError(errorText(reason, "Upload failed.")); } finally { setBusy(""); setTarget(null); if (upload.current) upload.current.value = ""; }
  };

  if (!data) return error ? <ErrorState message={error} onRetry={load} /> : <div className="cw-list-skeleton"><i /><i /></div>;
  const published = data.set.status === "PUBLISHED";
  const pct = progress && progress.total ? Math.round((progress.generated / progress.total) * 100) : 0;
  const provisional = data.items.filter((item) => item.warnings.some((w) => w.startsWith("Provisional"))).length;
  return (
    <>
      <section className="pe-card" style={{ marginBottom: 16 }}>
        <div className="pe-card-head">
          <h2>{data.forms.certificate} ({data.forms.certificateOld}) + {data.forms.perquisitesOld} · {data.fyLabel}</h2>
          <Badge tone={STATUS_TONE[data.set.status] || "neutral"} label={data.set.status.toLowerCase()} />
        </div>
        <p className="pe-muted" style={{ margin: 0 }}>
          {data.set.generatedBy ? `Generated by ${data.set.generatedBy} on ${dateLabel(data.set.generatedAt)}. ` : ""}{published ? `Published by ${data.set.publishedBy} on ${dateLabel(data.set.publishedAt)}.` : `Due to employees by ${dateLabel(data.dueDate)}. Part A comes from TRACES — attach each employee's PDF; it is embedded unchanged so its digital signature stays valid.`}
        </p>
        {progress && <div aria-live="polite"><div className={s.progress} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div><small className="pe-muted">Generating {progress.generated} of {progress.total}…</small></div>}
        {provisional > 0 && !published && <p className="cw-alert warn" style={{ margin: 0 }}><AlertTriangle size={15} /><span>{provisional} certificate(s) are provisional: the year's payroll isn't complete, so they show year-to-date figures. Issue final certificates after the March payroll.</span></p>}
        {error && <ErrorState message={error} onRetry={load} />}
        <div className={s.actions}>
          {!published && <button className="cw-btn ghost" onClick={generate} disabled={!!progress || !!busy}>{progress ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} {data.set.status === "DRAFT" ? "Generate certificates" : "Regenerate"}</button>}
          {!published && <button className="cw-btn primary" onClick={publish} disabled={!data.canPublish || !!busy || !!progress} title={data.publishBlockedReason || undefined}>{busy === "publish" ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Publish to employees</button>}
        </div>
        {!published && data.publishBlockedReason && data.set.status === "GENERATED" && <p className="pe-note"><Info size={13} /><span>{data.publishBlockedReason}</span></p>}
      </section>
      <input ref={upload} type="file" accept="application/pdf" hidden onChange={(event) => onFile(event.target.files?.[0])} />
      {data.items.length ? (
        <div className={s.tableWrap}>
          <table className={s.docTable}>
            <thead><tr><th>Employee</th><th>Regime</th><th className="num">Gross salary</th><th className="num">Tax payable</th><th className="num">TDS</th><th>Part A</th><th><span className="sr-only">Downloads</span></th></tr></thead>
            <tbody>{data.items.map((item) => (
              <tr key={item.id}>
                <td><b>{item.name}</b><small>{item.number}{item.employeeStatus !== "ACTIVE" ? " · left" : ""}{item.warnings.filter((w) => !w.startsWith("Provisional")).length ? ` · ${item.warnings.filter((w) => !w.startsWith("Provisional")).length} warning(s)` : ""}</small>
                  {item.warnings.filter((w) => !w.startsWith("Provisional")).map((w, i) => <small key={i} style={{ color: "#9a6a12" }}>{w}</small>)}</td>
                <td>{item.regime === "OLD" ? "Old" : "New"}</td>
                <td className="num">{inr(item.gross)}</td><td className="num">{inr(item.tax)}</td><td className="num">{inr(item.tds)}</td>
                <td>{item.partA ? <button className="pe-link" onClick={() => returnsApi.document(fy, item.employeeId, "part-a").catch((r) => setError(errorText(r, "Download failed.")))}><Paperclip size={13} /> {item.partA.name}</button> : <span className="pe-muted">Not attached</span>}</td>
                <td><span className={s.rowActions}>
                  <button className="pe-link" disabled={!!busy} onClick={() => { setTarget(item.employeeId); upload.current?.click(); }}>{busy === `partA-${item.employeeId}` ? <Loader2 size={13} className="spin" /> : <Paperclip size={13} />} {item.partA ? "Replace" : "Attach"} Part A</button>
                  <button className="pe-link" onClick={() => returnsApi.document(fy, item.employeeId, "certificate").catch((r) => setError(errorText(r, "Download failed.")))}><FileText size={13} /> {data.forms.certificate}</button>
                  <button className="pe-link" onClick={() => returnsApi.document(fy, item.employeeId, "perquisites").catch((r) => setError(errorText(r, "Download failed.")))}><FileText size={13} /> {data.forms.perquisitesOld}</button>
                </span></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ) : <div className="cw-empty"><span><FileText size={24} /></span><h2>No certificates yet</h2><p>Generate certificates once payroll for the year is published. Employees who joined or left mid-year and pre-switch-over months (opening YTD) are included automatically.</p></div>}
    </>
  );
}

function ChallanDrawer({ fy, quarter, challan, period, onClose, onSaved }: { fy: number; quarter: Quarter; challan?: Challan; period?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const firstPeriod = period || challan?.period || `${quarter === "Q4" ? fy + 1 : fy}-${({ Q1: "04", Q2: "07", Q3: "10", Q4: "01" })[quarter]}`;
  const [form, setForm] = useState<ChallanInput>({
    period: firstPeriod, bsrCode: challan?.bsrCode || "", challanSerial: challan?.challanSerial || "", depositDate: challan?.depositDate || "",
    mode: challan?.mode || "C", minorHead: (challan?.minorHead as "200") || "200", tax: challan?.tax ?? 0, surcharge: challan?.surcharge ?? 0, cess: challan?.cess ?? 0,
    interest: challan?.interest ?? 0, fee: challan?.fee ?? 0, penalty: challan?.penalty ?? 0, notes: challan?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ChallanInput, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const money = (key: keyof ChallanInput, label: string, hint?: string) => (
    <label className={s.field}>{label}<input type="number" min={0} step="1" inputMode="numeric" value={String(form[key] ?? 0)} onChange={(e) => set(key, Number(e.target.value))} />{hint && <small>{hint}</small>}</label>
  );
  const total = (form.tax || 0) + (form.surcharge || 0) + (form.cess || 0) + (form.interest || 0) + (form.fee || 0) + (form.penalty || 0);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = { ...form, notes: form.notes?.trim() || undefined };
      if (challan) await returnsApi.updateChallan(challan.id, { ...body, version: challan.version }); else await returnsApi.createChallan(body);
      onSaved(challan ? "Challan updated — allocate again to refresh the deductee mapping." : "Challan recorded. Allocate to map it to employees.");
    } catch (reason) { setError(errorText(reason, "Couldn't save the challan.")); } finally { setSaving(false); }
  };
  return (
    <Drawer eyebrow="TDS DEPOSIT · CHALLAN ITNS 281" title={challan ? "Edit challan" : "Record challan"} onClose={onClose}>
      <form className={s.form} onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className={s.fieldGrid}>
          <label className={s.field}>Month of deduction<input type="month" value={form.period} onChange={(e) => set("period", e.target.value)} required /><small>Salary month whose TDS this deposits</small></label>
          <label className={s.field}>Date of deposit<input type="date" value={form.depositDate} onChange={(e) => set("depositDate", e.target.value)} required /></label>
          <label className={s.field}>BSR code<input value={form.bsrCode} onChange={(e) => set("bsrCode", e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" pattern="[0-9]{7}" required placeholder="7 digits" /></label>
          <label className={s.field}>Challan serial no.<input value={form.challanSerial} onChange={(e) => set("challanSerial", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" pattern="[0-9]{1,5}" required placeholder="up to 5 digits" /></label>
          <label className={s.field}>Mode<select value={form.mode} onChange={(e) => set("mode", e.target.value)}><option value="C">Challan (bank)</option><option value="B">Book adjustment (Govt.)</option></select></label>
          <label className={s.field}>Minor head<select value={form.minorHead} onChange={(e) => set("minorHead", e.target.value)}><option value="200">200 — TDS payable by taxpayer</option><option value="400">400 — regular assessment</option></select></label>
        </div>
        <fieldset className={s.fieldset}>
          <legend>Amounts (₹)</legend>
          <div className={s.fieldGrid}>
            {money("tax", "Income tax", "Section 392 (192) — salary")}{money("surcharge", "Surcharge")}{money("cess", "Health & education cess")}
            {money("interest", "Interest", "Late deposit — 1.5% per month or part")}{money("fee", "Fee", "Late filing fee")}{money("penalty", "Penalty / others")}
          </div>
          <p className="pe-muted" style={{ margin: 0 }}>Total deposited <b>{inr(total)}</b> · tax available for employees <b>{inr((form.tax || 0) + (form.surcharge || 0) + (form.cess || 0))}</b></p>
        </fieldset>
        <label className={s.field}>Notes<input value={form.notes || ""} maxLength={500} onChange={(e) => set("notes", e.target.value)} /></label>
        <div className={s.actions}><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : null} Save challan</button></div>
      </form>
    </Drawer>
  );
}

function DeductorDrawer({ deductor, onClose, onSaved }: { deductor: Deductor; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState({
    tan: deductor.tan || "", pan: deductor.pan || "", name: deductor.name || "", category: deductor.category || "K", gstin: deductor.gstin || "", email: deductor.email || "", phone: deductor.phone || "",
    address: { ...deductor.address }, responsible: { name: deductor.responsible.name || "", designation: deductor.responsible.designation || "", email: deductor.responsible.email || "", phone: deductor.responsible.phone || "", address: { ...(deductor.responsible.address || {}) }, pan: "" },
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const clean = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== "" && v !== undefined && v !== null));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await returnsApi.saveDeductor({
        ...clean({ tan: d.tan.toUpperCase(), pan: d.pan.toUpperCase(), name: d.name, category: d.category, gstin: d.gstin.toUpperCase(), email: d.email, phone: d.phone }),
        address: clean(d.address), responsible: { ...clean({ name: d.responsible.name, designation: d.responsible.designation, email: d.responsible.email, phone: d.responsible.phone, pan: d.responsible.pan.toUpperCase() }), address: clean(d.responsible.address) },
        version: deductor.version,
      });
      onSaved();
    } catch (reason) { setError(errorText(reason, "Couldn't save the deductor details.")); } finally { setSaving(false); }
  };
  const text = (label: string, value: string, onChange: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={s.field}>{label}<input value={value} onChange={(e) => onChange(e.target.value)} {...props} /></label>
  );
  const address = (value: Record<string, string | undefined>, onChange: (v: Record<string, string | undefined>) => void) => (
    <div className={s.fieldGrid}>
      {(["line1", "line2", "line3", "line4", "line5"] as const).map((key, i) => <span key={key} style={{ display: "contents" }}>{text(["Flat / door / block *", "Post office", "Road / street", "Area / locality", "District / city"][i], value[key] || "", (v) => onChange({ ...value, [key]: v }), { maxLength: 25 })}</span>)}
      <label className={s.field}>State *<select value={value.stateCode || ""} onChange={(e) => onChange({ ...value, stateCode: e.target.value })}><option value="">Select</option>{STATE_CODES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      {text("PIN code *", value.pincode || "", (v) => onChange({ ...value, pincode: v.replace(/\D/g, "").slice(0, 6) }), { inputMode: "numeric" })}
    </div>
  );
  return (
    <Drawer eyebrow="STATUTORY RETURNS" title="Deductor (employer) details" onClose={onClose} wide>
      <form className={s.form} onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <IssueList items={deductor.issues} empty="All details required for the statement are present." />
        <fieldset className={s.fieldset}><legend>Employer</legend>
          <div className={s.fieldGrid}>
            {text("TAN *", d.tan, (v) => setD({ ...d, tan: v.toUpperCase().slice(0, 10) }), { placeholder: "ABCD12345E" })}
            {text("PAN of deductor *", d.pan, (v) => setD({ ...d, pan: v.toUpperCase().slice(0, 10) }), { placeholder: "ABCDE1234F" })}
            {text("Name (as per TAN) *", d.name, (v) => setD({ ...d, name: v }), { maxLength: 75 })}
            <label className={s.field}>Category<select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>{[["K", "Company"], ["M", "Branch / division of company"], ["F", "Firm"], ["P", "AOP"], ["T", "Trust"], ["Q", "Individual / HUF"], ["J", "Artificial juridical person"], ["B", "Body of individuals"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {text("E-mail *", d.email, (v) => setD({ ...d, email: v }), { type: "email", maxLength: 75 })}
            {text("Phone *", d.phone, (v) => setD({ ...d, phone: v.replace(/\D/g, "").slice(0, 10) }), { inputMode: "numeric" })}
            {text("GSTIN (optional)", d.gstin, (v) => setD({ ...d, gstin: v.toUpperCase().slice(0, 15) }))}
          </div>
          {address(d.address, (v) => setD({ ...d, address: v }))}
        </fieldset>
        <fieldset className={s.fieldset}><legend>Person responsible for deduction</legend>
          <div className={s.fieldGrid}>
            {text("Name *", d.responsible.name, (v) => setD({ ...d, responsible: { ...d.responsible, name: v } }), { maxLength: 75 })}
            {text("Designation *", d.responsible.designation, (v) => setD({ ...d, responsible: { ...d.responsible, designation: v } }), { maxLength: 20 })}
            {text("E-mail", d.responsible.email, (v) => setD({ ...d, responsible: { ...d.responsible, email: v } }), { type: "email", maxLength: 75 })}
            {text("Mobile *", d.responsible.phone, (v) => setD({ ...d, responsible: { ...d.responsible, phone: v.replace(/\D/g, "").slice(0, 10) } }), { inputMode: "numeric" })}
            {text(`PAN *${deductor.responsible.panMasked ? ` (on file: ${deductor.responsible.panMasked} — leave blank to keep)` : ""}`, d.responsible.pan, (v) => setD({ ...d, responsible: { ...d.responsible, pan: v.toUpperCase().slice(0, 10) } }), { placeholder: "ABCDE1234F", autoComplete: "off" })}
          </div>
          {address(d.responsible.address, (v) => setD({ ...d, responsible: { ...d.responsible, address: v } }))}
        </fieldset>
        <p className="pe-note"><Info size={13} /><span>The responsible person's PAN is stored encrypted and printed only in the statement file and certificate verification.</span></p>
        <div className={s.actions}><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : null} Save details</button></div>
      </form>
    </Drawer>
  );
}
