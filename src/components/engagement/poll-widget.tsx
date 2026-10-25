"use client";
import Link from "next/link";
import { AlertTriangle, BarChart3, Check, ChevronLeft, ChevronRight, EyeOff, Plus, RotateCw, Vote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { closingLabel, engagementApi, errorText, type EngagementViewer, type Poll } from "./engagement-api";

const voteKey = (id: string) => `hrm.poll-vote.${id}`;
function rememberVote(id: string, choices: string[]) { try { window.localStorage.setItem(voteKey(id), JSON.stringify(choices)); } catch { /* storage unavailable */ } }
function recallVote(id: string): string[] { try { return JSON.parse(window.localStorage.getItem(voteKey(id)) || "[]"); } catch { return []; } }

/**
 * Quick polls card for the home dashboard (designed for a ~360px column) and the /surveys page.
 * Self-contained: loads polls, lets the viewer vote, then shows instant results.
 */
export function PollWidget({ title = "Quick poll", className = "", showCreate = true, onChanged }: {
  title?: string; className?: string; showCreate?: boolean; onChanged?: () => void;
}) {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [viewer, setViewer] = useState<EngagementViewer | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await engagementApi.polls();
      // Unanswered live polls first, then answered live polls, then recently closed ones.
      const rank = (poll: Poll) => (poll.state === "LIVE" && poll.me.invited && !poll.voted ? 0 : poll.state === "LIVE" ? 1 : 2);
      setPolls([...data.items].sort((a, b) => rank(a) - rank(b)));
      setViewer(data.viewer); setError("");
    } catch (reason) { setError(errorText(reason, "Polls are unavailable right now.")); setPolls((current) => current || []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (next: Poll) => { setPolls((current) => (current || []).map((poll) => (poll.id === next.id ? next : poll))); onChanged?.(); };
  const count = polls?.length || 0;
  const poll = polls?.[Math.min(index, Math.max(0, count - 1))];
  const pendingCount = (polls || []).filter((item) => item.state === "LIVE" && item.me.invited && !item.voted).length;

  return (
    <section className={`pw-card ${className}`} aria-label={title}>
      <header className="pw-head">
        <span className="pw-icon" aria-hidden="true"><BarChart3 size={16} /></span>
        <div><p>ENGAGEMENT</p><h2>{title}</h2></div>
        {pendingCount > 0 && <span className="pw-pill">{pendingCount} to answer</span>}
      </header>

      {polls === null ? (
        <div className="pw-skeleton" aria-label="Loading polls"><i /><i /><i /><i /></div>
      ) : error && !count ? (
        <div className="pw-empty">
          <AlertTriangle size={20} /><b>Couldn’t load polls</b><span>{error}</span>
          <button type="button" className="pw-link" onClick={() => { setPolls(null); load(); }}><RotateCw size={13} /> Try again</button>
        </div>
      ) : !poll ? (
        <div className="pw-empty">
          <Vote size={22} /><b>No polls right now</b><span>When someone asks the team a quick question, it shows up here.</span>
          {showCreate && viewer?.canBuild && <Link className="pw-link" href="/surveys?tab=polls&new=poll"><Plus size={13} /> Ask a question</Link>}
        </div>
      ) : (
        <PollBody key={poll.id} poll={poll} onVoted={replace} />
      )}

      {count > 1 && (
        <footer className="pw-pager">
          <button type="button" aria-label="Previous poll" onClick={() => setIndex((index - 1 + count) % count)}><ChevronLeft size={15} /></button>
          <span aria-live="polite">{Math.min(index, count - 1) + 1} of {count}</span>
          <div className="pw-dots" aria-hidden="true">{polls!.map((item, dot) => <i key={item.id} className={dot === Math.min(index, count - 1) ? "on" : ""} />)}</div>
          <button type="button" aria-label="Next poll" onClick={() => setIndex((index + 1) % count)}><ChevronRight size={15} /></button>
        </footer>
      )}
    </section>
  );
}

function PollBody({ poll, onVoted }: { poll: Poll; onVoted: (poll: Poll) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setMine(recallVote(poll.id)); const frame = requestAnimationFrame(() => setRevealed(true)); return () => cancelAnimationFrame(frame); }, [poll.id]);
  const question = poll.question;
  const canVote = poll.state === "LIVE" && poll.me.invited && !poll.voted;
  const leader = useMemo(() => Math.max(0, ...(poll.results || []).map((item) => item.count)), [poll.results]);
  if (!question) return null;

  const toggle = (option: string) => setSelected((current) => question.multiple ? (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]) : [option]);
  const submit = async () => {
    if (!selected.length) return;
    setBusy(true); setError("");
    try {
      const next = await engagementApi.vote(poll.id, selected);
      rememberVote(poll.id, selected); setMine(selected); setRevealed(false);
      onVoted(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    } catch (reason) { setError(errorText(reason, "Your vote didn't go through.")); } finally { setBusy(false); }
  };

  return (
    <div className="pw-body">
      <h3>{question.prompt}</h3>
      <p className="pw-meta">
        <span>{poll.state === "CLOSED" ? "Final results" : closingLabel(poll.closesAt, poll.state).replace("No close date", "Open")}</span>
        <span>·</span><span>{poll.votes} vote{poll.votes === 1 ? "" : "s"}</span>
        {poll.anonymous && <><span>·</span><span className="pw-anon"><EyeOff size={11} /> Anonymous</span></>}
      </p>

      {canVote ? (
        <>
          <div className="pw-options" role={question.multiple ? "group" : "radiogroup"} aria-label={question.prompt}>
            {question.options.map((option) => {
              const on = selected.includes(option);
              return (
                <button key={option} type="button" role={question.multiple ? "checkbox" : "radio"} aria-checked={on} className={on ? "on" : ""} onClick={() => toggle(option)}>
                  <i className={question.multiple ? "box" : "dot"}>{on && <Check size={11} strokeWidth={3} />}</i>{option}
                </button>
              );
            })}
          </div>
          {question.multiple && <small className="pw-hint">Pick all that apply.</small>}
          {error && <p className="pw-error" role="alert">{error}</p>}
          <button type="button" className="pw-vote" disabled={!selected.length || busy} onClick={submit}>{busy ? "Sending…" : "Vote"}</button>
        </>
      ) : poll.results ? (
        <ul className={`pw-results${revealed ? " revealed" : ""}`} aria-label="Results">
          {poll.results.map((item) => (
            <li key={item.option} className={`${item.count && item.count === leader ? "lead" : ""} ${mine.includes(item.option) ? "mine" : ""}`}>
              <i style={{ width: revealed ? `${item.pct}%` : 0 }} aria-hidden="true" />
              <span>{item.option}{mine.includes(item.option) && <em> <Check size={11} strokeWidth={3} /> your vote</em>}</span>
              <b>{item.pct}%</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pw-hint">Results appear once you vote.</p>
      )}
      {poll.voted && poll.state === "LIVE" && <p className="pw-thanks"><Check size={13} /> Thanks for voting — results update live.</p>}
    </div>
  );
}
