"use client";
import { AlertTriangle, Check, Moon, Pencil, Plus, Scale, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { rosterApi, timeRange, type Settings, type Template, type TemplateInput } from "./roster-api";

const blank: TemplateInput = { code: "", name: "", startTime: "09:00", endTime: "17:00", breakMinutes: 30, color: "#8a5a2b", minHeadcount: 0, active: true };
const SWATCHES = ["#c9822b", "#0f8177", "#5a4a93", "#3a6ea5", "#b4533c", "#6b7f2a", "#8a5a2b", "#2f4858"];

/** HR: manage shift templates (times, unpaid break, colour, minimum headcount) and roster rule limits. */
export function TemplatesDrawer({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [items, setItems] = useState<Template[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; version: number; values: TemplateInput } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(() => rosterApi.templates().then((data) => { setItems(data.items); setSettings(data.settings); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);

  const note = (message: string) => { setSaved(message); window.setTimeout(() => setSaved(""), 2600); };

  const submitTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const values = { ...editing.values, code: editing.values.code.toUpperCase().trim(), breakMinutes: Number(editing.values.breakMinutes), minHeadcount: Number(editing.values.minHeadcount) };
      if (editing.id) await rosterApi.updateTemplate(editing.id, { ...values, version: editing.version });
      else await rosterApi.createTemplate(values);
      note(editing.id ? `${values.name} updated.` : `${values.name} added.`);
      setEditing(null);
      await load();
      onChanged();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };

  const toggle = async (template: Template) => {
    setError("");
    try {
      const { id, version, code, name, startTime, endTime, breakMinutes, color, minHeadcount } = template;
      await rosterApi.updateTemplate(id, { code, name, startTime, endTime, breakMinutes, color, minHeadcount, active: !template.active, version });
      note(`${name} ${template.active ? "deactivated" : "reactivated"}.`);
      await load(); onChanged();
    } catch (reason) { setError((reason as Error).message); }
  };

  const submitSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setError("");
    try {
      const next = await rosterApi.updateSettings({ ...settings, minRestHours: Number(settings.minRestHours), maxWeeklyHours: Number(settings.maxWeeklyHours), maxConsecutiveDays: Number(settings.maxConsecutiveDays) });
      setSettings(next); note("Roster rules saved."); onChanged();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };

  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) => setEditing((current) => current && { ...current, values: { ...current.values, [key]: value } });

  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer ro-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ro-templates-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: "#8a5a2b" }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
          <p className="cw-eyebrow">HR SETTINGS</p>
          <h2 id="ro-templates-title">Shift templates & rules</h2>
          <p className="cw-muted">Templates are shared by every planner in the organization. Inactive templates stay on past rosters.</p>
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {saved && <p className="ro-saved" role="status"><Check size={14} /> {saved}</p>}
          {!items ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
            <ul className="ro-templates">
              {items.map((template) => (
                <li key={template.id} className={template.active ? "" : "inactive"} style={{ ["--c" as string]: template.color }}>
                  <i className="ro-swatch" />
                  <div>
                    <b>{template.name} <code>{template.code}</code>{template.overnight && <span className="cw-badge tone-info"><i /><Moon size={11} /> Overnight</span>}</b>
                    <small>{timeRange(template)} · {template.breakMinutes} min unpaid break · {template.paidHours} h paid · min {template.minHeadcount} per day</small>
                  </div>
                  <button className="cw-icon-button" aria-label={`Edit ${template.name}`} onClick={() => setEditing({ id: template.id, version: template.version, values: { code: template.code, name: template.name, startTime: template.startTime, endTime: template.endTime, breakMinutes: template.breakMinutes, color: template.color, minHeadcount: template.minHeadcount, active: template.active } })}><Pencil size={14} /></button>
                  <button className="cw-btn ghost" onClick={() => toggle(template)}>{template.active ? "Deactivate" : "Reactivate"}</button>
                </li>
              ))}
            </ul>
          )}

          {editing ? (
            <form className="ro-template-form" onSubmit={submitTemplate}>
              <p className="cw-section-label">{editing.id ? `Edit ${editing.values.name || "template"}` : "New shift template"}</p>
              <div className="cw-fields">
                <label><span>Name <em>*</em></span><input required minLength={2} maxLength={60} value={editing.values.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Brunch" /></label>
                <label><span>Code <em>*</em> <small>(1–6 letters)</small></span><input required pattern="[A-Za-z0-9]{1,6}" maxLength={6} value={editing.values.code} onChange={(event) => set("code", event.target.value.toUpperCase())} placeholder="BRUNCH" /></label>
                <label><span>Starts <em>*</em></span><input type="time" required value={editing.values.startTime} onChange={(event) => set("startTime", event.target.value)} /></label>
                <label><span>Ends <em>*</em> <small>(earlier = next day)</small></span><input type="time" required value={editing.values.endTime} onChange={(event) => set("endTime", event.target.value)} /></label>
                <label><span>Unpaid break (min)</span><input type="number" min={0} max={240} value={editing.values.breakMinutes} onChange={(event) => set("breakMinutes", Number(event.target.value))} /></label>
                <label><span>Minimum headcount / day</span><input type="number" min={0} max={500} value={editing.values.minHeadcount} onChange={(event) => set("minHeadcount", Number(event.target.value))} /></label>
                <div className="wide ro-swatches" role="radiogroup" aria-label="Colour">
                  <span>Colour</span>
                  <div>
                    {SWATCHES.map((color) => (
                      <button type="button" key={color} role="radio" aria-checked={editing.values.color === color} aria-label={color} className={editing.values.color === color ? "active" : ""} style={{ background: color }} onClick={() => set("color", color)} />
                    ))}
                    <input type="color" value={editing.values.color} onChange={(event) => set("color", event.target.value)} aria-label="Custom colour" />
                  </div>
                </div>
              </div>
              <div className="ro-drawer-actions">
                <button type="button" className="cw-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="cw-btn primary" disabled={saving}>{saving ? "Saving…" : editing.id ? "Save template" : "Add template"}</button>
              </div>
            </form>
          ) : (
            <button className="cw-btn ghost" onClick={() => setEditing({ id: null, version: 0, values: blank })}><Plus size={15} /> Add a shift template</button>
          )}

          {settings && (
            <form className="ro-template-form" onSubmit={submitSettings}>
              <p className="cw-section-label"><Scale size={13} /> Rules checked while planning</p>
              <div className="cw-fields">
                <label><span>Minimum rest between shifts (h)</span><input type="number" step={0.5} min={0} max={24} value={settings.minRestHours} onChange={(event) => setSettings({ ...settings, minRestHours: Number(event.target.value) })} /></label>
                <label><span>Weekly hours limit (h)</span><input type="number" step={0.5} min={1} max={120} value={settings.maxWeeklyHours} onChange={(event) => setSettings({ ...settings, maxWeeklyHours: Number(event.target.value) })} /></label>
                <label className="wide"><span>Max consecutive working days <small>(6 = at least one weekly off in every 7 days)</small></span><input type="number" min={1} max={13} value={settings.maxConsecutiveDays} onChange={(event) => setSettings({ ...settings, maxConsecutiveDays: Number(event.target.value) })} /></label>
              </div>
              <div className="ro-drawer-actions"><button type="submit" className="cw-btn primary" disabled={saving}>Save rules</button></div>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
