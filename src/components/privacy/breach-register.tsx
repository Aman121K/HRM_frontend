"use client";
import { AlertTriangle, CheckCircle2, Clock, Copy, Plus, RefreshCw, Siren, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import "./privacy.css";

type ClockState = { key: string; label: string; basis: string; dueAt: string; doneAt: string | null; state: "done" | "late" | "open"; internalTarget: boolean };
type Breach = {
  id: string; reference: string; organizationId: string | null; brand: string; title: string; nature: string; severity: string; status: string;
  detectedAt: string; dataCategories: string[]; affectedCount: number | null; affectedDescription: string | null; likelyConsequences: string | null;
  containment: string | null; mitigation: string | null; certInReportable: boolean; clocks: ClockState[]; version: number; canEdit: boolean;
};
const CATEGORIES = ["Identity & contact", "PAN / Aadhaar / government IDs", "Bank account", "Salary & payslips", "Tax declarations",
  "Attendance & location", "Punch selfies / photos", "Health / leave reasons", "Sign-in credentials", "Documents", "Other"];
const fmt = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
function left(dueAt: string, now: number) {
  const ms = new Date(dueAt).getTime() - now;
  const abs = Math.abs(ms), h = Math.floor(abs / 3_600_000), m = Math.floor((abs % 3_600_000) / 60_000);
  return `${h} h ${m} min ${ms < 0 ? "overdue" : "left"}`;
}
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

/** Breach register with DPDP / CERT-In clocks. `platform` = super admin (all brands); otherwise the brand owner's view. */
export function BreachRegister({ platform, brands = [] }: { platform: boolean; brands?: { id: string; name: string }[] }) {
  const base = platform ? "/api/v2/platform/privacy/breaches" : "/api/v2/privacy/breaches";
  const [items, setItems] = useState<Breach[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ subject: string; body: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(() => {
    setError("");
    httpRequest<{ items: Breach[] }>(base).then((data) => setItems(data.items)).catch((reason) => setError(reason.message));
  }, [base]);
  useEffect(() => { load(); }, [load]);
  // Countdown timers: re-render every 30 s.
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const [form, setForm] = useState({ organizationId: "", title: "", nature: "", severity: "MEDIUM", detectedAt: localNow(), affectedCount: "", dataCategories: [] as string[], certInReportable: true });
  const create = async () => {
    setError("");
    try {
      await httpRequest(base, { method: "POST", body: {
        ...(platform && form.organizationId ? { organizationId: form.organizationId } : {}), title: form.title, nature: form.nature, severity: form.severity,
        detectedAt: new Date(form.detectedAt).toISOString(), dataCategories: form.dataCategories, certInReportable: form.certInReportable,
        ...(form.affectedCount ? { affectedCount: Number(form.affectedCount) } : {}),
      } });
      setCreating(false); setForm({ ...form, title: "", nature: "", affectedCount: "", dataCategories: [] }); load();
    } catch (reason) { setError((reason as Error).message); }
  };
  const patch = async (item: Breach, body: Record<string, unknown>) => {
    setError("");
    try { await httpRequest(`${base}/${item.id}`, { method: "PATCH", body: { version: item.version, ...body } }); load(); }
    catch (reason) { setError((reason as Error).message); }
  };
  const showNotice = async (item: Breach) => {
    try { setNotice(await httpRequest<{ subject: string; body: string }>(`${base}/${item.id}/notice`)); } catch (reason) { setError((reason as Error).message); }
  };

  return (
    <section className="pv-section" aria-label="Breach register">
      <div className="pv-row between">
        <p className="pv-muted">Log every suspected personal-data breach or cyber incident as soon as it is detected. Clocks run from detection: CERT-In 6 h, Data Protection
          Board intimation and affected employees “without delay” (24 h internal target), detailed Board report 72 h. Confirm timelines with counsel.</p>
        <div className="pv-row">
          <button className="cw-btn ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Log incident</button>
        </div>
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {creating && (
        <div className="pv-card">
          <div className="pv-row between"><h2><Siren size={18} /> New incident</h2><button className="cw-icon-button" aria-label="Close" onClick={() => setCreating(false)}><X size={16} /></button></div>
          <div className="pv-form">
            {platform && (
              <label>Brand<select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
                <option value="">All brands (platform-wide)</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select></label>
            )}
            <label>Detected at<input type="datetime-local" value={form.detectedAt} onChange={(event) => setForm({ ...form, detectedAt: event.target.value })} /></label>
            <label className="wide">Title<input value={form.title} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Payslips emailed to the wrong recipient" /></label>
            <label className="wide">What happened<textarea value={form.nature} maxLength={4000} onChange={(event) => setForm({ ...form, nature: event.target.value })} /></label>
            <label>Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>People affected (approx.)<input type="number" min={0} value={form.affectedCount} onChange={(event) => setForm({ ...form, affectedCount: event.target.value })} /></label>
            <label className="wide">Data involved
              <select multiple value={form.dataCategories} onChange={(event) => setForm({ ...form, dataCategories: [...event.target.selectedOptions].map((option) => option.value) })}>
                {CATEGORIES.map((value) => <option key={value}>{value}</option>)}
              </select><small>Hold Ctrl / ⌘ to choose several.</small></label>
            <label className="pv-check wide"><input type="checkbox" checked={form.certInReportable} onChange={(event) => setForm({ ...form, certInReportable: event.target.checked })} /> Reportable to CERT-In (cyber incident)</label>
          </div>
          <div className="pv-row"><button className="cw-btn primary" disabled={form.title.length < 5 || form.nature.length < 10} onClick={create}>Log incident</button></div>
        </div>
      )}
      {!items ? <div className="cw-list-skeleton"><i /><i /></div> : !items.length ? (
        <div className="cw-empty"><span><CheckCircle2 size={26} /></span><h2>No incidents logged</h2><p className="pv-muted">Good. Keep this register ready — the clocks start at detection.</p></div>
      ) : items.map((item) => (
        <article className="pv-card" key={item.id}>
          <div className="pv-row between">
            <div><small className="pv-muted">{item.reference} · {item.brand} · detected {fmt(item.detectedAt)}</small><h2>{item.title}</h2></div>
            <div className="pv-row">
              <span className={`pv-status ${item.status === "CLOSED" ? "ok" : item.severity === "HIGH" || item.severity === "CRITICAL" ? "bad" : "warn"}`}>{item.severity} · {item.status}</span>
              <button className="cw-btn ghost" onClick={() => setOpen(open === item.id ? null : item.id)}>{open === item.id ? "Hide" : "Details"}</button>
            </div>
          </div>
          <div className="pv-clocks">
            {item.clocks.map((clock) => (
              <div key={clock.key} className={`pv-clock ${clock.state}`} title={clock.basis}>
                <b>{clock.label}</b>
                <span><Clock size={12} /> {clock.state === "done" ? `Done ${fmt(clock.doneAt!)}` : `${left(clock.dueAt, now)} · due ${fmt(clock.dueAt)}`}</span>
                {clock.internalTarget && <small>internal target</small>}
                {item.canEdit && clock.state !== "done" && <button className="cw-btn ghost" onClick={() => patch(item, { notified: { [clock.key]: true } })}>Mark done now</button>}
              </div>
            ))}
          </div>
          {open === item.id && <BreachDetail item={item} onSave={(body) => patch(item, body)} onNotice={() => showNotice(item)} />}
        </article>
      ))}
      {notice && (
        <div className="pv-card">
          <div className="pv-row between"><h2>Notice to affected employees</h2><button className="cw-icon-button" aria-label="Close" onClick={() => setNotice(null)}><X size={16} /></button></div>
          <p><b>Subject:</b> {notice.subject}</p>
          <pre className="pv-pre">{notice.body}</pre>
          <div className="pv-row"><button className="cw-btn ghost" onClick={() => navigator.clipboard?.writeText(`${notice.subject}\n\n${notice.body}`)}><Copy size={15} /> Copy</button>
            <span className="pv-muted">Fill the [bracketed] parts, have it reviewed, then send it to each affected person.</span></div>
        </div>
      )}
    </section>
  );
}

function BreachDetail({ item, onSave, onNotice }: { item: Breach; onSave: (body: Record<string, unknown>) => void; onNotice: () => void }) {
  const [draft, setDraft] = useState({ likelyConsequences: item.likelyConsequences || "", containment: item.containment || "", mitigation: item.mitigation || "",
    affectedDescription: item.affectedDescription || "", status: item.status });
  return (
    <div className="pv-section">
      <p className="pv-muted">{item.nature}</p>
      <p className="pv-muted">Data: {item.dataCategories.join(", ") || "—"} · People affected: {item.affectedCount ?? "unknown"}</p>
      <div className="pv-form">
        <label className="wide">Who is affected<textarea value={draft.affectedDescription} disabled={!item.canEdit} onChange={(event) => setDraft({ ...draft, affectedDescription: event.target.value })} /></label>
        <label className="wide">Likely consequences<textarea value={draft.likelyConsequences} disabled={!item.canEdit} onChange={(event) => setDraft({ ...draft, likelyConsequences: event.target.value })} /></label>
        <label>Containment<textarea value={draft.containment} disabled={!item.canEdit} onChange={(event) => setDraft({ ...draft, containment: event.target.value })} /></label>
        <label>Mitigation / remediation<textarea value={draft.mitigation} disabled={!item.canEdit} onChange={(event) => setDraft({ ...draft, mitigation: event.target.value })} /></label>
        <label>Status<select value={draft.status} disabled={!item.canEdit} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{["OPEN", "CONTAINED", "CLOSED"].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="pv-row">
        {item.canEdit && <button className="cw-btn primary" onClick={() => onSave(draft)}>Save</button>}
        <button className="cw-btn ghost" onClick={onNotice}>Employee notice template</button>
      </div>
    </div>
  );
}
