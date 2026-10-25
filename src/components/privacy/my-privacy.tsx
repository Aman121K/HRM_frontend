"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileJson, Fingerprint, Loader2, Lock, Mail, Phone, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { BreachRegister } from "./breach-register";
import { LegalLinks } from "./legal-links";
import "./privacy.css";

type ExportRow = { id: string; status: string; createdAt: string; expiresAt: string | null; error: string | null; files: { id: string; name: string; byteSize: number }[] };
type Overview = {
  brand: { name: string; legalName: string };
  grievance: { name: string | null; email: string | null; phone: string | null; address: string | null };
  dpo: { name: string | null; email: string | null; phone: string | null } | null;
  notice: { id: string; version: number; title: string; summary: string; body: string; acknowledgedAt: string | null } | null;
  exports: ExportRow[];
  requests: { id: string; caseNumber: string; category: string; title: string; status: string; createdAt: string; dueAt: string | null }[];
  retention: { key: string; label: string; years: number; what: string }[];
  selfieRetentionDays: number | null;
  exportTtlDays: number;
};
type Tab = "mine" | "settings" | "retention" | "breaches";
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** My space → My data & privacy, plus the brand's privacy administration for HR (settings, retention) and the owner (breaches). */
export function MyPrivacy() {
  const [tab, setTab] = useState<Tab>("mine");
  const [isHr, setIsHr] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    try { const wanted = new URLSearchParams(window.location.search).get("tab"); if (wanted === "settings" || wanted === "retention" || wanted === "breaches") setTab(wanted); } catch { /* ignore */ }
    httpRequest("/api/v2/privacy/settings").then(() => setIsHr(true)).catch(() => setIsHr(false));
    httpRequest("/api/v2/privacy/breaches").then(() => setIsOwner(true)).catch(() => setIsOwner(false));
  }, []);
  const tabs: [Tab, string, boolean][] = [["mine", "My data", true], ["settings", "Privacy settings", isHr], ["retention", "Retention & erasure", isHr], ["breaches", "Breach register", isOwner]];
  return (
    <div className="cw-page pv-page">
      <header className="cw-hero">
        <span className="cw-hero-icon"><Fingerprint size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">MY SPACE · DATA PROTECTION (DPDP ACT 2023)</p>
          <h1>My data &amp; privacy</h1>
          <p>See what your employer holds about you, download a copy, ask for corrections or erasure, and reach the grievance officer.</p>
        </div>
      </header>
      {tabs.filter(([, , show]) => show).length > 1 && (
        <div className="cw-toolbar"><nav className="cw-tabs" role="tablist">
          {tabs.filter(([, , show]) => show).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav></div>
      )}
      {tab === "mine" && <MyData />}
      {tab === "settings" && isHr && <PrivacySettings />}
      {tab === "retention" && isHr && <Retention />}
      {tab === "breaches" && isOwner && <BreachRegister platform={false} />}
      <LegalLinks />
    </div>
  );
}

function MyData() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => httpRequest<Overview>("/api/v2/privacy/me").then(setData).catch((reason) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  // Poll while an export is being prepared.
  useEffect(() => {
    if (!data?.exports.some((row) => row.status === "QUEUED" || row.status === "RUNNING")) return;
    const timer = window.setTimeout(load, 3000);
    return () => window.clearTimeout(timer);
  }, [data, load]);
  const requestExport = async () => {
    setBusy(true); setError("");
    try { await httpRequest("/api/v2/privacy/me/exports", { method: "POST" }); await load(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const acknowledge = async () => {
    if (!data?.notice) return;
    try { await httpRequest(`/api/v2/compliance/policies/${data.notice.id}/acknowledge`, { method: "POST" }); await load(); } catch (reason) { setError((reason as Error).message); }
  };
  if (!data) return error ? <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p> : <div className="cw-list-skeleton"><i /><i /><i /></div>;
  const g = data.grievance;
  return (
    <div className="pv-grid">
      <div className="pv-section">
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        <section className="pv-card">
          <div className="pv-row between"><h2><FileJson size={18} /> Download my data</h2>
            <button className="cw-btn primary" onClick={requestExport} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Prepare a copy</button></div>
          <p>A copy of everything {data.brand.name} holds about you in this workspace — profile, employment, attendance (with your punch selfie list), leave, payslips, tax
            declarations, your requests, and a summary of who opened your records. It comes as JSON plus spreadsheets (CSV). Your PAN, UAN and bank details are included
            in full, so keep the files safe. Links work for {data.exportTtlDays} days.</p>
          {data.exports.length > 0 && (
            <div className="pv-list">
              {data.exports.map((row) => (
                <div className="pv-item" key={row.id}>
                  <div>
                    <b>Requested {date(row.createdAt)}</b>
                    <small>{row.status === "READY" ? `Ready · available until ${date(row.expiresAt)}` : row.status === "FAILED" ? row.error || "Failed" : row.status === "EXPIRED" ? "Expired and deleted" : "Preparing… you'll get a notification"}</small>
                    {row.files.length > 0 && <div className="pv-files">{row.files.map((file) => (
                      <button key={file.id} onClick={() => downloadFile(`/api/v2/files/${file.id}/content`, file.name).catch((reason) => setError(reason.message))}>
                        <Download size={12} /> {file.name} <small>{size(file.byteSize)}</small></button>
                    ))}</div>}
                  </div>
                  <span className={`pv-status ${row.status === "READY" ? "ok" : row.status === "FAILED" ? "bad" : row.status === "EXPIRED" ? "" : "warn"}`}>{row.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="pv-card">
          <div className="pv-row between"><h2><ShieldCheck size={18} /> Correct, erase, nominate or complain</h2>
            <Link className="cw-btn ghost" href="/my-space/privacy/requests">Open privacy requests</Link></div>
          <p>Raise a request and HR / the grievance officer will respond — the DPDP Rules allow up to 90 days; the target here is 30. Erasure covers data that isn&apos;t
            needed for your employment or required by law (for example, payroll and tax records are kept for the statutory period).</p>
          {data.requests.length > 0 && <div className="pv-list">{data.requests.map((row) => (
            <div className="pv-item" key={row.id}><div><b>{row.caseNumber} · {row.category}</b><small>{row.title} · raised {date(row.createdAt)}{row.dueAt ? ` · respond by ${date(row.dueAt)}` : ""}</small></div>
              <span className={`pv-status ${row.status === "COMPLETED" ? "ok" : row.status === "DECLINED" ? "bad" : "warn"}`}>{row.status.replace("_", " ")}</span></div>
          ))}</div>}
        </section>
        <section className="pv-card">
          <h2><Lock size={18} /> How long your data is kept after you leave</h2>
          <ul>
            {data.retention.map((row) => <li key={row.key}><b>{row.label}:</b> {row.years} year{row.years === 1 ? "" : "s"} — {row.what}</li>)}
            {data.selfieRetentionDays !== null && <li><b>Punch selfies:</b> {data.selfieRetentionDays} days after each punch.</li>}
          </ul>
        </section>
      </div>
      <aside className="pv-section">
        <section className="pv-card">
          <h2>Grievance officer</h2>
          {g.name || g.email ? (
            <div className="pv-contact"><b>{g.name || "Grievance officer"}</b>
              {g.email && <span><Mail size={12} /> <a href={`mailto:${g.email}`}>{g.email}</a></span>}
              {g.phone && <span><Phone size={12} /> {g.phone}</span>}
              {g.address && <span>{g.address}</span>}</div>
          ) : <p>Your employer hasn&apos;t published a grievance officer yet. Raise a privacy request and HR will respond.</p>}
          {data.dpo && <div className="pv-contact"><b>Data Protection Officer: {data.dpo.name}</b>{data.dpo.email && <a href={`mailto:${data.dpo.email}`}>{data.dpo.email}</a>}</div>}
          <p>Not satisfied with the response? You can complain to the Data Protection Board of India.</p>
        </section>
        {data.notice && (
          <section className="pv-card">
            <div className="pv-row between"><h2>{data.notice.title}</h2>
              {data.notice.acknowledgedAt ? <span className="pv-status ok"><CheckCircle2 size={12} /> Read {date(data.notice.acknowledgedAt)}</span> : <span className="pv-status warn">Not yet read</span>}</div>
            <div className="pv-notice" tabIndex={0}>{data.notice.body}</div>
            {!data.notice.acknowledgedAt && <button className="cw-btn primary" onClick={acknowledge}>I have read this notice</button>}
            <p>{data.brand.legalName} is the Data Fiduciary; the platform operator processes your data on its behalf. <Link href="/legal/privacy">Platform privacy policy</Link></p>
          </section>
        )}
      </aside>
    </div>
  );
}

type Settings = {
  grievanceName: string | null; grievanceEmail: string | null; grievancePhone: string | null; grievanceAddress: string | null; significantFiduciary: boolean;
  dpoName: string | null; dpoEmail: string | null; dpoPhone: string | null; retention: Record<string, number>; autoErase: boolean; version: number;
  updatedAt: string | null; updatedBy: string | null; limits: Record<string, { min: number; max: number }>; defaults: Record<string, number>;
  categories: { key: string; label: string; what: string; basis: string; statutory: boolean }[]; selfieRetentionDays: number | null;
};

function PrivacySettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const load = useCallback(() => httpRequest<Settings>("/api/v2/privacy/settings").then((data) => { setSettings(data); setDraft({}); }).catch((reason) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  if (!settings) return error ? <p className="cw-alert"><AlertTriangle size={15} /> {error}</p> : <div className="cw-list-skeleton"><i /><i /></div>;
  const val = (key: keyof Settings) => (key in draft ? draft[key] : settings[key]) as string | boolean | null;
  const retention = { ...settings.retention, ...((draft.retention as Record<string, number>) || {}) };
  const save = async () => {
    setError(""); setMessage("");
    try { await httpRequest("/api/v2/privacy/settings", { method: "PUT", body: { version: settings.version, ...draft } }); setMessage("Saved. The change is in the audit trail."); await load(); }
    catch (reason) { setError((reason as Error).message); }
  };
  const text = (key: keyof Settings, label: string, type = "text", wide = false) => (
    <label className={wide ? "wide" : ""}>{label}<input type={type} value={String(val(key) ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>
  );
  return (
    <div className="pv-section">
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {message && <p className="cw-alert" role="status"><CheckCircle2 size={15} /> {message}</p>}
      <section className="pv-card">
        <h2>Grievance officer (shown to every employee)</h2>
        <p>DPDP Act s.8(9) / Rules: publish the business contact of a person who can answer questions about personal data.</p>
        <div className="pv-form">
          {text("grievanceName", "Name")}{text("grievanceEmail", "Email", "email")}{text("grievancePhone", "Phone", "tel")}{text("grievanceAddress", "Postal address", "text", true)}
        </div>
      </section>
      <section className="pv-card">
        <h2>Data Protection Officer</h2>
        <div className="pv-form">
          <label className="pv-check wide"><input type="checkbox" checked={!!val("significantFiduciary")} onChange={(event) => setDraft({ ...draft, significantFiduciary: event.target.checked })} />
            The Government has notified this company as a Significant Data Fiduciary (a DPO based in India, annual DPIA and audit are then required)</label>
          {val("significantFiduciary") && <>{text("dpoName", "DPO name")}{text("dpoEmail", "DPO email", "email")}{text("dpoPhone", "DPO phone", "tel")}</>}
        </div>
      </section>
      <section className="pv-card">
        <h2>Retention after an employee leaves</h2>
        <p>Years after the exit date before each category is erased. Defaults are a starting point — <b>confirm with your counsel / CA</b>. Punch selfies follow the attendance
          policy ({settings.selfieRetentionDays ?? "—"} days).</p>
        <div className="pv-table-wrap"><table className="pv-table">
          <thead><tr><th>Category</th><th>What is erased</th><th>Why kept</th><th>Years</th></tr></thead>
          <tbody>{settings.categories.map((category) => (
            <tr key={category.key}><td><b>{category.label}</b></td><td>{category.what}</td><td>{category.basis}</td>
              <td><input aria-label={`${category.label} years`} type="number" min={settings.limits[category.key].min} max={settings.limits[category.key].max} value={retention[category.key]}
                onChange={(event) => setDraft({ ...draft, retention: { ...retention, [category.key]: Number(event.target.value) } })} />
                <small className="pv-muted"> default {settings.defaults[category.key]}</small></td></tr>
          ))}</tbody>
        </table></div>
        <label className="pv-check"><input type="checkbox" checked={!!val("autoErase")} onChange={(event) => setDraft({ ...draft, autoErase: event.target.checked })} />
          Erase automatically every night (owner only). When off, HR reviews a dry-run report and erases from “Retention &amp; erasure”.</label>
      </section>
      <div className="pv-row"><button className="cw-btn primary" onClick={save} disabled={!Object.keys(draft).length}>Save privacy settings</button>
        <span className="pv-muted">Last changed {settings.updatedAt ? `${date(settings.updatedAt)} by ${settings.updatedBy || "—"}` : "never"}</span></div>
    </div>
  );
}

type ReportSubject = { employeeId: string; name: string; employeeNumber: string; exitedOn: string | null; legalHold: boolean; blocked?: string; anonymise: boolean;
  due: { category: string; label: string; dueOn: string; counts: Record<string, number> }[]; later: { category: string; label: string; dueOn: string }[] };
type RunView = { id: string; mode: string; createdAt: string; report: { today: string; totals: { people: number; due: number; onHold: number }; subjects: ReportSubject[] } };
type ErasureRequest = { id: string; caseNumber: string; title: string; status: string; name: string; employeeNumber: string; employeeStatus: string; legalHold: boolean; previewedAt: string | null };

function Retention() {
  const [run, setRun] = useState<RunView | null>(null);
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [requestRun, setRequestRun] = useState<{ caseId: string; view: RunView } | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const loadRequests = useCallback(() => httpRequest<{ items: ErasureRequest[] }>("/api/v2/privacy/requests/erasure").then((data) => setRequests(data.items)).catch((reason) => setError(reason.message)), []);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  const act = async (work: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await work(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); } };
  const preview = () => act(async () => setRun(await httpRequest<RunView>("/api/v2/privacy/retention/dry-run", { method: "POST" })));
  const erase = () => act(async () => {
    if (!run || window.prompt(`This permanently erases the data listed for ${run.report.totals.people} person(s). Type ERASE to confirm.`) !== "ERASE") return;
    const result = await httpRequest<{ erased: number }>("/api/v2/privacy/retention/execute", { method: "POST", body: { dryRunId: run.id, confirm: "ERASE" } });
    setMessage(`Erased data for ${result.erased} person(s). Erasure certificates were written to the audit trail.`); setRun(null);
  });
  const hold = (subject: ReportSubject) => act(async () => {
    const reason = subject.legalHold ? undefined : window.prompt("Why must this person's records be kept? (e.g. pending litigation, statutory inquiry)") || "";
    if (!subject.legalHold && (!reason || reason.length < 5)) return;
    await httpRequest(`/api/v2/privacy/subjects/${subject.employeeId}/legal-hold`, { method: "PUT", body: subject.legalHold ? { hold: false } : { hold: true, reason } });
    setRun(await httpRequest<RunView>("/api/v2/privacy/retention/dry-run", { method: "POST" }));
  });
  const requestPreview = (caseId: string) => act(async () => setRequestRun({ caseId, view: await httpRequest<RunView>(`/api/v2/privacy/requests/${caseId}/erase`, { method: "POST", body: { mode: "DRY_RUN" } }) }));
  const requestErase = (caseId: string) => act(async () => {
    if (window.prompt("Erase this person's data now? Statutory records stay until their legal period ends. Type ERASE to confirm.") !== "ERASE") return;
    const result = await httpRequest<{ note: string }>(`/api/v2/privacy/requests/${caseId}/erase`, { method: "POST", body: { mode: "EXECUTE", confirm: "ERASE" } });
    setMessage(result.note); setRequestRun(null); await loadRequests();
  });
  return (
    <div className="pv-section">
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {message && <p className="cw-alert" role="status"><CheckCircle2 size={15} /> {message}</p>}
      <section className="pv-card">
        <div className="pv-row between"><h2><Trash2 size={18} /> Former employees past retention</h2>
          <button className="cw-btn primary" onClick={preview} disabled={busy}><RefreshCw size={15} /> Preview erasure (dry run)</button></div>
        <p>The preview changes nothing. Review it, place a legal hold on anyone whose records must be kept, then erase. Audit-trail entries are never altered; each erasure adds
          a certificate to it. Deleted files are purged from storage by the nightly files job.</p>
        {run && <ReportTable view={run} onHold={hold} />}
        {run && run.report.totals.people > 0 && <div className="pv-row"><button className="cw-btn danger" onClick={erase} disabled={busy}>Erase what this report lists</button></div>}
      </section>
      <section className="pv-card">
        <h2>Approved erasure requests</h2>
        <p>Requests from <Link href="/my-space/privacy/requests">privacy requests</Link> that HR is reviewing or has approved. Approve on the request first, preview here, then erase.</p>
        {!requests.length ? <p>No erasure requests waiting.</p> : <div className="pv-list">{requests.map((row) => (
          <div className="pv-item" key={row.id}>
            <div><b>{row.caseNumber} · {row.name} ({row.employeeNumber})</b><small>{row.status} · employee {row.employeeStatus.toLowerCase()}{row.legalHold ? " · legal hold" : ""}</small></div>
            <div className="pv-row">
              <button className="cw-btn ghost" onClick={() => requestPreview(row.id)} disabled={busy}>Preview</button>
              <button className="cw-btn danger" onClick={() => requestErase(row.id)} disabled={busy || row.status !== "APPROVED"}>Erase</button>
            </div>
          </div>
        ))}</div>}
        {requestRun && <ReportTable view={requestRun.view} />}
      </section>
    </div>
  );
}

function ReportTable({ view, onHold }: { view: RunView; onHold?: (subject: ReportSubject) => void }) {
  const { report } = view;
  if (!report.subjects.length) return <p className="pv-muted">No former employees found.</p>;
  return (
    <div className="pv-table-wrap"><table className="pv-table">
      <thead><tr><th>Person</th><th>Left on</th><th>Erase now</th><th>Kept until</th>{onHold && <th />}</tr></thead>
      <tbody>{report.subjects.map((subject) => (
        <tr key={subject.employeeId}>
          <td><b>{subject.name}</b><br /><small className="pv-muted">{subject.employeeNumber}</small></td>
          <td>{subject.exitedOn || "—"}</td>
          <td>{subject.blocked ? <span className="pv-status warn">{subject.blocked}</span> : subject.due.length ? subject.due.map((due) => (
            <div key={due.category}><b>{due.label}</b> <small className="pv-muted">{Object.entries(due.counts).map(([key, count]) => `${count} ${key}`).join(", ")}</small></div>
          )) : "Nothing due"}{subject.anonymise && !subject.blocked && <div><span className="pv-status bad">Name, email and number will be anonymised</span></div>}</td>
          <td>{subject.later.map((later) => <div key={later.category}><small>{later.label}: {later.dueOn}</small></div>)}</td>
          {onHold && <td><button className="cw-btn ghost" onClick={() => onHold(subject)}>{subject.legalHold ? "Release hold" : "Legal hold"}</button></td>}
        </tr>
      ))}</tbody>
    </table></div>
  );
}
