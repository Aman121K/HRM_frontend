"use client";
import { AlertTriangle, ArrowDown, ArrowUp, Copy, FileText, Plus, Save, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { relativeTime } from "@/lib/cases";
import { DOC_CATEGORIES, errorText, onboardingApi, OWNER_TYPES, PHASES, type Phase, type Template, type TemplateSummary, type TemplateTask } from "./api";

type Draft = { id: string | null; name: string; description: string; isDefault: boolean; version?: number; tasks: (TemplateTask & { key: string })[] };
let keySeed = 0;
const withKeys = (tasks: TemplateTask[]) => tasks.map((task) => ({ ...task, key: `k${++keySeed}` }));
const offsetHint = (phase: Phase, days: number) =>
  days === 0 ? "on day one" : days < 0 ? `${-days} day${days === -1 ? "" : "s"} before joining` : `day ${days + 1}`;
const defaultOffset: Record<Phase, number> = { PRE_BOARDING: -3, DAY_ONE: 0, FIRST_WEEK: 3, FIRST_90_DAYS: 30 };

export function TemplateEditor({ flash }: { flash: (message: string) => void }) {
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (id: string) => {
    try {
      const template: Template = await onboardingApi.template(id);
      setDraft({ id: template.id, name: template.name, description: template.description || "", isDefault: template.isDefault, version: template.version, tasks: withKeys(template.tasks) });
      setDirty(false); setError("");
    } catch (reason) { setError(errorText(reason)); }
  }, []);
  const loadList = useCallback(async (select?: string) => {
    try {
      const data = await onboardingApi.templates();
      setList(data.items);
      const target = select || data.items.find((item) => item.isDefault)?.id || data.items[0]?.id;
      if (target) await open(target);
    } catch (reason) { setError(errorText(reason, "Unable to load templates.")); setList([]); }
  }, [open]);
  useEffect(() => { loadList(); }, [loadList]);

  const change = (update: (draft: Draft) => Draft) => { setDraft((current) => current && update(current)); setDirty(true); };
  const patchTask = (key: string, patch: Partial<TemplateTask>) => change((current) => ({ ...current, tasks: current.tasks.map((task) => task.key === key ? { ...task, ...patch } : task) }));
  const move = (key: string, direction: -1 | 1) => change((current) => {
    const tasks = [...current.tasks];
    const index = tasks.findIndex((task) => task.key === key);
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return current;
    [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
    return { ...current, tasks };
  });
  const addTask = (phase: Phase) => change((current) => ({
    ...current, tasks: [...current.tasks, { key: `k${++keySeed}`, phase, title: "", description: null, ownerType: phase === "PRE_BOARDING" ? "HR" : "MANAGER", dueOffsetDays: defaultOffset[phase], requiresDocument: false, documentCategory: null, completesOnConversion: false }],
  }));
  const selectTemplate = (id: string) => { if (dirty && !window.confirm("Discard unsaved changes?")) return; open(id); };

  const save = async () => {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const saved = await onboardingApi.saveTemplate(draft.id, {
        ...(draft.id ? { version: draft.version } : {}), name: draft.name.trim(), description: draft.description.trim() || undefined, isDefault: draft.isDefault,
        tasks: draft.tasks.map((task) => ({
          phase: task.phase, title: task.title.trim(), description: task.description?.trim() || undefined, ownerType: task.ownerType, dueOffsetDays: Number(task.dueOffsetDays),
          requiresDocument: !!task.documentCategory, documentCategory: task.documentCategory || undefined, completesOnConversion: task.completesOnConversion,
        })),
      });
      flash(`“${saved.name}” saved — new joiners get ${saved.tasks.length} tasks`);
      await loadList(saved.id);
    } catch (reason) { setError(errorText(reason, "Unable to save the template.")); }
    finally { setBusy(false); }
  };
  const duplicate = () => {
    if (!draft) return;
    setDraft({ id: null, name: `${draft.name} (copy)`, description: draft.description, isDefault: false, tasks: withKeys(draft.tasks) });
    setDirty(true);
  };
  const archive = async () => {
    if (!draft?.id || !window.confirm(`Archive “${draft.name}”? Joiners already using it keep their tasks.`)) return;
    try { await onboardingApi.archiveTemplate(draft.id); flash("Template archived"); setDraft(null); await loadList(); }
    catch (reason) { setError(errorText(reason)); }
  };

  if (!list) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  return (
    <div className="ob-templates">
      <aside className="ob-template-list" aria-label="Templates">
        {list.map((item) => (
          <button key={item.id} className={draft?.id === item.id ? "active" : ""} onClick={() => selectTemplate(item.id)}>
            <b>{item.name} {item.isDefault && <Star size={12} aria-label="Default" />}</b>
            <small>{item.taskCount} tasks · {item.activeJoiners} active joiner{item.activeJoiners === 1 ? "" : "s"} · edited {relativeTime(item.updatedAt)}</small>
          </button>
        ))}
        <button className="ob-template-new" onClick={() => { if (dirty && !window.confirm("Discard unsaved changes?")) return; setDraft({ id: null, name: "", description: "", isDefault: false, tasks: [] }); setDirty(true); }}><Plus size={14} /> New template</button>
      </aside>
      {!draft ? <div className="cw-empty"><h2>Choose a template</h2></div> : (
        <section className="ob-template-body">
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="cw-fields">
            <label><span>Template name <em>*</em></span><input value={draft.name} maxLength={120} onChange={(event) => change((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Café staff" /></label>
            <label className="ob-default-toggle"><span>Default for new joiners</span>
              <span className="ob-check"><input type="checkbox" checked={draft.isDefault} onChange={(event) => change((current) => ({ ...current, isDefault: event.target.checked }))} /> Use when HR does not pick one</span>
            </label>
            <label className="wide"><span>Description</span><input value={draft.description} maxLength={1000} onChange={(event) => change((current) => ({ ...current, description: event.target.value }))} /></label>
          </div>
          <p className="cw-help">Due offsets are counted from the joining date. Changes apply to joiners added from now on — existing checklists stay as they are.</p>
          {PHASES.map((phase) => {
            const tasks = draft.tasks.filter((task) => task.phase === phase.key);
            return (
              <div key={phase.key} className="ob-template-phase">
                <header><b>{phase.label}</b><span>{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
                  <button type="button" className="cw-btn ghost" onClick={() => addTask(phase.key)}><Plus size={14} /> Add task</button></header>
                {tasks.map((task) => (
                  <div key={task.key} className="ob-template-task">
                    <input className="ob-tt-title" aria-label="Task title" value={task.title} maxLength={160} placeholder="What needs to happen?" onChange={(event) => patchTask(task.key, { title: event.target.value })} />
                    <select aria-label="Owner" value={task.ownerType} onChange={(event) => patchTask(task.key, { ownerType: event.target.value as TemplateTask["ownerType"] })}>
                      {OWNER_TYPES.map((owner) => <option key={owner.key} value={owner.key}>{owner.label}</option>)}
                    </select>
                    <label className="ob-tt-offset" title={offsetHint(task.phase, Number(task.dueOffsetDays))}>
                      <input type="number" aria-label="Due offset in days" value={task.dueOffsetDays} min={phase.key === "PRE_BOARDING" ? -90 : 0} max={phase.key === "PRE_BOARDING" ? 0 : phase.key === "DAY_ONE" ? 1 : 180}
                        onChange={(event) => patchTask(task.key, { dueOffsetDays: Number(event.target.value) })} />
                      <small>{offsetHint(task.phase, Number(task.dueOffsetDays))}</small>
                    </label>
                    <select aria-label="Required document" value={task.documentCategory || ""} onChange={(event) => patchTask(task.key, { documentCategory: (event.target.value || null) as TemplateTask["documentCategory"], requiresDocument: !!event.target.value })}>
                      <option value="">No document</option>
                      {DOC_CATEGORIES.map((doc) => <option key={doc.key} value={doc.key}>Needs {doc.label.toLowerCase()}</option>)}
                    </select>
                    <span className="ob-tt-tools">
                      {task.documentCategory && <FileText size={14} aria-hidden className="ob-tt-doc" />}
                      {phase.key === "DAY_ONE" && (
                        <label className="ob-check small" title="Closed automatically when HR converts the joiner to an employee">
                          <input type="checkbox" checked={task.completesOnConversion} onChange={(event) => patchTask(task.key, { completesOnConversion: event.target.checked })} /> Auto
                        </label>
                      )}
                      <button type="button" className="cw-icon-button" aria-label="Move up" onClick={() => move(task.key, -1)}><ArrowUp size={13} /></button>
                      <button type="button" className="cw-icon-button" aria-label="Move down" onClick={() => move(task.key, 1)}><ArrowDown size={13} /></button>
                      <button type="button" className="cw-icon-button" aria-label={`Remove ${task.title || "task"}`} onClick={() => change((current) => ({ ...current, tasks: current.tasks.filter((item) => item.key !== task.key) }))}><Trash2 size={13} /></button>
                    </span>
                  </div>
                ))}
                {!tasks.length && <p className="ob-column-empty">No tasks in this phase.</p>}
              </div>
            );
          })}
          <footer className="ob-template-foot">
            {draft.id && !draft.isDefault && <button type="button" className="cw-btn danger" onClick={archive}><Trash2 size={14} /> Archive</button>}
            {draft.id && <button type="button" className="cw-btn ghost" onClick={duplicate}><Copy size={14} /> Duplicate</button>}
            <span className="ob-spacer" />
            {dirty && <span className="cw-help">Unsaved changes</span>}
            <button type="button" className="cw-btn primary" onClick={save} disabled={busy || !dirty}><Save size={15} /> {busy ? "Saving…" : "Save template"}</button>
          </footer>
        </section>
      )}
    </div>
  );
}
