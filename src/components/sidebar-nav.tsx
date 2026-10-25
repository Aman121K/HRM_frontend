"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { navigationGroups } from "@/lib/modules";
import { hasSession } from "@/lib/auth";
import { httpRequest } from "@/lib/http-client";
import { caseApi, currentActor, loadDefinitions } from "@/lib/cases";
import { activeOrgSlug, demoIdentity, orgInitials, setDemoIdentity, switchOrganization, useOrgs, type OrgSummary } from "@/lib/org";
import { platformApiUrl } from "@/lib/api";

const COLLAPSE_KEY = "hrm.nav_collapsed";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [pending, setPending] = useState(0);
  const [roles, setRoles] = useState<string[] | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => {
    loadDefinitions().then(({ viewer }) => setRoles(viewer.roles)).catch(() => setRoles([]));
    // Effective permissions (base role + custom roles) reveal items such as Settings to custom-role holders.
    httpRequest<{ permissions: string[] }>("/api/v2/access/me").then((me) => setPermissions(me.permissions || [])).catch(() => {});
    try { setCollapsed(JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) || "[]")); } catch { /* ignore */ }
    caseApi.inbox().then((data) => setPending(data.total)).catch(() => {});
  }, []);
  const toggle = (label: string) => {
    const next = collapsed.includes(label) ? collapsed.filter((item) => item !== label) : [...collapsed, label];
    setCollapsed(next);
    try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const { mine, current } = useOrgs();
  /** Brand-level switches (platform/group, enabled modules) first, then base role or custom-role permissions. */
  const visible = (item: (typeof navigationGroups)[number]["items"][number]) => {
    if (item.requires === "platform") return !!mine?.isPlatformAdmin;
    if (item.requires === "group") return !!mine?.groups.length;
    if (item.module && current && !current.enabledModules.includes(item.module)) return false;
    return !item.roles || (roles || []).some((role) => item.roles!.includes(role)) || !!item.permissions?.some((key) => permissions.includes(key));
  };
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(`${href}/`));
  return (
    <nav className="nav-list nav-grouped">
      {navigationGroups.filter((group) => group.items.some(visible)).map((group) => {
        const hidden = collapsed.includes(group.label) && !group.items.some((item) => isActive(item.href));
        return (
          <div key={group.label} className="nav-group">
            {group.label !== "Overview" && (
              <button className="nav-group-label" aria-expanded={!hidden} onClick={() => toggle(group.label)}>
                {group.label}<ChevronDown size={12} />
              </button>
            )}
            {!hidden && group.items.filter(visible).map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className={isActive(href) ? "active" : ""} onClick={onNavigate}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {href === "/approvals" && pending > 0 && <b>{pending}</b>}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

type DemoOrg = { slug: string; displayName: string; people: { employeeNumber: string; fullName: string; designation: string | null; role: string }[] };
const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Employee", MANAGER: "Manager", HR_ADMIN: "HR", PAYROLL_ADMIN: "Finance", OWNER: "Owner" };

/** Local demo only: switch which seeded person (in the current brand) the workspace acts as. */
export function RoleSwitcher() {
  const [signedIn, setSignedIn] = useState(false);
  const [org, setOrg] = useState<DemoOrg | null>(null);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    setSignedIn(hasSession());
    const identity = demoIdentity();
    const slug = identity?.slug || activeOrgSlug() || "blue-tokai";
    fetch(platformApiUrl("/api/v2/auth/demo-identities")).then((response) => response.json())
      .then((data: { organizations: DemoOrg[] }) => {
        const found = data.organizations.find((item) => item.slug === slug) || data.organizations[0];
        setOrg(found || null);
        const legacy: Record<string, string> = { employee: "BT002", manager: "BT001", hr: "BT000", finance: "BT009" };
        setCurrent(identity?.employeeNumber || legacy[currentActor()] || "");
      }).catch(() => setOrg(null));
  }, []);
  // A real SSO session always wins over demo identities, so the switcher is hidden while signed in.
  if (process.env.NEXT_PUBLIC_ALLOW_DEMO_IDENTITY !== "true" || signedIn || !org) return null;
  // One person per role keeps the switcher compact.
  const people = Object.values(org.people.reduce<Record<string, DemoOrg["people"][number]>>((picked, person) => { picked[person.role] ||= person; return picked; }, {}));
  return (
    <div className="role-switcher" role="radiogroup" aria-label="View workspace as">
      <small>VIEW AS · DEMO</small>
      <div style={{ gridTemplateColumns: `repeat(${Math.min(people.length, 5)}, 1fr)` }}>
        {people.map((person) => (
          <button key={person.employeeNumber} role="radio" aria-checked={current === person.employeeNumber} title={`${person.fullName} · ${person.designation || ""}`}
            className={current === person.employeeNumber ? "active" : ""}
            onClick={() => { if (person.employeeNumber === current) return; setDemoIdentity(org.slug, person.employeeNumber); window.location.reload(); }}>
            {ROLE_LABEL[person.role] || person.role}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Brand switcher: current organization with its colours; lists every brand the person belongs to. */
export function OrgSwitcher() {
  const { mine, current } = useOrgs();
  const [open, setOpen] = useState(false);
  if (!current) return <div className="company"><span className="company-icon">··</span><span>Loading…<small>Workspace</small></span></div>;
  const others = mine?.organizations.filter((org) => org.id !== current.id) || [];
  return (
    <div className="org-switcher">
      {open && (
        <div className="org-menu" role="menu">
          <small>SWITCH BRAND</small>
          {mine?.organizations.map((org) => (
            <button key={org.id} role="menuitem" className={org.id === current.id ? "active" : ""} onClick={() => { setOpen(false); if (org.id !== current.id) switchOrganization(org); }}>
              <OrgMark org={org} /><span><b>{org.shortName}</b><small>{org.role ? ROLE_LABEL[org.role] || org.role : ""}</small></span>
            </button>
          ))}
          {(mine?.groups.length || mine?.isPlatformAdmin) && <div className="org-menu-links">
            {!!mine?.groups.length && <Link href="/group" onClick={() => setOpen(false)}>Group dashboard →</Link>}
            {mine?.isPlatformAdmin && <Link href="/platform" onClick={() => setOpen(false)}>Manage brands →</Link>}
          </div>}
        </div>
      )}
      <button className="company" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={!others.length && !mine?.isPlatformAdmin && !mine?.groups.length}>
        <OrgMark org={current} />
        <span>{current.shortName}<small>{current.groupName || current.industry || "People workspace"}</small></span>
        {(others.length > 0 || mine?.isPlatformAdmin) && <ChevronDown size={14} />}
      </button>
    </div>
  );
}

export function OrgMark({ org, size = 28 }: { org: Pick<OrgSummary, "logoDataUrl" | "brandColor" | "shortName">; size?: number }) {
  return org.logoDataUrl
    ? <img className="org-mark" src={org.logoDataUrl} alt="" width={size} height={size} />
    : <span className="org-mark" style={{ background: org.brandColor, width: size, height: size }}>{orgInitials(org.shortName)}</span>;
}
