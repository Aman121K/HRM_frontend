"use client";
import { AlertTriangle, Archive, CheckCircle2, Download, Fingerprint, PackageOpen, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { BreachRegister } from "./breach-register";
import { LegalLinks } from "./legal-links";
import "./privacy.css";

type Brand = {
  id: string; slug: string; name: string; status: string;
  lastExport: { id: string; status: string; createdAt: string; expiresAt: string | null; error: string | null; files: number } | null;
  closure: { id: string; status: string; reason: string; graceDays: number; requestedAt: string; requestedBy: string; requestedById: string; confirmedAt: string | null;
    confirmedBy: string | null; deleteAfter: string | null; deletedAt: string | null; error: string | null; certificate: { sha256?: string } | null } | null;
};
type ExportFiles = { id: string; expiresAt: string; files: { name: string; bytes: number; rows?: number }[] };
const when = (value: string | null) => (value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Super admin → Data privacy: breach register across brands, whole-brand export and two-admin brand closure. */
export function PlatformPrivacy() {
  const [view, setView] = useState<"brands" | "breaches">("brands");
  const [data, setData] = useState<{ items: Brand[]; me: string; exportTtlDays: number } | null>(null);
  const [files, setFiles] = useState<ExportFiles | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => httpRequest<{ items: Brand[]; me: string; exportTtlDays: number }>("/api/v2/platform/privacy/brands").then(setData).catch((reason) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.items.some((brand) => brand.lastExport && ["QUEUED", "RUNNING"].includes(brand.lastExport.status))) return;
    const timer = window.setTimeout(load, 3000);
    return () => window.clearTimeout(timer);
  }, [data, load]);
  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await work(); if (done) setMessage(done); await load(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const exportBrand = (brand: Brand) => act(() => httpRequest("/api/v2/platform/privacy/exports", { method: "POST", body: { organizationId: brand.id, reason: "Requested from the platform console" } }),
    `Export of ${brand.name} started. It is written to the brand's own storage folder.`);
  const showFiles = (id: string) => act(async () => setFiles(await httpRequest<ExportFiles>(`/api/v2/platform/privacy/exports/${id}`)));
  const requestClosure = (brand: Brand) => {
    const reason = window.prompt(`Why is ${brand.name} being closed? (contract end, customer request…)`);
    if (!reason || reason.trim().length < 10) { if (reason !== null) setError("Give a reason of at least 10 characters."); return; }
    const grace = Number(window.prompt("Grace period in days before data is deleted (0–180):", "30"));
    if (!Number.isInteger(grace) || grace < 0 || grace > 180) { setError("Grace period must be 0–180 days."); return; }
    const slug = window.prompt(`Type the brand's address name (${brand.slug}) to confirm:`);
    if (slug === null) return;
    act(() => httpRequest("/api/v2/platform/privacy/closures", { method: "POST", body: { organizationId: brand.id, reason: reason.trim(), graceDays: grace, confirmSlug: slug } }),
      "Closure requested. A second platform administrator must confirm it.");
  };
  const confirmClosure = (brand: Brand) => {
    const slug = window.prompt(`Confirm closing ${brand.name}: the brand is suspended now, exported, and its data deleted after ${brand.closure?.graceDays} days. Type ${brand.slug}:`);
    if (slug === null || !brand.closure) return;
    act(() => httpRequest(`/api/v2/platform/privacy/closures/${brand.closure!.id}/confirm`, { method: "POST", body: { confirmSlug: slug } }), "Closure confirmed: brand suspended, hand-over export started.");
  };
  const cancelClosure = (brand: Brand) => {
    if (!brand.closure || !window.confirm(`Cancel the closure of ${brand.name}? A suspended brand is reactivated.`)) return;
    act(() => httpRequest(`/api/v2/platform/privacy/closures/${brand.closure!.id}/cancel`, { method: "POST" }), "Closure cancelled.");
  };
  return (
    <div className="cw-page pv-page" style={{ ["--accent" as string]: "#132c38" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Fingerprint size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PLATFORM · DATA PRIVACY (DPDP ACT 2023)</p>
          <h1>Data privacy</h1>
          <p>As Data Processor: log incidents against the DPDP and CERT-In clocks, hand every customer a complete export, and close brands with two-person approval.</p>
        </div>
        <button className="cw-btn ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </header>
      <div className="cw-toolbar"><nav className="cw-tabs" role="tablist">
        <button role="tab" aria-selected={view === "brands"} className={view === "brands" ? "active" : ""} onClick={() => setView("brands")}>Brand export &amp; closure</button>
        <button role="tab" aria-selected={view === "breaches"} className={view === "breaches" ? "active" : ""} onClick={() => setView("breaches")}>Breach register</button>
      </nav></div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {message && <p className="cw-alert" role="status"><CheckCircle2 size={15} /> {message}</p>}
      {view === "breaches" ? <BreachRegister platform brands={(data?.items || []).map((brand) => ({ id: brand.id, name: brand.name }))} /> : !data ? <div className="cw-list-skeleton"><i /><i /></div> : (
        <div className="pv-section">
          <div className="pv-table-wrap"><table className="pv-table">
            <thead><tr><th>Brand</th><th>Latest export</th><th>Closure</th><th>Actions</th></tr></thead>
            <tbody>{data.items.map((brand) => {
              const closure = brand.closure && !["CANCELLED"].includes(brand.closure.status) ? brand.closure : null;
              const exportLive = brand.lastExport?.status === "READY" && brand.lastExport.expiresAt && new Date(brand.lastExport.expiresAt).getTime() > Date.now();
              return (
                <tr key={brand.id}>
                  <td><b>{brand.name}</b><br /><small className="pv-muted">{brand.slug} · {brand.status}</small></td>
                  <td>{brand.lastExport ? <>
                    <span className={`pv-status ${exportLive ? "ok" : brand.lastExport.status === "FAILED" ? "bad" : ""}`}>{exportLive ? "READY" : brand.lastExport.status === "READY" ? "EXPIRED" : brand.lastExport.status}</span>
                    <br /><small className="pv-muted">{when(brand.lastExport.createdAt)}{exportLive ? ` · until ${when(brand.lastExport.expiresAt)}` : ""}</small>
                    {exportLive && <><br /><button className="cw-btn ghost" onClick={() => showFiles(brand.lastExport!.id)}><PackageOpen size={14} /> {brand.lastExport.files} files</button></>}
                  </> : <small className="pv-muted">Never exported</small>}</td>
                  <td>{closure ? <>
                    <span className={`pv-status ${closure.status === "DELETED" ? "bad" : "warn"}`}>{closure.status.replace("_", " ")}</span>
                    <br /><small className="pv-muted">Requested by {closure.requestedBy} · {when(closure.requestedAt)}</small>
                    {closure.confirmedBy && <><br /><small className="pv-muted">Confirmed by {closure.confirmedBy} · deletes after {when(closure.deleteAfter)}</small></>}
                    {closure.deletedAt && <><br /><small className="pv-muted">Deleted {when(closure.deletedAt)} · certificate {closure.certificate?.sha256?.slice(0, 12)}…</small></>}
                    {closure.error && <><br /><small className="pv-muted">Last error: {closure.error}</small></>}
                  </> : <small className="pv-muted">Active customer</small>}</td>
                  <td><div className="pv-row">
                    {closure?.status !== "DELETED" && <button className="cw-btn ghost" disabled={busy} onClick={() => exportBrand(brand)}><Archive size={14} /> Export all data</button>}
                    {!closure && <button className="cw-btn danger" disabled={busy} onClick={() => requestClosure(brand)}>Close brand…</button>}
                    {closure?.status === "PENDING_CONFIRMATION" && closure.requestedById !== data.me && <button className="cw-btn danger" disabled={busy} onClick={() => confirmClosure(brand)}>Confirm closure</button>}
                    {closure?.status === "PENDING_CONFIRMATION" && closure.requestedById === data.me && <small className="pv-muted">Waiting for a second admin</small>}
                    {(closure?.status === "PENDING_CONFIRMATION" || closure?.status === "SCHEDULED") && <button className="cw-btn ghost" disabled={busy} onClick={() => cancelClosure(brand)}><XCircle size={14} /> Cancel</button>}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
          {files && (
            <section className="pv-card">
              <div className="pv-row between"><h2>Export files</h2><small className="pv-muted">Available until {when(files.expiresAt)} · every download is audited</small></div>
              <div className="pv-files">{files.files.map((file) => (
                <button key={file.name} onClick={() => downloadFile(`/api/v2/platform/privacy/exports/${files.id}/file?name=${encodeURIComponent(file.name)}`, file.name).catch((reason) => setError(reason.message))}>
                  <Download size={12} /> {file.name}{file.rows !== undefined ? ` · ${file.rows} rows` : ""}</button>
              ))}</div>
            </section>
          )}
          <p className="pv-muted">Deletion removes every brand table row and stored object (including exports) but keeps the hash-chained audit log, the suspended organisation
            record and billing records, and writes a deletion certificate to the brand&apos;s audit chain.</p>
        </div>
      )}
      <LegalLinks />
    </div>
  );
}
