"use client";
import { AlertTriangle, ArrowRight, ChevronRight, Clock3, Inbox, MapPin, Plus, Search, Sparkles, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { caseUi } from "@/lib/case-ui";
import { caseApi, dueLabel, initials, loadDefinitions, money, relativeTime, shortDate, useCaseModule, useCases, type CaseItem, type CaseModule, type Viewer } from "@/lib/cases";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { CaseDrawer, StatusBadge } from "./case-drawer";
import { CaseFields, cleanValues } from "./case-form";
import { ReceiptScanner, type ReceiptScan } from "./receipt-scanner";
import { httpRequest } from "@/lib/http-client";

type Scope = "mine" | "team" | "all";
/** Optional housekeeping (cancel, withdraw) does not count as work waiting on the viewer. */
export const needsAction = (item: CaseItem) => item.actions.some((action) => !action.optional);

export function CaseWorkspace({ moduleKey }: { moduleKey: string }) {
  const { module, viewer, error: definitionError } = useCaseModule(moduleKey);
  if (definitionError) return <div className="cw-page"><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {definitionError} Make sure the platform API is running (<code>npm run backend:v2:dev</code>).</p></div>;
  if (!module || !viewer) return <div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  return <Workspace module={module} viewer={viewer} />;
}

function Workspace({ module, viewer }: { module: CaseModule; viewer: Viewer }) {
  const ui = caseUi[module.key];
  const Icon = ui.icon;
  const isManager = viewer.roles.includes("MANAGER") || viewer.isHr;
  const canSeeAll = viewer.isHr || module.visibility === "public";
  const defaultScope: Scope = module.visibility === "public" || viewer.isHr ? "all" : "mine";
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ module: CaseModule; preset?: Record<string, string> } | null>(null);
  const [candidateModule, setCandidateModule] = useState<CaseModule | null>(null);
  const [toast, setToast] = useState("");
  const { items, counts, loading, error, reload } = useCases(module.key, scope, status, query);
  const canCreate = !module.createRoles || module.createRoles.some((role) => viewer.roles.includes(role));

  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setStatus(""); }, [scope]);
  useEffect(() => {
    if (module.key === "requisitions") loadDefinitions().then(({ items: all }) => setCandidateModule(all.find((item) => item.key === "candidates") || null)).catch(() => {});
  }, [module.key]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const terminal = new Set(module.statuses.filter((item) => item.terminal).map((item) => item.key));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const open = counts.filter((row) => !terminal.has(row.status)).reduce((sum, row) => sum + row.count, 0);
  const closed = total - open;
  const actionable = items.filter(needsAction).length;
  const hasMoney = module.fields.some((field) => field.type === "money") && (viewer.isHr || module.visibility !== "public");
  const value = counts.filter((row) => !["REJECTED", "WITHDRAWN", "CANCELLED"].includes(row.status)).reduce((sum, row) => sum + row.amount, 0);
  const countFor = (key: string) => counts.find((row) => row.status === key)?.count || 0;

  const scopes: { key: Scope; label: string; show: boolean }[] = [
    { key: "all", label: module.visibility === "public" && !viewer.isHr ? (module.key === "recognition" ? "Company wall" : "Open roles") : "All requests", show: canSeeAll && module.visibility === "public" },
    { key: "mine", label: module.key === "recognition" ? "Given & received" : module.key === "candidates" ? "My referrals" : "My requests", show: true },
    { key: "team", label: viewer.isHr ? "My queue" : "Team queue", show: isManager && module.visibility !== "public" },
    { key: "all", label: "All requests", show: canSeeAll && module.visibility !== "public" },
  ];

  return (
    <div className="cw-page" style={{ ["--accent" as string]: ui.accent }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Icon size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">{module.group.toUpperCase()} · {ui.eyebrow}</p>
          <h1>{module.label}</h1>
          <p>{module.description}</p>
        </div>
        {canCreate && <button className="cw-btn primary lg" onClick={() => setCreating({ module })}><Plus size={17} /> {ui.createLabel}</button>}
      </header>

      {ui.layout === "wall" ? <WallStats items={items} viewer={viewer} /> : (
      <section className="cw-stats" aria-label="Summary">
        <article><small>Open</small><b>{open}</b><span>{scope === "mine" ? "raised by you" : "in this view"}</span></article>
        <article className={actionable ? "attention" : ""}><small>Needs your action</small><b>{actionable}</b><span>{actionable ? "review below" : "you're all caught up"}</span></article>
        <article><small>Completed</small><b>{closed}</b><span>of {total} total</span></article>
        {hasMoney ? <article><small>Total value</small><b>{money(value)}</b><span>excluding rejected</span></article>
          : <article><small>Latest</small><b className="text">{items[0] ? relativeTime(items[0].createdAt) : "—"}</b><span>{items[0]?.caseNumber || "no activity yet"}</span></article>}
      </section>
      )}

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist">
          {scopes.filter((item) => item.show).map((item) => (
            <button key={item.key + item.label} role="tab" aria-selected={scope === item.key} className={scope === item.key ? "active" : ""} onClick={() => setScope(item.key)}>{item.label}</button>
          ))}
        </div>
        <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${module.label.toLowerCase()}`} aria-label="Search" />{search && <button aria-label="Clear" onClick={() => setSearch("")}><X size={13} /></button>}</label>
      </div>
      {ui.layout !== "wall" && (
        <div className="cw-chips" aria-label="Filter by status">
          <button className={!status ? "active" : ""} onClick={() => setStatus("")}>All <b>{total}</b></button>
          {module.statuses.filter((item) => countFor(item.key) || status === item.key).map((item) => (
            <button key={item.key} className={status === item.key ? "active" : ""} onClick={() => setStatus(status === item.key ? "" : item.key)}><i className={`dot tone-${item.tone}`} />{item.label} <b>{countFor(item.key)}</b></button>
          ))}
        </div>
      )}

      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {loading && !items.length ? <div className="cw-list-skeleton"><i /><i /><i /></div>
        : !items.length ? (
          <div className="cw-empty">
            <span><Inbox size={26} /></span>
            <h2>{query || status ? "No matches" : scope === "mine" ? `No ${module.singular}s yet` : "Queue is clear"}</h2>
            <p>{query || status ? "Try a different search or status filter." : scope === "mine" ? ui.emptyMine : "Nothing needs attention here right now."}</p>
            {canCreate && !query && !status && <button className="cw-btn primary" onClick={() => setCreating({ module })}><Plus size={16} /> {ui.createLabel}</button>}
          </div>
        ) : ui.layout === "wall" ? <RecognitionWall items={items} onOpen={setOpenId} />
        : ui.layout === "board" ? <JobBoard items={items} onOpen={setOpenId} onRefer={candidateModule ? (job) => setCreating({ module: candidateModule, preset: { position: `${job.title}${job.details.location ? ` — ${job.details.location}` : ""}`, category: "Employee referral" } }) : undefined} />
        : <CaseTable module={module} items={items} scope={scope} onOpen={setOpenId} />}

      {openId && <CaseDrawer id={openId} module={module} onClose={() => setOpenId(null)} onChanged={reload} />}
      {creating && (
        <CreateDrawer module={creating.module} preset={creating.preset} viewer={viewer} onClose={() => setCreating(null)}
          onCreated={(item, note) => {
            setCreating(null);
            flash(note || `${item.caseNumber} created — ${item.statusLabel.toLowerCase()}`);
            if (item.module === module.key) { reload(); setOpenId(item.id); }
          }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function CaseTable({ module, items, scope, onOpen }: { module: CaseModule; items: CaseItem[]; scope: Scope; onOpen: (id: string) => void }) {
  const ui = caseUi[module.key];
  const hasAmount = module.fields.some((field) => field.column === "amount");
  const hasDate = module.fields.some((field) => field.column === "startDate" || field.column === "endDate");
  const dateOf = (item: CaseItem) => module.key === "exit" ? item.endDate : item.startDate || item.endDate;
  return (
    <div className="cw-table" role="table">
      <div className="cw-row head" role="row">
        <span role="columnheader">Request</span>
        <span role="columnheader">{scope === "mine" ? "With" : "Employee"}</span>
        {hasDate ? <span role="columnheader">{ui.dateLabel || "Date"}</span> : <span role="columnheader">Raised</span>}
        {hasAmount ? <span role="columnheader" className="num">Amount</span> : <span role="columnheader">{module.slaHours ? "SLA" : "Updated"}</span>}
        <span role="columnheader">Status</span>
        <span />
      </div>
      {items.map((item) => (
        <button key={item.id} className={`cw-row ${needsAction(item) ? "actionable" : ""}`} role="row" onClick={() => onOpen(item.id)}>
          <span className="cw-title-cell" role="cell">
            <small>{item.caseNumber}{item.category ? ` · ${item.category}` : ""}</small>
            <b>{item.title}</b>
            {item.details.policyFlag && <em className="cw-flag"><AlertTriangle size={11} /> {item.details.policyFlag}</em>}
          </span>
          <span className="cw-person" role="cell">
            {scope === "mine" ? (
              <><span className="cw-avatar small muted">{initials(item.assignee?.name || item.approver?.name || "HR")}</span><span>{item.assignee?.name || item.approver?.name || (module.routing === "none" ? item.subject?.name || "—" : "HR desk")}<small>{item.assignee ? "handling" : item.approver ? "approver" : module.routing === "none" ? "recipient" : "queue"}</small></span></>
            ) : (
              <><span className="cw-avatar small">{initials(item.requester.name)}</span><span>{item.requester.name}<small>{item.requester.designation || item.requester.department}</small></span></>
            )}
          </span>
          <span role="cell">{hasDate ? shortDate(dateOf(item)) : relativeTime(item.createdAt)}</span>
          {hasAmount ? <span role="cell" className="num">{money(item.amount)}</span>
            : <span role="cell" className={item.overdue ? "cw-sla-cell over" : "cw-sla-cell"}>{module.slaHours ? (item.slaStopped ? "Met" : <><Clock3 size={12} /> {dueLabel(item.dueAt, item.slaStopped)}</>) : relativeTime(item.updatedAt)}</span>}
          <span role="cell"><StatusBadge tone={item.tone} label={item.statusLabel} /></span>
          <span role="cell" className="cw-row-cta">{needsAction(item) ? <em>Review</em> : null}<ChevronRight size={16} /></span>
        </button>
      ))}
    </div>
  );
}

function WallStats({ items, viewer }: { items: CaseItem[]; viewer: Viewer }) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const values = new Map<string, number>();
  for (const item of items) if (item.category) values.set(item.category, (values.get(item.category) || 0) + 1);
  const top = [...values.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="cw-stats" aria-label="Summary">
      <article><small>This month</small><b>{items.filter((item) => new Date(item.createdAt) >= monthStart).length}</b><span>kudos shared</span></article>
      <article className="attention"><small>You received</small><b>{items.filter((item) => item.subject?.id === viewer.employeeId).length}</b><span>thank-you notes</span></article>
      <article><small>You gave</small><b>{items.filter((item) => item.requester.id === viewer.employeeId).length}</b><span>keep it going</span></article>
      <article><small>Most celebrated</small><b className="text">{top?.[0] || "—"}</b><span>{top ? `${top[1]} kudos` : "no kudos yet"}</span></article>
    </section>
  );
}

function RecognitionWall({ items, onOpen }: { items: CaseItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="cw-wall">
      {items.map((item, index) => (
        <button key={item.id} className={`cw-kudos v${index % 4}`} onClick={() => onOpen(item.id)}>
          <span className="cw-kudos-value"><Sparkles size={13} /> {item.category}</span>
          <h3>{item.title}</h3>
          <p>“{item.details.message}”</p>
          <footer>
            <span className="cw-avatar">{initials(item.subject?.name)}</span>
            <span><b>{item.subject?.name}</b><small>from {item.requester.name} · {relativeTime(item.createdAt)}</small></span>
          </footer>
          {item.status !== "PUBLISHED" && <StatusBadge tone={item.tone} label={item.statusLabel} />}
        </button>
      ))}
    </div>
  );
}

function JobBoard({ items, onOpen, onRefer }: { items: CaseItem[]; onOpen: (id: string) => void; onRefer?: (item: CaseItem) => void }) {
  return (
    <div className="cw-board">
      {items.map((item) => (
        <article key={item.id} className="cw-job">
          <header>
            <small>{item.category} · {item.caseNumber}</small>
            <StatusBadge tone={item.tone} label={item.statusLabel} />
          </header>
          <h3>{item.title}</h3>
          <p className="cw-job-meta">
            {item.details.location && <span><MapPin size={13} /> {item.details.location}</span>}
            {item.details.openings && <span><Users size={13} /> {item.details.openings} opening{Number(item.details.openings) > 1 ? "s" : ""}</span>}
            {item.details.employmentType && <span>{item.details.employmentType}</span>}
          </p>
          <p className="cw-job-summary">{item.details.description}</p>
          <footer>
            <button className="cw-btn ghost" onClick={() => onOpen(item.id)}>Details</button>
            {item.status === "OPEN" && onRefer && <button className="cw-btn primary" onClick={() => onRefer(item)}>Refer someone <ArrowRight size={14} /></button>}
          </footer>
        </article>
      ))}
    </div>
  );
}

function CreateDrawer({ module, preset, viewer, onClose, onCreated }: { module: CaseModule; preset?: Record<string, string>; viewer: Viewer; onClose: () => void; onCreated: (item: CaseItem, note?: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const initial = useMemo(() => ({ ...(module.fields.some((field) => field.key === "priority") ? { priority: "MEDIUM" } : {}), ...preset }), [module, preset]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<ReceiptScan | null>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDialogFocus(true, close, ref);
  const ui = caseUi[module.key];
  const applyScan = (result: ReceiptScan) => {
    setScan(result);
    const { merchant, date, total, category } = result.fields;
    setValues((current) => ({
      ...current,
      ...(category && module.fields.find((field) => field.key === "category")?.options?.includes(category) ? { category } : {}),
      ...(merchant ? { merchant, title: current.title || `${merchant}${category ? ` — ${category.toLowerCase()}` : ""}` } : {}),
      ...(total !== undefined ? { amount: String(total) } : {}),
      ...(date ? { startDate: date } : {}),
    }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const created = await caseApi.create(module.key, cleanValues(module.fields, values));
      let note: string | undefined;
      if (scan) {
        // The claim exists either way; a failed attach is reported so the bill can be added from the claim.
        await httpRequest(`/api/v2/receipts/${scan.scanId}/attach`, { method: "POST", body: { caseId: created.id } })
          .catch(() => { note = `${created.caseNumber} created, but the receipt couldn't be attached — add it from the claim`; });
      }
      onCreated(created, note);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit."); }
    finally { setBusy(false); }
  };
  const route = module.routing === "manager" ? "Goes to your reporting manager for approval." : module.routing === "hr" ? "Goes straight to the HR desk." : "Published immediately.";
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={close} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cw-create-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: ui.accent }}>
          <button className="cw-icon-button" aria-label="Close" onClick={close}><X size={18} /></button>
          <p className="cw-eyebrow">NEW {module.singular.toUpperCase()}</p>
          <h2 id="cw-create-title">{ui.createLabel}</h2>
          <p className="cw-head-note">{route}{module.slaHours ? ` Response target: ${module.slaHours.MEDIUM} h for medium priority.` : ""}</p>
        </header>
        <form className="cw-drawer-body cw-create" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {module.key === "expenses" && <ReceiptScanner scan={scan} onScanned={applyScan} onClear={() => setScan(null)} />}
          <CaseFields fields={module.fields} values={values} limits={module.limits} excludeEmployeeId={viewer.employeeId} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
          <footer className="cw-create-foot">
            <button type="button" className="cw-btn ghost" onClick={close}>Cancel</button>
            <button className="cw-btn primary" disabled={busy}>{busy ? "Submitting…" : "Submit"}</button>
          </footer>
        </form>
      </aside>
    </>
  );
}
