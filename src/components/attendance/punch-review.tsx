"use client";
import { AlertTriangle, Camera, Check, MapPin, ShieldCheck, UserX, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authHeaders, httpRequest } from "@/lib/http-client";
import { POLICY_EVENT } from "./punch-security";
import { platformApiUrl } from "@/lib/api";
import { initials, relativeTime } from "@/lib/cases";

type ReviewItem = {
  id: string; type: "IN" | "OUT"; occurredAt: string; source: string; withinGeofence: boolean | null; distanceMetres: number | null; accuracyMetres: number | null;
  selfieFileId: string | null; faceCheck: { faces: number; liveness: { passed: boolean; method: string }; detector: string } | null;
  reviewReasons: string[]; siteName: string | null; employeeName: string; designation: string | null; employeeNumber: string;
};
type Policy = { selfieMode: "OFF" | "OUTSIDE_GEOFENCE" | "ALWAYS"; livenessRequired: boolean; selfieRetentionDays: number; exemptRoles: string[]; version: number };

const REASONS: Record<string, string> = {
  outside_geofence: "Outside site", device_unverified: "Device not verified", device_of_other_employee: "Another employee's device",
  unregistered_device: "Unregistered device", off_office_network: "Not on office network", wifi_not_reported: "Wi-Fi not confirmed", unknown_wifi: "Unknown Wi-Fi router", no_face: "No face in photo", multiple_faces: "More than one person", liveness_failed: "Blink check failed",
  face_check_unavailable: "Face check unavailable", selfie_missing: "No selfie", selfie_upload_failed: "Photo not saved",
};
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

function Selfie({ fileId, name }: { fileId: string | null; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!fileId) return;
    let objectUrl = "";
    fetch(platformApiUrl(`/api/v2/files/${fileId}/content`), { headers: authHeaders() })
      .then((response) => response.ok ? response.blob() : Promise.reject())
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId]);
  if (!fileId) return <span className="pr-photo empty"><UserX size={20} /></span>;
  return url ? <img className="pr-photo" src={url} alt={`Punch selfie of ${name}`} /> : <span className="pr-photo empty"><Camera size={18} /></span>;
}

/** Manager/HR queue of punches flagged for review (selfie checks, geofence), plus the HR selfie policy. Renders nothing for employees. */
export function PunchReview() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [scope, setScope] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [canEditPolicy, setCanEditPolicy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const load = useCallback(() => {
    httpRequest<{ items: ReviewItem[]; scope: string }>("/api/v2/attendance/review").then((data) => { setItems(data.items); setScope(data.scope); })
      .catch(() => setItems(null));
  }, []);
  useEffect(() => {
    load();
    httpRequest<Policy>("/api/v2/attendance/policy").then(setPolicy).catch(() => {});
    // Punch security edits the same policy row; keep the version in step so neither panel hits a stale-version conflict.
    const sync = (event: Event) => setPolicy((event as CustomEvent<Policy>).detail);
    window.addEventListener(POLICY_EVENT, sync);
    return () => window.removeEventListener(POLICY_EVENT, sync);
  }, [load]);
  useEffect(() => { setCanEditPolicy(scope === "organization"); }, [scope]);
  if (items === null) return null;

  const decide = async (item: ReviewItem, decision: "APPROVED" | "REJECTED") => {
    setError("");
    try { await httpRequest(`/api/v2/attendance/events/${item.id}/review`, { method: "POST", body: { decision, note: notes[item.id] } }); load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save the decision."); }
  };
  const savePolicy = async (next: Policy) => {
    setError("");
    try {
      const saved = { ...next, ...(await httpRequest<Policy>("/api/v2/attendance/policy", { method: "PUT", body: next })) };
      setPolicy(saved); window.dispatchEvent(new CustomEvent(POLICY_EVENT, { detail: saved }));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save the policy."); }
  };

  return (
    <section className="pr">
      <header>
        <div><p className="cw-eyebrow">{scope === "organization" ? "ALL TEAMS" : "YOUR TEAM"}</p><h2>Punches to review {items.length > 0 && <b>{items.length}</b>}</h2></div>
        {policy && (
          <div className="pr-policy">
            <ShieldCheck size={15} />
            <label>Selfie on punch
              <select value={policy.selfieMode} disabled={!canEditPolicy} onChange={(event) => savePolicy({ ...policy, selfieMode: event.target.value as Policy["selfieMode"] })}>
                <option value="OFF">Off</option><option value="OUTSIDE_GEOFENCE">Only outside site</option><option value="ALWAYS">Every punch</option>
              </select>
            </label>
            <label className="pr-check"><input type="checkbox" checked={policy.livenessRequired} disabled={!canEditPolicy || policy.selfieMode === "OFF"} onChange={(event) => savePolicy({ ...policy, livenessRequired: event.target.checked })} /> Blink check</label>
            <label>Keep photos
              <select value={policy.selfieRetentionDays} disabled={!canEditPolicy} onChange={(event) => savePolicy({ ...policy, selfieRetentionDays: Number(event.target.value) })}>
                {[30, 60, 90, 180, 365].map((days) => <option key={days} value={days}>{days} days</option>)}
              </select>
            </label>
          </div>
        )}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!items.length ? <p className="pr-empty"><Check size={15} /> No flagged punches. Punches with a failed face check or outside a site will appear here.</p> : (
        <div className="pr-list">
          {items.map((item) => (
            <article key={item.id}>
              <Selfie fileId={item.selfieFileId} name={item.employeeName} />
              <div className="pr-body">
                <p className="pr-who"><span className="cw-avatar small">{initials(item.employeeName)}</span><span><b>{item.employeeName}</b><small>{item.designation} · {item.employeeNumber}</small></span></p>
                <p className="pr-meta">Punch {item.type === "IN" ? "in" : "out"} · {time(item.occurredAt)} · {relativeTime(item.occurredAt)}</p>
                <p className="pr-meta"><MapPin size={12} /> {item.siteName ? `${item.siteName} · ${Math.round(item.distanceMetres || 0)} m` : "No site nearby"}{item.accuracyMetres ? ` · ±${Math.round(item.accuracyMetres)} m` : ""} · {item.source.toLowerCase()}</p>
                <p className="pr-reasons">{item.reviewReasons.map((reason) => <span key={reason} className="cw-badge tone-warning"><i />{REASONS[reason] || reason}</span>)}</p>
                <input className="pr-note" placeholder="Note (required to reject)" value={notes[item.id] || ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} aria-label={`Review note for ${item.employeeName}`} />
                <div className="cw-action-row">
                  <button className="cw-btn danger" onClick={() => decide(item, "REJECTED")}><X size={14} /> Reject</button>
                  <button className="cw-btn primary" style={{ ["--accent" as string]: "#0b615c" }} onClick={() => decide(item, "APPROVED")}><Check size={14} /> Looks right</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
