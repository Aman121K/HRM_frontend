"use client";
import { AlertTriangle, ArrowRight, Building2, Check, Copy, Link as LinkIcon, Pencil, Plus, Power, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { loadMyOrgs, switchOrganization, type OrgSummary } from "@/lib/org";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { APP_DOMAIN, brandUrl } from "@/lib/brand-host";
import { OrgMark } from "@/components/sidebar-nav";

type PlatformOrg = OrgSummary & { headcount: number; members: number; groupName: string | null };
type Listing = { items: PlatformOrg[]; groups: { id: string; name: string; slug: string }[]; modules: string[] };

export const MODULE_LABELS: Record<string, string> = {
  core: "Core HR", attendance: "Attendance", leave: "Leave", roster: "Roster & shifts", payroll: "Payroll", expenses: "Expenses & OCR", travel: "Travel",
  helpdesk: "Helpdesk", letters: "Letters", assets: "Assets", exit: "Exit", learning: "Learning (LMS)", performance: "Performance / KPI",
  recruitment: "Recruitment", onboarding: "Onboarding", engagement: "Surveys & polls", recognition: "Recognition", reports: "Analytics", integrations: "Integrations",
};
const STATES = [["KA", "Karnataka"], ["MH", "Maharashtra"], ["TN", "Tamil Nadu"], ["TS", "Telangana"], ["AP", "Andhra Pradesh"], ["WB", "West Bengal"], ["GJ", "Gujarat"], ["DL", "Delhi"], ["HR", "Haryana"], ["KL", "Kerala"], ["UP", "Uttar Pradesh"], ["RJ", "Rajasthan"], ["PB", "Punjab"], ["GA", "Goa"], ["OTHER", "Other"]];
const slugify = (value: string) => value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function readLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { reject(new Error("Use a PNG, JPG or WebP logo (SVG is not supported).")); return; }
    if (file.size > 140 * 1024) { reject(new Error("Logo must be under 140 KB.")); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the logo."));
    reader.readAsDataURL(file);
  });
}

export function PlatformConsole() {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlatformOrg | null>(null);
  const [brandEdit, setBrandEdit] = useState<PlatformOrg | null>(null);
  const [toast, setToast] = useState("");
  const [memberships, setMemberships] = useState<Map<string, OrgSummary>>(new Map());
  useEffect(() => { loadMyOrgs().then((mine) => setMemberships(new Map(mine.organizations.map((org) => [org.id, org])))).catch(() => {}); }, []);
  const load = useCallback(() => httpRequest<Listing>("/api/v2/platform/orgs").then(setData).catch((reason) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 4000); };
  const toggleStatus = async (org: PlatformOrg) => {
    const status = org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (status === "SUSPENDED" && !window.confirm(`Suspend ${org.shortName}? Its people won't be able to use Northstar until it's reactivated.`)) return;
    try { await httpRequest(`/api/v2/platform/orgs/${org.id}`, { method: "PATCH", body: { status, version: org.version } }); flash(`${org.shortName} ${status === "ACTIVE" ? "reactivated" : "suspended"}`); load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't update the brand."); }
  };
  const totals = data?.items.reduce((sum, org) => ({ people: sum.people + org.headcount, active: sum.active + (org.status === "ACTIVE" ? 1 : 0) }), { people: 0, active: 0 });
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Building2 size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PLATFORM · BRANDS</p>
          <h1>Manage brands</h1>
          <p>Each brand is a separate organization: its own people, payroll, policies and data, fully isolated. Add a new brand in under a minute.</p>
        </div>
        <button className="cw-btn primary lg" onClick={() => setCreating(true)}><Plus size={17} /> Add a brand</button>
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {data && totals && (
        <section className="cw-stats">
          <article><small>Brands</small><b>{data.items.length}</b><span>{totals.active} active</span></article>
          <article><small>People</small><b>{totals.people}</b><span>across all brands</span></article>
          <article><small>Groups</small><b>{data.groups.length}</b><span>{data.groups.map((group) => group.name).join(", ") || "none yet"}</span></article>
          <article><small>Isolation</small><b className="text">Row-level</b><span>Postgres RLS per organization</span></article>
        </section>
      )}
      {!data ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <div className="pc-grid">
          {data.items.map((org) => (
            <article key={org.id} className={`pc-card ${org.status !== "ACTIVE" ? "suspended" : ""}`} style={{ ["--brand" as string]: org.brandColor, ["--brand-accent" as string]: org.accentColor }}>
              <header>
                <OrgMark org={org} size={44} />
                <div><h3>{org.displayName}</h3><small>{org.industry || "—"} · {org.slug}.{APP_DOMAIN}</small></div>
                <span className={`cw-badge ${org.status === "ACTIVE" ? "tone-success" : "tone-danger"}`}><i />{org.status === "ACTIVE" ? "Active" : "Suspended"}</span>
              </header>
              <dl>
                <div><dt>People</dt><dd>{org.headcount}</dd></div>
                <div><dt>Logins</dt><dd>{org.members}</dd></div>
                <div><dt>Modules</dt><dd>{org.enabledModules.length}</dd></div>
                <div><dt>ID prefix</dt><dd>{org.employeePrefix}</dd></div>
              </dl>
              <p className="pc-modules">{org.enabledModules.filter((key) => key !== "core").slice(0, 8).map((key) => <span key={key}>{MODULE_LABELS[key] || key}</span>)}{org.enabledModules.length > 9 && <span>+{org.enabledModules.length - 9}</span>}</p>
              <footer>
                <button className="cw-btn ghost" onClick={() => setBrandEdit(org)}><Pencil size={14} /> Edit</button>
                <button className="cw-btn ghost" onClick={() => setEditing(org)}><SlidersHorizontal size={14} /> Modules</button>
                <button className="cw-btn ghost" onClick={() => toggleStatus(org)}><Power size={14} /> {org.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
                <button className="cw-btn primary" style={{ ["--accent" as string]: org.brandColor }} disabled={org.status !== "ACTIVE" || !memberships.has(org.id)}
                  title={memberships.has(org.id) ? `Switch to ${org.shortName}` : "You aren't a member of this brand"} onClick={() => switchOrganization(memberships.get(org.id)!)}>Open <ArrowRight size={14} /></button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {creating && data && <CreateBrandDrawer groups={data.groups} modules={data.modules} onClose={() => setCreating(false)} onCreated={(message) => { setCreating(false); flash(message); load(); }} />}
      {editing && data && <ModulesDrawer org={editing} modules={data.modules} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash("Modules updated"); load(); }} />}
      {brandEdit && <EditBrandDrawer org={brandEdit} onClose={() => setBrandEdit(null)} onSaved={(message) => { setBrandEdit(null); flash(message); load(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

type Admin = { userId: string; email: string; fullName: string; employeeNumber: string | null; designation: string | null; role: string; lastSignInAt: string | null; ssoLinked: boolean };
const ADMIN_ROLES: Record<string, string> = { OWNER: "Owner", HR_ADMIN: "HR admin", PAYROLL_ADMIN: "Payroll admin" };

/** Super admin edits any brand: identity and look, statutory defaults, its administrators and its own sign-in link. */
function EditBrandDrawer({ org, onClose, onSaved }: { org: PlatformOrg; onClose: () => void; onSaved: (message: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [form, setForm] = useState({ displayName: org.displayName, shortName: org.shortName, legalName: org.legalName || "", industry: org.industry || "",
    defaultState: org.defaultState, employeePrefix: org.employeePrefix, brandColor: org.brandColor, accentColor: org.accentColor });
  const [logo, setLogo] = useState<string | null>(org.logoDataUrl);
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [invite, setInvite] = useState({ fullName: "", workEmail: "", role: "HR_ADMIN" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  useDialogFocus(true, onClose, ref);
  const loadAdmins = useCallback(() => httpRequest<{ items: Admin[] }>(`/api/v2/platform/orgs/${org.id}/admins`).then((data) => setAdmins(data.items)).catch((reason) => setError(reason.message)), [org.id]);
  useEffect(() => { loadAdmins(); }, [loadAdmins]);
  const link = typeof window !== "undefined" ? new URL(brandUrl(org.slug), window.location.origin).toString() : `/b/${org.slug}`;
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await httpRequest(`/api/v2/platform/orgs/${org.id}`, { method: "PATCH", body: {
        ...form, legalName: form.legalName || undefined, industry: form.industry || undefined, logoDataUrl: logo, version: org.version } });
      onSaved(`${form.shortName} updated`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save."); }
    finally { setBusy(false); }
  };
  const addAdmin = async () => {
    if (!invite.fullName.trim() || !invite.workEmail.trim()) { setError("Enter the administrator's name and work email."); return; }
    setError("");
    try {
      const added = await httpRequest<{ employeeNumber: string }>(`/api/v2/platform/orgs/${org.id}/admins`, { method: "POST", body: invite });
      setNotice(`${invite.fullName} added as ${ADMIN_ROLES[invite.role]} (${added.employeeNumber}). Share the sign-in link above with them.`);
      setInvite({ fullName: "", workEmail: "", role: "HR_ADMIN" }); loadAdmins();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't add the administrator."); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer pc-create" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pc-edit-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: form.brandColor }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">EDIT BRAND · {org.slug}.{APP_DOMAIN}</p>
          <h2 id="pc-edit-title">{org.displayName}</h2>
          <div className="pc-link">
            <LinkIcon size={14} /><code>{link}</code>
            <button type="button" className="cw-btn ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {}); }}><Copy size={13} /> {copied ? "Copied" : "Copy sign-in link"}</button>
          </div>
        </header>
        <form className="cw-drawer-body cw-create" onSubmit={save}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {notice && <p className="cw-alert ok" role="status"><Check size={15} /> {notice}</p>}
          <div className="pc-preview" style={{ background: form.brandColor }}>
            {logo ? <img src={logo} alt="" /> : <span style={{ background: form.accentColor }}>{form.shortName.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>}
            <b>{form.shortName}</b>
          </div>
          <div className="cw-fields">
            <label className="wide"><span>Brand name</span><input required value={form.displayName} onChange={(event) => set("displayName", event.target.value)} /></label>
            <label><span>Short name</span><input required maxLength={24} value={form.shortName} onChange={(event) => set("shortName", event.target.value)} /></label>
            <label><span>Industry</span><input value={form.industry} onChange={(event) => set("industry", event.target.value)} /></label>
            <label className="wide"><span>Legal entity</span><input value={form.legalName} onChange={(event) => set("legalName", event.target.value)} /></label>
            <label><span>Home state (PT)</span><select value={form.defaultState} onChange={(event) => set("defaultState", event.target.value)}>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
            <label><span>Employee ID prefix</span><input required pattern="[A-Z]{2,6}" value={form.employeePrefix} onChange={(event) => set("employeePrefix", event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></label>
            <label><span>Brand colour</span><input type="color" value={form.brandColor} onChange={(event) => set("brandColor", event.target.value)} /></label>
            <label><span>Accent colour</span><input type="color" value={form.accentColor} onChange={(event) => set("accentColor", event.target.value)} /></label>
            <label className="wide"><span>Logo <small> PNG, JPG or WebP under 140 KB</small></span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setLogo(await readLogo(file)); } catch (reason) { setError((reason as Error).message); } }} /></label>
            {logo && <button type="button" className="cw-btn ghost" onClick={() => setLogo(null)}>Remove logo</button>}
          </div>
          <p className="cw-section-label">Administrators</p>
          <div className="pc-admins">
            {!admins ? <div className="cw-list-skeleton"><i /></div> : admins.map((admin) => (
              <div key={admin.userId} className="ns-device">
                <span><b>{admin.fullName}</b><small>{admin.email}{admin.employeeNumber ? ` · ${admin.employeeNumber}` : ""}{admin.ssoLinked ? " · SSO linked" : ""}</small></span>
                <span className="cw-badge tone-info"><i />{ADMIN_ROLES[admin.role] || admin.role}</span>
              </div>
            ))}
            <div className="pc-invite">
              <input placeholder="Full name" value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} aria-label="Administrator name" />
              <input placeholder="work@brand.com" type="email" value={invite.workEmail} onChange={(event) => setInvite({ ...invite, workEmail: event.target.value })} aria-label="Administrator email" />
              <select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })} aria-label="Role">
                {Object.entries(ADMIN_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button type="button" className="cw-btn ghost" onClick={addAdmin}><UserPlus size={14} /> Add</button>
            </div>
          </div>
          <footer className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy}><Check size={15} /> {busy ? "Saving…" : "Save brand"}</button></footer>
        </form>
      </aside>
    </>
  );
}

function ModulesDrawer({ org, modules, onClose, onSaved }: { org: PlatformOrg; modules: string[]; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [enabled, setEnabled] = useState<string[]>(org.enabledModules);
  const [error, setError] = useState("");
  useDialogFocus(true, onClose, ref);
  const save = async () => {
    try { await httpRequest(`/api/v2/platform/orgs/${org.id}`, { method: "PATCH", body: { enabledModules: enabled, version: org.version } }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save."); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pc-mod-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: org.brandColor }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{org.shortName.toUpperCase()} · MODULES</p>
          <h2 id="pc-mod-title">What this brand uses</h2>
          <p className="cw-head-note">Switched-off modules disappear from the brand's navigation and their APIs return “not enabled”. Data is kept.</p>
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert">{error}</p>}
          <div className="pc-module-list">
            {modules.map((key) => (
              <label key={key} className="ns-toggle">
                <span><b>{MODULE_LABELS[key] || key}</b>{key === "core" && <small>Always on — people, directory, approvals</small>}</span>
                <input type="checkbox" role="switch" disabled={key === "core"} checked={enabled.includes(key)}
                  onChange={(event) => setEnabled(event.target.checked ? [...enabled, key] : enabled.filter((item) => item !== key))} />
              </label>
            ))}
          </div>
          <footer className="cw-create-foot"><button className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" onClick={save}><Check size={15} /> Save modules</button></footer>
        </div>
      </aside>
    </>
  );
}

function CreateBrandDrawer({ groups, modules, onClose, onCreated }: { groups: Listing["groups"]; modules: string[]; onClose: () => void; onCreated: (message: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [form, setForm] = useState({ displayName: "", slug: "", legalName: "", shortName: "", industry: "", defaultState: "KA", employeePrefix: "", brandColor: "#0b615c", accentColor: "#c78c2b", groupId: groups[0]?.id || "", adminName: "", adminEmail: "", addMeAsOwner: true });
  const [logo, setLogo] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<string[]>(modules);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useDialogFocus(true, onClose, ref);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const onName = (value: string) => setForm((current) => ({
    ...current, displayName: value, slug: slugTouched ? current.slug : slugify(value),
    employeePrefix: current.employeePrefix || "", shortName: current.shortName,
  }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await httpRequest<{ id: string; slug: string; admin: { employeeNumber: string; email: string } }>("/api/v2/platform/orgs", {
        method: "POST", body: {
          displayName: form.displayName.trim(), slug: form.slug, legalName: form.legalName || undefined, shortName: form.shortName || undefined, industry: form.industry || undefined,
          defaultState: form.defaultState, employeePrefix: form.employeePrefix, brandColor: form.brandColor, accentColor: form.accentColor, logoDataUrl: logo || undefined,
          groupId: form.groupId || undefined, enabledModules: enabled, addMeAsOwner: form.addMeAsOwner,
          admin: { fullName: form.adminName, workEmail: form.adminEmail, designation: "HR Administrator" },
        },
      });
      onCreated(`${form.displayName} is live. HR admin ${form.adminName} (${result.admin.employeeNumber}) can sign in with ${result.admin.email}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't create the brand."); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer pc-create" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pc-create-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: form.brandColor }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">NEW BRAND</p>
          <h2 id="pc-create-title">Add a brand</h2>
          <p className="cw-head-note">Creates a separate organization with default leave types, attendance policy and an HR admin. Payroll, roster and onboarding defaults are set up on first use.</p>
        </header>
        <form className="cw-drawer-body cw-create" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="pc-preview" style={{ background: form.brandColor }}>
            {logo ? <img src={logo} alt="" /> : <span style={{ background: form.accentColor }}>{(form.shortName || form.displayName || "NB").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "NB"}</span>}
            <b>{form.shortName || form.displayName || "New brand"}</b>
          </div>
          <div className="cw-fields">
            <label className="wide"><span>Brand name <em>*</em></span><input required value={form.displayName} onChange={(event) => onName(event.target.value)} placeholder="e.g. Got Tea" /></label>
            <label><span>Subdomain <em>*</em> <small className="cw-muted">{form.slug || "brand"}.{APP_DOMAIN}</small></span><input required value={form.slug} pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?" onChange={(event) => { setSlugTouched(true); set("slug", slugify(event.target.value)); }} /></label>
            <label><span>Employee ID prefix <em>*</em></span><input required value={form.employeePrefix} pattern="[A-Z]{2,6}" maxLength={6} onChange={(event) => set("employeePrefix", event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} placeholder="GT" /></label>
            <label><span>Short name <small> optional</small></span><input value={form.shortName} maxLength={24} onChange={(event) => set("shortName", event.target.value)} /></label>
            <label><span>Legal entity <small> optional</small></span><input value={form.legalName} onChange={(event) => set("legalName", event.target.value)} /></label>
            <label><span>Industry <small> optional</small></span><input value={form.industry} onChange={(event) => set("industry", event.target.value)} placeholder="Café chain" /></label>
            <label><span>Home state (professional tax)</span><select value={form.defaultState} onChange={(event) => set("defaultState", event.target.value)}>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
            <label><span>Brand colour</span><input type="color" value={form.brandColor} onChange={(event) => set("brandColor", event.target.value)} /></label>
            <label><span>Accent colour</span><input type="color" value={form.accentColor} onChange={(event) => set("accentColor", event.target.value)} /></label>
            <label className="wide"><span>Logo <small> optional · PNG, JPG or WebP under 140 KB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setLogo(await readLogo(file)); } catch (reason) { setError((reason as Error).message); } }} /></label>
            {groups.length > 0 && <label className="wide"><span>Brand group</span><select value={form.groupId} onChange={(event) => set("groupId", event.target.value)}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
          </div>
          <p className="cw-section-label">First HR administrator</p>
          <div className="cw-fields">
            <label><span>Full name <em>*</em></span><input required value={form.adminName} onChange={(event) => set("adminName", event.target.value)} /></label>
            <label><span>Work email <em>*</em></span><input required type="email" value={form.adminEmail} onChange={(event) => set("adminEmail", event.target.value)} placeholder="hr@brand.com" /></label>
            <label className="wide ns-toggle"><span><b>Add me as owner</b><small>The brand appears in your brand switcher</small></span><input type="checkbox" role="switch" checked={form.addMeAsOwner} onChange={(event) => set("addMeAsOwner", event.target.checked)} /></label>
          </div>
          <p className="cw-section-label">Modules</p>
          <div className="pc-chip-modules">
            {modules.map((key) => (
              <label key={key} className={enabled.includes(key) ? "on" : ""}>
                <input type="checkbox" disabled={key === "core"} checked={enabled.includes(key)} onChange={(event) => setEnabled(event.target.checked ? [...enabled, key] : enabled.filter((item) => item !== key))} />
                {MODULE_LABELS[key] || key}
              </label>
            ))}
          </div>
          <footer className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy}><Users size={15} /> {busy ? "Creating…" : "Create brand"}</button></footer>
        </form>
      </aside>
    </>
  );
}
