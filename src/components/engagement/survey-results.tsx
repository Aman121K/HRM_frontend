"use client";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BellRing, Download, EyeOff, Lock, MessageSquareQuote, Pencil, Search, ShieldCheck, Square, Table2, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChoiceBars, ENPS_COLORS, EnpsColumns, EnpsGauge, LIKERT, LikertBar, ResponseRing, TrendChart } from "./charts";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import {
  ENGAGEMENT_ACCENT, closingLabel, dayLabel, engagementApi, errorText, stateLabel, stateTone, typeMeta, type OptionResult, type ResultQuestion, type Results,
} from "./engagement-api";

export function SurveyResults({ surveyId }: { surveyId: string }) {
  const [data, setData] = useState<Results | null>(null);
  const [breakdown, setBreakdown] = useState<"department" | "location">("department");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await engagementApi.results(surveyId, breakdown)); setError(""); } catch (reason) { setError(errorText(reason, "Unable to load results.")); }
  }, [surveyId, breakdown]);
  useEffect(() => { load(); }, [load]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3400); };

  const page = (children: React.ReactNode) => (
    <div className="cw-page eg-page eg-results-page" style={{ ["--accent" as string]: ENGAGEMENT_ACCENT }}>
      <Link className="eg-back" href={data?.survey.canManage ? "/surveys?tab=manage" : "/surveys"}><ArrowLeft size={15} /> Surveys</Link>
      {children}
    </div>
  );
  if (error) return page(<div className="cw-empty"><span><Lock size={24} /></span><h2>Results unavailable</h2><p>{error}</p><Link className="cw-btn primary" href="/surveys">Back to surveys</Link></div>);
  if (!data) return page(<><div className="cw-hero-skeleton" aria-label="Loading" /><div className="cw-list-skeleton"><i /><i /><i /></div></>);

  const { survey } = data;
  const act = (request: ConfirmRequest) => setConfirm({ ...request, run: async () => {
    setBusy(true);
    try { await request.run(); setConfirm(null); await load(); } catch (reason) { setConfirm(null); setActionError(errorText(reason, "That didn't work.")); } finally { setBusy(false); }
  } });
  const enpsQuestion = data.questions.find((question) => question.type === "ENPS" && !question.locked);

  return page(
    <>
      <header className="cw-hero eg-results-hero">
        <ResponseRing value={data.responded} total={data.invited} />
        <div>
          <p className="cw-eyebrow">RESULTS · {survey.anonymous ? "ANONYMOUS" : "IDENTIFIED"} · {survey.audience.label.toUpperCase()}</p>
          <h1>{survey.title}</h1>
          <p>
            <span className={`cw-badge tone-${stateTone[survey.state]}`}><i />{stateLabel[survey.state]}</span>{" "}
            {data.responded} of {data.invited} responded · {survey.state === "CLOSED" ? `closed ${dayLabel(survey.closedAt || survey.closesAt)}` : closingLabel(survey.closesAt, survey.state).toLowerCase()}
          </p>
        </div>
        {survey.canManage && (
          <div className="eg-hero-actions">
            {survey.state === "LIVE" && <button className="cw-btn ghost" onClick={() => act({ title: "Remind people who haven’t answered?", confirm: "Send reminder",
              body: <p>{data.invited - data.responded} {data.invited - data.responded === 1 ? "person hasn’t" : "people haven’t"} responded. Each person gets at most one reminder every 20 hours{survey.anonymous ? ", and you won’t see who they are" : ""}.</p>,
              run: async () => { const result = await engagementApi.remind(survey.id); flash(result.reminded ? `Reminder sent to ${result.reminded} ${result.reminded === 1 ? "person" : "people"}.` : result.pending ? "Everyone pending was reminded in the last 20 hours." : "Everyone has responded."); } })}><BellRing size={15} /> Remind</button>}
            <button className="cw-btn ghost" disabled={data.locked} title={data.locked ? `Export unlocks at ${data.threshold} responses` : undefined}
              onClick={async () => { try { await engagementApi.exportCsv(survey.id, `${survey.title}.csv`); } catch (reason) { setActionError(errorText(reason, "Export failed.")); } }}><Download size={15} /> CSV</button>
            {survey.status !== "CLOSED" && <Link className="cw-btn ghost" href={`/surveys/${survey.id}/edit`}><Pencil size={15} /> Edit</Link>}
            {survey.status === "LIVE" && <button className="cw-btn danger" onClick={() => act({ title: "Close this survey now?", confirm: "Close survey", tone: "danger",
              body: <p>No more responses will be accepted.</p>, run: async () => { await engagementApi.close(survey.id, survey.version); flash("Survey closed."); } })}><Square size={14} /> Close</button>}
          </div>
        )}
      </header>
      {actionError && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {actionError} <button className="cw-icon-button" aria-label="Dismiss" onClick={() => setActionError("")}><X size={13} /></button></p>}
      {!survey.canManage && <p className="cw-alert warn"><ShieldCheck size={15} /> Shared summary — individual answers and names are never shown here.</p>}

      {data.locked ? (
        <section className="eg-locked">
          <span><EyeOff size={28} /></span>
          <h2>Results unlock at {data.threshold} responses</h2>
          <p>To protect anonymity nothing is shown until at least {data.threshold} people respond. {data.needed} more {data.needed === 1 ? "response is" : "responses are"} needed.</p>
          <div className="eg-locked-meter" aria-hidden="true">{Array.from({ length: data.threshold }, (_, i) => <i key={i} className={i < data.responses ? "on" : ""} />)}</div>
          <small>{data.responded} of {data.invited} invited have responded so far.</small>
        </section>
      ) : (
        <>
          <section className="cw-stats" aria-label="Headline">
            <article><small>Response rate</small><b>{data.responseRate}%</b><span>{data.responded} of {data.invited}</span></article>
            <article className={data.headline?.enps !== null && data.headline?.enps !== undefined ? "attention" : ""}><small>eNPS</small><b>{fmtScore(data.headline?.enps)}</b><span>{enpsQuestion ? `${enpsQuestion.promoters} promoters · ${enpsQuestion.detractors} detractors` : "no eNPS question"}</span></article>
            <article><small>Favourable</small><b>{data.headline?.favorable !== null && data.headline?.favorable !== undefined ? `${data.headline.favorable}%` : "—"}</b><span>rated 4–5 across rating questions</span></article>
            <article><small>Average rating</small><b>{data.headline?.average ?? "—"}<small className="eg-of"> / 5</small></b><span>mean of rating questions</span></article>
          </section>

          <div className="eg-results-grid">
            {enpsQuestion && (
              <section className="eg-card eg-enps-card">
                <h2>Employee Net Promoter Score</h2>
                <p className="eg-muted">{enpsQuestion.prompt}</p>
                <div className="eg-enps-layout">
                  <EnpsGauge score={enpsQuestion.score ?? null} promoters={enpsQuestion.promoters || 0} passives={enpsQuestion.passives || 0} detractors={enpsQuestion.detractors || 0} />
                  <ul className="eg-enps-split">
                    <li><i style={{ background: ENPS_COLORS.promoter }} /><span>Promoters <small>9–10</small></span><b>{pct(enpsQuestion.promoters, enpsQuestion.answered)}%</b></li>
                    <li><i style={{ background: ENPS_COLORS.passive }} /><span>Passives <small>7–8</small></span><b>{pct(enpsQuestion.passives, enpsQuestion.answered)}%</b></li>
                    <li><i style={{ background: ENPS_COLORS.detractor }} /><span>Detractors <small>0–6</small></span><b>{pct(enpsQuestion.detractors, enpsQuestion.answered)}%</b></li>
                    <li className="eg-enps-formula">eNPS = % promoters − % detractors</li>
                  </ul>
                </div>
              </section>
            )}
            <section className="eg-card">
              <h2>Participation</h2>
              <p className="eg-muted">Responses by day{survey.anonymous ? " (anonymous responses are recorded by day only)" : ""}.</p>
              <TrendChart points={data.trend} invited={data.invited} />
            </section>
          </div>

          {data.breakdown && data.breakdown.questions.length > 0 && (
            <Breakdown data={data} by={breakdown} onBy={setBreakdown} />
          )}

          <h2 className="eg-section-title">Question by question</h2>
          <div className="eg-question-results">
            {data.questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} anonymous={survey.anonymous} threshold={data.threshold} />)}
          </div>
        </>
      )}
      {confirm && <ConfirmDialog request={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>,
  );
}

const pct = (value = 0, total = 0) => (total ? Math.round((value / total) * 100) : 0);
const fmtScore = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}`);

function QuestionCard({ question, index, anonymous, threshold }: { question: ResultQuestion; index: number; anonymous: boolean; threshold: number }) {
  const meta = typeMeta(question.type);
  const Icon = meta.icon;
  const [table, setTable] = useState(false);
  const isText = question.type === "SHORT_TEXT" || question.type === "LONG_TEXT";
  return (
    <article className={`eg-card eg-qr${isText ? " text" : ""}`}>
      <header>
        <span className="eg-q-num">{index + 1}</span>
        <div><h3>{question.prompt}</h3><small><Icon size={12} /> {meta.label} · {question.answered ?? 0} answered{!question.required ? " · optional" : ""}</small></div>
        {!isText && !question.locked && <button className="cw-icon-button" aria-pressed={table} aria-label={table ? "Show chart" : "Show table"} title={table ? "Show chart" : "Show table"} onClick={() => setTable(!table)}><Table2 size={14} /></button>}
      </header>
      {question.locked ? (
        <p className="eg-qr-locked"><Lock size={14} /> Fewer than {threshold} answers — hidden to protect anonymity.</p>
      ) : table ? <DataTable question={question} /> : question.type === "RATING" ? (
        <>
          <div className="eg-qr-kpis"><span><b>{question.average ?? "—"}</b> average</span><span><b>{question.favorable ?? 0}%</b> favourable</span><span><b>{question.unfavorable ?? 0}%</b> unfavourable</span></div>
          <LikertBar distribution={question.distribution || []} labels={question.scaleLabels} />
        </>
      ) : question.type === "ENPS" ? (
        <>
          <div className="eg-qr-kpis"><span><b>{fmtScore(question.score)}</b> eNPS</span><span><b>{question.average ?? "—"}</b> average score</span></div>
          <EnpsColumns distribution={question.distribution || []} />
          <ul className="eg-legend" aria-hidden="true"><li><i style={{ background: ENPS_COLORS.detractor }} />Detractors 0–6</li><li><i style={{ background: "#bfb8a8" }} />Passives 7–8</li><li><i style={{ background: ENPS_COLORS.promoter }} />Promoters 9–10</li></ul>
        </>
      ) : question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE" ? (
        <>
          {question.type === "MULTI_CHOICE" && <p className="eg-muted eg-note">Multiple answers allowed — percentages are of people who answered.</p>}
          <ChoiceBars options={question.options as OptionResult[]} total={question.answered || 0} />
        </>
      ) : <TextAnswers question={question} anonymous={anonymous} />}
    </article>
  );
}

function DataTable({ question }: { question: ResultQuestion }) {
  const rows = question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE"
    ? (question.options as OptionResult[]).map((item) => ({ label: item.option, count: item.count, pct: item.pct }))
    : (question.distribution || []).map((item, index) => ({ label: question.type === "RATING" ? `${item.value} · ${question.scaleLabels[index] || ""}` : String(item.value), count: item.count, pct: item.pct }));
  return (
    <table className="eg-data-table">
      <thead><tr><th scope="col">Answer</th><th scope="col">Count</th><th scope="col">Share</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.pct}%</td></tr>)}</tbody>
    </table>
  );
}

function TextAnswers({ question, anonymous }: { question: ResultQuestion; anonymous: boolean }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const texts = useMemo(() => (question.texts || []).filter((item) => !query.trim() || item.text.toLowerCase().includes(query.trim().toLowerCase())), [question.texts, query]);
  if (!question.texts?.length) return <p className="eg-muted">No written answers yet.</p>;
  const shown = all ? texts : texts.slice(0, 6);
  return (
    <div className="eg-texts">
      {(question.texts.length > 4) && <label className="cw-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search answers" aria-label="Search answers" /></label>}
      <ul>
        {shown.map((item, index) => (
          <li key={index}>
            <MessageSquareQuote size={15} aria-hidden="true" />
            <p>{item.text}</p>
            <small>{item.author ? `${item.author.name}${item.author.department ? ` · ${item.author.department}` : ""}` : anonymous ? "Anonymous" : "Respondent"}</small>
          </li>
        ))}
      </ul>
      {!texts.length && <p className="eg-muted">No answers match “{query}”.</p>}
      {texts.length > 6 && <button className="cw-btn ghost" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${texts.length}`}</button>}
      {anonymous && <p className="eg-note eg-muted"><EyeOff size={12} /> Shown in a shuffled order, without names or times.</p>}
    </div>
  );
}

function Breakdown({ data, by, onBy }: { data: Results; by: "department" | "location"; onBy: (value: "department" | "location") => void }) {
  const breakdown = data.breakdown!;
  // Heat colour for a cell: diverging around neutral (3.0 average / 0 eNPS).
  const heat = (question: { type: string }, cell?: { score?: number | null; average?: number | null }) => {
    if (!cell) return { background: "transparent" };
    const value = question.type === "ENPS" ? cell.score : cell.average;
    if (value === null || value === undefined) return { background: "transparent" };
    const t = question.type === "ENPS" ? value / 100 : (value - 3) / 2; // −1…1
    const bucket = t <= -0.5 ? 0 : t < -0.15 ? 1 : t <= 0.15 ? 2 : t < 0.5 ? 3 : 4;
    return { background: LIKERT[bucket], color: bucket === 0 || bucket === 4 ? "white" : "var(--ink)" };
  };
  return (
    <section className="eg-card eg-breakdown">
      <header>
        <div><h2>Breakdown by {by}</h2><p className="eg-muted">Groups with fewer than {breakdown.threshold} responses are pooled or hidden so nobody can be singled out.</p></div>
        <div className="cw-tabs" role="tablist" aria-label="Break down by">
          <button role="tab" aria-selected={by === "department"} className={by === "department" ? "active" : ""} onClick={() => onBy("department")}>Department</button>
          <button role="tab" aria-selected={by === "location"} className={by === "location" ? "active" : ""} onClick={() => onBy("location")}>Location</button>
        </div>
      </header>
      <div className="eg-heat-wrap">
        <table className="eg-heat">
          <thead>
            <tr>
              <th scope="col">Group</th><th scope="col">Responses</th>
              {breakdown.questions.map((question) => <th key={question.id} scope="col" title={question.prompt}>Q{data.questions.findIndex((item) => item.id === question.id) + 1}<small>{question.type === "ENPS" ? "eNPS" : "avg"}</small><span className="sr-only">{question.prompt}</span></th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="overall">
              <th scope="row">All respondents</th><td>{data.responses}</td>
              {breakdown.questions.map((question) => {
                const result = data.questions.find((item) => item.id === question.id);
                const cell = question.type === "ENPS" ? { score: result?.score } : { average: result?.average };
                return <td key={question.id} style={heat(question, cell)}>{question.type === "ENPS" ? fmtScore(result?.score) : result?.average ?? "—"}</td>;
              })}
            </tr>
            {breakdown.segments.map((segment) => (
              <tr key={segment.name} className={segment.suppressed ? "suppressed" : ""}>
                <th scope="row">{segment.name}{segment.members.length > 1 && <small>{segment.members.join(", ")}</small>}</th>
                <td>{segment.responses}{segment.responseRate !== null && <small> · {segment.responseRate}%</small>}</td>
                {segment.suppressed ? <td colSpan={breakdown.questions.length} className="eg-hidden-cell"><Lock size={12} /> Fewer than {breakdown.threshold} responses</td>
                  : breakdown.questions.map((question) => {
                    const cell = segment.scores[question.id];
                    return <td key={question.id} style={heat(question, cell)} title={`${segment.name} · ${question.prompt}`}>{question.type === "ENPS" ? fmtScore(cell?.score) : cell?.average ?? "—"}</td>;
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="eg-legend" aria-label="Colour key">
        {["Much below neutral", "Below", "Neutral", "Above", "Much above neutral"].map((label, index) => <li key={label}><i style={{ background: LIKERT[index] }} />{label}</li>)}
        <li><Users size={12} /> Rating cells show the average (1–5); eNPS cells show the score (−100 to +100).</li>
      </ul>
    </section>
  );
}
