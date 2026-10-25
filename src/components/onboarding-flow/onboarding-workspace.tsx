"use client";
import { AlertTriangle, ArrowRight, CalendarClock, ChevronRight, ClipboardCheck, Inbox, LayoutGrid, List, MapPin, Plus, Search, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortDate } from "@/lib/cases";
import { countdown, errorText, onboardingApi, STATUS_COLUMNS, type Candidate, type JoinerCard, type JoinerStatus, type Pipeline, type Task } from "./api";
import { JoinerDrawer } from "./joiner-drawer";
import { SettingsPanel } from "./settings-panel";
import { Avatar, Badge, currentPhase, PhaseStrip, ProgressBar, TaskRow } from "./shared";
import { TemplateEditor } from "./template-editor";

type Tab = "pipeline" | "tasks" | "templates" | "settings";
const ACCENT = "#0f8177";

export function OnboardingWorkspace() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [status, setStatus] = useState<JoinerStatus | "">("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [showClosed, setShowClosed] = useState(false);
  const [data, setData] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [creating, setCreating] = useState<{ candidate: Candidate | null } | null>(null);
  const [myCount, setMyCount] = useState<{ open: number; overdue: number } | null>(null);
  const [toast, setToast] = useState("");
  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("tab");
    if (initial === "tasks" || initial === "templates" || initial === "settings") setTab(initial);
  }, []);
  const choose = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "pipeline") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (department) params.set("department", department);
      if (query.trim()) params.set("search", query.trim());
      const next = await onboardingApi.pipeline(params);
      setData(next); setError("");
      if (next.viewer.isHr) onboardingApi.candidates().then((result) => setCandidates(result.items)).catch(() => setCandidates([]));
    } catch (reason) { setError(errorText(reason, "Unable to load onboarding.")); }
    finally { setLoading(false); }
  }, [status, department, query]);
  useEffect(() => { load(); }, [load]);
  const loadCounts = useCallback(() => { onboardingApi.myTasks("open").then((result) => setMyCount(result.counts)).catch(() => setMyCount(null)); }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const viewer = data?.viewer;
  // Colleagues who are not HR land on their own task list: that is the part of onboarding they act on.
  const landed = useRef(false);
  useEffect(() => {
    if (!viewer || landed.current) return;
    landed.current = true;
    if (!viewer.isHr && !new URLSearchParams(window.location.search).get("tab")) setTab("tasks");
  }, [viewer]);

  if (error && !data) return (
    <div className="cw-page" style={{ ["--accent" as string]: ACCENT }}>
      <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error} Make sure the platform API is running.</p>
      <button className="cw-btn ghost" onClick={load}>Try again</button>
    </div>
  );
  if (!data || !viewer) return <div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading onboarding" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /></div></div>;

  const countFor = (key: JoinerStatus) => data.counts.find((row) => row.status === key)?.count || 0;
  const total = data.counts.reduce((sum, row) => sum + row.count, 0);
  const tabs: { key: Tab; label: string; badge?: number; show: boolean }[] = [
    { key: "pipeline", label: viewer.isHr ? "Pipeline" : "My joiners", show: true },
    { key: "tasks", label: "My tasks", badge: myCount?.open, show: true },
    { key: "templates", label: "Checklist templates", show: viewer.isHr },
    { key: "settings", label: "Settings", show: viewer.isHr },
  ];
  const buddyPct = data.stats.active ? Math.round((data.stats.with_buddy / data.stats.active) * 100) : null;

  return (
    <div className="cw-page ob-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><UserRoundPlus size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">{viewer.isHr ? "HR ADMIN" : "YOUR TEAM"} · NEW JOINER EXPERIENCE</p>
          <h1>Onboarding</h1>
          <p>From signed offer to a confident first ninety days — paperwork, day-one setup and check-ins, each owned by a real person.</p>
        </div>
        {viewer.isHr && <button className="cw-btn primary lg" onClick={() => setCreating({ candidate: null })}><Plus size={17} /> Add joiner</button>}
      </header>

      {viewer.isHr && candidates.length > 0 && (
        <section className="ob-import" aria-label="Hired candidates">
          <span className="ob-import-icon"><ClipboardCheck size={18} /></span>
          <p><b>{candidates.length} hired candidate{candidates.length > 1 ? "s" : ""} waiting for onboarding</b>
            <small>{candidates.slice(0, 3).map((item) => `${item.name}${item.joiningDate ? ` · joins ${shortDate(item.joiningDate)}` : ""}`).join("  ·  ")}</small></p>
          <div className="ob-import-actions">
            {candidates.slice(0, 3).map((item) => (
              <button key={item.id} className="cw-btn ghost" onClick={() => setCreating({ candidate: item })}>Start onboarding {item.name.split(" ")[0]} <ArrowRight size={14} /></button>
            ))}
          </div>
        </section>
      )}

      <section className="cw-stats" aria-label="Summary">
        <article><small>Joining in 30 days</small><b>{data.stats.joining_soon}</b><span>{data.stats.joining_week ? `${data.stats.joining_week} in the next 7 days` : "none this week"}</span></article>
        <article><small>Pre-boarding done</small><b>{data.stats.preboardingAverage === null ? "—" : `${data.stats.preboardingAverage}%`}</b><span>average before day one</span></article>
        <article className={data.stats.overdue_tasks ? "attention warn" : ""}><small>Tasks overdue</small><b>{data.stats.overdue_tasks}</b><span>{data.stats.overdue_tasks ? `across ${data.stats.overdue_owners} owner${data.stats.overdue_owners > 1 ? "s" : ""}` : "everyone is on track"}</span></article>
        {viewer.isHr
          ? <article className={data.stats.pendingDocuments ? "attention" : ""}><small>Documents to verify</small><b>{data.stats.pendingDocuments}</b><span>{buddyPct === null ? "no active joiners" : `buddy assigned for ${buddyPct}%`}</span></article>
          : <article className={myCount?.open ? "attention" : ""}><small>Your open tasks</small><b>{myCount?.open ?? "—"}</b><span>{myCount?.overdue ? `${myCount.overdue} overdue` : "nothing overdue"}</span></article>}
      </section>

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Onboarding views">
          {tabs.filter((item) => item.show).map((item) => (
            <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => choose(item.key)}>
              {item.label}{item.badge ? <span className="ob-tab-count">{item.badge}</span> : null}
            </button>
          ))}
        </div>
        {tab === "pipeline" && (
          <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role, location, manager" aria-label="Search joiners" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={13} /></button>}</label>
        )}
      </div>

      {tab === "pipeline" && (
        <>
          <div className="ob-filters">
            <div className="cw-chips" aria-label="Filter by status">
              <button className={!status ? "active" : ""} onClick={() => setStatus("")}>All <b>{total}</b></button>
              {STATUS_COLUMNS.filter((column) => countFor(column.key) || status === column.key).map((column) => (
                <button key={column.key} className={status === column.key ? "active" : ""} onClick={() => setStatus(status === column.key ? "" : column.key)}>{column.label} <b>{countFor(column.key)}</b></button>
              ))}
            </div>
            <div className="ob-filter-right">
              {data.departments.length > 1 && (
                <select className="ob-select" value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
                  <option value="">All departments</option>
                  {data.departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              )}
              <div className="ob-view-toggle" role="group" aria-label="Layout">
                <button className={view === "board" ? "active" : ""} aria-pressed={view === "board"} onClick={() => setView("board")} title="Board"><LayoutGrid size={15} /></button>
                <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")} title="List"><List size={15} /></button>
              </div>
            </div>
          </div>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          {loading && !data.items.length ? <div className="cw-list-skeleton"><i /><i /><i /></div>
            : !data.items.length ? (
              <div className="cw-empty">
                <span><Inbox size={26} /></span>
                <h2>{query || status || department ? "No joiners match" : viewer.isHr ? "No one is onboarding yet" : "No joiners linked to you"}</h2>
                <p>{query || status || department ? "Try a different search or filter." : viewer.isHr ? "Add a joiner or start onboarding a hired candidate — the checklist is created for you." : "When you are a new hire's manager, buddy or task owner, they appear here."}</p>
                {viewer.isHr && !query && !status && <button className="cw-btn primary" onClick={() => setCreating({ candidate: null })}><Plus size={16} /> Add joiner</button>}
              </div>
            ) : view === "board" ? (
              <Board items={data.items} status={status} showClosed={showClosed} onToggleClosed={() => setShowClosed((value) => !value)} />
            ) : <JoinerTable items={data.items} />}
        </>
      )}
      {tab === "tasks" && <MyTasks flash={flash} onChanged={() => { loadCounts(); load(); }} />}
      {tab === "templates" && viewer.isHr && <TemplateEditor flash={flash} />}
      {tab === "settings" && viewer.isHr && <SettingsPanel flash={flash} />}

      {creating && (
        <JoinerDrawer candidate={creating.candidate} departments={data.departments} onClose={() => setCreating(null)}
          onSaved={(detail) => { setCreating(null); flash(`${detail.joiner.fullName} added — ${detail.tasks.length} tasks assigned`); router.push(`/onboarding/${detail.joiner.id}`); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Board({ items, status, showClosed, onToggleClosed }: { items: JoinerCard[]; status: string; showClosed: boolean; onToggleClosed: () => void }) {
  const closedCount = items.filter((item) => item.status === "COMPLETED" || item.status === "WITHDRAWN").length;
  const columns = STATUS_COLUMNS.filter((column) => status ? column.key === status : showClosed || (column.key !== "COMPLETED" && column.key !== "WITHDRAWN"));
  return (
    <>
      <div className="ob-board" style={{ ["--cols" as string]: columns.length }}>
        {columns.map((column) => {
          const list = items.filter((item) => item.status === column.key);
          return (
            <section key={column.key} className={`ob-column col-${column.key.toLowerCase()}`} aria-label={column.label}>
              <header><b>{column.label}</b><span>{list.length}</span><small>{column.hint}</small></header>
              {list.length ? list.map((item) => <JoinerCardView key={item.id} item={item} />) : <p className="ob-column-empty">No one here</p>}
            </section>
          );
        })}
      </div>
      {!status && closedCount > 0 && (
        <button className="ob-closed-toggle" onClick={onToggleClosed}>{showClosed ? "Hide" : "Show"} onboarded & withdrawn ({closedCount})</button>
      )}
    </>
  );
}

function JoinerCardView({ item }: { item: JoinerCard }) {
  const soon = (item.status === "PRE_BOARDING" || item.status === "READY_TO_JOIN") && item.daysToJoin <= 3;
  const phase = currentPhase(item.status, item.daysToJoin);
  return (
    <Link href={`/onboarding/${item.id}`} className={`ob-card ${item.progress?.overdue ? "has-overdue" : ""}`}>
      <div className="ob-card-head">
        <Avatar name={item.fullName} />
        <p><b>{item.fullName}</b><small>{item.designation} · {item.department}</small></p>
      </div>
      <p className={`ob-countdown ${soon ? "soon" : ""} ${item.status === "WITHDRAWN" ? "muted" : ""}`}>
        <CalendarClock size={13} /> <b>{countdown(item.daysToJoin, item.status)}</b> <span>{shortDate(item.joiningDate)}</span>
      </p>
      {item.progress && item.status !== "WITHDRAWN" && (
        <>
          <div className="ob-card-progress"><ProgressBar percent={item.progress.percent} overdue={item.progress.overdue} /><b>{item.progress.percent}%</b></div>
          <PhaseStrip phases={item.progress.phases} current={item.status === "COMPLETED" ? undefined : phase} />
        </>
      )}
      {item.nextTask && item.status !== "WITHDRAWN" && (
        <p className={`ob-next ${item.nextTask.overdue ? "over" : ""}`}><span>{item.nextTask.overdue ? "Overdue" : "Next"}</span> {item.nextTask.title}<small> · {item.nextTask.ownerName || item.nextTask.ownerType.toLowerCase()}</small></p>
      )}
      <footer>
        <span className="ob-avatars">
          {item.manager && <Avatar name={item.manager.name} small title={`Manager: ${item.manager.name}`} />}
          {item.buddy ? <Avatar name={item.buddy.name} small muted title={`Buddy: ${item.buddy.name}`} /> : item.status !== "WITHDRAWN" && item.status !== "COMPLETED" && <span className="ob-no-buddy" title="No buddy assigned">+ buddy</span>}
        </span>
        {item.location && <span className="ob-loc"><MapPin size={12} /> {item.location.split("—")[0].trim()}</span>}
        {item.employee && <span className="ob-empno">{item.employee.number}</span>}
      </footer>
    </Link>
  );
}

function JoinerTable({ items }: { items: JoinerCard[] }) {
  return (
    <div className="cw-table ob-table" role="table" aria-label="Joiners">
      <div className="cw-row head" role="row">
        <span role="columnheader">Joiner</span><span role="columnheader">Manager · buddy</span><span role="columnheader">Joining</span>
        <span role="columnheader">Progress</span><span role="columnheader">Status</span><span />
      </div>
      {items.map((item) => (
        <Link key={item.id} href={`/onboarding/${item.id}`} className={`cw-row ${item.progress?.overdue ? "actionable" : ""}`} role="row">
          <span className="cw-person" role="cell"><Avatar name={item.fullName} small /><span>{item.fullName}<small>{item.designation} · {item.department}</small></span></span>
          <span className="cw-title-cell" role="cell"><b className="ob-table-sub">{item.manager?.name || "—"}</b><small>{item.buddy ? `Buddy: ${item.buddy.name}` : "No buddy"}</small></span>
          <span className="cw-title-cell" role="cell"><b className="ob-table-sub">{shortDate(item.joiningDate)}</b><small>{countdown(item.daysToJoin, item.status)}</small></span>
          <span className="ob-table-progress" role="cell">{item.progress ? <><ProgressBar percent={item.progress.percent} overdue={item.progress.overdue} /><small>{item.progress.percent}%{item.progress.overdue ? ` · ${item.progress.overdue} overdue` : ""}</small></> : "—"}</span>
          <span role="cell"><Badge tone={item.tone} label={item.statusLabel} /></span>
          <span role="cell" className="cw-row-cta"><ChevronRight size={16} /></span>
        </Link>
      ))}
    </div>
  );
}

function MyTasks({ flash, onChanged }: { flash: (message: string) => void; onChanged: () => void }) {
  const [state, setState] = useState<"open" | "done">("open");
  const [items, setItems] = useState<Task[] | null>(null);
  const [counts, setCounts] = useState<{ open: number; overdue: number; this_week: number; done_recently: number } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const data = await onboardingApi.myTasks(state); setItems(data.items); setCounts(data.counts); setError(""); }
    catch (reason) { setError(errorText(reason, "Unable to load your tasks.")); setItems([]); }
  }, [state]);
  useEffect(() => { setItems(null); load(); }, [load]);
  const groups = useMemo(() => {
    const list = items || [];
    if (state === "done") return [{ key: "done", label: "Recently closed", items: list }];
    return [
      { key: "overdue", label: "Overdue", items: list.filter((task) => task.overdue) },
      { key: "week", label: "Due this week", items: list.filter((task) => !task.overdue && task.daysLeft <= 7) },
      { key: "later", label: "Later", items: list.filter((task) => !task.overdue && task.daysLeft > 7) },
    ].filter((group) => group.items.length);
  }, [items, state]);
  const changed = (task: Task) => { setItems((current) => current?.map((item) => item.id === task.id ? task : item) || null); onChanged(); window.setTimeout(load, 600); };
  return (
    <div className="ob-mytasks">
      <div className="cw-chips" aria-label="Task state">
        <button className={state === "open" ? "active" : ""} onClick={() => setState("open")}>Open <b>{counts?.open ?? "…"}</b></button>
        <button className={state === "done" ? "active" : ""} onClick={() => setState("done")}>Closed <b>{counts?.done_recently ?? "…"}</b></button>
        {counts?.overdue ? <span className="ob-overdue-pill"><AlertTriangle size={13} /> {counts.overdue} overdue</span> : null}
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!items ? <div className="cw-list-skeleton"><i /><i /><i /></div>
        : !items.length ? (
          <div className="cw-empty">
            <span><ClipboardCheck size={26} /></span>
            <h2>{state === "open" ? "No onboarding tasks for you" : "Nothing closed yet"}</h2>
            <p>{state === "open" ? "When you are a joiner's manager, buddy or the HR, IT or Finance owner, their tasks land here with due dates." : "Tasks you complete or skip show up here."}</p>
          </div>
        ) : groups.map((group) => (
          <section key={group.key} className={`ob-task-group group-${group.key}`}>
            <p className="cw-section-label">{group.label} · {group.items.length}</p>
            <ul className="ob-task-list">{group.items.map((task) => <TaskRow key={task.id} task={task} showJoiner onChanged={changed} flash={flash} />)}</ul>
          </section>
        ))}
    </div>
  );
}
