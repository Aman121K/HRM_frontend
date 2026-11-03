"use client";
import { ArrowRight, BadgeIndianRupee, CheckCircle2, ChevronRight, Info, Loader2, Rocket, Send, Undo2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorText, inr } from "../payroll-engine/api";
import { Badge, Drawer, ErrorState } from "../payroll-engine/ui";
import { perfApi, STATUS_TONE, STEP_LABEL, type Context, type Cycle, type CycleInput, type Sheet, type Team, type TeamRow } from "./api";
import { CompetencyRatings, FeedbackSummary, ProgressBar, RATING_LABELS, RatingInput, RatingPill, dateLabel } from "./perf-ui";
import { GoalList, GoalsForm, NominateDrawer } from "./performance-workspace";

const STAGE_TEXT: Record<string, string> = {
  DRAFT: "Launching adds every eligible employee, opens goal setting and notifies them.",
  GOAL_SETTING: "Moving on opens self, manager and 360 reviews. Goals stay editable by managers.",
  REVIEW: "Moving to calibration closes reviews and computes each person's score and suggested increment.",
  CALIBRATION: "Publishing shows final ratings to employees. Every participant needs a final rating.",
  PUBLISHED: "Closing freezes the cycle. Approved salary revisions can still be applied.",
};

// ---------------------------------------------------------------- team list (managers) / everyone (HR)

export function TeamView({ cycle, isHr, flash }: { cycle: Cycle; isHr: boolean; flash: (m: string) => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<TeamRow | null>(null);
  const [filter, setFilter] = useState("");
  const load = useCallback(async () => { setError(""); try { setTeam(await perfApi.team(cycle.id)); } catch (reason) { setError(errorText(reason, "Unable to load the team.")); } }, [cycle.id]);
  useEffect(() => { void load(); }, [load]);
  const people = useMemo(() => (team?.people || []).filter((p) => !filter || `${p.name} ${p.number} ${p.department} ${p.manager}`.toLowerCase().includes(filter.toLowerCase())), [team, filter]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!team) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  const s = team.summary;
  const todo = (p: TeamRow) => (cycle.status === "GOAL_SETTING" && p.goalsStatus === "SUBMITTED") || (cycle.status === "REVIEW" && p.managerStatus !== "SUBMITTED");
  return (
    <>
      <section className="cw-stats" aria-label="Team progress">
        <article><small>People</small><b>{s.total}</b><span>{team.scope === "all" ? "in this cycle" : "reporting to you"}</span></article>
        <article className={cycle.status === "GOAL_SETTING" && s.goalsApproved < s.total ? "attention" : ""}><small>Goals approved</small><b>{s.goalsApproved}/{s.total}</b><span>{team.people.filter((p) => p.goalsStatus === "SUBMITTED").length} waiting for approval</span></article>
        <article className={cycle.status === "REVIEW" && s.managerDone < s.total ? "attention" : ""}><small>Manager reviews</small><b>{s.managerDone}/{s.total}</b><span>self reviews {s.selfDone}/{s.total}</span></article>
        <article><small>Average rating</small><b>{s.averageRating ?? "—"}</b><span>{s.rated} rated</span></article>
      </section>
      {team.people.length > 8 && <input className="perf-filter" type="search" placeholder="Filter by name, ID, department or manager" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter people" />}
      {!team.people.length ? <div className="cw-empty"><p>Nobody in this cycle reports to you.</p></div> : (
        <div className="cw-table perf-team-table" role="table" aria-label="People in this cycle">
          <div className="cw-row head" role="row">
            <span role="columnheader">Person</span><span role="columnheader">Goals</span><span role="columnheader">Progress</span><span role="columnheader">Self</span>
            <span role="columnheader">Manager</span><span role="columnheader">360</span><span role="columnheader" className="num">Rating</span><span />
          </div>
          {people.map((p) => (
            <button key={p.participantId} role="row" className={`cw-row ${todo(p) ? "actionable" : ""}`} onClick={() => setOpen(p)}>
              <span className="cw-title-cell" role="cell"><small>{p.number} · {p.designation || "—"}{isHr && p.manager ? ` · reports to ${p.manager}` : ""}</small><b>{p.name}</b></span>
              <span role="cell"><Badge tone={STATUS_TONE[p.goalsStatus] || "neutral"} label={`${p.goals} · ${p.goalsStatus.toLowerCase()}`} /></span>
              <span role="cell"><ProgressBar value={p.progress} label={`${p.name} goal progress`} /></span>
              <span role="cell"><Badge tone={STATUS_TONE[p.selfStatus] || "neutral"} label={p.selfStatus.toLowerCase()} /></span>
              <span role="cell"><Badge tone={STATUS_TONE[p.managerStatus] || "neutral"} label={p.managerStatus.toLowerCase()} /></span>
              <span role="cell">{p.feedback.received}/{p.feedback.requested}</span>
              <span role="cell" className="num"><RatingPill value={p.finalRating ?? p.computedScore} /></span>
              <span role="cell" className="cw-row-cta">{todo(p) ? <em>{cycle.status === "GOAL_SETTING" ? "Approve goals" : "Review"}</em> : null}<ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      )}
      {open && <PersonDrawer cycle={cycle} row={open} onClose={() => setOpen(null)} onChanged={(m) => { flash(m); void load(); }} />}
    </>
  );
}

function PersonDrawer({ cycle, row, onClose, onChanged }: { cycle: Cycle; row: TeamRow; onClose: () => void; onChanged: (m: string) => void }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [editingGoals, setEditingGoals] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const [nominating, setNominating] = useState(false);
  const load = useCallback(async () => { setError(""); try { setSheet(await perfApi.person(cycle.id, row.employeeId)); } catch (reason) { setError(errorText(reason, "Unable to load.")); } }, [cycle.id, row.employeeId]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (decision: "approve" | "return") => {
    try { await perfApi.decideGoals(cycle.id, row.employeeId, decision, note || undefined); setReturning(false); setNote(""); onChanged(decision === "approve" ? "Goals approved" : "Goals sent back"); void load(); }
    catch (reason) { setError(errorText(reason, "That didn't work.")); }
  };
  return (
    <Drawer wide title={row.name} eyebrow={`PERFORMANCE · ${cycle.name.toUpperCase()}`} onClose={onClose}
      head={sheet && <p className="perf-drawer-sub">{sheet.employee.designation || "—"} · {sheet.employee.department || "—"}{sheet.employee.manager ? ` · reports to ${sheet.employee.manager}` : ""}</p>}>
      {error && <ErrorState message={error} onRetry={load} />}
      {!sheet ? <div className="cw-list-skeleton"><i /><i /></div> : (
        <div className="perf-sheet">
          {sheet.live && cycle.status !== "PUBLISHED" && cycle.status !== "CLOSED" && (
            <p className="cw-alert"><Info size={15} /><span>Score from the manager review so far: <b>{sheet.live.score}</b> → <RatingPill value={sheet.live.rating} /> {sheet.live.band}</span></p>
          )}
          <div className="pe-section-head">
            <h2>Goals <Badge tone={STATUS_TONE[sheet.participant.goalsStatus] || "neutral"} label={sheet.participant.goalsStatus.toLowerCase()} /></h2>
            {["GOAL_SETTING", "REVIEW"].includes(cycle.status) && !editingGoals && <button className="cw-btn ghost" onClick={() => setEditingGoals(true)}>{sheet.goals.length ? "Edit goals" : "Set goals"}</button>}
          </div>
          {sheet.participant.goalsStatus === "SUBMITTED" && !editingGoals && (
            returning ? (
              <div className="loan-inline cw-create">
                <label className="wide"><span>What should change? <em>*</em></span><textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                <div className="cw-create-foot"><button className="cw-btn ghost" onClick={() => setReturning(false)}>Back</button><button className="cw-btn primary" disabled={!note.trim()} onClick={() => void decide("return")}><Undo2 size={15} /> Send back</button></div>
              </div>
            ) : (
              <div className="cw-create-foot loan-actions">
                <button className="cw-btn ghost" onClick={() => setReturning(true)}><Undo2 size={15} /> Send back</button>
                <button className="cw-btn primary" onClick={() => void decide("approve")}><CheckCircle2 size={15} /> Approve goals</button>
              </div>
            )
          )}
          {editingGoals ? <GoalsForm cycleId={cycle.id} employeeId={row.employeeId} initial={sheet.goals} onCancel={() => setEditingGoals(false)} onSaved={(m) => { setEditingGoals(false); onChanged(m); void load(); }} />
            : sheet.goals.length ? <GoalList sheet={sheet} cycle={cycle} onProgress={() => { onChanged("Progress updated"); void load(); }} /> : <p className="pe-muted">No goals yet.</p>}

          {cycle.peerReview && ["GOAL_SETTING", "REVIEW"].includes(cycle.status) && (
            <section className="pe-table-card perf-noms">
              <header><h3>360 reviewers</h3><span>{sheet.nominations.filter((n) => n.status === "SUBMITTED").length} of {sheet.nominations.length} responded</span></header>
              {sheet.nominations.length ? <ul>{sheet.nominations.map((n) => <li key={n.id}>{n.reviewer} <Badge tone={STATUS_TONE[n.status] || "neutral"} label={n.status.toLowerCase()} /></li>)}</ul> : <p className="pe-muted">Nobody asked yet.</p>}
              <button className="pe-link" onClick={() => setNominating(true)}><UserPlus size={14} /> Add reviewers</button>
            </section>
          )}

          {sheet.selfReview && sheet.selfReview.status === "SUBMITTED" && (
            <section className="pe-table-card">
              <header><h3>Self review</h3><span>submitted {dateLabel(sheet.selfReview.submittedAt)}</span></header>
              <dl className="loan-dl">
                <dt>Overall</dt><dd><RatingPill value={sheet.selfReview.overallRating} /> {sheet.selfReview.overallRating ? RATING_LABELS[sheet.selfReview.overallRating] : ""}</dd>
                {sheet.selfReview.strengths && <><dt>Achievements</dt><dd>{sheet.selfReview.strengths}</dd></>}
                {sheet.selfReview.improvements && <><dt>To improve</dt><dd>{sheet.selfReview.improvements}</dd></>}
                {sheet.selfReview.comments && <><dt>Support / career</dt><dd>{sheet.selfReview.comments}</dd></>}
              </dl>
            </section>
          )}
          {sheet.feedback && <FeedbackSummary feedback={sheet.feedback} />}
          {(cycle.status === "REVIEW" || (cycle.status === "CALIBRATION" && sheet.viewerRole === "hr") || sheet.participant.managerStatus === "SUBMITTED") && (
            <ManagerReview cycle={cycle} sheet={sheet} onSaved={(m) => { onChanged(m); void load(); }} />
          )}
        </div>
      )}
      {nominating && <NominateDrawer cycle={cycle} subjectId={row.employeeId} onClose={() => setNominating(false)} onDone={(n) => { setNominating(false); onChanged(`Asked ${n} reviewer${n === 1 ? "" : "s"}`); void load(); }} />}
    </Drawer>
  );
}

function ManagerReview({ cycle, sheet, onSaved }: { cycle: Cycle; sheet: Sheet; onSaved: (m: string) => void }) {
  const r = sheet.managerReview && "competencyRatings" in sheet.managerReview ? sheet.managerReview : null;
  const done = sheet.participant.managerStatus === "SUBMITTED" && !(cycle.status === "CALIBRATION" && sheet.viewerRole === "hr");
  const [goals, setGoals] = useState<Record<string, { rating?: number; comment: string }>>(Object.fromEntries(sheet.goals.map((g) => [g.id, { rating: g.managerRating ?? undefined, comment: g.managerComment || "" }])));
  const [ratings, setRatings] = useState<Record<string, number>>(r?.competencyRatings || {});
  const [overall, setOverall] = useState<number | null>(r?.overallRating ?? null);
  const [strengths, setStrengths] = useState(r?.strengths || "");
  const [improvements, setImprovements] = useState(r?.improvements || "");
  const [comments, setComments] = useState(r?.comments || "");
  const [increment, setIncrement] = useState<string>(sheet.participant.incrementPct != null ? String(sheet.participant.incrementPct) : "");
  const [promote, setPromote] = useState(Boolean(sheet.participant.promote));
  const [designation, setDesignation] = useState(sheet.participant.newDesignation || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "draft"); setError("");
    try {
      await perfApi.saveManagerReview(cycle.id, sheet.employee.id, {
        goals: Object.entries(goals).filter(([, g]) => g.rating).map(([goalId, g]) => ({ goalId, rating: g.rating as number, comment: g.comment || undefined })),
        competencyRatings: ratings, overallRating: overall ?? undefined, strengths, improvements, comments,
        incrementPct: increment === "" ? undefined : Number(increment), promote, newDesignation: promote ? designation : undefined, submit,
      });
      onSaved(submit ? "Manager review submitted" : "Draft saved");
    } catch (reason) { setError(errorText(reason, "Unable to save the review.")); } finally { setBusy(""); }
  };
  return (
    <section className="pe-table-card perf-review-form">
      <header><h3>Manager review</h3>{done ? <Badge tone="success" label="Submitted" /> : <span>visible to {sheet.employee.name.split(" ")[0]} once results are published</span>}</header>
      {error && <ErrorState message={error} />}
      {sheet.goals.map((g) => (
        <div key={g.id} className="perf-review-goal">
          <div><b>{g.title}</b><small>{g.weight}% · {g.progress}% achieved{g.selfRating ? ` · self-rated ${g.selfRating}` : ""}</small></div>
          <RatingInput label={`Rate ${g.title}`} disabled={done} value={goals[g.id]?.rating} onChange={(n) => setGoals({ ...goals, [g.id]: { ...goals[g.id], rating: n } })} />
          <input disabled={done} maxLength={2000} placeholder="Comment (optional)" value={goals[g.id]?.comment || ""} onChange={(e) => setGoals({ ...goals, [g.id]: { ...goals[g.id], comment: e.target.value } })} />
        </div>
      ))}
      <h4>Competencies <small className="pe-muted">({100 - cycle.goalWeight}% of the score)</small></h4>
      <CompetencyRatings competencies={cycle.competencies} value={ratings} onChange={setRatings} disabled={done} />
      <div className="cw-fields">
        <label className="wide"><span>Overall</span><RatingInput label="Overall" value={overall} onChange={setOverall} disabled={done} /></label>
        <label className="wide"><span>Strengths</span><textarea rows={2} maxLength={3000} disabled={done} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
        <label className="wide"><span>Development areas</span><textarea rows={2} maxLength={3000} disabled={done} value={improvements} onChange={(e) => setImprovements(e.target.value)} /></label>
        <label className="wide"><span>Summary for the employee</span><textarea rows={2} maxLength={3000} disabled={done} value={comments} onChange={(e) => setComments(e.target.value)} /></label>
        <label><span>Recommended increment %</span><input type="number" min={0} max={100} step={0.5} disabled={done} value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder="e.g. 8" /></label>
        <label className="pe-check"><input type="checkbox" disabled={done} checked={promote} onChange={(e) => setPromote(e.target.checked)} /><span>Recommend promotion</span></label>
        {promote && <label className="wide"><span>New designation <em>*</em></span><input disabled={done} maxLength={80} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Barista" /></label>}
      </div>
      {!done && (
        <div className="cw-create-foot">
          <button className="cw-btn ghost" disabled={!!busy} onClick={() => void save(false)}>Save draft</button>
          <button className="cw-btn primary" disabled={!!busy} onClick={() => void save(true)}>{busy === "submit" ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Submit review</button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- HR: stage control, calibration, revisions

export function CycleAdmin({ cycle, flash, onChanged }: { cycle: Cycle; flash: (m: string) => void; onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [effective, setEffective] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().slice(0, 10); });
  const load = useCallback(async () => { if (cycle.status === "DRAFT") { setTeam(null); return; } try { setTeam(await perfApi.team(cycle.id)); } catch (reason) { setError(errorText(reason, "Unable to load.")); } }, [cycle.id, cycle.status]);
  useEffect(() => { void load(); setSelected([]); }, [load]);

  const advance = async () => {
    if (!cycle.nextStatus || !window.confirm(`Move “${cycle.name}” to ${STEP_LABEL[cycle.nextStatus]}?\n\n${STAGE_TEXT[cycle.status] || ""}`)) return;
    setBusy("advance"); setError("");
    try { const r = await perfApi.advance(cycle.id, cycle.version); setNotes(r.notes); flash(`Cycle moved to ${STEP_LABEL[r.cycle.status]}`); onChanged(); }
    catch (reason) { setError(errorText(reason, "Unable to move the cycle.")); } finally { setBusy(""); }
  };
  const revisions = async (action: "approve" | "apply") => {
    if (action === "apply" && !window.confirm(`Create new salary structures effective ${dateLabel(effective)} for ${selected.length} people?`)) return;
    setBusy(action); setError("");
    try {
      const r = await perfApi.revisions(cycle.id, { participantIds: selected, action, effectiveFrom: action === "apply" ? effective : undefined });
      const msgs = action === "approve" ? [`${r.approved} approved`, ...(r.skipped || [])] : [`${r.applied?.length || 0} revisions applied from ${dateLabel(r.effectiveFrom || "")}`, ...(r.failed || []).map((f) => `${f.name}: ${f.reason}`)];
      setNotes(msgs); flash(msgs[0]); setSelected([]); void load();
    } catch (reason) { setError(errorText(reason, "That didn't work.")); } finally { setBusy(""); }
  };

  const rows = team?.people || [];
  const proposed = rows.filter((p) => p.revisionStatus === "PROPOSED"), approved = rows.filter((p) => p.revisionStatus === "APPROVED");
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <div className="perf-admin">
      <section className="pe-card perf-stage">
        <div>
          <p className="cw-eyebrow">{cycle.periodStart} → {cycle.periodEnd}{cycle.department ? ` · ${cycle.department}` : " · all departments"}</p>
          <h2>{cycle.name} <Badge tone={cycle.status === "CLOSED" ? "neutral" : "info"} label={cycle.statusLabel} /></h2>
          <p className="pe-muted">Goals {cycle.goalWeight}% · competencies {100 - cycle.goalWeight}% · {cycle.selfReview ? "self review" : "no self review"} · {cycle.peerReview ? `360 with up to ${cycle.maxPeers} people` : "no 360"}{cycle.participants !== undefined ? ` · ${cycle.participants} people` : ""}</p>
          {cycle.nextStatus && <p className="pe-note"><Info size={13} /><span>{STAGE_TEXT[cycle.status]}</span></p>}
        </div>
        {cycle.nextStatus && <button className="cw-btn primary lg" disabled={!!busy} onClick={() => void advance()}>{busy === "advance" ? <Loader2 size={16} className="spin" /> : cycle.status === "DRAFT" ? <Rocket size={16} /> : <ArrowRight size={16} />} {cycle.status === "DRAFT" ? "Launch goal setting" : `Move to ${STEP_LABEL[cycle.nextStatus]}`}</button>}
      </section>
      {error && <ErrorState message={error} />}
      {notes.map((n, i) => <p key={i} className="cw-alert"><Info size={15} /><span>{n}</span></p>)}

      {team && ["CALIBRATION", "PUBLISHED", "CLOSED"].includes(cycle.status) && (
        <>
          <section className="pe-card perf-dist" aria-label="Rating distribution">
            <header><h3>Rating distribution</h3><span>{team.summary.rated} of {team.summary.total} rated · average {team.summary.averageRating ?? "—"}</span></header>
            <div className="perf-dist-bars">
              {team.distribution.map((b) => (
                <div key={b.rating}><i style={{ height: `${Math.max(4, b.pct * 1.6)}px` }} className={`r${b.rating}`} /><b>{b.count}</b><small>{b.rating} · {b.label}</small><em>{b.pct}%</em></div>
              ))}
            </div>
          </section>

          <div className="pe-section-head">
            <h2>Calibration &amp; salary revisions</h2>
            <span className="perf-rev-actions">
              {!!selected.length && proposed.some((p) => selected.includes(p.participantId)) && <button className="cw-btn ghost" disabled={!!busy} onClick={() => void revisions("approve")}><CheckCircle2 size={15} /> Approve selected</button>}
              {!!selected.length && approved.some((p) => selected.includes(p.participantId)) && ["PUBLISHED", "CLOSED"].includes(cycle.status) && (
                <><label className="perf-eff"><span>Effective</span><input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></label>
                  <button className="cw-btn primary" disabled={!!busy} onClick={() => void revisions("apply")}><BadgeIndianRupee size={15} /> Apply to payroll</button></>
              )}
            </span>
          </div>
          <p className="pe-note"><Info size={13} /><span>Changing a rating, increment or promotion proposes a revision. A <b>different</b> HR admin approves it; after results are published, apply approved revisions to create the new salary structure (from the 1st of a month) and update the designation.</span></p>
          <div className="cw-table perf-cal-table" role="table" aria-label="Calibration">
            <div className="cw-row head" role="row"><span /><span role="columnheader">Person</span><span role="columnheader" className="num">Score</span><span role="columnheader">Final rating</span><span role="columnheader">Increment</span><span role="columnheader">Promotion</span><span role="columnheader">Revision</span><span /></div>
            {rows.map((p) => <CalibrationRow key={p.participantId} cycle={cycle} row={p} checked={selected.includes(p.participantId)} onToggle={() => toggle(p.participantId)} onSaved={(m) => { flash(m); void load(); }} />)}
          </div>
        </>
      )}
      {cycle.status !== "DRAFT" && !["CALIBRATION", "PUBLISHED", "CLOSED"].includes(cycle.status) && <p className="pe-muted">Use the <b>Everyone</b> tab to follow goal approvals and reviews. Calibration opens after the review stage.</p>}
    </div>
  );
}

function CalibrationRow({ cycle, row, checked, onToggle, onSaved }: { cycle: Cycle; row: TeamRow; checked: boolean; onToggle: () => void; onSaved: (m: string) => void }) {
  const editable = cycle.status === "CALIBRATION" && row.revisionStatus !== "APPLIED";
  const [rating, setRating] = useState<number | "">(row.finalRating ?? "");
  const [increment, setIncrement] = useState<string>(row.incrementPct != null ? String(row.incrementPct) : "");
  const [promote, setPromote] = useState(row.promote);
  const [designation, setDesignation] = useState(row.newDesignation || "");
  const [note, setNote] = useState(row.calibrationNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = rating !== (row.finalRating ?? "") || increment !== (row.incrementPct != null ? String(row.incrementPct) : "") || promote !== row.promote || designation !== (row.newDesignation || "") || note !== (row.calibrationNote || "");
  const save = async () => {
    if (rating === "") return;
    setBusy(true); setError("");
    try {
      await perfApi.calibrate(cycle.id, row.employeeId, { finalRating: Number(rating), note: note || undefined, incrementPct: increment === "" ? undefined : Number(increment), promote, newDesignation: promote ? designation : undefined, version: row.version });
      onSaved(`${row.name} calibrated`);
    } catch (reason) { setError(errorText(reason, "Couldn't save.")); } finally { setBusy(false); }
  };
  const canSelect = row.revisionStatus === "PROPOSED" || row.revisionStatus === "APPROVED";
  return (
    <div role="row" className={`cw-row ${dirty ? "actionable" : ""}`}>
      <span role="cell">{canSelect && <input type="checkbox" aria-label={`Select ${row.name}`} checked={checked} onChange={onToggle} />}</span>
      <span className="cw-title-cell" role="cell"><small>{row.number} · {row.designation || "—"}</small><b>{row.name}</b>{error && <small className="loan-over">{error}</small>}</span>
      <span role="cell" className="num">{row.computedScore ?? "—"}</span>
      <span role="cell">{editable
        ? <select aria-label={`Final rating for ${row.name}`} value={rating} onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">—</option>{[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => <option key={r} value={r}>{r} · {RATING_LABELS[Math.round(r)]}</option>)}
          </select>
        : <RatingPill value={row.finalRating} />}
        {editable && dirty && <input className="perf-note-input" aria-label="Calibration note" placeholder="Reason (needed if ≥1 point from score)" value={note} onChange={(e) => setNote(e.target.value)} />}</span>
      <span role="cell">{editable ? <input type="number" min={0} max={100} step={0.5} aria-label="Increment %" value={increment} onChange={(e) => setIncrement(e.target.value)} className="perf-num" /> : row.incrementPct != null ? `${row.incrementPct}%` : "—"}
        {row.revisionCtc ? <small className="pe-muted"> → {inr(row.revisionCtc)}</small> : null}</span>
      <span role="cell">{editable ? <span className="perf-promo-cell"><input type="checkbox" aria-label="Promote" checked={promote} onChange={(e) => setPromote(e.target.checked)} />{promote && <input aria-label="New designation" placeholder="New title" value={designation} onChange={(e) => setDesignation(e.target.value)} />}</span>
        : row.promote ? row.newDesignation : "—"}</span>
      <span role="cell"><Badge tone={STATUS_TONE[row.revisionStatus] || "neutral"} label={row.revisionStatus === "NONE" ? "none" : row.revisionStatus.toLowerCase()} />{row.revisionStatus === "PROPOSED" && row.proposedByMe && <small className="pe-muted"> by you</small>}</span>
      <span role="cell">{editable && dirty && <button className="cw-btn primary sm" disabled={busy || rating === ""} onClick={() => void save()}>{busy ? <Loader2 size={13} className="spin" /> : "Save"}</button>}</span>
    </div>
  );
}

export function CreateCycleDrawer({ context, onClose, onCreated }: { context: Context; onClose: () => void; onCreated: (c: Cycle) => void }) {
  const year = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const [form, setForm] = useState<CycleInput>({ name: `FY ${year}-${String(year + 1).slice(2)} annual review`, periodStart: `${year}-04-01`, periodEnd: `${year + 1}-03-31`, goalWeight: 70, selfReview: true, peerReview: true, maxPeers: 3 });
  const [competencies, setCompetencies] = useState(context.defaultCompetencies);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof CycleInput>(key: K, value: CycleInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { onCreated(await perfApi.createCycle({ ...form, competencies, department: form.department || undefined, goalsDue: form.goalsDue || undefined, reviewsDue: form.reviewsDue || undefined })); }
    catch (reason) { setError(errorText(reason, "Unable to create the cycle.")); } finally { setBusy(false); }
  };
  return (
    <Drawer wide title="New performance cycle" eyebrow="PERFORMANCE · SET UP" onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="cw-fields">
          <label className="wide"><span>Name <em>*</em></span><input required minLength={3} maxLength={80} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label><span>Review period from <em>*</em></span><input type="date" required value={form.periodStart} onChange={(e) => set("periodStart", e.target.value)} /></label>
          <label><span>to <em>*</em></span><input type="date" required value={form.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} /></label>
          <label><span>Goals due</span><input type="date" value={form.goalsDue || ""} onChange={(e) => set("goalsDue", e.target.value)} /></label>
          <label><span>Reviews due</span><input type="date" value={form.reviewsDue || ""} onChange={(e) => set("reviewsDue", e.target.value)} /></label>
          <label><span>Goals weight in the score</span><input type="number" min={0} max={100} step={5} value={form.goalWeight} onChange={(e) => set("goalWeight", Number(e.target.value))} /><small className="pe-muted">competencies {100 - (form.goalWeight || 0)}%</small></label>
          <label><span>Who's included</span><select value={form.department || ""} onChange={(e) => set("department", e.target.value)}><option value="">Everyone</option>{context.departments.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="pe-check"><input type="checkbox" checked={form.selfReview} onChange={(e) => set("selfReview", e.target.checked)} /><span>Self review</span></label>
          <label className="pe-check"><input type="checkbox" checked={form.peerReview} onChange={(e) => set("peerReview", e.target.checked)} /><span>360 feedback <small>peers &amp; direct reports</small></span></label>
          {form.peerReview && <label><span>Max 360 reviewers each</span><input type="number" min={1} max={8} value={form.maxPeers} onChange={(e) => set("maxPeers", Number(e.target.value))} /></label>}
        </div>
        <h4 className="perf-h4">Competencies everyone is rated on</h4>
        <div className="perf-comp-editor">
          {competencies.map((c, i) => (
            <div key={c.key}>
              <input aria-label="Competency" value={c.label} maxLength={60} onChange={(e) => setCompetencies(competencies.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input aria-label="Description" value={c.description} maxLength={300} onChange={(e) => setCompetencies(competencies.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <button type="button" className="pe-link" onClick={() => setCompetencies(competencies.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          {competencies.length < 10 && <button type="button" className="pe-link" onClick={() => setCompetencies([...competencies, { key: `c${Date.now().toString(36)}`, label: "New competency", description: "What good looks like" }])}>+ Add competency</button>}
        </div>
        <div className="cw-create-foot">
          <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cw-btn primary" disabled={busy || !competencies.length}>{busy ? "Creating…" : "Create draft cycle"}</button>
        </div>
      </form>
    </Drawer>
  );
}
