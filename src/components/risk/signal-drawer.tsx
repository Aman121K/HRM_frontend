"use client";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, CheckCheck, Eye, History, RotateCcw, ShieldOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { initials, money, relativeTime, shortDate } from "@/lib/cases";
import { ApiRequestError } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { AREA_LABELS, SEVERITY_LABEL, STATUS_LABEL, STATUS_TONE, riskApi, type CellKind, type Person, type SignalDetail } from "./risk-api";

const EVENT_LABEL: Record<string, string> = {
  DETECTED: "Detected", ESCALATED: "Severity rose", ACKNOWLEDGED: "Acknowledged", RESOLVED: "Resolved", DISMISSED: "Dismissed",
  REOPENED: "Re-opened", AUTO_RESOLVED: "Resolved automatically", CLEARED: "No longer detected",
};

function Cell({ kind, value }: { kind?: CellKind; value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="rk-muted">—</span>;
  switch (kind) {
    case "person": {
      const person = value as Person;
      return <span className={`rk-person-cell${person.redacted ? " redacted" : ""}`}>{person.name}{person.number ? <small> · {person.number}</small> : null}</span>;
    }
    case "money": return <span className="num">{money(Number(value))}</span>;
    case "date": return <span>{shortDate(String(value))}</span>;
    case "datetime": return <span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date(String(value)))}</span>;
    case "km": return <span className="num">{Number(value).toLocaleString("en-IN")} km</span>;
    case "hours": return <span className="num">{Number(value).toLocaleString("en-IN")} h</span>;
    case "percent": return <span className="num">{Number(value)}%</span>;
    case "number": return <span className="num">{Number(value).toLocaleString("en-IN")}</span>;
    default: return <span>{String(value)}</span>;
  }
}

type Action = "acknowledge" | "resolve" | "dismiss" | "reopen";

/** One signal: plain-language explanation, evidence, affected people, recommended action and lifecycle with notes. */
export function SignalDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [intent, setIntent] = useState<Action | null>(null);
  const [done, setDone] = useState("");

  const load = useCallback(() => {
    setError("");
    riskApi.signal(id).then(setSignal).catch((reason: Error) => setError(reason.message || "Could not load this signal."));
  }, [id]);
  useEffect(load, [load]);

  const act = async (action: Action) => {
    if (!signal) return;
    if (action === "dismiss" && note.trim().length < 5) { setIntent("dismiss"); setError("Say why you're dismissing this — at least 5 characters. It's kept in the audit trail."); return; }
    setBusy(action); setError("");
    try {
      await riskApi.act(signal.id, action, { note: note.trim() || undefined, version: signal.version });
      setNote(""); setIntent(null);
      setDone({ acknowledge: "Acknowledged — the team knows someone is on it.", resolve: "Marked as resolved.", dismiss: "Dismissed. It will re-open only if the evidence changes.", reopen: "Re-opened." }[action]);
      window.setTimeout(() => setDone(""), 3200);
      load(); onChanged();
    } catch (reason) {
      const conflict = reason instanceof ApiRequestError && reason.status === 409;
      setError(conflict ? "Someone else updated this signal just now — showing the latest version. Please try again." : (reason as Error).message);
      if (conflict) load();
    } finally { setBusy(null); }
  };

  const open = signal && (signal.status === "OPEN" || signal.status === "ACKNOWLEDGED");
  const evidence = signal?.evidence;

  return (
    <>
      <button className="flow-backdrop" aria-label="Close signal" onClick={onClose} />
      <aside className="cw-drawer rk-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rk-signal-title">
        <header className={`cw-drawer-head rk-head sev-${signal?.severity || "low"}`}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
          {signal ? (
            <>
              <p className="cw-eyebrow">{AREA_LABELS[signal.area].toUpperCase()} · {signal.detectorLabel.toUpperCase()}</p>
              <h2 id="rk-signal-title">{signal.title}</h2>
              <div className="cw-head-meta">
                <span className={`rk-sev-badge sev-${signal.severity}`}><i aria-hidden="true" />{SEVERITY_LABEL[signal.severity]}</span>
                <span className={`cw-badge ${STATUS_TONE[signal.status]}`}><i />{STATUS_LABEL[signal.status]}</span>
                <span>First seen {relativeTime(signal.firstDetectedAt)}</span>
                <span>Last seen {relativeTime(signal.lastDetectedAt)}</span>
                {signal.dueDate && <span>Due {shortDate(signal.dueDate)}</span>}
              </div>
            </>
          ) : <div className="cw-skeleton" aria-label="Loading"><i /><i /><i /></div>}
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {done && <p className="rk-ok" role="status"><Check size={14} /> {done}</p>}
          {!signal && !error && <div className="cw-list-skeleton"><i /><i /><i /></div>}
          {signal && (
            <>
              <section className="rk-explain">
                <p>{signal.explanation}</p>
                {signal.clearedAt && open && <p className="rk-cleared"><Eye size={14} /> The latest scan no longer finds this condition. If it was handled, resolve it.</p>}
                {signal.status !== "OPEN" && signal.statusNote && (
                  <p className="rk-status-note"><b>{STATUS_LABEL[signal.status]}{signal.statusBy ? ` by ${signal.statusBy}` : ""}{signal.statusAt ? ` · ${relativeTime(signal.statusAt)}` : ""}:</b> {signal.statusNote}</p>
                )}
                <Link className="cw-btn primary" href={signal.action.href}>{signal.action.label} <ArrowUpRight size={15} /></Link>
              </section>

              {signal.people.length > 0 && (
                <section>
                  <p className="cw-section-label">Affected {signal.people.length === 1 ? "person" : `people (${signal.people.length})`}</p>
                  <ul className="rk-people">
                    {signal.people.map((person, index) => (
                      <li key={person.id || `r${index}`} className={person.redacted ? "redacted" : ""}>
                        <span className={`cw-avatar small${person.redacted ? " muted" : ""}`} aria-hidden="true">{person.redacted ? "?" : initials(person.name)}</span>
                        <span><b>{person.name}</b>{!person.redacted && <small>{[person.number, person.designation, person.location].filter(Boolean).join(" · ")}</small>}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {evidence && (evidence.facts?.length || evidence.rows?.length) ? (
                <section>
                  <p className="cw-section-label">Evidence</p>
                  {evidence.facts?.length ? (
                    <dl className="cw-facts rk-facts">
                      {evidence.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                    </dl>
                  ) : null}
                  {evidence.columns?.length && evidence.rows?.length ? (
                    <div className="rk-evidence" role="region" aria-label="Evidence table" tabIndex={0}>
                      <table>
                        <thead><tr>{evidence.columns.map((column) => <th key={column.key} scope="col" className={["money", "number", "km", "hours", "percent"].includes(column.kind || "") ? "num" : ""}>{column.label}</th>)}</tr></thead>
                        <tbody>
                          {evidence.rows.map((row, index) => (
                            <tr key={index}>{evidence.columns!.map((column) => <td key={column.key}><Cell kind={column.kind} value={row[column.key]} /></td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {evidence.note && <p className="rk-note">{evidence.note}</p>}
                </section>
              ) : null}

              {signal.records?.length > 0 && (
                <section>
                  <p className="cw-section-label">Records</p>
                  <div className="rk-records">
                    {signal.records.map((record) => (
                      <Link key={record.id} href={record.type === "payroll_run" ? `/payroll/admin/${record.id}` : signal.area === "expenses" ? `/expenses?case=${record.id}` : signal.detector === "service.sla_breaches" ? `/helpdesk?case=${record.id}` : "/approvals"}>{record.label} <ArrowUpRight size={12} /></Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="cw-action-panel">
                <p className="cw-section-label">{open ? "What will you do?" : "This signal is closed"}</p>
                <label className="cw-note">
                  <span>Note {intent === "dismiss" ? <em>*</em> : <small>(optional — kept in the history)</small>}</span>
                  <textarea rows={3} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)}
                    placeholder={open ? "e.g. Spoke to the store manager — the phone is the registered kiosk device." : "Why are you re-opening it?"} />
                </label>
                <div className="cw-action-row">
                  {signal.status === "OPEN" && <button className="cw-btn ghost" disabled={!!busy} onClick={() => act("acknowledge")}><CheckCheck size={15} /> {busy === "acknowledge" ? "Saving…" : "Acknowledge"}</button>}
                  {open && <button className="cw-btn primary" disabled={!!busy} onClick={() => act("resolve")}><Check size={15} /> {busy === "resolve" ? "Saving…" : "Resolve"}</button>}
                  {open && signal.canClose && <button className="cw-btn danger" disabled={!!busy} onClick={() => act("dismiss")}><ShieldOff size={15} /> {busy === "dismiss" ? "Saving…" : "Dismiss…"}</button>}
                  {!open && signal.canClose && <button className="cw-btn ghost" disabled={!!busy} onClick={() => act("reopen")}><RotateCcw size={15} /> {busy === "reopen" ? "Saving…" : "Re-open"}</button>}
                </div>
                <p className="cw-help">
                  {open ? "Dismiss when it's a false alarm — it won't come back unless the evidence changes materially." : signal.status === "DISMISSED" ? "Dismissed signals re-open automatically if the evidence changes." : ""}
                  {open && !signal.canClose ? " Only HR can dismiss signals about your team." : ""}
                </p>
              </section>

              <section className="cw-timeline">
                <p className="cw-section-label"><History size={12} /> History</p>
                <ol>
                  {signal.events.map((event, index) => (
                    <li key={index}>
                      <span className={`cw-avatar small${event.automated ? " muted" : ""}`} aria-hidden="true">{event.automated ? "N" : initials(event.actor)}</span>
                      <div>
                        <p><b>{EVENT_LABEL[event.action] || event.action}</b> · {event.actor}<time dateTime={event.created_at}>{relativeTime(event.created_at)}</time></p>
                        {event.note && <blockquote>{event.note}</blockquote>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
