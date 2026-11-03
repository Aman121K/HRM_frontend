"use client";
import { CheckCircle2, Info, Loader2, MessageSquare, Plus, Send, Target, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { errorText } from "../payroll-engine/api";
import { ACCENT, Badge, Drawer, ErrorState } from "../payroll-engine/ui";
import { perfApi, RELATION_LABEL, STATUS_TONE, type Context, type Cycle, type FeedbackRequest, type GoalInput, type Sheet } from "./api";
import { CompetencyRatings, CycleStepper, FeedbackSummary, GoalsEditor, ProgressBar, RATING_LABELS, RatingInput, RatingPill, dateLabel } from "./perf-ui";
import { CycleAdmin, CreateCycleDrawer, TeamView } from "./performance-team";

type Tab = "me" | "feedback" | "team" | "admin";

export function PerformanceWorkspace() {
  const [context, setContext] = useState<Context | null>(null);
  const [cycleId, setCycleId] = useState("");
  const [tab, setTab] = useState<Tab>("me");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const ctx = await perfApi.context();
      setContext(ctx);
      setCycleId((current) => (current && ctx.cycles.some((c) => c.id === current) ? current : (ctx.cycles.find((c) => c.status !== "DRAFT" && c.status !== "CLOSED") || ctx.cycles[0])?.id || ""));
    } catch (reason) { setError(errorText(reason, "Unable to load performance.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cycle = context?.cycles.find((c) => c.id === cycleId) || null;
  const v = context?.viewer;
  const tabs: [Tab, string][] = [["me", "My review"], ["feedback", `Give feedback${v?.pendingFeedback ? ` (${v.pendingFeedback})` : ""}`]];
  if (v && (v.reportCount > 0 || v.isHr)) tabs.push(["team", v.isHr ? "Everyone" : "My team"]);
  if (v?.isHr) tabs.push(["admin", "Cycle admin & calibration"]);

  return (
    <div className="cw-page pe-page perf-page" style={{ ["--accent" as string]: ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Target size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">TALENT · PERFORMANCE</p>
          <h1>Goals, reviews &amp; growth</h1>
          <p>Set weighted goals with measurable key results, check in on progress, give and get 360 feedback, and close the cycle with a fair, calibrated rating.</p>
        </div>
        <div className="pe-hero-actions">
          {context && context.cycles.length > 0 && (
            <label className="perf-cycle-select"><span className="sr-only">Cycle</span>
              <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                {context.cycles.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.statusLabel}</option>)}
              </select>
            </label>
          )}
          {v?.isHr && <button className="cw-btn primary lg" onClick={() => setCreating(true)}><Plus size={17} /> New cycle</button>}
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!context ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !context.cycles.length ? (
        <div className="cw-empty">
          <span><Target size={26} /></span>
          <h2>No review cycle yet</h2>
          <p>{v?.isHr ? "Create a cycle — for example “FY 2026-27 annual review” — then launch goal setting for everyone." : "Your HR team hasn't started a performance cycle yet."}</p>
          {v?.isHr && <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={16} /> Create the first cycle</button>}
        </div>
      ) : (
        <>
          {cycle && <CycleStepper status={cycle.status} />}
          <nav className="cw-tabs" role="tablist" aria-label="Performance views" style={{ borderBottom: "1px solid var(--line)", margin: "6px 0 16px" }}>
            {tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
          </nav>
          {tab === "me" && cycle && <MySheet cycle={cycle} flash={flash} />}
          {tab === "feedback" && <FeedbackInbox flash={flash} onChanged={load} />}
          {tab === "team" && cycle && <TeamView cycle={cycle} isHr={Boolean(v?.isHr)} flash={flash} />}
          {tab === "admin" && cycle && <CycleAdmin cycle={cycle} flash={flash} onChanged={load} />}
        </>
      )}
      {creating && context && <CreateCycleDrawer context={context} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); flash(`${c.name} created — launch it from Cycle admin`); setCycleId(c.id); setTab("admin"); void load(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- my sheet

function MySheet({ cycle, flash }: { cycle: Cycle; flash: (m: string) => void }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [nominating, setNominating] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try { setSheet(await perfApi.mine(cycle.id)); } catch (reason) { setSheet(null); setError(errorText(reason, "Unable to load your review.")); }
  }, [cycle.id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="cw-empty"><span><Info size={24} /></span><h2>You're not part of this cycle</h2><p>{error}</p></div>;
  if (!sheet) return <div className="cw-list-skeleton"><i /><i /></div>;
  const p = sheet.participant;
  const canEditGoals = cycle.status === "GOAL_SETTING" && p.goalsStatus === "DRAFT";
  const published = p.finalRating !== undefined && p.finalRating !== null;
  const weighted = sheet.goals.length ? Math.round(sheet.goals.reduce((t, g) => t + g.progress * g.weight, 0) / Math.max(1, sheet.goals.reduce((t, g) => t + g.weight, 0))) : 0;

  return (
    <div className="perf-sheet">
      {published && (
        <section className="perf-result">
          <div><small>Final rating · {cycle.name}</small><b><RatingPill value={p.finalRating} /> {p.band}</b></div>
          {sheet.managerReview && "comments" in sheet.managerReview && sheet.managerReview.comments && <blockquote>“{sheet.managerReview.comments}”<small>— {sheet.employee.manager}</small></blockquote>}
          {p.promote && p.newDesignation && <p className="perf-promo"><CheckCircle2 size={16} /> Promoted to <b>{p.newDesignation}</b></p>}
        </section>
      )}

      <section className="cw-stats" aria-label="Your progress">
        <article><small>Goals</small><b className="text">{sheet.goals.length ? `${sheet.goals.length} goal${sheet.goals.length > 1 ? "s" : ""}` : "None yet"}</b><span><Badge tone={STATUS_TONE[p.goalsStatus] || "neutral"} label={p.goalsStatus === "DRAFT" ? "Draft" : p.goalsStatus === "SUBMITTED" ? "With manager" : "Approved"} /></span></article>
        <article><small>Weighted progress</small><b>{weighted}%</b><span>from your key results</span></article>
        <article><small>Self review</small><b className="text">{cycle.selfReview ? (p.selfStatus === "SUBMITTED" ? "Submitted" : "Pending") : "Not in this cycle"}</b><span>{cycle.reviewsDue ? `due ${dateLabel(cycle.reviewsDue)}` : "during the review stage"}</span></article>
        <article><small>360 feedback</small><b>{sheet.nominations.filter((n) => n.status === "SUBMITTED").length}/{sheet.nominations.filter((n) => n.status !== "DECLINED").length}</b><span>responses received</span></article>
      </section>

      {p.goalsNote && p.goalsStatus === "DRAFT" && <p className="cw-alert warn"><Info size={15} /><span><b>Your manager sent your goals back:</b> {p.goalsNote}</span></p>}

      <div className="pe-section-head">
        <h2>My goals &amp; key results</h2>
        {canEditGoals && !editing && <button className="cw-btn ghost" onClick={() => setEditing(true)}>{sheet.goals.length ? "Edit goals" : <><Plus size={15} /> Set my goals</>}</button>}
      </div>
      {editing ? <GoalsForm cycleId={cycle.id} initial={sheet.goals} onCancel={() => setEditing(false)} onSaved={(m) => { setEditing(false); flash(m); void load(); }} />
        : !sheet.goals.length ? <div className="cw-empty compact"><p>{cycle.status === "GOAL_SETTING" ? "Add 3–5 goals that add up to 100%. Each goal needs at least one measurable key result." : "No goals were set for this cycle — you'll be reviewed on competencies."}</p></div>
        : <GoalList sheet={sheet} cycle={cycle} onProgress={() => { flash("Progress updated"); void load(); }} />}

      {cycle.peerReview && ["GOAL_SETTING", "REVIEW"].includes(cycle.status) && (
        <section className="pe-table-card perf-noms">
          <header><h3>Who should give you 360 feedback?</h3><span>up to {cycle.maxPeers} colleagues · answers are anonymous unless at least {sheet.anonymityMin} people respond</span></header>
          {sheet.nominations.length ? <ul>{sheet.nominations.map((n) => <li key={n.id}>{n.reviewer} <small>{RELATION_LABEL[n.relation]}</small> <Badge tone={STATUS_TONE[n.status] || "neutral"} label={n.status === "REQUESTED" ? "Asked" : n.status.toLowerCase()} /></li>)}</ul> : <p className="pe-muted">Nobody asked yet.</p>}
          {sheet.nominations.filter((n) => n.status !== "DECLINED").length < cycle.maxPeers && <button className="pe-link" onClick={() => setNominating(true)}><UserPlus size={14} /> Ask colleagues</button>}
        </section>
      )}

      {cycle.selfReview && (cycle.status === "REVIEW" || p.selfStatus === "SUBMITTED") && (
        <SelfReview sheet={sheet} cycle={cycle} onSaved={(m) => { flash(m); void load(); }} />
      )}

      {sheet.feedback && <FeedbackSummary feedback={sheet.feedback} />}
      {nominating && <NominateDrawer cycle={cycle} onClose={() => setNominating(false)} onDone={(n) => { setNominating(false); flash(`Asked ${n} colleague${n === 1 ? "" : "s"} for feedback`); void load(); }} />}
    </div>
  );
}

export function GoalList({ sheet, cycle, onProgress }: { sheet: Sheet; cycle: Cycle; onProgress?: () => void }) {
  const canCheckIn = ["GOAL_SETTING", "REVIEW"].includes(cycle.status) && sheet.viewerRole !== "peer";
  return (
    <div className="perf-goals">
      {sheet.goals.map((goal) => (
        <article key={goal.id} className="perf-goal">
          <header><span className="perf-weight-chip">{goal.weight}%</span><h3>{goal.title}</h3><ProgressBar value={goal.progress} label={`${goal.title} progress`} /></header>
          {goal.description && <p className="pe-muted">{goal.description}</p>}
          <KeyResults goalId={goal.id} keyResults={goal.keyResults} editable={canCheckIn} onSaved={onProgress} />
          {(goal.selfRating || goal.managerRating) && (
            <footer>
              {goal.selfRating && <span>Self <RatingPill value={goal.selfRating} />{goal.selfComment && <small>“{goal.selfComment}”</small>}</span>}
              {goal.managerRating && <span>Manager <RatingPill value={goal.managerRating} />{goal.managerComment && <small>“{goal.managerComment}”</small>}</span>}
            </footer>
          )}
        </article>
      ))}
    </div>
  );
}

function KeyResults({ goalId, keyResults, editable, onSaved }: { goalId: string; keyResults: Sheet["goals"][number]["keyResults"]; editable: boolean; onSaved?: () => void }) {
  const [values, setValues] = useState(keyResults.map((kr) => kr.current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = values.some((v, i) => v !== keyResults[i].current);
  const save = async () => {
    setBusy(true); setError("");
    try { await perfApi.progress(goalId, keyResults.map((kr, i) => ({ ...kr, current: values[i] }))); onSaved?.(); } catch (reason) { setError(errorText(reason, "Couldn't save.")); } finally { setBusy(false); }
  };
  return (
    <div className="perf-kr-list">
      {keyResults.map((kr, i) => (
        <div key={i} className="perf-kr">
          <span>{kr.title}</span>
          {editable ? <input type="number" min={0} step="any" aria-label={`${kr.title} current value`} value={values[i]} onChange={(e) => setValues(values.map((v, j) => (j === i ? Number(e.target.value) : v)))} /> : <b>{kr.current}</b>}
          <small>/ {kr.target} {kr.unit}</small>
        </div>
      ))}
      {error && <small className="loan-over">{error}</small>}
      {editable && dirty && <button className="cw-btn ghost sm" onClick={save} disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : null} Save check-in</button>}
    </div>
  );
}

export function GoalsForm({ cycleId, initial, employeeId, onCancel, onSaved }: { cycleId: string; initial: Sheet["goals"]; employeeId?: string; onCancel: () => void; onSaved: (m: string) => void }) {
  const [goals, setGoals] = useState<GoalInput[]>(initial.length ? initial.map((g) => ({ id: g.id, title: g.title, description: g.description || "", weight: g.weight, keyResults: g.keyResults }))
    : [{ title: "", weight: 100, keyResults: [{ title: "", target: 100, current: 0, unit: "%" }] }]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "draft"); setError("");
    try {
      await (employeeId ? perfApi.savePersonGoals(cycleId, employeeId, goals, submit) : perfApi.saveMyGoals(cycleId, goals, submit));
      onSaved(submit ? (employeeId ? "Goals saved and approved" : "Goals sent to your manager") : "Draft saved");
    } catch (reason) { setError(errorText(reason, "Unable to save goals.")); } finally { setBusy(""); }
  };
  return (
    <form className="cw-create perf-goals-form" onSubmit={(e) => { e.preventDefault(); void save(true); }}>
      {error && <ErrorState message={error} />}
      <GoalsEditor goals={goals} onChange={setGoals} />
      <div className="cw-create-foot">
        <button type="button" className="cw-btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="cw-btn ghost" disabled={!!busy} onClick={() => void save(false)}>{busy === "draft" ? <Loader2 size={15} className="spin" /> : null} Save draft</button>
        <button className="cw-btn primary" disabled={!!busy}>{busy === "submit" ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {employeeId ? "Save & approve" : "Submit to manager"}</button>
      </div>
    </form>
  );
}

function SelfReview({ sheet, cycle, onSaved }: { sheet: Sheet; cycle: Cycle; onSaved: (m: string) => void }) {
  const done = sheet.participant.selfStatus === "SUBMITTED";
  const r = sheet.selfReview;
  const [goals, setGoals] = useState<Record<string, { rating?: number; comment: string }>>(Object.fromEntries(sheet.goals.map((g) => [g.id, { rating: g.selfRating ?? undefined, comment: g.selfComment || "" }])));
  const [ratings, setRatings] = useState<Record<string, number>>(r?.competencyRatings || {});
  const [overall, setOverall] = useState<number | null>(r?.overallRating ?? null);
  const [strengths, setStrengths] = useState(r?.strengths || "");
  const [improvements, setImprovements] = useState(r?.improvements || "");
  const [comments, setComments] = useState(r?.comments || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "draft"); setError("");
    try {
      await perfApi.saveMyReview(cycle.id, {
        goals: Object.entries(goals).filter(([, g]) => g.rating).map(([goalId, g]) => ({ goalId, rating: g.rating as number, comment: g.comment || undefined })),
        competencyRatings: ratings, overallRating: overall ?? undefined, strengths, improvements, comments, submit,
      });
      onSaved(submit ? "Self review submitted" : "Draft saved");
    } catch (reason) { setError(errorText(reason, "Unable to save your review.")); } finally { setBusy(""); }
  };
  return (
    <section className="pe-table-card perf-review-form">
      <header><h3>Self review</h3>{done ? <Badge tone="success" label="Submitted" /> : <span>{cycle.reviewsDue ? `due ${dateLabel(cycle.reviewsDue)}` : ""}</span>}</header>
      {error && <ErrorState message={error} />}
      {sheet.goals.map((g) => (
        <div key={g.id} className="perf-review-goal">
          <div><b>{g.title}</b><small>{g.weight}% · {g.progress}% achieved</small></div>
          <RatingInput label={`Rate ${g.title}`} disabled={done} value={goals[g.id]?.rating} onChange={(n) => setGoals({ ...goals, [g.id]: { ...goals[g.id], rating: n } })} />
          <input disabled={done} maxLength={2000} placeholder="What did you deliver? (optional)" value={goals[g.id]?.comment || ""} onChange={(e) => setGoals({ ...goals, [g.id]: { ...goals[g.id], comment: e.target.value } })} />
        </div>
      ))}
      <h4>Competencies</h4>
      <CompetencyRatings competencies={cycle.competencies} value={ratings} onChange={setRatings} disabled={done} />
      <div className="cw-fields">
        <label className="wide"><span>Overall, how did this period go?</span><RatingInput label="Overall" value={overall} onChange={setOverall} disabled={done} /></label>
        <label className="wide"><span>Proudest achievements</span><textarea disabled={done} rows={3} maxLength={3000} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
        <label className="wide"><span>What I want to improve</span><textarea disabled={done} rows={3} maxLength={3000} value={improvements} onChange={(e) => setImprovements(e.target.value)} /></label>
        <label className="wide"><span>Support I need / career goals</span><textarea disabled={done} rows={2} maxLength={3000} value={comments} onChange={(e) => setComments(e.target.value)} /></label>
      </div>
      {!done && cycle.status === "REVIEW" && (
        <div className="cw-create-foot">
          <button className="cw-btn ghost" disabled={!!busy} onClick={() => void save(false)}>Save draft</button>
          <button className="cw-btn primary" disabled={!!busy} onClick={() => void save(true)}>{busy === "submit" ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Submit self review</button>
        </div>
      )}
    </section>
  );
}

function NominateDrawer({ cycle, subjectId, onClose, onDone }: { cycle: Cycle; subjectId?: string; onClose: () => void; onDone: (n: number) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; employeeNumber: string; designation: string; department: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      try { setResults((await httpRequest<{ items: any[] }>(`/api/v2/employees?${new URLSearchParams({ search: query.trim(), limit: "8" })}`)).items.filter((e) => e.status === "ACTIVE")); } catch { setResults([]); }
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);
  const submit = async () => {
    setBusy(true); setError("");
    try { const r = await perfApi.nominate(cycle.id, picked.map((p) => p.id), subjectId); onDone(r.nominated); } catch (reason) { setError(errorText(reason, "Unable to send requests.")); } finally { setBusy(false); }
  };
  return (
    <Drawer title="Ask for 360 feedback" eyebrow={`PERFORMANCE · ${cycle.name.toUpperCase()}`} onClose={onClose}>
      <div className="cw-create">
        {error && <ErrorState message={error} />}
        <p className="pe-note"><Info size={13} /><span>Pick people who work with you often — peers, people from other stores or teams, or your direct reports. Your manager reviews you separately.</span></p>
        <label className="loan-picker wide"><span>Search colleagues</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or employee ID" autoComplete="off" />
          {!!results.length && <ul role="listbox">{results.filter((r) => !picked.some((p) => p.id === r.id)).map((r) => (
            <li key={r.id}><button type="button" onClick={() => { setPicked([...picked, { id: r.id, name: r.fullName }]); setQuery(""); }}><b>{r.fullName}</b><small>{r.employeeNumber} · {r.designation || "—"} · {r.department || "—"}</small></button></li>
          ))}</ul>}
        </label>
        <div className="cw-chips">{picked.map((p) => <button key={p.id} type="button" className="active" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} title="Remove">{p.name} ×</button>)}</div>
        <div className="cw-create-foot">
          <button className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy || !picked.length} onClick={() => void submit()}><Send size={15} /> Send {picked.length || ""} request{picked.length === 1 ? "" : "s"}</button>
        </div>
      </div>
    </Drawer>
  );
}
export { NominateDrawer };

// ---------------------------------------------------------------- feedback to give

function FeedbackInbox({ flash, onChanged }: { flash: (m: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState<FeedbackRequest[] | null>(null);
  const [open, setOpen] = useState<FeedbackRequest | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setItems(await perfApi.feedback()); } catch (reason) { setError(errorText(reason, "Unable to load requests.")); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <div className="cw-list-skeleton"><i /><i /></div>;
  if (!items.length) return <div className="cw-empty"><span><MessageSquare size={24} /></span><h2>No feedback requests</h2><p>When colleagues ask you for 360 feedback, it shows up here.</p></div>;
  return (
    <>
      <div className="cw-table perf-fb-table" role="table" aria-label="Feedback requests">
        <div className="cw-row head" role="row"><span role="columnheader">Colleague</span><span role="columnheader">Cycle</span><span role="columnheader">As</span><span role="columnheader">Status</span><span /></div>
        {items.map((item) => (
          <button key={item.id} role="row" className={`cw-row ${item.status === "REQUESTED" ? "actionable" : ""}`} onClick={() => setOpen(item)}>
            <span className="cw-title-cell" role="cell"><small>{item.subject.designation || ""}</small><b>{item.subject.name}</b></span>
            <span role="cell">{item.cycle.name}{item.cycle.reviewsDue && <small className="pe-muted"> · due {dateLabel(item.cycle.reviewsDue)}</small>}</span>
            <span role="cell">{RELATION_LABEL[item.relation]}</span>
            <span role="cell"><Badge tone={STATUS_TONE[item.status] || "neutral"} label={item.status === "REQUESTED" ? (item.cycle.status === "REVIEW" ? "To do" : "Opens at review") : item.status.toLowerCase()} /></span>
            <span role="cell" className="cw-row-cta">{item.status === "REQUESTED" && item.cycle.status === "REVIEW" ? <em>Give feedback</em> : null}</span>
          </button>
        ))}
      </div>
      {open && <FeedbackDrawer item={open} onClose={() => setOpen(null)} onDone={(m) => { setOpen(null); flash(m); void load(); onChanged(); }} />}
    </>
  );
}

function FeedbackDrawer({ item, onClose, onDone }: { item: FeedbackRequest; onClose: () => void; onDone: (m: string) => void }) {
  const editable = item.status === "REQUESTED" && item.cycle.status === "REVIEW";
  const [ratings, setRatings] = useState<Record<string, number>>(item.draft.competencyRatings || {});
  const [overall, setOverall] = useState<number | null>(item.draft.overallRating);
  const [strengths, setStrengths] = useState(item.draft.strengths || "");
  const [improvements, setImprovements] = useState(item.draft.improvements || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (submit: boolean) => {
    setBusy(true); setError("");
    try { await perfApi.submitFeedback(item.id, { competencyRatings: ratings, overallRating: overall ?? undefined, strengths, improvements, submit }); onDone(submit ? `Feedback for ${item.subject.name} sent` : "Draft saved"); }
    catch (reason) { setError(errorText(reason, "Unable to save feedback.")); } finally { setBusy(false); }
  };
  return (
    <Drawer wide title={`Feedback for ${item.subject.name}`} eyebrow={`360 · ${item.cycle.name.toUpperCase()}`} onClose={onClose}>
      <div className="cw-create">
        {error && <ErrorState message={error} />}
        <p className="pe-note"><Users size={13} /><span>Your answers are combined with others' and shown to {item.subject.name} without your name. Be specific and kind.</span></p>
        <CompetencyRatings competencies={item.competencies} value={ratings} onChange={setRatings} disabled={!editable} />
        <div className="cw-fields">
          <label className="wide"><span>Overall</span><RatingInput label="Overall" value={overall} onChange={setOverall} disabled={!editable} /></label>
          <label className="wide"><span>What do they do really well?</span><textarea rows={3} maxLength={3000} disabled={!editable} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
          <label className="wide"><span>What could they do better?</span><textarea rows={3} maxLength={3000} disabled={!editable} value={improvements} onChange={(e) => setImprovements(e.target.value)} /></label>
        </div>
        {editable && (
          <div className="cw-create-foot">
            <button className="cw-btn ghost" disabled={busy} onClick={async () => { if (!window.confirm("Decline this request?")) return; try { await perfApi.declineFeedback(item.id); onDone("Request declined"); } catch (reason) { setError(errorText(reason, "Couldn't decline.")); } }}>Decline</button>
            <button className="cw-btn ghost" disabled={busy} onClick={() => void save(false)}>Save draft</button>
            <button className="cw-btn primary" disabled={busy} onClick={() => void save(true)}><Send size={15} /> Send feedback</button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export { RATING_LABELS };
