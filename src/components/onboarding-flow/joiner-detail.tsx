"use client";
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarClock, History, Lock, Mail, Pencil, Plus, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { relativeTime, shortDate } from "@/lib/cases";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { ApiRequestError } from "@/lib/http-client";
import { countdown, DOC_CATEGORIES, employmentLabel, errorText, onboardingApi, OWNER_TYPES, PHASES, type Activity, type JoinerAction, type JoinerDetail as Detail, type Phase, type Task } from "./api";
import { DocumentsPanel } from "./documents-panel";
import { JoinerDrawer } from "./joiner-drawer";
import { Avatar, Badge, currentPhase, PersonSelect, ProgressBar, TaskRow } from "./shared";

const ACCENT = "#0f8177";
const addDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

export function JoinerDetailPage({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<JoinerAction | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "mine">("all");
  const [adding, setAdding] = useState<Phase | null>(null);
  const [toast, setToast] = useState("");
  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); }, []);
  const load = useCallback(async () => {
    try { setDetail(await onboardingApi.joiner(id)); setError(null); }
    catch (reason) { setError({ message: errorText(reason, "Unable to load this joiner."), status: reason instanceof ApiRequestError ? reason.status : undefined }); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error && !detail) return (
    <div className="cw-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/onboarding" className="ob-back"><ArrowLeft size={15} /> Onboarding</Link>
      <div className="cw-empty">
        <span>{error.status === 404 ? <Lock size={26} /> : <AlertTriangle size={26} />}</span>
        <h2>{error.status === 404 ? "Joiner not available" : "Could not load this joiner"}</h2>
        <p>{error.status === 404 ? "This onboarding record does not exist or is not shared with you. Joiners are visible to HR, their manager, buddy and task owners." : error.message}</p>
        {error.status !== 404 && <button className="cw-btn ghost" onClick={load}>Try again</button>}
      </div>
    </div>
  );
  if (!detail) return <div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading joiner" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /><i /></div></div>;

  const { joiner, tasks, phases, documents, access, actions, activity } = detail;
  const phaseNow = currentPhase(joiner.status, joiner.daysToJoin);
  const closed = joiner.status === "COMPLETED" || joiner.status === "WITHDRAWN";
  const visible = tasks.filter((task) => filter === "all" || (filter === "open" && task.status === "PENDING") || (filter === "mine" && task.mine));
  const mine = tasks.filter((task) => task.mine && task.status === "PENDING").length;
  const replaceTask = (task: Task) => { setDetail((current) => current && { ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }); window.setTimeout(load, 300); };
  const phaseRange = (phase: Phase) => phase === "PRE_BOARDING" ? `until ${shortDate(addDays(joiner.joiningDate, -1))}` : phase === "DAY_ONE" ? shortDate(joiner.joiningDate)
    : phase === "FIRST_WEEK" ? `${shortDate(addDays(joiner.joiningDate, 1))} – ${shortDate(addDays(joiner.joiningDate, 6))}` : `until ${shortDate(addDays(joiner.joiningDate, 89))}`;

  return (
    <div className="cw-page ob-page ob-detail" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/onboarding" className="ob-back"><ArrowLeft size={15} /> Onboarding</Link>
      <header className="ob-detail-head">
        <Avatar name={joiner.fullName} />
        <div className="ob-detail-title">
          <p className="cw-eyebrow">{joiner.fromCandidate ? "HIRED CANDIDATE · " : ""}{employmentLabel(joiner.employmentType).toUpperCase()}{joiner.employee ? ` · ${joiner.employee.number}` : ""}</p>
          <h1>{joiner.fullName}</h1>
          <p>{joiner.designation} · {joiner.department}{joiner.location ? ` · ${joiner.location}` : ""}</p>
          <div className="ob-detail-meta">
            <Badge tone={joiner.tone} label={joiner.statusLabel} />
            <span className="ob-countdown"><CalendarClock size={13} /> <b>{countdown(joiner.daysToJoin, joiner.status)}</b> · {shortDate(joiner.joiningDate)}</span>
            {joiner.progress && <span className="ob-head-progress"><ProgressBar percent={joiner.progress.percent} overdue={joiner.progress.overdue} /> <b>{joiner.progress.percent}%</b>{joiner.progress.overdue ? <em>{joiner.progress.overdue} overdue</em> : null}</span>}
          </div>
        </div>
        {access === "hr" && (
          <div className="ob-detail-actions">
            {!closed && <button className="cw-btn ghost" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>}
            {actions.map((action) => (
              <button key={action.action} className={`cw-btn ${action.intent === "primary" ? "primary" : action.intent === "danger" ? "danger" : "ghost"}`}
                disabled={!!action.blockedReason} title={action.blockedReason} onClick={() => setDialog(action)}>
                {action.action === "convert" && <UserCheck size={15} />}{action.action === "ready" && <BadgeCheck size={15} />}{action.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {access === "hr" && actions.find((action) => action.blockedReason && action.intent === "primary") && (
        <p className="ob-blocked"><Lock size={13} /> {actions.find((action) => action.blockedReason && action.intent === "primary")!.label}: {actions.find((action) => action.blockedReason && action.intent === "primary")!.blockedReason}</p>
      )}
      {joiner.status === "WITHDRAWN" && <p className="cw-alert warn"><AlertTriangle size={15} /> Withdrawn {joiner.withdrawnAt ? relativeTime(joiner.withdrawnAt) : ""}: {joiner.withdrawnReason}</p>}
      {joiner.status === "JOINED" && joiner.employee && <p className="ob-joined-banner"><UserCheck size={15} /> Employee record {joiner.employee.number} created {joiner.convertedAt ? relativeTime(joiner.convertedAt) : ""} · <Link href="/directory">View in directory</Link></p>}

      <ol className="ob-timeline" aria-label="Onboarding phases">
        {phases.map((phase, index) => {
          const done = phase.total > 0 && phase.closed === phase.total;
          const state = joiner.status === "WITHDRAWN" ? "" : done ? "done" : phase.key === phaseNow && !closed ? "current" : PHASES.findIndex((item) => item.key === phaseNow) > index ? "late" : "";
          return (
            <li key={phase.key} className={state}>
              <span className="ob-tl-dot">{done ? <BadgeCheck size={14} /> : index + 1}</span>
              <div><b>{phase.label}</b><small>{phaseRange(phase.key)}</small>
                <p><ProgressBar percent={phase.percent} overdue={phase.overdue} label={`${phase.label} progress`} /><span>{phase.closed}/{phase.total}{phase.overdue ? ` · ${phase.overdue} overdue` : ""}</span></p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="ob-detail-grid">
        <section className="ob-panel ob-checklist" aria-labelledby="ob-checklist-title">
          <header>
            <h2 id="ob-checklist-title">Checklist</h2>
            <div className="cw-chips" aria-label="Filter tasks">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <b>{tasks.length}</b></button>
              <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>Open <b>{tasks.filter((task) => task.status === "PENDING").length}</b></button>
              {tasks.some((task) => task.mine) && <button className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>Mine <b>{mine}</b></button>}
            </div>
          </header>
          {PHASES.map((phase) => {
            const list = visible.filter((task) => task.phase === phase.key);
            if (!list.length && !(access === "hr" && !closed && filter === "all")) return null;
            return (
              <div key={phase.key} className="ob-check-phase">
                <p className="cw-section-label">{phase.label} <span>{phaseRange(phase.key)}</span>
                  {access === "hr" && !closed && <button type="button" className="ob-add-link" onClick={() => setAdding(adding === phase.key ? null : phase.key)}><Plus size={12} /> Add task</button>}
                </p>
                {adding === phase.key && <AddTaskForm joinerId={joiner.id} phase={phase.key} joiningDate={joiner.joiningDate} onCancel={() => setAdding(null)} onAdded={() => { setAdding(null); flash("Task added"); load(); }} />}
                <ul className="ob-task-list">{list.map((task) => <TaskRow key={task.id} task={task} onChanged={replaceTask} flash={flash} />)}</ul>
                {!list.length && adding !== phase.key && <p className="ob-column-empty">No tasks in this phase.</p>}
              </div>
            );
          })}
          {!visible.length && <p className="ob-column-empty">{filter === "mine" ? "Nothing assigned to you here." : "No open tasks — everything is closed."}</p>}
        </section>

        <aside className="ob-side">
          <section className="ob-panel">
            <header><h2>People & details</h2></header>
            <dl className="cw-facts">
              <div><dt>Reporting manager</dt><dd>{joiner.manager ? <>{joiner.manager.name}<small>{joiner.manager.designation}</small></> : <span className="ob-missing">Not set</span>}</dd></div>
              <div><dt>Buddy</dt><dd>{joiner.buddy ? <>{joiner.buddy.name}<small>{joiner.buddy.designation}</small></> : <span className="ob-missing">Not assigned</span>}</dd></div>
              <div><dt>Joining date</dt><dd>{shortDate(joiner.joiningDate)}<small>{employmentLabel(joiner.employmentType)}</small></dd></div>
              <div><dt>Work email</dt><dd>{joiner.workEmail || <small>Created on day one</small>}</dd></div>
              {joiner.personalEmail && <div><dt>Personal email</dt><dd><a href={`mailto:${joiner.personalEmail}`}>{joiner.personalEmail}</a>{joiner.phone && <small>{joiner.phone}</small>}</dd></div>}
              {(access === "hr" || access === "manager") && <div><dt>PAN · Aadhaar</dt><dd>{access === "hr" && joiner.panMasked ? <RevealPan joinerId={joiner.id} masked={joiner.panMasked} /> : joiner.panMasked || "—"}<small>{joiner.aadhaarMasked || "Aadhaar not recorded"}</small></dd></div>}
              {joiner.templateName && <div className="wide"><dt>Checklist</dt><dd>{joiner.templateName}</dd></div>}
              {joiner.notes && <div className="wide"><dt>HR notes</dt><dd className="pre">{joiner.notes}</dd></div>}
            </dl>
          </section>
          {documents && <DocumentsPanel joinerId={joiner.id} documents={documents} fileAccess={detail.fileAccess} onChanged={load} onDetail={setDetail} flash={flash}
            maskedIds={{ pan: joiner.panMasked, aadhaar: joiner.aadhaarMasked }} />}
          {activity.length > 0 && <ActivityPanel items={activity} />}
        </aside>
      </div>

      {editing && <JoinerDrawer joiner={joiner} onClose={() => setEditing(false)} onSaved={(next) => { setEditing(false); setDetail(next); flash("Joiner updated"); }} />}
      {dialog && <TransitionDialog detail={detail} action={dialog} onClose={() => setDialog(null)} onDone={(next, message) => { setDialog(null); setDetail(next); flash(message); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function AddTaskForm({ joinerId, phase, joiningDate, onCancel, onAdded }: { joinerId: string; phase: Phase; joiningDate: string; onCancel: () => void; onAdded: () => void }) {
  const offset: Record<Phase, number> = { PRE_BOARDING: -2, DAY_ONE: 0, FIRST_WEEK: 4, FIRST_90_DAYS: 45 };
  const [values, setValues] = useState({ title: "", ownerType: "HR", ownerId: "", dueDate: addDays(joiningDate, offset[phase]), documentCategory: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await onboardingApi.addTask(joinerId, { phase, title: values.title.trim(), ownerType: values.ownerType, dueDate: values.dueDate,
        ...(values.ownerId ? { ownerId: values.ownerId } : {}), ...(values.documentCategory ? { documentCategory: values.documentCategory } : {}) });
      onAdded();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  return (
    <form className="ob-add-task cw-fields" onSubmit={submit}>
      {error && <p className="cw-alert wide" role="alert">{error}</p>}
      <label className="wide"><span>Task <em>*</em></span><input value={values.title} required minLength={3} maxLength={160} autoFocus onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="e.g. Collect previous employer relieving letter" /></label>
      <label><span>Owner role</span><select value={values.ownerType} onChange={(event) => setValues({ ...values, ownerType: event.target.value })}>{OWNER_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label><span>Specific person <small>(optional)</small></span><PersonSelect value={values.ownerId} onChange={(ownerId) => setValues({ ...values, ownerId })} placeholder="Default for the role" /></label>
      <label><span>Due date</span><input type="date" value={values.dueDate} required onChange={(event) => setValues({ ...values, dueDate: event.target.value })} /></label>
      <label><span>Needs a document</span><select value={values.documentCategory} onChange={(event) => setValues({ ...values, documentCategory: event.target.value })}><option value="">No</option>{DOC_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <div className="cw-action-row wide"><button type="button" className="cw-btn ghost" onClick={onCancel}>Cancel</button><button className="cw-btn primary" disabled={busy}>{busy ? "Adding…" : "Add task"}</button></div>
    </form>
  );
}

function TransitionDialog({ detail, action, onClose, onDone }: { detail: Detail; action: JoinerAction; onClose: () => void; onDone: (detail: Detail, message: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDialogFocus(true, close, ref);
  const { joiner, tasks } = detail;
  const [note, setNote] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [preview, setPreview] = useState<{ workEmail: string; employeeNumber: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (action.action === "convert") onboardingApi.conversionPreview(joiner.id).then((data) => { setPreview(data); setWorkEmail(data.workEmail); }).catch((reason) => setError(errorText(reason)));
  }, [action.action, joiner.id]);
  const auto = tasks.filter((task) => task.completesOnConversion && task.status === "PENDING");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (action.noteRequired && !note.trim()) { setError("Add a reason."); return; }
    setBusy(true); setError("");
    try {
      const next = await onboardingApi.transition(joiner.id, { action: action.action, version: joiner.version, note: note.trim() || undefined, ...(action.action === "convert" && workEmail ? { workEmail } : {}) });
      const messages: Record<string, string> = {
        ready: `${joiner.fullName} is ready to join`, convert: `Welcome ${joiner.fullName.split(" ")[0]}! Employee ${next.joiner.employee?.number} created`,
        complete: "Onboarding marked complete", withdraw: "Joiner withdrawn and open tasks closed", back_to_preboarding: "Moved back to pre-boarding",
      };
      onDone(next, messages[action.action] || "Updated");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={close} />
      <aside className="cw-drawer ob-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ob-transition-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: action.intent === "danger" ? "#c75b48" : ACCENT }}>
          <button className="cw-icon-button" aria-label="Close" onClick={close}><X size={18} /></button>
          <p className="cw-eyebrow">{joiner.fullName.toUpperCase()}</p>
          <h2 id="ob-transition-title">{action.label}</h2>
          <p className="cw-head-note">{action.action === "convert" ? "Creates the employee record, login and employee number, closes the automatic day-one tasks and sends the welcome message."
            : action.action === "withdraw" ? "Closes every open task and tells the manager, buddy and task owners." : action.action === "ready" ? "Confirms paperwork is complete. The manager is notified."
            : action.action === "complete" ? "Closes the onboarding. The joiner and manager are notified." : "Reopens pre-boarding so more paperwork can be collected."}</p>
        </header>
        <form className="cw-drawer-body cw-create" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {action.action === "convert" && (
            <>
              <dl className="cw-facts">
                <div><dt>Employee number</dt><dd>{preview?.employeeNumber || "…"}</dd></div>
                <div><dt>Joining date</dt><dd>{shortDate(joiner.joiningDate)}</dd></div>
                <div><dt>Reports to</dt><dd>{joiner.manager?.name || "—"}</dd></div>
                <div><dt>Role</dt><dd>{joiner.designation}<small>{joiner.department}</small></dd></div>
              </dl>
              <div className="cw-fields"><label className="wide"><span><Mail size={12} /> Work email</span><input type="email" value={workEmail} onChange={(event) => setWorkEmail(event.target.value)} required maxLength={200} /></label></div>
              {auto.length > 0 && <p className="cw-help">Closed automatically: {auto.map((task) => task.title).join(" · ")}</p>}
              {joiner.daysToJoin > 0 && <p className="cw-alert warn">Joining date is {joiner.daysToJoin} day{joiner.daysToJoin > 1 ? "s" : ""} away — converting early lets IT set up access in advance.</p>}
            </>
          )}
          <label className="cw-note"><span>{action.noteRequired ? <>Reason <em>*</em></> : <>Note <small>(optional, kept in the audit trail)</small></>}</span>
            <textarea rows={3} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder={action.action === "withdraw" ? "e.g. Declined the offer — accepted a counter-offer" : ""} />
          </label>
          <footer className="cw-create-foot">
            <button type="button" className="cw-btn ghost" onClick={close}>Cancel</button>
            <button className={`cw-btn ${action.intent === "danger" ? "danger" : "primary"}`} disabled={busy || (action.action === "convert" && !preview)}>{busy ? "Working…" : action.label}</button>
          </footer>
        </form>
      </aside>
    </>
  );
}

const ACTIVITY: Record<string, string> = {
  ONBOARDING_JOINER_CREATED: "added the joiner", ONBOARDING_JOINER_UPDATED: "updated details", ONBOARDING_READY_TO_JOIN: "marked ready to join",
  ONBOARDING_REOPENED: "moved back to pre-boarding", ONBOARDING_CONVERTED: "converted to employee", ONBOARDING_COMPLETED: "completed onboarding",
  ONBOARDING_WITHDRAWN: "withdrew the joiner", ONBOARDING_DOCUMENT_VERIFIED: "verified a document", ONBOARDING_DOCUMENT_REJECTED: "rejected a document",
  FILE_UPLOADED: "uploaded a file", FILE_REMOVED: "removed a file", ONBOARDING_TASK_COMPLETE: "completed", ONBOARDING_TASK_SKIP: "skipped",
  ONBOARDING_TASK_REOPEN: "reopened", ONBOARDING_TASK_UPDATED: "reassigned or rescheduled", ONBOARDING_TASK_ADDED: "added task",
};
function ActivityPanel({ items }: { items: Activity[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section className="ob-panel ob-activity">
      <header><h2><History size={15} /> Activity</h2></header>
      <ol>
        {shown.map((item) => (
          <li key={item.id}>
            <b>{item.actorName || "System"}</b> {ACTIVITY[item.action] || item.action.toLowerCase().replace(/_/g, " ")}
            {item.data?.title ? <> “{item.data.title}”</> : item.data?.name ? <> {item.data.name}</> : item.data?.employeeNumber ? <> · {item.data.employeeNumber}</> : null}
            {item.data?.reason || item.data?.note ? <em>{item.data.reason || item.data.note}</em> : null}
            <time>{relativeTime(item.createdAt)}</time>
          </li>
        ))}
      </ol>
      {items.length > 8 && <button className="ob-add-link" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${items.length}`}</button>}
    </section>
  );
}

/** HR only: masked PAN with an audited "Show" (POST /joiners/:id/reveal); hides again after 30 seconds. */
function RevealPan({ joinerId, masked }: { joinerId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!value) return; const timer = window.setTimeout(() => setValue(null), 30_000); return () => window.clearTimeout(timer); }, [value]);
  const toggle = async () => {
    if (value) { setValue(null); return; }
    setBusy(true); setError("");
    try { setValue((await onboardingApi.revealPan(joinerId)).value); } catch (reason) { setError(errorText(reason, "Unable to show")); } finally { setBusy(false); }
  };
  return (
    <>
      {value || masked}{" "}
      <button type="button" className="cw-btn ghost" style={{ padding: "2px 8px", minHeight: 0, fontSize: 12 }} onClick={toggle} disabled={busy}
        title={value ? "Hide" : "Show — viewing is recorded in the audit log"}>{busy ? "…" : value ? "Hide" : "Show"}</button>
      {error && <small role="alert">{error}</small>}
    </>
  );
}
