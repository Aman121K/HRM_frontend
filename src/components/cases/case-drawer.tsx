"use client";
import { AlertTriangle, Check, CircleDot, Clock3, MessageSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { caseUi } from "@/lib/case-ui";
import { caseApi, dueLabel, initials, money, relativeTime, shortDate, type CaseAction, type CaseEvent, type CaseItem, type CaseModule, type FieldDef } from "@/lib/cases";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { CaseFields, cleanValues } from "./case-form";
import { Attachments } from "@/components/files/attachments";

export function StatusBadge({ tone, label }: { tone: string; label: string }) {
  return <span className={`cw-badge tone-${tone}`}><i />{label}</span>;
}

function humanize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()).replace(/ id$/i, " ID");
}

export function CaseDrawer({ id, module, onClose, onChanged }: { id: string; module: CaseModule; onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [item, setItem] = useState<(CaseItem & { events: CaseEvent[] }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CaseAction | null>(null);
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  useDialogFocus(true, onClose, ref);
  const ui = caseUi[module.key];

  const load = useCallback(async () => {
    try { setItem(await caseApi.get(id)); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to open this request."); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (action: CaseAction, withNote = note, withValues = values) => {
    if (!item) return;
    if (action.noteRequired && !withNote.trim()) { setError("Please add a note for this action."); return; }
    setBusy(true); setError("");
    try {
      await caseApi.transition(item.id, { action: action.action, version: item.version, note: withNote.trim() || undefined, values: cleanValues(action.fields, withValues) });
      setPending(null); setNote(""); setValues({});
      await load(); onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this request.");
    } finally { setBusy(false); }
  };

  const start = (action: CaseAction) => {
    setError("");
    if (!action.noteRequired && !action.fields.length && action.intent !== "danger") { run(action, "", {}); return; }
    setPending(action); setNote(""); setValues({});
  };

  const postComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !comment.trim()) return;
    setBusy(true);
    try { await caseApi.comment(item.id, comment); setComment(""); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add comment."); } finally { setBusy(false); }
  };

  const fieldLabels = new Map<string, FieldDef>(module.fields.map((field) => [field.key, field]));
  const statusLabel = (key: string | null) => module.statuses.find((status) => status.key === key)?.label || key || "";
  const path = ui?.path || [];
  const currentIndex = item ? path.indexOf(item.status) : -1;
  const offPath = item && currentIndex === -1;

  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cw-drawer-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: ui?.accent }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          {!item && !error && <div className="cw-skeleton" aria-label="Loading"><i /><i /><i /></div>}
          {item && (
            <>
              <p className="cw-eyebrow">{item.caseNumber} · {module.singular.toUpperCase()}</p>
              <h2 id="cw-drawer-title">{item.title}</h2>
              <div className="cw-head-meta">
                <StatusBadge tone={item.tone} label={item.statusLabel} />
                {item.overdue ? <span className="cw-sla over"><AlertTriangle size={13} /> {dueLabel(item.dueAt, item.slaStopped)}</span>
                  : item.dueAt && !item.slaStopped ? <span className="cw-sla"><Clock3 size={13} /> {dueLabel(item.dueAt, item.slaStopped)}</span> : null}
                <span>Raised by <b>{item.relation === "mine" ? "you" : item.requester.name}</b> · {relativeTime(item.createdAt)}</span>
              </div>
            </>
          )}
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {item && (
            <>
              {path.length > 1 && (
                <ol className={`cw-stepper ${offPath ? "is-off" : ""}`} aria-label="Progress">
                  {path.map((key, index) => (
                    <li key={key} className={index < currentIndex || (item.terminal && index === currentIndex) ? "done" : index === currentIndex ? "current" : ""}>
                      <span>{index < currentIndex || (item.terminal && index === currentIndex) ? <Check size={12} /> : index + 1}</span>
                      <small>{statusLabel(key)}</small>
                    </li>
                  ))}
                </ol>
              )}
              {offPath && path.length > 1 && (
                <p className={`cw-offpath tone-${item.tone}`}>
                  {item.terminal ? <>This {module.singular} ended as <b>{item.statusLabel.toLowerCase()}</b>.</> : <>Currently <b>{item.statusLabel.toLowerCase()}</b>.</>}
                </p>
              )}
              {item.details.policyFlag && <p className="cw-alert warn"><AlertTriangle size={15} /> {item.details.policyFlag}</p>}

              {!!item.actions.length && (
                <section className="cw-action-panel">
                  <p className="cw-section-label">Your action</p>
                  {!pending ? (
                    <div className="cw-action-row">
                      {item.actions.map((action) => (
                        <button key={action.action} disabled={busy} className={`cw-btn ${action.intent === "primary" ? "primary" : action.intent === "danger" ? "danger" : "ghost"}`} onClick={() => start(action)}>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form className="cw-action-form" onSubmit={(event) => { event.preventDefault(); run(pending); }}>
                      <b>{pending.label}</b>
                      {!!pending.fields.length && <CaseFields fields={pending.fields} values={values} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />}
                      <label className="cw-note">
                        <span>Note{pending.noteRequired ? <em> *</em> : <small> optional</small>}</span>
                        <textarea rows={3} value={note} required={pending.noteRequired} onChange={(event) => setNote(event.target.value)} placeholder="Add context for everyone on this request" />
                      </label>
                      <div className="cw-action-row">
                        <button type="button" className="cw-btn ghost" onClick={() => setPending(null)}>Back</button>
                        <button disabled={busy} className={`cw-btn ${pending.intent === "danger" ? "danger" : "primary"}`}>{busy ? "Saving…" : `Confirm · ${pending.label}`}</button>
                      </div>
                    </form>
                  )}
                </section>
              )}

              <dl className="cw-facts">
                {item.category && <div><dt>{fieldLabels.get("category")?.label || "Category"}</dt><dd>{item.category}</dd></div>}
                {module.fields.some((field) => field.key === "priority") && <div><dt>Priority</dt><dd><span className={`cw-priority p-${item.priority.toLowerCase()}`}>{item.priority.toLowerCase()}</span></dd></div>}
                {item.amount !== null && <div><dt>{fieldLabels.get("amount")?.label.replace(" (₹)", "") || "Amount"}</dt><dd className="cw-amount">{money(item.amount)}</dd></div>}
                {item.startDate && <div><dt>{fieldLabels.get("startDate")?.label || "Start"}</dt><dd>{shortDate(item.startDate)}</dd></div>}
                {item.endDate && <div><dt>{fieldLabels.get("endDate")?.label || "End"}</dt><dd>{shortDate(item.endDate)}</dd></div>}
                {item.subject && <div><dt>{fieldLabels.get("subjectEmployeeId")?.label.replace(" (optional)", "") || "Colleague"}</dt><dd>{item.subject.name}</dd></div>}
                <div><dt>Requested by</dt><dd>{item.requester.name}<small>{[item.requester.designation, item.requester.department].filter(Boolean).join(" · ")}</small></dd></div>
                {module.routing === "manager" && <div><dt>Approver</dt><dd>{item.approver?.name || "HR (no reporting manager)"}</dd></div>}
                {(item.assignee || module.routing === "hr") && <div><dt>Handled by</dt><dd>{item.assignee?.name || "Unassigned"}</dd></div>}
                {Object.entries(item.details).filter(([key]) => key !== "policyFlag").map(([key, value]) => (
                  <div key={key} className={String(value).length > 60 ? "wide" : ""}>
                    <dt>{fieldLabels.get(key)?.label || humanize(key)}</dt>
                    <dd className="pre">{typeof value === "number" && /amount|ctc/i.test(key) ? money(value) : /date$/i.test(key) && typeof value === "string" ? shortDate(value) : String(value)}</dd>
                  </div>
                ))}
              </dl>

              <Attachments entityType="hr_case" entityId={item.id} canUpload={!item.terminal}
                category={module.key === "expenses" ? "RECEIPT" : "ATTACHMENT"}
                label={module.key === "expenses" ? "Bills & receipts" : module.key === "letters" ? "Letter & documents" : "Attachments"}
                hint={module.key === "expenses" ? "Attach the bill or receipt · PDF or photo up to 8 MB" : undefined} />

              <section className="cw-timeline">
                <p className="cw-section-label">Activity</p>
                <ol>
                  {item.events.map((event) => (
                    <li key={event.id} className={`kind-${event.kind.toLowerCase()}`}>
                      <span className="cw-avatar small">{initials(event.actorName)}</span>
                      <div>
                        <p>
                          <b>{event.actorName}</b>{" "}
                          {event.kind === "CREATED" ? `raised this ${module.singular}` : event.kind === "COMMENT" ? "commented" : <>moved it to <b className="to">{statusLabel(event.toStatus)}</b></>}
                          <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
                        </p>
                        {event.note && <blockquote>{event.note}</blockquote>}
                        {event.kind === "TRANSITION" && Object.keys(event.data || {}).length > 0 && (
                          <small className="cw-event-data">{Object.entries(event.data).map(([key, value]) => `${humanize(key)}: ${/amount/i.test(key) ? money(Number(value)) : value}`).join(" · ")}</small>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <form className="cw-comment" onSubmit={postComment}>
                  <MessageSquare size={16} />
                  <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment…" aria-label="Comment" maxLength={2000} />
                  <button className="cw-icon-button" disabled={busy || !comment.trim()} aria-label="Post comment"><Send size={15} /></button>
                </form>
              </section>
            </>
          )}
          {!item && !error && <p className="cw-muted"><CircleDot size={14} /> Loading request…</p>}
        </div>
      </aside>
    </>
  );
}
