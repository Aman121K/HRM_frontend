"use client";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, History, IdCard, Loader2, Plus, Search, Trash2, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { initials, shortDate } from "@/lib/cases";
import { payrollApi, errorText, inr, inrShort, monthLabel, STATE_NAMES, type EmployeeStructures, type Meta, type PiiField, type Preview, type Profile, type StatutoryFlags, type StructureListItem } from "./api";
import { ACCENT, Badge, Disclaimer, Drawer, ErrorState, Note, PermissionState, SensitiveValue } from "./ui";

type Filter = "all" | "missing" | "esi" | "issues" | "upcoming";

export function SalaryStructures() {
  const router = useRouter();
  const params = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<StructureListItem[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(params.get("employee"));
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const m = await payrollApi.meta();
      setMeta(m);
      if (m.viewer.canManage) setItems((await payrollApi.structures()).items);
    } catch (reason) { setError(errorText(reason, "Unable to load salary structures.")); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  const list = items || [];
  const counts = useMemo(() => ({
    missing: list.filter((item) => !item.current).length,
    esi: list.filter((item) => item.current && item.current.fixedMonthlyGross <= 21000).length,
    issues: list.filter((item) => !item.hasBank || !item.hasPan).length,
    upcoming: list.filter((item) => item.upcoming).length,
  }), [list]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((item) => {
      if (filter === "missing" && item.current) return false;
      if (filter === "esi" && !(item.current && item.current.fixedMonthlyGross <= 21000)) return false;
      if (filter === "issues" && item.hasBank && item.hasPan) return false;
      if (filter === "upcoming" && !item.upcoming) return false;
      return !term || `${item.name} ${item.number} ${item.department || ""} ${item.location || ""}`.toLowerCase().includes(term);
    });
  }, [list, filter, search]);

  if (error && !meta) return <div className="cw-page pe-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (!meta) return <div className="cw-page pe-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  if (!meta.viewer.canManage) return <div className="cw-page pe-page"><PermissionState title="Salary structures are restricted" body="Only payroll and HR administrators can see and change salaries. Your own salary breakdown is in My payroll." /></div>;

  const withCtc = list.filter((item) => item.current);
  const totalCtc = withCtc.reduce((sum, item) => sum + (item.current?.annualCtc || 0), 0);
  const close = () => { setOpen(null); if (params.get("employee")) router.replace("/payroll/structures"); };

  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/payroll/admin" className="pe-back"><ArrowLeft size={15} /> Payroll runs</Link>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Wallet size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAY &amp; CLAIMS · COMPENSATION</p>
          <h1>Salary structures</h1>
          <p>Effective-dated CTC breakdowns with statutory contributions, payroll profiles (PAN, UAN, bank, PT state, tax regime) and full revision history.</p>
        </div>
      </header>
      <Disclaimer text={meta.disclaimer} version={meta.ruleset.version} />
      <section className="cw-stats" aria-label="Summary">
        <article><small>With a structure</small><b>{withCtc.length}<span className="pe-of">/{list.length}</span></b><span>active employees</span></article>
        <article className={counts.missing ? "attention" : ""}><small>Missing structure</small><b>{counts.missing}</b><span>{counts.missing ? "excluded from payroll" : "everyone is set up"}</span></article>
        <article><small>Annual CTC</small><b>{inrShort(totalCtc)}</b><span>avg {inrShort(withCtc.length ? totalCtc / withCtc.length : 0)}</span></article>
        <article><small>ESI covered</small><b>{counts.esi}</b><span>gross ≤ ₹21,000 / month</span></article>
      </section>

      <div className="cw-toolbar">
        <div className="cw-chips pe-chips-inline" aria-label="Filter employees">
          {([["all", "All", list.length], ["missing", "No structure", counts.missing], ["issues", "Missing PAN / bank", counts.issues], ["esi", "ESI covered", counts.esi], ["upcoming", "Upcoming revision", counts.upcoming]] as [Filter, string, number][]).map(([key, label, count]) => (
            <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label} <b>{count}</b></button>
          ))}
        </div>
        <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" aria-label="Search employees" />{search && <button aria-label="Clear" onClick={() => setSearch("")}><X size={13} /></button>}</label>
      </div>

      {!items ? <div className="cw-list-skeleton"><i /><i /><i /><i /></div> : !visible.length ? (
        <div className="cw-empty"><span><Users size={26} /></span><h2>No employees match</h2><p>Try a different search or filter.</p></div>
      ) : (
        <div className="cw-table pe-structures" role="table" aria-label="Employees and salary structures">
          <div className="cw-row head" role="row">
            <span role="columnheader">Employee</span><span role="columnheader">Location · PT state</span><span role="columnheader" className="num">Annual CTC</span>
            <span role="columnheader" className="num">Monthly gross</span><span role="columnheader">Effective</span><span role="columnheader">Profile</span><span />
          </div>
          {visible.map((item) => (
            <button key={item.id} role="row" className={`cw-row ${!item.current ? "pe-danger-row" : ""}`} onClick={() => setOpen(item.id)}>
              <span className="cw-person" role="cell"><span className="cw-avatar small">{initials(item.name)}</span><span>{item.name}<small>{item.number} · {item.designation || item.department}</small></span></span>
              <span role="cell">{item.location || "—"}<small className="pe-block pe-muted">{STATE_NAMES[item.state] || item.state} · {item.taxRegime === "OLD" ? "old" : "new"} regime</small></span>
              <span role="cell" className="num">{item.current ? inr(item.current.annualCtc) : <Badge tone="danger" label="None" />}</span>
              <span role="cell" className="num">{item.current ? inr(item.current.fixedMonthlyGross) : "—"}{item.current && item.current.fixedMonthlyGross <= 21000 && <small className="pe-block pe-muted">ESI</small>}</span>
              <span role="cell">{item.current ? shortDate(item.current.effectiveFrom) : "—"}{item.upcoming && <small className="pe-block pe-upcoming">→ {inr(item.upcoming.annualCtc)} from {shortDate(item.upcoming.effectiveFrom)}</small>}</span>
              <span role="cell">{item.hasBank && item.hasPan ? <span className="pe-ok"><Check size={13} /> Complete</span> : <span className="pe-flag tone-warning">{[!item.hasPan && "PAN", !item.hasBank && "bank"].filter(Boolean).join(" · ")} missing</span>}</span>
              <span role="cell" className="cw-row-cta"><ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      )}
      {open && <StructureEditor employeeId={open} onClose={close} onChanged={async (message) => { flash(message); await load(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

type Tab = "salary" | "profile" | "history";

function StructureEditor({ employeeId, onClose, onChanged }: { employeeId: string; onClose: () => void; onChanged: (message: string) => Promise<void> }) {
  const [data, setData] = useState<EmployeeStructures | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("salary");
  const [revising, setRevising] = useState(false);
  const load = useCallback(async () => {
    try { const next = await payrollApi.employee(employeeId); setData(next); setError(""); if (!next.structures.length) setRevising(true); }
    catch (reason) { setError(errorText(reason, "Unable to load this employee.")); }
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);
  const current = data?.structures.find((item) => item.current) || null;

  return (
    <Drawer wide title={data?.employee.name || "Employee"} eyebrow={data ? `${data.employee.number} · SALARY STRUCTURE` : "SALARY STRUCTURE"} onClose={onClose}
      head={data && <div className="cw-head-meta"><span>{data.employee.designation || "—"} · {data.employee.department || "—"}</span><span>{data.employee.location || "No location"}{data.employee.metro ? " · metro" : ""}</span><span>Joined {shortDate(data.employee.joiningDate)}</span></div>}>
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <div className="cw-skeleton" aria-label="Loading"><i /><i /><i /></div>}
      {data && (
        <>
          <div className="cw-tabs pe-drawer-tabs" role="tablist">
            {([["salary", "Salary", Wallet], ["profile", "Payroll profile", IdCard], ["history", `History · ${data.structures.length}`, History]] as [Tab, string, typeof Wallet][]).map(([key, label, Icon]) => (
              <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={14} /> {label}</button>
            ))}
          </div>
          {tab === "salary" && (
            <>
              {!revising && current && <CurrentStructure data={data} />}
              {!revising && !current && data.structures.length > 0 && <Note>Only a future revision exists — it takes effect on {shortDate(data.structures[data.structures.length - 1].effectiveFrom)}.</Note>}
              {!revising && <button className="cw-btn primary" onClick={() => setRevising(true)}><Plus size={15} /> New revision</button>}
              {revising && <RevisionForm data={data} onCancel={data.structures.length ? () => setRevising(false) : undefined}
                onSaved={async (message) => { setRevising(false); await onChanged(message); await load(); }} />}
            </>
          )}
          {tab === "profile" && <ProfileForm data={data} onSaved={async () => { await onChanged("Payroll profile saved"); await load(); }} />}
          {tab === "history" && <HistoryList data={data} onDeleted={async () => { await onChanged("Revision deleted"); await load(); }} />}
        </>
      )}
    </Drawer>
  );
}

function CtcBar({ components, total }: { components: { code: string; label: string; annual: number }[]; total: number }) {
  const parts = components.filter((item) => item.annual > 0);
  return (
    <figure className="pe-ctc-bar">
      <div role="img" aria-label={`CTC split: ${parts.map((item) => `${item.label} ${Math.round((item.annual / total) * 100)}%`).join(", ")}`}>
        {parts.map((item) => <span key={item.code} className={`c-${item.code.toLowerCase()}`} style={{ width: `${(item.annual / total) * 100}%` }} title={`${item.label}: ${inr(item.annual)}`} />)}
      </div>
      <figcaption>{parts.map((item) => <span key={item.code}><i className={`c-${item.code.toLowerCase()}`} />{item.label} {Math.round((item.annual / total) * 100)}%</span>)}</figcaption>
    </figure>
  );
}

function ComponentTable({ components, footer }: { components: { code: string; label: string; kind: string; monthly: number; annual: number; note?: string }[]; footer: { gross: number; ctc: number; monthlyCtc: number } }) {
  const group = (kind: string) => components.filter((item) => item.kind === kind && (item.annual > 0 || item.code === "SPECIAL"));
  return (
    <table className="pe-components">
      <caption className="sr-only">Salary components</caption>
      <thead><tr><th scope="col">Component</th><th scope="col" className="num">Monthly</th><th scope="col" className="num">Annual</th></tr></thead>
      <tbody>
        {group("EARNING").map((item) => <tr key={item.code}><th scope="row">{item.label}{item.note && <small>{item.note}</small>}</th><td className={`num ${item.monthly < 0 ? "neg" : ""}`}>{inr(item.monthly)}</td><td className="num">{inr(item.annual)}</td></tr>)}
        <tr className="pe-subtotal"><th scope="row">Monthly gross</th><td className="num">{inr(footer.gross)}</td><td className="num">{inr(footer.gross * 12)}</td></tr>
        {group("EMPLOYER").map((item) => <tr key={item.code}><th scope="row">{item.label}{item.note && <small>{item.note}</small>}</th><td className="num">{inr(item.monthly)}</td><td className="num">{inr(item.annual)}</td></tr>)}
        {group("VARIABLE").map((item) => <tr key={item.code}><th scope="row">{item.label}{item.note && <small>{item.note}</small>}</th><td className="num pe-muted">—</td><td className="num">{inr(item.annual)}</td></tr>)}
      </tbody>
      <tfoot><tr><th scope="row">Cost to company</th><td className="num">{inr(footer.monthlyCtc)}</td><td className="num">{inr(footer.ctc)}</td></tr></tfoot>
    </table>
  );
}

function CurrentStructure({ data }: { data: EmployeeStructures }) {
  const current = data.structures.find((item) => item.current)!;
  const upcoming = data.structures.filter((item) => item.upcoming).pop();
  return (
    <section className="pe-current">
      <header>
        <div><small>Current CTC · effective {shortDate(current.effectiveFrom)}</small><b>{inr(current.annualCtc)}</b></div>
        <Badge tone="success" label={current.reason.toLowerCase()} />
      </header>
      {upcoming && <p className="cw-alert warn"><History size={15} /> Revision to {inr(upcoming.annualCtc)} takes effect {shortDate(upcoming.effectiveFrom)}.</p>}
      <CtcBar components={current.components} total={current.annualCtc} />
      <ComponentTable components={current.components} footer={{ gross: current.fixedMonthlyGross, ctc: current.annualCtc, monthlyCtc: current.monthlyCtc }} />
      {current.notes && <p className="pe-muted">“{current.notes}” — {current.createdBy}</p>}
    </section>
  );
}

const pct = (value: number) => Math.round(value * 1000) / 10;

function RevisionForm({ data, onCancel, onSaved }: { data: EmployeeStructures; onCancel?: () => void; onSaved: (message: string) => Promise<void> }) {
  const current = data.structures.find((item) => item.current) || data.structures[0];
  const firstOfNext = (() => {
    const today = new Date().toISOString().slice(0, 7);
    const floor = data.lockedThrough && data.lockedThrough >= today ? data.lockedThrough : today;
    const [y, m] = floor.split("-").map(Number);
    const next = data.lockedThrough && data.lockedThrough >= today ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, 1));
    return next.toISOString().slice(0, 10);
  })();
  const [effectiveFrom, setEffectiveFrom] = useState(data.structures.length ? firstOfNext : data.employee.joiningDate > firstOfNext ? data.employee.joiningDate : firstOfNext);
  const [ctc, setCtc] = useState(String(current ? Math.round(current.annualCtc * 1.08) : 360000));
  const [reason, setReason] = useState(data.structures.length ? "REVISION" : "JOINING");
  const [isMetro, setIsMetro] = useState(current?.isMetro ?? data.employee.metro);
  const [basicPct, setBasicPct] = useState(pct(current?.template.basicPct ?? 0.5));
  const [hraPct, setHraPct] = useState(pct(current?.template.hraPct ?? (data.employee.metro ? 0.5 : 0.4)));
  const [conveyance, setConveyance] = useState(String(current?.template.conveyance ?? 1600));
  const [other, setOther] = useState(String(current?.template.otherAllowance ?? 0));
  const [variablePct, setVariablePct] = useState(pct(current?.template.variablePct ?? 0));
  const [gratuity, setGratuity] = useState(current?.template.includeGratuity ?? false);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const body = useMemo(() => ({
    employeeId: data.employee.id, annualCtc: Number(ctc), isMetro,
    template: { basicPct: basicPct / 100, hraPct: hraPct / 100, conveyance: Number(conveyance) || 0, otherAllowance: Number(other) || 0, variablePct: variablePct / 100, includeGratuity: gratuity },
  }), [data.employee.id, ctc, isMetro, basicPct, hraPct, conveyance, other, variablePct, gratuity]);

  useEffect(() => {
    if (!(Number(ctc) >= 10000)) { setPreview(null); setPreviewError("Enter an annual CTC of at least ₹10,000."); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try { const next = await payrollApi.preview(body); if (!cancelled) { setPreview(next); setPreviewError(""); } }
      catch (reason) { if (!cancelled) setPreviewError(errorText(reason, "Unable to preview.")); }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [body, ctc]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const saved = await payrollApi.createStructure({ ...body, effectiveFrom, reason, notes: notes.trim() || undefined });
      await onSaved(`Structure of ${inr(saved.annualCtc)} saved, effective ${shortDate(saved.effectiveFrom)}`);
    } catch (reason) { setError(errorText(reason, "Unable to save the structure.")); } finally { setBusy(false); }
  };
  const change = current && preview ? preview.annualCtc - current.annualCtc : 0;

  return (
    <form className="pe-revision" onSubmit={submit}>
      <div className="pe-revision-head"><b>{data.structures.length ? "New salary revision" : "Set up salary structure"}</b>{data.lockedThrough && <small>Payroll is published through {monthLabel(data.lockedThrough)} — revisions must start after it.</small>}</div>
      {error && <ErrorState message={error} />}
      <div className="cw-fields">
        <label><span>Annual CTC (₹) <em>*</em></span><input required type="number" min={10000} step={1000} value={ctc} onChange={(event) => setCtc(event.target.value)} />{current && preview && <small className={`pe-delta ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? "+" : ""}{inr(change)} ({current.annualCtc ? ((change / current.annualCtc) * 100).toFixed(1) : "0"}%) vs current</small>}</label>
        <label><span>Effective from <em>*</em> <small>1st of a month or joining date</small></span><input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
        <label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="JOINING">Joining</option><option value="REVISION">Annual revision</option><option value="PROMOTION">Promotion</option><option value="CORRECTION">Correction</option></select></label>
        <label className="pe-check"><input type="checkbox" checked={isMetro} onChange={(event) => { setIsMetro(event.target.checked); setHraPct(event.target.checked ? 50 : 40); }} /><span>Metro city <small>HRA 50% of Basic (else 40%)</small></span></label>
      </div>
      <details className="pe-template" open>
        <summary>Template · Basic {basicPct}% · HRA {hraPct}% · variable {variablePct}%</summary>
        <div className="cw-fields">
          <label><span>Basic <small>% of fixed pay (30–80)</small></span><input type="number" min={30} max={80} step={0.5} value={basicPct} onChange={(event) => setBasicPct(Number(event.target.value))} /></label>
          <label><span>HRA <small>% of Basic (0–50)</small></span><input type="number" min={0} max={50} step={0.5} value={hraPct} onChange={(event) => setHraPct(Number(event.target.value))} /></label>
          <label><span>Conveyance <small>₹ / month</small></span><input type="number" min={0} step={100} value={conveyance} onChange={(event) => setConveyance(event.target.value)} /></label>
          <label><span>Other allowance <small>₹ / month</small></span><input type="number" min={0} step={100} value={other} onChange={(event) => setOther(event.target.value)} /></label>
          <label><span>Variable pay <small>% of CTC (0–40)</small></span><input type="number" min={0} max={40} step={1} value={variablePct} onChange={(event) => setVariablePct(Number(event.target.value))} /></label>
          <label className="pe-check"><input type="checkbox" checked={gratuity} onChange={(event) => setGratuity(event.target.checked)} /><span>Gratuity in CTC <small>4.81% of Basic</small></span></label>
        </div>
      </details>

      <section className="pe-preview" aria-live="polite" aria-busy={loading}>
        <header><p className="cw-section-label">Live breakdown {loading && <Loader2 size={13} className="spin" />}</p>{preview && (preview.check.ok ? <span className="pe-ok"><Check size={13} /> Sums to CTC{preview.check.difference ? ` (±${inr(Math.abs(preview.check.difference))} rounding)` : ""}</span> : <span className="pe-flag tone-danger">Does not balance</span>)}</header>
        {previewError && <ErrorState message={previewError} />}
        {preview && (
          <>
            {preview.errors.map((item) => <p key={item} className="cw-alert" role="alert"><AlertTriangle size={15} /> {item}</p>)}
            {preview.warnings.map((item) => <p key={item} className="cw-alert warn"><AlertTriangle size={15} /> {item}</p>)}
            <CtcBar components={preview.components} total={preview.annualCtc} />
            <ComponentTable components={preview.components} footer={{ gross: preview.fixedMonthlyGross, ctc: preview.annualCtc, monthlyCtc: preview.monthlyCtc }} />
            <div className="pe-takehome">
              <div><small>Monthly gross</small><b>{inr(preview.takeHome.gross)}</b></div>
              <div><small>PF</small><b>− {inr(preview.takeHome.pfEmployee)}</b></div>
              <div><small>ESI</small><b>− {inr(preview.takeHome.esiEmployee)}</b></div>
              <div><small>PT · {preview.stateName}</small><b>− {inr(preview.takeHome.pt)}</b></div>
              <div><small>TDS · {preview.regime === "OLD" ? "old" : "new"} regime</small><b>− {inr(preview.takeHome.tds)}</b></div>
              <div className="pe-net"><small>Est. take-home</small><b>{inr(preview.takeHome.net)}</b></div>
            </div>
            <p className="pe-note">Indicative full month with no LOP; annual tax {inr(preview.takeHome.annualTax)} on taxable income {inr(preview.takeHome.taxableIncome)}. Actual payroll uses the month&apos;s payable days, inputs and TDS already deducted.</p>
          </>
        )}
      </section>
      <label className="cw-note"><span>Notes <small>optional · visible in history</small></span><textarea rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. FY27 appraisal — rating 4/5" /></label>
      <div className="cw-create-foot">
        {onCancel && <button type="button" className="cw-btn ghost" onClick={onCancel}>Cancel</button>}
        <button className="cw-btn primary" disabled={busy || !preview || !preview.check.ok || loading}>{busy ? "Saving…" : "Save structure"}</button>
      </div>
    </form>
  );
}

function ProfileForm({ data, onSaved }: { data: EmployeeStructures; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Profile>(data.profile);
  const defaultFlags: StatutoryFlags = { epsEligible: true, disabled: false, vpfRate: 0, internationalWorker: false, ageCategory: "BELOW_60" };
  const flags = { ...defaultFlags, ...(form.statutoryFlags || {}) };
  const setFlag = <K extends keyof StatutoryFlags>(key: K, value: StatutoryFlags[K]) => setForm((current) => ({ ...current, statutoryFlags: { ...defaultFlags, ...(current.statutoryFlags || {}), [key]: value } }));
  // Identifiers come back masked. undefined = keep what is on file, "" / text = new value being typed, null = remove.
  const [edits, setEdits] = useState<Partial<Record<PiiField, string | null>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setForm(data.profile); setEdits({}); }, [data.profile]);
  const identifiers = () => {
    const out: Partial<Record<PiiField, string | null>> = {};
    for (const field of Object.keys(edits) as PiiField[]) {
      const value = edits[field];
      if (value === null) out[field] = null;
      else if (value && value.trim()) out[field] = value.trim().toUpperCase();
    }
    return out;
  };
  const identifier = (field: PiiField, label: React.ReactNode, input: { maxLength: number; numeric?: boolean; placeholder?: string }) => {
    const value = edits[field];
    const onFile = data.profile[field];
    if (value === undefined && onFile) return (
      <div className="cw-note"><span>{label}</span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <SensitiveValue employeeId={data.employee.id} field={field} masked={onFile} />
          <button type="button" className="cw-btn ghost" style={{ padding: "2px 8px", minHeight: 0, fontSize: 12 }} onClick={() => setEdits((current) => ({ ...current, [field]: "" }))}>Change</button>
          <button type="button" className="cw-btn ghost" style={{ padding: "2px 8px", minHeight: 0, fontSize: 12 }} onClick={() => setEdits((current) => ({ ...current, [field]: null }))}>Remove</button>
        </div>
      </div>
    );
    if (value === null) return (
      <div className="cw-note"><span>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><small>Will be removed when you save.</small>
          <button type="button" className="cw-btn ghost" style={{ padding: "2px 8px", minHeight: 0, fontSize: 12 }} onClick={() => setEdits((current) => { const next = { ...current }; delete next[field]; return next; })}>Undo</button></div>
      </div>
    );
    return (
      <label><span>{label}{onFile ? <small> replacing {onFile}</small> : null}</span>
        <input value={value || ""} maxLength={input.maxLength} placeholder={input.placeholder} autoComplete="off" inputMode={input.numeric ? "numeric" : undefined}
          onChange={(event) => { const next = input.numeric ? event.target.value.replace(/\D/g, "") : event.target.value.toUpperCase(); setEdits((current) => ({ ...current, [field]: next })); }} />
      </label>
    );
  };
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setForm((current) => ({ ...current, [key]: value }));
  const decl = (key: keyof Profile["declarations"], value: string) => setForm((current) => ({ ...current, declarations: { ...current.declarations, [key]: value === "" ? undefined : Number(value) } }));
  const blank = (value: string | null) => (value && value.trim() ? value.trim().toUpperCase() : null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const declarations = Object.fromEntries(Object.entries(form.declarations || {}).filter(([, value]) => value !== undefined && value !== null && !Number.isNaN(value)));
      await payrollApi.updateProfile(data.employee.id, {
        stateCode: form.stateCode || null, taxRegime: form.taxRegime, ...identifiers(),
        bankName: form.bankName?.trim() || null, ifsc: blank(form.ifsc), pfApplicable: form.pfApplicable, ptCategory: form.ptCategory,
        declarations, statutoryFlags: flags, version: data.profile.version,
      });
      await onSaved();
    } catch (reason) { setError(errorText(reason, "Unable to save the profile.")); } finally { setBusy(false); }
  };
  return (
    <form className="cw-create" onSubmit={submit}>
      {error && <ErrorState message={error} />}
      <p className="cw-section-label">Statutory</p>
      <div className="cw-fields">
        <label><span>PT state</span>
          <select value={form.stateCode || ""} onChange={(event) => set("stateCode", event.target.value || null)}>
            <option value="">Automatic — {STATE_NAMES[data.employee.state] || data.employee.state} ({data.employee.stateSource})</option>
            {Object.entries(STATE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label><span>PT category</span><select value={form.ptCategory} onChange={(event) => set("ptCategory", event.target.value as Profile["ptCategory"])}><option value="STANDARD">Standard</option><option value="WOMAN">Woman (state-specific slabs)</option><option value="EXEMPT">Exempt</option></select></label>
        {identifier("pan", "PAN", { maxLength: 10, placeholder: "ABCDE1234F" })}
        {identifier("uan", <>UAN <small>12 digits</small></>, { maxLength: 12, numeric: true })}
        {identifier("esiNumber", "ESI IP number", { maxLength: 17, numeric: true })}
        <label className="pe-check"><input type="checkbox" checked={form.pfApplicable} onChange={(event) => set("pfApplicable", event.target.checked)} /><span>PF member <small>untick only for excluded employees</small></span></label>
      </div>
      <p className="cw-section-label">PF, ESI &amp; age</p>
      <div className="cw-fields">
        <label className="pe-check"><input type="checkbox" checked={flags.epsEligible} onChange={(event) => setFlag("epsEligible", event.target.checked)} /><span>EPS member <small>untick if they joined above the PF wage ceiling after 1 Sep 2014 or are past 58 — the employer&apos;s full 12% then goes to EPF</small></span></label>
        <label className="pe-check"><input type="checkbox" checked={flags.internationalWorker} onChange={(event) => setFlag("internationalWorker", event.target.checked)} /><span>International worker <small>PF on full wages, no ceiling</small></span></label>
        <label className="pe-check"><input type="checkbox" checked={flags.disabled} onChange={(event) => setFlag("disabled", event.target.checked)} /><span>Person with disability <small>ESI coverage up to ₹25,000 gross instead of ₹21,000</small></span></label>
        <label><span>Voluntary PF <small>% of PF wages, 0–88</small></span>
          <input type="number" min={0} max={88} step={0.5} value={flags.vpfRate ? Math.round(flags.vpfRate * 1000) / 10 : ""} placeholder="0"
            onChange={(event) => setFlag("vpfRate", event.target.value === "" ? 0 : Math.min(88, Math.max(0, Number(event.target.value))) / 100)} /></label>
        <label><span>Age category <small>old-regime slabs and 80D limits</small></span>
          <select value={flags.ageCategory} onChange={(event) => setFlag("ageCategory", event.target.value as StatutoryFlags["ageCategory"])}>
            <option value="BELOW_60">Below 60</option><option value="SENIOR">Senior citizen (60–79)</option><option value="SUPER_SENIOR">Super senior (80+)</option>
          </select></label>
      </div>
      <p className="cw-section-label">Salary account</p>
      <div className="cw-fields">
        <label className="wide"><span>Bank name</span><input value={form.bankName || ""} maxLength={80} onChange={(event) => set("bankName", event.target.value)} /></label>
        {identifier("bankAccount", "Account number", { maxLength: 20, numeric: true })}
        <label><span>IFSC</span><input value={form.ifsc || ""} maxLength={11} placeholder="HDFC0001234" onChange={(event) => set("ifsc", event.target.value.toUpperCase())} /></label>
      </div>
      <p className="cw-section-label">Income tax</p>
      <div className="cw-fields">
        <label className="wide"><span>Tax regime</span><select value={form.taxRegime} onChange={(event) => set("taxRegime", event.target.value as Profile["taxRegime"])}><option value="NEW">New regime (default, s.115BAC)</option><option value="OLD">Old regime — with declarations</option></select></label>
        {form.taxRegime === "OLD" && (
          <>
            <label><span>80C investments <small>₹/yr, excl. PF</small></span><input type="number" min={0} value={form.declarations.section80C ?? ""} onChange={(event) => decl("section80C", event.target.value)} /></label>
            <label><span>80D health insurance <small>₹/yr</small></span><input type="number" min={0} value={form.declarations.section80D ?? ""} onChange={(event) => decl("section80D", event.target.value)} /></label>
            <label><span>Rent paid <small>₹/yr, for HRA exemption</small></span><input type="number" min={0} value={form.declarations.rentPaidAnnual ?? ""} onChange={(event) => decl("rentPaidAnnual", event.target.value)} /></label>
            <label><span>Home-loan interest <small>₹/yr</small></span><input type="number" min={0} value={form.declarations.homeLoanInterest ?? ""} onChange={(event) => decl("homeLoanInterest", event.target.value)} /></label>
          </>
        )}
        <label><span>Previous employer salary <small>this FY</small></span><input type="number" min={0} value={form.declarations.previousEmployerSalary ?? ""} onChange={(event) => decl("previousEmployerSalary", event.target.value)} /></label>
        {form.taxRegime === "OLD" && (
          <label className="pe-check"><input type="checkbox" checked={Boolean(form.declarations.rentedInMetro)} onChange={(event) => setForm((current) => ({ ...current, declarations: { ...current.declarations, rentedInMetro: event.target.checked } }))} />
            <span>Rented home is in Delhi, Mumbai, Kolkata or Chennai <small>50% HRA exemption limit instead of 40%</small></span></label>
        )}
        <label><span>Previous employer PF <small>this FY</small></span><input type="number" min={0} value={form.declarations.previousEmployerPf ?? ""} onChange={(event) => decl("previousEmployerPf", event.target.value)} /></label>
        <label><span>Previous employer PT <small>this FY</small></span><input type="number" min={0} value={form.declarations.previousEmployerPt ?? ""} onChange={(event) => decl("previousEmployerPt", event.target.value)} /></label>
        <label><span>Previous employer TDS <small>this FY</small></span><input type="number" min={0} value={form.declarations.previousEmployerTds ?? ""} onChange={(event) => decl("previousEmployerTds", event.target.value)} /></label>
      </div>
      <Note>PAN, UAN, ESI and account numbers are stored encrypted and shown masked; “Show” is recorded in the audit log. Identifiers are masked in the audit trail and on payslips. Saving marks calculated payroll runs for recalculation.</Note>
      <div className="cw-create-foot"><button className="cw-btn primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></div>
    </form>
  );
}

function HistoryList({ data, onDeleted }: { data: EmployeeStructures; onDeleted: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const remove = async (id: string) => {
    setBusy(id); setError("");
    try { await payrollApi.deleteStructure(id); setConfirm(null); await onDeleted(); } catch (reason) { setError(errorText(reason, "Unable to delete.")); } finally { setBusy(""); }
  };
  if (!data.structures.length) return <div className="cw-empty"><span><History size={24} /></span><h2>No structures yet</h2><p>Set up the first salary structure from the Salary tab.</p></div>;
  const ordered = data.structures;
  return (
    <section className="cw-timeline pe-history">
      {error && <ErrorState message={error} />}
      <ol>
        {ordered.map((item, index) => {
          const previous = ordered[index + 1];
          const change = previous ? ((item.annualCtc - previous.annualCtc) / previous.annualCtc) * 100 : null;
          return (
            <li key={item.id}>
              <span className={`cw-avatar small ${item.current ? "" : "muted"}`}>{item.upcoming ? <History size={13} /> : <Wallet size={13} />}</span>
              <div>
                <p><b>{inr(item.annualCtc)}</b> from {shortDate(item.effectiveFrom)} {item.current && <Badge tone="success" label="Current" />}{item.upcoming && <Badge tone="info" label="Upcoming" />}
                  {change !== null && <span className={`pe-delta ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span>}</p>
                <small className="cw-event-data">{item.reason.toLowerCase()} · gross {inr(item.fixedMonthlyGross)}/mo · by {item.createdBy || "—"} · rules {item.rulesetVersion}</small>
                {item.notes && <blockquote>{item.notes}</blockquote>}
                {!item.used && (confirm === item.id ? (
                  <div className="cw-action-row pe-left"><span className="pe-muted">Delete this revision?</span><button className="cw-btn ghost" onClick={() => setConfirm(null)}>Keep</button><button className="cw-btn danger" disabled={busy === item.id} onClick={() => remove(item.id)}>Delete</button></div>
                ) : <button className="pe-link danger" onClick={() => setConfirm(item.id)}><Trash2 size={13} /> Delete revision</button>)}
                {item.used && <small className="pe-muted pe-block">Used in a published payroll — part of the pay record.</small>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
