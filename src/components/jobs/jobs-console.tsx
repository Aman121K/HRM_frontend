"use client";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock3, Cpu, History, Inbox, Loader2, Lock, Mail, Play, RefreshCw, RotateCcw, Server, TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ApiRequestError } from "@/lib/http-client";
import { loadDefinitions } from "@/lib/cases";
import {
  duration, jobLabel, jobsApi, relative, summarise, when,
  type FailedJob, type JobRun, type OutboxItem, type OutboxStatus, type Overview, type Schedule,
} from "./jobs-api";

type Tab = "schedules" | "failed" | "outbox" | "runs";
const TABS: { key: Tab; label: string }[] = [
  { key: "schedules", label: "Schedules" }, { key: "failed", label: "Failed jobs" }, { key: "outbox", label: "Email outbox" }, { key: "runs", label: "Run history" },
];
const REFRESH_MS = 15_000;
const statusTone: Record<string, string> = { SUCCEEDED: "success", FAILED: "danger", SKIPPED: "neutral", SENT: "success", PENDING: "info", PROCESSING: "warning" };
const statusLabel: Record<string, string> = { SUCCEEDED: "Succeeded", FAILED: "Failed", SKIPPED: "Skipped", SENT: "Sent", PENDING: "Queued", PROCESSING: "Sending" };

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`cw-badge tone-${tone}`}><i />{children}</span>;
}

/** HR/Owner console for the background worker: health, schedules, dead letters, email delivery and run history. */
export function JobsConsole() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState<FailedJob[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("schedules");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [revision, setRevision] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    loadDefinitions().then(({ viewer }) => setAllowed(viewer.isHr || viewer.roles.includes("OWNER") || viewer.roles.includes("HR_ADMIN"))).catch(() => setAllowed(true));
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [nextOverview, nextFailed] = await Promise.all([jobsApi.overview(), jobsApi.failed().catch(() => ({ items: [] as FailedJob[] }))]);
      setOverview(nextOverview); setFailed(nextFailed.items); setError("");
      setRevision((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 403) setAllowed(false);
      else setError((reason as Error).message || "Could not load the jobs console.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [allowed, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const onTabKey = (event: KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next = (index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[next].key); tabRefs.current[next]?.focus();
  };

  if (allowed === false)
    return (
      <div className="cw-page jb-page" style={{ ["--accent" as string]: "#3d5a80" }}>
        <div className="cw-empty"><span><Lock size={24} /></span><h2>HR admins only</h2><p>The jobs console shows platform automation and email delivery. Ask an HR admin or the account owner if you need something re-sent.</p></div>
      </div>
    );
  if (allowed === null || (!overview && !error))
    return <div className="cw-page jb-page"><div className="cw-hero-skeleton" aria-label="Loading jobs console" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /><i /></div></div>;

  const workers = overview?.workers || [];
  const queue = overview?.queue || {};
  const redisDown = overview && overview.redis.status !== "connected";
  const failedCount = failed?.length || 0;
  const mail = overview?.mail;

  return (
    <div className="cw-page jb-page" style={{ ["--accent" as string]: "#3d5a80" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Cpu size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · BACKGROUND JOBS</p>
          <h1>Jobs &amp; automations</h1>
          <p>Reminders, digests, email delivery and housekeeping run in a separate worker. See what&apos;s scheduled, what failed, and run any automation for your organization on demand.</p>
        </div>
        <button className="cw-btn ghost lg" onClick={() => void load()} disabled={refreshing} aria-label="Refresh">
          {refreshing ? <Loader2 size={17} className="jb-spin" /> : <RefreshCw size={17} />} Refresh
        </button>
      </header>

      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error} <button className="jb-link" onClick={() => void load()}>Try again</button></p>}
      {overview && overview.redis.status === "not_configured" && <p className="cw-alert warn" role="status"><TriangleAlert size={15} /> REDIS_URL is not configured, so jobs are not queued. Set it and start the worker to enable automations.</p>}
      {overview && overview.redis.status === "unavailable" && <p className="cw-alert" role="alert"><TriangleAlert size={15} /> Redis is unreachable: {overview.redis.error}. Queued work resumes when it is back.</p>}
      {overview && !redisDown && workers.length === 0 && <p className="cw-alert warn" role="status"><Server size={15} /> No worker is online. Schedules and &quot;Run now&quot; requests wait in the queue until one starts (<code>npm run jobs:start</code>).</p>}

      {overview && (
        <section className="cw-stats jb-health" aria-label="Job system health">
          <article className={workers.length ? "" : "attention"}>
            <small>Workers online</small>
            <b>{workers.length}</b>
            <span className="jb-health-line"><i className={`jb-pulse ${workers.length ? "ok" : redisDown ? "down" : "idle"}`} aria-hidden />{workers.length ? `Up ${relative(new Date(Date.now() - Math.max(...workers.map((worker) => worker.ageSeconds)) * 1000).toISOString()).replace(" ago", "")}` : redisDown ? "Redis unavailable" : "Start the worker"}</span>
          </article>
          <article>
            <small>Queue</small>
            <b>{(queue.waiting || 0) + (queue.active || 0) + (queue.prioritized || 0)}</b>
            <span>{queue.active || 0} running · {queue.delayed || 0} scheduled</span>
          </article>
          <article className={failedCount ? "attention" : ""}>
            <small>Failed jobs</small>
            <b>{failedCount}</b>
            <span>{failedCount ? "Retry from the Failed tab" : "No dead letters"}</span>
          </article>
          <article className={mail && (mail.gaveUp || mail.FAILED) ? "attention" : ""}>
            <small>Email</small>
            <b>{mail ? mail.PENDING + mail.PROCESSING : 0}<em className="jb-unit"> queued</em></b>
            <span>{mail ? `${mail.SENT} sent · ${mail.FAILED} failed · ${mail.mode === "smtp" ? "SMTP" : "dev mailbox"}` : "—"}</span>
          </article>
        </section>
      )}

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Jobs console sections">
          {TABS.map((item, index) => (
            <button key={item.key} ref={(node) => { tabRefs.current[index] = node; }} role="tab" id={`jb-tab-${item.key}`} aria-controls={`jb-panel-${item.key}`}
              aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)} onKeyDown={(event) => onTabKey(event, index)}>
              {item.label}{item.key === "failed" && failedCount ? <span className="jb-count">{failedCount}</span> : null}
            </button>
          ))}
        </div>
        {overview && <p className="jb-checked">Updated {relative(overview.checkedAt)} · auto-refreshes</p>}
      </div>

      <section role="tabpanel" id={`jb-panel-${tab}`} aria-labelledby={`jb-tab-${tab}`}>
        {tab === "schedules" && overview && <SchedulesPanel schedules={overview.schedules} workersOnline={workers.length} onToast={setToast} onChanged={() => void load(true)} />}
        {tab === "failed" && <FailedPanel items={failed} onToast={setToast} onChanged={() => void load(true)} />}
        {tab === "outbox" && <OutboxPanel revision={revision} onToast={setToast} maxAttempts={mail?.maxAttempts || 6} />}
        {tab === "runs" && overview && <RunsPanel revision={revision} names={overview.schedules.map((item) => item.name)} />}
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function SchedulesPanel({ schedules, workersOnline, onToast, onChanged }: { schedules: Schedule[]; workersOnline: number; onToast: (text: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState("");
  if (!schedules.length)
    return <div className="cw-empty"><span><Clock3 size={24} /></span><h2>No recurring jobs registered</h2><p>Automations appear here once the API has loaded the modules that register them.</p></div>;
  const run = async (schedule: Schedule) => {
    setBusy(schedule.name);
    try {
      const result = await jobsApi.run(schedule.name);
      onToast(result.workersOnline ? `${jobLabel(schedule.name)} queued for your organization — see Run history.` : `${jobLabel(schedule.name)} queued. It will run once a worker is online.`);
      window.setTimeout(onChanged, 2500);
    } catch (reason) {
      onToast((reason as Error).message || "Could not start the job.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="jb-table" role="table" aria-label="Recurring jobs">
      <div className="jb-row jb-sched head" role="row">
        <span role="columnheader">Job</span><span role="columnheader">Schedule</span><span role="columnheader">Next run</span><span role="columnheader">Last run (your org)</span><span role="columnheader"><span className="sr-only">Actions</span></span>
      </div>
      {schedules.map((schedule) => (
        <div key={schedule.name} className="jb-row jb-sched" role="row">
          <div role="cell" className="jb-job">
            <b>{jobLabel(schedule.name)}</b>
            {schedule.description && <small>{schedule.description}</small>}
            <code>{schedule.name}</code>
          </div>
          <span role="cell" className="jb-muted">{schedule.schedule}</span>
          <span role="cell">
            {schedule.nextRunAt ? <><b className="jb-strong">{relative(schedule.nextRunAt)}</b><small className="jb-sub">{when(schedule.nextRunAt)}</small></> : <small className="jb-sub">{schedule.scheduled ? "—" : workersOnline ? "Registering…" : "Waiting for a worker"}</small>}
          </span>
          <span role="cell">
            {schedule.lastRun ? (
              <>
                <Badge tone={statusTone[schedule.lastRun.status]}>{statusLabel[schedule.lastRun.status]}</Badge>
                <small className="jb-sub" title={when(schedule.lastRun.startedAt)}>{relative(schedule.lastRun.startedAt)} · {schedule.lastRun.error ? schedule.lastRun.error : summarise(schedule.lastRun.result)}</small>
              </>
            ) : <small className="jb-sub">Not run yet</small>}
          </span>
          <span role="cell" className="jb-actions">
            {schedule.canRunNow
              ? <button className="cw-btn ghost" onClick={() => void run(schedule)} disabled={busy === schedule.name} aria-label={`Run ${jobLabel(schedule.name)} now`}>
                  {busy === schedule.name ? <Loader2 size={15} className="jb-spin" /> : <Play size={15} />} Run now
                </button>
              : <small className="jb-sub" title="Platform-wide job; it runs on its schedule only.">Platform job</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

function FailedPanel({ items, onToast, onChanged }: { items: FailedJob[] | null; onToast: (text: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  if (!items) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  if (!items.length)
    return <div className="cw-empty"><span><CheckCircle2 size={24} /></span><h2>No failed jobs</h2><p>Jobs that exhaust their retries are kept here with their error so you can fix the cause and retry them.</p></div>;
  const retry = async (job: FailedJob) => {
    setBusy(job.id);
    try {
      await jobsApi.retry(job.id);
      onToast(`${jobLabel(job.name)} sent back to the queue.`);
      onChanged();
    } catch (reason) {
      onToast((reason as Error).message || "Could not retry the job.");
    } finally {
      setBusy("");
    }
  };
  return (
    <ul className="jb-failed" aria-label="Failed jobs">
      {items.map((job) => (
        <li key={job.id}>
          <div className="jb-failed-head">
            <div>
              <b>{jobLabel(job.name)}</b>
              <small className="jb-sub">#{job.id} · failed {relative(job.failedAt || job.createdAt)} · {job.attemptsMade}/{job.attempts} attempts · {job.scope === "organization" ? "your organization" : "platform"}{job.known ? "" : " · no handler"}</small>
            </div>
            {job.canRetry === false ? <small className="jb-sub">Platform job — a platform administrator can retry it</small> : (
              <button className="cw-btn ghost" onClick={() => void retry(job)} disabled={busy === job.id} aria-label={`Retry ${jobLabel(job.name)} job ${job.id}`}>
                {busy === job.id ? <Loader2 size={15} className="jb-spin" /> : <RotateCcw size={15} />} Retry
              </button>
            )}
          </div>
          <pre className="jb-error">{job.error}</pre>
          {job.data && (
            <>
              <button className="jb-link" aria-expanded={open === job.id} onClick={() => setOpen(open === job.id ? null : job.id)}>
                <ChevronDown size={14} className={open === job.id ? "jb-rot" : ""} /> Payload
              </button>
              {open === job.id && <pre className="jb-payload">{prettyJson(job.data)}</pre>}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function prettyJson(text: string) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

const OUTBOX_FILTERS: { key: "" | OutboxStatus; label: string }[] = [
  { key: "", label: "All" }, { key: "PENDING", label: "Queued" }, { key: "FAILED", label: "Failed" }, { key: "SENT", label: "Sent" },
];

function OutboxPanel({ revision, onToast, maxAttempts }: { revision: number; onToast: (text: string) => void; maxAttempts: number }) {
  const [status, setStatus] = useState<"" | OutboxStatus>("");
  const [data, setData] = useState<{ items: OutboxItem[]; counts: Record<string, number>; mode: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    jobsApi.outbox(status).then((result) => { setData(result); setError(""); }).catch((reason) => setError((reason as Error).message || "Could not load emails."));
  }, [status]);
  useEffect(() => { load(); }, [load, revision]);
  const requeue = async (item: OutboxItem) => {
    setBusy(item.id);
    try { await jobsApi.requeue(item.id); onToast(`“${item.subject}” queued to send again.`); load(); }
    catch (reason) { onToast((reason as Error).message || "Could not re-send."); }
    finally { setBusy(""); }
  };
  const counts = data?.counts || {};
  return (
    <>
      <div className="cw-chips" role="group" aria-label="Filter emails by status">
        {OUTBOX_FILTERS.map((filter) => (
          <button key={filter.key} className={status === filter.key ? "active" : ""} aria-pressed={status === filter.key} onClick={() => setStatus(filter.key)}>
            {filter.label}{filter.key && <b>{filter.key === "PENDING" ? (counts.PENDING || 0) + (counts.PROCESSING || 0) : counts[filter.key] || 0}</b>}
          </button>
        ))}
      </div>
      {data?.mode === "mailbox" && <p className="jb-note"><Inbox size={14} /> Development mailbox: messages are written as JSON files to <code>.data/mail/</code> instead of being emailed. Set SMTP_HOST to send real email.</p>}
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!data && !error && <div className="cw-list-skeleton"><i /><i /><i /></div>}
      {data && !data.items.length && <div className="cw-empty"><span><Mail size={24} /></span><h2>No emails{status ? ` with this status` : " yet"}</h2><p>Approval requests, digests and reminders are queued here and delivered by the worker every 30 seconds.</p></div>}
      {data && !!data.items.length && (
        <div className="jb-table" role="table" aria-label="Email outbox">
          <div className="jb-row jb-mail head" role="row"><span role="columnheader">Message</span><span role="columnheader">Status</span><span role="columnheader">Attempts</span><span role="columnheader">When</span><span role="columnheader"><span className="sr-only">Actions</span></span></div>
          {data.items.map((item) => (
            <div key={item.id} className="jb-row jb-mail" role="row">
              <div role="cell" className="jb-job"><b>{item.subject}</b><small>To {item.recipient}</small>{item.lastError && <small className="jb-err-inline">{item.lastError}</small>}</div>
              <span role="cell">{item.gaveUp ? <Badge tone="danger">Gave up</Badge> : item.status === "FAILED" ? <Badge tone="warning">Retrying</Badge> : <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>}</span>
              <span role="cell" className="jb-muted">{item.attempts}/{maxAttempts}</span>
              <span role="cell">
                {item.status === "SENT" ? <><b className="jb-strong">{relative(item.sentAt)}</b><small className="jb-sub">Sent {when(item.sentAt)}</small></>
                  : item.status === "FAILED" && !item.gaveUp ? <><b className="jb-strong">Next try {relative(item.availableAt)}</b><small className="jb-sub">Queued {when(item.createdAt)}</small></>
                  : <><b className="jb-strong">{relative(item.createdAt)}</b><small className="jb-sub">Queued {when(item.createdAt)}</small></>}
              </span>
              <span role="cell" className="jb-actions">
                {item.status === "FAILED" && (
                  <button className="cw-btn ghost" onClick={() => void requeue(item)} disabled={busy === item.id} aria-label={`Send “${item.subject}” again`}>
                    {busy === item.id ? <Loader2 size={15} className="jb-spin" /> : <RotateCcw size={15} />} Resend
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RunsPanel({ revision, names }: { revision: number; names: string[] }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<JobRun[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    jobsApi.runs(name).then((result) => { if (live) { setItems(result.items); setError(""); } }).catch((reason) => live && setError((reason as Error).message || "Could not load run history."));
    return () => { live = false; };
  }, [name, revision]);
  const sorted = useMemo(() => [...names].sort(), [names]);
  return (
    <>
      <div className="jb-runs-filter">
        <label><span>Job</span>
          <select value={name} onChange={(event) => { setName(event.target.value); setItems(null); }}>
            <option value="">All automations</option>
            {sorted.map((item) => <option key={item} value={item}>{jobLabel(item)}</option>)}
          </select>
        </label>
        <p className="jb-sub">Runs for your organization only. Kept for 90 days.</p>
      </div>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!items && !error && <div className="cw-list-skeleton"><i /><i /><i /></div>}
      {items && !items.length && <div className="cw-empty"><span><History size={24} /></span><h2>No runs yet</h2><p>Each time an automation runs for your organization its outcome is recorded here.</p></div>}
      {items && !!items.length && (
        <div className="jb-table" role="table" aria-label="Run history">
          <div className="jb-row jb-run head" role="row"><span role="columnheader">Job</span><span role="columnheader">Outcome</span><span role="columnheader">Trigger</span><span role="columnheader">Started</span><span role="columnheader">Took</span></div>
          {items.map((run) => (
            <div key={run.id} className="jb-row jb-run" role="row">
              <div role="cell" className="jb-job"><b>{jobLabel(run.name)}</b><small className={run.error ? "jb-err-inline" : ""}>{run.error || summarise(run.result)}</small></div>
              <span role="cell"><Badge tone={statusTone[run.status]}>{statusLabel[run.status]}</Badge></span>
              <span role="cell" className="jb-muted">{run.trigger === "MANUAL" ? "Run now" : run.trigger === "SCHEDULE" ? "Schedule" : "Queued"}</span>
              <span role="cell"><b className="jb-strong">{relative(run.startedAt)}</b><small className="jb-sub">{when(run.startedAt)}</small></span>
              <span role="cell" className="jb-muted">{duration(run.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
