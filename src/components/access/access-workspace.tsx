"use client";
import { ArrowLeft, ChevronRight, Clock3, KeyRound, Plus, Search, ShieldCheck, TriangleAlert, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  accessApi, BASE_ROLE_LABEL, dateLabel, errorText, isForbidden,
  type Catalogue, type CustomRole, type Grant, type Me, type PersonRow, type SystemRole,
} from "./api";
import { AuditPanel } from "./audit-panel";
import { PersonDrawer } from "./person-drawer";
import { ReviewPanel } from "./review-panel";
import { RoleEditor } from "./role-editor";
import { ACCENT, Badge, ErrorState, PermissionState, RiskBadge, Toast } from "./ui";

type Tab = "roles" | "people" | "review" | "audit";
type EditorState = { role: SystemRole | CustomRole | null; prefill?: { name: string; description: string; grants: Grant[]; basedOn?: string } } | null;

export function AccessWorkspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [roles, setRoles] = useState<{ system: SystemRole[]; custom: CustomRole[] } | null>(null);
  const [facets, setFacets] = useState<{ departments: string[]; locations: string[]; people: PersonRow[] }>({ departments: [], locations: [], people: [] });
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTabState] = useState<Tab>("roles");
  const [editor, setEditor] = useState<EditorState>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [peopleVersion, setPeopleVersion] = useState(0);

  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3400); }, []);
  const load = useCallback(async () => {
    setError("");
    try {
      const viewer = await accessApi.me();
      setMe(viewer);
      if (!viewer.can.reviewAccess) return;
      const [cat, list, people] = await Promise.all([accessApi.catalogue(), accessApi.roles(), accessApi.people({ limit: 500 })]);
      setCatalogue(cat); setRoles(list); setFacets({ departments: people.departments, locations: people.locations, people: people.items });
    } catch (reason) {
      if (isForbidden(reason)) setForbidden(true);
      else setError(errorText(reason, "Unable to load access settings."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (initial && ["roles", "people", "review", "audit"].includes(initial)) setTabState(initial);
  }, []);
  const setTab = (next: Tab) => {
    setTabState(next);
    const url = new URL(window.location.href); url.searchParams.set("tab", next); window.history.replaceState(null, "", url);
  };
  const changed = (message: string) => { flash(message); load(); setPeopleVersion((value) => value + 1); };

  if (error && !me) return <div className="cw-page ax-page"><ErrorState message={`${error} Make sure the platform API is running.`} onRetry={load} /></div>;
  if (forbidden || (me && !me.can.reviewAccess)) return <div className="cw-page ax-page"><PermissionState title="Access settings are restricted" body="Only people who can manage roles or review the audit log can open this page. Ask your HR administrator if you need access." /></div>;
  if (!me || !catalogue || !roles) return <div className="cw-page ax-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;

  const canManage = me.can.manageAccess;
  const elevated = facets.people.filter((item) => item.elevated).length;
  const temporary = facets.people.reduce((sum, item) => sum + item.customRoles.filter((role) => role.expiresAt).length, 0);
  const soon = facets.people.reduce((sum, item) => sum + item.customRoles.filter((role) => role.expiresAt && new Date(role.expiresAt).getTime() < Date.now() + 7 * 86_400_000).length, 0);
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "roles", label: "Roles", show: true },
    { key: "people", label: "People & assignments", show: true },
    { key: "review", label: "Access review", show: true },
    { key: "audit", label: "Audit log", show: me.can.viewAudit },
  ];
  const clone = (role: SystemRole | CustomRole) => setEditor({ role: null, prefill: { name: `Copy of ${role.name}`, description: role.description, grants: role.grants, basedOn: role.id } });

  return (
    <div className="cw-page ax-page" style={{ ["--accent" as string]: ACCENT }}>
      <Link href="/settings" className="ax-back"><ArrowLeft size={14} /> Settings</Link>
      <header className="cw-hero">
        <span className="cw-hero-icon"><ShieldCheck size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · ACCESS CONTROL</p>
          <h1>Access &amp; roles</h1>
          <p>Decide who can do what — build roles from a permission catalogue, scope them to teams, departments or locations, grant temporary access and review every change.</p>
        </div>
        {canManage && <button className="cw-btn primary lg" onClick={() => setEditor({ role: null })}><Plus size={17} /> New role</button>}
      </header>

      {!canManage && <p className="ax-note"><KeyRound size={14} /> You have read-only access here (audit &amp; access review). Changing roles needs “Manage roles &amp; access”.</p>}

      <section className="cw-stats" aria-label="Access summary">
        <article><small>Custom roles</small><b>{roles.custom.filter((role) => role.status === "ACTIVE").length}</b><span>{roles.system.length} built-in roles</span></article>
        <article className={elevated ? "attention" : ""}><small>Elevated access</small><b>{elevated}</b><span>people with admin or high-risk permissions</span></article>
        <article><small>Temporary grants</small><b>{temporary}</b><span>{soon ? `${soon} ending within 7 days` : "none ending this week"}</span></article>
        <article><small>People</small><b>{facets.people.length}</b><span>{facets.people.filter((item) => item.hasLogin).length} can sign in</span></article>
      </section>

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Access sections">
          {tabs.filter((item) => item.show).map((item) => (
            <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>
          ))}
        </div>
      </div>

      {tab === "roles" && <RolesPanel roles={roles} canManage={canManage} onOpen={(role) => setEditor({ role })} onCreate={() => setEditor({ role: null })} />}
      {tab === "people" && <PeoplePanel key={peopleVersion} roles={roles.custom} onOpen={setPerson} />}
      {tab === "review" && <ReviewPanel catalogue={catalogue} canManage={canManage} onOpenPerson={setPerson} flash={flash} />}
      {tab === "audit" && me.can.viewAudit && <AuditPanel flash={flash} />}

      {editor && (
        <RoleEditor key={editor.role?.id || editor.prefill?.name || "new"} catalogue={catalogue} role={editor.role} prefill={editor.prefill} canManage={canManage}
          onClose={() => setEditor(null)} onSaved={(message) => { setEditor(null); changed(message); }} onClone={clone}
          onOpenPerson={(id) => { setEditor(null); setPerson(id); }} />
      )}
      {person && (
        <PersonDrawer employeeId={person} catalogue={catalogue} roles={roles.custom} departments={facets.departments} locations={facets.locations} canManage={canManage}
          onClose={() => setPerson(null)} onChanged={changed} />
      )}
      <Toast message={toast} />
    </div>
  );
}

function RolesPanel({ roles, canManage, onOpen, onCreate }: { roles: { system: SystemRole[]; custom: CustomRole[] }; canManage: boolean; onOpen: (role: SystemRole | CustomRole) => void; onCreate: () => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const custom = roles.custom.filter((role) => showArchived || role.status === "ACTIVE");
  const archivedCount = roles.custom.filter((role) => role.status === "ARCHIVED").length;
  return (
    <>
      <div className="ax-section-head">
        <div><h2>Custom roles</h2><p>Defined by your organization and layered on top of each person&apos;s base role.</p></div>
        {archivedCount > 0 && <button className="ax-link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} archived ({archivedCount})</button>}
      </div>
      {!custom.length ? (
        <div className="cw-empty">
          <span><ShieldCheck size={26} /></span><h2>No custom roles yet</h2>
          <p>Start from scratch or clone a built-in role — e.g. a Store Manager who approves leave and plans rosters for their own team only.</p>
          {canManage && <button className="cw-btn primary" onClick={onCreate}><Plus size={16} /> New role</button>}
        </div>
      ) : (
        <div className="ax-role-grid">
          {custom.map((role) => <RoleCard key={role.id} role={role} onOpen={() => onOpen(role)} />)}
        </div>
      )}
      <div className="ax-section-head">
        <div><h2>Built-in roles</h2><p>Every member has exactly one base role. These mirror today&apos;s behaviour and are read-only — clone one to customise.</p></div>
      </div>
      <div className="ax-role-grid">
        {roles.system.map((role) => <RoleCard key={role.id} role={role} onOpen={() => onOpen(role)} />)}
      </div>
    </>
  );
}

function RoleCard({ role, onOpen }: { role: SystemRole | CustomRole; onOpen: () => void }) {
  const archived = role.type === "CUSTOM" && role.status === "ARCHIVED";
  return (
    <button className={`ax-role-card ${role.type === "SYSTEM" ? "system" : ""} ${archived ? "archived" : ""}`} onClick={onOpen}>
      <header>
        <b>{role.name}</b>
        {role.type === "SYSTEM" ? <Badge tone="neutral" label="Built-in" /> : archived ? <Badge tone="neutral" label="Archived" /> : null}
      </header>
      <p>{role.description || "No description"}</p>
      <footer>
        <span><Users size={13} /> {role.holders ?? 0}</span>
        <span><KeyRound size={13} /> {role.grants.length}</span>
        {role.type === "CUSTOM" && !!role.temporary && <span><Clock3 size={13} /> {role.temporary} temporary</span>}
        <RiskBadge risk={role.highestRisk} />
        {role.sod.length > 0 && <span className="ax-sod-flag" title={role.sod.map((rule) => rule.message).join("\n")}><TriangleAlert size={13} /> SoD</span>}
        <ChevronRight size={15} className="ax-card-go" />
      </footer>
    </button>
  );
}

function PeoplePanel({ roles, onOpen }: { roles: CustomRole[]; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [baseRole, setBaseRole] = useState("");
  const [roleId, setRoleId] = useState("");
  const [data, setData] = useState<{ items: PersonRow[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const params = useMemo(() => ({ search, filter, baseRole, roleId }), [search, filter, baseRole, roleId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      accessApi.people({ ...params, limit: 200 }).then((result) => { setData(result); setError(""); }).catch((reason) => setError(errorText(reason, "Unable to load people.")));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [params]);
  return (
    <>
      <div className="ax-people-bar">
        <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, number, department" aria-label="Search people" />
          {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
        <div className="cw-chips" role="group" aria-label="Filter people">
          {[["", "Everyone"], ["elevated", "Elevated"], ["custom", "Has custom roles"], ["temporary", "Temporary access"]].map(([key, label]) => (
            <button key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        <select value={baseRole} onChange={(event) => setBaseRole(event.target.value)} aria-label="Base role filter" className="ax-select">
          <option value="">Any base role</option>{Object.entries(BASE_ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={roleId} onChange={(event) => setRoleId(event.target.value)} aria-label="Custom role filter" className="ax-select">
          <option value="">Any custom role</option>{roles.filter((role) => role.status === "ACTIVE").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </div>
      {error && <ErrorState message={error} />}
      {!data ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !data.items.length ? (
        <div className="cw-empty"><span><Users size={24} /></span><h2>No one matches</h2><p>Clear the filters to see everyone.</p></div>
      ) : (
        <div className="cw-table ax-people-table" role="table" aria-label="People and their access">
          <div className="cw-row head" role="row"><span role="columnheader">Person</span><span role="columnheader">Base role</span><span role="columnheader">Custom roles</span><span role="columnheader">Department</span><span /></div>
          {data.items.map((item) => (
            <button key={item.id} role="row" className={`cw-row ${item.elevated ? "actionable" : ""}`} onClick={() => onOpen(item.id)}>
              <span role="cell" className="cw-person"><span className="cw-avatar small">{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <span>{item.name}{item.isSelf && <em className="ax-you">You</em>}<small>{item.number} · {item.designation || "—"}</small></span></span>
              <span role="cell">{item.baseRole ? <Badge tone={["OWNER", "HR_ADMIN", "PAYROLL_ADMIN"].includes(item.baseRole) ? "warning" : "neutral"} label={BASE_ROLE_LABEL[item.baseRole]} /> : <span className="ax-muted">No sign-in</span>}</span>
              <span role="cell" className="ax-role-chips">
                {item.customRoles.length ? item.customRoles.map((role) => <span key={role.assignmentId} title={role.expiresAt ? `Until ${dateLabel(role.expiresAt)}` : "Ongoing"}>{role.name}{role.expiresAt ? <Clock3 size={11} /> : null}</span>) : <span className="ax-muted">—</span>}
              </span>
              <span role="cell" className="ax-muted">{item.department || "—"}</span>
              <span role="cell" className="cw-row-cta"><ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      )}
      {data && data.total > data.items.length && <p className="ax-muted">Showing {data.items.length} of {data.total}. Refine the search to narrow down.</p>}
    </>
  );
}

