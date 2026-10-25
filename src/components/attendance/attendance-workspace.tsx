"use client";
import { AlertTriangle, Clock3, Fingerprint, Globe, MapPin, Smartphone, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMinutes, useAttendanceToday } from "@/lib/attendance-client";
import { httpRequest } from "@/lib/http-client";
import { shortDate } from "@/lib/cases";
import { useSelfieCapture } from "./selfie-capture";
import { PunchReview } from "./punch-review";
import { PunchSecurity } from "./punch-security";

type Day = { day: string; firstIn: string | null; lastOut: string | null; workedMinutes: number; punches: number; sources: string[]; outsideGeofence: boolean };
const time = (iso: string | null) => iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "—";
const sourceIcon = { MOBILE: Smartphone, WEB: Globe, BIOMETRIC: Fingerprint, MANUAL: Clock3 } as Record<string, typeof Globe>;

export function AttendanceWorkspace() {
  const attendance = useAttendanceToday();
  const selfie = useSelfieCapture();
  const [history, setHistory] = useState<{ items: Day[]; totalMinutes: number } | null>(null);
  const [error, setError] = useState("");
  const loadHistory = () => httpRequest<{ items: Day[]; totalMinutes: number }>("/api/v2/attendance/history").then(setHistory).catch((reason) => setError(reason.message));
  useEffect(() => { loadHistory(); }, []);
  const punch = async () => { if (await attendance.punch(selfie.request)) loadHistory(); };
  const state = attendance.today?.state;
  const days = history?.items || [];
  const workedDays = days.filter((day) => day.workedMinutes > 0);
  const average = workedDays.length ? Math.round(workedDays.reduce((sum, day) => sum + day.workedMinutes, 0) / workedDays.length) : 0;
  const flagged = days.filter((day) => day.outsideGeofence).length;
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Timer size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">TIME · ATTENDANCE</p>
          <h1>Attendance</h1>
          <p>Punch in with your location from the web or the Northstar mobile app. Biometric punches from café devices appear here too.</p>
        </div>
        <Link className="cw-btn ghost" href="/roster">My roster</Link>
      </header>

      <section className="att-today">
        <div>
          <p className="cw-eyebrow">TODAY</p>
          <h2>{state === "PUNCHED_IN" ? "You’re on the clock" : state === "PUNCHED_OUT" ? "Day complete" : "Not punched in yet"}</h2>
          <strong>{formatMinutes(attendance.workedMinutes)}</strong>
          <p>{attendance.firstIn ? `First in ${time(attendance.firstIn.occurredAt)}` : "Your location is checked against your café’s geofence when you punch."}
            {attendance.last?.withinGeofence === false && <span className="att-flag"><MapPin size={12} /> {Math.round(attendance.last.distanceMetres || 0)} m from site · flagged</span>}
            {attendance.last?.withinGeofence === true && <span className="att-ok"><MapPin size={12} /> At site</span>}</p>
        </div>
        <button className="cw-btn primary lg" onClick={punch} disabled={attendance.busy || !attendance.today}>
          {attendance.busy ? "Getting location…" : attendance.today?.expectedNext === "OUT" ? "Punch out" : "Punch in"}
        </button>
        {attendance.error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {attendance.error}</p>}
        {!!attendance.today?.events.length && (
          <ol className="att-events" aria-label="Today’s punches">
            {attendance.today.events.map((event) => { const Icon = sourceIcon[event.source] || Clock3; return (
              <li key={event.id}><Icon size={13} /> <b>{event.type === "IN" ? "In" : "Out"}</b> {time(event.occurredAt)}</li>
            ); })}
          </ol>
        )}
      </section>

      <section className="cw-stats">
        <article><small>Last 30 days</small><b>{formatMinutes(history?.totalMinutes || 0)}</b><span>{workedDays.length} days worked</span></article>
        <article><small>Average day</small><b>{formatMinutes(average)}</b><span>on days you worked</span></article>
        <article className={flagged ? "attention" : ""}><small>Outside geofence</small><b>{flagged}</b><span>{flagged ? "days flagged for review" : "all punches on site"}</span></article>
        <article><small>Corrections</small><b className="text">Missed a punch?</b><span><Link href="/attendance/regularize">Request a regularization →</Link></span></article>
      </section>

      <PunchSecurity />
      <PunchReview />
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {selfie.element}
      {!history ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !days.length ? (
        <div className="cw-empty"><span><Clock3 size={26} /></span><h2>No punches in the last 30 days</h2><p>Your daily first-in, last-out and hours will appear here after your first punch.</p></div>
      ) : (
        <div className="cw-table" role="table" aria-label="Attendance history">
          <div className="cw-row head att-row" role="row"><span>Date</span><span>First in</span><span>Last out</span><span>Worked</span><span>Source</span><span /></div>
          {days.map((day) => (
            <div key={day.day} className="cw-row att-row" role="row">
              <span><b>{shortDate(day.day)}</b></span>
              <span>{time(day.firstIn)}</span>
              <span>{day.lastOut ? time(day.lastOut) : day.firstIn ? <em className="att-open">open</em> : "—"}</span>
              <span className="num">{formatMinutes(day.workedMinutes)}</span>
              <span className="att-sources">{day.sources.map((source) => { const Icon = sourceIcon[source] || Clock3; return <span key={source} title={source.toLowerCase()}><Icon size={13} /> {source.toLowerCase()}</span>; })}</span>
              <span>{day.outsideGeofence && <span className="cw-badge tone-warning"><i />Outside site</span>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
