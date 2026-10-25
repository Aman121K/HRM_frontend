"use client";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarCheck2, Check, Info, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/cases";
import { riskApi, type CalendarItem, type Overview } from "./risk-api";

const BUCKETS: { key: CalendarItem["bucket"]; label: string; empty: string }[] = [
  { key: "overdue", label: "Overdue", empty: "Nothing overdue. Well done." },
  { key: "this_week", label: "Due in the next 7 days", empty: "Nothing due this week." },
  { key: "upcoming", label: "Upcoming", empty: "Nothing else in the window." },
  { key: "done", label: "Filed / nothing due (last 30 days)", empty: "No filings marked yet." },
];
const STATUS_TONE: Record<CalendarItem["status"], string> = {
  FILED: "tone-success", READY: "tone-info", PENDING: "tone-danger", NO_PAYROLL: "tone-warning", AWAITING_PAYROLL: "tone-neutral", NOT_APPLICABLE: "tone-neutral", VERIFY: "tone-warning",
};
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(day(iso));
const when = (item: CalendarItem) => item.daysLeft < 0 ? `${-item.daysLeft} d overdue` : item.daysLeft === 0 ? "Due today" : `In ${item.daysLeft} d`;

/** Next-N-days strip: one marker per due date, coloured by the worst status that day. A visual summary of the lists below
 * (HTML positioned in %, so labels stay crisp at any width). */
function Timeline({ calendar }: { calendar: NonNullable<Overview["calendar"]> }) {
  const span = calendar.horizonDays;
  const upcoming = calendar.items.filter((item) => item.daysLeft >= 0 && item.daysLeft <= span);
  const overdue = calendar.items.filter((item) => item.bucket === "overdue").length;
  const pct = (days: number) => `${(days / span) * 100}%`;
  const byDay = new Map<number, CalendarItem[]>();
  for (const item of upcoming) (byDay.get(item.daysLeft) || byDay.set(item.daysLeft, []).get(item.daysLeft)!).push(item);
  const ticks = [0, 7, 14, 21, 28, 35, 42].filter((tick) => tick <= span);
  const worst = (items: CalendarItem[]) => items.some((item) => item.status === "PENDING" || item.status === "NO_PAYROLL") ? "pending"
    : items.some((item) => item.status === "READY" || item.status === "VERIFY" || item.status === "AWAITING_PAYROLL") ? "ready" : "done";
  const label = (days: number) => days === 0 ? "Today" : fmt(new Date(Date.parse(`${calendar.today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10), { day: "numeric", month: "short" });
  return (
    <figure className="rk-timeline">
      <div className="rk-tl" role="img" aria-label={`${upcoming.length} filings due in the next ${span} days${overdue ? `, ${overdue} overdue` : ""}`}>
        <span className="rk-tl-week" style={{ width: pct(Math.min(7, span)) }} />
        {ticks.map((tick) => <span key={tick} className={`rk-tl-tick${tick > 0 && tick % 14 !== 0 ? " minor" : ""}`} style={{ left: pct(tick) }}><small>{label(tick)}</small></span>)}
        {[...byDay].map(([days, items]) => (
          <span key={days} className={`rk-tl-dot ${worst(items)}${items.length > 1 ? " many" : ""}`} style={{ left: pct(days) }} title={`${label(days)}: ${items.map((item) => `${item.label} — ${item.statusLabel}`).join("; ")}`}>
            {items.length > 1 ? items.length : ""}
          </span>
        ))}
      </div>
      <figcaption className="rk-tl-legend">
        <span><i className="pending" /> Action needed</span><span><i className="ready" /> File ready / verify</span><span><i className="done" /> Filed or nothing due</span>
        {overdue > 0 && <span className="rk-tl-overdue"><AlertTriangle size={13} /> {overdue} overdue (listed below)</span>}
      </figcaption>
    </figure>
  );
}

function Obligation({ item, canMark, onChanged }: { item: CalendarItem; canMark: boolean; onChanged: () => void }) {
  const [marking, setMarking] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent, filed: boolean) => {
    event.preventDefault();
    setBusy(true); setError("");
    try { await riskApi.mark(item.key, { filed, reference: reference.trim() || undefined }); setMarking(false); onChanged(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <li className={`rk-ob status-${item.status.toLowerCase()} bucket-${item.bucket}`}>
      <time className="rk-ob-date" dateTime={item.dueDate}>
        <b>{fmt(item.dueDate, { day: "numeric" })}</b><small>{fmt(item.dueDate, { month: "short" })}</small>
      </time>
      <div className="rk-ob-main">
        <p className="rk-ob-title"><b>{item.label}</b>{item.verify && <span className="rk-verify" title="Rules vary by state — verify">Verify for your state</span>}</p>
        <p className="rk-ob-meta">
          <span className={`cw-badge ${STATUS_TONE[item.status]}`}><i />{item.statusLabel}</span>
          <span className={item.daysLeft < 0 && item.bucket !== "done" ? "rk-late" : ""}>{when(item)}</span>
          <span>{item.authority}</span>
          {item.amount ? <span className="num">{money(item.amount)}</span> : null}
        </p>
        <p className="rk-ob-detail">{item.detail}</p>
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={14} /> {error}</p>}
        {marking && (
          <form className="rk-mark" onSubmit={(event) => submit(event, true)}>
            <label><span>Challan / ECR / acknowledgement no. <small>(optional)</small></span>
              <input value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="e.g. TRRN 2026091500412" autoFocus /></label>
            <div className="cw-action-row">
              <button type="button" className="cw-btn ghost" onClick={() => setMarking(false)}>Cancel</button>
              <button className="cw-btn primary" disabled={busy}><Check size={15} /> {busy ? "Saving…" : "Mark as filed"}</button>
            </div>
          </form>
        )}
      </div>
      <div className="rk-ob-actions">
        {item.runId && <Link className="cw-btn ghost" href={`/payroll/admin/${item.runId}`} aria-label={`Open payroll run for ${item.periodLabel}`}>Run <ArrowUpRight size={14} /></Link>}
        {canMark && !marking && item.status !== "FILED" && item.status !== "NOT_APPLICABLE" && <button className="cw-btn ghost" onClick={() => setMarking(true)}><CalendarCheck2 size={15} /> Mark filed</button>}
        {canMark && item.status === "FILED" && <button className="cw-btn ghost" disabled={busy} onClick={(event) => submit(event, false)} aria-label={`Undo filed mark for ${item.label}`}><RotateCcw size={14} /> Undo</button>}
      </div>
    </li>
  );
}

export function ComplianceCalendar({ calendar, canMark, onChanged, compact = false }: { calendar: NonNullable<Overview["calendar"]>; canMark: boolean; onChanged: () => void; compact?: boolean }) {
  const [showDone, setShowDone] = useState(false);
  const groups = BUCKETS.filter((bucket) => !compact || bucket.key !== "done");
  return (
    <section className="rk-calendar" aria-labelledby="rk-cal-title">
      <header className="rk-section-head">
        <div>
          <h2 id="rk-cal-title">Statutory calendar</h2>
          <p>PF, ESI, TDS, 24Q, Form 16{calendar.states.length ? `, professional tax and LWF for ${calendar.states.join(", ")}` : ""} — tied to your payroll runs and exports.</p>
        </div>
        <div className="rk-cal-counts" aria-label="Filing counts">
          <span className="overdue"><b>{calendar.counts.overdue}</b> overdue</span>
          <span className="week"><b>{calendar.counts.this_week}</b> this week</span>
          <span><b>{calendar.counts.upcoming}</b> upcoming</span>
        </div>
      </header>
      <p className="cw-alert warn rk-disclaimer"><Info size={15} /> {calendar.disclaimer}</p>
      <Timeline calendar={calendar} />
      <div className={`rk-lanes${compact ? " compact" : ""}`}>
        {groups.map((bucket) => {
          const items = calendar.items.filter((item) => item.bucket === bucket.key);
          if (bucket.key === "done" && !showDone) return (
            <div key={bucket.key} className="rk-lane done">
              <button className="cw-btn ghost" onClick={() => setShowDone(true)}><Check size={15} /> Show {items.length} filed / nothing-due item{items.length === 1 ? "" : "s"}</button>
            </div>
          );
          const visible = compact ? items.slice(0, 4) : items;
          return (
            <div key={bucket.key} className={`rk-lane ${bucket.key}`}>
              <h3>{bucket.label} <span>{items.length}</span></h3>
              {items.length === 0 ? <p className="rk-lane-empty">{bucket.empty}</p> : (
                <ul>{visible.map((item) => <Obligation key={item.key} item={item} canMark={canMark} onChanged={onChanged} />)}</ul>
              )}
              {compact && items.length > visible.length && <p className="rk-lane-more">+{items.length - visible.length} more in the Compliance tab</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
