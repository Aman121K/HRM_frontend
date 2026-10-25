"use client";
import { AlertTriangle, Check, Laptop, Plus, Router, ShieldCheck, Smartphone, Trash2, Wifi, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { relativeTime } from "@/lib/cases";

type Mode = "OFF" | "FLAG" | "BLOCK";
type Policy = { deviceBinding: Mode; maxDevices: number; deviceApproval: "FIRST_AUTO" | "ALWAYS_HR"; officeNetwork: Mode; routerMac: Mode; version: number; [key: string]: unknown };
type Network = { id?: string; kind: "IP_RANGE" | "WIFI_BSSID"; value: string; label: string | null };
type Device = { id: string; platform: string; label: string | null; status: "ACTIVE" | "PENDING" | "REVOKED"; firstSeen: string; lastSeen: string; note: string | null;
  employeeName: string; employeeNumber: string; designation: string | null; decidedBy: string | null; punches: number };

export const POLICY_EVENT = "northstar:attendance-policy";
const MODES: [Mode, string][] = [["OFF", "Off"], ["FLAG", "Flag for review"], ["BLOCK", "Block punch"]];
const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

function ModeSwitch({ value, onChange, label }: { value: Mode; onChange: (mode: Mode) => void; label: string }) {
  return (
    <div className="ps-modes" role="radiogroup" aria-label={label}>
      {MODES.map(([mode, text]) => (
        <button key={mode} type="button" role="radio" aria-checked={value === mode} className={`${value === mode ? "active" : ""} m-${mode.toLowerCase()}`} onClick={() => onChange(mode)}>{text}</button>
      ))}
    </div>
  );
}

/** HR head: anti buddy-punching rules (device binding, office network, office Wi-Fi router MAC) and the punch device register. */
export function PunchSecurity() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [yourIp, setYourIp] = useState("");
  const [draft, setDraft] = useState<{ IP_RANGE: { value: string; label: string }; WIFI_BSSID: { value: string; label: string } }>({ IP_RANGE: { value: "", label: "" }, WIFI_BSSID: { value: "", label: "" } });
  const [filter, setFilter] = useState<"PENDING" | "ACTIVE" | "REVOKED">("PENDING");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const loadDevices = useCallback(() => httpRequest<{ items: Device[]; canManage: boolean }>("/api/v2/attendance/devices").then((data) => { setAllowed(data.canManage); setDevices(data.items); }).catch(() => setAllowed(false)), []);
  useEffect(() => {
    loadDevices();
    httpRequest<Policy>("/api/v2/attendance/policy").then(setPolicy).catch(() => {});
    httpRequest<{ items: Network[]; yourIp: string }>("/api/v2/attendance/networks").then((data) => { setNetworks(data.items); setYourIp(data.yourIp); }).catch(() => {});
    const sync = (event: Event) => setPolicy((event as CustomEvent<Policy>).detail);
    window.addEventListener(POLICY_EVENT, sync);
    return () => window.removeEventListener(POLICY_EVENT, sync);
  }, [loadDevices]);
  useEffect(() => { if (devices && !devices.some((device) => device.status === "PENDING")) setFilter((current) => (current === "PENDING" ? "ACTIVE" : current)); }, [devices]);
  if (!allowed || !policy) return null;

  const flash = (text: string) => { setSaved(text); window.setTimeout(() => setSaved(""), 2200); };
  const savePolicy = async (patch: Partial<Policy>) => {
    setError("");
    try {
      const next = { ...policy, ...(await httpRequest<Policy>("/api/v2/attendance/policy", { method: "PUT", body: { ...policy, ...patch } })) };
      setPolicy(next); window.dispatchEvent(new CustomEvent(POLICY_EVENT, { detail: next })); flash("Saved");
    } catch (reason) { setError(message(reason, "Couldn't save.")); }
  };
  const saveNetworks = async (items: Network[]) => {
    setError("");
    try {
      const data = await httpRequest<{ items: Network[] }>("/api/v2/attendance/networks", { method: "PUT", body: { items: items.map(({ kind, value, label }) => ({ kind, value, label: label || undefined })) } });
      setNetworks(data.items); flash("Office networks saved"); return true;
    } catch (reason) { setError(message(reason, "Couldn't save networks.")); return false; }
  };
  const addNetwork = async (kind: Network["kind"], value = draft[kind].value, label = draft[kind].label) => {
    if (!value.trim()) return;
    if (await saveNetworks([...networks, { kind, value: value.trim(), label: label.trim() || null }])) setDraft({ ...draft, [kind]: { value: "", label: "" } });
  };
  const decide = async (device: Device, decision: "APPROVE" | "REJECT" | "REVOKE") => {
    setError("");
    try {
      const result = await httpRequest<{ replaced: number }>(`/api/v2/attendance/devices/${device.id}/decision`, { method: "POST", body: { decision } });
      flash(decision === "APPROVE" ? `Approved${result.replaced ? " · old device removed" : ""}` : decision === "REJECT" ? "Request declined" : "Device removed");
      loadDevices();
    } catch (reason) { setError(message(reason, "Couldn't update the device.")); }
  };
  const ips = networks.filter((row) => row.kind === "IP_RANGE");
  const routers = networks.filter((row) => row.kind === "WIFI_BSSID");
  const pending = devices?.filter((device) => device.status === "PENDING").length || 0;
  const shown = (devices || []).filter((device) => device.status === filter);
  const privateIp = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80|::ffff:127\.)/.test(yourIp);

  return (
    <section className="ps" aria-labelledby="ps-title" id="devices">
      <header>
        <div><p className="cw-eyebrow">HR HEAD · ANTI BUDDY-PUNCHING</p><h2 id="ps-title"><ShieldCheck size={18} /> Punch security</h2>
          <p>Choose how strictly punches are tied to a person's own device and to the office. <b>Flag</b> records the punch and sends it to review; <b>Block</b> refuses it.</p></div>
        {saved && <span className="ps-saved" role="status"><Check size={14} /> {saved}</span>}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}

      <div className="ps-grid">
        <article className={`ps-card ${policy.deviceBinding !== "OFF" ? "on" : ""}`}>
          <h3><Smartphone size={17} /> 1 · App binding</h3>
          <p>Each employee punches only from their own registered phone or browser, and <b>one device can mark attendance for one employee only</b> — a colleague's phone can't be used to punch for someone else.</p>
          <ModeSwitch label="App binding" value={policy.deviceBinding} onChange={(mode) => savePolicy({ deviceBinding: mode })} />
          {policy.deviceBinding !== "OFF" && (
            <div className="ps-sub">
              <label>Devices per employee
                <select value={policy.maxDevices} onChange={(event) => savePolicy({ maxDevices: Number(event.target.value) })}>{[1, 2, 3].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              <label>New devices
                <select value={policy.deviceApproval} onChange={(event) => savePolicy({ deviceApproval: event.target.value as Policy["deviceApproval"] })}>
                  <option value="FIRST_AUTO">Register automatically (up to the limit)</option><option value="ALWAYS_HR">Always need HR approval</option></select></label>
            </div>
          )}
        </article>

        <article className={`ps-card ${policy.officeNetwork !== "OFF" ? "on" : ""}`}>
          <h3><Wifi size={17} /> 2 · Office Wi-Fi</h3>
          <p>Punch only when connected to the office internet. We check the office's <b>public IP address</b>, so it works in the browser and the app.</p>
          <ModeSwitch label="Office Wi-Fi" value={policy.officeNetwork} onChange={(mode) => savePolicy({ officeNetwork: mode })} />
          {policy.officeNetwork !== "OFF" && !ips.length && <p className="cw-alert warn"><AlertTriangle size={14} /> Add your office IP below — until then this check is skipped.</p>}
          <ul className="ps-list">{ips.map((row) => <li key={row.value}><code>{row.value}</code><span>{row.label}</span><button aria-label={`Remove ${row.value}`} onClick={() => saveNetworks(networks.filter((item) => item !== row))}><Trash2 size={14} /></button></li>)}</ul>
          <div className="ps-add">
            <input aria-label="Office IP or range" placeholder="49.36.12.40 or 49.36.12.0/24" value={draft.IP_RANGE.value} onChange={(event) => setDraft({ ...draft, IP_RANGE: { ...draft.IP_RANGE, value: event.target.value } })} />
            <input aria-label="Label" placeholder="Label (e.g. HSR office)" value={draft.IP_RANGE.label} onChange={(event) => setDraft({ ...draft, IP_RANGE: { ...draft.IP_RANGE, label: event.target.value } })} />
            <button className="cw-btn ghost" onClick={() => addNetwork("IP_RANGE")}><Plus size={14} /> Add</button>
          </div>
          {yourIp && <p className="ps-hint">You're connected from <code>{yourIp}</code>. {privateIp ? "That's a local address — open this page from the office (on the live site) to capture the office's public IP." : <button className="ps-link" onClick={() => addNetwork("IP_RANGE", yourIp, "Added from office")}>Add this as an office network</button>}</p>}
        </article>

        <article className={`ps-card ${policy.routerMac !== "OFF" ? "on" : ""}`}>
          <h3><Router size={17} /> 3 · Router MAC address</h3>
          <p>The mobile app reads the <b>MAC address (BSSID) of the Wi-Fi router</b> the phone is connected to and allows only your office routers. Browsers can't read this, so staff must punch from the app.</p>
          <ModeSwitch label="Router MAC" value={policy.routerMac} onChange={(mode) => savePolicy({ routerMac: mode })} />
          {policy.routerMac !== "OFF" && !routers.length && <p className="cw-alert warn"><AlertTriangle size={14} /> Add at least one router MAC — until then this check is skipped.</p>}
          <ul className="ps-list">{routers.map((row) => <li key={row.value}><code>{row.value}</code><span>{row.label}</span><button aria-label={`Remove ${row.value}`} onClick={() => saveNetworks(networks.filter((item) => item !== row))}><Trash2 size={14} /></button></li>)}</ul>
          <div className="ps-add">
            <input aria-label="Router MAC (BSSID)" placeholder="a4:2b:b0:3c:11:9f" value={draft.WIFI_BSSID.value} onChange={(event) => setDraft({ ...draft, WIFI_BSSID: { ...draft.WIFI_BSSID, value: event.target.value } })} />
            <input aria-label="Label" placeholder="Label (e.g. 1st floor)" value={draft.WIFI_BSSID.label} onChange={(event) => setDraft({ ...draft, WIFI_BSSID: { ...draft.WIFI_BSSID, label: event.target.value } })} />
            <button className="cw-btn ghost" onClick={() => addNetwork("WIFI_BSSID")}><Plus size={14} /> Add</button>
          </div>
          <p className="ps-hint">Find it on the router label or in its admin page (called BSSID or MAC). Add every access point in the office — each floor usually has its own.</p>
        </article>
      </div>

      <div className="ps-devices">
        <header>
          <h3>Registered devices {pending > 0 && <b className="ps-count">{pending} waiting</b>}</h3>
          <div className="cw-chips" role="group" aria-label="Device status">
            {(["PENDING", "ACTIVE", "REVOKED"] as const).map((status) => (
              <button key={status} aria-pressed={filter === status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>
                {status === "PENDING" ? "Requests" : status === "ACTIVE" ? "Active" : "Removed"} {(devices || []).filter((device) => device.status === status).length}
              </button>
            ))}
          </div>
        </header>
        {!shown.length ? <p className="cw-muted">{filter === "PENDING" ? "No device requests. When someone punches from a new phone, it shows up here." : filter === "ACTIVE" ? "No devices yet — devices register on an employee's first punch once App binding is on." : "Nothing removed."}</p> : (
          <div className="ps-table" role="table" aria-label="Punch devices">
            {shown.map((device) => (
              <div key={device.id} role="row" className={`ps-row ${device.status.toLowerCase()}`}>
                <span role="cell" className="ps-who"><b>{device.employeeName}</b><small>{device.employeeNumber}{device.designation ? ` · ${device.designation}` : ""}</small></span>
                <span role="cell" className="ps-dev">{device.platform === "WEB" ? <Laptop size={15} /> : <Smartphone size={15} />}<span><b>{device.label || device.platform}</b><small>{device.punches} punch{device.punches === 1 ? "" : "es"} · last used {relativeTime(device.lastSeen)}</small></span></span>
                <span role="cell" className="ps-note">{device.note}{device.decidedBy ? ` · ${device.decidedBy}` : ""}</span>
                <span role="cell" className="ps-actions">
                  {device.status === "PENDING" && <><button className="cw-btn primary" onClick={() => decide(device, "APPROVE")}><Check size={14} /> Approve</button><button className="cw-btn ghost" onClick={() => decide(device, "REJECT")}><X size={14} /> Decline</button></>}
                  {device.status === "ACTIVE" && <button className="cw-btn ghost" onClick={() => decide(device, "REVOKE")} title="Use when an employee changes or loses their phone"><Trash2 size={14} /> Remove</button>}
                </span>
              </div>
            ))}
          </div>
        )}
        {filter === "PENDING" && pending > 0 && policy.maxDevices === 1 && <p className="ps-hint">Approving a new device removes the employee's old one (limit: 1 device).</p>}
      </div>
    </section>
  );
}
