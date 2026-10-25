"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Lock, Plus, Rocket, Save, Sparkles, Trash2, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import {
  DEFAULT_SCALES, ENGAGEMENT_ACCENT, blankQuestion, engagementApi, errorText, newKey, questionTypes, stateLabel, stateTone, toLocalInput, typeMeta,
  type AnswerValue, type AudienceType, type BuilderOptions, type QuestionDraft, type QuestionType, type SurveyDetail, type SurveyDraft,
} from "./engagement-api";
import { QuestionField } from "./question-field";
import { Toggle, audienceName } from "./surveys-home";

const q = (type: QuestionType, prompt: string, extra: Partial<QuestionDraft> = {}): QuestionDraft => ({ ...blankQuestion(type), prompt, ...extra });
const templates: { key: string; label: string; hint: string; build: () => Partial<SurveyDraft> }[] = [
  { key: "enps", label: "eNPS pulse", hint: "5 questions · anonymous", build: () => ({
    title: "Quarterly eNPS pulse", description: "A two-minute check on how it feels to work here. Anonymous — results appear only once at least 3 people answer.", anonymous: true,
    questions: [
      q("ENPS", "How likely are you to recommend us as a place to work to a friend?"),
      q("RATING", "I have the tools and resources I need to do my job well."),
      q("RATING", "My manager gives me regular, useful feedback."),
      q("RATING", "I see myself still working here in two years."),
      q("LONG_TEXT", "What is one thing we should start, stop or keep doing?", { required: false }),
    ] }) },
  { key: "checkin", label: "Team check-in", hint: "3 questions · identified", build: () => ({
    title: "Monthly team check-in", description: "A quick check-in so I can support you better. Your name is shared with me so I can follow up.", anonymous: false, allowEdit: true,
    questions: [
      q("RATING", "How manageable was your workload this month?", { scaleLabels: ["Overwhelming", "Heavy", "About right", "Light", "Very light"] }),
      q("SINGLE_CHOICE", "Would you like a one-to-one this week?", { options: ["Yes, please", "Maybe later", "Not needed"] }),
      q("LONG_TEXT", "Anything blocking you that I can help with?", { required: false }),
    ] }) },
  { key: "onboarding", label: "30-day onboarding", hint: "5 questions · anonymous", build: () => ({
    title: "Your first 30 days", description: "Help us make onboarding better for the next person.", anonymous: true,
    questions: [
      q("RATING", "My first week was well organised."),
      q("RATING", "I understand what is expected of me in my role."),
      q("MULTI_CHOICE", "Which of these were missing when you joined?", { required: false, options: ["Laptop / tools", "System access", "Buddy or mentor", "Role training", "Nothing was missing"] }),
      q("ENPS", "How likely are you to recommend our onboarding to a friend who joins?"),
      q("SHORT_TEXT", "One thing that surprised you (good or bad)?", { required: false }),
    ] }) },
];

function emptyDraft(isHr: boolean): SurveyDraft {
  return { title: "", description: "", anonymous: true, allowEdit: false, shareResults: false, audienceType: isHr ? "ALL" : "TEAM", audienceValues: [], opensAt: "", closesAt: "", questions: [] };
}
function fromSurvey(survey: SurveyDetail): SurveyDraft {
  return {
    title: survey.title, description: survey.description || "", anonymous: survey.anonymous, allowEdit: survey.allowEdit, shareResults: survey.shareResults,
    audienceType: survey.audience.type, audienceValues: survey.audience.values, opensAt: toLocalInput(survey.opensAt), closesAt: toLocalInput(survey.closesAt),
    questions: survey.questions.map((question) => ({ key: question.id, type: question.type, prompt: question.prompt, helpText: question.helpText || "", required: question.required,
      options: question.options.length ? question.options : ["", ""], scaleLabels: question.scaleLabels.length ? question.scaleLabels : DEFAULT_SCALES[question.type] || [] })),
  };
}

function validate(draft: SurveyDraft) {
  const errors: Record<string, string> = {};
  if (draft.title.trim().length < 3) errors.title = "Give the survey a title (3+ characters).";
  if ((draft.audienceType === "DEPARTMENTS" || draft.audienceType === "LOCATIONS") && !draft.audienceValues.length) errors.audience = "Pick at least one group.";
  if (draft.opensAt && draft.closesAt && new Date(draft.closesAt) <= new Date(draft.opensAt)) errors.closesAt = "Close must be after open.";
  if (draft.closesAt && new Date(draft.closesAt).getTime() <= Date.now()) errors.closesAt = "Close date must be in the future.";
  draft.questions.forEach((question) => {
    if (question.prompt.trim().length < 3) errors[question.key] = "Write the question (3+ characters).";
    else if (question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") {
      const options = question.options.map((item) => item.trim()).filter(Boolean);
      if (options.length < 2) errors[question.key] = "Add at least two options.";
      else if (new Set(options.map((item) => item.toLowerCase())).size !== options.length) errors[question.key] = "Options must be unique.";
    } else if (question.type === "RATING" && question.scaleLabels.some((label) => !label.trim())) errors[question.key] = "Scale labels cannot be blank.";
  });
  return errors;
}

function payload(draft: SurveyDraft) {
  return {
    title: draft.title.trim(), description: draft.description.trim(), anonymous: draft.anonymous, allowEdit: draft.anonymous ? false : draft.allowEdit, shareResults: draft.shareResults,
    audienceType: draft.audienceType, audienceValues: draft.audienceType === "DEPARTMENTS" || draft.audienceType === "LOCATIONS" ? draft.audienceValues : [],
    opensAt: draft.opensAt ? new Date(draft.opensAt).toISOString() : null, closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : null,
    questions: draft.questions.map((question) => ({
      type: question.type, prompt: question.prompt.trim(), helpText: question.helpText.trim() || undefined, required: question.required,
      options: question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE" ? question.options.map((item) => item.trim()).filter(Boolean) : undefined,
      scaleLabels: question.type === "RATING" || question.type === "ENPS" ? question.scaleLabels.map((item) => item.trim()) : undefined,
    })),
  };
}

export function SurveyBuilder({ surveyId }: { surveyId?: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<BuilderOptions | null>(null);
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [selected, setSelected] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await engagementApi.options();
        setOptions(data);
        if (surveyId) { const detail = await engagementApi.get(surveyId); if (!detail.canManage) throw new Error("Only the survey owner and HR can edit this survey."); setSurvey(detail); setDraft(fromSurvey(detail)); }
        else setDraft(emptyDraft(data.viewer.isHr));
      } catch (reason) { setLoadError(errorText(reason, "Unable to open the survey builder.")); }
    })();
  }, [surveyId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const errors = useMemo(() => (draft ? validate(draft) : {}), [draft]);
  const locked = !!survey && survey.status !== "DRAFT";
  const closed = survey?.status === "CLOSED";

  if (loadError) return <div className="cw-page eg-page" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}><BackLink /><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {loadError}</p></div>;
  if (!draft || !options) return <div className="cw-page eg-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;

  const set = (patch: Partial<SurveyDraft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const setQuestion = (index: number, patch: Partial<QuestionDraft>) => set({ questions: draft.questions.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const addQuestion = (type: QuestionType) => { set({ questions: [...draft.questions, blankQuestion(type)] }); setSelected(draft.questions.length); };
  const move = (index: number, delta: number) => {
    const next = [...draft.questions]; const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set({ questions: next }); setSelected(target);
  };
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  const audienceSize = draft.audienceType === "ALL" ? options.total : draft.audienceType === "TEAM" ? options.teamSize
    : (draft.audienceType === "DEPARTMENTS" ? options.departments : options.locations).filter((group) => draft.audienceValues.includes(group.name)).reduce((sum, group) => sum + group.count, 0);
  const tooSmall = draft.anonymous && audienceSize > 0 && audienceSize < options.minGroupSize;

  const save = async (): Promise<SurveyDetail | null> => {
    if (Object.keys(errors).length) { setShowErrors(true); setError("Fix the highlighted fields first."); return null; }
    setBusy(true); setError("");
    try {
      if (!survey) {
        const created = await engagementApi.create(payload(draft));
        const detail = await engagementApi.get(created.id);
        setSurvey(detail); setDirty(false);
        router.replace(`/surveys/${created.id}/edit`);
        return detail;
      }
      const body = locked
        ? { version: survey.version, description: draft.description.trim(), closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : null, shareResults: draft.shareResults }
        : { version: survey.version, ...payload(draft) };
      await engagementApi.update(survey.id, body);
      const detail = await engagementApi.get(survey.id);
      setSurvey(detail); setDraft(fromSurvey(detail)); setDirty(false);
      return detail;
    } catch (reason) { setError(errorText(reason, "Could not save the survey.")); return null; } finally { setBusy(false); }
  };

  const launch = () => {
    if (Object.keys(errors).length || !draft.questions.length) { setShowErrors(true); setError(draft.questions.length ? "Fix the highlighted fields first." : "Add at least one question before launching."); return; }
    setConfirm({
      title: "Launch this survey?", confirm: "Launch now",
      body: <>
        <p><b>{audienceSize}</b> {audienceSize === 1 ? "person" : "people"} ({audienceName(draft.audienceType, options).replace(/ \(\d+\)$/, "").toLowerCase()}) will be notified{draft.opensAt && new Date(draft.opensAt) > new Date() ? " and can answer once it opens" : ""}.</p>
        <p>{draft.anonymous ? "Responses will be anonymous. Results unlock at 3 responses." : "Responses will show each person’s name to you and HR."} Questions can’t change after launch.</p>
      </>,
      run: async () => {
        setBusy(true);
        try {
          const saved = await save();
          if (!saved) { setConfirm(null); return; }
          setBusy(true);
          await engagementApi.launch(saved.id, saved.version);
          setDirty(false);
          router.push("/surveys?tab=manage");
        } catch (reason) { setConfirm(null); setError(errorText(reason, "Could not launch.")); } finally { setBusy(false); }
      },
    });
  };

  const current = draft.questions[Math.min(selected, draft.questions.length - 1)];
  const groups = draft.audienceType === "DEPARTMENTS" ? options.departments : draft.audienceType === "LOCATIONS" ? options.locations : null;

  return (
    <div className="cw-page eg-page eg-builder-page" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}>
      <BackLink />
      <header className="eg-builder-head">
        <div>
          <p className="cw-eyebrow">{survey ? "EDIT SURVEY" : "NEW SURVEY"}</p>
          <h1>{draft.title.trim() || "Untitled survey"}</h1>
          <p className="eg-muted">
            {survey && <span className={`cw-badge tone-${stateTone[survey.state]}`}><i />{stateLabel[survey.state]}</span>}
            {draft.questions.length} question{draft.questions.length === 1 ? "" : "s"} · {audienceSize} in audience · {draft.anonymous ? "anonymous" : "identified"}
            {dirty && <em className="eg-dirty">Unsaved changes</em>}
          </p>
        </div>
        <div className="eg-builder-actions">
          <button className="cw-btn ghost eg-preview-toggle" onClick={() => setPreviewOpen(true)}><Eye size={15} /> Preview</button>
          {!closed && <button className="cw-btn ghost" onClick={async () => { const saved = await save(); if (saved) flash(locked ? "Changes saved." : "Draft saved."); }} disabled={busy}><Save size={15} /> {locked ? "Save changes" : "Save draft"}</button>}
          {!locked && <button className="cw-btn primary" onClick={launch} disabled={busy}><Rocket size={15} /> Launch</button>}
          {locked && <Link className="cw-btn primary" href={`/surveys/${survey!.id}/results`}>View results</Link>}
        </div>
      </header>
      {locked && <p className="cw-alert warn"><Lock size={15} /> This survey is {closed ? "closed" : "live"}. Questions, audience and privacy settings are locked{closed ? "." : " — you can still update the description, close date and result sharing."}</p>}
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}

      <div className="eg-builder">
        <div className="eg-builder-main">
          {!survey && !draft.questions.length && (
            <section className="eg-templates" aria-label="Templates">
              <h2><Sparkles size={15} /> Start from a template</h2>
              <div>
                {templates.filter((template) => options.viewer.isHr || template.key !== "enps" || options.teamSize >= 3).map((template) => (
                  <button key={template.key} type="button" onClick={() => { set({ ...template.build() }); setSelected(0); }}>
                    <b>{template.label}</b><small>{template.hint}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="eg-card" aria-labelledby="eg-settings-title">
            <h2 id="eg-settings-title">Basics</h2>
            <div className="cw-fields">
              <label className="wide"><span>Title <em>*</em></span>
                <input value={draft.title} maxLength={200} disabled={locked} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Café experience survey" aria-invalid={showErrors && !!errors.title} />
                {showErrors && errors.title && <small className="eg-error">{errors.title}</small>}
              </label>
              <label className="wide"><span>Description <small>(shown on the intro screen)</small></span>
                <textarea rows={3} value={draft.description} maxLength={2000} disabled={closed} onChange={(event) => set({ description: event.target.value })} placeholder="Why you are asking and what happens with the answers." />
              </label>
              <label><span>Audience</span>
                <select value={draft.audienceType} disabled={locked} onChange={(event) => set({ audienceType: event.target.value as AudienceType, audienceValues: [] })}>
                  {options.audienceTypes.map((type) => <option key={type} value={type}>{audienceName(type, options)}</option>)}
                </select>
                {showErrors && errors.audience && <small className="eg-error">{errors.audience}</small>}
              </label>
              <div className="eg-audience-size" aria-live="polite"><b>{audienceSize}</b><span>{audienceSize === 1 ? "person" : "people"} will be invited</span></div>
              {groups && (
                <div className="wide eg-audience-chips" role="group" aria-label="Choose groups">
                  {groups.map((group) => { const on = draft.audienceValues.includes(group.name); return (
                    <button type="button" key={group.name} disabled={locked} className={on ? "on" : ""} aria-pressed={on} onClick={() => set({ audienceValues: on ? draft.audienceValues.filter((item) => item !== group.name) : [...draft.audienceValues, group.name] })}>{group.name} <b>{group.count}</b></button>
                  ); })}
                </div>
              )}
              <label><span>Opens <small>(blank = at launch)</small></span><input type="datetime-local" value={draft.opensAt} disabled={locked} onChange={(event) => set({ opensAt: event.target.value })} /></label>
              <label><span>Closes <small>(optional)</small></span><input type="datetime-local" value={draft.closesAt} disabled={closed} onChange={(event) => set({ closesAt: event.target.value })} aria-invalid={showErrors && !!errors.closesAt} />
                {showErrors && errors.closesAt && <small className="eg-error">{errors.closesAt}</small>}</label>
            </div>
            <div className="eg-toggles">
              <Toggle checked={draft.anonymous} disabled={locked} onChange={(value) => set({ anonymous: value, allowEdit: value ? false : draft.allowEdit })} label="Anonymous responses"
                hint="Answers are stored with no name and only the day. Results appear once 3+ people respond." />
              <Toggle checked={!draft.anonymous && draft.allowEdit} disabled={locked || draft.anonymous} onChange={(value) => set({ allowEdit: value })} label="Let people edit their answers until close"
                hint={draft.anonymous ? "Not available for anonymous surveys — answers can’t be traced back to edit." : "Respondents can revisit and change their response."} />
              <Toggle checked={draft.shareResults} disabled={closed} onChange={(value) => set({ shareResults: value })} label="Share results with respondents after close"
                hint="Aggregates only, never names. The anonymity threshold still applies." />
            </div>
            {tooSmall && <p className="cw-alert warn"><EyeOff size={15} /> Anonymous surveys need at least {options.minGroupSize} people in the audience. Widen the audience or turn off anonymity.</p>}
          </section>

          <section className="eg-card" aria-labelledby="eg-questions-title">
            <h2 id="eg-questions-title">Questions <span className="eg-count">{draft.questions.length}</span></h2>
            {!draft.questions.length && <p className="eg-muted">No questions yet. Pick a type below or start from a template.</p>}
            <ol className="eg-q-list">
              {draft.questions.map((question, index) => (
                <QuestionEditor key={question.key} index={index} question={question} total={draft.questions.length} locked={locked} active={index === selected}
                  error={showErrors ? errors[question.key] : undefined}
                  onFocus={() => setSelected(index)} onChange={(patch) => setQuestion(index, patch)} onMove={(delta) => move(index, delta)}
                  onDuplicate={() => { const next = [...draft.questions]; next.splice(index + 1, 0, { ...question, key: newKey(), options: [...question.options], scaleLabels: [...question.scaleLabels] }); set({ questions: next }); setSelected(index + 1); }}
                  onRemove={() => { set({ questions: draft.questions.filter((_, i) => i !== index) }); setSelected(Math.max(0, index - 1)); }} />
              ))}
            </ol>
            {!locked && (
              <div className="eg-type-picker" role="group" aria-label="Add a question">
                <span className="eg-field-label">Add a question</span>
                <div>
                  {questionTypes.map((item) => { const Icon = item.icon; return (
                    <button key={item.type} type="button" onClick={() => addQuestion(item.type)} disabled={draft.questions.length >= 40}>
                      <Icon size={16} /><b>{item.label}</b><small>{item.hint}</small>
                    </button>
                  ); })}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className={`eg-builder-preview${previewOpen ? " open" : ""}`} aria-label="Live preview">
          <div className="eg-preview-head">
            <span><Eye size={14} /> Live preview</span>
            <button className="cw-icon-button eg-preview-close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}><X size={15} /></button>
          </div>
          <Preview draft={draft} index={Math.min(selected, Math.max(0, draft.questions.length - 1))} onIndex={setSelected} current={current} />
        </aside>
      </div>
      {previewOpen && <button className="flow-backdrop eg-preview-backdrop" aria-label="Close preview" onClick={() => setPreviewOpen(false)} />}
      {confirm && <ConfirmDialog request={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function BackLink() {
  return <Link className="eg-back" href="/surveys?tab=manage"><ArrowLeft size={15} /> Surveys</Link>;
}

function QuestionEditor({ index, question, total, locked, active, error, onFocus, onChange, onMove, onDuplicate, onRemove }: {
  index: number; question: QuestionDraft; total: number; locked: boolean; active: boolean; error?: string;
  onFocus: () => void; onChange: (patch: Partial<QuestionDraft>) => void; onMove: (delta: number) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const meta = typeMeta(question.type);
  const Icon = meta.icon;
  const choice = question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE";
  return (
    <li className={`eg-q${active ? " active" : ""}${error ? " invalid" : ""}`} onFocusCapture={onFocus} onClick={onFocus}>
      <header>
        <span className="eg-q-num">{index + 1}</span>
        <span className="eg-q-type"><Icon size={13} /> {meta.label}</span>
        {!locked && (
          <span className="eg-q-tools">
            <select aria-label={`Question ${index + 1} type`} value={question.type} onChange={(event) => {
              const type = event.target.value as QuestionType;
              const fresh = blankQuestion(type);
              onChange({ type, options: fresh.options.length && question.options.some(Boolean) ? question.options : fresh.options, scaleLabels: fresh.scaleLabels });
            }}>
              {questionTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
            </select>
            <button type="button" className="cw-icon-button" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
            <button type="button" className="cw-icon-button" aria-label={`Move question ${index + 1} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /></button>
            <button type="button" className="cw-icon-button" aria-label={`Duplicate question ${index + 1}`} onClick={onDuplicate}><Copy size={14} /></button>
            <button type="button" className="cw-icon-button" aria-label={`Delete question ${index + 1}`} onClick={onRemove}><Trash2 size={14} /></button>
          </span>
        )}
      </header>
      <div className="cw-fields">
        <label className="wide"><span className="sr-only">Question {index + 1}</span>
          <input className="eg-q-prompt" value={question.prompt} maxLength={500} disabled={locked} placeholder="Type your question" onChange={(event) => onChange({ prompt: event.target.value })} aria-invalid={!!error} />
        </label>
        <label className="wide"><span className="sr-only">Helper text</span>
          <input value={question.helpText} maxLength={500} disabled={locked} placeholder="Helper text (optional)" onChange={(event) => onChange({ helpText: event.target.value })} />
        </label>
        {choice && (
          <div className="wide eg-option-editor">
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="eg-option-row">
                <i className={question.type === "MULTI_CHOICE" ? "box" : "dot"} aria-hidden="true" />
                <input value={option} maxLength={120} disabled={locked} placeholder={`Option ${optionIndex + 1}`} aria-label={`Option ${optionIndex + 1}`}
                  onChange={(event) => onChange({ options: question.options.map((item, i) => (i === optionIndex ? event.target.value : item)) })} />
                {!locked && <button type="button" className="cw-icon-button" aria-label={`Remove option ${optionIndex + 1}`} disabled={question.options.length <= 2}
                  onClick={() => onChange({ options: question.options.filter((_, i) => i !== optionIndex) })}><X size={14} /></button>}
              </div>
            ))}
            {!locked && question.options.length < 12 && <button type="button" className="cw-btn ghost" onClick={() => onChange({ options: [...question.options, ""] })}><Plus size={14} /> Add option</button>}
          </div>
        )}
        {(question.type === "RATING" || question.type === "ENPS") && (
          <div className="wide eg-scale-editor">
            <span className="eg-field-label">{question.type === "RATING" ? "Scale labels (1 → 5)" : "End labels (0 and 10)"}</span>
            <div className={question.type === "RATING" ? "five" : "two"}>
              {question.scaleLabels.map((label, labelIndex) => (
                <input key={labelIndex} value={label} maxLength={40} disabled={locked} aria-label={`Scale label ${labelIndex + 1}`}
                  onChange={(event) => onChange({ scaleLabels: question.scaleLabels.map((item, i) => (i === labelIndex ? event.target.value : item)) })} />
              ))}
            </div>
          </div>
        )}
      </div>
      <footer>
        <Toggle checked={question.required} disabled={locked} onChange={(value) => onChange({ required: value })} label="Required" />
        {error && <small className="eg-error"><AlertTriangle size={12} /> {error}</small>}
      </footer>
    </li>
  );
}

function Preview({ draft, index, onIndex, current }: { draft: SurveyDraft; index: number; onIndex: (index: number) => void; current?: QuestionDraft }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  if (!current) return (
    <div className="eg-preview-card empty">
      <p className="cw-eyebrow">{draft.anonymous ? "ANONYMOUS SURVEY" : "SURVEY"}</p>
      <h3>{draft.title || "Untitled survey"}</h3>
      <p className="eg-muted">Add a question to see how it looks to employees.</p>
    </div>
  );
  const total = draft.questions.length;
  return (
    <div className="eg-preview-card">
      <div className="eg-progress" aria-hidden="true"><i style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <p className="eg-preview-step">Question {index + 1} of {total}{!current.required && " · optional"}</p>
      <h3>{current.prompt || <span className="eg-muted">Your question appears here</span>}</h3>
      {current.helpText && <p className="eg-muted">{current.helpText}</p>}
      <QuestionField preview idPrefix="preview" question={{ id: current.key, type: current.type, prompt: current.prompt, helpText: current.helpText, required: current.required, options: current.options, scaleLabels: current.scaleLabels }}
        value={answers[current.key]} onChange={(value) => setAnswers({ ...answers, [current.key]: value })} />
      <div className="eg-preview-nav">
        <button className="cw-btn ghost" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={14} /> Back</button>
        <button className="cw-btn primary" disabled={index >= total - 1} onClick={() => onIndex(index + 1)}>Next <ChevronRight size={14} /></button>
      </div>
      {draft.anonymous && <p className="eg-preview-anon"><EyeOff size={12} /> Anonymous — responses carry no name</p>}
    </div>
  );
}
