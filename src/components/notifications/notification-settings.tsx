"use client";
import { AlertTriangle, BellRing, Check, Moon, Send, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { relativeTime } from "@/lib/cases";

type Preferences = {
  categories: Record<string, boolean>;
  quietHours: { enabled: boolean; start: string; end: string; timezone: string };
  channels: { push: boolean; email: boolean };
  version?: number;
};
type Device = { id: string; platform: string; provider: string; environment?: string; deviceName?: string; token?: string; lastSeenAt?: string; active?: boolean };

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "approvals", label: "Approvals", hint: "Requests waiting for your decision" },
  { key: "payroll", label: "Payroll", hint: "Payslips published, salary changes" },
  { key: "time", label: "Time & roster", hint: "Roster published, shift changes, leave decisions" },
  { key: "requests", label: "My requests", hint: "Status changes on claims, tickets, letters, assets" },
  { key: "learning", label: "Learning", hint: "Assigned courses and due dates" },
  { key: "engagement", label: "Surveys & recognition", hint: "New surveys, polls and kudos" },
  { key: "announcements", label: "Announcements", hint: "Company news and events" },
];

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    httpRequest<Preferences>("/api/v2/notifications/preferences").then(setPrefs).catch((reason) => setError(reason.message));
    httpRequest<{ items: Device[] }>("/api/v2/notifications/devices").then((data) => setDevices(data.items || [])).catch(() => {});
  }, []);
  const save = async (next: Preferences) => {
    setPrefs(next); setBusy(true); setError(""); setSaved("");
    try { setPrefs(await httpRequest<Preferences>("/api/v2/notifications/preferences", { method: "PUT", body: next })); setSaved("Saved"); window.setTimeout(() => setSaved(""), 1800); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save."); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setError(""); setSaved("");
    try {
      const result = await httpRequest<{ results?: unknown[]; sent?: number }>("/api/v2/notifications/test-push", { method: "POST" });
      setSaved(`Test sent to ${result.results?.length ?? result.sent ?? 0} device(s)`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Test failed."); }
  };
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <p className="ns-back"><Link href="/settings">← Settings</Link></p>
      <header className="cw-hero">
        <span className="cw-hero-icon"><BellRing size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · NOTIFICATIONS</p>
          <h1>Notifications</h1>
          <p>Choose what reaches your phone and inbox. Approvals held during quiet hours arrive when they end.</p>
        </div>
        {saved && <span className="cw-badge tone-success"><i />{saved}</span>}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!prefs ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <div className="ns-grid">
          <section className="ns-card">
            <h2>What to notify me about</h2>
            {CATEGORIES.map((category) => (
              <label key={category.key} className="ns-toggle">
                <span><b>{category.label}</b><small>{category.hint}</small></span>
                <input type="checkbox" role="switch" checked={prefs.categories[category.key] !== false} disabled={busy}
                  onChange={(event) => save({ ...prefs, categories: { ...prefs.categories, [category.key]: event.target.checked } })} />
              </label>
            ))}
          </section>
          <div className="ns-side">
            <section className="ns-card">
              <h2>Channels</h2>
              <label className="ns-toggle"><span><b>Push to my phone</b><small>Northstar mobile app</small></span>
                <input type="checkbox" role="switch" checked={prefs.channels.push} disabled={busy} onChange={(event) => save({ ...prefs, channels: { ...prefs.channels, push: event.target.checked } })} /></label>
              <label className="ns-toggle"><span><b>Email</b><small>Digests and important updates</small></span>
                <input type="checkbox" role="switch" checked={prefs.channels.email} disabled={busy} onChange={(event) => save({ ...prefs, channels: { ...prefs.channels, email: event.target.checked } })} /></label>
            </section>
            <section className="ns-card">
              <h2><Moon size={15} /> Quiet hours</h2>
              <label className="ns-toggle"><span><b>Pause push notifications</b><small>{prefs.quietHours.timezone}</small></span>
                <input type="checkbox" role="switch" checked={prefs.quietHours.enabled} disabled={busy} onChange={(event) => save({ ...prefs, quietHours: { ...prefs.quietHours, enabled: event.target.checked } })} /></label>
              {prefs.quietHours.enabled && (
                <div className="ns-hours">
                  <label>From<input type="time" value={prefs.quietHours.start} onChange={(event) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, start: event.target.value } })} onBlur={() => save(prefs)} /></label>
                  <label>Until<input type="time" value={prefs.quietHours.end} onChange={(event) => setPrefs({ ...prefs, quietHours: { ...prefs.quietHours, end: event.target.value } })} onBlur={() => save(prefs)} /></label>
                </div>
              )}
            </section>
            <section className="ns-card">
              <h2><Smartphone size={15} /> My devices</h2>
              {!devices.length ? <p className="cw-muted">No phones registered. Sign in to the Northstar mobile app to get push notifications.</p> : devices.map((device) => (
                <div key={device.id} className="ns-device">
                  <span><b>{device.deviceName || device.platform}</b><small>{device.platform} · {device.provider}{device.environment ? ` · ${device.environment}` : ""}{device.lastSeenAt ? ` · seen ${relativeTime(device.lastSeenAt)}` : ""}</small></span>
                  {device.active === false ? <span className="cw-badge tone-neutral"><i />Inactive</span> : <span className="cw-badge tone-success"><i />Active</span>}
                </div>
              ))}
              <button className="cw-btn ghost" onClick={test} disabled={!devices.length}><Send size={14} /> Send a test notification</button>
            </section>
          </div>
        </div>
      )}
      {busy && <span className="sr-only" aria-live="polite">Saving</span>}
      {!busy && saved && <span className="sr-only" aria-live="polite"><Check /> {saved}</span>}
    </div>
  );
}
