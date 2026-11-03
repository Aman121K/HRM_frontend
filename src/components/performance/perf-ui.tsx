"use client";
import { Check, Plus, Trash2 } from "lucide-react";
import type { Competency, CycleStatus, Feedback, GoalInput, KeyResult } from "./api";
import { RELATION_LABEL, STEPS, STEP_LABEL } from "./api";

export const RATING_LABELS: Record<number, string> = { 1: "Below expectations", 2: "Partially meets", 3: "Meets expectations", 4: "Exceeds expectations", 5: "Outstanding" };
export const dateLabel = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function CycleStepper({ status }: { status: CycleStatus }) {
  const index = STEPS.indexOf(status);
  return (
    <ol className="cw-stepper pe-stepper perf-stepper" aria-label="Cycle progress">
      {STEPS.map((step, i) => (
        <li key={step} className={i < index || status === "CLOSED" ? "done" : i === index ? "current" : ""} aria-current={i === index ? "step" : undefined}>
          <span>{i < index || status === "CLOSED" ? <Check size={12} /> : i + 1}</span><small>{STEP_LABEL[step]}</small>
        </li>
      ))}
    </ol>
  );
}

/** 1–5 rating as a radio group of buttons. */
export function RatingInput({ value, onChange, label, disabled }: { value: number | null | undefined; onChange: (value: number) => void; label: string; disabled?: boolean }) {
  return (
    <div className="perf-rating" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} disabled={disabled} className={value === n ? "on" : value && n < value ? "fill" : ""}
          title={RATING_LABELS[n]} onClick={() => onChange(n)}>{n}</button>
      ))}
      <small>{value ? RATING_LABELS[value] : "Not rated"}</small>
    </div>
  );
}

export function RatingPill({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="pe-muted">—</span>;
  return <span className={`perf-pill r${Math.round(value)}`} title={RATING_LABELS[Math.round(value)]}>{value.toFixed(value % 1 ? 1 : 0)}</span>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return <span className="perf-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label || "Progress"}><i style={{ width: `${Math.min(100, value)}%` }} /><small>{value}%</small></span>;
}

const emptyKr = (): KeyResult => ({ title: "", target: 100, current: 0, unit: "%" });

export function GoalsEditor({ goals, onChange }: { goals: GoalInput[]; onChange: (goals: GoalInput[]) => void }) {
  const total = goals.reduce((t, g) => t + (Number(g.weight) || 0), 0);
  const set = (i: number, patch: Partial<GoalInput>) => onChange(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const setKr = (i: number, k: number, patch: Partial<KeyResult>) => set(i, { keyResults: goals[i].keyResults.map((kr, j) => (j === k ? { ...kr, ...patch } : kr)) });
  return (
    <div className="perf-goal-editor">
      {goals.map((goal, i) => (
        <fieldset key={goal.id || i} className="perf-goal-card">
          <legend>Goal {i + 1}</legend>
          <div className="cw-fields">
            <label className="wide"><span>Objective <em>*</em></span><input required minLength={3} maxLength={160} value={goal.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="e.g. Make Indiranagar the highest-rated café in Bengaluru" /></label>
            <label><span>Weight % <em>*</em></span><input type="number" min={5} max={100} step={5} required value={goal.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} /></label>
            <label className="wide"><span>Why it matters <small>optional</small></span><textarea rows={2} maxLength={2000} value={goal.description || ""} onChange={(e) => set(i, { description: e.target.value })} /></label>
          </div>
          <div className="perf-krs">
            <p className="perf-kr-head"><b>Key results</b><small>measurable outcomes — progress is calculated from these</small></p>
            {goal.keyResults.map((kr, k) => (
              <div key={k} className="perf-kr-row">
                <input aria-label={`Key result ${k + 1}`} required minLength={2} maxLength={160} value={kr.title} onChange={(e) => setKr(i, k, { title: e.target.value })} placeholder="e.g. Google rating" />
                <input aria-label="Current" type="number" min={0} step="any" value={kr.current} onChange={(e) => setKr(i, k, { current: Number(e.target.value) })} />
                <span>of</span>
                <input aria-label="Target" type="number" min={0} step="any" value={kr.target} onChange={(e) => setKr(i, k, { target: Number(e.target.value) })} />
                <input aria-label="Unit" maxLength={20} value={kr.unit} onChange={(e) => setKr(i, k, { unit: e.target.value })} className="unit" />
                <button type="button" className="cw-icon-button" aria-label="Remove key result" onClick={() => set(i, { keyResults: goal.keyResults.filter((_, j) => j !== k) })}><Trash2 size={14} /></button>
              </div>
            ))}
            {goal.keyResults.length < 6 && <button type="button" className="pe-link" onClick={() => set(i, { keyResults: [...goal.keyResults, emptyKr()] })}><Plus size={13} /> Add key result</button>}
          </div>
          <button type="button" className="pe-link perf-remove" onClick={() => onChange(goals.filter((_, j) => j !== i))}><Trash2 size={13} /> Remove goal</button>
        </fieldset>
      ))}
      <div className="perf-goal-foot">
        {goals.length < 10 && <button type="button" className="cw-btn ghost" onClick={() => onChange([...goals, { title: "", weight: Math.max(5, 100 - total), keyResults: [emptyKr()] }])}><Plus size={15} /> Add goal</button>}
        <span className={total === 100 ? "perf-weight ok" : "perf-weight"}>Total weight {total}%{total !== 100 ? " — must be 100%" : ""}</span>
      </div>
    </div>
  );
}

export function CompetencyRatings({ competencies, value, onChange, disabled }: { competencies: Competency[]; value: Record<string, number>; onChange: (value: Record<string, number>) => void; disabled?: boolean }) {
  return (
    <div className="perf-competencies">
      {competencies.map((c) => (
        <div key={c.key} className="perf-competency">
          <div><b>{c.label}</b><small>{c.description}</small></div>
          <RatingInput label={c.label} value={value[c.key]} disabled={disabled} onChange={(n) => onChange({ ...value, [c.key]: n })} />
        </div>
      ))}
    </div>
  );
}

export function FeedbackSummary({ feedback }: { feedback: Feedback }) {
  const list = (title: string, items: Feedback["strengths"]) => !items.length ? null : (
    <div><h4>{title}</h4><ul>{items.map((item, i) => <li key={i}>“{item.text}”{item.by ? <small> — {item.by} ({RELATION_LABEL[item.relation]})</small> : <small> — {RELATION_LABEL[item.relation]}</small>}</li>)}</ul></div>
  );
  return (
    <section className="pe-table-card perf-feedback">
      <header><h3>360 feedback</h3><span>{feedback.responses} response{feedback.responses === 1 ? "" : "s"}</span></header>
      <div className="perf-bars">
        {feedback.competencies.map((c) => (
          <div key={c.key}><span>{c.label}</span><i><b style={{ width: `${((c.average || 0) / 5) * 100}%` }} /></i><em>{c.average ?? "—"}</em></div>
        ))}
      </div>
      {list("Strengths", feedback.strengths)}
      {list("Could do better", feedback.improvements)}
      {list("Other comments", feedback.comments)}
    </section>
  );
}
