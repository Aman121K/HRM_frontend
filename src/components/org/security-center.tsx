"use client";
import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { relativeTime } from "@/lib/cases";

type Check = { id: string; title: string; status: "pass" | "warn" | "fail" | "manual"; detail: string; fix?: string };
type Posture = { checks: Check[]; score: number; environment: string };
type Events = {
  hours: number; summary: { reason: string; count: number }[];
  sources: { ip: string; count: number; reasons: string[]; lastSeen: string; routes: number }[];
  routes: { method: string; route: string; reason: string; count: number }[];
  recent: { lastSeen: string; ip: string; status: number; reason: string; method: string; route: string; count: number; organization: string | null; email: string | null }[];
};
const ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle, manual: CircleDashed };
const REASON: Record<string, string> = { unauthenticated: "Failed sign-in / bad token", forbidden: "Blocked by permissions", rate_limited: "Rate limited" };

/** Super admin security view: production-readiness checklist from live config, and denied traffic across all brands. */
export function SecurityCenter() {
  const [posture, setPosture] = useState<Posture | null>(null);
  const [events, setEvents] = useState<Events | null>(null);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    httpRequest<Posture>("/api/v2/platform/security/posture").then(setPosture).catch((reason) => setError(reason.message));
    httpRequest<Events>(`/api/v2/platform/security/events?hours=${hours}`).then(setEvents).catch((reason) => setError(reason.message));
  }, [hours]);
  useEffect(() => { load(); }, [load]);
  const counts = posture?.checks.reduce((sum, check) => ({ ...sum, [check.status]: (sum[check.status] || 0) + 1 }), {} as Record<string, number>) || {};
  const denied = events?.summary.reduce((sum, row) => sum + row.count, 0) || 0;
  const order = { fail: 0, warn: 1, manual: 2, pass: 3 };
  return (
    <div className="cw-page sc-page" style={{ ["--accent" as string]: "#132c38" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><ShieldCheck size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PLATFORM · SECURITY CENTER</p>
          <h1>Security posture</h1>
          <p>Live checks of how this installation is configured, and every denied request across all brands. Fix everything red before going live; no software is unbreakable, so keep monitoring.</p>
        </div>
        <button className="cw-btn ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!posture ? <div className="cw-list-skeleton"><i /><i /></div> : (
        <section className="sc-top">
          <div className={`sc-score ${posture.score >= 90 ? "good" : posture.score >= 60 ? "ok" : "bad"}`} role="img" aria-label={`Readiness score ${posture.score} percent`}>
            <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="52" /><circle cx="60" cy="60" r="52" className="arc" strokeDasharray={`${(posture.score / 100) * 326.7} 326.7`} /></svg>
            <b>{posture.score}%</b><small>ready ({posture.environment})</small>
          </div>
          <div className="cw-stats sc-stats">
            <article className={counts.fail ? "attention" : ""}><small>Must fix</small><b>{counts.fail || 0}</b><span>blocks production</span></article>
            <article><small>Should fix</small><b>{counts.warn || 0}</b><span>fine for local demo</span></article>
            <article><small>Passing</small><b>{counts.pass || 0}</b><span>verified live</span></article>
            <article className={denied ? "attention" : ""}><small>Denied requests</small><b>{denied}</b><span>last {hours} h</span></article>
          </div>
        </section>
      )}
      {posture && (
        <section className="sc-checks" aria-label="Checks">
          {[...posture.checks].sort((a, b) => order[a.status] - order[b.status]).map((check) => {
            const Icon = ICON[check.status];
            return (
              <article key={check.id} className={`sc-check ${check.status}`}>
                <Icon size={18} aria-hidden />
                <div><b>{check.title}</b><p>{check.detail}</p>{check.fix && check.status !== "pass" && <p className="sc-fix"><span>Fix:</span> {check.fix}</p>}</div>
                <span className="sc-status">{check.status === "manual" ? "verify" : check.status}</span>
              </article>
            );
          })}
        </section>
      )}
      <section className="sc-activity">
        <header>
          <h2><ShieldAlert size={17} /> Denied & suspicious activity</h2>
          <select value={hours} onChange={(event) => setHours(Number(event.target.value))} aria-label="Time window">
            {[1, 24, 72, 168, 720].map((value) => <option key={value} value={value}>Last {value < 24 ? `${value} h` : `${value / 24} days`}</option>)}
          </select>
        </header>
        {!events ? <div className="cw-list-skeleton"><i /></div> : !denied ? <p className="cw-muted">No denied requests in this window.</p> : (
          <div className="sc-grid">
            <div>
              <p className="cw-section-label">By reason</p>
              {events.summary.map((row) => <p key={row.reason} className="sc-bar"><span>{REASON[row.reason] || row.reason}</span><i style={{ width: `${(row.count / denied) * 100}%` }} /><b>{row.count}</b></p>)}
              <p className="cw-section-label">Top sources</p>
              <table className="sc-table"><thead><tr><th>IP</th><th>Requests</th><th>Routes</th><th>Last</th></tr></thead>
                <tbody>{events.sources.map((row) => <tr key={row.ip}><td><code>{row.ip}</code></td><td>{row.count}</td><td>{row.routes}</td><td>{relativeTime(row.lastSeen)}</td></tr>)}</tbody></table>
            </div>
            <div>
              <p className="cw-section-label">Most probed routes</p>
              <table className="sc-table"><thead><tr><th>Route</th><th>Reason</th><th>Count</th></tr></thead>
                <tbody>{events.routes.map((row) => <tr key={`${row.method}${row.route}${row.reason}`}><td><code>{row.method} {row.route}</code></td><td>{REASON[row.reason] || row.reason}</td><td>{row.count}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}
        {events && events.recent.length > 0 && (
          <>
            <p className="cw-section-label">Recent</p>
            <table className="sc-table"><thead><tr><th>When</th><th>Brand</th><th>Who</th><th>IP</th><th>Request</th><th>Result</th></tr></thead>
              <tbody>{events.recent.slice(0, 20).map((row, index) => (
                <tr key={index}><td>{relativeTime(row.lastSeen)}</td><td>{row.organization || "—"}</td><td>{row.email || "unknown"}</td><td><code>{row.ip}</code></td>
                  <td><code>{row.method} {row.route}</code></td><td>{row.status} · {row.count}×</td></tr>
              ))}</tbody></table>
          </>
        )}
      </section>
    </div>
  );
}
