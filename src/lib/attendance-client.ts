"use client";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "./http-client";
import type { SelfieResult } from "@/components/attendance/selfie-capture";
import { punchDevice, punchMessage } from "./punch-device";

export type PunchEvent = { id: string; type: "IN" | "OUT"; occurredAt: string; source: string; withinGeofence: boolean | null; distanceMetres: number | null; reviewStatus?: string; selfieFileId?: string | null };
export type AttendanceToday = { date: string; state: "NOT_STARTED" | "PUNCHED_IN" | "PUNCHED_OUT"; expectedNext: "IN" | "OUT"; workedMinutes: number; events: PunchEvent[] };

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser can't share your location. Use the mobile app to punch.")); return; }
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(
      error.code === error.PERMISSION_DENIED ? "Location permission is off. Allow location for this site in your browser settings, then try again."
        : error.code === error.TIMEOUT ? "Getting your location took too long. Move near a window and try again."
        : "We couldn't get your location. Check that location services are on.")), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });
}

export type PunchSecurity = { device: string; network: string; wifi: string; modes: { device: string; network: string; wifi: string } };

/** Stops before the selfie step when the server is certain to block the punch, with a message the person can act on. */
function securityProblem(security?: PunchSecurity) {
  if (!security) return null;
  if (security.modes.device === "BLOCK" && security.device === "other_employee") return "This device is registered to another employee. Each device can mark attendance for one person only.";
  if (security.modes.network === "BLOCK" && security.network === "outside") return "Connect to the office Wi-Fi to punch. Your connection isn't on the office network.";
  if (security.modes.wifi === "BLOCK" && security.wifi === "not_reported") return "Your company requires punching from the mobile app while connected to the office Wi-Fi.";
  return null;
}

export const formatMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;

/** Today's attendance with a GPS punch action; the worked-time counter ticks while punched in. */
export function useAttendanceToday() {
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(0);
  const accept = useCallback((value: AttendanceToday) => { setToday(value); setFetchedAt(Date.now()); }, []);
  const load = useCallback(() => httpRequest<AttendanceToday>("/api/v2/attendance/today").then(accept).catch((reason) => setError(reason.message)), [accept]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (today?.state !== "PUNCHED_IN") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [today?.state]);
  /** `getSelfie` is asked for a live photo only when the organization's policy requires one for this punch. */
  const punch = useCallback(async (getSelfie?: (livenessRequired: boolean) => Promise<SelfieResult | null>) => {
    if (!today) return null;
    setBusy(true); setError("");
    try {
      const position = await currentPosition();
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: Math.max(1, position.coords.accuracy), capturedAt: new Date(position.timestamp).toISOString(), permission: "granted" as const };
      // The device key is created on first use; if this browser can't hold one, the server decides (binding may be off).
      const device = await punchDevice().catch(() => null);
      const check = await httpRequest<{ selfieRequired: boolean; livenessRequired: boolean; withinGeofence: boolean | null; security?: PunchSecurity }>("/api/v2/attendance/precheck", {
        method: "POST", body: { ...location, ...(device ? { deviceKeyHash: device.keyHash } : {}) } });
      const blocked = securityProblem(check.security);
      if (blocked) throw new Error(blocked);
      let verification: SelfieResult | null = null;
      if (check.selfieRequired) {
        if (!getSelfie) throw new Error("A selfie is required to punch. Use the attendance page or the mobile app.");
        verification = await getSelfie(check.livenessRequired);
        if (!verification) { setBusy(false); return null; }
      }
      const idempotencyKey = `web-${crypto.randomUUID()}`;
      const proof = device ? { kind: "webcrypto", platform: "WEB", label: device.label, publicKey: device.publicKey,
        signature: await device.sign(punchMessage(today.expectedNext, idempotencyKey, location.capturedAt)) } : undefined;
      const result = await httpRequest<AttendanceToday & { event?: { occurredAt: string }; warning?: string }>("/api/v2/attendance/punch", {
        method: "POST",
        body: {
          type: today.expectedNext, source: "WEB", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          idempotencyKey, location, ...(proof ? { device: proof } : {}),
          ...(verification ? { selfie: verification.selfie, faceCheck: verification.faceCheck } : {}),
        },
      });
      accept(result);
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Punch failed.");
      return null;
    } finally { setBusy(false); }
  }, [today, accept]);
  const firstIn = today?.events.find((event) => event.type === "IN");
  const last = today?.events[today.events.length - 1];
  // The server's workedMinutes includes the open interval up to the fetch; extend it locally while punched in.
  const live = today ? today.workedMinutes + (today.state === "PUNCHED_IN" ? Math.floor((Date.now() - fetchedAt) / 60_000) : 0) : 0;
  void tick;
  return { today, busy, error, punch, reload: load, firstIn, last, workedMinutes: live };
}
