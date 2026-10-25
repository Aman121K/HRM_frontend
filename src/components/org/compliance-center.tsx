"use client";
import { AlertTriangle, BadgeCheck, Check, ClipboardCheck, Download, FileText, Fingerprint, Link as LinkIcon, Loader2, Plus, RefreshCw, ScrollText, ShieldCheck, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { relativeTime, shortDate } from "@/lib/cases";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Framework = "iso27001" | "soc2";
type ControlStatus = "passing" | "attention" | "failing" | "in_progress" | "needs_evidence" | "not_applicable";
type CheckResult = { id: string; title: string; result: string; detail: string | null };
type ControlRow = {
  id: string; title: string; theme: string; description: string; checks: string[]; status: ControlStatus; manualEvidence: number; checkResults: CheckResult[];
  state: { status: string; owner: string | null; notes: string | null; version: number; updatedAt: string | null };
};
type Overview = { framework: Framework; name: string; short: string; description: string; readiness: number; counts: Partial<Record<ControlStatus, number>>; total: number; lastCollected: string; controls: ControlRow[] };
type Review = { id: string; title: string; status: "OPEN" | "CLOSED"; dueAt: string; createdAt: string; closedAt: string | null; createdBy?: string; total?: number; decided?: number; revoked?: number; flagged?: number };
type ReviewItem = { id: string; kind: string; role: string; employeeStatus: string | null; lastSignInAt: string | null; flags: string[]; decision: "KEEP" | "REVOKE" | null; note: string | null; decidedBy: string | null; appliedAt: string | null; isSelf: boolean; fullName: string; email: string; brand: string };
type Policy = { id: string; key: string; version: number; title: string; summary: string; body: string; publishedAt: string; audience: number; acknowledged: number; percent: number; history: { version: number; status: string; publishedAt: string }[] };
type Chain = { verifiedAt: string; total: number; intact: boolean; brands: { id: string; name: string; total: number; tampered: number; broken: number; gaps: number; unchained: number; lastEntry: string | null }[] };

const STATUS: Record<ControlStatus, [string, string]> = {
  passing: ["Passing", "success"], attention: ["Attention", "warning"], failing: ["Failing", "danger"],
  in_progress: ["In progress", "info"], needs_evidence: ["Needs evidence", "neutral"], not_applicable: ["Not applicable", "neutral"],
};
const RESULT: Record<string, [string, string]> = { pass: ["Pass", "success"], warn: ["Attention", "warning"], fail: ["Fail", "danger"], manual: ["Manual", "neutral"], pending: ["Pending", "neutral"], info: ["Recorded", "info"] };
const FLAG: Record<string, string> = { privileged: "Privileged", employee_inactive: "Left / no employee record", inactive_90d: "No sign-in 90 days", never_signed_in: "Never signed in" };
const STATE_LABEL: Record<string, string> = { not_started: "Not started", in_progress: "In progress", implemented: "Implemented", not_applicable: "Not applicable" };
const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);
const Badge = ({ map, value }: { map: Record<string, [string, string]>; value: string }) => {
  const [label, tone] = map[value] || [value, "neutral"];
  return <span className={`cw-badge tone-${tone}`}>{label}</span>;
};

/** Super admin Compliance Center: ISO 27001 / SOC 2 controls, evidence, access reviews, policies and audit-trail integrity. */
export function ComplianceCenter() {
  const [framework, setFramework] = useState<Framework>("iso27001");
  const [tab, setTab] = useState<"controls" | "reviews" | "policies" | "trail">("controls");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "collect" | "export">("");
  const [toast, setToast] = useState("");
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2600); };
  const load = useCallback(() => {
    setError("");
    httpRequest<Overview>(`/api/v2/platform/compliance/overview?framework=${framework}`).then(setOverview).catch((reason) => setError(message(reason, "Couldn't load compliance.")));
  }, [framework]);
  useEffect(() => { setOverview(null); load(); }, [load]);
  const collect = async () => {
    setBusy("collect");
    try { const result = await httpRequest<{ checks: number; failing: number }>("/api/v2/platform/compliance/collect", { method: "POST", body: {} }); notify(`${result.checks} checks recorded as evidence · ${result.failing} failing`); load(); }
    catch (reason) { setError(message(reason, "Couldn't collect evidence.")); } finally { setBusy(""); }
  };
  const exportPack = async () => {
    setBusy("export");
    try { await downloadFile(`/api/v2/platform/compliance/export?framework=${framework}`, `northstar-${framework}-auditor-pack.json`); notify("Auditor pack downloaded"); }
    catch (reason) { setError(message(reason, "Couldn't export.")); } finally { setBusy(""); }
  };
  const counts = overview?.counts || {};
  return (
    <div className="cw-page cc-page" style={{ ["--accent" as string]: "#1d4b5c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><BadgeCheck size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PLATFORM · COMPLIANCE</p>
          <h1>ISO 27001 &amp; SOC 2</h1>
          <p>Controls are checked automatically every night and the results are kept as tamper-proof evidence. The certificate itself is issued by an accredited auditor — this keeps you ready for that audit, all year.</p>
        </div>
        <div className="cc-actions">
          <button className="cw-btn ghost" onClick={collect} disabled={!!busy}>{busy === "collect" ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Collect evidence now</button>
          <button className="cw-btn primary" onClick={exportPack} disabled={!!busy}>{busy === "export" ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Auditor pack</button>
        </div>
      </header>
      <div className="cc-frameworks" role="radiogroup" aria-label="Framework">
        {(["iso27001", "soc2"] as Framework[]).map((value) => (
          <button key={value} role="radio" aria-checked={framework === value} className={framework === value ? "active" : ""} onClick={() => setFramework(value)}>
            <b>{value === "iso27001" ? "ISO/IEC 27001:2022" : "SOC 2 Type II"}</b><small>{value === "iso27001" ? "Annex A controls" : "Trust Services Criteria"}</small>
          </button>
        ))}
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!overview ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <section className="sc-top">
          <div className={`sc-score ${overview.readiness >= 90 ? "good" : overview.readiness >= 60 ? "ok" : "bad"}`} role="img" aria-label={`Audit readiness ${overview.readiness} percent`}>
            <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="52" /><circle cx="60" cy="60" r="52" className="arc" strokeDasharray={`${(overview.readiness / 100) * 326.7} 326.7`} /></svg>
            <b>{overview.readiness}%</b><small>audit ready</small>
          </div>
          <div className="cw-stats sc-stats">
            <article><small>Passing</small><b>{counts.passing || 0}</b><span>of {overview.total} controls</span></article>
            <article className={counts.failing ? "attention" : ""}><small>Failing</small><b>{counts.failing || 0}</b><span>fix before the audit</span></article>
            <article><small>Attention</small><b>{counts.attention || 0}</b><span>partly met</span></article>
            <article><small>Needs evidence</small><b>{(counts.needs_evidence || 0) + (counts.in_progress || 0)}</b><span>{overview.lastCollected ? `checked ${relativeTime(overview.lastCollected)}` : "not checked yet"}</span></article>
          </div>
        </section>
      )}
      <nav className="cw-tabs" role="tablist" aria-label="Compliance sections">
        {([["controls", "Controls", ShieldCheck], ["reviews", "Access reviews", UserCheck], ["policies", "Policies", ScrollText], ["trail", "Audit trail", Fingerprint]] as const).map(([key, label, Icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </nav>
      {tab === "controls" && overview && <Controls overview={overview} onChanged={(text) => { notify(text); load(); }} />}
      {tab === "reviews" && <AccessReviews onChanged={(text) => { notify(text); load(); }} />}
      {tab === "policies" && <Policies onChanged={(text) => { notify(text); load(); }} />}
      {tab === "trail" && <AuditTrail />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Controls({ overview, onChanged }: { overview: Overview; onChanged: (text: string) => void }) {
  const [filter, setFilter] = useState<ControlStatus | "all">("all");
  const [open, setOpen] = useState<ControlRow | null>(null);
  const shown = overview.controls.filter((control) => filter === "all" || control.status === filter);
  const themes = [...new Set(shown.map((control) => control.theme))];
  return (
    <section aria-label="Controls">
      <div className="cw-chips" role="group" aria-label="Filter by status">
        {(["all", "failing", "attention", "needs_evidence", "in_progress", "passing", "not_applicable"] as const).map((value) => (
          <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {value === "all" ? `All ${overview.total}` : `${STATUS[value][0]} ${overview.counts[value] || 0}`}
          </button>
        ))}
      </div>
      {!shown.length && <p className="cw-empty">No controls with this status.</p>}
      {themes.map((theme) => (
        <div key={theme} className="cc-group">
          <p className="cw-section-label">{theme}</p>
          {shown.filter((control) => control.theme === theme).map((control) => (
            <button key={control.id} className={`cc-control ${control.status}`} onClick={() => setOpen(control)}>
              <code>{control.id}</code>
              <span><b>{control.title}</b><small>{control.description}</small>
                <span className="cc-checks">{control.checkResults.map((check) => <i key={check.id} className={`r-${check.result}`} title={`${check.title}: ${RESULT[check.result]?.[0] || check.result}`}>{check.title}</i>)}
                  {control.manualEvidence > 0 && <i className="r-info"><FileText size={11} /> {control.manualEvidence} document{control.manualEvidence > 1 ? "s" : ""}</i>}</span>
              </span>
              <Badge map={STATUS} value={control.status} />
            </button>
          ))}
        </div>
      ))}
      {open && <ControlDrawer framework={overview.framework} control={open} onClose={() => setOpen(null)} onChanged={(text) => { setOpen(null); onChanged(text); }} />}
    </section>
  );
}

type Detail = { automated: { id: string; checkId: string; title: string; detail: string; result: string; sha256: string; collectedAt: string }[]; manual: { id: string; title: string; detail: string | null; link: string | null; sha256: string; collectedAt: string; collectedBy: string | null }[] };

function ControlDrawer({ framework, control, onClose, onChanged }: { framework: Framework; control: ControlRow; onClose: () => void; onChanged: (text: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [state, setState] = useState({ status: control.state.status, owner: control.state.owner || "", notes: control.state.notes || "" });
  const [evidence, setEvidence] = useState({ title: "", detail: "", link: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const path = `/api/v2/platform/compliance/controls/${framework}/${encodeURIComponent(control.id)}`;
  const loadDetail = useCallback(() => httpRequest<Detail>(path).then(setDetail).catch((reason) => setError(message(reason, "Couldn't load evidence."))), [path]);
  useEffect(() => { loadDetail(); }, [loadDetail]);
  const save = async () => {
    setSaving(true); setError("");
    try { await httpRequest(path, { method: "PATCH", body: { ...state, version: control.state.version } }); onChanged(`${control.id} updated`); }
    catch (reason) { setError(message(reason, "Couldn't save.")); setSaving(false); }
  };
  const addEvidence = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try {
      await httpRequest(`${path}/evidence`, { method: "POST", body: { title: evidence.title, detail: evidence.detail || undefined, link: evidence.link || undefined } });
      setEvidence({ title: "", detail: "", link: "" }); loadDetail();
    } catch (reason) { setError(message(reason, "Couldn't add evidence.")); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer cc-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cc-control-title">
        <header className="cw-drawer-head">
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{framework === "iso27001" ? "ISO 27001" : "SOC 2"} · {control.id} · {control.theme.toUpperCase()}</p>
          <h2 id="cc-control-title">{control.title}</h2>
          <p className="cc-desc">{control.description}</p>
          <Badge map={STATUS} value={control.status} />
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <p className="cw-section-label">Automated checks</p>
          {!control.checkResults.length ? <p className="cw-muted">This control is procedural — record documents or screenshots below as evidence.</p> : control.checkResults.map((check) => (
            <div key={check.id} className="cc-check"><Badge map={RESULT} value={check.result} /><div><b>{check.title}</b><p>{check.detail || "Not collected yet."}</p></div></div>
          ))}
          {detail && detail.automated.length > 0 && (
            <details className="cc-history"><summary>Evidence history ({detail.automated.length})</summary>
              <table className="sc-table"><thead><tr><th>When</th><th>Check</th><th>Result</th><th>SHA-256</th></tr></thead>
                <tbody>{detail.automated.map((row) => <tr key={row.id}><td>{shortDate(row.collectedAt)}</td><td>{row.title}</td><td><Badge map={RESULT} value={row.result} /></td><td><code title={row.sha256}>{row.sha256.slice(0, 12)}…</code></td></tr>)}</tbody></table>
            </details>
          )}
          <p className="cw-section-label">Implementation</p>
          <div className="cw-fields">
            <label><span>Status</span><select value={state.status} onChange={(event) => setState({ ...state, status: event.target.value })}>{Object.entries(STATE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Control owner</span><input value={state.owner} maxLength={120} placeholder="e.g. Head of IT" onChange={(event) => setState({ ...state, owner: event.target.value })} /></label>
            <label className="wide"><span>How we meet this</span><textarea rows={3} maxLength={4000} value={state.notes} placeholder="Procedure, tools, frequency…" onChange={(event) => setState({ ...state, notes: event.target.value })} /></label>
          </div>
          <button className="cw-btn primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save</button>
          <p className="cw-section-label">Documents &amp; evidence</p>
          {detail?.manual.map((row) => (
            <div key={row.id} className="cc-evidence">
              <FileText size={16} aria-hidden />
              <div><b>{row.title}</b>{row.detail && <p>{row.detail}</p>}
                <small>{row.collectedBy || "System"} · {shortDate(row.collectedAt)} · <code title={row.sha256}>sha256 {row.sha256.slice(0, 10)}…</code></small>
                {row.link && <a href={row.link} target="_blank" rel="noopener noreferrer"><LinkIcon size={12} /> Open document</a>}</div>
            </div>
          ))}
          {detail && !detail.manual.length && <p className="cw-muted">No documents yet.</p>}
          <form className="cc-add" onSubmit={addEvidence}>
            <input required minLength={3} maxLength={200} placeholder="Evidence title, e.g. Backup restore test — Sep 2026" value={evidence.title} onChange={(event) => setEvidence({ ...evidence, title: event.target.value })} />
            <input type="url" pattern="https://.*" maxLength={1000} placeholder="https:// link to the document (Drive, SharePoint, Jira…)" value={evidence.link} onChange={(event) => setEvidence({ ...evidence, link: event.target.value })} />
            <textarea rows={2} maxLength={4000} placeholder="What it shows (optional)" value={evidence.detail} onChange={(event) => setEvidence({ ...evidence, detail: event.target.value })} />
            <button className="cw-btn ghost"><Plus size={15} /> Add evidence</button>
            <small className="cw-muted">Evidence can't be edited or deleted once added — add a newer record instead.</small>
          </form>
        </div>
      </aside>
    </>
  );
}

function AccessReviews({ onChanged }: { onChanged: (text: string) => void }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => httpRequest<{ items: Review[] }>("/api/v2/platform/compliance/access-reviews").then((data) => {
    setReviews(data.items);
    setActive((current) => current || data.items.find((review) => review.status === "OPEN")?.id || null);
  }).catch((reason) => setError(message(reason, "Couldn't load reviews."))), []);
  useEffect(() => { load(); }, [load]);
  const start = async () => {
    setError("");
    try { const created = await httpRequest<{ id: string }>("/api/v2/platform/compliance/access-reviews", { method: "POST", body: {} }); setActive(created.id); load(); onChanged("Access review started"); }
    catch (reason) { setError(message(reason, "Couldn't start a review.")); }
  };
  const open = reviews?.some((review) => review.status === "OPEN");
  return (
    <section aria-label="Access reviews">
      <div className="cc-bar">
        <p>Every quarter, confirm that each person still needs their access. Revoked access is removed when the review is closed, and nobody can approve their own access.</p>
        <button className="cw-btn primary" onClick={start} disabled={!!open}><ClipboardCheck size={15} /> Start access review</button>
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!reviews ? <div className="cw-list-skeleton"><i /></div> : !reviews.length ? <p className="cw-empty">No access reviews yet. Start the first one — auditors expect one every quarter.</p> : (
        <div className="cc-reviews">
          {reviews.map((review) => (
            <button key={review.id} className={`cc-review ${active === review.id ? "active" : ""}`} onClick={() => setActive(review.id)}>
              <span><b>{review.title}</b><small>{review.status === "OPEN" ? `Due ${shortDate(review.dueAt)}` : `Closed ${shortDate(review.closedAt!)}`} · {review.decided}/{review.total} decided{review.revoked ? ` · ${review.revoked} revoked` : ""}</small></span>
              <span className={`cw-badge tone-${review.status === "OPEN" ? "warning" : "success"}`}>{review.status === "OPEN" ? "Open" : "Closed"}</span>
            </button>
          ))}
        </div>
      )}
      {active && <ReviewDetail key={active} id={active} onChanged={(text) => { load(); onChanged(text); }} />}
    </section>
  );
}

function ReviewDetail({ id, onChanged }: { id: string; onChanged: (text: string) => void }) {
  const [review, setReview] = useState<(Review & { items: ReviewItem[] }) | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revoking, setRevoking] = useState<string | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => httpRequest<Review & { items: ReviewItem[] }>(`/api/v2/platform/compliance/access-reviews/${id}`).then(setReview).catch((reason) => setError(message(reason, "Couldn't load the review."))), [id]);
  useEffect(() => { load(); }, [load]);
  const decide = async (item: ReviewItem, decision: "KEEP" | "REVOKE") => {
    setError("");
    try { await httpRequest(`/api/v2/platform/compliance/access-review-items/${item.id}/decision`, { method: "POST", body: { decision, note: notes[item.id] || undefined } }); setRevoking(null); load(); }
    catch (reason) { setError(message(reason, "Couldn't save the decision.")); }
  };
  const close = async () => {
    setError("");
    try { const summary = await httpRequest<{ total: number; kept: number; revoked: number }>(`/api/v2/platform/compliance/access-reviews/${id}/close`, { method: "POST", body: {} }); onChanged(`Review closed · ${summary.kept} kept, ${summary.revoked} revoked`); load(); }
    catch (reason) { setError(message(reason, "Couldn't close the review.")); }
  };
  const items = useMemo(() => (review?.items || []).filter((item) => !onlyFlagged || item.flags.some((flag) => flag !== "privileged")), [review, onlyFlagged]);
  if (!review) return <div className="cw-list-skeleton"><i /><i /></div>;
  const pending = review.items.filter((item) => !item.decision).length;
  const isOpen = review.status === "OPEN";
  return (
    <div className="cc-review-detail">
      <header>
        <h3>{review.title}</h3>
        <label className="cc-toggle"><input type="checkbox" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} /> Only flagged accounts</label>
        {isOpen && <button className="cw-btn primary" onClick={close} disabled={pending > 0} title={pending ? `${pending} item(s) still need a decision` : undefined}><Check size={15} /> Close &amp; apply ({pending} left)</button>}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <div className="cc-items">
        {items.map((item) => (
          <article key={item.id} className={`cc-item ${item.decision?.toLowerCase() || ""}`}>
            <div className="cc-who"><b>{item.fullName}</b><small>{item.email}</small></div>
            <div className="cc-what"><span>{item.brand}</span><code>{item.role.replace("_", " ")}</code>
              <small>{item.lastSignInAt ? `Signed in ${relativeTime(item.lastSignInAt)}` : "Never signed in"}</small></div>
            <div className="cc-flags">{item.flags.map((flag) => <span key={flag} className={`cw-badge tone-${flag === "privileged" ? "info" : "warning"}`}>{FLAG[flag] || flag}</span>)}</div>
            <div className="cc-decide">
              {item.decision ? (
                <span className={`cw-badge tone-${item.decision === "KEEP" ? "success" : "danger"}`} title={item.note || undefined}>{item.decision === "KEEP" ? "Kept" : item.appliedAt ? "Revoked" : "Revoke on close"}{item.decidedBy ? ` · ${item.decidedBy}` : ""}</span>
              ) : !isOpen ? null : item.isSelf ? (
                <small className="cw-muted">Another admin must review your access</small>
              ) : revoking === item.id ? (
                <span className="cc-revoke">
                  <input autoFocus maxLength={500} placeholder="Reason (required)" value={notes[item.id] || ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} />
                  <button className="cw-btn danger" disabled={!notes[item.id]?.trim()} onClick={() => decide(item, "REVOKE")}>Revoke</button>
                  <button className="cw-btn ghost" onClick={() => setRevoking(null)}>Cancel</button>
                </span>
              ) : (
                <>
                  <button className="cw-btn ghost" onClick={() => decide(item, "KEEP")}><Check size={14} /> Keep</button>
                  <button className="cw-btn ghost" onClick={() => setRevoking(item.id)}><X size={14} /> Revoke</button>
                </>
              )}
            </div>
          </article>
        ))}
        {!items.length && <p className="cw-empty">No flagged accounts in this review.</p>}
      </div>
    </div>
  );
}

function Policies({ onChanged }: { onChanged: (text: string) => void }) {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [editing, setEditing] = useState<Policy | "new" | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => httpRequest<{ items: Policy[] }>("/api/v2/platform/compliance/policies").then((data) => setPolicies(data.items)).catch((reason) => setError(message(reason, "Couldn't load policies."))), []);
  useEffect(() => { load(); }, [load]);
  return (
    <section aria-label="Policies">
      <div className="cc-bar">
        <p>Everyone in every brand is asked to read and accept the current version when they open the app. Publishing a new version asks them again.</p>
        <button className="cw-btn primary" onClick={() => setEditing("new")}><Plus size={15} /> New policy</button>
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!policies ? <div className="cw-list-skeleton"><i /></div> : (
        <div className="cc-policies">
          {policies.map((policy) => (
            <article key={policy.id} className="cc-policy">
              <header><ScrollText size={18} aria-hidden /><div><b>{policy.title}</b><small>Version {policy.version} · published {shortDate(policy.publishedAt)}</small></div></header>
              <p>{policy.summary}</p>
              <div className="cc-progress" role="img" aria-label={`${policy.percent}% accepted`}><i style={{ width: `${policy.percent}%` }} className={policy.percent >= 95 ? "good" : policy.percent >= 50 ? "ok" : "bad"} /></div>
              <small>{policy.acknowledged} of {policy.audience} people accepted ({policy.percent}%)</small>
              <button className="cw-btn ghost" onClick={() => setEditing(policy)}>Publish new version</button>
            </article>
          ))}
        </div>
      )}
      {editing && <PolicyDrawer policy={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); load(); onChanged(text); }} />}
    </section>
  );
}

function PolicyDrawer({ policy, onClose, onSaved }: { policy: Policy | null; onClose: () => void; onSaved: (text: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [form, setForm] = useState({ title: policy?.title || "", summary: policy?.summary || "", body: policy?.body || "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { const saved = await httpRequest<{ version: number }>("/api/v2/platform/compliance/policies", { method: "POST", body: { ...form, key: policy?.key } }); onSaved(`${form.title} v${saved.version} published`); }
    catch (reason) { setError(message(reason, "Couldn't publish.")); setSaving(false); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer cc-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cc-policy-title">
        <header className="cw-drawer-head">
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{policy ? `NEW VERSION · v${policy.version + 1}` : "NEW POLICY"}</p>
          <h2 id="cc-policy-title">{policy?.title || "Publish a policy"}</h2>
        </header>
        <form className="cw-drawer-body" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="cw-fields">
            <label className="wide"><span>Title</span><input required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label className="wide"><span>One-line summary</span><input required minLength={3} maxLength={400} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
            <label className="wide"><span>Policy text</span><textarea required minLength={20} maxLength={40000} rows={16} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          </div>
          {policy && <p className="cw-alert warn"><AlertTriangle size={15} /> Everyone will be asked to accept the new version.</p>}
          <button className="cw-btn primary" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Publish</button>
        </form>
      </aside>
    </>
  );
}

function AuditTrail() {
  const [chain, setChain] = useState<Chain | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = useCallback(() => {
    setBusy(true); setError("");
    httpRequest<Chain>("/api/v2/platform/compliance/audit-chain").then(setChain).catch((reason) => setError(message(reason, "Couldn't verify."))).finally(() => setBusy(false));
  }, []);
  useEffect(() => { verify(); }, [verify]);
  return (
    <section aria-label="Audit trail integrity">
      <div className="cc-bar">
        <p>Every change in every brand is written to an append-only audit log. Each entry carries the SHA-256 hash of the entry before it, so editing or deleting any past entry breaks the chain and shows up here.</p>
        <button className="cw-btn ghost" onClick={verify} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Fingerprint size={15} />} Verify now</button>
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!chain ? <div className="cw-list-skeleton"><i /></div> : (
        <>
          <p className={`cw-alert ${chain.intact ? "ok" : ""}`} role="status">
            {chain.intact ? <Check size={15} /> : <AlertTriangle size={15} />}
            {chain.intact ? `All ${chain.total.toLocaleString("en-IN")} audit entries verified — no tampering. (${relativeTime(chain.verifiedAt)})` : "Tampering detected. Treat this as a security incident and compare with backups."}
          </p>
          <table className="sc-table cc-chain"><thead><tr><th>Brand</th><th>Entries</th><th>Altered</th><th>Broken links</th><th>Missing</th><th>Latest entry</th></tr></thead>
            <tbody>{chain.brands.map((brand) => {
              const bad = brand.tampered || brand.broken || brand.gaps || brand.unchained;
              return (
                <tr key={brand.id} className={bad ? "bad" : ""}>
                  <td><b>{brand.name}</b></td><td>{brand.total.toLocaleString("en-IN")}</td><td>{brand.tampered}</td><td>{brand.broken}</td><td>{brand.gaps}</td>
                  <td>{brand.lastEntry ? relativeTime(brand.lastEntry) : "—"} {bad ? <span className="cw-badge tone-danger">Check</span> : <span className="cw-badge tone-success">Intact</span>}</td>
                </tr>
              );
            })}</tbody></table>
        </>
      )}
    </section>
  );
}
