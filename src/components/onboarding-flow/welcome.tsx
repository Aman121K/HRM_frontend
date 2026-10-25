"use client";
import { AlertTriangle, CheckCircle2, Coffee, PartyPopper, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { shortDate } from "@/lib/cases";
import { countdown, errorText, onboardingApi, PHASES, type JoinerDetail, type Task } from "./api";
import { DocumentsPanel } from "./documents-panel";
import { Avatar, ProgressBar, TaskRow } from "./shared";

/** The new employee's own view: welcome note, the people to know, their tasks and what others are doing for them. */
export function WelcomeHome() {
  const [detail, setDetail] = useState<JoinerDetail | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); }, []);
  const load = useCallback(async () => {
    try {
      const data = await onboardingApi.welcome();
      if (!data.joiner) { setEmpty(true); setDetail(null); } else { setDetail(data as JoinerDetail); setEmpty(false); }
      setError("");
    } catch (reason) { setError(errorText(reason, "Unable to load your onboarding plan.")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="cw-page"><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p><button className="cw-btn ghost" onClick={load}>Try again</button></div>;
  if (empty) return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0f8177" }}>
      <div className="cw-empty">
        <span><Coffee size={26} /></span>
        <h2>No onboarding plan for you</h2>
        <p>This page is for new joiners. If you are helping someone settle in, your tasks are under onboarding.</p>
        <Link className="cw-btn primary" href="/onboarding?tab=tasks">My onboarding tasks</Link>
      </div>
    </div>
  );
  if (!detail) return <div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;

  const { joiner, tasks } = detail;
  const first = joiner.fullName.split(" ")[0];
  const mine = tasks.filter((task) => task.mine && task.status === "PENDING");
  const others = tasks.filter((task) => !task.mine);
  const replace = (task: Task) => { setDetail((current) => current && { ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }); window.setTimeout(load, 300); };
  return (
    <div className="cw-page ob-page ob-welcome" style={{ ["--accent" as string]: "#0f8177" }}>
      <header className="ob-welcome-hero">
        <PartyPopper size={28} aria-hidden />
        <p className="cw-eyebrow">{countdown(joiner.daysToJoin, joiner.status).toUpperCase()} · {joiner.employee?.number}</p>
        <h1>Welcome to the team, {first}!</h1>
        {detail.welcomeMessage && <blockquote>{detail.welcomeMessage}</blockquote>}
        {joiner.progress && <div className="ob-welcome-progress"><ProgressBar percent={joiner.progress.percent} label="Your onboarding progress" /><span>{joiner.progress.percent}% of your onboarding plan is done</span></div>}
      </header>

      <section className="ob-people" aria-label="People to know">
        {joiner.manager && <article><Avatar name={joiner.manager.name} /><p><small>Your manager</small><b>{joiner.manager.name}</b><span>{joiner.manager.designation}</span></p></article>}
        {joiner.buddy && <article><Avatar name={joiner.buddy.name} muted /><p><small>Your buddy</small><b>{joiner.buddy.name}</b><span>Ask them anything — no question is too small</span></p></article>}
        <article><span className="cw-avatar muted"><Users size={16} /></span><p><small>Your role</small><b>{joiner.designation}</b><span>{joiner.department}{joiner.location ? ` · ${joiner.location}` : ""}</span></p></article>
      </section>

      <div className="ob-detail-grid">
        <section className="ob-panel">
          <header><h2>Your to-dos</h2><span className="ob-docs-score">{mine.length} open</span></header>
          {mine.length ? <ul className="ob-task-list">{mine.map((task) => <TaskRow key={task.id} task={task} onChanged={replace} flash={flash} />)}</ul>
            : <p className="pulse-empty"><CheckCircle2 size={15} /> You are all caught up.</p>}
          <p className="cw-section-label ob-gap">What the team is doing for you</p>
          <ol className="ob-welcome-plan">
            {PHASES.map((phase) => {
              const list = others.filter((task) => task.phase === phase.key);
              if (!list.length) return null;
              return (
                <li key={phase.key}><b>{phase.label}</b>
                  <ul>{list.map((task) => (
                    <li key={task.id} className={task.status === "PENDING" ? "" : "done"}>
                      {task.status === "PENDING" ? <span className="ob-dot" /> : <CheckCircle2 size={13} />} {task.title}
                      <small>{task.owner?.name || task.ownerTypeLabel} · {task.status === "PENDING" ? shortDate(task.dueDate) : "done"}</small>
                    </li>
                  ))}</ul>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="ob-side">
          {detail.documents && <DocumentsPanel joinerId={joiner.id} documents={detail.documents} fileAccess={detail.fileAccess} onChanged={load} onDetail={() => load()} flash={flash}
            maskedIds={{ pan: joiner.panMasked, aadhaar: joiner.aadhaarMasked }} />}
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
