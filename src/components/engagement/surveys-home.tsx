"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BarChart3, BellRing, CalendarClock, CheckCircle2, ClipboardList, Copy, EyeOff, Lock, MessageSquareHeart,
  Pencil, Play, Plus, Rocket, Square, Timer, Trash2, Users, Vote, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { RateBar } from "./charts";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import {
  ENGAGEMENT_ACCENT, closingLabel, dayLabel, engagementApi, errorText, stateLabel, stateTone,
  type AudienceType, type BuilderOptions, type EngagementViewer, type Home, type Poll, type Survey,
} from "./engagement-api";
import { PollWidget } from "./poll-widget";

type Tab = "mine" | "manage" | "polls";

export function SurveysHome() {
  const params = useSearchParams();
  const router = useRouter();
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState("");
  const initialTab = (params.get("tab") as Tab) || "mine";
  const [tab, setTab] = useState<Tab>(["mine", "manage", "polls"].includes(initialTab) ? initialTab : "mine");
  const [pollDrawer, setPollDrawer] = useState(params.get("new") === "poll");
  const [toast, setToast] = useState("");
  const [pollsVersion, setPollsVersion] = useState(0);

  const load = useCallback(async () => {
    try { setHome(await engagementApi.home()); setError(""); } catch (reason) { setError(errorText(reason, "Unable to load surveys.")); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3400); };
  const switchTab = (next: Tab) => { setTab(next); router.replace(next === "mine" ? "/surveys" : `/surveys?tab=${next}`, { scroll: false }); };

  const viewer = home?.viewer;
  const canBuild = !!viewer?.canBuild;

  return (
    <div className="cw-page eg-page" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><MessageSquareHeart size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">COMPANY · ENGAGEMENT</p>
          <h1>Surveys &amp; polls</h1>
          <p>Share how work really feels. Anonymous surveys never store who said what, and results stay hidden until enough people answer.</p>
        </div>
        {canBuild && (
          <div className="eg-hero-actions">
            <button className="cw-btn ghost lg" onClick={() => setPollDrawer(true)}><Vote size={17} /> New poll</button>
            <Link className="cw-btn primary lg" href="/surveys/new"><Plus size={17} /> New survey</Link>
          </div>
        )}
      </header>

      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error} <button className="cw-btn ghost" onClick={load}>Retry</button></p>}
      {!home && !error && <div className="cw-list-skeleton"><i /><i /><i /></div>}

      {home && (
        <>
          <section className="cw-stats" aria-label="Summary">
            <article className={home.pending.length ? "attention" : ""}><small>Waiting for you</small><b>{home.pending.length}</b><span>{home.pending.length ? "surveys to answer" : "you're all caught up"}</span></article>
            <article><small>Answered</small><b>{home.completed.length + home.editable.length}</b><span>surveys this year</span></article>
            <article><small>Next deadline</small><b className="text">{home.pending[0]?.closesAt ? closingLabel(home.pending[0].closesAt).replace("Closes ", "") : "—"}</b><span>{home.pending[0]?.title || "nothing due"}</span></article>
            <article><small>Your privacy</small><b className="text">Protected</b><span>min. 3 responses before results</span></article>
          </section>

          {canBuild && (
            <div className="cw-toolbar">
              <div className="cw-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => switchTab("mine")}>For you</button>
                <button role="tab" aria-selected={tab === "manage"} className={tab === "manage" ? "active" : ""} onClick={() => switchTab("manage")}>{viewer!.isHr ? "Manage surveys" : "My team surveys"}</button>
                <button role="tab" aria-selected={tab === "polls"} className={tab === "polls" ? "active" : ""} onClick={() => switchTab("polls")}>Polls</button>
              </div>
            </div>
          )}

          {tab === "mine" || !canBuild ? <ForYou home={home} pollsVersion={pollsVersion} />
            : tab === "manage" ? <ManageSurveys viewer={viewer!} flash={flash} onChanged={load} />
            : <ManagePolls viewer={viewer!} flash={flash} version={pollsVersion} onNew={() => setPollDrawer(true)} />}
        </>
      )}

      {pollDrawer && viewer && (
        <PollDrawer onClose={() => { setPollDrawer(false); if (params.get("new")) router.replace(tab === "mine" ? "/surveys" : `/surveys?tab=${tab}`, { scroll: false }); }}
          onCreated={() => { setPollDrawer(false); setPollsVersion((value) => value + 1); flash("Poll is live — your audience can vote now."); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ---- Employee view ------------------------------------------------------------------------------

function ForYou({ home, pollsVersion }: { home: Home; pollsVersion: number }) {
  const done = [...home.editable, ...home.completed];
  return (
    <div className="eg-foryou">
      <div className="eg-main">
        <h2 className="eg-section-title">Waiting for you {home.pending.length > 0 && <span>{home.pending.length}</span>}</h2>
        {home.pending.length ? (
          <div className="eg-pending">
            {home.pending.map((survey, index) => <PendingCard key={survey.id} survey={survey} featured={index === 0} />)}
          </div>
        ) : (
          <div className="cw-empty eg-empty-small">
            <span><CheckCircle2 size={24} /></span>
            <h2>You’re all caught up</h2>
            <p>New surveys for you will appear here, and we’ll notify you when one opens.</p>
          </div>
        )}

        {home.upcoming.length > 0 && (
          <>
            <h2 className="eg-section-title">Opening soon</h2>
            <ul className="eg-list">{home.upcoming.map((survey) => (
              <li key={survey.id}><span className="eg-list-icon"><CalendarClock size={16} /></span><div><b>{survey.title}</b><small>Opens {dayLabel(survey.opensAt)} · {survey.questionCount} questions</small></div></li>
            ))}</ul>
          </>
        )}

        <h2 className="eg-section-title">Completed</h2>
        {done.length ? (
          <ul className="eg-list">
            {done.map((survey) => (
              <li key={survey.id}>
                <span className="eg-list-icon done"><CheckCircle2 size={16} /></span>
                <div><b>{survey.title}</b><small>Answered {dayLabel(survey.me.respondedOn)} · {survey.anonymous ? "anonymous" : "identified"} · {survey.state === "CLOSED" ? "closed" : closingLabel(survey.closesAt, survey.state).toLowerCase()}</small></div>
                <span className="eg-list-actions">
                  {survey.me.canEdit && <Link className="cw-btn ghost" href={`/surveys/${survey.id}`}><Pencil size={14} /> Edit answers</Link>}
                  {survey.canViewResults && <Link className="cw-btn ghost" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> Results</Link>}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="eg-muted">Surveys you answer will be listed here.</p>}

        {home.missed.length > 0 && (
          <>
            <h2 className="eg-section-title">Closed before you answered</h2>
            <ul className="eg-list muted">{home.missed.map((survey) => (
              <li key={survey.id}><span className="eg-list-icon"><Lock size={15} /></span><div><b>{survey.title}</b><small>Closed {dayLabel(survey.closedAt || survey.closesAt)}</small></div>
                {survey.canViewResults && <span className="eg-list-actions"><Link className="cw-btn ghost" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> Results</Link></span>}
              </li>
            ))}</ul>
          </>
        )}
      </div>
      <aside className="eg-side">
        <PollWidget key={pollsVersion} title="Quick polls" />
        <section className="eg-privacy">
          <h3><EyeOff size={15} /> How anonymity works</h3>
          <ul>
            <li>We record <b>that</b> you answered (so you aren’t reminded), never <b>what</b> you answered.</li>
            <li>Anonymous answers carry no name and only the day they were given.</li>
            <li>Results and team breakdowns stay hidden until at least 3 people respond.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function PendingCard({ survey, featured }: { survey: Survey; featured: boolean }) {
  const urgent = survey.closesAt && new Date(survey.closesAt).getTime() - Date.now() < 3 * 86_400_000;
  return (
    <Link href={`/surveys/${survey.id}`} className={`eg-pending-card${featured ? " featured" : ""}`}>
      <div className="eg-pending-top">
        <span className={`cw-badge tone-${urgent ? "warning" : "info"}`}><i />{closingLabel(survey.closesAt, survey.state)}</span>
        {survey.anonymous ? <span className="eg-tag"><EyeOff size={12} /> Anonymous</span> : <span className="eg-tag"><Users size={12} /> Name shared with {survey.owner.name.split(" ")[0]}</span>}
      </div>
      <h3>{survey.title}</h3>
      {survey.description && <p>{survey.description}</p>}
      <footer>
        <span><ClipboardList size={14} /> {survey.questionCount} questions</span>
        <span><Timer size={14} /> ~{survey.estimatedMinutes} min</span>
        <span className="eg-from">from {survey.owner.name}</span>
        <em>Start <ArrowRight size={15} /></em>
      </footer>
    </Link>
  );
}

// ---- HR / manager: surveys ----------------------------------------------------------------------

function ManageSurveys({ viewer, flash, onChanged }: { viewer: EngagementViewer; flash: (message: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState<Survey[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"" | "LIVE" | "DRAFT" | "CLOSED">("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try { setItems((await engagementApi.list("SURVEY")).items); setError(""); } catch (reason) { setError(errorText(reason, "Unable to load surveys.")); setItems((current) => current || []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = (request: ConfirmRequest) => setConfirm({ ...request, run: async () => {
    setBusy(true);
    try { await request.run(); setConfirm(null); await load(); onChanged(); } catch (reason) { setConfirm(null); setError(errorText(reason, "That didn't work.")); } finally { setBusy(false); }
  } });

  const counts = { LIVE: 0, DRAFT: 0, CLOSED: 0 } as Record<string, number>;
  for (const item of items || []) counts[item.status] += 1;
  const live = (items || []).filter((item) => item.status !== "DRAFT");
  const avgRate = live.length ? Math.round(live.reduce((sum, item) => sum + item.responseRate, 0) / live.length) : 0;
  const shown = (items || []).filter((item) => !filter || item.status === filter);

  return (
    <>
      <section className="cw-stats" aria-label="Survey programme">
        <article className={counts.LIVE ? "attention" : ""}><small>Live now</small><b>{counts.LIVE}</b><span>collecting responses</span></article>
        <article><small>Drafts</small><b>{counts.DRAFT}</b><span>not yet launched</span></article>
        <article><small>Avg. response rate</small><b>{live.length ? `${avgRate}%` : "—"}</b><span>across launched surveys</span></article>
        <article><small>Responses collected</small><b>{live.reduce((sum, item) => sum + item.responded, 0)}</b><span>{viewer.isHr ? "organisation-wide" : `from your team of ${viewer.teamSize}`}</span></article>
      </section>
      <div className="cw-chips" aria-label="Filter by status">
        {(["", "LIVE", "DRAFT", "CLOSED"] as const).map((key) => (
          <button key={key || "all"} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
            {key ? <><i className={`dot tone-${key === "LIVE" ? "success" : "neutral"}`} />{stateLabel[key]}</> : "All"} <b>{key ? counts[key] : items?.length || 0}</b>
          </button>
        ))}
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {items === null ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !shown.length ? (
        <div className="cw-empty">
          <span><ClipboardList size={26} /></span>
          <h2>{filter ? "Nothing here" : "No surveys yet"}</h2>
          <p>{filter ? "Try another status." : viewer.isHr ? "Start with an eNPS pulse or build your own survey." : `Run a quick check-in with your ${viewer.teamSize} direct reports.`}</p>
          {!filter && <Link className="cw-btn primary" href="/surveys/new"><Plus size={16} /> New survey</Link>}
        </div>
      ) : (
        <div className="eg-manage">
          {shown.map((survey) => (
            <article key={survey.id} className="eg-manage-row">
              <div className="eg-manage-title">
                <span className={`cw-badge tone-${stateTone[survey.state]}`}><i />{stateLabel[survey.state]}</span>
                <Link href={survey.status === "DRAFT" ? `/surveys/${survey.id}/edit` : `/surveys/${survey.id}/results`}><b>{survey.title}</b></Link>
                <small>
                  {survey.questionCount} questions · {survey.audience.label} · {survey.anonymous ? <><EyeOff size={11} /> anonymous</> : "identified"}
                  {viewer.isHr && survey.owner.id !== viewer.employeeId ? ` · by ${survey.owner.name}` : ""}
                </small>
              </div>
              <div className="eg-manage-rate">
                {survey.status === "DRAFT" ? <small>Not launched</small> : <><span><b>{survey.responseRate}%</b> {survey.responded}/{survey.invited}</span><RateBar value={survey.responseRate} /></>}
              </div>
              <div className="eg-manage-date"><small>{survey.status === "DRAFT" ? `Edited ${dayLabel(survey.updatedAt)}` : closingLabel(survey.closesAt, survey.state)}</small></div>
              <div className="eg-manage-actions">
                {survey.status === "DRAFT" && <>
                  <Link className="cw-btn ghost" href={`/surveys/${survey.id}/edit`}><Pencil size={14} /> Edit</Link>
                  <button className="cw-btn primary" onClick={() => act({ title: `Launch “${survey.title}”?`, confirm: "Launch survey",
                    body: <p>Questions lock once live. Everyone in <b>{survey.audience.label}</b> gets a notification{survey.anonymous ? " and answers anonymously" : ""}.</p>,
                    run: async () => { await engagementApi.launch(survey.id, survey.version); flash("Survey launched — notifications sent."); } })}><Rocket size={14} /> Launch</button>
                </>}
                {survey.status !== "DRAFT" && <Link className="cw-btn ghost" href={`/surveys/${survey.id}/results`}><BarChart3 size={14} /> Results</Link>}
                {survey.state === "LIVE" && <button className="cw-icon-button" title="Remind non-respondents" aria-label="Remind non-respondents" onClick={() => act({ title: "Send a reminder?", confirm: "Send reminder",
                  body: <p>{survey.invited - survey.responded} people haven’t answered yet. Each gets at most one reminder per 20 hours. {survey.anonymous ? "You won’t see who they are." : ""}</p>,
                  run: async () => { const result = await engagementApi.remind(survey.id); flash(result.reminded ? `Reminded ${result.reminded} ${result.reminded === 1 ? "person" : "people"}.` : result.pending ? "Everyone pending was reminded recently." : "Everyone has responded."); } })}><BellRing size={15} /></button>}
                {survey.status === "LIVE" && <button className="cw-icon-button" title="Close survey" aria-label="Close survey" onClick={() => act({ title: "Close this survey now?", confirm: "Close survey", tone: "danger",
                  body: <p>No more responses will be accepted. This can’t be undone, but you can duplicate it to run again.</p>,
                  run: async () => { await engagementApi.close(survey.id, survey.version); flash("Survey closed."); } })}><Square size={14} /></button>}
                <button className="cw-icon-button" title="Duplicate" aria-label="Duplicate" onClick={async () => {
                  try { const copy = await engagementApi.duplicate(survey.id); router.push(`/surveys/${copy.id}/edit`); } catch (reason) { setError(errorText(reason, "Could not duplicate.")); }
                }}><Copy size={14} /></button>
                {survey.status === "DRAFT" && <button className="cw-icon-button" title="Delete draft" aria-label="Delete draft" onClick={() => act({ title: "Delete this draft?", confirm: "Delete draft", tone: "danger",
                  body: <p>“{survey.title}” and its questions will be removed.</p>, run: async () => { await engagementApi.remove(survey.id, survey.version); flash("Draft deleted."); } })}><Trash2 size={14} /></button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {confirm && <ConfirmDialog request={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
    </>
  );
}

// ---- HR / manager: polls ------------------------------------------------------------------------

function ManagePolls({ viewer, flash, version, onNew }: { viewer: EngagementViewer; flash: (message: string) => void; version: number; onNew: () => void }) {
  const [items, setItems] = useState<Poll[] | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await engagementApi.polls();
      setItems(data.items.filter((poll) => poll.canManage)); setError("");
    } catch (reason) { setError(errorText(reason, "Unable to load polls.")); setItems((current) => current || []); }
  }, []);
  useEffect(() => { load(); }, [load, version]);
  return (
    <div className="eg-foryou">
      <div className="eg-main">
        <h2 className="eg-section-title">{viewer.isHr ? "Polls (last 30 days)" : "Your polls"} <button className="cw-btn ghost" onClick={onNew}><Plus size={14} /> New poll</button></h2>
        {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
        {items === null ? <div className="cw-list-skeleton"><i /><i /></div> : !items.length ? (
          <div className="cw-empty eg-empty-small"><span><Vote size={24} /></span><h2>No polls yet</h2><p>A poll is one question with instant results — great for quick decisions.</p><button className="cw-btn primary" onClick={onNew}><Plus size={15} /> New poll</button></div>
        ) : (
          <div className="eg-poll-grid">
            {items.map((poll) => (
              <article key={poll.id} className="eg-poll-admin">
                <header>
                  <span className={`cw-badge tone-${stateTone[poll.state]}`}><i />{stateLabel[poll.state]}</span>
                  <small>{poll.votes}/{poll.invited} voted · {poll.state === "CLOSED" ? `closed ${dayLabel(poll.closedAt || poll.closesAt)}` : closingLabel(poll.closesAt, poll.state).replace("No close date", "no expiry")}</small>
                </header>
                <h3>{poll.question?.prompt}</h3>
                <ul className="pw-results revealed">
                  {(poll.results || []).map((item) => <li key={item.option}><i style={{ width: `${item.pct}%` }} /><span>{item.option}</span><b>{item.pct}% <small>({item.count})</small></b></li>)}
                </ul>
                {poll.state === "LIVE" && <button className="cw-btn ghost" onClick={() => setConfirm({ title: "Close this poll?", confirm: "Close poll", tone: "danger", body: <p>Voting stops and final results stay visible for 30 days.</p>,
                  run: async () => { setBusy(true); try { await engagementApi.closePoll(poll.id, poll.version); flash("Poll closed."); setConfirm(null); await load(); } catch (reason) { setConfirm(null); setError(errorText(reason, "Could not close the poll.")); } finally { setBusy(false); } } })}><Square size={13} /> Close poll</button>}
              </article>
            ))}
          </div>
        )}
      </div>
      <aside className="eg-side"><PollWidget key={version} title="Preview as employee" showCreate={false} /></aside>
      {confirm && <ConfirmDialog request={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
    </div>
  );
}

function PollDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [options, setOptions] = useState<BuilderOptions | null>(null);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [closesAt, setClosesAt] = useState(() => { const date = new Date(Date.now() + 7 * 86_400_000); date.setHours(18, 0, 0, 0); return toInput(date); });
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL");
  const [audienceValues, setAudienceValues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    engagementApi.options().then((data) => { setOptions(data); if (!data.viewer.isHr) setAudienceType("TEAM"); }).catch((reason) => setError(errorText(reason, "Unable to load audience options.")));
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await engagementApi.createPoll({ question: question.trim(), options: choices.map((item) => item.trim()).filter(Boolean), multiple, anonymous,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null, audienceType, audienceValues: audienceType === "DEPARTMENTS" || audienceType === "LOCATIONS" ? audienceValues : [] });
      onCreated();
    } catch (reason) { setError(errorText(reason, "Could not create the poll.")); } finally { setBusy(false); }
  };
  const groups = audienceType === "DEPARTMENTS" ? options?.departments : audienceType === "LOCATIONS" ? options?.locations : null;
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer" role="dialog" aria-modal="true" aria-labelledby="poll-drawer-title" ref={ref} tabIndex={-1}>
        <div className="cw-drawer-head" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
          <p className="cw-eyebrow">QUICK POLL</p>
          <h2 id="poll-drawer-title">Ask one question</h2>
          <p className="cw-head-note">Goes live straight away. People see results as soon as they vote.</p>
        </div>
        <form className="cw-drawer-body" onSubmit={submit}>
          <div className="cw-fields">
            <label className="wide"><span>Question <em>*</em></span><input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder="e.g. Which day works best for the offsite?" required minLength={3} autoFocus /></label>
            <div className="wide eg-option-editor">
              <span className="eg-field-label">Options <small>(2–6)</small></span>
              {choices.map((choice, index) => (
                <div key={index} className="eg-option-row">
                  <i>{String.fromCharCode(65 + index)}</i>
                  <input value={choice} maxLength={120} placeholder={`Option ${index + 1}`} aria-label={`Option ${index + 1}`} onChange={(event) => setChoices(choices.map((item, i) => (i === index ? event.target.value : item)))} />
                  <button type="button" className="cw-icon-button" aria-label={`Remove option ${index + 1}`} disabled={choices.length <= 2} onClick={() => setChoices(choices.filter((_, i) => i !== index))}><X size={14} /></button>
                </div>
              ))}
              {choices.length < 6 && <button type="button" className="cw-btn ghost" onClick={() => setChoices([...choices, ""])}><Plus size={14} /> Add option</button>}
            </div>
            <label><span>Voting ends <small>(optional)</small></span><input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label>
            <label><span>Audience</span>
              <select value={audienceType} onChange={(event) => { setAudienceType(event.target.value as AudienceType); setAudienceValues([]); }} disabled={!options}>
                {(options?.audienceTypes || ["ALL"]).map((type) => <option key={type} value={type}>{audienceName(type, options)}</option>)}
              </select>
            </label>
            {groups && (
              <div className="wide eg-audience-chips" role="group" aria-label="Choose groups">
                {groups.map((group) => { const on = audienceValues.includes(group.name); return (
                  <button type="button" key={group.name} className={on ? "on" : ""} aria-pressed={on} onClick={() => setAudienceValues(on ? audienceValues.filter((item) => item !== group.name) : [...audienceValues, group.name])}>{group.name} <b>{group.count}</b></button>
                ); })}
              </div>
            )}
            <div className="wide eg-toggles">
              <Toggle checked={multiple} onChange={setMultiple} label="Allow multiple answers" hint="Voters can pick more than one option." />
              <Toggle checked={anonymous} onChange={setAnonymous} label="Anonymous" hint="Votes are counted without storing who picked what." />
            </div>
          </div>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="cw-create-foot">
            <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
            <button className="cw-btn primary" disabled={busy || question.trim().length < 3 || choices.filter((item) => item.trim()).length < 2}><Play size={14} /> {busy ? "Publishing…" : "Publish poll"}</button>
          </div>
        </form>
      </aside>
    </>
  );
}

export function audienceName(type: AudienceType, options: BuilderOptions | null) {
  if (type === "ALL") return `Everyone${options?.total ? ` (${options.total})` : ""}`;
  if (type === "TEAM") return `My direct reports${options?.teamSize ? ` (${options.teamSize})` : ""}`;
  return type === "DEPARTMENTS" ? "Selected departments" : "Selected locations";
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`eg-toggle${disabled ? " disabled" : ""}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

function toInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
