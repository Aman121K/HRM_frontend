"use client";
import { BookOpen, Calculator, ChevronRight, Plus, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { payrollApi, errorText, inr, inrShort, monthLabel, shortMonth, STATE_NAMES, type Meta, type Run, type Settings } from "./api";
import { ACCENT, Disclaimer, Drawer, ErrorState, PermissionState, RunBadge } from "./ui";

export function PayrollAdmin() {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"" | "create" | "settings" | "rules">("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const m = await payrollApi.meta();
      setMeta(m);
      if (!m.viewer.canManage) return;
      const data = await payrollApi.runs();
      setRuns(data.items); setSuggestions(data.suggestions);
    } catch (reason) { setError(errorText(reason, "Unable to load payroll runs.")); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  if (error && !meta) return <div className="cw-page pe-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (!meta) return <div className="cw-page pe-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  if (!meta.viewer.canManage) return <div className="cw-page pe-page"><PermissionState title="Payroll runs are restricted" body="Only payroll and HR administrators can process payroll. Your own payslips are in My payroll." /></div>;

  const live = (runs || []).filter((run) => run.status !== "CANCELLED");
  const paid = live.filter((run) => run.status === "PUBLISHED" || run.status === "LOCKED");
  const latestPaid = paid[0];
  const open = live.find((run) => !["PUBLISHED", "LOCKED"].includes(run.status));
  const fyStart = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04`; })();
  const fyCost = paid.filter((run) => run.period >= fyStart).reduce((sum, run) => sum + (run.totals.employerCost || 0), 0);
  const trend = [...paid].reverse().slice(-8);

  return (
    <div className="cw-page pe-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Calculator size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PAY &amp; CLAIMS · INDIA PAYROLL</p>
          <h1>Payroll runs</h1>
          <p>Calculate salaries with PF, ESI, professional tax and TDS, review variances, approve with maker-checker and publish payslips.</p>
        </div>
        <div className="pe-hero-actions">
          <Link className="cw-btn ghost" href="/payroll/structures"><Users size={16} /> Salary structures</Link>
          <button className="cw-btn ghost" onClick={() => setPanel("settings")}><Settings2 size={16} /> Settings</button>
          <button className="cw-btn primary lg" onClick={() => setPanel("create")}><Plus size={17} /> New payroll run</button>
        </div>
      </header>

      <Disclaimer text={meta.disclaimer} version={meta.ruleset.version} />

      <section className="cw-stats" aria-label="Summary">
        <article className={open ? "attention" : ""}>
          <small>In progress</small>
          <b className="text">{open ? open.label : "Nothing open"}</b>
          <span>{open ? <RunBadge status={open.status} /> : "start the next month's run"}</span>
        </article>
        <article><small>Last net payout</small><b>{latestPaid ? inrShort(latestPaid.totals.net) : "—"}</b><span>{latestPaid ? `${latestPaid.label} · ${latestPaid.totals.payable} employees` : "no published run yet"}</span></article>
        <article><small>Cost to company · FY</small><b>{inrShort(fyCost)}</b><span>{paid.filter((run) => run.period >= fyStart).length} published months</span></article>
        <article><small>TDS deducted · last run</small><b>{latestPaid ? inrShort(latestPaid.totals.tds) : "—"}</b><span>PF {latestPaid ? inrShort((latestPaid.totals.pfEmployee || 0) + (latestPaid.totals.pfEmployer || 0)) : "—"} · ESI {latestPaid ? inrShort((latestPaid.totals.esiEmployee || 0) + (latestPaid.totals.esiEmployer || 0)) : "—"}</span></article>
      </section>

      {trend.length > 1 && <TrendChart runs={trend} />}

      <div className="pe-section-head">
        <h2>All runs</h2>
        <button className="pe-link" onClick={() => setPanel("rules")}><BookOpen size={14} /> Statutory rules &amp; sources</button>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!runs ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !runs.length ? (
        <div className="cw-empty">
          <span><Calculator size={26} /></span>
          <h2>No payroll runs yet</h2>
          <p>Create a run for a month, calculate it, review the flags and send it for approval.</p>
          <button className="cw-btn primary" onClick={() => setPanel("create")}><Plus size={16} /> New payroll run</button>
        </div>
      ) : (
        <div className="cw-table pe-runs" role="table" aria-label="Payroll runs">
          <div className="cw-row head" role="row">
            <span role="columnheader">Month</span><span role="columnheader">Status</span><span role="columnheader" className="num">Employees</span>
            <span role="columnheader" className="num">Gross</span><span role="columnheader" className="num">Net pay</span><span role="columnheader" className="num">Employer cost</span>
            <span role="columnheader">Review</span><span />
          </div>
          {runs.map((run) => (
            <button key={run.id} role="row" className={`cw-row ${run.status === "SUBMITTED" ? "actionable" : ""} ${run.status === "CANCELLED" ? "pe-dim" : ""}`} onClick={() => router.push(`/payroll/admin/${run.id}`)}>
              <span className="cw-title-cell" role="cell"><small>Pay date {run.payDate}</small><b>{run.label}</b></span>
              <span role="cell"><RunBadge status={run.status} />{run.needsRecalc && <em className="cw-flag">Recalculate</em>}</span>
              <span role="cell" className="num">{run.totals.payable ?? "—"}{run.totals.held ? <small className="pe-muted"> +{run.totals.held} held</small> : null}</span>
              <span role="cell" className="num">{inr(run.totals.gross)}</span>
              <span role="cell" className="num">{inr(run.totals.net)}</span>
              <span role="cell" className="num">{inr(run.totals.employerCost)}</span>
              <span role="cell">{run.totals.flagged ? <span className="pe-flag tone-warning">{run.totals.flagged} flagged</span> : run.status === "DRAFT" ? <span className="pe-muted">Not calculated</span> : <span className="pe-muted">Clean</span>}</span>
              <span role="cell" className="cw-row-cta">{run.status === "SUBMITTED" ? <em>Approve</em> : null}<ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      )}

      {panel === "create" && <CreateRun suggestions={suggestions} settings={meta.settings} onClose={() => setPanel("")} onCreated={(run) => { setPanel(""); flash(`${run.label} run created`); router.push(`/payroll/admin/${run.id}`); }} />}
      {panel === "settings" && meta.settings && <SettingsDrawer settings={meta.settings} onClose={() => setPanel("")} onSaved={() => { setPanel(""); flash("Payroll settings saved"); load(); }} />}
      {panel === "rules" && <RulesDrawer meta={meta} onClose={() => setPanel("")} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function TrendChart({ runs }: { runs: Run[] }) {
  const max = Math.max(...runs.map((run) => run.totals.employerCost || 0), 1);
  const w = 640, h = 170, pad = 28, barW = Math.min(46, (w - pad * 2) / runs.length - 14);
  const step = (w - pad * 2) / runs.length;
  return (
    <figure className="pe-chart">
      <figcaption><b>Monthly payroll cost</b><span><i className="k-net" /> Net pay <i className="k-ded" /> Deductions <i className="k-er" /> Employer contributions</span></figcaption>
      <svg viewBox={`0 0 ${w} ${h + 26}`} role="img" aria-label={`Payroll cost for the last ${runs.length} published months`}>
        <title>Payroll cost by month</title>
        <line x1={pad} x2={w - pad} y1={h} y2={h} className="axis" />
        {runs.map((run, i) => {
          const net = run.totals.net || 0, ded = run.totals.deductions || 0, er = Math.max(0, (run.totals.employerCost || 0) - (run.totals.gross || 0) - (run.totals.reimbursements || 0));
          const scale = (v: number) => (v / max) * (h - 16);
          const x = pad + i * step + (step - barW) / 2;
          let y = h;
          const seg = (value: number, cls: string) => { const height = scale(value); y -= height; return <rect key={cls} x={x} y={y} width={barW} height={Math.max(0, height)} className={cls}><title>{`${run.label}: ${inr(value)}`}</title></rect>; };
          return (
            <g key={run.id}>
              {seg(net, "net")}{seg(ded, "ded")}{seg(er, "er")}
              <text x={x + barW / 2} y={h + 16} textAnchor="middle">{shortMonth(run.period)}</text>
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="val">{inrShort(run.totals.employerCost)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}


function CreateRun({ suggestions, settings, onClose, onCreated }: { suggestions: string[]; settings: Settings | null; onClose: () => void; onCreated: (run: Run) => void }) {
  const current = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(suggestions.includes(current) ? current : suggestions[0] || current);
  const lastDay = (p: string) => { const [y, m] = p.split("-").map(Number); return `${p}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };
  const [payDate, setPayDate] = useState(lastDay(period));
  const [includeExpenses, setIncludeExpenses] = useState(settings?.includeExpenses ?? true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (/^\d{4}-\d{2}$/.test(period)) setPayDate(lastDay(period)); }, [period]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { onCreated(await payrollApi.createRun({ period, payDate, includeExpenses, notes: notes.trim() || undefined })); }
    catch (reason) { setError(errorText(reason, "Unable to create the run.")); } finally { setBusy(false); }
  };
  return (
    <Drawer title="New payroll run" eyebrow="PAYROLL · CREATE" onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        {!!suggestions.length && (
          <div className="cw-chips" aria-label="Suggested months">
            {suggestions.map((item) => <button type="button" key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{monthLabel(item)}</button>)}
          </div>
        )}
        <div className="cw-fields">
          <label><span>Pay month <em>*</em></span><input type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          <label><span>Pay date</span><input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></label>
          <label className="wide pe-check"><input type="checkbox" checked={includeExpenses} onChange={(event) => setIncludeExpenses(event.target.checked)} /><span>Reimburse approved expense claims through this run <small>claims awaiting payment are added as non-taxable lines</small></span></label>
          <label className="wide"><span>Notes <small>optional</small></span><textarea rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Includes Diwali advance recoveries" /></label>
        </div>
        <p className="pe-note">Every active employee who has joined by the end of the month is included. Loss-of-pay days are read from approved unpaid leave; TDS is projected from earlier published runs in the financial year.</p>
        <div className="cw-create-foot">
          <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy || !period}>{busy ? "Creating…" : `Create ${period ? monthLabel(period) : ""} run`}</button>
        </div>
      </form>
    </Drawer>
  );
}

function SettingsDrawer({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await payrollApi.updateSettings({ pfWageMode: form.pfWageMode, defaultState: form.defaultState, includeExpenses: form.includeExpenses, pfEstablishmentCode: form.pfEstablishmentCode || null, esiEmployerCode: form.esiEmployerCode || null, debitAccount: form.debitAccount || null,
        labourCodeWages: form.labourCodeWages || "AUTO", lwfEnabled: Boolean(form.lwfEnabled), minimumWageMonthly: form.minimumWageMonthly || null, version: settings.version });
      onSaved();
    } catch (reason) { setError(errorText(reason, "Unable to save settings.")); } finally { setBusy(false); }
  };
  return (
    <Drawer title="Payroll settings" eyebrow="PAYROLL · ORGANISATION" onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="cw-fields">
          <label className="wide"><span>PF wage basis</span>
            <select value={form.pfWageMode} onChange={(event) => set("pfWageMode", event.target.value as Settings["pfWageMode"])}>
              <option value="CEILING">Statutory ceiling — 12% of Basic capped at ₹15,000</option>
              <option value="ACTUAL">Actual Basic — 12% of full Basic (EPS stays capped)</option>
            </select>
          </label>
          <label><span>Default PT state</span>
            <select value={form.defaultState} onChange={(event) => set("defaultState", event.target.value)}>
              {Object.entries(STATE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label><span>Company debit account</span><input inputMode="numeric" value={form.debitAccount || ""} onChange={(event) => set("debitAccount", event.target.value.replace(/\D/g, ""))} placeholder="For the bank file" /></label>
          <label><span>PF establishment code</span><input value={form.pfEstablishmentCode || ""} maxLength={30} onChange={(event) => set("pfEstablishmentCode", event.target.value)} /></label>
          <label><span>ESI employer code</span><input value={form.esiEmployerCode || ""} maxLength={30} onChange={(event) => set("esiEmployerCode", event.target.value)} /></label>
          <label className="wide"><span>Labour Code wage rule for PF <small>Code on Social Security s.2(88)</small></span>
            <select value={form.labourCodeWages || "AUTO"} onChange={(event) => set("labourCodeWages", event.target.value as Settings["labourCodeWages"])}>
              <option value="AUTO">Automatic — apply from the Labour Codes&apos; commencement (Nov 2025 wage month)</option>
              <option value="ON">Always apply the 50% rule</option>
              <option value="OFF">Do not apply (only on your CA&apos;s advice)</option>
            </select>
            <small className="pe-help">When excluded allowances (HRA, conveyance, special…) exceed 50% of total pay, the excess is added back to PF wages.</small>
          </label>
          <label><span>Minimum wage floor <small>₹/month, Basic + DA</small></span>
            <input type="number" min={1000} value={form.minimumWageMonthly ?? ""} onChange={(event) => set("minimumWageMonthly", event.target.value === "" ? null : Number(event.target.value))} placeholder="From your State notification" />
            <small className="pe-help">Runs flag anyone whose Basic is below this. Leave blank if not yet confirmed.</small>
          </label>
          <label className="pe-check"><input type="checkbox" checked={Boolean(form.lwfEnabled)} onChange={(event) => set("lwfEnabled", event.target.checked)} /><span>Deduct Labour Welfare Fund <small>enable once your LWF registration and State rates are confirmed; until then runs only flag the amount due</small></span></label>
          <label className="wide pe-check"><input type="checkbox" checked={form.includeExpenses} onChange={(event) => set("includeExpenses", event.target.checked)} /><span>Reimburse approved expense claims through payroll by default</span></label>
        </div>
        <p className="pe-note">Changing settings marks calculated runs for recalculation. The state is used when an employee has no PT state on their payroll profile and it cannot be inferred from their work location.</p>
        <div className="cw-create-foot">
          <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
    </Drawer>
  );
}

function RulesDrawer({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const r = meta.ruleset;
  return (
    <Drawer title={`Statutory rule set ${r.version}`} eyebrow={`FY ${r.fiscalYear} · INDIA`} onClose={onClose}>
      <Disclaimer text={meta.disclaimer} />
      <section className="pe-rules">
        <h3>Provident fund</h3><p>{r.pf.note}</p><ul>{r.pf.sources.map((s) => <li key={s}>{s}</li>)}</ul>
        <h3>ESI</h3><p>{r.esi.note}</p><ul>{r.esi.sources.map((s) => <li key={s}>{s}</li>)}</ul>
        <h3>Professional tax</h3><p>{r.pt.note}</p>
        <dl className="cw-facts">{r.pt.states.map((state) => <div key={state.code} className="wide"><dt>{state.name}</dt><dd>{state.note}<small>{state.source}</small></dd></div>)}</dl>
        <h3>Income tax (TDS)</h3><p>New and old regime slabs for FY 2026-27 with standard deduction, s.87A rebate (and marginal relief), surcharge and 4% cess. Monthly TDS spreads the remaining annual liability over the remaining months; tax on one-time pay is deducted in the month it is paid.</p>
        <h3>Labour codes</h3><p>{r.labourCodes}</p>
        <h3>Rounding</h3><p>{r.rounding}</p>
      </section>
    </Drawer>
  );
}
