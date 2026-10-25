"use client";
import { ArrowLeft, Crosshair, ExternalLink, MapPin, Pencil, Plus, Power } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { accessApi, errorText, isConflict, type Me } from "./api";
import { ACCENT, Badge, Drawer, ErrorState, PermissionState, Toast } from "./ui";

type Site = { id: string; name: string; latitude: number; longitude: number; radiusMetres: number; active: boolean; version: number };
type Form = { name: string; latitude: string; longitude: string; radiusMetres: number; active: boolean };
const sitesApi = {
  list: () => httpRequest<{ items: Site[] }>("/api/v2/attendance/sites"),
  create: (body: Omit<Site, "id" | "version">) => httpRequest<{ id: string; version: number }>("/api/v2/attendance/sites", { method: "POST", body }),
  update: (id: string, body: Omit<Site, "id">) => httpRequest<{ id: string; version: number }>(`/api/v2/attendance/sites/${id}`, { method: "PATCH", body }),
};
const radiusLabel = (metres: number) => (metres >= 1000 ? `${(metres / 1000).toFixed(metres % 1000 ? 1 : 0)} km` : `${metres} m`);

export function AttendanceSites() {
  const [me, setMe] = useState<Me | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Site | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  const load = useCallback(async () => {
    setError("");
    try {
      const [viewer, list] = await Promise.all([accessApi.me(), sitesApi.list()]);
      setMe(viewer); setSites(list.items);
    } catch (reason) { setError(errorText(reason, "Unable to load attendance sites.")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error && !sites) return <div className="cw-page ax-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (!me || !sites) return <div className="cw-page ax-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  if (!me.can.settingsHub) return <div className="cw-page ax-page"><PermissionState title="Attendance sites are managed by HR" body="Your punches are checked against these sites automatically. Ask HR if your work location is missing." /></div>;
  const canManage = me.permissions.includes("attendance.sites.manage");

  const toggle = async (site: Site) => {
    setBusyId(site.id);
    try {
      await sitesApi.update(site.id, { name: site.name, latitude: site.latitude, longitude: site.longitude, radiusMetres: site.radiusMetres, active: !site.active, version: site.version });
      flash(`${site.name} ${site.active ? "deactivated" : "activated"}`); await load();
    } catch (reason) { flash(errorText(reason, "Unable to update the site.")); if (isConflict(reason)) load(); } finally { setBusyId(""); }
  };
  const active = sites.filter((site) => site.active);

  return (
    <div className="cw-page ax-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/settings" className="ax-back"><ArrowLeft size={14} /> Settings</Link>
      <header className="cw-hero">
        <span className="cw-hero-icon"><MapPin size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · ATTENDANCE</p>
          <h1>Attendance sites</h1>
          <p>Web and mobile punches are matched to the nearest active site. Punches outside every radius are still recorded but flagged for review.</p>
        </div>
        {canManage && <button className="cw-btn primary lg" onClick={() => setEditing("new")}><Plus size={17} /> Add site</button>}
      </header>
      {!canManage && <p className="ax-note">You can view sites. Adding or changing them needs “Manage attendance sites”.</p>}

      <section className="cw-stats" aria-label="Sites summary">
        <article><small>Active sites</small><b>{active.length}</b><span>of {sites.length} configured</span></article>
        <article><small>Smallest radius</small><b>{active.length ? radiusLabel(Math.min(...active.map((site) => site.radiusMetres))) : "—"}</b><span>tighter = fewer false matches</span></article>
        <article><small>Largest radius</small><b>{active.length ? radiusLabel(Math.max(...active.map((site) => site.radiusMetres))) : "—"}</b><span>warehouses and campuses need more</span></article>
        <article className={active.length ? "" : "attention"}><small>Status</small><b className="text">{active.length ? "Geofencing on" : "No active sites"}</b><span>{active.length ? "punches are location-checked" : "every punch will be flagged"}</span></article>
      </section>

      {!sites.length ? (
        <div className="cw-empty"><span><MapPin size={26} /></span><h2>No sites yet</h2><p>Add each café, roastery or office with its coordinates and an allowed radius.</p>
          {canManage && <button className="cw-btn primary" onClick={() => setEditing("new")}><Plus size={16} /> Add site</button>}</div>
      ) : (
        <div className="cw-table ax-sites-table" role="table" aria-label="Attendance sites">
          <div className="cw-row head" role="row"><span role="columnheader">Site</span><span role="columnheader">Coordinates</span><span role="columnheader">Radius</span><span role="columnheader">Status</span><span role="columnheader" /></div>
          {sites.map((site) => (
            <div key={site.id} role="row" className="cw-row">
              <span role="cell" className="cw-title-cell"><b>{site.name}</b><small>v{site.version}</small></span>
              <span role="cell" className="ax-coords"><a href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=17/${site.latitude}/${site.longitude}`} target="_blank" rel="noreferrer">{site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} <ExternalLink size={12} /></a></span>
              <span role="cell" className="ax-radius"><i style={{ ["--r" as string]: `${Math.min(100, 18 + Math.log10(site.radiusMetres / 25) * 40)}%` }} aria-hidden="true" />{radiusLabel(site.radiusMetres)}</span>
              <span role="cell"><Badge tone={site.active ? "success" : "neutral"} label={site.active ? "Active" : "Inactive"} /></span>
              <span role="cell" className="ax-row-actions">
                {canManage && <>
                  <button className="cw-icon-button" onClick={() => setEditing(site)} aria-label={`Edit ${site.name}`} title="Edit"><Pencil size={15} /></button>
                  <button className="cw-icon-button" onClick={() => toggle(site)} disabled={busyId === site.id} aria-label={site.active ? `Deactivate ${site.name}` : `Activate ${site.name}`} title={site.active ? "Deactivate" : "Activate"}><Power size={15} /></button>
                </>}
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && <SiteDrawer site={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); flash(message); load(); }} />}
      <Toast message={toast} />
    </div>
  );
}

function SiteDrawer({ site, onClose, onSaved }: { site: Site | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState<Form>(site
    ? { name: site.name, latitude: String(site.latitude), longitude: String(site.longitude), radiusMetres: site.radiusMetres, active: site.active }
    : { name: "", latitude: "", longitude: "", radiusMetres: 150, active: true });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const lat = Number(form.latitude), lng = Number(form.longitude);
  const valid = form.name.trim().length >= 2 && form.latitude !== "" && form.longitude !== "" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && form.radiusMetres >= 25 && form.radiusMetres <= 5000;

  const locate = () => {
    if (!navigator.geolocation) { setError("This browser can't share its location."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => { set("latitude", position.coords.latitude.toFixed(6)); set("longitude", position.coords.longitude.toFixed(6)); setLocating(false); },
      () => { setError("Location permission was denied or timed out. Enter coordinates manually."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!valid) return;
    setBusy(true); setError("");
    const body = { name: form.name.trim(), latitude: lat, longitude: lng, radiusMetres: Math.round(form.radiusMetres), active: form.active };
    try {
      if (site) await sitesApi.update(site.id, { ...body, version: site.version });
      else await sitesApi.create(body);
      onSaved(site ? `${body.name} saved` : `${body.name} added`);
    } catch (reason) { setError(errorText(reason, "Unable to save the site.")); } finally { setBusy(false); }
  };
  return (
    <Drawer title={site ? site.name : "New attendance site"} eyebrow={site ? "ATTENDANCE · EDIT SITE" : "ATTENDANCE · ADD SITE"} onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="cw-fields">
          <label className="wide"><span>Site name <em>*</em></span><input value={form.name} maxLength={120} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Indiranagar café" required autoFocus /></label>
          <label><span>Latitude <em>*</em></span><input inputMode="decimal" value={form.latitude} onChange={(event) => set("latitude", event.target.value)} placeholder="12.971599" required /></label>
          <label><span>Longitude <em>*</em></span><input inputMode="decimal" value={form.longitude} onChange={(event) => set("longitude", event.target.value)} placeholder="77.594566" required /></label>
          <div className="wide"><button type="button" className="cw-btn ghost" onClick={locate} disabled={locating}><Crosshair size={15} /> {locating ? "Locating…" : "Use my current location"}</button></div>
          <label className="wide"><span>Allowed radius <small>{radiusLabel(form.radiusMetres)} · 25 m – 5 km</small></span>
            <div className="ax-range">
              <input type="range" min={25} max={1000} step={5} value={Math.min(form.radiusMetres, 1000)} onChange={(event) => set("radiusMetres", Number(event.target.value))} aria-label="Radius slider" />
              <input type="number" min={25} max={5000} value={form.radiusMetres} onChange={(event) => set("radiusMetres", Number(event.target.value))} aria-label="Radius in metres" />
            </div>
          </label>
          <label className="wide ax-check"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} /><span>Active — punches are matched against this site</span></label>
        </div>
        <p className="ax-note">Indoor GPS is often 30–80 m off. 100–200 m suits most cafés; roasteries and campuses may need more.</p>
        <div className="cw-create-foot">
          <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy || !valid}>{busy ? "Saving…" : site ? "Save site" : "Add site"}</button>
        </div>
      </form>
    </Drawer>
  );
}
