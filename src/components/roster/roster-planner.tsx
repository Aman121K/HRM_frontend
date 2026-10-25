"use client";
import {
  AlertTriangle, ArrowLeftRight, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Eraser, Info, MousePointer2,
  Moon, Search, Send, Sparkles, Users, Wand2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { initials } from "@/lib/cases";
import { CellDrawer, PatternDrawer } from "./cell-drawer";
import {
  addDays, ago, compactTime, dayMonth, dayNum, fullDay, hoursLabel, rosterApi, timeRange, weekRange, weekday,
  type Cell, type Context, type PersonRow, type SaveItem, type Template, type Week,
} from "./roster-api";

export type Brush = { kind: "SHIFT"; templateId: string } | { kind: "WEEKLY_OFF" } | { kind: "CLEAR" } | null;

export function RosterPlanner({ context, revision }: { context: Context; revision: number }) {
  const { viewer } = context;
  const [start, setStart] = useState(context.currentWeekStart);
  const [scope, setScope] = useState<"team" | "all">(viewer.isHr ? "all" : "team");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [brush, setBrush] = useState<Brush>(null);
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [inspect, setInspect] = useState<{ row: number; col: number } | null>(null);
  const [pattern, setPattern] = useState<PersonRow | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [mobileDay, setMobileDay] = useState(0);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const queue = useRef(new Map<string, SaveItem>());
  const flushTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const requestSeq = useRef(0);

  useEffect(() => { const timer = window.setTimeout(() => setQuery(search), 250); return () => window.clearTimeout(timer); }, [search]);

  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3600); }, []);

  const load = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await rosterApi.week({ start, scope: viewer.isHr ? scope : undefined, department: department || undefined, location: location || undefined, search: query || undefined });
      if (seq !== requestSeq.current) return;
      setWeek(data);
      setForbidden(false);
    } catch (reason) {
      if (seq !== requestSeq.current) return;
      const failure = reason as Error & { status?: number };
      if (failure.status === 403) setForbidden(true);
      setError(failure.message || "Could not load the roster.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [start, scope, department, location, query, viewer.isHr]);

  useEffect(() => { load(); }, [load, revision]);
  useEffect(() => {
    if (!week) return;
    const index = week.days.findIndex((day) => day.isToday);
    setMobileDay(index >= 0 ? index : 0);
  }, [week?.weekStart]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const stop = () => { dragging.current = false; }; window.addEventListener("mouseup", stop); return () => window.removeEventListener("mouseup", stop); }, []);

  const templates = useMemo(() => (week?.templates || context.templates).filter((template) => template.active), [week, context.templates]);
  const templateMap = useMemo(() => new Map((week?.templates || context.templates).map((template) => [template.id, template])), [week, context.templates]);
  const ids = useMemo(() => week?.people.map((row) => row.employee.id) || [], [week]);
  const focusRow = week ? Math.min(focus.row, Math.max(0, week.people.length - 1)) : 0;
  const plannedCells = week?.people.reduce((sum, row) => sum + row.cells.filter((cell) => cell.assignment).length, 0) || 0;

  // ---- painting ---------------------------------------------------------------------------------
  const flush = useCallback(async () => {
    window.clearTimeout(flushTimer.current);
    const items = [...queue.current.values()];
    queue.current.clear();
    if (!items.length) return;
    try {
      await rosterApi.save(items);
    } catch (reason) {
      flash((reason as Error).message || "Could not save the roster.");
    }
    await load(true);
  }, [flash, load]);

  const paint = useCallback((rowIndex: number, col: number, next: Brush) => {
    if (!week || !next) return;
    const row = week.people[rowIndex];
    const cell = row?.cells[col];
    if (!cell) return;
    if (cell.leave?.status === "APPROVED" && next.kind !== "CLEAR") {
      flash(`${row.employee.name} is on approved ${cell.leave.type} on ${fullDay(cell.date)} — shifts can't be planned that day.`);
      return;
    }
    const current = cell.assignment;
    if (next.kind === "CLEAR" && !current) return;
    if (current && next.kind === current.kind && (next.kind !== "SHIFT" || next.templateId === current.templateId)) return;
    queue.current.set(`${row.employee.id}:${cell.date}`, {
      employeeId: row.employee.id, date: cell.date, kind: next.kind, templateId: next.kind === "SHIFT" ? next.templateId : undefined,
      location: current?.location ?? row.employee.location ?? undefined,
    });
    setWeek((previous) => previous && ({
      ...previous,
      people: previous.people.map((person, index) => index !== rowIndex ? person : {
        ...person,
        cells: person.cells.map((item, cellIndex) => cellIndex !== col ? item : {
          ...item, warnings: [],
          assignment: next.kind === "CLEAR" ? null : { ...(item.assignment || { location: row.employee.location, note: null }), kind: next.kind, templateId: next.kind === "SHIFT" ? next.templateId : null },
        }),
      }),
    }));
    window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(flush, 450);
  }, [week, flash, flush]);

  useEffect(() => () => window.clearTimeout(flushTimer.current), []);

  const moveFocus = (row: number, col: number) => {
    if (!week) return;
    const next = { row: Math.max(0, Math.min(week.people.length - 1, row)), col: Math.max(0, Math.min(6, col)) };
    setFocus(next);
    cellRefs.current.get(`${next.row}:${next.col}`)?.focus();
  };

  const onCellKey = (event: ReactKeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    const key = event.key;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[key]) { event.preventDefault(); moveFocus(row + moves[key][0], col + moves[key][1]); return; }
    if (key === "Home") { event.preventDefault(); moveFocus(row, 0); return; }
    if (key === "End") { event.preventDefault(); moveFocus(row, 6); return; }
    if (/^[1-9]$/.test(key) && templates[Number(key) - 1]) { event.preventDefault(); paint(row, col, { kind: "SHIFT", templateId: templates[Number(key) - 1].id }); return; }
    if (key === "o" || key === "O") { event.preventDefault(); paint(row, col, { kind: "WEEKLY_OFF" }); return; }
    if (key === "Delete" || key === "Backspace") { event.preventDefault(); paint(row, col, { kind: "CLEAR" }); return; }
    if (key === "e" || key === "E") { event.preventDefault(); setInspect({ row, col }); return; }
    if (key === "Escape" && brush) { event.preventDefault(); setBrush(null); }
  };

  const activate = (row: number, col: number) => {
    setFocus({ row, col });
    if (brush) paint(row, col, brush); else setInspect({ row, col });
  };

  // ---- week actions -------------------------------------------------------------------------------
  const run = async (label: string, work: () => Promise<string>) => {
    setBusy(label);
    try { await flush(); flash(await work()); } catch (reason) { flash((reason as Error).message || "Something went wrong."); }
    finally { setBusy(""); await load(true); }
  };
  const publish = () => run("publish", async () => {
    const result = await rosterApi.publish(start, ids);
    if (!result.notified) return "Nothing new to publish — everyone already has the latest roster.";
    return `${result.published ? `Published for ${result.published}` : ""}${result.published && result.updated ? " · " : ""}${result.updated ? `updates sent to ${result.updated}` : ""} — ${result.notified} ${result.notified === 1 ? "person" : "people"} notified.`;
  });
  const copyPrevious = () => run("copy", async () => {
    const result = await rosterApi.copyPrevious(start, ids);
    const parts = [`Copied ${result.saved} cell${result.saved === 1 ? "" : "s"} from last week`];
    if (result.kept) parts.push(`kept ${result.kept} already planned`);
    if (result.skipped.length) parts.push(`skipped ${result.skipped.length} leave day${result.skipped.length === 1 ? "" : "s"}`);
    return `${parts.join(" · ")}.`;
  });
  const clearWeek = () => run("clear", async () => {
    setConfirmClear(false);
    const result = await rosterApi.clear(start, ids);
    return `Cleared ${result.cleared} cell${result.cleared === 1 ? "" : "s"} for ${weekRange(start)}.`;
  });
  const applyRequest = (id: string) => run(`request:${id}`, async () => {
    const result = await rosterApi.applyRequest(id);
    return `${result.caseNumber} applied — ${result.target}${result.swapped ? ", swap partner updated" : ""}${result.skipped.length ? ` (${result.skipped.length} leave day skipped)` : ""}.`;
  });

  // ---- render ---------------------------------------------------------------------------------------
  const filters = (
    <div className="ro-filters">
      {viewer.isHr && (
        <div className="ro-seg" role="group" aria-label="Whose roster">
          <button className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>Everyone</button>
          <button className={scope === "team" ? "active" : ""} aria-pressed={scope === "team"} onClick={() => setScope("team")}>My team</button>
        </div>
      )}
      {viewer.isHr && (
        <label className="ro-select"><span className="sr-only">Department</span>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {context.departments.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      )}
      {viewer.isHr && (
        <label className="ro-select"><span className="sr-only">Location</span>
          <select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter by location">
            <option value="">All locations</option>
            {context.locations.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      )}
      <label className="cw-search ro-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a person" aria-label="Search people" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={13} /></button>}</label>
    </div>
  );

  const weekNav = (
    <div className="ro-weekbar">
      <div className="ro-weeknav">
        <button className="cw-icon-button" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={17} /></button>
        <button className="cw-btn ghost" onClick={() => setStart(context.currentWeekStart)} disabled={start === context.currentWeekStart}>This week</button>
        <button className="cw-icon-button" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={17} /></button>
        <div className="ro-weektitle">
          <small>{start === context.currentWeekStart ? "This week" : start === addDays(context.currentWeekStart, 7) ? "Next week" : start < context.currentWeekStart ? "Past week" : "Upcoming"}</small>
          <b>{weekRange(start)}</b>
        </div>
      </div>
      {filters}
    </div>
  );

  if (forbidden) return (
    <>
      {weekNav}
      <div className="cw-empty"><span><Users size={26} /></span><h2>No team to plan</h2><p>{error}</p></div>
    </>
  );

  return (
    <>
      {weekNav}
      {week && <Stats week={week} />}
      {week && <PublishBar week={week} busy={busy} planned={plannedCells} onPublish={publish} onCopy={copyPrevious} confirmClear={confirmClear} setConfirmClear={setConfirmClear} onClear={clearWeek} />}
      {week && week.requests.length > 0 && <RequestsPanel week={week} busy={busy} onApply={applyRequest} />}
      {week && week.people.length > 0 && <Palette templates={templates} brush={brush} setBrush={setBrush} />}

      {error && !forbidden && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {loading && !week ? <div className="cw-list-skeleton"><i /><i /><i /><i /></div>
        : week && !week.people.length ? (
          <div className="cw-empty"><span><Users size={26} /></span><h2>{query || department || location ? "No one matches" : "No one to plan yet"}</h2>
            <p>{query || department || location ? "Try a different search or filter." : "People appear here once they report to you."}</p></div>
        ) : week && (
          <>
            <div className={`ro-grid-wrap${loading ? " is-loading" : ""}${brush ? " painting" : ""}`}>
              <div className="ro-grid" role="grid" aria-label={`Roster for ${weekRange(week.weekStart)}`} aria-rowcount={week.people.length + 2}
                onMouseLeave={() => { dragging.current = false; }}>
                <div className="ro-row ro-head" role="row">
                  <div role="columnheader" className="ro-corner"><Users size={14} /> Team <b>{week.people.length}</b></div>
                  {week.days.map((day) => (
                    <div role="columnheader" key={day.date} className={`ro-dayhead${day.isToday ? " today" : ""}${day.isPast ? " past" : ""}`}>
                      <small>{weekday(day.date)}</small><b>{dayNum(day.date)}</b>{day.isToday && <em>Today</em>}
                    </div>
                  ))}
                  <div role="columnheader" className="ro-hourshead">Hours</div>
                </div>
                {week.people.map((row, rowIndex) => (
                  <div className="ro-row" role="row" key={row.employee.id}>
                    <PersonHeader row={row} />
                    {row.cells.map((cell, col) => (
                      <div role="gridcell" key={cell.date} className="ro-gridcell">
                        <CellButton
                          cell={cell} row={row} templateMap={templateMap} past={week.days[col].isPast} today={week.days[col].isToday}
                          tabIndex={focusRow === rowIndex && focus.col === col ? 0 : -1}
                          buttonRef={(node) => { if (node) cellRefs.current.set(`${rowIndex}:${col}`, node); else cellRefs.current.delete(`${rowIndex}:${col}`); }}
                          onFocus={() => setFocus({ row: rowIndex, col })}
                          onKeyDown={(event) => onCellKey(event, rowIndex, col)}
                          onClick={() => activate(rowIndex, col)}
                          onMouseDown={() => { if (brush) dragging.current = true; }}
                          onMouseEnter={() => { if (brush && dragging.current) paint(rowIndex, col, brush); }}
                        />
                      </div>
                    ))}
                    <div role="gridcell" className="ro-hours">
                      <HoursMeter hours={row.hours} max={week.settings.maxWeeklyHours} shifts={row.shifts} />
                      <button className="cw-icon-button ro-rowtool" aria-label={`Plan ${row.employee.name}'s week`} title="Apply a pattern or clear this week" onClick={() => setPattern(row)}><Wand2 size={15} /></button>
                    </div>
                  </div>
                ))}
                <CoverageRow week={week} />
              </div>
            </div>
            <p className="ro-hint"><Info size={13} /> Pick a shift above, then click or drag across cells. Keyboard: arrow keys move, <kbd>1</kbd>–<kbd>{Math.min(9, templates.length)}</kbd> assign {templates.slice(0, 3).map((template) => template.name).join(" / ")}…, <kbd>O</kbd> weekly off, <kbd>Del</kbd> clear, <kbd>E</kbd> or <kbd>Enter</kbd> edit details.</p>
            <MobileDayList week={week} day={mobileDay} setDay={setMobileDay} templateMap={templateMap} onOpen={(row, col) => setInspect({ row, col })} />
          </>
        )}

      {week && inspect && week.people[inspect.row] && (
        <CellDrawer
          row={week.people[inspect.row]} cell={week.people[inspect.row].cells[inspect.col]} templates={templates} templateMap={templateMap}
          onClose={() => setInspect(null)}
          onSaved={async (message) => { setInspect(null); flash(message); await load(true); }}
        />
      )}
      {week && pattern && (
        <PatternDrawer
          row={pattern} week={week} templates={templates} templateMap={templateMap}
          onClose={() => setPattern(null)}
          onSaved={async (message) => { setPattern(null); flash(message); await load(true); }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function Stats({ week }: { week: Week }) {
  const { summary, settings } = week;
  return (
    <section className="cw-stats ro-stats" aria-label="Week summary">
      <article><small>Scheduled hours</small><b>{Math.round(summary.hours)}</b><span>{summary.shifts} shifts · {week.people.length} people</span></article>
      <article><small>Unplanned days</small><b>{summary.unplanned}</b><span>{summary.onLeave ? `${summary.onLeave} leave day${summary.onLeave === 1 ? "" : "s"} blocked` : "no leave this week"}</span></article>
      <article className={summary.warnings ? "attention" : ""}><small>Rule warnings</small><b>{summary.warnings}</b><span>{settings.minRestHours} h rest · {settings.maxWeeklyHours} h/week · weekly off</span></article>
      <article className={summary.gaps ? "attention" : ""}><small>Coverage gaps</small><b>{summary.gaps}</b><span>{summary.gaps ? "shifts below minimum headcount" : "every shift is covered"}</span></article>
    </section>
  );
}

function PublishBar({ week, busy, planned, onPublish, onCopy, confirmClear, setConfirmClear, onClear }: {
  week: Week; busy: string; planned: number; onPublish: () => void; onCopy: () => void; confirmClear: boolean; setConfirmClear: (value: boolean) => void; onClear: () => void;
}) {
  const { publication } = week;
  const state = publication.state;
  const copy = {
    EMPTY: { tone: "neutral", label: "Nothing planned", text: "Start from last week's roster or paint shifts below." },
    DRAFT: { tone: "warning", label: "Draft", text: `${publication.pendingChanges} planned cell${publication.pendingChanges === 1 ? "" : "s"} not visible to your team yet.` },
    CHANGED: { tone: "info", label: "Unpublished changes", text: `${publication.pendingChanges} change${publication.pendingChanges === 1 ? "" : "s"} since the last publish${publication.draftPeople ? ` · ${publication.draftPeople} never published` : ""}. Affected people are re-notified when you publish.` },
    PUBLISHED: { tone: "success", label: "Published", text: `Everyone has the latest roster${publication.lastPublishedAt ? ` · published ${ago(publication.lastPublishedAt)}` : ""}.` },
  }[state];
  const people = publication.draftPeople + publication.changedPeople;
  return (
    <section className={`ro-publish state-${state.toLowerCase()}`} aria-label="Publish status">
      <div className="ro-publish-state">
        <span className={`cw-badge tone-${copy.tone}`}><i />{copy.label}</span>
        <p>{copy.text}</p>
      </div>
      <div className="ro-publish-actions">
        {confirmClear ? (
          <span className="ro-confirm" role="alertdialog" aria-label="Confirm clearing the week">
            Clear {planned} cell{planned === 1 ? "" : "s"} for everyone shown?
            <button className="cw-btn danger" onClick={onClear} disabled={!!busy} autoFocus>Clear week</button>
            <button className="cw-btn ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
          </span>
        ) : (
          <>
            <button className="cw-btn ghost" onClick={onCopy} disabled={!!busy}><Copy size={15} /> {busy === "copy" ? "Copying…" : "Copy previous week"}</button>
            <button className="cw-btn ghost" onClick={() => setConfirmClear(true)} disabled={!!busy || !planned}><Eraser size={15} /> Clear week</button>
            <button className="cw-btn primary" onClick={onPublish} disabled={!!busy || state === "EMPTY" || state === "PUBLISHED"}>
              {state === "PUBLISHED" ? <><Check size={15} /> Up to date</> : <><Send size={15} /> {busy === "publish" ? "Publishing…" : state === "CHANGED" ? `Publish updates${people ? ` (${people})` : ""}` : "Publish & notify"}</>}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function RequestsPanel({ week, busy, onApply }: { week: Week; busy: string; onApply: (id: string) => void }) {
  return (
    <section className="ro-requests" aria-label="Approved shift changes">
      <header><ArrowLeftRight size={16} /><b>Approved shift changes</b><small>From the Shift requests desk · {week.requests.filter((item) => !item.applied).length} to apply</small></header>
      <ul>
        {week.requests.map((request) => (
          <li key={request.id}>
            <span className="cw-badge tone-success"><i />{request.caseNumber}</span>
            <div>
              <b>{request.requester.name} → {request.target?.label || request.category}</b>
              <small>{request.startDate === request.endDate ? fullDay(request.startDate) : `${dayMonth(request.startDate)} – ${dayMonth(request.endDate)}`}{request.subject ? ` · swap with ${request.subject.name}` : ""} · “{request.title}”</small>
            </div>
            {request.applied ? <span className="ro-applied"><Check size={14} /> On the roster</span>
              : !request.target ? <span className="ro-applied muted" title="Add a matching shift template to apply it">No matching template</span>
              : <button className="cw-btn primary" onClick={() => onApply(request.id)} disabled={!!busy}><Sparkles size={15} /> {busy === `request:${request.id}` ? "Applying…" : request.appliedDays ? "Re-apply" : "Apply to roster"}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Palette({ templates, brush, setBrush }: { templates: Template[]; brush: Brush; setBrush: (brush: Brush) => void }) {
  const is = (candidate: Brush) => JSON.stringify(candidate) === JSON.stringify(brush);
  return (
    <div className="ro-palette" role="toolbar" aria-label="Shift brush">
      <button className={`ro-brush select${!brush ? " active" : ""}`} aria-pressed={!brush} onClick={() => setBrush(null)}><MousePointer2 size={14} /> Select</button>
      {templates.map((template, index) => (
        <button key={template.id} className={`ro-brush${is({ kind: "SHIFT", templateId: template.id }) ? " active" : ""}`} style={{ ["--c" as string]: template.color }}
          aria-pressed={is({ kind: "SHIFT", templateId: template.id })} onClick={() => setBrush({ kind: "SHIFT", templateId: template.id })}
          title={`${template.name} ${timeRange(template)} · ${template.paidHours} h paid${index < 9 ? ` · key ${index + 1}` : ""}`}>
          <i /> <b>{template.name}</b><small>{timeRange(template)}</small>{index < 9 && <kbd>{index + 1}</kbd>}
        </button>
      ))}
      <button className={`ro-brush off${is({ kind: "WEEKLY_OFF" }) ? " active" : ""}`} aria-pressed={is({ kind: "WEEKLY_OFF" })} onClick={() => setBrush({ kind: "WEEKLY_OFF" })}><Moon size={14} /> <b>Weekly off</b><kbd>O</kbd></button>
      <button className={`ro-brush clear${is({ kind: "CLEAR" }) ? " active" : ""}`} aria-pressed={is({ kind: "CLEAR" })} onClick={() => setBrush({ kind: "CLEAR" })}><Eraser size={14} /> <b>Clear</b><kbd>Del</kbd></button>
      {brush && <span className="ro-palette-note" role="status">Painting — click or drag across cells. <button onClick={() => setBrush(null)}>Done</button></span>}
    </div>
  );
}

function PersonHeader({ row }: { row: PersonRow }) {
  const state = row.publication.state;
  return (
    <div role="rowheader" className="ro-person">
      <span className="cw-avatar small">{initials(row.employee.name)}</span>
      <span className="ro-person-text">
        <b>{row.employee.name}</b>
        <small>{[row.employee.designation, row.employee.location].filter(Boolean).join(" · ") || row.employee.number}</small>
      </span>
      <span className="ro-person-flags">
        {row.warnings.map((warning) => (
          <span key={warning.code} className={`ro-flag ${warning.severity}`} tabIndex={0} aria-label={warning.message}>
            <AlertTriangle size={13} /><span className="ro-tip" role="tooltip">{warning.message}</span>
          </span>
        ))}
        {(state === "DRAFT" || state === "CHANGED") && <i className={`ro-state ${state.toLowerCase()}`} title={state === "DRAFT" ? "Not published yet" : `${row.publication.changes} unpublished change(s)`} aria-label={state === "DRAFT" ? "Not published yet" : "Unpublished changes"} />}
      </span>
    </div>
  );
}

function describeCell(cell: Cell, row: PersonRow, templateMap: Map<string, Template>) {
  const parts = [`${row.employee.name}, ${fullDay(cell.date)}`];
  const assignment = cell.assignment;
  if (assignment?.kind === "SHIFT") { const template = templateMap.get(assignment.templateId || ""); parts.push(template ? `${template.name} ${timeRange(template)}` : "Shift"); }
  else if (assignment?.kind === "WEEKLY_OFF") parts.push("Weekly off");
  else parts.push("Not scheduled");
  if (cell.leave) parts.push(cell.leave.status === "APPROVED" ? `On approved ${cell.leave.type}` : `${cell.leave.type} pending approval`);
  if (assignment?.location && assignment.location !== row.employee.location) parts.push(`at ${assignment.location}`);
  if (cell.request) parts.push(`${cell.request.caseNumber} ${cell.request.applied ? "applied" : "approved, not applied"}`);
  if (cell.changed) parts.push("Changed since publish");
  for (const warning of cell.warnings) parts.push(`${warning.severity === "danger" ? "Problem" : "Warning"}: ${warning.message}`);
  return parts.join(". ");
}

function CellButton({ cell, row, templateMap, past, today, tabIndex, buttonRef, onFocus, onKeyDown, onClick, onMouseDown, onMouseEnter }: {
  cell: Cell; row: PersonRow; templateMap: Map<string, Template>; past: boolean; today: boolean; tabIndex: number;
  buttonRef: (node: HTMLButtonElement | null) => void; onFocus: () => void; onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onClick: () => void; onMouseDown: () => void; onMouseEnter: () => void;
}) {
  const assignment = cell.assignment;
  const template = assignment?.kind === "SHIFT" ? templateMap.get(assignment.templateId || "") : undefined;
  const onLeave = cell.leave?.status === "APPROVED";
  const severity = cell.warnings.some((warning) => warning.severity === "danger") ? "danger" : cell.warnings.length ? "warning" : "";
  const tips = [...cell.warnings.map((warning) => warning.message), ...(cell.changed ? ["Changed since the last publish."] : []),
    ...(cell.request ? [`${cell.request.caseNumber}: ${cell.request.role === "swap" ? "swap partner" : "requested"} ${cell.request.label || ""}${cell.request.applied ? " (applied)" : " — approved, not applied yet"}`] : []),
    ...(assignment?.note ? [`Note: ${assignment.note}`] : [])];
  const className = ["ro-cell", template ? "shift" : assignment?.kind === "WEEKLY_OFF" ? "off" : "empty", onLeave ? "leave" : "", past ? "past" : "", today ? "today" : "", cell.changed ? "changed" : "", severity ? `warn-${severity}` : ""].filter(Boolean).join(" ");
  return (
    <button ref={buttonRef} type="button" className={className} tabIndex={tabIndex} style={template ? { ["--c" as string]: template.color } : undefined}
      aria-label={describeCell(cell, row, templateMap)} onFocus={onFocus} onKeyDown={onKeyDown} onClick={onClick} onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
      {onLeave && !assignment ? (
        <span className="ro-leave"><b>{cell.leave!.code}</b><small>On leave</small></span>
      ) : template ? (
        <span className="ro-pill"><b>{template.name}</b><small>{compactTime(template.startTime)}–{compactTime(template.endTime)}</small></span>
      ) : assignment?.kind === "WEEKLY_OFF" ? (
        <span className="ro-offmark"><Moon size={13} /> Off</span>
      ) : assignment ? <span className="ro-pill"><b>Shift</b></span> : <span className="ro-add" aria-hidden>+</span>}
      {onLeave && assignment && <em className="ro-tag leave">{cell.leave!.code} leave</em>}
      {cell.leave?.status === "PENDING" && <em className="ro-tag pending">Leave pending</em>}
      {cell.request && <em className={`ro-tag request${cell.request.applied ? " applied" : ""}`}><ArrowLeftRight size={10} /> {cell.request.caseNumber}</em>}
      {severity && <span className={`ro-warn ${severity}`} aria-hidden><AlertTriangle size={12} /></span>}
      {cell.changed && <span className="ro-changed" aria-hidden />}
      {tips.length > 0 && <span className="ro-tip" role="tooltip" aria-hidden>{tips.map((tip) => <span key={tip}>{tip}</span>)}</span>}
    </button>
  );
}

function HoursMeter({ hours, max, shifts }: { hours: number; max: number; shifts: number }) {
  const over = hours > max;
  return (
    <span className={`ro-meter${over ? " over" : ""}`} title={`${hoursLabel(hours)} of ${max} h weekly limit`}>
      <b>{hoursLabel(hours)}</b>
      <i><span style={{ width: `${Math.min(100, (hours / max) * 100)}%` }} /></i>
      <small>{shifts} shift{shifts === 1 ? "" : "s"}</small>
    </span>
  );
}

function CoverageRow({ week }: { week: Week }) {
  return (
    <div className="ro-row ro-coverage" role="row">
      <div role="rowheader" className="ro-person ro-covhead"><CalendarCheck2 size={15} /><span className="ro-person-text"><b>Coverage</b><small>planned / minimum per shift</small></span></div>
      {week.coverage.map((day) => (
        <div role="gridcell" key={day.date} className={`ro-covcell${day.gaps ? " short" : ""}`}
          aria-label={`${fullDay(day.date)}: ${day.slots.map((slot) => `${slot.name} ${slot.count} of ${slot.min}`).join(", ")}${day.gaps ? `, ${day.gaps} short` : ", fully covered"}`}>
          {day.slots.map((slot) => (
            <span key={slot.templateId} className={`ro-cov${slot.short ? " short" : ""}`} style={{ ["--c" as string]: slot.color }} title={`${slot.name}: ${slot.count} planned, minimum ${slot.min}`}>
              <i />{slot.code}<b>{slot.count}{slot.min ? `/${slot.min}` : ""}</b>
            </span>
          ))}
          <small>{day.working} on{day.off ? ` · ${day.off} off` : ""}{day.leave ? ` · ${day.leave} leave` : ""}</small>
        </div>
      ))}
      <div role="gridcell" className="ro-hours ro-covtotal"><b>{week.summary.gaps ? `${week.summary.gaps} gap${week.summary.gaps === 1 ? "" : "s"}` : "Covered"}</b></div>
    </div>
  );
}

function MobileDayList({ week, day, setDay, templateMap, onOpen }: { week: Week; day: number; setDay: (day: number) => void; templateMap: Map<string, Template>; onOpen: (row: number, col: number) => void }) {
  const date = week.days[day]?.date;
  const coverage = week.coverage[day];
  if (!date) return null;
  return (
    <section className="ro-mobile" aria-label="Roster by day">
      <div className="ro-daytabs" role="tablist" aria-label="Day">
        {week.days.map((item, index) => (
          <button key={item.date} role="tab" aria-selected={index === day} className={`${index === day ? "active" : ""}${item.isToday ? " today" : ""}${week.coverage[index].gaps ? " short" : ""}`} onClick={() => setDay(index)}>
            <small>{weekday(item.date)}</small><b>{dayNum(item.date)}</b>
          </button>
        ))}
      </div>
      <div className="ro-mobile-cov">
        <CalendarDays size={15} /><b>{fullDay(date)}</b>
        <span>{coverage.slots.map((slot) => <span key={slot.templateId} className={`ro-cov${slot.short ? " short" : ""}`} style={{ ["--c" as string]: slot.color }}><i />{slot.code}<b>{slot.count}{slot.min ? `/${slot.min}` : ""}</b></span>)}</span>
      </div>
      <ul>
        {week.people.map((row, rowIndex) => {
          const cell = row.cells[day];
          const template = cell.assignment?.kind === "SHIFT" ? templateMap.get(cell.assignment.templateId || "") : undefined;
          return (
            <li key={row.employee.id}>
              <button onClick={() => onOpen(rowIndex, day)} aria-label={describeCell(cell, row, templateMap)}>
                <span className="cw-avatar small">{initials(row.employee.name)}</span>
                <span className="ro-person-text"><b>{row.employee.name}</b><small>{hoursLabel(row.hours)} this week{row.warnings.length ? ` · ${row.warnings.map((warning) => warning.message).join(" ")}` : ""}</small></span>
                <span className="ro-mobile-slot" style={template ? { ["--c" as string]: template.color } : undefined}>
                  {cell.leave?.status === "APPROVED" && !cell.assignment ? <span className="ro-leave"><b>{cell.leave.code}</b><small>On leave</small></span>
                    : template ? <span className="ro-pill"><b>{template.name}</b><small>{timeRange(template)}</small></span>
                    : cell.assignment?.kind === "WEEKLY_OFF" ? <span className="ro-offmark"><Moon size={13} /> Off</span>
                    : <span className="ro-unplanned">Not planned</span>}
                </span>
                {cell.warnings.length > 0 && <span className="ro-mobile-warn"><AlertTriangle size={12} /> {cell.warnings[0].message}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
