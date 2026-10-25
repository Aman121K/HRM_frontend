"use client";
import { AlertTriangle, Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { AREA_SHORT, riskApi, type LabourLimits, type MinimumWage, type RiskSettings, type Thresholds } from "./risk-api";

type Field = { key: string; label: string; unit: string; step?: number };
const SECTIONS: { key: keyof Thresholds; title: string; fields: Field[] }[] = [
  { key: "compliance", title: "Statutory calendar", fields: [
    { key: "horizonDays", label: "Show due dates ahead", unit: "days" }, { key: "lookbackDays", label: "Look back for unfiled items", unit: "days" },
    { key: "gratuityWindowDays", label: "Warn before 5 years of service", unit: "days" }] },
  { key: "attendance", title: "Attendance integrity", fields: [
    { key: "lookbackDays", label: "Punches analysed", unit: "days" }, { key: "maxSpeedKmh", label: "Impossible travel above", unit: "km/h" },
    { key: "minTravelKm", label: "Ignore jumps shorter than", unit: "km", step: 0.5 }, { key: "outsideGeofenceCount", label: "Outside-geofence punches before flagging", unit: "punches" },
    { key: "outsideGeofenceDays", label: "…within", unit: "days" }, { key: "identicalCoordinateCount", label: "Identical GPS points before flagging", unit: "punches" },
    { key: "poorAccuracyMetres", label: "Poor GPS accuracy above", unit: "m" }, { key: "selfieBacklogHours", label: "Selfie review backlog after", unit: "hours" },
    { key: "rejectedSelfieCount", label: "Rejected selfies before flagging", unit: "rejections" }, { key: "crossSourceMinutes", label: "Biometric vs phone window", unit: "min" }] },
  { key: "labour", title: "Labour & roster (overtime)", fields: [{ key: "lookbackDays", label: "Roster weeks analysed (back)", unit: "days" }, { key: "overtimeGraceMinutes", label: "Overtime grace per day", unit: "min" }] },
  { key: "payroll", title: "Payroll", fields: [{ key: "netChangePct", label: "Net pay change more than", unit: "%" }] },
  { key: "expenses", title: "Expense claims", fields: [
    { key: "lookbackDays", label: "Claims analysed", unit: "days" }, { key: "roundAmountStep", label: "Round amounts are multiples of", unit: "₹" },
    { key: "roundClaimCount", label: "Round claims before flagging", unit: "claims" }, { key: "splitWindowDays", label: "Split-claim window", unit: "days" },
    { key: "lateReceiptDays", label: "Late claim after", unit: "days" }] },
  { key: "people", title: "People", fields: [
    { key: "newJoinerDays", label: "New joiner = tenure under", unit: "days" }, { key: "rejectedRequests", label: "Declined requests signal", unit: "requests" },
    { key: "attendanceDropPct", label: "Attendance drop signal", unit: "%" }, { key: "encashmentDivisor", label: "Leave encashment divisor", unit: "days" },
    { key: "liabilityAlertAmount", label: "Leave liability alert at", unit: "₹" }] },
  { key: "service", title: "Service & approvals", fields: [
    { key: "slaBreachCount", label: "SLA breaches per category", unit: "tickets" }, { key: "slaWindowDays", label: "…within", unit: "days" },
    { key: "approvalStuckDays", label: "Approval stuck after", unit: "days" }] },
];
const LIMITS: { key: keyof LabourLimits; label: string; unit: string }[] = [
  { key: "weeklyHours", label: "Weekly", unit: "h" }, { key: "dailyHours", label: "Daily", unit: "h" }, { key: "spreadOverHours", label: "Spread-over", unit: "h" },
  { key: "minRestHours", label: "Min rest", unit: "h" }, { key: "maxConsecutiveDays", label: "Days in a row", unit: "d" },
];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function RiskSettingsDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [data, setData] = useState<RiskSettings | null>(null);
  const [draft, setDraft] = useState<Thresholds | null>(null);
  const [wages, setWages] = useState<MinimumWage[]>([]);
  const [newState, setNewState] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => riskApi.settings().then((next) => { setData(next); setDraft(clone(next.thresholds)); setWages(clone(next.minimumWages)); })
    .catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  const readOnly = !data?.canEdit;

  const setField = (section: keyof Thresholds, key: string, value: string) =>
    setDraft((current) => current && ({ ...current, [section]: { ...(current[section] as object), [key]: value === "" ? "" : Number(value) } }) as Thresholds);
  const setLimit = (state: string | null, key: keyof LabourLimits, value: string) => setDraft((current) => {
    if (!current) return current;
    const next = clone(current);
    const parsed = value === "" ? undefined : Number(value);
    if (state === null) (next.labour.default as Record<string, unknown>)[key] = parsed ?? "";
    else { next.labour.states[state] = { ...next.labour.states[state] }; if (parsed === undefined) delete next.labour.states[state][key]; else next.labour.states[state][key] = parsed; }
    return next;
  });
  const toggle = (key: string) => setDraft((current) => current && { ...current, disabled: current.disabled.includes(key) ? current.disabled.filter((item) => item !== key) : [...current.disabled, key] });
  const setWage = (index: number, patch: Partial<MinimumWage>) => setWages((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !data) return;
    setSaving(true); setError("");
    try {
      const reminders = String((draft.compliance.reminderDays as unknown as string | number[]) ?? "");
      const thresholds = { ...draft, compliance: { ...draft.compliance, reminderDays: Array.isArray(draft.compliance.reminderDays) ? draft.compliance.reminderDays : reminders.split(",").map((part) => Number(part.trim())).filter((n) => Number.isFinite(n)) } };
      await riskApi.saveSettings({ thresholds, minimumWages: wages.map((row) => ({ ...row, stateCode: row.stateCode.toUpperCase(), monthlyAmount: Number(row.monthlyAmount) })), version: data.version });
      setSaved("Settings saved. They apply from the next scan."); window.setTimeout(() => setSaved(""), 3000);
      await load(); onSaved();
    } catch (reason) {
      setError(reason instanceof ApiRequestError && reason.status === 409 ? "Someone else changed these settings. Reloaded the latest — please re-apply your change." : (reason as Error).message);
      if (reason instanceof ApiRequestError && reason.status === 409) load();
    } finally { setSaving(false); }
  };

  return (
    <>
      <button className="flow-backdrop" aria-label="Close settings" onClick={onClose} />
      <aside className="cw-drawer rk-drawer rk-settings" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rk-settings-title">
        <header className="cw-drawer-head">
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
          <p className="cw-eyebrow">RISK SETTINGS</p>
          <h2 id="rk-settings-title">Thresholds & minimum wages</h2>
          <p className="cw-muted">{readOnly ? "Read only — HR admins can change these." : "Tune each detector for your brand. Changes apply from the next scan (hourly, or Run scan now)."}</p>
        </header>
        <form className="cw-drawer-body" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {saved && <p className="rk-ok" role="status"><Check size={14} /> {saved}</p>}
          {!data || !draft ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
            <fieldset disabled={readOnly || saving} className="rk-fieldset">
              <section>
                <p className="cw-section-label">Minimum wages (monthly)</p>
                <p className="cw-alert warn"><AlertTriangle size={15} /> {data.minimumWageWarning}</p>
                <div className="rk-wages" role="table" aria-label="Minimum wages">
                  <div className="rk-wage head" role="row"><span role="columnheader">State</span><span role="columnheader">Category</span><span role="columnheader">₹ / month</span><span role="columnheader">From</span><span role="columnheader">Example?</span><span /></div>
                  {wages.map((row, index) => (
                    <div className={`rk-wage${row.isExample ? " example" : ""}`} role="row" key={index}>
                      <input aria-label="State code" value={row.stateCode} maxLength={2} onChange={(event) => setWage(index, { stateCode: event.target.value.toUpperCase() })} />
                      <select aria-label="Category" value={row.category} onChange={(event) => setWage(index, { category: event.target.value })}>{data.categories.map((category) => <option key={category} value={category}>{category.replace("_", "-").toLowerCase()}</option>)}</select>
                      <input aria-label="Monthly amount" type="number" min={1000} step={1} value={row.monthlyAmount} onChange={(event) => setWage(index, { monthlyAmount: Number(event.target.value) })} />
                      <input aria-label="Effective from" type="date" value={row.effectiveFrom} onChange={(event) => setWage(index, { effectiveFrom: event.target.value })} />
                      <label className="rk-check"><input type="checkbox" checked={row.isExample} onChange={(event) => setWage(index, { isExample: event.target.checked })} /><span>{row.isExample ? "EXAMPLE" : "Verified"}</span></label>
                      <button type="button" className="cw-icon-button" aria-label={`Remove ${row.stateCode} ${row.category}`} onClick={() => setWages((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="cw-btn ghost" onClick={() => setWages((rows) => [...rows, { stateCode: "KA", category: "UNSKILLED", monthlyAmount: 17000, effectiveFrom: new Date().toISOString().slice(0, 10), isExample: false, note: null }])}><Plus size={15} /> Add row</button>
                <label className="cw-note rk-inline"><span>Compare salaries against</span>
                  <select value={draft.payroll.minimumWageCategory} onChange={(event) => setDraft({ ...draft, payroll: { ...draft.payroll, minimumWageCategory: event.target.value } })}>
                    {data.categories.map((category) => <option key={category} value={category}>{category.replace("_", "-").toLowerCase()} rate</option>)}
                  </select></label>
              </section>

              <section>
                <p className="cw-section-label">Working-hour limits (Shops & Establishments)</p>
                <p className="cw-help">Defaults apply everywhere; add a state to override individual limits. Limits differ by state and establishment type — confirm them with your advisor.</p>
                <div className="rk-limits" role="table" aria-label="Working-hour limits">
                  <div className="rk-limit head" role="row"><span role="columnheader">Scope</span>{LIMITS.map((limit) => <span role="columnheader" key={limit.key}>{limit.label} ({limit.unit})</span>)}<span /></div>
                  <div className="rk-limit" role="row"><b>Default</b>{LIMITS.map((limit) => <input key={limit.key} type="number" step={0.5} aria-label={`Default ${limit.label}`} value={draft.labour.default[limit.key] ?? ""} onChange={(event) => setLimit(null, limit.key, event.target.value)} />)}<span /></div>
                  {Object.entries(draft.labour.states).map(([state, limits]) => (
                    <div className="rk-limit" role="row" key={state}><b>{state}</b>
                      {LIMITS.map((limit) => <input key={limit.key} type="number" step={0.5} placeholder={String(draft.labour.default[limit.key])} aria-label={`${state} ${limit.label}`} value={limits[limit.key] ?? ""} onChange={(event) => setLimit(state, limit.key, event.target.value)} />)}
                      <button type="button" className="cw-icon-button" aria-label={`Remove ${state} override`} onClick={() => setDraft((current) => { if (!current) return current; const next = clone(current); delete next.labour.states[state]; return next; })}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="rk-add-state">
                  <input aria-label="New state code" placeholder="State code, e.g. TN" maxLength={2} value={newState} onChange={(event) => setNewState(event.target.value.toUpperCase())} />
                  <button type="button" className="cw-btn ghost" disabled={!/^[A-Z]{2}$/.test(newState) || !!draft.labour.states[newState]}
                    onClick={() => { setDraft({ ...draft, labour: { ...draft.labour, states: { ...draft.labour.states, [newState]: {} } } }); setNewState(""); }}><Plus size={15} /> Add state override</button>
                </div>
              </section>

              {SECTIONS.map((section) => (
                <section key={section.key}>
                  <p className="cw-section-label">{section.title}</p>
                  <div className="cw-fields">
                    {section.fields.map((field) => (
                      <label key={field.key}>
                        <span>{field.label} <small>({field.unit})</small></span>
                        <input type="number" step={field.step || 1} value={String((draft[section.key] as Record<string, unknown>)[field.key] ?? "")} onChange={(event) => setField(section.key, field.key, event.target.value)} />
                      </label>
                    ))}
                    {section.key === "compliance" && (
                      <label><span>Remind payroll & HR before due date <small>(days, comma-separated)</small></span>
                        <input value={Array.isArray(draft.compliance.reminderDays) ? draft.compliance.reminderDays.join(", ") : String(draft.compliance.reminderDays)}
                          onChange={(event) => setDraft({ ...draft, compliance: { ...draft.compliance, reminderDays: event.target.value as unknown as number[] } })} /></label>
                    )}
                  </div>
                </section>
              ))}

              <section>
                <p className="cw-section-label">Detectors</p>
                <ul className="rk-detectors">
                  {data.detectors.map((detector) => (
                    <li key={detector.key}>
                      <label className="rk-check">
                        <input type="checkbox" checked={!draft.disabled.includes(detector.key)} onChange={() => toggle(detector.key)} />
                        <span><b>{detector.label}</b> <small>{AREA_SHORT[detector.area]} · {detector.description}</small></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </fieldset>
          )}
          {data && !readOnly && (
            <div className="cw-create-foot rk-foot">
              <button type="button" className="cw-btn ghost" onClick={() => { setDraft(clone(data.defaults)); }}>Reset thresholds to defaults</button>
              <button className="cw-btn primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
            </div>
          )}
        </form>
      </aside>
    </>
  );
}
