"use client";
import { AlertTriangle, Check, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { httpRequest } from "@/lib/http-client";

/** Super admin: invite another platform administrator. The invitee sets a password and must enrol 2-step verification. */
export function AdminInvite() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setDone("");
    try {
      const result = await httpRequest<{ granted?: boolean; invited?: boolean }>("/api/v2/platform/auth/admin-invites", { method: "POST", body: { fullName: form.fullName.trim(), email: form.email.trim() } });
      setDone(result.granted
        ? `${form.email.trim()} already had an account and is now a platform administrator. They'll be asked to set up 2-step verification at their next sign-in.`
        : `Invitation sent to ${form.email.trim()}. The link is valid for 72 hours; they must set up 2-step verification on first sign-in.`);
      setForm({ fullName: "", email: "" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't send the invitation."); }
    finally { setBusy(false); }
  };
  return (
    <div className="cw-page" style={{ paddingBottom: 0 }}>
      <section className="cc-bar" aria-label="Platform administrators">
        <p><b>Platform administrators</b> can create and change every brand. Keep this list short — every invite is audited and reviewed in the quarterly access review.</p>
        {!open && <button className="cw-btn ghost" onClick={() => setOpen(true)}><UserPlus size={15} /> Invite an administrator</button>}
      </section>
      {open && (
        <form className="cw-fields" onSubmit={submit} style={{ marginBottom: 16 }}>
          {error && <p className="cw-alert wide" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {done && <p className="cw-alert ok wide" role="status"><Check size={15} /> {done}</p>}
          <label><span>Full name</span><input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
          <label><span>Work email</span><input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <div className="cw-action-row wide">
            <button type="button" className="cw-btn ghost" onClick={() => { setOpen(false); setError(""); setDone(""); }}>Close</button>
            <button className="cw-btn primary" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} Send invitation</button>
          </div>
        </form>
      )}
    </div>
  );
}
