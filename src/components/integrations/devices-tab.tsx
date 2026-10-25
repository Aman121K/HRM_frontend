"use client";
import { Fingerprint, Link2, Plus, RefreshCw, RotateCcw, Search, ShieldOff, Upload, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { shortDate, relativeTime } from "@/lib/cases";
import { get, send, dateTime, label, type Device, type DeviceList, type DeviceSecret, type Employee, type ImportResult, type Mapping, type Punch, type Unmatched } from "./api";
import { Badge, Drawer, Empty, ErrorNote, SecretReveal, Skeleton, readTextFile, useLoad } from "./ui";

const VENDORS = [["ZKTECO", "ZKTeco"], ["ESSL", "eSSL"], ["MANTRA", "Mantra"], ["GENERIC", "Generic / middleware"]];
const vendorName = (key: string) => VENDORS.find(([value]) => value === key)?.[1] || key;
const healthText: Record<string, string> = { ONLINE: "Online", STALE: "Stale", OFFLINE: "Offline", NEVER_SEEN: "Never seen", INACTIVE: "Inactive" };

export function DevicesTab({ notify, onChange }: { notify: (message: string) => void; onChange: () => void }) {
  const [view, setView] = useState<"registry" | "mappings" | "unmatched">("registry");
  const devices = useLoad(() => get<DeviceList>("/devices"));
  const employees = useLoad(() => get<{ items: Employee[] }>("/devices/employees"));
  const unmatched = useLoad(() => get<{ items: Unmatched[] }>("/devices/unmatched"));
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Device | null>(null);
  const refresh = () => { devices.reload(); unmatched.reload(); onChange(); };
  const unmatchedCount = unmatched.data?.items.reduce((sum, item) => sum + item.punches, 0) || 0;

  return (
    <section aria-label="Biometric devices">
      <div className="ig-subbar">
        <div className="cw-chips" role="tablist" aria-label="Device views">
          {([["registry", "Registry & health"], ["mappings", "Employee mappings"], ["unmatched", "Unmatched punches"]] as const).map(([key, text]) => (
            <button key={key} role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)}>
              {text}{key === "unmatched" && unmatchedCount > 0 && <b>{unmatchedCount}</b>}
            </button>
          ))}
        </div>
        <div className="ig-subbar-actions">
          <button className="cw-icon-button" aria-label="Refresh" title="Refresh" onClick={refresh}><RefreshCw size={15} /></button>
          <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Register device</button>
        </div>
      </div>

      {view === "registry" && <Registry state={devices} onOpen={setOpen} onCreate={() => setCreating(true)} />}
      {view === "mappings" && <Mappings devices={devices.data?.items || []} employees={employees.data?.items || []} notify={notify} onChange={refresh} />}
      {view === "unmatched" && <UnmatchedQueue state={unmatched} employees={employees.data?.items || []} notify={notify} onChange={refresh} />}

      {creating && <CreateDevice sites={devices.data?.sites || []} onClose={() => setCreating(false)} onCreated={() => { refresh(); notify("Device registered."); }} />}
      {open && <DeviceDrawer device={open} sites={devices.data?.sites || []} onClose={() => setOpen(null)} notify={notify}
        onChange={(next) => { refresh(); if (next) setOpen(next); }} />}
    </section>
  );
}

function Registry({ state, onOpen, onCreate }: { state: ReturnType<typeof useLoad<DeviceList>>; onOpen: (device: Device) => void; onCreate: () => void }) {
  if (state.loading && !state.data) return <Skeleton rows={4} />;
  if (state.error) return <ErrorNote message={state.error} />;
  const data = state.data!;
  if (!data.items.length) return (
    <Empty icon={<Fingerprint size={26} />} title="No biometric devices yet" action={<button className="cw-btn primary" onClick={onCreate}><Plus size={15} /> Register your first device</button>}>
      Register a ZKTeco, eSSL or Mantra terminal (or a middleware bridge). Punches flow into attendance through the same rules as web and mobile punches.
    </Empty>
  );
  return (
    <>
      <HourlyChart hourly={data.hourly} />
      <div className="cw-table" role="table" aria-label="Devices">
        <div className="cw-row head ig-device-row" role="row"><span>Device</span><span>Site</span><span>Health</span><span>Last seen</span><span className="num">24 h punches</span><span>Queue</span></div>
        {data.items.map((device) => (
          <button key={device.id} className="cw-row ig-device-row" role="row" onClick={() => onOpen(device)}>
            <span className="cw-title-cell"><small>{vendorName(device.vendor)} · {device.serialNumber}</small><b>{device.name}</b></span>
            <span>{device.siteName || <em className="ig-muted">No site</em>}</span>
            <span><Badge status={device.health} text={healthText[device.health]} /></span>
            <span>{device.lastSeenAt ? relativeTime(device.lastSeenAt) : "—"}{device.protocol && <small className="ig-sub">{device.protocol === "ADMS" ? "ADMS push" : "Signed API"}</small>}</span>
            <span className="num">{device.punches24h}</span>
            <span>{device.unmatched > 0 ? <Badge status="UNMATCHED" text={`${device.unmatched} unmatched`} /> : device.rejected24h > 0 ? <Badge status="REJECTED" text={`${device.rejected24h} rejected`} /> : <span className="ig-muted">Clear</span>}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function HourlyChart({ hourly }: { hourly: DeviceList["hourly"] }) {
  const hours = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return Array.from({ length: 24 }, (_, index) => {
      const at = new Date(now.getTime() - (23 - index) * 3_600_000);
      const row = hourly.find((item) => new Date(item.hour).getTime() === at.getTime());
      return { at, total: row?.total || 0, unmatched: row?.unmatched || 0 };
    });
  }, [hourly]);
  const max = Math.max(4, ...hours.map((hour) => hour.total));
  const total = hours.reduce((sum, hour) => sum + hour.total, 0);
  const width = 720, height = 120, bar = width / 24;
  return (
    <figure className="ig-chart">
      <figcaption><b>Punches received · last 24 hours</b><span><i className="ig-key ok" /> Recorded <i className="ig-key warn" /> Unmatched</span></figcaption>
      <svg viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label={`${total} punches received in the last 24 hours`}>
        <title>{`${total} punches in the last 24 hours`}</title>
        <line x1="0" x2={width} y1={height} y2={height} className="ig-axis" />
        {hours.map((hour, index) => {
          const h = (hour.total / max) * (height - 8);
          const u = (hour.unmatched / max) * (height - 8);
          return (
            <g key={index}>
              <title>{`${hour.at.getHours()}:00 — ${hour.total} punches, ${hour.unmatched} unmatched`}</title>
              <rect x={index * bar + 3} width={bar - 6} y={height - h} height={Math.max(0, h - u)} className="ig-bar" />
              {u > 0 && <rect x={index * bar + 3} width={bar - 6} y={height - u} height={u} className="ig-bar warn" />}
              {index % 4 === 0 && <text x={index * bar + bar / 2} y={height + 14} textAnchor="middle">{`${String(hour.at.getHours()).padStart(2, "0")}:00`}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function SetupGuide({ serial }: { serial: string }) {
  const origin = (process.env.NEXT_PUBLIC_PLATFORM_API_URL || "http://localhost:4100").replace(/\/$/, "");
  return (
    <div className="ig-guide">
      <p className="cw-section-label">Connect the device</p>
      <dl className="cw-facts">
        <div className="wide"><dt>ZKTeco / eSSL (ADMS push)</dt><dd>Cloud server: <code>{origin}</code> · the device calls <code>/iclock/cdata?SN={serial}&amp;key=&lt;comm key&gt;</code></dd></div>
        <div className="wide"><dt>Signed JSON API (Mantra, middleware)</dt><dd><code>POST {origin}/api/v2/integrations/devices/punches</code><small>Headers x-device-serial, x-timestamp (unix seconds), x-signature = HMAC-SHA256(secret, “timestamp.body”). Requests older than 5 minutes are rejected.</small></dd></div>
      </dl>
    </div>
  );
}

function CreateDevice({ sites, onClose, onCreated }: { sites: { id: string; name: string }[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ serialNumber: "", name: "", vendor: "ZKTECO", siteId: "", timezone: "Asia/Kolkata" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<DeviceSecret | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await send<DeviceSecret>("/devices", { ...form, siteId: form.siteId || undefined });
      setSecret(result); onCreated();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  return (
    <Drawer title={secret ? "Device registered" : "Register a biometric device"} eyebrow="DEVICES" onClose={onClose}>
      {secret ? (
        <>
          <SecretReveal title={`Credentials for ${secret.serialNumber}`} notice={secret.secretNotice} onDone={onClose} items={[
            { label: "Device secret", value: secret.secret, hint: "Signs JSON API requests (HMAC-SHA256)" },
            { label: "Comm key", value: secret.commKey, hint: "Authenticates ADMS push from ZKTeco/eSSL" },
          ]} />
          <SetupGuide serial={secret.serialNumber} />
        </>
      ) : (
        <form className="cw-create" onSubmit={submit}>
          <ErrorNote message={error} />
          <div className="cw-fields">
            <label><span>Serial number <em>*</em></span><input required value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} placeholder="e.g. CQUJ2104012" pattern="[A-Za-z0-9._\-]{4,40}" /></label>
            <label><span>Vendor <em>*</em></span><select value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })}>{VENDORS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label className="wide"><span>Name <em>*</em></span><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Indiranagar café — entrance" /></label>
            <label><span>Site</span><select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}><option value="">No site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <label><span>Timezone <small>(device clock)</small></span><input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
          </div>
          <p className="cw-help">The device secret and comm key are generated now and shown only once. Northstar stores only a fingerprint.</p>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy}>{busy ? "Registering…" : "Register device"}</button></div>
        </form>
      )}
    </Drawer>
  );
}

function DeviceDrawer({ device, sites, onClose, notify, onChange }: { device: Device; sites: { id: string; name: string }[]; onClose: () => void; notify: (message: string) => void; onChange: (next?: Device) => void }) {
  const [form, setForm] = useState({ name: device.name, vendor: device.vendor, siteId: device.siteId || "", timezone: device.timezone });
  const [filter, setFilter] = useState("");
  const punches = useLoad(() => get<{ items: Punch[] }>(`/devices/${device.id}/punches?limit=100${filter ? `&status=${filter}` : ""}`), [device.id, filter]);
  const [confirm, setConfirm] = useState<"" | "rotate" | "revoke">("");
  const [secret, setSecret] = useState<DeviceSecret | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true); setError("");
    try { await work(); notify(message); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); setConfirm(""); }
  };
  const save = (event: React.FormEvent) => { event.preventDefault(); act(async () => { const row = await send<{ version: number }>(`/devices/${device.id}`, { ...form, version: device.version }, "PATCH"); onChange({ ...device, ...form, siteName: sites.find((site) => site.id === form.siteId)?.name || null, version: row.version }); }, "Device updated."); };
  const toggle = () => act(async () => { const row = await send<{ version: number; status: string }>(`/devices/${device.id}`, { status: device.status === "ACTIVE" ? "DISABLED" : "ACTIVE", version: device.version }, "PATCH"); onChange({ ...device, status: row.status, version: row.version }); }, device.status === "ACTIVE" ? "Device disabled — its punches are refused." : "Device enabled.");
  const rotate = () => act(async () => { const result = await send<DeviceSecret & { version: number }>(`/devices/${device.id}/rotate`, { version: device.version }); setSecret(result); onChange({ ...device, status: "ACTIVE", version: result.version }); }, "New secret generated.");
  const revoke = () => act(async () => { const row = await send<{ version: number }>(`/devices/${device.id}/revoke`, { version: device.version }); onChange({ ...device, status: "REVOKED", version: row.version }); }, "Device revoked.");
  return (
    <Drawer title={device.name} eyebrow={`${vendorName(device.vendor).toUpperCase()} · ${device.serialNumber}`} onClose={onClose}>
      {secret ? <><SecretReveal title="New device credentials" notice={secret.secretNotice} onDone={() => setSecret(null)} items={[
        { label: "Device secret", value: secret.secret }, { label: "Comm key", value: secret.commKey }]} /><SetupGuide serial={device.serialNumber} /></> : (
        <>
          <div className="cw-head-meta"><Badge status={device.health} text={healthText[device.health]} /><Badge status={device.status} /></div>
          <ErrorNote message={error} />
          <dl className="cw-facts">
            <div><dt>Last seen</dt><dd>{dateTime(device.lastSeenAt)}<small>{device.lastIp || "No contact yet"}</small></dd></div>
            <div><dt>Last punch</dt><dd>{dateTime(device.lastPunchAt)}<small>{device.punches24h} in 24 h</small></dd></div>
            <div><dt>Protocol</dt><dd>{device.protocol === "ADMS" ? "ADMS push" : device.protocol === "JSON" ? "Signed JSON API" : "—"}<small>{device.firmware || "Firmware unknown"}</small></dd></div>
            <div><dt>Secret</dt><dd>{device.secretHint ? `…${device.secretHint}` : "Revoked"}<small>Rotated {shortDate(device.secretRotatedAt)}</small></dd></div>
          </dl>
          <form className="cw-fields" onSubmit={save}>
            <label className="wide"><span>Name</span><input value={form.name} minLength={2} maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label><span>Vendor</span><select value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })}>{VENDORS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label><span>Site</span><select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}><option value="">No site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <label className="wide"><span>Timezone</span><input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
            <div className="wide cw-action-row"><button className="cw-btn primary" disabled={busy}>Save changes</button></div>
          </form>
          <div className="ig-danger-zone">
            <p className="cw-section-label">Credentials</p>
            {confirm ? (
              <div className="ig-confirm" role="alertdialog" aria-label="Confirm">
                <p>{confirm === "rotate" ? "Generate a new secret and comm key? The device stops working until you enter the new values." : "Revoke this device? Its credentials are destroyed and punches are refused."}</p>
                <div className="cw-action-row"><button className="cw-btn ghost" onClick={() => setConfirm("")}>Keep</button>
                  <button className={`cw-btn ${confirm === "revoke" ? "danger" : "primary"}`} disabled={busy} onClick={confirm === "rotate" ? rotate : revoke}>{confirm === "rotate" ? "Rotate now" : "Revoke device"}</button></div>
              </div>
            ) : (
              <div className="cw-action-row">
                {device.status !== "REVOKED" && <button className="cw-btn ghost" disabled={busy} onClick={toggle}>{device.status === "ACTIVE" ? "Disable" : "Enable"}</button>}
                <button className="cw-btn ghost" onClick={() => setConfirm("rotate")}><RotateCcw size={14} /> Rotate secret</button>
                {device.status !== "REVOKED" && <button className="cw-btn danger" onClick={() => setConfirm("revoke")}><ShieldOff size={14} /> Revoke</button>}
              </div>
            )}
          </div>
          <div>
            <div className="ig-section-head"><p className="cw-section-label">Recent punches</p>
              <select aria-label="Filter punches" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="">All</option><option value="RECORDED">Recorded</option><option value="UNMATCHED">Unmatched</option><option value="REJECTED">Rejected</option><option value="IGNORED">Ignored</option>
              </select></div>
            {punches.loading && !punches.data ? <Skeleton rows={2} /> : punches.error ? <ErrorNote message={punches.error} /> : !punches.data?.items.length ? <p className="ig-muted">No punches received yet.</p> : (
              <ul className="ig-punches">
                {punches.data.items.map((punch) => (
                  <li key={punch.id}>
                    <span><b>{punch.employeeName || `PIN ${punch.deviceUserId}`}</b><small>{dateTime(punch.occurredAt)} · {punch.type || "auto"} · {punch.protocol}{punch.verifyMode ? ` · ${label(punch.verifyMode)}` : ""}</small>{punch.reason && punch.status !== "RECORDED" && <small className="ig-warn">{punch.reason}</small>}</span>
                    <Badge status={punch.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

function EmployeeSelect({ employees, value, onChange, id }: { employees: Employee[]; value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Choose employee…</option>
      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.number})</option>)}
    </select>
  );
}

function Mappings({ devices, employees, notify, onChange }: { devices: Device[]; employees: Employee[]; notify: (message: string) => void; onChange: () => void }) {
  const mappings = useLoad(() => get<{ items: Mapping[] }>("/devices/mappings"));
  const [form, setForm] = useState({ employeeId: "", deviceUserId: "", deviceId: "" });
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await send<{ replayed: number }>("/devices/mappings", { ...form, deviceId: form.deviceId || undefined });
      notify(response.replayed ? `Mapped — ${response.replayed} queued punch(es) recorded.` : "Mapping added.");
      setForm({ employeeId: "", deviceUserId: "", deviceId: "" }); mappings.reload(); onChange();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const remove = async (mapping: Mapping) => {
    try { await send(`/devices/mappings/${mapping.id}`, undefined, "DELETE"); notify(`Removed PIN ${mapping.deviceUserId}.`); mappings.reload(); } catch (reason) { setError((reason as Error).message); }
  };
  const runImport = async (dryRun: boolean) => {
    setError(""); setBusy(true);
    try {
      const response = await send<ImportResult>("/devices/mappings/import", { csv, dryRun });
      setResult(response);
      if (!dryRun) { notify(`Imported ${response.summary.new} mapping(s)${response.replayed ? `, recorded ${response.replayed} queued punch(es)` : ""}.`); mappings.reload(); onChange(); }
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const rows = (mappings.data?.items || []).filter((row) => !search || `${row.employeeName} ${row.employeeNumber} ${row.deviceUserId}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="ig-split">
      <div>
        <div className="ig-section-head">
          <label className="cw-search"><Search size={15} /><input aria-label="Search mappings" placeholder="Search name, code or PIN" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <ErrorNote message={error} />
        {mappings.loading && !mappings.data ? <Skeleton /> : mappings.error ? <ErrorNote message={mappings.error} /> : !rows.length ? (
          <Empty icon={<Link2 size={24} />} title={search ? "No mappings match" : "No mappings yet"}>Map each employee to the user ID (PIN) enrolled on the devices, or import a CSV.</Empty>
        ) : (
          <div className="cw-table" role="table" aria-label="Employee to device mappings">
            <div className="cw-row head ig-map-row" role="row"><span>Employee</span><span>Device user ID</span><span>Scope</span><span /></div>
            {rows.map((row) => (
              <div key={row.id} className="cw-row ig-map-row" role="row">
                <span className="cw-title-cell"><small>{row.employeeNumber} · {row.department || "—"}</small><b>{row.employeeName}</b></span>
                <span><code className="ig-pin">{row.deviceUserId}</code></span>
                <span>{row.deviceName ? `${row.deviceName}` : <span className="ig-muted">All devices</span>}</span>
                <span className="cw-row-cta"><button className="cw-icon-button" aria-label={`Remove mapping ${row.deviceUserId}`} title="Remove" onClick={() => remove(row)}><UserX size={15} /></button></span>
              </div>
            ))}
          </div>
        )}
      </div>
      <aside className="ig-side">
        <form className="ig-card" onSubmit={add}>
          <h3>Add a mapping</h3>
          <div className="cw-fields single">
            <label><span>Employee</span><EmployeeSelect employees={employees} value={form.employeeId} onChange={(value) => setForm({ ...form, employeeId: value })} /></label>
            <label><span>Device user ID (PIN)</span><input required pattern="[A-Za-z0-9_\-]{1,24}" value={form.deviceUserId} onChange={(event) => setForm({ ...form, deviceUserId: event.target.value })} placeholder="e.g. 1007" /></label>
            <label><span>Applies to</span><select value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })}><option value="">All devices</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          </div>
          <button className="cw-btn primary" disabled={busy}>Add mapping</button>
        </form>
        <div className="ig-card">
          <h3>Bulk import (CSV)</h3>
          <p className="cw-help">Columns: <code>employee_number,device_user_id,device_serial</code> (serial optional — blank means all devices). Queued punches for new PINs are recorded automatically.</p>
          <label className="att-drop"><Upload size={18} /><span><b>Choose a CSV file</b><small>or paste below</small></span>
            <input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { try { setCsv(await readTextFile(file)); setResult(null); } catch (reason) { setError((reason as Error).message); } } }} />
          </label>
          <textarea className="ig-textarea" aria-label="CSV content" rows={5} value={csv} onChange={(event) => { setCsv(event.target.value); setResult(null); }} placeholder={"employee_number,device_user_id\nBT002,1002"} />
          <div className="cw-action-row">
            <button className="cw-btn ghost" disabled={busy || csv.trim().length < 3} onClick={() => runImport(true)}>Validate</button>
            <button className="cw-btn primary" disabled={busy || !result?.dryRun || !result.summary.new} onClick={() => runImport(false)}>Import {result?.dryRun ? result.summary.new : ""}</button>
          </div>
          {result && (
            <div className="ig-import">
              <p><b>{result.summary.new}</b> new · <b>{result.summary.unchanged}</b> unchanged · <b className={result.summary.errors ? "ig-warn" : ""}>{result.summary.errors}</b> errors</p>
              {result.rows.filter((row) => row.status === "ERROR").slice(0, 8).map((row) => <small key={row.line} className="ig-warn">Line {row.line}: {row.error}</small>)}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function UnmatchedQueue({ state, employees, notify, onChange }: { state: ReturnType<typeof useLoad<{ items: Unmatched[] }>>; employees: Employee[]; notify: (message: string) => void; onChange: () => void }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const resolve = async (row: Unmatched) => {
    setBusy(row.deviceUserId); setError("");
    try {
      const response = await send<{ replayed: number }>("/devices/unmatched/resolve", { deviceUserId: row.deviceUserId, employeeId: choice[row.deviceUserId] });
      notify(`PIN ${row.deviceUserId} mapped — ${response.replayed} punch(es) recorded in attendance.`); onChange();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(""); }
  };
  const dismiss = async (row: Unmatched) => {
    setBusy(row.deviceUserId); setError("");
    try { const response = await send<{ ignored: number }>("/devices/unmatched/ignore", { punchIds: row.punchIds }); notify(`Dismissed ${response.ignored} punch(es).`); onChange(); }
    catch (reason) { setError((reason as Error).message); } finally { setBusy(""); }
  };
  if (state.loading && !state.data) return <Skeleton />;
  if (state.error) return <ErrorNote message={state.error} />;
  if (!state.data?.items.length) return <Empty icon={<Fingerprint size={26} />} title="No unmatched punches">Punches from device user IDs that are not mapped to an employee wait here until you map and replay them.</Empty>;
  return (
    <>
      <p className="ig-lede">These device user IDs are not mapped to anyone. Choose the employee to map the PIN and record the queued punches in attendance, or dismiss test/visitor punches.</p>
      <ErrorNote message={error} />
      <div className="cw-table" role="table" aria-label="Unmatched punches">
        <div className="cw-row head ig-unmatched-row" role="row"><span>Device user ID</span><span>Punches</span><span>Seen</span><span>Map to employee</span><span /></div>
        {state.data.items.map((row) => (
          <div key={row.deviceUserId} className="cw-row ig-unmatched-row" role="row">
            <span className="cw-title-cell"><small>{row.devices.join(", ")}</small><b>PIN {row.deviceUserId}</b></span>
            <span className="num">{row.punches}</span>
            <span>{dateTime(row.firstAt)}<small className="ig-sub">to {dateTime(row.lastAt)}</small></span>
            <span><EmployeeSelect employees={employees} value={choice[row.deviceUserId] || ""} onChange={(value) => setChoice({ ...choice, [row.deviceUserId]: value })} /></span>
            <span className="cw-row-cta">
              <button className="cw-btn primary" disabled={!choice[row.deviceUserId] || busy === row.deviceUserId} onClick={() => resolve(row)}>Map &amp; replay</button>
              <button className="cw-btn ghost" disabled={busy === row.deviceUserId} onClick={() => dismiss(row)}>Dismiss</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
