"use client";
import { ArrowUpRight, BellRing, Palette, Building2, Calculator, Cpu, FileClock, Lock, MapPin, PlugZap, ShieldCheck, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { accessApi, BASE_ROLE_LABEL, dateLabel, errorText, isForbidden, type Me, type OrgProfile } from "./api";
import { ACCENT, ErrorState, PermissionState } from "./ui";

type Card = { href: string; title: string; body: string; icon: typeof ShieldCheck; needs: string[]; needLabel: string; stat?: string };

export function SettingsHub() {
  const [me, setMe] = useState<Me | null>(null);
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const viewer = await accessApi.me();
      setMe(viewer);
      if (viewer.can.settingsHub) setOrg(await accessApi.organization());
    } catch (reason) {
      if (isForbidden(reason)) setForbidden(true); else setError(errorText(reason, "Unable to load settings."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error && !me) return <div className="cw-page ax-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (forbidden || (me && !me.can.settingsHub)) return <div className="cw-page ax-page"><PermissionState title="Settings are for administrators" body="Organization settings, access control and integrations are managed by HR and owners. Your own preferences live in My Space." /></div>;
  if (!me) return <div className="cw-page ax-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;

  const held = new Set(me.permissions);
  const cards: Card[] = [
    { href: "/settings/organization", title: "Brand & organization", body: "Brand name, colours, logo, legal entity, PT state and employee ID prefix.", icon: Palette, needs: ["settings.access"], needLabel: "Owners and HR admins" },
    { href: "/settings/notifications", title: "My notifications", body: "What reaches your phone and inbox, quiet hours and your devices.", icon: BellRing, needs: [], needLabel: "" },
    { href: "/settings/access", title: "Access & roles", body: "Custom roles, permission matrix, temporary access, access reviews.", icon: ShieldCheck, needs: ["settings.access", "audit.view"], needLabel: "Manage roles & access",
      stat: org ? `${org.customRoles} custom role${org.customRoles === 1 ? "" : "s"} · ${org.grants.live} grant${org.grants.live === 1 ? "" : "s"}${org.grants.expiringSoon ? ` · ${org.grants.expiringSoon} ending soon` : ""}` : undefined },
    { href: "/settings/access?tab=audit", title: "Audit log", body: "Every change across Northstar — who, what, when, before and after.", icon: FileClock, needs: ["audit.view"], needLabel: "View audit log",
      stat: org ? `${org.auditLast24h.toLocaleString("en-IN")} change${org.auditLast24h === 1 ? "" : "s"} in the last 24 h` : undefined },
    { href: "/settings/attendance", title: "Attendance sites", body: "Work locations and geofence radius used for web and mobile punches.", icon: MapPin, needs: ["attendance.sites.manage"], needLabel: "Manage attendance sites",
      stat: org ? `${org.sites.active} active of ${org.sites.total}` : undefined },
    { href: "/settings/integrations", title: "Integrations", body: "Biometric devices, SSO, accounting and outbound webhooks.", icon: PlugZap, needs: ["integrations.manage"], needLabel: "Manage integrations" },
    { href: "/settings/jobs", title: "Background jobs", body: "Scheduled and queued platform jobs — status, retries and failures.", icon: Cpu, needs: ["jobs.manage"], needLabel: "Background jobs" },
    { href: "/payroll/admin", title: "Payroll settings", body: "Statutory codes, PF wage mode, debit account and payroll runs.", icon: Calculator, needs: ["payroll.settings.edit"], needLabel: "Payroll settings" },
    { href: "/onboarding", title: "Onboarding templates", body: "Joiner checklists, document requirements and day-one plans.", icon: UserRoundPlus, needs: ["onboarding.manage"], needLabel: "Manage onboarding" },
  ];

  return (
    <div className="cw-page ax-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Building2 size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">ORGANIZATION CONTROL</p>
          <h1>Settings</h1>
          <p>Configure who can do what, where people work, the systems Northstar connects to and how payroll and onboarding run.</p>
        </div>
      </header>

      <div className="ax-hub-grid">
        {cards.map((card) => {
          const allowed = !card.needs.length || card.needs.some((key) => held.has(key));
          const Icon = card.icon;
          const inner = (
            <>
              <span className="ax-hub-icon">{allowed ? <Icon size={20} /> : <Lock size={18} />}</span>
              <div>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
                {allowed ? card.stat && <small>{card.stat}</small> : <small className="locked">Needs “{card.needLabel}”</small>}
              </div>
              {allowed && <ArrowUpRight size={17} className="ax-hub-go" />}
            </>
          );
          return allowed
            ? <Link key={card.href} href={card.href} className="ax-hub-card">{inner}</Link>
            : <div key={card.href} className="ax-hub-card locked" aria-disabled="true">{inner}</div>;
        })}
      </div>

      <section className="ax-org" aria-labelledby="org-title">
        <header>
          <div><p className="cw-eyebrow">READ-ONLY</p><h2 id="org-title">Organization profile</h2></div>
        </header>
        {!org ? <div className="cw-list-skeleton"><i /><i /></div> : (
          <div className="ax-org-body">
            <dl className="cw-facts">
              <div><dt>Legal name</dt><dd>{org.profile.name}</dd></div>
              <div><dt>Workspace</dt><dd><code>{org.profile.slug}</code></dd></div>
              <div><dt>Active employees</dt><dd>{org.people.active}<small>{org.people.withLogin} with sign-in</small></dd></div>
              <div><dt>On Northstar since</dt><dd>{dateLabel(org.profile.createdAt)}</dd></div>
              <div className="wide"><dt>Base roles</dt><dd className="ax-org-roles">{Object.entries(org.baseRoles).sort().map(([role, n]) => <span key={role}>{BASE_ROLE_LABEL[role] || role} <b>{n}</b></span>)}</dd></div>
            </dl>
            <div className="ax-org-lists">
              <OrgBars title="Departments" rows={org.departments} />
              <OrgBars title="Locations" rows={org.locations} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OrgBars({ title, rows }: { title: string; rows: { name: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <div className="ax-bars">
      <h3>{title} <small>{rows.length}</small></h3>
      {!rows.length ? <p className="ax-muted">None recorded.</p> : (
        <ul>
          {rows.map((row) => (
            <li key={row.name}>
              <span>{row.name}</span>
              <i aria-hidden="true"><em style={{ width: `${(row.n / max) * 100}%` }} /></i>
              <b>{row.n}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
