"use client";
import { ChevronLeft, ChevronRight, Download, FileClock, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { accessApi, dateTimeLabel, errorText, humanAction, type AuditEntry, type AuditFacets, type AuditPage } from "./api";
import { Drawer, ErrorState } from "./ui";

type Filters = { actor: string; action: string; entityType: string; from: string; to: string };
const EMPTY: Filters = { actor: "", action: "", entityType: "", from: "", to: "" };

export function AuditPanel({ flash }: { flash: (message: string) => void }) {
  const [facets, setFacets] = useState<AuditFacets | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { accessApi.auditFacets().then(setFacets).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setError("");
    try { setData(await accessApi.audit({ ...filters, page, pageSize: 25 })); }
    catch (reason) { setError(errorText(reason, "Unable to load the audit log.")); }
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);
  const set = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="ax-audit">
      {facets && (
        <div className="ax-audit-stats">
          <span><b>{facets.counts.day}</b> changes in 24 h</span><span><b>{facets.counts.week}</b> this week</span><span><b>{facets.counts.total.toLocaleString("en-IN")}</b> recorded</span>
        </div>
      )}
      <form className="ax-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filter audit log">
        <label><span>Who</span>
          <select value={filters.actor} onChange={(event) => set("actor", event.target.value)}>
            <option value="">Anyone</option>{facets?.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}{actor.number ? ` (${actor.number})` : ""} · {actor.count}</option>)}
          </select>
        </label>
        <label><span>Action</span>
          <select value={filters.action} onChange={(event) => set("action", event.target.value)}>
            <option value="">Any action</option>{facets?.actions.map((action) => <option key={action.key} value={action.key}>{humanAction(action.key)} · {action.count}</option>)}
          </select>
        </label>
        <label><span>Record type</span>
          <select value={filters.entityType} onChange={(event) => set("entityType", event.target.value)}>
            <option value="">Any record</option>{facets?.entityTypes.map((entity) => <option key={entity.key} value={entity.key}>{humanAction(entity.key)} · {entity.count}</option>)}
          </select>
        </label>
        <label><span>From</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => set("from", event.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => set("to", event.target.value)} /></label>
        <div className="ax-filter-actions">
          {active && <button type="button" className="cw-btn ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}><RotateCcw size={14} /> Reset</button>}
          <button type="button" className="cw-btn ghost" onClick={() => accessApi.exportAudit({ ...filters }).then(() => flash("Audit log exported")).catch((reason) => flash(errorText(reason, "Export failed")))}><Download size={14} /> CSV</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data ? <div className="cw-list-skeleton"><i /><i /><i /><i /></div> : !data.items.length ? (
        <div className="cw-empty"><span><FileClock size={24} /></span><h2>No matching changes</h2><p>{active ? "Try widening the filters." : "Changes appear here as people use Northstar."}</p></div>
      ) : (
        <>
          <div className="cw-table ax-audit-table" role="table" aria-label="Audit log">
            <div className="cw-row head" role="row"><span role="columnheader">When</span><span role="columnheader">Who</span><span role="columnheader">Action</span><span role="columnheader">Record</span><span role="columnheader">Detail</span></div>
            {data.items.map((item) => (
              <button key={item.id} role="row" className="cw-row" onClick={() => setOpen(item.id)}>
                <span role="cell" className="ax-when">{dateTimeLabel(item.createdAt)}</span>
                <span role="cell" className="cw-title-cell"><b>{item.actorName || "System"}</b><small>{item.actorNumber || ""}</small></span>
                <span role="cell"><span className="ax-action">{humanAction(item.action)}</span></span>
                <span role="cell" className="cw-title-cell"><b>{humanAction(item.entityType)}</b><small>{item.entityId.slice(0, 8)}</small></span>
                <span role="cell" className="ax-summary-cell">{item.summary || <span className="ax-muted">{item.hasBefore ? "Before & after recorded" : "Details recorded"}</span>}</span>
              </button>
            ))}
          </div>
          <nav className="ax-pager" aria-label="Audit log pages">
            <span>{((data.page - 1) * data.pageSize + 1).toLocaleString("en-IN")}–{Math.min(data.page * data.pageSize, data.total).toLocaleString("en-IN")} of {data.total.toLocaleString("en-IN")}</span>
            <button className="cw-icon-button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="cw-icon-button" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
          </nav>
        </>
      )}
      {open && <AuditEntryDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AuditEntryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { accessApi.auditEntry(id).then(setEntry).catch((reason) => setError(errorText(reason, "Unable to load this entry."))); }, [id]);
  const before = (entry?.before && typeof entry.before === "object" ? entry.before : {}) as Record<string, unknown>;
  const after = (entry?.after && typeof entry.after === "object" ? entry.after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const show = (value: unknown) => value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 1);
  return (
    <Drawer title={entry ? humanAction(entry.action) : "Audit entry"} eyebrow={`AUDIT · #${id}`} onClose={onClose} wide>
      {error && <ErrorState message={error} />}
      {!entry ? <div className="cw-list-skeleton"><i /><i /></div> : (
        <>
          <dl className="cw-facts">
            <div><dt>When</dt><dd>{dateTimeLabel(entry.createdAt)}</dd></div>
            <div><dt>Who</dt><dd>{entry.actorName || "System"}<small>{[entry.actorNumber, entry.actorDesignation].filter(Boolean).join(" · ")}</small></dd></div>
            <div><dt>Record type</dt><dd>{humanAction(entry.entityType)}</dd></div>
            <div><dt>Record id</dt><dd><code>{entry.entityId}</code></dd></div>
          </dl>
          {!keys.length ? <p className="ax-muted">No data was recorded with this change.</p> : (
            <div className="ax-json-diff" role="table" aria-label="Before and after">
              <div className="head" role="row"><span role="columnheader">Field</span><span role="columnheader">Before</span><span role="columnheader">After</span></div>
              {keys.map((key) => {
                const changed = JSON.stringify(before[key]) !== JSON.stringify(after[key]);
                return (
                  <div key={key} role="row" className={changed && entry.before ? "changed" : ""}>
                    <span role="cell"><code>{key}</code></span>
                    <span role="cell"><pre>{show(before[key])}</pre></span>
                    <span role="cell"><pre>{show(after[key])}</pre></span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
