"use client";
import "./native-auth.css";
import { AlertTriangle, ArrowRight, Check, Copy, KeyRound, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthError, nativeAuth, storeNativeSession, type NativeResult } from "@/lib/auth";
import { platformApiUrl } from "@/lib/api";
import { brandUrl, hostBrand, mainUrl } from "@/lib/brand-host";
import { orgInitials } from "@/lib/org";
import { encodeQr, qrPath } from "@/lib/qr";
import { safeReturnPath } from "@/lib/safe-return";

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Please try again.");

// ---- small building blocks ------------------------------------------------------------------------------------------------

export function PasswordField({ id, label, value, onChange, autoComplete, extra, describedBy }: {
  id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; extra?: React.ReactNode; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="na-field" htmlFor={id}>
      <span>{label}{extra}</span>
      <div className="na-password">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required maxLength={256} aria-describedby={describedBy} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
      </div>
    </label>
  );
}

/** Live hints that mirror the server policy (the server is the authority). */
export function PasswordRules({ password, email, name }: { password: string; email?: string; name?: string }) {
  const personal = [...(email ? email.split("@")[0].split(/[._+-]/) : []), ...(name ? name.split(/\s+/) : [])].map((word) => word.toLowerCase()).filter((word) => word.length >= 3);
  const rules = [
    { ok: password.length >= 12, text: "At least 12 characters" },
    { ok: password.length > 0 && !personal.some((word) => password.toLowerCase().includes(word)), text: "Doesn't contain your name or email" },
    { ok: new Set(password.toLowerCase()).size >= 5, text: "Not repetitive" },
  ];
  return (
    <ul className="na-rules" id="password-rules" aria-live="polite">
      {rules.map((rule) => <li key={rule.text} className={rule.ok ? "ok" : ""}>{rule.ok ? <Check size={13} /> : <span aria-hidden>•</span>} {rule.text}</li>)}
      <li>Common passwords are refused — a phrase of unrelated words works well.</li>
    </ul>
  );
}

export function QrCode({ value, label }: { value: string; label: string }) {
  const path = useMemo(() => { try { const modules = encodeQr(value); return { d: qrPath(modules), size: modules.length + 8 }; } catch { return null; } }, [value]);
  if (!path) return null;
  return <svg viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff" /><path d={path.d} fill="#111" /></svg>;
}

export function RecoveryCodes({ codes, onDone, doneLabel = "I've saved these codes" }: { codes: string[]; onDone?: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Northstar recovery codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "northstar-recovery-codes.txt" });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <div className="na-step">
      <h3>Save your recovery codes</h3>
      <p>If you lose your phone, each of these codes lets you sign in once. They're shown only now — store them somewhere safe, like a password manager.</p>
      <ul className="na-codes" aria-label="Recovery codes">{codes.map((code) => <li key={code}>{code}</li>)}</ul>
      <div className="na-row">
        <button type="button" className="cw-btn ghost" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }}><Copy size={15} /> {copied ? "Copied" : "Copy"}</button>
        <button type="button" className="cw-btn ghost" onClick={download}>Download .txt</button>
      </div>
      {onDone && <button type="button" className="cw-btn primary lg na-submit" onClick={onDone}>{doneLabel} <ArrowRight size={16} /></button>}
    </div>
  );
}

function CodeInput({ id, label, value, onChange, recovery = false }: { id: string; label: string; value: string; onChange: (value: string) => void; recovery?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, [recovery]);
  return (
    <label className={`na-field ${recovery ? "" : "na-code"}`} htmlFor={id}>
      <span>{label}</span>
      <input ref={ref} id={id} value={value} onChange={(event) => onChange(recovery ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode={recovery ? "text" : "numeric"} autoComplete="one-time-code" pattern={recovery ? undefined : "\\d{6}"} maxLength={recovery ? 24 : 6} required
        placeholder={recovery ? "XXXX-XXXX-XXXX-XXXX" : "123456"} autoCapitalize="characters" spellCheck={false} />
    </label>
  );
}

// ---- second factor ----------------------------------------------------------------------------------------------------------

/** Handles every non-OK sign-in status: verify a code, or enrol an authenticator (with QR) and show recovery codes. */
export function SecondFactor({ result, onSession, onRestart }: { result: NativeResult; onSession: (result: NativeResult) => void; onRestart: () => void }) {
  const [current, setCurrent] = useState(result);
  const methods = current.methods || [];
  const [method, setMethod] = useState<"totp" | "recovery" | "email">(methods.includes("totp") ? "totp" : methods[0] || "totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState("");
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauthUrl: string; account: string } | null>(null);
  const [codes, setCodes] = useState<{ codes: string[]; session: NativeResult } | null>(null);
  const enrolling = current.status === "MFA_ENROLL_REQUIRED" || current.status === "MFA_ENROLL_OPTIONAL";

  useEffect(() => {
    if (!enrolling || enrolment || !current.challenge) return;
    nativeAuth.enrollStart(current.challenge).then(setEnrolment).catch((reason) => setError(message(reason)));
  }, [enrolling, enrolment, current.challenge]);

  const fail = (reason: unknown) => {
    if (reason instanceof AuthError && (reason.code === "CHALLENGE_EXPIRED" || reason.code === "ACCOUNT_LOCKED")) { setError(reason.message); setTimeout(onRestart, 2500); return; }
    setError(message(reason)); setCode("");
  };
  const next = (value: NativeResult) => { if (value.status === "OK") onSession(value); else { setCurrent(value); setEnrolment(null); setCode(""); setMethod(value.methods?.includes("totp") ? "totp" : value.methods?.[0] || "totp"); } };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { next(await nativeAuth.verify(current.challenge!, method, code)); } catch (reason) { fail(reason); } finally { setBusy(false); }
  };
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const value = await nativeAuth.enrollConfirm(current.challenge!, code);
      if (value.recoveryCodes?.length) setCodes({ codes: value.recoveryCodes, session: value }); else next(value);
    } catch (reason) { fail(reason); } finally { setBusy(false); }
  };
  const skip = async () => { setBusy(true); setError(""); try { next(await nativeAuth.enrollSkip(current.challenge!)); } catch (reason) { fail(reason); } finally { setBusy(false); } };
  const sendEmail = async () => {
    setBusy(true); setError("");
    try { const sent = await nativeAuth.sendEmailCode(current.challenge!); setEmailSent(sent.email); setMethod("email"); } catch (reason) { fail(reason); } finally { setBusy(false); }
  };

  if (codes) return <RecoveryCodes codes={codes.codes} onDone={() => onSession(codes.session)} doneLabel="I've saved these — continue" />;

  if (enrolling) return (
    <form className="na-step" onSubmit={confirm}>
      <h3><ShieldCheck size={18} aria-hidden /> Set up two-step verification</h3>
      <p>{current.status === "MFA_ENROLL_REQUIRED" ? "Your role requires an authenticator app." : "Protect your account with an authenticator app (recommended)."} Scan the code with Google Authenticator, Microsoft Authenticator, 1Password or similar, then enter the 6-digit code it shows.</p>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!enrolment ? <p className="auth-progress"><Loader2 size={18} className="spin" /> Preparing…</p> : (
        <div className="na-qr">
          <QrCode value={enrolment.otpauthUrl} label="QR code for your authenticator app" />
          <div className="na-secret">Can't scan? Enter this key manually:<code>{enrolment.secret.match(/.{1,4}/g)?.join(" ")}</code>
            <a href={enrolment.otpauthUrl} className="na-link"><Smartphone size={13} /> Open in an authenticator on this device</a></div>
        </div>
      )}
      <CodeInput id="enrol-code" label="6-digit code from the app" value={code} onChange={setCode} />
      <button className="cw-btn primary lg na-submit" disabled={busy || code.length !== 6 || !enrolment}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Verify and continue</button>
      {current.status === "MFA_ENROLL_OPTIONAL" && <button type="button" className="na-link" onClick={skip} disabled={busy}>Not now</button>}
    </form>
  );

  return (
    <form className="na-step" onSubmit={verify}>
      <h3><ShieldCheck size={18} aria-hidden /> Two-step verification</h3>
      {methods.length > 1 && (
        <div className="na-methods" role="group" aria-label="Verification method">
          {methods.includes("totp") && <button type="button" aria-pressed={method === "totp"} onClick={() => { setMethod("totp"); setCode(""); }}>Authenticator app</button>}
          {methods.includes("email") && <button type="button" aria-pressed={method === "email"} onClick={() => { setMethod("email"); setCode(""); }}>Email code</button>}
          {methods.includes("recovery") && <button type="button" aria-pressed={method === "recovery"} onClick={() => { setMethod("recovery"); setCode(""); }}>Recovery code</button>}
        </div>
      )}
      <p>{method === "totp" ? "Enter the 6-digit code from your authenticator app." : method === "recovery" ? "Enter one of your saved recovery codes. Each works once."
        : emailSent ? `We sent a 6-digit code to ${emailSent}. It expires in 10 minutes.` : `We'll email a 6-digit code to ${current.email || "your work email"}.`}</p>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {method === "email" && !emailSent ? (
        <button type="button" className="cw-btn primary lg na-submit" onClick={sendEmail} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} Email me a code</button>
      ) : (
        <>
          <CodeInput id="mfa-code" label={method === "recovery" ? "Recovery code" : "Verification code"} value={code} onChange={setCode} recovery={method === "recovery"} />
          <button className="cw-btn primary lg na-submit" disabled={busy || (method !== "recovery" && code.length !== 6) || (method === "recovery" && code.replace(/[^A-Z2-7]/g, "").length < 16)}>
            {busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} Verify
          </button>
          {method === "email" && <button type="button" className="na-link" onClick={sendEmail} disabled={busy}>Send a new code</button>}
        </>
      )}
      <button type="button" className="na-link" onClick={onRestart}>Use a different account</button>
    </form>
  );
}

// ---- password sign-in -------------------------------------------------------------------------------------------------------

/** Where a finished sign-in goes: brand workspace (selected exactly like SSO), or the platform console. */
export function completeNativeSignIn(result: NativeResult, fallback = "/") {
  storeNativeSession(result);
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get("returnTo"), fallback);
  window.location.assign(result.platform ? "/admin" : returnTo);
}

export function PasswordSignIn({ brand, forgotHref, submitLabel = "Sign in" }: { brand: string; forgotHref: string; submitLabel?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<NativeResult | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await nativeAuth.login(email.trim(), password, brand);
      setPassword("");
      if (result.status === "OK") completeNativeSignIn(result, brand === "platform" ? "/admin" : "/"); else setPending(result);
    } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  if (pending) return <SecondFactor result={pending} onSession={(result) => completeNativeSignIn(result, brand === "platform" ? "/admin" : "/")} onRestart={() => { setPending(null); setError(""); }} />;
  return (
    <form className="na-form" onSubmit={submit} noValidate={false}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <label className="na-field" htmlFor="signin-email"><span>Work email</span>
        <input id="signin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required maxLength={254} autoCapitalize="none" spellCheck={false} />
      </label>
      <PasswordField id="signin-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" extra={<a href={forgotHref}>Forgot password?</a>} />
      <button className="cw-btn primary lg na-submit" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} {submitLabel}</button>
    </form>
  );
}

// ---- page frame for activation / reset (brand-themed on a brand address) -----------------------------------------------------

type PublicBrand = { slug: string; displayName: string; shortName: string; brandColor: string; accentColor: string; logoDataUrl: string | null };

function useBrand() {
  const [brand, setBrand] = useState<PublicBrand | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    const value = hostBrand() || new URLSearchParams(window.location.search).get("brand");
    const clean = value && /^[a-z0-9-]{1,40}$/.test(value) && value !== "platform" ? value : null;
    setSlug(clean);
    if (clean) fetch(platformApiUrl(`/api/v2/auth/brand/${clean}`)).then((response) => (response.ok ? response.json() : null)).then(setBrand).catch(() => {});
  }, []);
  return { brand, slug };
}

function AuthFrame({ eyebrow, title, lead, brand, children }: { eyebrow: string; title: string; lead?: string; brand: PublicBrand | null; children: React.ReactNode }) {
  const accent = brand?.brandColor || "#0b615c";
  return (
    <div className="auth-page">
      <aside className={`auth-brand ${brand ? "branded" : ""}`} style={brand ? { ["--brand" as string]: brand.brandColor, ["--brand-accent" as string]: brand.accentColor } : undefined}>
        <div className="auth-logo">
          {brand ? (brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="" className="auth-brand-logo" /> : <span className="auth-brand-initials">{orgInitials(brand.shortName)}</span>)
            : <span className="brand-mark"><i /><i /><i /></span>}
          <span>{brand ? brand.shortName : "northstar"}<small>{brand ? "PEOPLE WORKSPACE" : "PEOPLE"}</small></span>
        </div>
        <div><h1>{brand ? `${brand.displayName}` : "Your account, secured."}</h1><p>Passwords are hashed with scrypt, sign-ins are protected by two-step verification, and every security change is audited.</p></div>
        {brand && <p className="auth-powered">Powered by <b>northstar</b> people</p>}
      </aside>
      <main className="auth-card" aria-labelledby="auth-title" style={{ ["--accent" as string]: accent }}>
        <p className="cw-eyebrow" style={{ color: accent }}>{eyebrow}</p>
        <h2 id="auth-title">{title}</h2>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </main>
    </div>
  );
}

/** Reads a one-time token from the URL once, then removes it from the address bar and history. */
function useUrlToken(name: string) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    setToken(value);
    if (value) { params.delete(name); window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`); }
  }, [name]);
  return token;
}

const signInHref = (slug: string | null, admin = false) => (admin ? mainUrl("/admin/login") : slug ? (hostBrand() ? "/login" : brandUrl(slug)) : "/login");

// ---- /activate ---------------------------------------------------------------------------------------------------------------

export function ActivatePage() {
  const { brand } = useBrand();
  const token = useUrlToken("token");
  const [invite, setInvite] = useState<{ email: string; fullName: string; workspace: { slug: string; name: string } } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<NativeResult | null>(null);
  useEffect(() => {
    if (token === undefined) return;
    if (!token) { setError("This page needs the link from your invitation email."); return; }
    nativeAuth.inspectInvite(token).then(setInvite).catch((reason) => setError(message(reason)));
  }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    try {
      const result = await nativeAuth.activate(token!, password);
      setPassword(""); setConfirm("");
      if (result.status === "OK") completeNativeSignIn(result); else setPending(result);
    } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  const platform = invite?.workspace.slug === "platform";
  return (
    <AuthFrame brand={brand} eyebrow="ACCOUNT SETUP" title={invite ? `Welcome, ${invite.fullName.split(" ")[0]}` : "Set up your account"}
      lead={invite ? `Create a password for ${invite.email} to join ${invite.workspace.name}.` : undefined}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {pending ? <SecondFactor result={pending} onSession={(result) => completeNativeSignIn(result, platform ? "/admin" : "/")} onRestart={() => window.location.assign(signInHref(invite?.workspace.slug || null, platform))} />
        : invite ? (
          <form className="na-form" onSubmit={submit}>
            <input type="email" value={invite.email} autoComplete="username" readOnly hidden />
            <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" describedBy="password-rules" />
            <PasswordRules password={password} email={invite.email} name={invite.fullName} />
            <PasswordField id="confirm-password" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <button className="cw-btn primary lg na-submit" disabled={busy || password.length < 12}>{busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Create password</button>
          </form>
        ) : !error && <p className="auth-progress"><Loader2 size={18} className="spin" /> Checking your invitation…</p>}
      {error && !invite && <p className="auth-note"><a href={signInHref(brand?.slug || null)}>Go to sign-in</a></p>}
    </AuthFrame>
  );
}

// ---- /forgot-password ----------------------------------------------------------------------------------------------------------

export function ForgotPasswordPage() {
  const { brand, slug } = useBrand();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { setDone((await nativeAuth.forgot(email.trim(), admin ? "platform" : slug || undefined)).message); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  return (
    <AuthFrame brand={brand} eyebrow="PASSWORD HELP" title="Reset your password" lead={done ? undefined : "Enter your work email and we'll send you a link to choose a new password."}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {done ? <p className="cw-alert ok" role="status"><Mail size={15} /> {done}</p> : (
        <form className="na-form" onSubmit={submit}>
          <label className="na-field" htmlFor="forgot-email"><span>Work email</span>
            <input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required maxLength={254} autoCapitalize="none" spellCheck={false} />
          </label>
          <button className="cw-btn primary lg na-submit" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} Send reset link</button>
        </form>
      )}
      <p className="auth-note"><a href={signInHref(slug, admin)}>← Back to sign-in</a></p>
    </AuthFrame>
  );
}

// ---- /reset-password (also handles ?unlock=) ------------------------------------------------------------------------------------

export function ResetPasswordPage() {
  const { brand, slug } = useBrand();
  const token = useUrlToken("token");
  const unlockToken = useUrlToken("unlock");
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"form" | "done" | "unlocked" | "unlocking">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAdmin(new URLSearchParams(window.location.search).get("admin") === "1"); }, []);
  useEffect(() => {
    if (!unlockToken) return;
    setState("unlocking");
    nativeAuth.unlock(unlockToken).then(() => setState("unlocked")).catch((reason) => { setError(message(reason)); setState("form"); });
  }, [unlockToken]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    try { await nativeAuth.reset(token!, password); setPassword(""); setConfirm(""); setState("done"); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  };
  const missing = token === null && unlockToken === null;
  return (
    <AuthFrame brand={brand} eyebrow={unlockToken ? "ACCOUNT UNLOCK" : "PASSWORD RESET"} title={state === "unlocked" ? "Your account is unlocked" : state === "done" ? "Password changed" : unlockToken ? "Unlocking your account" : "Choose a new password"}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {state === "unlocking" && <p className="auth-progress"><Loader2 size={18} className="spin" /> Unlocking…</p>}
      {state === "unlocked" && <><p className="cw-alert ok" role="status"><Check size={15} /> You can sign in again. If the failed attempts weren't you, reset your password now.</p>
        <a className="cw-btn primary lg na-submit" href={signInHref(slug, admin)}>Sign in <ArrowRight size={16} /></a>
        <a className="na-link" href={`/forgot-password${admin ? "?admin=1" : slug && !hostBrand() ? `?brand=${slug}` : ""}`}>Reset my password</a></>}
      {state === "done" && <><p className="cw-alert ok" role="status"><Check size={15} /> Your password was changed and you were signed out on every device.</p>
        <a className="cw-btn primary lg na-submit" href={signInHref(slug, admin)}>Sign in <ArrowRight size={16} /></a></>}
      {state === "form" && token && (
        <form className="na-form" onSubmit={submit}>
          <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" describedBy="password-rules" />
          <PasswordRules password={password} />
          <PasswordField id="reset-confirm" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <button className="cw-btn primary lg na-submit" disabled={busy || password.length < 12}>{busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} Change password</button>
        </form>
      )}
      {missing && <p className="cw-alert warn">Open the link from your email to continue. <a href={`/forgot-password${slug && !hostBrand() ? `?brand=${slug}` : ""}`}>Request a new link</a></p>}
    </AuthFrame>
  );
}
