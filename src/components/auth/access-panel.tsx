"use client";
import "./native-auth.css";
import { AlertTriangle, Check, Loader2, Mail, ShieldOff, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { httpRequest, ApiRequestError } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Access = {
  employeeId: string; fullName: string; workEmail: string; status: string; role: string | null; userId: string | null;
  hasPassword: boolean; ssoLinked: boolean; mfaEnrolled: boolean; locked: boolean; lastSignInAt: string | null;
  invitedAt: string | null; inviteExpiresAt: string | null; access: "ACTIVE" | "INVITED" | "INVITE_EXPIRED" | "NO_LOGIN";
};
type Policy = { signInMethods: "PASSWORD" | "SSO" | "BOTH"; mfaRequiredAll: boolean; emailOtpFallback: boolean; sessionMaxHours: number; sessionIdleMinutes: number; updatedAt: string | null };
const when = (value: string | null) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const errorText = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");
const LABEL: Record<Access["access"], [string, string]> = { ACTIVE: ["Can sign in", ""], INVITED: ["Invite pending", "warn"], INVITE_EXPIRED: ["Invite expired", "bad"], NO_LOGIN: ["No login", "muted"] };

/** Inside the employee drawer: login status + invite / re-invite / revoke / reset MFA. Renders nothing for non-admins. */
export function EmployeeAccess({ employeeId }: { employeeId: string }) {
  const [data, setData] = useState<Access | null>(null);
  const [hidden, setHidden] = useState(false);
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => httpRequest<Access>(`/api/v2/account-access/employees/${employeeId}`).then(setData)
    .catch((reason) => { if (reason instanceof ApiRequestError && reason.status === 403) setHidden(true); else setError(errorText(reason)); }), [employeeId]);
  useEffect(() => { setData(null); setNotice(""); setError(""); void load(); }, [load]);
  const act = async (work: () => Promise<string>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(""); setNotice("");
    try { setNotice(await work()); await load(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  if (hidden) return null;
  const [label, tone] = data ? LABEL[data.access] : ["", ""];
  return (
    <section className="na-access" aria-label="Sign-in access">
      <h3>Sign-in access</h3>
      {!data ? !error && <p className="auth-progress"><Loader2 size={16} className="spin" /> Loading…</p> : (
        <>
          <p style={{ margin: 0 }}><span className={`na-badge ${tone}`} style={{ marginLeft: 0 }}>{label}</span>
            {data.mfaEnrolled && <span className="na-badge">2-step on</span>}{data.locked && <span className="na-badge bad">Locked</span>}
            <small style={{ display: "block", color: "var(--muted)", marginTop: 6 }}>
              {data.access === "ACTIVE" ? `Last sign-in ${when(data.lastSignInAt)}${data.ssoLinked ? " · SSO linked" : ""}` : data.access === "INVITED" ? `Invited ${when(data.invitedAt)} · link expires ${when(data.inviteExpiresAt)}` : data.access === "INVITE_EXPIRED" ? "The invitation link expired." : "This person hasn't been invited yet."}
            </small></p>
          <div className="na-row">
            {data.status === "ACTIVE" && !data.hasPassword && (
              <button className="cw-btn ghost" disabled={busy} onClick={() => act(async () => { const r = await httpRequest<{ email: string }>(`/api/v2/account-access/employees/${employeeId}/invite`, { method: "POST" }); return `Invitation sent to ${r.email}.`; })}>
                <Mail size={15} /> {data.access === "NO_LOGIN" ? "Send invite" : "Re-send invite"}</button>
            )}
            {data.access === "INVITED" && (
              <button className="cw-btn ghost" disabled={busy} onClick={() => act(async () => { await httpRequest(`/api/v2/account-access/employees/${employeeId}/invite`, { method: "DELETE" }); return "Invitation revoked — the link no longer works."; })}>
                <X size={15} /> Revoke invite</button>
            )}
            {data.mfaEnrolled && (
              <button className="cw-btn danger" disabled={busy} onClick={() => act(async () => { await httpRequest(`/api/v2/account-access/employees/${employeeId}/mfa-reset`, { method: "POST" }); return "Two-step verification reset. They'll set up a new authenticator at their next sign-in."; },
                `Reset two-step verification for ${data.fullName}? Their authenticator and recovery codes stop working and they're signed out everywhere. Only do this after verifying who's asking.`)}>
                <ShieldOff size={15} /> Reset MFA</button>
            )}
          </div>
        </>
      )}
      {notice && <p className="cw-alert ok" role="status"><Check size={15} /> {notice}</p>}
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
    </section>
  );
}

/** Register header button + drawer: login coverage, bulk invite and the brand sign-in policy. Hidden for non-admins. */
export function AccessInvitesButton() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { httpRequest("/api/v2/account-access/policy").then(() => setAllowed(true)).catch(() => setAllowed(false)); }, []);
  if (!allowed) return null;
  return (
    <>
      <button className="core-primary" type="button" onClick={() => setOpen(true)}><Users /> Access &amp; invites</button>
      {open && <AccessDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function AccessDrawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [summary, setSummary] = useState<{ summary: Record<string, number>; invitable: number } | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([httpRequest<{ summary: Record<string, number>; invitable: number }>("/api/v2/account-access/employees"), httpRequest<Policy>("/api/v2/account-access/policy")]);
      setSummary(list); setPolicy(current);
    } catch (reason) { setError(errorText(reason)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const bulk = async () => {
    if (!summary || !window.confirm(`Email an invitation to ${summary.invitable} active employee(s) who can't sign in yet?`)) return;
    setBusy(true); setError(""); setNotice("");
    try { const r = await httpRequest<{ invited: number; skipped: unknown[] }>("/api/v2/account-access/invites/bulk", { method: "POST" }); setNotice(`${r.invited} invitation(s) sent${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}.`); await load(); }
    catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!policy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { signInMethods, mfaRequiredAll, emailOtpFallback, sessionMaxHours, sessionIdleMinutes } = policy;
      setPolicy(await httpRequest<Policy>("/api/v2/account-access/policy", { method: "PATCH", body: { signInMethods, mfaRequiredAll, emailOtpFallback, sessionMaxHours: Number(sessionMaxHours), sessionIdleMinutes: Number(sessionIdleMinutes) } }));
      setNotice("Sign-in policy saved (audited).");
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const s = summary?.summary || {};
  return (
    <>
      <button className="flow-backdrop" onClick={onClose} aria-label="Close access and invites" />
      <aside className="record-drawer core-employee-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="access-title">
        <header className="drawer-header"><p className="eyebrow">ACCOUNTS</p><h2 id="access-title">Access &amp; invites</h2><p>Who can sign in, and how.</p>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><X /></button></header>
        <div className="drawer-body na-access-panel">
          {notice && <p className="cw-alert ok" role="status"><Check size={15} /> {notice}</p>}
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {!summary || !policy ? !error && <p className="auth-progress"><Loader2 size={16} className="spin" /> Loading…</p> : (
            <>
              <div className="na-summary">
                <span><b>{s.ACTIVE || 0}</b>Can sign in</span><span><b>{s.INVITED || 0}</b>Invite pending</span>
                <span><b>{s.INVITE_EXPIRED || 0}</b>Invite expired</span><span><b>{s.NO_LOGIN || 0}</b>No login</span>
              </div>
              <button className="core-primary" disabled={busy || !summary.invitable} onClick={bulk}>{busy ? <Loader2 className="spin" /> : <Mail />} Invite everyone without a login ({summary.invitable})</button>
              <form className="na-policy" onSubmit={save}>
                <h3 style={{ margin: "8px 0 0" }}>Sign-in policy</h3>
                <label>Sign-in methods
                  <select value={policy.signInMethods} onChange={(event) => setPolicy({ ...policy, signInMethods: event.target.value as Policy["signInMethods"] })}>
                    <option value="BOTH">Password and company SSO</option><option value="PASSWORD">Password only</option><option value="SSO">Company SSO only</option>
                  </select></label>
                <label className="na-check"><input type="checkbox" checked={policy.mfaRequiredAll} onChange={(event) => setPolicy({ ...policy, mfaRequiredAll: event.target.checked })} /> Require two-step verification for everyone (always on for owners, HR and payroll)</label>
                <label className="na-check"><input type="checkbox" checked={policy.emailOtpFallback} onChange={(event) => setPolicy({ ...policy, emailOtpFallback: event.target.checked })} /> Employees may use an emailed code instead of an authenticator app</label>
                <div className="na-grid2">
                  <label>Maximum session length (hours)<input type="number" min={1} max={720} value={policy.sessionMaxHours} onChange={(event) => setPolicy({ ...policy, sessionMaxHours: Number(event.target.value) })} /></label>
                  <label>Sign out after inactivity (minutes)<input type="number" min={5} max={720} value={policy.sessionIdleMinutes} onChange={(event) => setPolicy({ ...policy, sessionIdleMinutes: Number(event.target.value) })} /></label>
                </div>
                <small style={{ color: "var(--muted)" }}>Last changed {when(policy.updatedAt)}. Changes apply to new sign-ins.</small>
                <button className="core-primary" disabled={busy}><Check /> Save policy</button>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
