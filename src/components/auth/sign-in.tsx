"use client";
import { AlertTriangle, ArrowRight, BarChart3, Building2, CalendarRange, KeyRound, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authConfig, beginSignIn, clearSession, completeSignIn, type AuthConfig } from "@/lib/auth";
import { platformApiUrl } from "@/lib/api";
import { brandUrl, hostBrand, mainUrl } from "@/lib/brand-host";

/** Same as mainUrl(), but resolved after mount so server and browser render the same HTML. */
function useMainUrl(path: string) {
  const [href, setHref] = useState(path);
  useEffect(() => setHref(mainUrl(path)), [path]);
  return href;
}
import { orgInitials, setDemoIdentity } from "@/lib/org";
import { safeReturnPath } from "@/lib/safe-return";
import { PasswordSignIn } from "./native-auth";
import { LegalLinks } from "@/components/privacy/legal-links";

type PublicBrand = { slug: string; displayName: string; shortName: string; brandColor: string; accentColor: string; logoDataUrl: string | null; industry: string | null };
type DemoPerson = { employeeNumber: string; fullName: string; designation: string | null; role: string };
const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Employee", MANAGER: "Manager", HR_ADMIN: "HR admin", PAYROLL_ADMIN: "Finance", OWNER: "Owner" };
export const LAST_BRAND_KEY = "hrm.last_brand";
const PENDING_BRAND_KEY = "hrm.pending_brand";

const store = (key: string, value: string | null) => { try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* ignore */ } };
const read = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const returnTarget = (fallback: string) =>
  safeReturnPath(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("returnTo") : null, fallback);

function ProductPanel() {
  return (
    <aside className="auth-brand">
      <div className="auth-logo"><span className="brand-mark"><i /><i /><i /></span><span>northstar<small>PEOPLE</small></span></div>
      <div>
        <h1>Every people process, one calm workspace.</h1>
        <p>Payroll, time, service desk, talent and analytics — built for teams that run on shifts and care about craft.</p>
      </div>
      <ul>
        <li><WalletCards size={17} /> India payroll with PF, ESI, PT and TDS</li>
        <li><CalendarRange size={17} /> Rosters, attendance and leave that talk to each other</li>
        <li><BarChart3 size={17} /> Live analytics with privacy thresholds</li>
        <li><ShieldCheck size={17} /> SSO, tenant isolation and a full audit trail</li>
      </ul>
    </aside>
  );
}

function BrandPanel({ brand }: { brand: PublicBrand }) {
  return (
    <aside className="auth-brand branded" style={{ ["--brand" as string]: brand.brandColor, ["--brand-accent" as string]: brand.accentColor }}>
      <div className="auth-logo">
        {brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="" className="auth-brand-logo" /> : <span className="auth-brand-initials">{orgInitials(brand.shortName)}</span>}
        <span>{brand.shortName}<small>PEOPLE WORKSPACE</small></span>
      </div>
      <div>
        <h1>Welcome to {brand.displayName}.</h1>
        <p>Your attendance, leave, payslips, requests and learning — all in one place.</p>
      </div>
      <p className="auth-powered">Powered by <b>northstar</b> people</p>
    </aside>
  );
}

/** /login — never lists brands. People open their brand's link, or type their workspace code. */
export function WorkspaceFinder() {
  const adminHref = useMainUrl("/admin/login");
  const [code, setCode] = useState("");
  const [last, setLast] = useState<PublicBrand | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const slug = read(LAST_BRAND_KEY);
    if (slug) fetch(platformApiUrl(`/api/v2/auth/brand/${slug}`)).then((response) => response.ok ? response.json() : null).then(setLast).catch(() => {});
  }, []);
  const go = async (event: React.FormEvent) => {
    event.preventDefault();
    const slug = code.trim().toLowerCase().replace(/^.*\/b\//, "").replace(/[^a-z0-9-]/g, "");
    if (!slug) return;
    setBusy(true); setError("");
    const response = await fetch(platformApiUrl(`/api/v2/auth/brand/${slug}`)).catch(() => null);
    if (!response?.ok) { setError("We couldn't find that workspace. Check the link your HR team shared."); setBusy(false); return; }
    window.location.assign(`${brandUrl(slug)}${window.location.search}`);
  };
  return (
    <div className="auth-page">
      <ProductPanel />
      <main className="auth-card" aria-labelledby="auth-title">
        <p className="cw-eyebrow" style={{ color: "var(--teal)" }}>SIGN IN</p>
        <h2 id="auth-title">Find your workspace</h2>
        <p className="auth-lead">Use the sign-in link your company shared, or enter your workspace code.</p>
        {last && (
          <a className="auth-last" href={brandUrl(last.slug)} style={{ ["--brand" as string]: last.brandColor }}>
            {last.logoDataUrl ? <img src={last.logoDataUrl} alt="" /> : <span>{orgInitials(last.shortName)}</span>}
            <span><small>Continue to</small><b>{last.displayName}</b></span><ArrowRight size={16} />
          </a>
        )}
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        <form className="auth-finder" onSubmit={go}>
          <label htmlFor="workspace-code">Workspace code</label>
          <div><input id="workspace-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. got-tea" autoComplete="organization" autoCapitalize="none" required />
            <button className="cw-btn primary" style={{ ["--accent" as string]: "#0b615c" }} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Continue</button></div>
        </form>
        <p className="auth-note"><a href={adminHref}><Building2 size={13} /> Platform administrator sign-in</a></p>
        <LegalLinks />
      </main>
    </div>
  );
}

/** "Forgot password?" stays on the brand's own address (or carries ?brand= on the main domain). */
function useForgotHref(slug: string) {
  const [href, setHref] = useState(`/forgot-password?brand=${slug}`);
  useEffect(() => setHref(hostBrand() ? "/forgot-password" : `/forgot-password?brand=${slug}`), [slug]);
  return href;
}

/** /b/:slug — a brand's own sign-in page, themed and listing only that brand. */
export function BrandSignIn({ slug }: { slug: string }) {
  const [brand, setBrand] = useState<PublicBrand | null>(null);
  const [missing, setMissing] = useState(false);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [policy, setPolicy] = useState<{ password: boolean; sso: boolean } | null>(null);
  const [people, setPeople] = useState<DemoPerson[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const forgotHref = useForgotHref(slug);
  useEffect(() => {
    fetch(platformApiUrl(`/api/v2/auth/policy?brand=${encodeURIComponent(slug)}`)).then((response) => (response.ok ? response.json() : null))
      .then((value) => setPolicy(value || { password: true, sso: true })).catch(() => setPolicy({ password: true, sso: true }));
    fetch(platformApiUrl(`/api/v2/auth/brand/${slug}`)).then((response) => response.ok ? response.json() : Promise.reject())
      .then((value: PublicBrand) => { setBrand(value); document.title = `Sign in — ${value.shortName}`; }).catch(() => setMissing(true));
    authConfig().then(setConfig).catch((reason) => setError(reason.message));
  }, [slug]);
  useEffect(() => {
    if (!config?.demoIdentity) return;
    fetch(platformApiUrl(`/api/v2/auth/demo-identities?slug=${slug}`)).then((response) => response.json())
      .then((data: { organizations: { people: DemoPerson[] }[] }) => setPeople(data.organizations[0]?.people || [])).catch(() => {});
  }, [config?.demoIdentity, slug]);
  if (missing) return <WorkspaceFinder />;
  if (!brand) return <div className="auth-page"><ProductPanel /><main className="auth-card"><div className="cw-list-skeleton"><i /><i /></div></main></div>;
  const sso = async () => {
    setBusy(true); setError("");
    store(PENDING_BRAND_KEY, slug); store(LAST_BRAND_KEY, slug);
    try { await beginSignIn(returnTarget("/")); } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign-in failed."); setBusy(false); }
  };
  const demo = (employeeNumber: string) => {
    clearSession(); store("hrm.org_id", null); store(LAST_BRAND_KEY, slug);
    setDemoIdentity(slug, employeeNumber);
    window.location.assign(returnTarget("/"));
  };
  return (
    <div className="auth-page">
      <BrandPanel brand={brand} />
      <main className="auth-card" aria-labelledby="auth-title" style={{ ["--accent" as string]: brand.brandColor }}>
        <p className="cw-eyebrow" style={{ color: brand.brandColor }}>{brand.shortName.toUpperCase()}</p>
        <h2 id="auth-title">Sign in</h2>
        <p className="auth-lead">Use your {brand.shortName} work email and password. New here? Use the invitation link HR emailed you.</p>
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        {policy?.password !== false && <PasswordSignIn brand={slug} forgotHref={forgotHref} />}
        {config?.oidc && policy?.sso && (
          <>
            {policy.password && <div className="auth-divider"><span>or</span></div>}
            <button className={`cw-btn ${policy.password ? "ghost" : "primary"} lg auth-sso`} onClick={sso} disabled={busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />} Continue with company SSO <ArrowRight size={16} />
            </button>
          </>
        )}
        {config?.demoIdentity && people.length > 0 && (
          <section className="auth-demo">
            <div className="auth-divider"><span>or try the demo as</span></div>
            <div className="auth-people">
              {people.map((person) => (
                <button key={person.employeeNumber} onClick={() => demo(person.employeeNumber)}>
                  <span className="cw-avatar small" style={{ background: brand.brandColor }}>{person.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <span><b>{person.fullName}</b><small>{ROLE_LABEL[person.role] || person.role}{person.designation ? ` · ${person.designation}` : ""}</small></span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
            <p className="auth-note">Demo identities are for local evaluation only and are disabled in production.</p>
          </section>
        )}
        <p className="auth-note"><a href={mainUrl("/login")}>Not {brand.shortName}? Find your workspace</a></p>
        <LegalLinks />
      </main>
    </div>
  );
}

/** /admin/login — platform (super admin) sign-in, outside any brand. */
export function AdminSignIn() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [admins, setAdmins] = useState<{ email: string; fullName: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { authConfig().then(setConfig).catch((reason) => setError(reason.message)); }, []);
  useEffect(() => {
    if (!config?.demoIdentity) return;
    fetch(platformApiUrl("/api/v2/auth/demo-platform-admins")).then((response) => response.json()).then((data) => setAdmins(data.items || [])).catch(() => {});
  }, [config?.demoIdentity]);
  const sso = async () => {
    setBusy(true); setError(""); store(PENDING_BRAND_KEY, "platform");
    try { await beginSignIn("/admin"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign-in failed."); setBusy(false); }
  };
  const demo = (email: string) => { clearSession(); store("hrm.org_id", null); setDemoIdentity("platform", email); window.location.assign("/admin"); };
  return (
    <div className="auth-page">
      <aside className="auth-brand admin">
        <div className="auth-logo"><span className="brand-mark"><i /><i /><i /></span><span>northstar<small>PLATFORM</small></span></div>
        <div><h1>Platform administration.</h1><p>Add brands, set their modules and branding, and manage who runs each one. Brand data stays inside each brand.</p></div>
        <ul><li><ShieldCheck size={17} /> Every action is audited</li><li><Building2 size={17} /> Each brand is a fully isolated organization</li></ul>
      </aside>
      <main className="auth-card" aria-labelledby="auth-title">
        <p className="cw-eyebrow" style={{ color: "var(--teal)" }}>SUPER ADMIN</p>
        <h2 id="auth-title">Platform sign-in</h2>
        <p className="auth-lead">For Northstar platform administrators only. Two-step verification is always required. Employees should use their brand's sign-in link.</p>
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        <div style={{ ["--accent" as string]: "#132c38" }}><PasswordSignIn brand="platform" forgotHref="/forgot-password?admin=1" /></div>
        {config?.oidc && (
          <button className="cw-btn ghost lg auth-sso" onClick={sso} disabled={busy}>
            {busy ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />} Continue with single sign-on <ArrowRight size={16} />
          </button>
        )}
        {config?.demoIdentity && admins.length > 0 && (
          <section className="auth-demo">
            <div className="auth-divider"><span>demo administrators</span></div>
            <div className="auth-people">
              {admins.map((admin) => (
                <button key={admin.email} onClick={() => demo(admin.email)}>
                  <span className="cw-avatar small">{admin.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <span><b>{admin.fullName}</b><small>{admin.email}</small></span><ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>
        )}
        <p className="auth-note"><Link href="/login">← Employee sign-in</Link></p>
        <LegalLinks />
      </main>
    </div>
  );
}

/** Completes SSO, then selects the brand the person started from (or the platform console). */
export function AuthCallback() {
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      const returnTo = await completeSignIn(new URLSearchParams(window.location.search));
      const pending = read(PENDING_BRAND_KEY);
      store(PENDING_BRAND_KEY, null);
      if (pending === "platform") { store("hrm.org_id", "platform"); window.location.replace("/admin"); return; }
      if (pending) {
        const token = window.sessionStorage.getItem("hrm.access_token");
        const response = await fetch(platformApiUrl("/api/v2/orgs/mine"), { headers: { authorization: `Bearer ${token}` } });
        const mine = response.ok ? await response.json() as { organizations: { id: string; slug: string; displayName: string }[] } : { organizations: [] };
        const match = mine.organizations.find((org) => org.slug === pending);
        if (!match) { clearSession(); throw new Error("Your account isn't part of this workspace. Check the sign-in link, or ask HR to invite you."); }
        store("hrm.org_id", match.id); store("hrm.org_slug", match.slug);
      }
      window.location.replace(safeReturnPath(returnTo, "/"));
    })().catch((reason) => setError(reason instanceof Error ? reason.message : "Sign-in failed."));
  }, []);
  return (
    <div className="auth-page">
      <ProductPanel />
      <main className="auth-card">
        {!error ? <p className="auth-progress"><Loader2 size={20} className="spin" /> Signing you in…</p> : (
          <>
            <h2>We couldn’t sign you in</h2>
            <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>
            <a className="cw-btn primary" style={{ ["--accent" as string]: "#0b615c" }} href={hostBrand() || !read(LAST_BRAND_KEY) ? "/login" : brandUrl(read(LAST_BRAND_KEY)!)}>Try again</a>
          </>
        )}
      </main>
    </div>
  );
}

/** Kept for existing imports: /login renders the workspace finder. */
export const SignInPage = WorkspaceFinder;
