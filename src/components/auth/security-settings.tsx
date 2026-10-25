"use client";
import "./native-auth.css";
import { AlertTriangle, Check, KeyRound, Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "@/lib/auth";
import { httpRequest } from "@/lib/http-client";
import { PasswordField, PasswordRules, QrCode, RecoveryCodes } from "./native-auth";

type Overview = {
  email: string; fullName: string; hasPassword: boolean; passwordChangedAt: string | null; ssoLinked: boolean; authMethod?: string; currentSessionId: string | null;
  mfa: { required: boolean; devices: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[]; recoveryCodesRemaining: number };
  sessions: { id: string; client: string; device: string | null; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean; amr: string[] }[];
  events: { event: string; success: boolean; ip: string | null; createdAt: string }[];
};
const when = (value: string | null) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const EVENT_LABEL: Record<string, string> = {
  sign_in: "Signed in", sign_in_failed: "Failed sign-in", sign_in_locked: "Sign-in while locked", mfa_failed: "Wrong verification code", account_locked: "Account locked",
  account_unlocked: "Account unlocked", sign_out: "Signed out", sign_out_everywhere: "Signed out everywhere", password_changed: "Password changed", password_reset: "Password reset",
  password_reset_requested: "Password reset requested", mfa_enrolled: "Authenticator added", mfa_removed: "Authenticator removed", mfa_reset: "MFA reset by an admin",
  recovery_code_used: "Recovery code used", refresh_token_reuse: "Session revoked (token reuse)", invite_accepted: "Invitation accepted",
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export function SecuritySettings() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(() => httpRequest<Overview>("/api/v2/auth/security").then(setData).catch((reason) => setError(errorText(reason))), []);
  useEffect(() => { void load(); }, [load]);
  const done = (text: string) => { setNotice(text); setError(""); void load(); };

  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><ShieldCheck size={26} strokeWidth={1.7} /></span>
        <div><p className="cw-eyebrow">ACCOUNT</p><h1>My security</h1><p>Your password, two-step verification and the devices signed in to your account.</p></div>
      </header>
      <div className="na-page">
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        {notice && <p className="cw-alert ok" role="status"><Check size={15} /> {notice}</p>}
        {!data ? !error && <p className="auth-progress"><Loader2 size={18} className="spin" /> Loading…</p> : (
          <>
            {data.authMethod !== "local" && (
              <p className="cw-alert warn">{data.authMethod === "demo" ? "You're using a local demo identity." : "You signed in with company SSO."} Password and session settings apply to Northstar password sign-in.</p>
            )}
            <PasswordCard data={data} onDone={done} />
            <MfaCard data={data} onDone={done} />
            <SessionsCard data={data} onDone={done} onError={setError} />
            <section className="na-card" aria-labelledby="events-title">
              <header><div><h2 id="events-title">Recent activity</h2><p>Sign-ins and security changes on your account.</p></div></header>
              <ul className="na-list">
                {data.events.length ? data.events.map((event, index) => (
                  <li key={index}><span><b>{EVENT_LABEL[event.event] || event.event}</b>{!event.success && <span className="na-badge bad">failed</span>}<small>{when(event.createdAt)}{event.ip ? ` · ${event.ip}` : ""}</small></span></li>
                )) : <li><small>No activity yet.</small></li>}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function PasswordCard({ data, onDone }: { data: Overview; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState(""), [code, setCode] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const needsCode = data.mfa.devices.length > 0;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next !== confirm) { setError("The new passwords don't match."); return; }
    setBusy(true); setError("");
    try {
      const result = await httpRequest<{ otherSessionsRevoked: number }>("/api/v2/auth/password/change", { method: "POST", body: { currentPassword: current, newPassword: next, ...(needsCode ? { code } : {}) } });
      setOpen(false); setCurrent(""); setNext(""); setConfirm(""); setCode("");
      onDone(`Password changed. ${result.otherSessionsRevoked} other device(s) were signed out.`);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  return (
    <section className="na-card" aria-labelledby="password-title">
      <header>
        <div><h2 id="password-title"><KeyRound size={18} /> Password</h2>
          <p>{data.hasPassword ? `Last changed ${when(data.passwordChangedAt)}` : data.ssoLinked ? "You sign in with company SSO." : "No password set yet."}</p></div>
        {data.hasPassword && !open && <button className="cw-btn ghost" onClick={() => setOpen(true)}>Change password</button>}
      </header>
      {open && (
        <form className="na-form" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <input type="email" value={data.email} autoComplete="username" readOnly hidden />
          <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <div className="na-grid2">
            <PasswordField id="new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" describedBy="password-rules" />
            <PasswordField id="confirm-new-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </div>
          <PasswordRules password={next} email={data.email} name={data.fullName} />
          {needsCode && <label className="na-field na-code" htmlFor="change-code"><span>Code from your authenticator app</span>
            <input id="change-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>}
          <div className="na-row"><button type="button" className="cw-btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="cw-btn primary" disabled={busy || next.length < 12}>{busy && <Loader2 size={15} className="spin" />} Change password</button></div>
        </form>
      )}
    </section>
  );
}

function MfaCard({ data, onDone }: { data: Overview; onDone: (text: string) => void }) {
  const [stage, setStage] = useState<"idle" | "password" | "scan" | "codes" | "regen" | { remove: string }>("idle");
  const [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ deviceId: string; secret: string; otpauthUrl: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const reset = () => { setStage("idle"); setPassword(""); setCode(""); setSetup(null); setError(""); };
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(""); try { await work(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  const start = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    setSetup(await httpRequest("/api/v2/auth/mfa/totp", { method: "POST", body: data.hasPassword ? { currentPassword: password } : {} })); setPassword(""); setStage("scan");
  }); };
  const confirm = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    const result = await httpRequest<{ recoveryCodes?: string[] }>("/api/v2/auth/mfa/totp/confirm", { method: "POST", body: { deviceId: setup!.deviceId, code } });
    setCode(""); setSetup(null);
    if (result.recoveryCodes?.length) { setCodes(result.recoveryCodes); setStage("codes"); } else { reset(); onDone("Authenticator added."); }
  }); };
  const regen = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    const result = await httpRequest<{ recoveryCodes: string[] }>("/api/v2/auth/mfa/recovery-codes", { method: "POST", body: { code } }); setCode(""); setCodes(result.recoveryCodes); setStage("codes");
  }); };
  const remove = (event: React.FormEvent, id: string) => { event.preventDefault(); void run(async () => {
    await httpRequest(`/api/v2/auth/mfa/totp/${id}/remove`, { method: "POST", body: { ...(data.hasPassword ? { currentPassword: password } : {}), code } }); reset(); onDone("Authenticator removed.");
  }); };
  const devices = data.mfa.devices;
  return (
    <section className="na-card" aria-labelledby="mfa-title">
      <header>
        <div><h2 id="mfa-title"><Smartphone size={18} /> Two-step verification
          {devices.length ? <span className="na-badge">On</span> : data.mfa.required ? <span className="na-badge bad">Required</span> : <span className="na-badge muted">Off</span>}</h2>
          <p>{data.mfa.required ? "Your role requires an authenticator app." : "Recommended: a code from your phone keeps your account safe even if your password leaks."}</p></div>
        {stage === "idle" && devices.length < 3 && <button className="cw-btn ghost" onClick={() => setStage("password")}>{devices.length ? "Add another app" : "Set up authenticator"}</button>}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {devices.length > 0 && (
        <ul className="na-list">
          {devices.map((device) => (
            <li key={device.id}><span><b>{device.name}</b><small>Added {when(device.createdAt)} · last used {when(device.lastUsedAt)}</small></span>
              <button className="cw-btn danger" onClick={() => { reset(); setStage({ remove: device.id }); }} aria-label={`Remove ${device.name}`}><Trash2 size={15} /> Remove</button></li>
          ))}
          <li><span><b>Recovery codes</b><small>{data.mfa.recoveryCodesRemaining} of 10 unused</small></span>
            <button className="cw-btn ghost" onClick={() => { reset(); setStage("regen"); }}>Generate new codes</button></li>
        </ul>
      )}
      {stage === "password" && (
        <form className="na-form" onSubmit={start}>
          {data.hasPassword && <PasswordField id="mfa-password" label="Confirm your password" value={password} onChange={setPassword} autoComplete="current-password" />}
          <div className="na-row"><button type="button" className="cw-btn ghost" onClick={reset}>Cancel</button><button className="cw-btn primary" disabled={busy}>{busy && <Loader2 size={15} className="spin" />} Continue</button></div>
        </form>
      )}
      {stage === "scan" && setup && (
        <form className="na-step" onSubmit={confirm}>
          <div className="na-qr"><QrCode value={setup.otpauthUrl} label="QR code for your authenticator app" />
            <div className="na-secret">Scan with your authenticator app, or enter this key:<code>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></div></div>
          <label className="na-field na-code" htmlFor="setup-code"><span>6-digit code from the app</span>
            <input id="setup-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>
          <div className="na-row"><button type="button" className="cw-btn ghost" onClick={reset}>Cancel</button><button className="cw-btn primary" disabled={busy || code.length !== 6}>{busy && <Loader2 size={15} className="spin" />} Verify</button></div>
        </form>
      )}
      {stage === "codes" && <RecoveryCodes codes={codes} onDone={() => { setCodes([]); reset(); onDone("Two-step verification is set up. Keep your recovery codes safe."); }} doneLabel="Done" />}
      {stage === "regen" && (
        <form className="na-form" onSubmit={regen}>
          <p className="auth-lead">New codes replace all the old ones.</p>
          <label className="na-field na-code" htmlFor="regen-code"><span>Code from your authenticator app</span>
            <input id="regen-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>
          <div className="na-row"><button type="button" className="cw-btn ghost" onClick={reset}>Cancel</button><button className="cw-btn primary" disabled={busy || code.length !== 6}>Generate</button></div>
        </form>
      )}
      {typeof stage === "object" && (
        <form className="na-form" onSubmit={(event) => remove(event, stage.remove)}>
          {data.hasPassword && <PasswordField id="remove-password" label="Confirm your password" value={password} onChange={setPassword} autoComplete="current-password" />}
          <label className="na-field na-code" htmlFor="remove-code"><span>Code from your authenticator app</span>
            <input id="remove-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>
          <div className="na-row"><button type="button" className="cw-btn ghost" onClick={reset}>Cancel</button><button className="cw-btn danger" disabled={busy || code.length !== 6}>Remove authenticator</button></div>
        </form>
      )}
    </section>
  );
}

function SessionsCard({ data, onDone, onError }: { data: Overview; onDone: (text: string) => void; onError: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const revoke = async (id: string, current: boolean) => {
    setBusy(true);
    try { await httpRequest(`/api/v2/auth/sessions/${id}`, { method: "DELETE" }); if (current) { await signOut(); return; } onDone("Device signed out."); }
    catch (reason) { onError(errorText(reason)); } finally { setBusy(false); }
  };
  const everywhere = async () => {
    if (!window.confirm("Sign out of every device, including this one?")) return;
    setBusy(true);
    try { await httpRequest("/api/v2/auth/sessions/revoke-all", { method: "POST", body: {} }); await signOut(); } catch (reason) { onError(errorText(reason)); setBusy(false); }
  };
  return (
    <section className="na-card" aria-labelledby="sessions-title">
      <header><div><h2 id="sessions-title"><Laptop size={18} /> Signed-in devices</h2><p>Sessions end after a period of inactivity and at your company's maximum session length.</p></div>
        {data.sessions.length > 0 && <button className="cw-btn danger" onClick={everywhere} disabled={busy}><LogOut size={15} /> Sign out of all devices</button>}</header>
      <ul className="na-list">
        {data.sessions.length ? data.sessions.map((session) => (
          <li key={session.id}>
            <span><b>{session.device || (session.client === "mobile" ? "Mobile app" : "Browser")}</b>{session.current && <span className="na-badge">This device</span>}
              {session.amr.includes("mfa") && <span className="na-badge muted">2-step</span>}
              <small>{session.ip || "Unknown network"} · signed in {when(session.createdAt)} · last active {when(session.lastSeenAt)}</small></span>
            <button className="cw-btn ghost" onClick={() => revoke(session.id, session.current)} disabled={busy}>Sign out</button>
          </li>
        )) : <li><small>No password sessions. (SSO and demo sign-ins are managed by your identity provider.)</small></li>}
      </ul>
    </section>
  );
}
