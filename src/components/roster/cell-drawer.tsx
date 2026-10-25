"use client";
import { AlertTriangle, ArrowLeftRight, CalendarOff, Eraser, Moon, Wand2, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { fullDay, hoursLabel, rosterApi, timeRange, weekday, dayNum, type Cell, type PersonRow, type SaveItem, type Template, type Week } from "./roster-api";

type Choice = { kind: "SHIFT"; templateId: string } | { kind: "WEEKLY_OFF" } | { kind: "CLEAR" };
const choiceKey = (choice: Choice) => choice.kind === "SHIFT" ? choice.templateId : choice.kind;

/** Inspector for one person-day: shift, location, note, plus the leave/rule context behind any warning. */
export function CellDrawer({ row, cell, templates, templateMap, onClose, onSaved }: {
  row: PersonRow; cell: Cell; templates: Template[]; templateMap: Map<string, Template>; onClose: () => void; onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const current = cell.assignment;
  const onLeave = cell.leave?.status === "APPROVED";
  const [choice, setChoice] = useState<Choice>(current?.kind === "SHIFT" && current.templateId ? { kind: "SHIFT", templateId: current.templateId } : current?.kind === "WEEKLY_OFF" ? { kind: "WEEKLY_OFF" } : { kind: "CLEAR" });
  const [location, setLocation] = useState(current?.location ?? row.employee.location ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currentTemplate = current?.templateId ? templateMap.get(current.templateId) : undefined;
  const options = currentTemplate && !currentTemplate.active ? [currentTemplate, ...templates] : templates;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const item: SaveItem = { employeeId: row.employee.id, date: cell.date, kind: choice.kind, version: current?.version ?? 0 };
      if (choice.kind === "SHIFT") item.templateId = choice.templateId;
      if (choice.kind !== "CLEAR") { item.location = location; item.note = note; }
      const result = await rosterApi.save([item]);
      onSaved(result.cleared ? `Cleared ${row.employee.name}'s ${fullDay(cell.date)}.` : result.saved ? `Saved ${row.employee.name}'s ${fullDay(cell.date)}.` : "No changes to save.");
    } catch (reason) {
      setError((reason as Error).message || "Could not save.");
      setSaving(false);
    }
  };

  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer ro-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ro-cell-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: currentTemplate?.color || "#8a5a2b" }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
          <p className="cw-eyebrow">{fullDay(cell.date).toUpperCase()}</p>
          <h2 id="ro-cell-title">{row.employee.name}</h2>
          <p className="cw-muted">{[row.employee.designation, row.employee.location].filter(Boolean).join(" · ")} · {hoursLabel(row.hours)} this week</p>
        </header>
        <form className="cw-drawer-body" onSubmit={submit}>
          {onLeave && <p className="cw-alert" role="note"><CalendarOff size={15} /> On approved {cell.leave!.type} — shifts and weekly offs can't be planned this day.{current ? " Clear the existing plan and arrange cover." : ""}</p>}
          {cell.leave?.status === "PENDING" && <p className="cw-alert warn" role="note"><CalendarOff size={15} /> {cell.leave.type} is pending approval for this day.</p>}
          {cell.warnings.map((warning) => <p key={warning.code + warning.message} className={`cw-alert${warning.severity === "warning" ? " warn" : ""}`}><AlertTriangle size={15} /> {warning.message}</p>)}
          {cell.request && <p className="cw-alert warn ro-alert-info"><ArrowLeftRight size={15} /> {cell.request.caseNumber} ({cell.request.role === "swap" ? "swap partner" : "requested"}): {cell.request.label} — {cell.request.applied ? "applied to the roster" : "approved, not applied yet"}.</p>}
          {cell.changed && <p className="cw-alert warn ro-alert-info">Changed since the last publish — {row.employee.name.split(" ")[0]} is notified when you publish updates.</p>}

          <fieldset className="ro-choices" disabled={saving}>
            <legend className="cw-section-label">Plan</legend>
            {options.map((template) => (
              <label key={template.id} className={`ro-choice${choiceKey(choice) === template.id ? " active" : ""}`} style={{ ["--c" as string]: template.color }}>
                <input type="radio" name="ro-choice" checked={choiceKey(choice) === template.id} disabled={onLeave || !template.active} onChange={() => setChoice({ kind: "SHIFT", templateId: template.id })} />
                <i /><b>{template.name}</b><small>{timeRange(template)} · {template.paidHours} h paid{template.active ? "" : " · inactive"}</small>
              </label>
            ))}
            <label className={`ro-choice off${choice.kind === "WEEKLY_OFF" ? " active" : ""}`}>
              <input type="radio" name="ro-choice" checked={choice.kind === "WEEKLY_OFF"} disabled={onLeave} onChange={() => setChoice({ kind: "WEEKLY_OFF" })} />
              <Moon size={14} /><b>Weekly off</b><small>Rest day</small>
            </label>
            <label className={`ro-choice clear${choice.kind === "CLEAR" ? " active" : ""}`}>
              <input type="radio" name="ro-choice" checked={choice.kind === "CLEAR"} onChange={() => setChoice({ kind: "CLEAR" })} />
              <Eraser size={14} /><b>Not scheduled</b><small>Remove from the roster</small>
            </label>
          </fieldset>

          {choice.kind !== "CLEAR" && (
            <div className="cw-fields">
              <label className="wide"><span>Location <small>(optional)</small></span><input value={location} maxLength={120} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Bengaluru — Indiranagar" /></label>
              <label className="wide"><span>Note for {row.employee.name.split(" ")[0]} <small>(optional)</small></span><textarea rows={3} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Cover the pour-over bar; inventory count at close" /></label>
            </div>
          )}
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="ro-drawer-actions">
            <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cw-btn primary" disabled={saving || (onLeave && choice.kind !== "CLEAR")}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </aside>
    </>
  );
}

/** Apply a weekly pattern to one person (skipping approved leave days), or clear their week. */
export function PatternDrawer({ row, week, templates, templateMap, onClose, onSaved }: {
  row: PersonRow; week: Week; templates: Template[]; templateMap: Map<string, Template>; onClose: () => void; onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const initial = row.cells.map((cell) => cell.assignment?.kind === "WEEKLY_OFF" ? "OFF" : cell.assignment?.templateId && templateMap.get(cell.assignment.templateId)?.active ? cell.assignment.templateId : "");
  const [plan, setPlan] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const presets = useMemo(() => {
    const byCode = (code: string) => templates.find((template) => template.code === code)?.id;
    const list: { label: string; plan: string[] }[] = [];
    for (const template of templates.slice(0, 4)) list.push({ label: `${template.name} Mon–Sat, off Sun`, plan: [...Array(6).fill(template.id), "OFF"] });
    const open = byCode("OPEN"), mid = byCode("MID"), close = byCode("CLOSE");
    if (open && mid && close) list.push({ label: "Rotation: 2 opening · 2 mid · 2 closing · off", plan: [open, open, mid, mid, close, close, "OFF"] });
    if (open && close) list.push({ label: "Weekend closer: open weekdays, close Sat–Sun", plan: [open, open, open, "OFF", "OFF", close, close] });
    return list;
  }, [templates]);

  const paidHours = plan.reduce((sum, value, index) => sum + (value && value !== "OFF" && row.cells[index].leave?.status !== "APPROVED" ? templateMap.get(value)?.paidHours || 0 : 0), 0);
  const offs = plan.filter((value) => value === "OFF").length;

  const save = async () => {
    setSaving(true); setError("");
    try {
      const items: SaveItem[] = plan.map((value, index) => ({ value, cell: row.cells[index] }))
        .filter(({ value, cell }) => value !== (initial[row.cells.indexOf(cell)]) && !(value === "" && !cell.assignment))
        .map(({ value, cell }) => value === "" ? { employeeId: row.employee.id, date: cell.date, kind: "CLEAR" as const }
          : value === "OFF" ? { employeeId: row.employee.id, date: cell.date, kind: "WEEKLY_OFF" as const, location: cell.assignment?.location ?? row.employee.location ?? "" }
          : { employeeId: row.employee.id, date: cell.date, kind: "SHIFT" as const, templateId: value, location: cell.assignment?.location ?? row.employee.location ?? "" });
      if (!items.length) { onSaved("No changes to apply."); return; }
      const result = await rosterApi.save(items, { skipConflicts: true, source: "PATTERN" });
      onSaved(`Pattern applied to ${row.employee.name}: ${result.saved + result.cleared} day${result.saved + result.cleared === 1 ? "" : "s"} updated${result.skipped.length ? `, ${result.skipped.length} leave day${result.skipped.length === 1 ? "" : "s"} skipped` : ""}.`);
    } catch (reason) {
      setError((reason as Error).message || "Could not apply the pattern.");
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true); setError("");
    try {
      const result = await rosterApi.clear(week.weekStart, [row.employee.id]);
      onSaved(`Cleared ${result.cleared} day${result.cleared === 1 ? "" : "s"} for ${row.employee.name}.`);
    } catch (reason) { setError((reason as Error).message || "Could not clear."); setSaving(false); }
  };

  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer ro-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ro-pattern-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: "#8a5a2b" }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
          <p className="cw-eyebrow">PLAN THE WEEK</p>
          <h2 id="ro-pattern-title">{row.employee.name}</h2>
          <p className="cw-muted">{[row.employee.designation, row.employee.location].filter(Boolean).join(" · ")}</p>
        </header>
        <div className="cw-drawer-body">
          <div>
            <p className="cw-section-label">Quick patterns</p>
            <div className="ro-presets">
              {presets.map((preset) => <button key={preset.label} type="button" className="cw-btn ghost" onClick={() => setPlan(preset.plan)}><Wand2 size={14} /> {preset.label}</button>)}
            </div>
          </div>
          <div className="ro-pattern" role="group" aria-label="Plan per day">
            {row.cells.map((cell, index) => {
              const onLeave = cell.leave?.status === "APPROVED";
              const value = plan[index];
              const color = value && value !== "OFF" ? templateMap.get(value)?.color : undefined;
              return (
                <label key={cell.date} className={onLeave ? "leave" : ""} style={color ? { ["--c" as string]: color } : undefined}>
                  <span><b>{weekday(cell.date)}</b> {dayNum(cell.date)}</span>
                  {onLeave ? <em>{cell.leave!.type}</em> : (
                    <select value={value} onChange={(event) => setPlan(plan.map((item, position) => position === index ? event.target.value : item))} aria-label={`${fullDay(cell.date)} plan`}>
                      <option value="">Not scheduled</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {timeRange(template)}</option>)}
                      <option value="OFF">Weekly off</option>
                    </select>
                  )}
                </label>
              );
            })}
          </div>
          <p className={`ro-pattern-sum${paidHours > week.settings.maxWeeklyHours || !offs ? " warn" : ""}`}>
            {hoursLabel(paidHours)} paid · {offs} weekly off{offs === 1 ? "" : "s"}
            {paidHours > week.settings.maxWeeklyHours ? ` — above the ${week.settings.maxWeeklyHours} h limit` : ""}
            {!offs ? " — plan at least one weekly off" : ""}
          </p>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="ro-drawer-actions">
            {confirmClear ? (
              <>
                <span className="ro-confirm-text">Clear every day this week for {row.employee.name.split(" ")[0]}?</span>
                <button type="button" className="cw-btn ghost" onClick={() => setConfirmClear(false)}>Keep</button>
                <button type="button" className="cw-btn danger" onClick={clear} disabled={saving} autoFocus>Clear week</button>
              </>
            ) : (
              <>
                <button type="button" className="cw-btn ghost ro-left" onClick={() => setConfirmClear(true)} disabled={saving || !row.cells.some((cell) => cell.assignment)}><Eraser size={14} /> Clear week</button>
                <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
                <button type="button" className="cw-btn primary" onClick={save} disabled={saving}>{saving ? "Applying…" : "Apply pattern"}</button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
