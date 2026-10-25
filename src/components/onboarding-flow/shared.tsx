"use client";
import { Check, CheckCircle2, Circle, CircleSlash, Clock3, FileText, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { initials, shortDate, type Tone } from "@/lib/cases";
import { dueText, errorText, loadEmployees, onboardingApi, PHASES, type Employee, type Phase, type PhaseProgress, type Task } from "./api";

export function Badge({ tone, label }: { tone: Tone | string; label: string }) {
  return <span className={`cw-badge tone-${tone}`}><i />{label}</span>;
}

export function Avatar({ name, small, muted, title }: { name?: string | null; small?: boolean; muted?: boolean; title?: string }) {
  return <span className={`cw-avatar ${small ? "small" : ""} ${muted ? "muted" : ""}`} title={title || name || undefined} aria-hidden={!title}>{initials(name || "?")}</span>;
}

export function ProgressBar({ percent, overdue = 0, label = "Checklist progress" }: { percent: number; overdue?: number; label?: string }) {
  return (
    <div className={`ob-progress ${overdue ? "has-overdue" : ""} ${percent >= 100 ? "full" : ""}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${Math.max(percent, percent ? 3 : 0)}%` }} />
    </div>
  );
}

/** Four-segment strip: one cell per phase, filled by that phase's completion. */
export function PhaseStrip({ phases, current }: { phases: Partial<Record<Phase, PhaseProgress>>; current?: Phase }) {
  return (
    <ol className="ob-phase-strip" aria-label="Progress by phase">
      {PHASES.map((phase) => {
        const value = phases[phase.key];
        const pct = value?.total ? value.percent : 0;
        return (
          <li key={phase.key} className={`${current === phase.key ? "current" : ""} ${value?.overdue ? "late" : ""}`} title={`${phase.label}: ${value ? `${value.closed}/${value.total}` : "no tasks"}`}>
            <span><i style={{ width: `${pct}%` }} /></span>
            <small>{phase.short}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function currentPhase(status: string, daysToJoin: number): Phase {
  if (status === "PRE_BOARDING" || status === "READY_TO_JOIN") return daysToJoin > 0 ? "PRE_BOARDING" : "DAY_ONE";
  const day = -daysToJoin;
  if (day < 1) return "DAY_ONE";
  if (day < 7) return "FIRST_WEEK";
  return "FIRST_90_DAYS";
}

export function PersonSelect({ value, onChange, id, placeholder = "Not assigned", exclude = [], required }: {
  value: string; onChange: (value: string) => void; id?: string; placeholder?: string; exclude?: string[]; required?: boolean;
}) {
  const [people, setPeople] = useState<Employee[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { loadEmployees().then(setPeople).catch((reason) => setError(errorText(reason, "Unable to load colleagues."))); }, []);
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={!people && !error}>
      <option value="">{error ? "Colleagues unavailable" : people ? placeholder : "Loading colleagues…"}</option>
      {people?.filter((person) => !exclude.includes(person.id) || person.id === value).map((person) => (
        <option key={person.id} value={person.id}>{person.fullName} · {person.designation || person.department || person.employeeNumber}</option>
      ))}
    </select>
  );
}

/** One checklist line. Owners (and HR) can complete or skip; HR can also reassign and move the due date. */
export function TaskRow({ task, onChanged, showJoiner, flash }: { task: Task; onChanged: (task: Task) => void; showJoiner?: boolean; flash?: (message: string) => void }) {
  const [mode, setMode] = useState<"" | "complete" | "skip" | "edit">("");
  const [note, setNote] = useState("");
  const [ownerId, setOwnerId] = useState(task.owner?.id || "");
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setOwnerId(task.owner?.id || ""); setDueDate(task.dueDate); }, [task.version, task.owner?.id, task.dueDate]);
  const open = task.status === "PENDING";
  const reset = () => { setMode(""); setNote(""); setError(""); };

  const act = async (action: "complete" | "skip" | "reopen") => {
    if (action === "skip" && !note.trim()) { setError("Add a short note explaining why this is skipped."); return; }
    setBusy(true); setError("");
    try {
      const { task: updated } = await onboardingApi.taskAction(task.id, { action, version: task.version, note: note.trim() || undefined });
      reset(); onChanged({ ...updated, joiner: task.joiner });
      flash?.(action === "complete" ? `“${task.title}” done` : action === "skip" ? "Task skipped" : "Task reopened");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const body: { version: number; ownerId?: string; dueDate?: string } = { version: task.version };
      if (ownerId !== (task.owner?.id || "")) body.ownerId = ownerId;
      if (dueDate !== task.dueDate) body.dueDate = dueDate;
      const { task: updated } = await onboardingApi.updateTask(task.id, body);
      reset(); onChanged({ ...updated, joiner: task.joiner }); flash?.("Task updated");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const StatusIcon = task.status === "DONE" ? CheckCircle2 : task.status === "SKIPPED" ? CircleSlash : Circle;
  return (
    <li className={`ob-task status-${task.status.toLowerCase()} ${task.overdue ? "overdue" : ""} ${task.mine ? "mine" : ""}`}>
      <span className="ob-task-icon" aria-hidden><StatusIcon size={20} /></span>
      <div className="ob-task-main">
        <p className="ob-task-title">
          <b>{task.title}</b>
          {task.requiresDocument && <em className="ob-chip"><FileText size={11} /> {task.documentLabel}</em>}
          {task.completesOnConversion && open && <em className="ob-chip auto" title="Closes automatically when HR converts the joiner"><Sparkles size={11} /> Auto on day one</em>}
        </p>
        {showJoiner && task.joiner && (
          <p className="ob-task-joiner"><Link href={`/onboarding/${task.joiner.id}`}>{task.joiner.name}</Link> · {task.joiner.designation} · joins {shortDate(task.joiner.joiningDate)}</p>
        )}
        {task.description && open && <p className="ob-task-desc">{task.description}</p>}
        <p className="ob-task-meta">
          <span className="ob-owner"><Avatar name={task.owner?.name || task.ownerTypeLabel} small muted={!task.owner} /> {task.owner?.name || (task.ownerType === "JOINER" ? "Joiner (HR collects until day one)" : "Unassigned")}<small>{task.ownerTypeLabel}</small></span>
          <span className={task.overdue ? "ob-due over" : "ob-due"}><Clock3 size={12} /> {shortDate(task.dueDate)}{open && <> · {dueText(task)}</>}</span>
          {!open && <span className="ob-done-by">{task.status === "DONE" ? "Done" : "Skipped"}{task.completedBy ? ` by ${task.completedBy}` : ""}</span>}
        </p>
        {task.note && <p className="ob-task-note">{task.note}</p>}
        {error && <p className="cw-alert" role="alert">{error}</p>}
        {(mode === "complete" || mode === "skip") && (
          <div className="ob-inline-form">
            <label className="cw-note"><span>{mode === "skip" ? <>Why skip? <em>*</em></> : <>Note <small>(optional)</small></>}</span>
              <textarea rows={2} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} autoFocus placeholder={mode === "skip" ? "e.g. Not applicable for part-time roles" : "Anything the next owner should know"} />
            </label>
            <div className="cw-action-row">
              <button type="button" className="cw-btn ghost" onClick={reset} disabled={busy}>Cancel</button>
              <button type="button" className={`cw-btn ${mode === "skip" ? "danger" : "primary"}`} onClick={() => act(mode)} disabled={busy}>{busy ? "Saving…" : mode === "skip" ? "Skip task" : "Mark done"}</button>
            </div>
          </div>
        )}
        {mode === "edit" && (
          <div className="ob-inline-form cw-fields">
            <label><span>Owner</span><PersonSelect value={ownerId} onChange={setOwnerId} placeholder={`Default ${task.ownerTypeLabel.toLowerCase()} owner`} /></label>
            <label><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <div className="cw-action-row wide">
              <button type="button" className="cw-btn ghost" onClick={reset} disabled={busy}>Cancel</button>
              <button type="button" className="cw-btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        )}
      </div>
      <div className="ob-task-actions">
        {open && task.canAct && !mode && (
          <>
            <button type="button" className="cw-btn primary" onClick={() => { if (task.requiresDocument) act("complete"); else setMode("complete"); }} disabled={busy}><Check size={15} /> Done</button>
            <button type="button" className="cw-icon-button" aria-label={`Skip ${task.title}`} title="Skip" onClick={() => setMode("skip")}><X size={15} /></button>
          </>
        )}
        {open && task.canEdit && !mode && <button type="button" className="cw-icon-button" aria-label={`Edit owner or due date for ${task.title}`} title="Reassign or move" onClick={() => setMode("edit")}><Pencil size={14} /></button>}
        {!open && task.canAct && <button type="button" className="cw-icon-button" aria-label={`Reopen ${task.title}`} title="Reopen" onClick={() => act("reopen")} disabled={busy}><RotateCcw size={14} /></button>}
      </div>
    </li>
  );
}
