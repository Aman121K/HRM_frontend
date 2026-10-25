"use client";
import { Download, Search, ShieldQuestion, UserSearch, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { accessApi, BASE_ROLE_LABEL, dateLabel, errorText, indexCatalogue, type Catalogue, type PersonDetail, type PersonRow, type WhoCan } from "./api";
import { EffectiveList } from "./person-drawer";
import { ErrorState, RiskBadge, ScopeChip } from "./ui";

export function ReviewPanel({ catalogue, canManage, onOpenPerson, flash }: { catalogue: Catalogue; canManage: boolean; onOpenPerson: (id: string) => void; flash: (message: string) => void }) {
  const [mode, setMode] = useState<"permission" | "person">("permission");
  return (
    <div className="ax-review">
      <div className="ax-review-head">
        <div className="cw-chips" role="group" aria-label="Review mode">
          <button className={mode === "permission" ? "active" : ""} aria-pressed={mode === "permission"} onClick={() => setMode("permission")}><ShieldQuestion size={14} /> Who can do…</button>
          <button className={mode === "person" ? "active" : ""} aria-pressed={mode === "person"} onClick={() => setMode("person")}><UserSearch size={14} /> What can this person do</button>
        </div>
        <button className="cw-btn ghost" onClick={() => accessApi.exportReview().then(() => flash("Full access review exported")).catch((reason) => flash(errorText(reason, "Export failed")))}>
          <Download size={15} /> Export everyone (CSV)
        </button>
      </div>
      {mode === "permission" ? <WhoCanView catalogue={catalogue} flash={flash} onOpenPerson={onOpenPerson} canManage={canManage} /> : <PersonView canManage={canManage} onOpenPerson={onOpenPerson} />}
    </div>
  );
}

function WhoCanView({ catalogue, flash, onOpenPerson, canManage }: { catalogue: Catalogue; flash: (message: string) => void; onOpenPerson: (id: string) => void; canManage: boolean }) {
  const index = useMemo(() => indexCatalogue(catalogue), [catalogue]);
  const [key, setKey] = useState("payroll.run.approve");
  const [data, setData] = useState<WhoCan | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null); setError("");
    accessApi.whoCan(key).then(setData).catch((reason) => setError(errorText(reason, "Unable to run this review.")));
  }, [key]);
  const quick = ["settings.access", "payroll.run.approve", "payroll.profile.edit", "people.sensitive.view", "audit.view", "leave.approve"];
  const permission = index.get(key);
  return (
    <>
      <div className="ax-who-bar">
        <label className="cw-fields ax-inline-field"><span>Permission</span>
          <select value={key} onChange={(event) => setKey(event.target.value)}>
            {catalogue.groups.map((group) => (
              <optgroup key={group.key} label={group.label}>{group.permissions.map((item) => <option key={item.key} value={item.key}>{item.label} ({item.key})</option>)}</optgroup>
            ))}
          </select>
        </label>
        <div className="ax-quick" role="group" aria-label="Common reviews">
          {quick.map((item) => <button key={item} className={item === key ? "active" : ""} onClick={() => setKey(item)}>{index.get(item)?.label}</button>)}
        </div>
      </div>
      {permission && (
        <div className="ax-who-summary">
          <div><b>{permission.label}</b> <RiskBadge risk={permission.risk} /><p>{permission.description}</p></div>
          <div className="ax-who-count"><b>{data ? data.items.length : "…"}</b><small>{data?.items.length === 1 ? "person" : "people"}</small></div>
          <button className="cw-btn ghost" onClick={() => accessApi.exportReview(key).then(() => flash("Exported")).catch((reason) => flash(errorText(reason, "Export failed")))}><Download size={15} /> CSV</button>
        </div>
      )}
      {error && <ErrorState message={error} />}
      {!data && !error ? <div className="cw-list-skeleton"><i /><i /><i /></div> : data && !data.items.length ? (
        <div className="cw-empty"><span><ShieldQuestion size={24} /></span><h2>Nobody holds this permission</h2><p>Not through a base role and not through any custom role.</p></div>
      ) : data && (
        <div className="cw-table ax-who-table" role="table" aria-label={`People who hold ${permission?.label}`}>
          <div className="cw-row head" role="row"><span role="columnheader">Person</span><span role="columnheader">Base role</span><span role="columnheader">Scope</span><span role="columnheader">Granted through</span></div>
          {data.items.map((item) => {
            const Row = canManage ? "button" : "div";
            return (
              <Row key={item.person.id} role="row" className="cw-row" onClick={canManage ? () => onOpenPerson(item.person.id) : undefined}>
                <span role="cell" className="cw-person"><span className="cw-avatar small">{item.person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <span>{item.person.name}<small>{item.person.number} · {item.person.designation || "—"}</small></span></span>
                <span role="cell">{item.person.baseRole ? BASE_ROLE_LABEL[item.person.baseRole] : <span className="ax-muted">No sign-in</span>}</span>
                <span role="cell"><ScopeChip info={item.scope} scopable={permission?.scopable} /></span>
                <span role="cell" className="ax-sources">
                  {item.sources.map((grant, i) => (
                    <span key={i} className={grant.source.type === "BASE" ? "base" : "custom"}>
                      {grant.source.type === "BASE" ? `Base · ${grant.source.roleName}` : grant.source.roleName}
                      {grant.source.type === "CUSTOM" && grant.source.expiresAt ? ` · until ${dateLabel(grant.source.expiresAt)}` : ""}
                    </span>
                  ))}
                </span>
              </Row>
            );
          })}
        </div>
      )}
    </>
  );
}

function PersonView({ canManage, onOpenPerson }: { canManage: boolean; onOpenPerson: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => accessApi.people({ search, limit: 50 }).then((data) => setPeople(data.items)).catch((reason) => setError(errorText(reason, "Unable to search people."))), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    accessApi.person(selected).then(setDetail).catch((reason) => setError(errorText(reason, "Unable to load access.")));
  }, [selected]);
  return (
    <div className="ax-split">
      <div className="ax-split-list">
        <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people" />
          {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
        {!people ? <div className="cw-list-skeleton"><i /><i /></div> : !people.length ? <p className="ax-muted">No matches.</p> : (
          <ul role="listbox" aria-label="People">
            {people.map((person) => (
              <li key={person.id}>
                <button role="option" aria-selected={selected === person.id} className={selected === person.id ? "active" : ""} onClick={() => setSelected(person.id)}>
                  <b>{person.name}</b><small>{person.number} · {person.baseRole ? BASE_ROLE_LABEL[person.baseRole] : "No sign-in"}{person.customRoles.length ? ` · +${person.customRoles.length} role${person.customRoles.length === 1 ? "" : "s"}` : ""}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ax-split-detail">
        {error && <ErrorState message={error} />}
        {!selected ? <div className="cw-empty"><span><UserSearch size={24} /></span><h2>Pick someone</h2><p>See every permission they hold, at what scope, and which role grants it.</p></div>
          : !detail ? <div className="cw-list-skeleton"><i /><i /><i /></div> : (
            <>
              <div className="ax-split-title">
                <div><h3>{detail.person.name}</h3><small>{detail.person.designation || "—"} · {detail.person.department || "—"}</small></div>
                {canManage && !detail.person.isSelf && <button className="cw-btn ghost" onClick={() => onOpenPerson(detail.person.id)}>Manage access</button>}
              </div>
              {detail.sod.map((rule) => <p key={rule.id} className="ax-impact-warn">{rule.message}</p>)}
              <EffectiveList groups={detail.effective} />
            </>
          )}
      </div>
    </div>
  );
}
