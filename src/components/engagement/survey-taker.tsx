"use client";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CalendarClock, Check, CheckCircle2, ChevronLeft, ClipboardList, EyeOff, Lock, Pencil, Send, Timer, Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentActor } from "@/lib/cases";
import {
  ENGAGEMENT_ACCENT, closingLabel, dayLabel, engagementApi, errorText, isAnswered, toAnswerPayload, type AnswerValue, type SurveyDetail,
} from "./engagement-api";
import { QuestionField, answerSummary } from "./question-field";

type Step = "intro" | number | "review" | "done";
const storageKey = (id: string) => `hrm.survey-progress.${currentActor()}.${id}`;
function readProgress(id: string): { answers: Record<string, AnswerValue>; step: number } | null {
  try { const raw = window.localStorage.getItem(storageKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeProgress(id: string, value: { answers: Record<string, AnswerValue>; step: number } | null) {
  try { if (value) window.localStorage.setItem(storageKey(id), JSON.stringify(value)); else window.localStorage.removeItem(storageKey(id)); } catch { /* storage unavailable */ }
}

export function SurveyTaker({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [step, setStep] = useState<Step>("intro");
  const [resumable, setResumable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await engagementApi.get(surveyId);
      setSurvey(detail);
      const saved = readProgress(surveyId);
      if (saved && detail.me.canRespond) { setAnswers(saved.answers || {}); setResumable(Object.keys(saved.answers || {}).length > 0); }
      else if (detail.myAnswers) setAnswers(detail.myAnswers);
      setLoadError("");
    } catch (reason) { setLoadError(errorText(reason, "Unable to open this survey.")); }
  }, [surveyId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

  // Keep progress on this device only (never on the server), so anonymous drafts can't be linked to anyone.
  useEffect(() => {
    if (!survey || !survey.me.canRespond || step === "done" || step === "intro") return;
    writeProgress(survey.id, { answers, step: typeof step === "number" ? step : survey.questions.length - 1 });
  }, [answers, step, survey]);
  useEffect(() => { if (step !== "intro") headingRef.current?.focus(); }, [step]);

  const questions = survey?.questions || [];
  const total = questions.length;
  const index = typeof step === "number" ? step : -1;
  const question = index >= 0 ? questions[index] : undefined;
  const answeredCount = questions.filter((item) => isAnswered(item, answers[item.id])).length;
  const canNext = !question || !question.required || isAnswered(question, answers[question.id]);

  const go = useCallback((next: Step) => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); setError(""); setStep(next); }, []);
  const next = useCallback(() => { if (index >= 0) go(index + 1 >= total ? "review" : index + 1); }, [go, index, total]);
  const back = () => go(index <= 0 ? "intro" : index - 1);

  const setAnswer = (value: AnswerValue) => {
    if (!question) return;
    const first = !isAnswered(question, answers[question.id]);
    setAnswers((current) => ({ ...current, [question.id]: value }));
    // Gentle auto-advance after a first single-tap answer.
    if (first && value !== undefined && ["RATING", "ENPS", "SINGLE_CHOICE"].includes(question.type) && !(Array.isArray(value) && !value.length)) {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => next(), 420);
    }
  };

  // Keyboard: digits for scales, letters for choices, Enter to continue.
  useEffect(() => {
    if (!question) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if (event.key === "Enter" && (!typing || target.tagName === "INPUT" || event.metaKey || event.ctrlKey)) {
        if (target.tagName === "BUTTON") return; // let buttons activate natively
        if (canNext) { event.preventDefault(); next(); }
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (question.type === "RATING" && /^[1-5]$/.test(event.key)) setAnswer(Number(event.key));
      if (question.type === "ENPS" && /^[0-9]$/.test(event.key)) setAnswer(Number(event.key));
      if (question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") {
        const option = question.options[event.key.toUpperCase().charCodeAt(0) - 65];
        if (event.key.length === 1 && option) {
          const selected = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
          setAnswer(question.type === "SINGLE_CHOICE" ? [option] : selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const submit = async () => {
    if (!survey) return;
    const missing = questions.findIndex((item) => item.required && !isAnswered(item, answers[item.id]));
    if (missing >= 0) { go(missing); setError("This question needs an answer."); return; }
    setBusy(true); setError("");
    try {
      const updated = await engagementApi.respond(survey.id, toAnswerPayload(questions, answers));
      writeProgress(survey.id, null);
      setSurvey({ ...survey, ...updated });
      setEditing(false);
      go("done");
    } catch (reason) { setError(errorText(reason, "Your response couldn't be submitted. Your answers are still here — try again.")); } finally { setBusy(false); }
  };

  const shell = (children: React.ReactNode, wide = false) => (
    <div className="cw-page eg-page eg-take-page" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}>
      <Link className="eg-back" href="/surveys"><ArrowLeft size={15} /> Surveys</Link>
      <div className={`eg-take${wide ? " wide" : ""}`}>{children}</div>
    </div>
  );

  if (loadError) return shell(<div className="eg-take-card center"><AlertTriangle size={28} className="eg-coral" /><h1>We couldn’t open this survey</h1><p className="eg-muted">{loadError}</p><Link className="cw-btn primary" href="/surveys">Back to surveys</Link></div>);
  if (!survey) return shell(<div className="eg-take-card"><div className="cw-skeleton"><i /><i /><i /></div></div>);

  const privacy = survey.anonymous
    ? <p className="eg-privacy-note"><EyeOff size={15} /> <span><b>Anonymous.</b> Your name is never stored with your answers — we only note that you responded, so you won’t get reminders. Results show once {survey.minGroupSize}+ people answer.</span></p>
    : <p className="eg-privacy-note identified"><Users size={15} /> <span><b>Not anonymous.</b> {survey.owner.name} and HR will see your name next to your answers.{survey.allowEdit ? " You can edit your response until the survey closes." : ""}</span></p>;

  // ---- non-answerable states
  if (survey.status === "DRAFT") return shell(<div className="eg-take-card center"><ClipboardList size={28} /><h1>This survey is still a draft</h1><p className="eg-muted">Launch it before people can respond.</p>{survey.canManage && <Link className="cw-btn primary" href={`/surveys/${survey.id}/edit`}><Pencil size={14} /> Open builder</Link>}</div>);
  if (!survey.me.invited) return shell(<div className="eg-take-card center"><Lock size={28} /><h1>{survey.title}</h1><p className="eg-muted">You’re not in this survey’s audience.</p>{survey.canViewResults && <Link className="cw-btn primary" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> View results</Link>}</div>);
  if (survey.state === "SCHEDULED") return shell(<div className="eg-take-card center"><CalendarClock size={28} /><h1>{survey.title}</h1><p className="eg-muted">Opens on {dayLabel(survey.opensAt)}. We’ll notify you.</p></div>);

  if (step === "done" || (survey.me.respondedOn && !editing && step === "intro")) {
    const justNow = step === "done";
    return shell(
      <div className="eg-take-card center eg-done">
        <span className="eg-done-mark"><Check size={30} strokeWidth={2.6} /></span>
        <h1>{justNow ? "Thank you — response recorded" : "You’ve already responded"}</h1>
        <p className="eg-muted">{justNow ? (survey.anonymous ? "Your answers were saved anonymously." : "Your answers were saved.") : `You answered on ${dayLabel(survey.me.respondedOn)}.`}
          {survey.closesAt && survey.state === "LIVE" ? ` The survey ${closingLabel(survey.closesAt).toLowerCase()}.` : ""}</p>
        <div className="eg-done-actions">
          {survey.me.canEdit && <button className="cw-btn ghost" onClick={() => { setEditing(true); go(0); }}><Pencil size={14} /> Edit my answers</button>}
          {survey.canViewResults && <Link className="cw-btn ghost" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> See results</Link>}
          <Link className="cw-btn primary" href="/surveys">Back to surveys</Link>
        </div>
      </div>,
    );
  }
  if (!survey.me.canRespond) return shell(<div className="eg-take-card center"><Lock size={28} /><h1>{survey.title}</h1><p className="eg-muted">This survey closed on {dayLabel(survey.closedAt || survey.closesAt)} before you responded.</p>{survey.canViewResults && <Link className="cw-btn primary" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> View results</Link>}</div>);

  // ---- intro
  if (step === "intro") return shell(
    <div className="eg-take-card eg-intro">
      <p className="cw-eyebrow">{survey.anonymous ? "ANONYMOUS SURVEY" : "SURVEY"} · FROM {survey.owner.name.toUpperCase()}</p>
      <h1 ref={headingRef} tabIndex={-1}>{survey.title}</h1>
      {survey.description && <p className="eg-intro-desc">{survey.description}</p>}
      <ul className="eg-intro-facts">
        <li><ClipboardList size={16} /><b>{total}</b> questions</li>
        <li><Timer size={16} /><b>~{survey.estimatedMinutes}</b> min</li>
        <li><CalendarClock size={16} />{closingLabel(survey.closesAt, survey.state)}</li>
      </ul>
      {privacy}
      <div className="eg-take-actions">
        {resumable ? <>
          <button className="cw-btn ghost lg" onClick={() => { setAnswers(survey.myAnswers || {}); setResumable(false); writeProgress(survey.id, null); go(0); }}>Start over</button>
          <button className="cw-btn primary lg" onClick={() => { const saved = readProgress(survey.id); go(Math.min(saved?.step ?? 0, total - 1)); }}>Resume ({answeredCount}/{total}) <ArrowRight size={16} /></button>
        </> : <button className="cw-btn primary lg" onClick={() => go(0)} autoFocus>{survey.me.respondedOn ? "Review my answers" : "Start"} <ArrowRight size={16} /></button>}
      </div>
      <p className="eg-kbd-hint">Tip: use number or letter keys to answer and <kbd>Enter</kbd> to continue.</p>
    </div>,
  );

  // ---- review
  if (step === "review") return shell(
    <div className="eg-take-card">
      <Progress value={total} total={total} answered={answeredCount} />
      <p className="cw-eyebrow">REVIEW</p>
      <h1 ref={headingRef} tabIndex={-1}>Ready to submit?</h1>
      <p className="eg-muted">{survey.anonymous ? "Once submitted, anonymous answers can’t be changed." : survey.allowEdit ? "You can come back and edit until the survey closes." : "Once submitted, answers can’t be changed."}</p>
      <ol className="eg-review">
        {questions.map((item, i) => {
          const missing = item.required && !isAnswered(item, answers[item.id]);
          return (
            <li key={item.id} className={missing ? "missing" : ""}>
              <button onClick={() => go(i)}>
                <span className="eg-review-num">{i + 1}</span>
                <span><b>{item.prompt}</b><small>{missing ? "Required — tap to answer" : answerSummary(item, answers[item.id])}</small></span>
                <Pencil size={14} />
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <div className="eg-take-actions">
        <button className="cw-btn ghost lg" onClick={() => go(total - 1)}><ChevronLeft size={16} /> Back</button>
        <button className="cw-btn primary lg" onClick={submit} disabled={busy}><Send size={15} /> {busy ? "Submitting…" : survey.me.respondedOn ? "Update response" : "Submit response"}</button>
      </div>
    </div>,
  );

  // ---- one question at a time
  return shell(
    <div className="eg-take-card eg-question" key={question!.id}>
      <Progress value={index + 1} total={total} answered={answeredCount} />
      <p className="eg-step">Question {index + 1} of {total}{!question!.required && <span> · optional</span>}{survey.anonymous && <span className="eg-step-anon"><EyeOff size={11} /> anonymous</span>}</p>
      <h1 ref={headingRef} tabIndex={-1} id={`qh-${question!.id}`}>{question!.prompt}</h1>
      {question!.helpText && <p className="eg-muted eg-help">{question!.helpText}</p>}
      <QuestionField question={question!} value={answers[question!.id]} onChange={setAnswer} />
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <div className="eg-take-actions">
        <button className="cw-btn ghost lg" onClick={back}><ChevronLeft size={16} /> Back</button>
        <button className="cw-btn primary lg" onClick={next} disabled={!canNext}>
          {index + 1 >= total ? <>Review <CheckCircle2 size={16} /></> : !isAnswered(question!, answers[question!.id]) && !question!.required ? <>Skip <ArrowRight size={16} /></> : <>Next <ArrowRight size={16} /></>}
        </button>
      </div>
      <p className="eg-saved-note">Progress is saved on this device.</p>
    </div>,
  );
}

function Progress({ value, total, answered }: { value: number; total: number; answered: number }) {
  return (
    <div className="eg-take-progress">
      <div className="eg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={`Question ${value} of ${total}`}>
        <i style={{ width: `${(value / Math.max(1, total)) * 100}%` }} />
      </div>
      <span>{answered}/{total} answered</span>
    </div>
  );
}
