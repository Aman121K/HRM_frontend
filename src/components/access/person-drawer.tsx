"use client";
import { CalendarClock, KeyRound, MapPin, Plus, ShieldCheck, TriangleAlert, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  accessApi, BASE_ROLE_LABEL, dateLabel, errorText, indexCatalogue, SCOPE_SHORT,
  type AssignImpact, type Catalogue, type CustomRole, type PersonDetail,
} from "./api";
import { Badge, ConfirmDialog, Drawer, ErrorState, RiskBadge, ScopeChip } from "./ui";

type Props = {
  employeeId: string; catalogue: Catalogue; roles: CustomRole[]; departments: string[]; locations: string[]; canManage: boolean;
  onClose: () => void; onChanged: (message: string) => void;
};
const ELEVATED = ["OWNER", "HR_ADMIN", "PAYROLL_ADMIN"];
const plusDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

export function PersonDrawer({ employeeId, catalogue, roles, departments, locations, canManage, onClose, onChanged }: Props) {
  const index = useMemo(() => indexCatalogue(catalogue), [catalogue]);
  const [data, setData] = useState<PersonDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ roleId: "", until: "", department: "", location: "" });
  const [impact, setImpact] = useState<AssignImpact | null>(null);
  const [impactError, setImpactError] = useState("");
  const [baseRole, setBaseRole] = useState("");
  const [dialog, setDialog] = useState<null | { kind: "assign" | "revoke" | "base"; assignmentId?: string; label?: string }>(null);
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { const detail = await accessApi.person(employeeId); setData(detail); setBaseRole(detail.person.baseRole || ""); }
    catch (reason) { setError(errorText(reason, "Unable to load this person's access.")); }
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);

  const expiresAt = form.until ? new Date(`${form.until}T23:59:59+05:30`).toISOString() : undefined;
  const assignBody = { employeeId, roleId: form.roleId, expiresAt, department: form.department || undefined, location: form.location || undefined };
  useEffect(() => {
    setImpact(null); setImpactError("");
    if (!form.roleId) return;
    let live = true;
    accessApi.assign({ ...assignBody, dryRun: true }).then((result) => live && setImpact(result)).catch((reason) => live && setImpactError(errorText(reason, "Unable to check this assignment.")));
    return () => { live = false; };
  }, [form.roleId, form.until, form.department, form.location]); // eslint-disable-line react-hooks/exhaustive-deps

  const person = data?.person;
  const locked = !canManage || !!person?.isSelf;
  const heldRoleIds = new Set(data?.assignments.map((item) => item.roleId));
  const assignable = roles.filter((role) => role.status === "ACTIVE" && !heldRoleIds.has(role.id));

  const run = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true); setDialogError("");
    try { await work(); setDialog(null); onChanged(message); await load(); return true; }
    catch (reason) { setDialogError(errorText(reason, "That didn't work.")); return false; }
    finally { setBusy(false); }
  };
  const assign = (reason?: string) => run(() => accessApi.assign({ ...assignBody, ...(reason ? { confirm: true, reason } : {}) }), `Role assigned to ${person?.name}`)
    .then((ok) => { if (ok) { setAdding(false); setForm({ roleId: "", until: "", department: "", location: "" }); } });

  const head = person && (
    <div className="ax-person-head">
      <span className="cw-avatar">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
      <div>
        <p>{person.number} · {person.designation || "—"}</p>
        <p className="cw-head-meta">{person.department && <span>{person.department}</span>}{person.location && <span><MapPin size={12} /> {person.location}</span>}
          {person.baseRole ? <Badge tone={ELEVATED.includes(person.baseRole) ? "warning" : "neutral"} label={BASE_ROLE_LABEL[person.baseRole]} /> : <Badge tone="neutral" label="No sign-in yet" />}
          {person.isSelf && <Badge tone="info" label="You" />}</p>
      </div>
    </div>
  );

  return (
    <Drawer title={person?.name || "Loading…"} eyebrow="ACCESS · PERSON" onClose={onClose} head={head} wide>
      {error && <ErrorState message={error} onRetry={load} />}
      {!data ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <>
          {person?.isSelf && <p className="cw-alert warn"><UserX size={15} /><span>You can&apos;t change your own access. Another administrator has to do it — this keeps every grant reviewed by a second person.</span></p>}
          {!person?.hasLogin && <p className="ax-note"><KeyRound size={14} /> {person?.name} hasn&apos;t signed in yet. Custom roles you assign take effect at their first sign-in.</p>}

          <section className="ax-card">
            <header><h3>Base role</h3><small>Set on the membership; defines the built-in permissions</small></header>
            {person?.baseRole ? (
              <div className="ax-base-row">
                <select value={baseRole} onChange={(event) => setBaseRole(event.target.value)} disabled={locked} aria-label="Base role">
                  {catalogue.baseRoles.map((role) => <option key={role} value={role}>{BASE_ROLE_LABEL[role]}</option>)}
                </select>
                {!locked && baseRole !== person.baseRole && <button className="cw-btn primary" onClick={() => { setDialogError(""); setDialog({ kind: "base" }); }}>Change to {BASE_ROLE_LABEL[baseRole]}</button>}
                <p>{data.baseRole?.description}</p>
              </div>
            ) : <p className="ax-muted">No membership yet — invite them to sign in first.</p>}
          </section>

          <section className="ax-card">
            <header>
              <h3>Custom roles</h3><small>{data.assignments.length ? `${data.assignments.length} active` : "None"}</small>
              {!locked && !adding && <button className="cw-btn ghost" onClick={() => setAdding(true)} disabled={!assignable.length}><Plus size={15} /> Add role</button>}
            </header>
            {data.assignments.map((item) => (
              <div key={item.assignmentId} className="ax-assignment">
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.expiresAt ? <><CalendarClock size={12} /> until {dateLabel(item.expiresAt)}</> : "Ongoing"}
                    {(item.department || item.location) && <> · only {[item.department, item.location].filter(Boolean).join(" / ")}</>}
                    {item.grantedBy && <> · granted by {item.grantedBy} on {dateLabel(item.createdAt)}</>}
                  </small>
                  {item.reason && <em>“{item.reason}”</em>}
                </div>
                {!locked && <button className="cw-btn danger" onClick={() => { setDialogError(""); setDialog({ kind: "revoke", assignmentId: item.assignmentId, label: item.name }); }}>Remove</button>}
              </div>
            ))}
            {adding && (
              <form className="ax-assign-form" onSubmit={(event) => { event.preventDefault(); if (!form.roleId || !impact) return; if (impact.confirmationRequired) { setDialogError(""); setDialog({ kind: "assign" }); } else assign(); }}>
                <div className="cw-fields">
                  <label className="wide"><span>Role <em>*</em></span>
                    <select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} required autoFocus>
                      <option value="">Choose a role…</option>
                      {assignable.map((role) => <option key={role.id} value={role.id}>{role.name} — {role.grants.length} permission{role.grants.length === 1 ? "" : "s"}{role.highestRisk === "CRITICAL" ? " · critical" : ""}</option>)}
                    </select>
                  </label>
                  <label><span>Access ends <small>optional — temporary access</small></span>
                    <input type="date" min={plusDays(1)} max={plusDays(730)} value={form.until} onChange={(event) => setForm({ ...form, until: event.target.value })} />
                  </label>
                  <div className="ax-quick" role="group" aria-label="Quick durations">
                    {[[7, "1 week"], [30, "30 days"], [90, "90 days"]].map(([days, label]) => <button type="button" key={label} onClick={() => setForm({ ...form, until: plusDays(days as number) })}>{label}</button>)}
                    {form.until && <button type="button" onClick={() => setForm({ ...form, until: "" })}>Ongoing</button>}
                  </div>
                  <label><span>Only in department <small>optional</small></span>
                    <select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option value="">Any department</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
                  </label>
                  <label><span>Only at location <small>optional</small></span>
                    <select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}><option value="">Any location</option>{locations.map((item) => <option key={item}>{item}</option>)}</select>
                  </label>
                </div>
                {impactError && <ErrorState message={impactError} />}
                {impact && (
                  <div className="ax-impact" aria-live="polite">
                    <p><ShieldCheck size={15} /> {impact.gained.length ? <>Adds <b>{impact.gained.length}</b> permission{impact.gained.length === 1 ? "" : "s"} they don&apos;t have today:</> : "They already hold everything in this role — nothing new is granted."}</p>
                    {!!impact.gained.length && <div className="ax-chipline">{impact.gained.map((grant) => <span key={grant.key}>{index.get(grant.key)?.label}{index.get(grant.key)?.scopable ? ` · ${SCOPE_SHORT[grant.scope]}` : ""}</span>)}</div>}
                    {impact.newSod.map((rule) => <p key={rule.id} className="ax-impact-warn"><TriangleAlert size={14} /> {rule.message}</p>)}
                    {impact.confirmationRequired && <p className="ax-impact-warn danger"><TriangleAlert size={14} /> Includes critical access — you&apos;ll confirm with a reason.</p>}
                  </div>
                )}
                <div className="cw-create-foot">
                  <button type="button" className="cw-btn ghost" onClick={() => { setAdding(false); setForm({ roleId: "", until: "", department: "", location: "" }); }}>Cancel</button>
                  <button className="cw-btn primary" disabled={busy || !impact}>{busy ? "Assigning…" : "Assign role"}</button>
                </div>
              </form>
            )}
            {!data.assignments.length && !adding && <p className="ax-muted">Only the base role applies.</p>}
          </section>

          {data.sod.length > 0 && (
            <div className="ax-sod"><TriangleAlert size={16} /><div><b>Separation-of-duties</b>{data.sod.map((rule) => <p key={rule.id}>{rule.message}</p>)}</div></div>
          )}

          <section className="ax-card">
            <header><h3>What {person?.name.split(" ")[0]} can do</h3><small>Effective permissions and where each comes from</small></header>
            <EffectiveList groups={data.effective} />
          </section>

          {!!data.history.length && (
            <section className="ax-card">
              <header><h3>Assignment history</h3></header>
              <ul className="ax-mini-history">
                {data.history.map((item) => (
                  <li key={item.id}>
                    <b>{item.role}</b>
                    <span>Granted {dateLabel(item.createdAt)}{item.grantedBy ? ` by ${item.grantedBy}` : ""}</span>
                    <span>{item.revokedAt ? `${item.revokeReason === "Expired" ? "Expired" : "Removed"} ${dateLabel(item.revokedAt)}${item.revokedBy ? ` by ${item.revokedBy}` : ""}${item.revokeReason && item.revokeReason !== "Expired" ? ` — ${item.revokeReason}` : ""}` : item.expiresAt ? `Ends ${dateLabel(item.expiresAt)}` : "Active"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {dialog?.kind === "assign" && impact && (
        <ConfirmDialog danger title="Grant critical access?" confirmLabel="Assign role" busy={busy} error={dialogError}
          items={impact.critical.map((grant) => index.get(grant.key)?.label || grant.key)}
          body={<p>{person?.name} will be able to do the following{form.until ? ` until ${dateLabel(expiresAt!)}` : ""}:</p>}
          onConfirm={(reason) => assign(reason)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "revoke" && (
        <ConfirmDialog title={`Remove “${dialog.label}”?`} confirmLabel="Remove role" busy={busy} error={dialogError}
          body={<p>{person?.name} loses this access on their next request. They&apos;ll be notified.</p>}
          onConfirm={(reason) => run(() => accessApi.revoke(dialog.assignmentId!, reason), `“${dialog.label}” removed from ${person?.name}`)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "base" && person?.baseRole && (
        <ConfirmDialog danger={ELEVATED.includes(baseRole)} title={`Change base role to ${BASE_ROLE_LABEL[baseRole]}?`} confirmLabel="Change base role" busy={busy} error={dialogError}
          body={<p>{person.name} moves from <b>{BASE_ROLE_LABEL[person.baseRole]}</b> to <b>{BASE_ROLE_LABEL[baseRole]}</b>. This changes every built-in permission they have.</p>}
          onConfirm={(reason) => run(() => accessApi.baseRole(employeeId, { role: baseRole, expectedRole: person.baseRole!, reason, confirm: true }), `${person.name} is now ${BASE_ROLE_LABEL[baseRole]}`)}
          onClose={() => { setDialog(null); }} />
      )}
    </Drawer>
  );
}

export function EffectiveList({ groups }: { groups: PersonDetail["effective"] }) {
  if (!groups.length) return <p className="ax-muted">No permissions.</p>;
  return (
    <div className="ax-effective">
      {groups.map((group) => (
        <div key={group.key}>
          <h4>{group.label}</h4>
          <ul>
            {group.permissions.map((permission) => (
              <li key={permission.key}>
                <span className="ax-eff-name"><b>{permission.label}</b><RiskBadge risk={permission.risk} compact /></span>
                <ScopeChip info={permission.scope} scopable={permission.scopable} />
                <span className="ax-sources">
                  {permission.sources.map((source, i) => (
                    <span key={i} className={source.type === "BASE" ? "base" : "custom"} title={source.type === "CUSTOM" && source.expiresAt ? `Until ${dateLabel(source.expiresAt)}` : undefined}>
                      {source.type === "BASE" ? `Base · ${source.roleName}` : source.roleName}{source.type === "CUSTOM" && source.expiresAt ? " ⏱" : ""}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
