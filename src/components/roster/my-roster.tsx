"use client";
import { AlertTriangle, ArrowLeftRight, CalendarClock, CalendarOff, ChevronLeft, ChevronRight, Clock3, MapPin, Moon, StickyNote } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { addDays, ago, compactTime, dayNum, hoursLabel, rosterApi, weekRange, weekday, weekdayLong, type MyRoster, type MyWeek } from "./roster-api";

export function MyRosterView() {
  const [start, setStart] = useState<string | undefined>(undefined);
  const [data, setData] = useState<MyRoster | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setError("");
    rosterApi.mine(start).then(setData).catch((reason: Error) => setError(reason.message || "Could not load your roster.")).finally(() => setLoading(false));
  }, [start]);
  useEffect(load, [load]);

  if (error) return <><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p><button className="cw-btn ghost" onClick={load}>Try again</button></>;
  if (!data) return <div className="cw-list-skeleton"><i /><i /><i /></div>;

  const first = data.weeks[0];
  const today = first.days.find((day) => day.isToday) || data.weeks[1].days.find((day) => day.isToday);
  const upcoming = data.weeks.flatMap((week) => week.days).find((day) => day.date >= data.today && day.entry?.kind === "SHIFT" && day.leave?.status !== "APPROVED");
  const total = data.weeks.reduce((sum, week) => sum + week.hours, 0);

  return (
    <div className={`ro-mine${loading ? " is-loading" : ""}`}>
      <section className="cw-stats ro-stats" aria-label="My roster summary">
        <article className="ro-today-card">
          <small>Today</small>
          {!today ? <b className="text">—</b>
            : today.leave?.status === "APPROVED" ? <b className="text">On {today.leave.type}</b>
            : today.entry?.kind === "SHIFT" ? <b className="text">{today.entry.name} · {today.entry.startTime}–{today.entry.endTime}</b>
            : today.entry?.kind === "WEEKLY_OFF" ? <b className="text">Weekly off</b>
            : <b className="text">Not scheduled</b>}
          <span>{today?.entry?.location || (today ? weekdayLong(today.date) : "outside these weeks")}</span>
        </article>
        <article><small>Next shift</small><b className="text">{upcoming ? `${weekday(upcoming.date)} ${dayNum(upcoming.date)} · ${upcoming.entry!.startTime}` : "—"}</b><span>{upcoming ? upcoming.entry!.name : "nothing published yet"}</span></article>
        <article><small>{start === undefined ? "This week" : `Week of ${weekRange(first.weekStart)}`}</small><b>{hoursLabel(first.hours)}</b><span>{first.shifts} shifts{first.published ? "" : " · not published"}</span></article>
        <article><small>Two-week total</small><b>{hoursLabel(total)}</b><span>limit {data.settings.maxWeeklyHours} h per week</span></article>
      </section>

      <div className="ro-weekbar">
        <div className="ro-weeknav">
          <button className="cw-icon-button" aria-label="Previous week" onClick={() => setStart(addDays(first.weekStart, -7))}><ChevronLeft size={17} /></button>
          <button className="cw-btn ghost" onClick={() => setStart(undefined)} disabled={start === undefined}>This week</button>
          <button className="cw-icon-button" aria-label="Next week" onClick={() => setStart(addDays(first.weekStart, 7))}><ChevronRight size={17} /></button>
          <div className="ro-weektitle"><small>Showing two weeks</small><b>{weekRange(first.weekStart)} · {weekRange(data.weeks[1].weekStart)}</b></div>
        </div>
        <Link className="cw-btn ghost" href="/shifts"><ArrowLeftRight size={15} /> Request a shift change</Link>
      </div>

      <div className="ro-mine-weeks">
        {data.weeks.map((week, index) => <WeekCard key={week.weekStart} week={week} label={index === 0 ? (start === undefined ? "This week" : "Week") : (start === undefined ? "Next week" : "Following week")} maxHours={data.settings.maxWeeklyHours} />)}
      </div>
    </div>
  );
}

function WeekCard({ week, label, maxHours }: { week: MyWeek; label: string; maxHours: number }) {
  return (
    <section className="ro-mine-week" aria-label={`${label}: ${weekRange(week.weekStart)}`}>
      <header>
        <div><small>{label}</small><b>{weekRange(week.weekStart)}</b></div>
        {week.published
          ? <span className="cw-badge tone-success"><i />Published {ago(week.publishedAt)}{week.revision > 1 ? ` · rev ${week.revision}` : ""}</span>
          : <span className="cw-badge tone-neutral"><i />Not published yet</span>}
        <span className={`ro-mine-total${week.hours > maxHours ? " over" : ""}`}><Clock3 size={14} /> {hoursLabel(week.hours)} · {week.shifts} shift{week.shifts === 1 ? "" : "s"}</span>
      </header>
      {!week.published ? (
        <div className="cw-empty ro-mine-empty"><span><CalendarClock size={24} /></span><h2>Your manager is still planning</h2><p>You'll get a notification as soon as this week's roster is published.</p></div>
      ) : (
        <ol>
          {week.days.map((day) => {
            const entry = day.entry;
            const onLeave = day.leave?.status === "APPROVED";
            return (
              <li key={day.date} className={`${day.isToday ? "today" : ""}${onLeave ? " leave" : ""}`} style={entry?.color ? { ["--c" as string]: entry.color } : undefined}>
                <span className="ro-mine-date"><small>{weekday(day.date)}</small><b>{dayNum(day.date)}</b>{day.isToday && <em>Today</em>}</span>
                <span className="ro-mine-main">
                  {onLeave ? <span className="ro-leave"><b>{day.leave!.code}</b><small>{day.leave!.type}</small></span>
                    : entry?.kind === "SHIFT" ? <span className="ro-pill"><b>{entry.name}</b><small>{compactTime(entry.startTime || "")}–{compactTime(entry.endTime || "")}</small></span>
                    : entry?.kind === "WEEKLY_OFF" ? <span className="ro-offmark"><Moon size={13} /> Weekly off</span>
                    : <span className="ro-unplanned">Not scheduled</span>}
                  <span className="ro-mine-meta">
                    {entry?.kind === "SHIFT" && !onLeave && <span><Clock3 size={13} /> {entry.startTime}–{entry.endTime} · {entry.breakMinutes} min break · {hoursLabel(entry.hours || 0)} paid</span>}
                    {entry?.location && !onLeave && <span><MapPin size={13} /> {entry.location}</span>}
                    {entry?.note && <span><StickyNote size={13} /> {entry.note}</span>}
                    {day.leave?.status === "PENDING" && <span><CalendarOff size={13} /> {day.leave.type} pending approval</span>}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
