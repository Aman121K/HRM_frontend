"use client";
import { Archive, Copy, History, Lock, RotateCcw, Search, ShieldCheck, TriangleAlert, Users, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  accessApi, dateLabel, dateTimeLabel, errorText, humanAction, indexCatalogue, isConflict, scopeRank, sodFor, SCOPE_SHORT,
  type Catalogue, type CustomRole, type Grant, type RoleDetail, type Scope, type SystemRole,
} from "./api";
import { Badge, ConfirmDialog, Drawer, ErrorState, RiskBadge } from "./ui";

type Props = {
  catalogue: Catalogue;
  /** Existing role, or null to create one (optionally prefilled from a clone). */
  role: SystemRole | CustomRole | null;
  prefill?: { name: string; description: string; grants: Grant[]; basedOn?: string };
  canManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onClone: (role: SystemRole | CustomRole) => void;
  onOpenPerson: (employeeId: string) => void;
};

export function RoleEditor({ catalogue, role, prefill, canManage, onClose, onSaved, onClone, onOpenPerson }: Props) {
  const index = useMemo(() => indexCatalogue(catalogue), [catalogue]);
  const system = role?.type === "SYSTEM";
  const custom = role?.type === "CUSTOM" ? role : null;
  const archived = custom?.status === "ARCHIVED";
  const editable = canManage && !system && !archived;
  const initialGrants = role?.grants || prefill?.grants || [];
  const [name, setName] = useState(role?.name || prefill?.name || "");
  const [description, setDescription] = useState(role?.description || prefill?.description || "");
  const [grants, setGrants] = useState<Map<string, Scope>>(() => new Map(initialGrants.map((grant) => [grant.key, grant.scope])));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "selected" | "risky">(system ? "selected" : "all");
  const [tab, setTab] = useState<"permissions" | "holders" | "history">("permissions");
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "save" | "archive" | "restore"; items: string[] }>(null);

  useEffect(() => {
    if (!custom) return;
    accessApi.role(custom.id).then(setDetail).catch((reason) => setError(errorText(reason, "Unable to load role details.")));
  }, [custom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list: Grant[] = [...grants.entries()].map(([key, scope]) => ({ key, scope }));
  const sod = sodFor(catalogue.sodRules, grants.keys());
  const before = new Map(initialGrants.map((grant) => [grant.key, grant.scope]));
  const addedCritical = list.filter((grant) => index.get(grant.key)?.confirm && !before.has(grant.key));
  const changed = name.trim() !== (role?.name || prefill?.name || "") || description.trim() !== (role?.description || prefill?.description || "")
    || list.length !== before.size || list.some((grant) => before.get(grant.key) !== grant.scope) || (!role && !!prefill);
  const counts = { total: list.length, critical: list.filter((grant) => index.get(grant.key)?.risk === "CRITICAL").length, high: list.filter((grant) => index.get(grant.key)?.risk === "HIGH").length };

  const toggle = (key: string) => {
    if (!editable) return;
    setGrants((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, index.get(key)?.scopable ? defaultScope(key) : "ORGANIZATION");
      return next;
    });
  };
  const defaultScope = (key: string): Scope => (key === "people.view" || key.startsWith("leave.") || key.startsWith("roster.") || key.startsWith("attendance.") ? "DIRECT_REPORTS" : "ORGANIZATION");
  const setScope = (key: string, scope: Scope) => setGrants((current) => new Map(current).set(key, scope));
  const toggleGroup = (keys: string[], on: boolean) => {
    if (!editable) return;
    setGrants((current) => {
      const next = new Map(current);
      for (const key of keys) {
        if (on && !next.has(key)) next.set(key, index.get(key)?.scopable ? defaultScope(key) : "ORGANIZATION");
        if (!on) next.delete(key);
      }
      return next;
    });
  };

  const needle = search.trim().toLowerCase();
  const groups = catalogue.groups.map((group) => ({
    ...group,
    visible: group.permissions.filter((permission) => {
      if (filter === "selected" && !grants.has(permission.key)) return false;
      if (filter === "risky" && !["HIGH", "CRITICAL"].includes(permission.risk)) return false;
      return !needle || `${permission.label} ${permission.description} ${permission.key} ${group.label}`.toLowerCase().includes(needle);
    }),
  })).filter((group) => group.visible.length);

  const save = async (reason?: string) => {
    setBusy(true); setError("");
    try {
      const body = { name: name.trim(), description: description.trim(), permissions: list, ...(reason ? { confirm: true, reason } : {}) };
      if (custom) await accessApi.updateRole(custom.id, { ...body, version: custom.version });
      else await accessApi.createRole({ ...body, basedOn: prefill?.basedOn });
      onSaved(custom ? `“${body.name}” saved` : `“${body.name}” created`);
    } catch (reason) {
      if (isConflict(reason) && custom) setStale(true);
      setError(errorText(reason, "Unable to save this role."));
      setConfirm(null);
    } finally { setBusy(false); }
  };
  const setStatus = async (status: "ACTIVE" | "ARCHIVED", reason: string) => {
    if (!custom) return;
    setBusy(true); setError("");
    try {
      await accessApi.roleStatus(custom.id, { version: custom.version, status, reason, ...(status === "ACTIVE" && addedCriticalOnRestore.length ? { confirm: true } : {}) });
      onSaved(status === "ARCHIVED" ? `“${custom.name}” archived — its assignments no longer grant access` : `“${custom.name}” restored`);
    } catch (reason) { setError(errorText(reason, "Unable to change the role status.")); setConfirm(null); } finally { setBusy(false); }
  };
  const addedCriticalOnRestore = custom ? custom.grants.filter((grant) => index.get(grant.key)?.confirm) : [];

  const submit = () => {
    if (!name.trim() || name.trim().length < 2) { setError("Give the role a name (at least 2 characters)."); return; }
    if (!list.length) { setError("Choose at least one permission."); return; }
    if (addedCritical.length) setConfirm({ kind: "save", items: addedCritical.map((grant) => index.get(grant.key)!.label) });
    else save();
  };

  const title = role ? role.name : prefill ? `New role from “${prefill.name.replace(/^Copy of /, "")}”` : "New custom role";
  const head = (
    <div className="cw-head-meta">
      {system ? <Badge tone="neutral" label="Built-in · read-only" /> : custom ? <Badge tone={archived ? "neutral" : "success"} label={archived ? "Archived" : "Custom"} /> : <Badge tone="info" label="Draft" />}
      {custom && <span>Version {custom.version}</span>}
      {role && "holders" in role && role.holders !== undefined && <span><Users size={13} /> {role.holders} {role.holders === 1 ? "person" : "people"}</span>}
      {custom?.updatedAt && <span>Updated {dateLabel(custom.updatedAt)}{custom.updatedBy ? ` by ${custom.updatedBy}` : ""}</span>}
    </div>
  );

  const footer = (
    <>
      <div className="ax-foot-left">
        {role && <button className="cw-btn ghost" onClick={() => onClone(role)} disabled={!canManage}><Copy size={15} /> Clone</button>}
        {custom && canManage && (archived
          ? <button className="cw-btn ghost" onClick={() => setConfirm({ kind: "restore", items: addedCriticalOnRestore.map((grant) => index.get(grant.key)!.label) })}><RotateCcw size={15} /> Restore</button>
          : <button className="cw-btn danger" onClick={() => setConfirm({ kind: "archive", items: [] })}><Archive size={15} /> Archive</button>)}
      </div>
      <div className="ax-foot-right">
        <button className="cw-btn ghost" onClick={onClose}>{editable ? "Cancel" : "Close"}</button>
        {editable && tab === "permissions" && <button className="cw-btn primary" disabled={busy || !changed || stale} onClick={submit}>{busy ? "Saving…" : custom ? "Save changes" : "Create role"}</button>}
      </div>
    </>
  );

  return (
    <Drawer title={title} eyebrow={system ? "SETTINGS · BUILT-IN ROLE" : "SETTINGS · CUSTOM ROLE"} onClose={onClose} wide head={head} footer={footer}>
      {custom && (
        <div className="cw-tabs ax-inner-tabs" role="tablist" aria-label="Role sections">
          {(["permissions", "holders", "history"] as const).map((key) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {key === "permissions" ? "Permissions" : key === "holders" ? `Holders${detail ? ` · ${detail.assignments.length}` : ""}` : "History"}
            </button>
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={stale ? () => window.location.reload() : undefined} />}
      {system && <p className="ax-note"><Lock size={14} /> Built-in roles mirror what each base role can do today and can't be edited. Clone one to start a custom role.{(role as SystemRole).note ? ` ${(role as SystemRole).note}` : ""}</p>}
      {archived && <p className="cw-alert warn"><Archive size={15} /><span>This role is archived. Its {detail?.assignments.length || 0} assignment(s) no longer grant any access until it is restored.</span></p>}

      {tab === "permissions" && (
        <>
          {editable && (
            <div className="cw-fields">
              <label><span>Role name <em>*</em></span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Store Manager" autoFocus={!role} /></label>
              <label><span>Description <small>shown to admins when assigning</small></span><input value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="What this role is for" /></label>
            </div>
          )}
          {!editable && role?.description && <p className="ax-lede">{role.description}</p>}

          <div className="ax-matrix-bar">
            <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permissions" aria-label="Search permissions" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
            <div className="cw-chips" role="group" aria-label="Filter permissions">
              {([["all", "All"], ["selected", `Selected · ${counts.total}`], ["risky", "High risk"]] as const).map(([key, label]) => (
                <button key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="ax-summary" aria-live="polite">
            <span><ShieldCheck size={15} /> <b>{counts.total}</b> permission{counts.total === 1 ? "" : "s"}</span>
            {counts.critical > 0 && <span className="danger"><Zap size={14} /> {counts.critical} critical</span>}
            {counts.high > 0 && <span className="warn">{counts.high} high risk</span>}
            <span className="ax-legend"><em className="ax-enforced">Enforced</em> grants access on the listed endpoints today; other permissions are tracked in access reviews and apply as each module adopts them.</span>
          </div>
          {sod.length > 0 && (
            <div className="ax-sod" role="status">
              <TriangleAlert size={16} />
              <div><b>Separation-of-duties warning</b>{sod.map((rule) => <p key={rule.id}>{rule.message}</p>)}</div>
            </div>
          )}

          {!groups.length ? <div className="cw-empty"><h2>No permissions match</h2><p>Try another search or filter.</p></div> : (
            <div className="ax-matrix">
              {groups.map((group) => {
                const keys = group.permissions.map((permission) => permission.key);
                const selected = keys.filter((key) => grants.has(key)).length;
                return (
                  <section key={group.key} className="ax-group" aria-labelledby={`g-${group.key}`}>
                    <header>
                      <div><h3 id={`g-${group.key}`}>{group.label}</h3><p>{group.description}</p></div>
                      <span className="ax-count">{selected}/{keys.length}</span>
                      {editable && <button className="ax-link" onClick={() => toggleGroup(keys, selected < keys.length)}>{selected < keys.length ? "Select all" : "Clear"}</button>}
                    </header>
                    <ul>
                      {group.visible.map((permission) => {
                        const on = grants.has(permission.key);
                        const scope = grants.get(permission.key);
                        const widened = scope && before.get(permission.key) && scopeRank(scope) > scopeRank(before.get(permission.key)!);
                        return (
                          <li key={permission.key} className={`${on ? "on" : ""} ${!before.has(permission.key) && on && role ? "added" : ""} ${before.has(permission.key) && !on ? "removed" : ""}`}>
                            <label className="ax-perm">
                              <input type="checkbox" checked={on} disabled={!editable} onChange={() => toggle(permission.key)} />
                              <span>
                                <b>{permission.label}</b>
                                <small>{permission.description}</small>
                                <code>{permission.key}</code>
                                {!!permission.enforcedAt?.length && <em className="ax-enforced" title={permission.enforcedAt.join("\n")}>Enforced on {permission.enforcedAt.length} endpoint{permission.enforcedAt.length === 1 ? "" : "s"}</em>}
                              </span>
                            </label>
                            <div className="ax-perm-meta">
                              <RiskBadge risk={permission.risk} />
                              {on && (permission.scopable ? (
                                <select value={scope} disabled={!editable} onChange={(event) => setScope(permission.key, event.target.value as Scope)} aria-label={`Data scope for ${permission.label}`} className={widened ? "widened" : ""}>
                                  {catalogue.scopes.map((option) => <option key={option.key} value={option.key}>{SCOPE_SHORT[option.key]}</option>)}
                                </select>
                              ) : <span className="ax-scope muted">Org-wide</span>)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "holders" && (
        !detail ? <div className="cw-list-skeleton"><i /><i /></div> : !detail.assignments.length ? (
          <div className="cw-empty"><span><Users size={24} /></span><h2>Nobody holds this role yet</h2><p>Assign it from the People &amp; assignments tab.</p></div>
        ) : (
          <ul className="ax-holders">
            {detail.assignments.map((item) => (
              <li key={item.id}>
                <button className="ax-holder" onClick={() => onOpenPerson(item.employeeId)}>
                  <span className="cw-avatar small">{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <span><b>{item.name}</b><small>{item.number} · {item.designation || "—"}{item.department || item.location ? ` · only ${[item.department, item.location].filter(Boolean).join(" / ")}` : ""}</small></span>
                  {item.expiresAt ? <Badge tone={item.expired ? "neutral" : "warning"} label={item.expired ? "Expired" : `Until ${dateLabel(item.expiresAt)}`} /> : <Badge tone="success" label="Ongoing" />}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "history" && (
        !detail ? <div className="cw-list-skeleton"><i /><i /></div> : (
          <ol className="ax-history">
            {detail.history.map((entry) => (
              <li key={entry.id}>
                <span className="ax-history-dot"><History size={13} /></span>
                <div>
                  <p><b>{humanAction(entry.action.replace("ACCESS_ROLE_", "Role "))}</b>{entry.version ? <small> → v{entry.version}</small> : null} · {entry.actor || "System"} <time>{dateTimeLabel(entry.at)}</time></p>
                  {entry.renamed && <p className="ax-diff-line">Renamed “{entry.renamed.from}” → “{entry.renamed.to}”</p>}
                  <div className="ax-diff">
                    {entry.diff.added.map((grant) => <span key={`a${grant.key}`} className="add">+ {index.get(grant.key)?.label || grant.key}{index.get(grant.key)?.scopable ? ` (${SCOPE_SHORT[grant.scope]})` : ""}</span>)}
                    {entry.diff.removed.map((grant) => <span key={`r${grant.key}`} className="del">− {index.get(grant.key)?.label || grant.key}</span>)}
                    {entry.diff.changed.map((change) => <span key={`c${change.key}`} className="chg">{index.get(change.key)?.label}: {SCOPE_SHORT[change.from]} → {SCOPE_SHORT[change.to]}</span>)}
                    {entry.descriptionChanged && entry.action === "ACCESS_ROLE_UPDATED" && <span className="chg">Description edited</span>}
                  </div>
                  {entry.reason && <blockquote>{entry.reason}</blockquote>}
                </div>
              </li>
            ))}
          </ol>
        )
      )}

      {confirm?.kind === "save" && (
        <ConfirmDialog danger title="Confirm high-risk permissions" confirmLabel={custom ? "Save role" : "Create role"} busy={busy} items={confirm.items}
          body={<p>This role will include critical permissions. Everyone who holds it{custom?.holders ? ` (${custom.holders} ${custom.holders === 1 ? "person" : "people"})` : ""} gets them immediately.</p>}
          onConfirm={(reason) => save(reason)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.kind === "archive" && custom && (
        <ConfirmDialog title={`Archive “${custom.name}”?`} confirmLabel="Archive role" busy={busy}
          body={<p>People keep the assignment on record, but it stops granting access right away. You can restore the role later.</p>}
          onConfirm={(reason) => setStatus("ARCHIVED", reason)} onClose={() => setConfirm(null)} />
      )}
      {confirm?.kind === "restore" && custom && (
        <ConfirmDialog danger={confirm.items.length > 0} title={`Restore “${custom.name}”?`} confirmLabel="Restore role" busy={busy} items={confirm.items}
          body={<p>Existing assignments start granting access again immediately.</p>}
          onConfirm={(reason) => setStatus("ACTIVE", reason)} onClose={() => setConfirm(null)} />
      )}
    </Drawer>
  );
}
