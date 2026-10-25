"use client";
import "./switch-over.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Download, FileSpreadsheet, FileText, RotateCcw, Save, Upload, X } from "lucide-react";
import { downloadFile, httpRequest } from "@/lib/http-client";

type Step = {
  kind: string; slug: string; step: number; title: string; summary: string; roles: string[]; canManage: boolean;
  committedBatches: number; records: number; status: "DONE" | "UNDONE" | "NOT_STARTED"; last: Batch | null;
};
type Batch = {
  id: string; kind: string; slug: string; title: string; fileName: string | null; status: "COMMITTED" | "UNDONE"; totalRows: number;
  createdBy: string | null; createdAt: string; undoneBy: string | null; undoneAt: string | null; undoReason: string | null; options: any; summary: any;
};
type Settings = { cutoverDate: string | null; fiscalYear: string | null; lastPaidPeriod: string | null; sourceSystem: string | null; controlTotals: any; version: number; updatedBy: string | null; updatedAt: string | null };
type Overview = { settings: Settings; register: { active: number; total: number }; steps: Step[]; viewer: { roles: string[]; canHr: boolean; canPayroll: boolean } };
type ReviewRow = { row: number; employeeNumber: string; employeeName: string | null; outcome: string; changes: Record<string, unknown>; errors: string[]; warnings: string[] };
type Review = { kind: string; batchKey: string; rows: ReviewRow[]; summary: Record<string, number>; totals: Record<string, any>; alreadyCommitted: Batch | null; options?: any };

const when = (value: string | null) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const inr = (value: unknown) => (typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value ?? "—"));
const message = (error: unknown) => {
  // Validation failures carry the invalid rows in details; the message already summarises them.
  const details = (error as { details?: any })?.details;
  const rows = Array.isArray(details?.rows) ? details.rows.slice(0, 3).map((row: any) => `row ${row.row}: ${row.errors?.[0] || ""}`).join("; ") : "";
  return `${error instanceof Error ? error.message : "Something went wrong."}${rows ? ` (${rows})` : ""}`;
};
const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.readAsDataURL(file);
});
const label = (key: string) => key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function SwitchOverPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"checklist" | "history" | "reconciliation">("checklist");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await httpRequest<Overview>("/api/v2/imports/overview")); setError(""); } catch (e) { setError(message(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const done = data?.steps.filter((step) => step.status === "DONE").length || 0;

  return (
    <div className="so-page">
      <header className="so-hero">
        <div>
          <p className="so-eyebrow">Switch-over import · FY {data?.settings.fiscalYear || "2026-27"}</p>
          <h1>Move to Northstar mid-year</h1>
          <p>Load opening data from PeopleStrong, Excel or another HRMS once: validate every row, preview the totals, commit in one transaction — and undo a batch while nothing depends on it.</p>
        </div>
        <div className="so-cut">
          <span><small>Cut-over</small><b>{data?.settings.cutoverDate || "Not set"}</b></span>
          <span><small>Last paid by old system</small><b>{data?.settings.lastPaidPeriod || "Not set"}</b></span>
          <span><small>Steps done</small><b>{done} / 5</b></span>
        </div>
      </header>
      {error && <p className="so-alert error">{error}</p>}
      <nav className="so-tabs" aria-label="Switch-over sections">
        {(["checklist", "history", "reconciliation"] as const).map((key) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{key === "checklist" ? "Cut-over checklist" : key === "history" ? "Import history" : "Reconciliation report"}</button>
        ))}
      </nav>
      {!data ? <div className="so-empty">Loading the switch-over checklist…</div> : tab === "checklist" ? (
        <>
          <SettingsCard settings={data.settings} onSaved={load} />
          <div className="so-steps">
            <div className="so-step done">
              <span className="so-num"><Check size={16} /></span>
              <div><b>0 · Employee register</b><small>Create people (number, name, work email, role, joining date) with the basic CSV import first.</small></div>
              <div><span className="so-badge done">{data.register.active} active</span><small>{data.register.total} records in total</small></div>
              <div className="so-step-actions"><Link className="so-btn ghost" href="/hris/import">Basic import <ArrowRight size={14} /></Link></div>
            </div>
            {data.steps.map((step) => (
              <div key={step.kind}>
                <div className={`so-step ${step.status === "DONE" ? "done" : ""} ${open === step.kind ? "open" : ""}`}>
                  <span className="so-num">{step.status === "DONE" ? <Check size={16} /> : step.step}</span>
                  <div><b>{step.step} · {step.title}</b><small>{step.summary}</small></div>
                  <div>
                    <span className={`so-badge ${step.status === "DONE" ? "done" : step.status === "UNDONE" ? "undone" : ""}`}>
                      {step.status === "DONE" ? `${step.records} record(s) · ${step.committedBatches} batch(es)` : step.status === "UNDONE" ? "Undone" : "Not started"}
                    </span>
                    <small>{step.last ? `Last: ${step.last.createdBy || "—"}, ${when(step.last.createdAt)}${step.last.status === "UNDONE" ? ` · undone by ${step.last.undoneBy || "—"}` : ""}` : `For ${step.roles.map((role) => role.replace("_", " ").toLowerCase()).join(" / ")}`}</small>
                  </div>
                  <div className="so-step-actions">
                    {step.canManage ? (
                      <>
                        {step.last?.status === "COMMITTED" && <UndoButton batch={step.last} onDone={load} compact />}
                        <button className="so-btn primary" onClick={() => setOpen(open === step.kind ? null : step.kind)}>{open === step.kind ? <><X /> Close</> : <><Upload /> Import</>}</button>
                      </>
                    ) : <span className="so-muted">View only</span>}
                  </div>
                </div>
                {open === step.kind && step.canManage && (
                  <div className="so-panel">{step.kind === "PAYSLIPS" ? <PayslipImport onDone={load} /> : <CsvImport step={step} settings={data.settings} onDone={load} />}</div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : tab === "history" ? <History onChanged={load} /> : <Reconciliation settings={data.settings} viewer={data.viewer} onSaved={load} />}
    </div>
  );
}

function SettingsCard({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [form, setForm] = useState({ cutoverDate: settings.cutoverDate || "", lastPaidPeriod: settings.lastPaidPeriod || "", fiscalYear: settings.fiscalYear || "2026-27", sourceSystem: settings.sourceSystem || "PeopleStrong" });
  const [busy, setBusy] = useState(false), [note, setNote] = useState(""), [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNote("");
    try {
      await httpRequest("/api/v2/imports/settings", { method: "PUT", body: { version: settings.version, cutoverDate: form.cutoverDate || null, lastPaidPeriod: form.lastPaidPeriod || null, fiscalYear: form.fiscalYear || null, sourceSystem: form.sourceSystem || null } });
      setNote("Cut-over settings saved."); onSaved();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return (
    <section className="so-card">
      <h2>Cut-over settings</h2>
      <p>Leave balances are imported as of the cut-over date. Year-to-date payroll covers the months the old system paid; Northstar payroll runs after that month add these figures to the TDS projection.{settings.updatedBy ? ` Last saved by ${settings.updatedBy}, ${when(settings.updatedAt)}.` : ""}</p>
      <form className="so-form" onSubmit={save}>
        <label>Cut-over date<input type="date" value={form.cutoverDate} onChange={(e) => setForm({ ...form, cutoverDate: e.target.value })} /></label>
        <label>Last month paid by old system<input type="month" value={form.lastPaidPeriod} onChange={(e) => setForm({ ...form, lastPaidPeriod: e.target.value })} /></label>
        <label>Financial year<input value={form.fiscalYear} pattern="\d{4}-\d{2}" onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} /></label>
        <label>Previous system<input value={form.sourceSystem} maxLength={80} onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })} /></label>
        <button className="so-btn primary" disabled={busy}><Save /> {busy ? "Saving…" : "Save"}</button>
      </form>
      {note && <p className="so-alert">{note}</p>}{error && <p className="so-alert error">{error}</p>}
    </section>
  );
}

function CsvImport({ step, settings, onDone }: { step: Step; settings: Settings; onDone: () => void }) {
  const [fileName, setFileName] = useState(""), [csv, setCsv] = useState("");
  const [review, setReview] = useState<Review | null>(null), [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [issuesOnly, setIssuesOnly] = useState(false);
  const needs = step.kind === "LEAVE_OPENING" ? (!settings.cutoverDate ? "Set the cut-over date above first." : "") : step.kind === "PAYROLL_YTD" ? (!settings.lastPaidPeriod ? "Set the last month paid by the old system above first." : "") : "";
  const select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setCsv(await file.text()); setReview(null); setResult(null); setError("");
  };
  const validate = async () => {
    setBusy(true); setError(""); setResult(null);
    try { setReview(await httpRequest<Review>(`/api/v2/imports/${step.slug}/dry-run`, { method: "POST", body: { csv, fileName } })); }
    catch (e) { setError(message(e)); setReview(null); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!review) return;
    setBusy(true); setError("");
    try {
      const data = await httpRequest<any>(`/api/v2/imports/${step.slug}/commit`, { method: "POST", body: { csv, fileName, batchKey: review.batchKey } });
      setResult(data); onDone();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const rows = useMemo(() => (review?.rows || []).filter((row) => !issuesOnly || row.errors.length || row.warnings.length), [review, issuesOnly]);
  const dl = (help: boolean) => downloadFile(`/api/v2/imports/${step.slug}/template${help ? "?help=1" : ""}`, `${step.slug}-${help ? "column-help" : "template"}.csv`).catch((e) => setError(message(e)));
  if (result) return (
    <div>
      <p className="so-alert">{result.idempotent ? "This exact file was already imported — nothing changed." : `Committed ${result.batch.totalRows} record(s) as one batch.`} You can undo it from the checklist or Import history while nothing depends on it.</p>
      <button className="so-btn ghost" onClick={() => { setResult(null); setReview(null); setCsv(""); setFileName(""); }}>Import another file</button>
    </div>
  );
  return (
    <div>
      <div className="so-row">
        <button className="so-btn ghost" onClick={() => dl(false)}><Download /> CSV template</button>
        <button className="so-btn ghost" onClick={() => dl(true)}><FileSpreadsheet /> Column help</button>
        <label className="so-file"><Upload size={15} /> {fileName || "Choose CSV"}<input type="file" accept=".csv,text/csv" onChange={select} /></label>
        <button className="so-btn primary" disabled={!csv || busy || !!needs} onClick={validate}>{busy && !review ? "Validating…" : "Validate (dry run)"}</button>
      </div>
      {needs && <p className="so-alert warn">{needs}</p>}
      <p className="so-muted">Nothing is saved during validation. The commit re-validates the same file on the server, inside one transaction.</p>
      {error && <p className="so-alert error">{error}</p>}
      {review && <ReviewView review={review} rows={rows} issuesOnly={issuesOnly} setIssuesOnly={setIssuesOnly} />}
      {review && (
        <div className="so-row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="so-btn ghost" onClick={() => setReview(null)}>Replace file</button>
          <button className="so-btn primary" disabled={busy || review.summary.invalid > 0 || (!review.summary.create && !review.summary.update && !review.alreadyCommitted)} onClick={commit}>
            <Check /> {busy ? "Committing…" : review.alreadyCommitted ? "Already imported" : `Commit ${(review.summary.create || 0) + (review.summary.update || 0)} row(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewView({ review, rows, issuesOnly, setIssuesOnly }: { review: Review; rows: ReviewRow[]; issuesOnly: boolean; setIssuesOnly: (value: boolean) => void }) {
  const totals = Object.entries(review.totals || {}).filter(([, value]) => typeof value === "number" || typeof value === "string");
  const byType = Array.isArray(review.totals?.byType) ? review.totals.byType : null;
  return (
    <>
      {review.alreadyCommitted && <p className="so-alert warn">This exact file was already committed on {when(review.alreadyCommitted.createdAt)} by {review.alreadyCommitted.createdBy || "—"}. Committing again changes nothing.</p>}
      <div className="so-stats">
        <span><b>{review.summary.total}</b>Rows</span>
        <span><b>{(review.summary.create || 0) + (review.summary.update || 0)}</b>Will import</span>
        <span><b>{review.summary.unchanged || 0}</b>Unchanged</span>
        <span><b>{review.summary.warnings || 0}</b>With warnings</span>
        <span className={review.summary.invalid ? "bad" : ""}><b>{review.summary.invalid}</b>Errors</span>
      </div>
      {(totals.length > 0 || byType) && (
        <div className="so-stats">
          {totals.map(([key, value]) => <span key={key}><b>{inr(value)}</b>{label(key)}</span>)}
          {byType?.map((item: any) => <span key={item.code}><b>{inr(item.opening)} d</b>{item.code} opening · {item.employees} emp</span>)}
        </div>
      )}
      <label className="so-muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: "8px 0" }}><input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> Show only rows with errors or warnings</label>
      <div className="so-table">
        <table>
          <thead><tr><th>Row</th><th>Employee</th><th>Outcome</th><th>What changes</th><th>Validation</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row} className={row.errors.length ? "invalid" : ""}>
                <td>{row.row}</td>
                <td><b>{row.employeeNumber || "—"}</b><small>{row.employeeName || ""}</small></td>
                <td>{row.outcome}</td>
                <td><div className="so-changes">{Object.entries(row.changes).map(([key, value]) => <i key={key}>{label(key)}: {inr(value)}</i>)}</div></td>
                <td>{row.errors.length || row.warnings.length ? <ul>{row.errors.map((x) => <li className="err" key={x}>{x}</li>)}{row.warnings.map((x) => <li className="warn" key={x}>{x}</li>)}</ul> : "Ready"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="so-muted">No rows to show.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PayslipImport({ onDone }: { onDone: () => void }) {
  const [body, setBody] = useState<{ zipBase64?: string; files?: { name: string; base64: string }[]; fileName: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null), [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [issuesOnly, setIssuesOnly] = useState(false);
  const select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files || []);
    if (!list.length) return;
    setReview(null); setResult(null); setError("");
    const total = list.reduce((sum, file) => sum + file.size, 0);
    if (total > 8 * 1024 * 1024) { setError("Upload at most 8 MB at a time — split the payslips into several zips."); return; }
    const zip = list.find((file) => /\.zip$/i.test(file.name));
    if (zip) setBody({ zipBase64: await readBase64(zip), fileName: zip.name });
    else setBody({ files: await Promise.all(list.map(async (file) => ({ name: file.name, base64: await readBase64(file) }))), fileName: `${list.length} PDF file(s)` });
  };
  const run = async (commit: boolean) => {
    if (!body) return;
    setBusy(true); setError("");
    try {
      const data = await httpRequest<any>(`/api/v2/imports/payslips/${commit ? "commit" : "dry-run"}`, { method: "POST", body: commit && review ? { ...body, batchKey: review.batchKey } : body });
      if (commit) { setResult(data); onDone(); } else setReview(data);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const rows = (review?.rows || []).filter((row) => !issuesOnly || row.errors.length || row.warnings.length);
  if (result) return <div><p className="so-alert">{result.idempotent ? "These payslips were already imported." : `Imported ${result.batch.totalRows} payslip PDF(s). Employees see them under “Previous payslips (imported)”.`}</p><button className="so-btn ghost" onClick={() => { setResult(null); setReview(null); setBody(null); }}>Import more</button></div>;
  return (
    <div>
      <div className="so-row">
        <label className="so-file"><Upload size={15} /> {body?.fileName || "Choose .zip or PDFs"}<input type="file" accept=".zip,application/zip,application/pdf,.pdf" multiple onChange={select} /></label>
        <button className="so-btn primary" disabled={!body || busy} onClick={() => run(false)}>{busy && !review ? "Checking…" : "Validate (dry run)"}</button>
      </div>
      <p className="so-muted">Name each PDF <b>&lt;employee number&gt;_&lt;YYYY-MM&gt;.pdf</b> (e.g. BT003_2026-07.pdf). Up to 8 MB per upload; split larger sets into several zips.</p>
      {error && <p className="so-alert error">{error}</p>}
      {review && <ReviewView review={review} rows={rows} issuesOnly={issuesOnly} setIssuesOnly={setIssuesOnly} />}
      {review && <div className="so-row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button className="so-btn primary" disabled={busy || review.summary.invalid > 0 || !review.summary.create} onClick={() => run(true)}><Check /> {busy ? "Importing…" : `Import ${review.summary.create || 0} payslip(s)`}</button></div>}
    </div>
  );
}

function UndoButton({ batch, onDone, compact }: { batch: Batch; onDone: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const undo = async () => {
    const reason = window.prompt(`Undo “${batch.title}” (${batch.totalRows} record(s), ${batch.fileName || "file"})? Every record this batch wrote is reverted.\n\nReason (optional):`, "");
    if (reason === null) return;
    setBusy(true); setError("");
    try { await httpRequest(`/api/v2/imports/batches/${batch.id}/undo`, { method: "POST", body: { reason } }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button className="so-btn danger" disabled={busy} onClick={undo} title="Undo this batch"><RotateCcw /> {compact ? "Undo" : "Undo batch"}</button>
      {error && <small className="so-alert error" style={{ margin: 0, maxWidth: 360 }}>{error}</small>}
    </span>
  );
}

function History({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<Batch[] | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setItems((await httpRequest<{ items: Batch[] }>("/api/v2/imports/batches")).items); } catch (e) { setError(message(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <p className="so-alert error">{error}</p>;
  if (!items) return <div className="so-empty">Loading import history…</div>;
  if (!items.length) return <div className="so-empty">No switch-over imports yet.</div>;
  return (
    <div className="so-table" style={{ maxHeight: "none" }}>
      <table>
        <thead><tr><th>Import</th><th>File</th><th>Records</th><th>Imported</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((batch) => (
            <tr key={batch.id}>
              <td><b>{batch.title}</b><small>{batch.options?.cutoverDate ? `As of ${batch.options.cutoverDate}` : batch.options?.lastPaidPeriod ? `FY ${batch.options.fiscalYear} to ${batch.options.lastPaidPeriod}` : ""}</small></td>
              <td>{batch.fileName || "—"}</td>
              <td className="so-num-cell">{batch.totalRows}</td>
              <td>{batch.createdBy || "—"}<small>{when(batch.createdAt)}</small></td>
              <td><span className={`so-badge ${batch.status === "COMMITTED" ? "done" : "undone"}`}>{batch.status === "COMMITTED" ? "Committed" : "Undone"}</span>{batch.status === "UNDONE" && <small>{batch.undoneBy}, {when(batch.undoneAt)}{batch.undoReason ? ` — ${batch.undoReason}` : ""}</small>}</td>
              <td>{batch.status === "COMMITTED" && <UndoButton batch={batch} onDone={() => { load(); onChanged(); }} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const YTD_CONTROLS: [string, string][] = [["employees", "Employees with YTD"], ["gross", "Gross"], ["taxable", "Taxable"], ["pf_employee", "Employee PF"], ["pf_employer", "Employer PF"], ["esi_employee", "Employee ESI"], ["pt", "Professional tax"], ["tds", "TDS"]];

function Reconciliation({ settings, viewer, onSaved }: { settings: Settings; viewer: Overview["viewer"]; onSaved: () => void }) {
  const [report, setReport] = useState<any>(null), [error, setError] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const [controls, setControls] = useState<any>(settings.controlTotals || {});
  const load = useCallback(async () => {
    try { setReport(await httpRequest("/api/v2/imports/reconciliation")); } catch (e) { setError(message(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (section: string | null, key: string, value: string) => setControls((current: any) => section ? { ...current, [section]: { ...(current[section] || {}), [key]: value === "" ? undefined : Number(value) } } : { ...current, [key]: value === "" ? undefined : Number(value) });
  const save = async () => {
    setBusy(true); setError(""); setNote("");
    try {
      const latest = await httpRequest<Settings>("/api/v2/imports/settings");
      await httpRequest("/api/v2/imports/settings", { method: "PUT", body: { version: latest.version, controlTotals: controls } });
      setNote("Control totals saved."); onSaved(); load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const leaveTypes: any[] = report?.leave || [];
  return (
    <>
      <section className="so-card">
        <h2>Old system control totals</h2>
        <p>Enter the totals from {settings.sourceSystem || "the previous system"}’s own reports. The report below compares them with what was imported; any difference is highlighted.</p>
        <div className="so-controls">
          {viewer.canHr && <>
            <label>Active headcount<input type="number" value={controls.headcount ?? ""} onChange={(e) => set(null, "headcount", e.target.value)} /></label>
            <h3>Opening leave days by type</h3>
            {leaveTypes.map((type) => <label key={type.code}>{type.code} — {type.name}<input type="number" step="0.5" value={controls.leave?.[type.code] ?? ""} onChange={(e) => set("leave", type.code, e.target.value)} /></label>)}
          </>}
          {viewer.canPayroll && <>
            <h3>Payroll year-to-date (FY {settings.fiscalYear || "—"})</h3>
            {YTD_CONTROLS.map(([key, text]) => <label key={key}>{text}<input type="number" value={controls.ytd?.[key] ?? ""} onChange={(e) => set("ytd", key, e.target.value)} /></label>)}
            <h3>Salary</h3>
            <label>Employees with a structure<input type="number" value={controls.salary?.structures ?? ""} onChange={(e) => set("salary", "structures", e.target.value)} /></label>
            <label>Total annual CTC<input type="number" value={controls.salary?.annualCtc ?? ""} onChange={(e) => set("salary", "annualCtc", e.target.value)} /></label>
          </>}
        </div>
        <button className="so-btn primary" disabled={busy} onClick={save}><Save /> {busy ? "Saving…" : "Save control totals"}</button>
        {note && <p className="so-alert">{note}</p>}{error && <p className="so-alert error">{error}</p>}
      </section>
      {!report ? <div className="so-empty">Building the reconciliation report…</div> : (
        <section className="so-card">
          <h2>Reconciliation report</h2>
          {report.mismatches > 0 ? <p className="so-alert error"><AlertTriangle size={14} /> {report.mismatches} total(s) do not match the old system.</p> : <p className="so-alert">No mismatches against the control totals entered.</p>}
          {report.headcount && <div className="so-stats">
            {[["active", "Active"], ["with_dob", "With DOB"], ["with_pan", "With PAN"], ["with_uan", "With UAN"], ["with_bank", "With bank"], ["with_structure", "With salary"], ["with_leave", "With opening leave"]].map(([key, text]) => <span key={key}><b>{report.headcount[key]}</b>{text}</span>)}
          </div>}
          <div className="so-table" style={{ maxHeight: "none" }}>
            <table>
              <thead><tr><th>Section</th><th>Check</th><th className="so-num-cell">Northstar</th><th className="so-num-cell">Old system</th><th className="so-num-cell">Difference</th><th>Status</th></tr></thead>
              <tbody>
                {report.checks.map((check: any) => (
                  <tr key={`${check.section}-${check.label}`} className={check.ok === false ? "mismatch" : ""}>
                    <td>{check.section}</td><td>{check.label}</td><td className="so-num-cell">{inr(check.system)}</td><td className="so-num-cell">{check.control === null ? "—" : inr(check.control)}</td>
                    <td className="so-num-cell">{check.difference === null ? "—" : inr(check.difference)}</td>
                    <td>{check.ok === null ? <span className="so-badge">No control</span> : check.ok ? <span className="so-badge done">Matches</span> : <span className="so-badge bad">Mismatch</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leaveTypes.some((type) => type.employees) && <p className="so-muted" style={{ marginTop: 12 }}>Leave taken before cut-over (informational): {leaveTypes.filter((type) => type.taken).map((type) => `${type.code} ${inr(type.taken)} d`).join(" · ") || "none"}</p>}
        </section>
      )}
    </>
  );
}

/** Employee self-service list of payslips imported from the previous payroll system. */
export function ImportedPayslips({ title = "Previous payslips (imported)" }: { title?: string }) {
  const [items, setItems] = useState<any[] | null>(null), [error, setError] = useState("");
  useEffect(() => { httpRequest<{ items: any[] }>("/api/v2/imports/payslips/mine").then((data) => setItems(data.items)).catch((e) => setError(message(e))); }, []);
  if (error) return <p className="so-alert error">{error}</p>;
  if (!items) return <div className="so-empty">Loading…</div>;
  return (
    <section>
      <p className="so-eyebrow" style={{ margin: "0 0 10px" }}>{title}</p>
      {!items.length ? <div className="so-empty">No payslips were imported from your previous payroll system.</div> : (
        <div className="so-slips">
          {items.map((item) => (
            <button key={item.id} onClick={() => downloadFile(`/api/v2/files/${item.id}/content`, item.name).catch((e) => setError(message(e)))}>
              <FileText size={18} /><span><b>{item.label}</b><small className="so-muted" style={{ display: "block" }}>Issued by the previous payroll system</small></span><span className="so-muted">{Math.max(1, Math.round(item.byteSize / 1024))} KB</span><Download size={16} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
