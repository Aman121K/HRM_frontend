"use client";
import {
  AlertTriangle, ArrowRight, BadgeIndianRupee, CalendarClock, ChevronRight, Clock3, Fingerprint, HeartHandshake, Lock, Receipt, RefreshCw, Scale,
  Search, Settings2, ShieldAlert, ShieldCheck, Timer, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { relativeTime, shortDate } from "@/lib/cases";
import { ApiRequestError } from "@/lib/http-client";
import { ComplianceCalendar } from "./compliance-calendar";
import {
  AREAS, AREA_LABELS, AREA_SHORT, SEVERITIES, SEVERITY_LABEL, STATUS_LABEL, STATUS_TONE, riskApi, type Area, type Overview, type Severity, type Signal,
} from "./risk-api";
import { RiskSettingsDrawer } from "./risk-settings-drawer";
import { SignalDrawer } from "./signal-drawer";

type Tab = "all" | Area;
const AREA_ICONS: Record<Area, typeof ShieldAlert> = {
  compliance: CalendarClock, attendance: Fingerprint, labour: Scale, payroll: BadgeIndianRupee, expenses: Receipt, people: HeartHandshake, service: Timer,
};
const ETHICS = "People signals are prompts to check in, never predictions or judgements. They use only facts in Northstar (tenure, declined requests, overdue onboarding tasks, attendance days) — no guesses about intent, no personal characteristics — and are visible only to HR and the person's direct manager. Don't use them for performance, pay or disciplinary decisions.";

function readParam(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
function writeParams(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  window.history.replaceState(null, "", url.toString());
}

function People({ signal }: { signal: Signal }) {
  if (!signal.people.length) return <span className="rk-muted">{signal.area === "compliance" ? "Whole brand" : "—"}</span>;
  const [first, ...rest] = signal.people;
  return <span className="rk-people-cell"><b className={first.redacted ? "redacted" : ""}>{first.name}</b>{rest.length ? <small> +{rest.length} more</small> : null}</span>;
}

function SignalRow({ signal, onOpen }: { signal: Signal; onOpen: (id: string) => void }) {
  const Icon = AREA_ICONS[signal.area];
  const active = signal.status === "OPEN" || signal.status === "ACKNOWLEDGED";
  return (
    <button className={`rk-row sev-${signal.severity}${active ? "" : " closed"}`} onClick={() => onOpen(signal.id)} aria-label={`${SEVERITY_LABEL[signal.severity]}: ${signal.title}`}>
      <span className={`rk-sev-badge sev-${signal.severity}`}><i aria-hidden="true" />{SEVERITY_LABEL[signal.severity]}</span>
      <span className="rk-row-title">
        <small><Icon size={12} aria-hidden="true" /> {AREA_SHORT[signal.area]} · {signal.detectorLabel}{signal.clearedAt && active ? " · no longer detected" : ""}</small>
        <b>{signal.title}</b>
      </span>
      <People signal={signal} />
      <span className="rk-row-when">{signal.dueDate ? `Due ${shortDate(signal.dueDate)}` : relativeTime(signal.lastDetectedAt)}</span>
      <span className={`cw-badge ${STATUS_TONE[signal.status]}`}><i />{STATUS_LABEL[signal.status]}</span>
      <ChevronRight size={16} className="rk-row-go" aria-hidden="true" />
    </button>
  );
}

/** Stacked severity bars per area (hand-made SVG; the numbers are also in the tab labels). */
function AreaBars({ overview, onPick }: { overview: Overview; onPick: (area: Area) => void }) {
  const visible = AREAS.filter((area) => overview.detectors.some((detector) => detector.area === area));
  const max = Math.max(1, ...visible.map((area) => overview.counts.byArea[area].total));
  return (
    <section className="rk-areas" aria-labelledby="rk-areas-title">
      <h2 id="rk-areas-title" className="rk-h2">Where the risk is</h2>
      <ul>
        {visible.map((area) => {
          const counts = overview.counts.byArea[area];
          const Icon = AREA_ICONS[area];
          return (
            <li key={area}>
              <button onClick={() => onPick(area)} aria-label={`${AREA_LABELS[area]}: ${counts.total} active — ${SEVERITIES.map((s) => `${counts[s]} ${s}`).join(", ")}`}>
                <span className="rk-area-name"><Icon size={15} aria-hidden="true" /> {AREA_SHORT[area]}</span>
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" className="rk-bar">
                  <rect x="0" y="0" width="100" height="10" className="rk-bar-bg" />
                  {(() => { let x = 0; return SEVERITIES.map((severity) => { const w = (counts[severity] / max) * 100; const rect = <rect key={severity} x={x} y="0" width={w} height="10" className={`rk-bar-${severity}`} />; x += w; return rect; }); })()}
                </svg>
                <b>{counts.total}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RiskCenter() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ items: Signal[]; total: number } | null>(null);
  const [listError, setListError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const wanted = readParam("tab");
    if (wanted && (wanted === "all" || AREAS.includes(wanted as Area))) setTab(wanted as Tab);
    const signal = readParam("signal");
    if (signal) setOpenId(signal);
  }, []);

  const loadOverview = useCallback(() => {
    riskApi.overview().then((data) => { setOverview(data); setError(null); })
      .catch((reason: Error) => setError({ message: reason.message || "Could not load the Risk & Compliance Center.", status: reason instanceof ApiRequestError ? reason.status : undefined }));
  }, []);
  useEffect(loadOverview, [loadOverview, revision]);

  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (!overview) return;
    setListError("");
    riskApi.signals({ area: tab === "all" ? undefined : tab, severity: severity || undefined, status, search: query || undefined, limit: 100 })
      .then(setList).catch((reason: Error) => setListError(reason.message));
  }, [overview, tab, severity, status, query]);

  const refresh = () => setRevision((value) => value + 1);
  const pickTab = (next: Tab) => { setTab(next); writeParams({ tab: next === "all" ? null : next }); };
  const open = (id: string) => { setOpenId(id); writeParams({ signal: id }); };
  // Stable callbacks: the drawers' focus trap re-initialises whenever onClose changes identity.
  const close = useCallback(() => { setOpenId(null); writeParams({ signal: null }); }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const refreshCb = useCallback(() => setRevision((value) => value + 1), []);
  const scan = async () => {
    setScanning(true);
    try {
      const result = await riskApi.scan();
      setToast(`Scan complete in ${result.ms} ms — ${result.signals} signals (${result.created} new${result.reopened ? `, ${result.reopened} re-opened` : ""}${result.autoResolved ? `, ${result.autoResolved} resolved automatically` : ""}).${result.errors.length ? ` Some checks failed: ${result.errors.join("; ")}` : ""}`);
      refresh();
    } catch (reason) { setToast((reason as Error).message); }
    finally { setScanning(false); window.setTimeout(() => setToast(""), 5000); }
  };

  const tabs = useMemo(() => {
    if (!overview) return [];
    const areas = AREAS.filter((area) => overview.detectors.some((detector) => detector.area === area) || (area === "compliance" && overview.calendar));
    return [{ key: "all" as Tab, label: "Overview", count: overview.counts.active }, ...areas.map((area) => ({ key: area as Tab, label: AREA_SHORT[area], count: overview.counts.byArea[area].total }))];
  }, [overview]);

  if (error) {
    const forbidden = error.status === 403;
    return (
      <div className="cw-page rk-page">
        <div className="cw-empty">
          <span>{forbidden ? <Lock size={26} /> : <AlertTriangle size={26} />}</span>
          <h2>{forbidden ? "This area is for HR, payroll admins and managers" : "Couldn't load the Risk & Compliance Center"}</h2>
          <p>{forbidden ? "Risk signals include sensitive attendance, payroll and people information, so they're only shown to the people who act on them. If you think you need access, ask your HR admin." : `${error.message} Make sure the platform API is running.`}</p>
          {!forbidden && <button className="cw-btn ghost" onClick={loadOverview}>Try again</button>}
        </div>
      </div>
    );
  }
  if (!overview) return (
    <div className="cw-page rk-page" aria-busy="true">
      <div className="cw-hero-skeleton" aria-label="Loading risk overview" />
      <div className="rk-strip rk-strip-skeleton" style={{ marginTop: 18 }}><i /><i /><i /><i /></div>
      <div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /><i /></div>
    </div>
  );

  const { viewer, counts, calendar } = overview;
  const skipped = overview.skipped.filter((item) => tab === "all" || item.area === tab);
  const scope = viewer.isHr ? "everything in this brand" : [viewer.isPayroll ? "payroll and statutory items" : null, viewer.isManager ? `signals about your ${viewer.reportCount} direct report${viewer.reportCount === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ");

  return (
    <div className="cw-page rk-page" style={{ ["--accent" as string]: "#a2402f" }}>
      <header className="cw-hero rk-hero">
        <span className="cw-hero-icon"><ShieldAlert size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">RISK & COMPLIANCE CENTER</p>
          <h1>Catch problems before they cost you</h1>
          <p>Statutory due dates, buddy punching, working-hour limits, payroll slips, claim patterns and stuck work — explained with the actual numbers. You're seeing {scope}.</p>
          <p className="rk-scan-meta"><Clock3 size={13} /> {overview.lastScan?.at ? `Last scan ${relativeTime(overview.lastScan.at)} · runs hourly` : "Not scanned yet — runs hourly"}</p>
        </div>
        <div className="rk-hero-actions">
          {viewer.canScan && <button className="cw-btn primary lg" onClick={scan} disabled={scanning}><RefreshCw size={17} className={scanning ? "rk-spin" : ""} /> {scanning ? "Scanning…" : "Run scan now"}</button>}
          {(viewer.isHr || viewer.isPayroll) && <button className="cw-btn ghost lg" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /> Settings</button>}
        </div>
      </header>

      <div className="rk-strip" role="group" aria-label="Active signals by severity">
        {SEVERITIES.map((level) => (
          <button key={level} className={`rk-sev sev-${level}${severity === level ? " active" : ""}`} aria-pressed={severity === level}
            onClick={() => setSeverity((current) => (current === level ? "" : level))}>
            <small>{SEVERITY_LABEL[level]}</small><b>{counts.bySeverity[level]}</b>
            <span>{level === "critical" ? "Act today" : level === "high" ? "This week" : level === "medium" ? "Plan a fix" : "Keep an eye on"}</span>
          </button>
        ))}
        <div className="rk-sev total"><small>Active</small><b>{counts.active}</b><span>{counts.byStatus.ACKNOWLEDGED} acknowledged · {counts.byStatus.RESOLVED} resolved in 30 d</span></div>
      </div>

      {!viewer.isHr && viewer.isManager && (
        <p className="rk-scope"><ShieldCheck size={15} /> You see signals about your direct reports only. Colleagues outside your team appear as "Someone outside your team".</p>
      )}

      <div className="cw-toolbar rk-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Risk areas">
          {tabs.map((item) => (
            <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => pickTab(item.key)}>
              {item.label}{item.count ? <span className="rk-tab-count">{item.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "people" && <p className="cw-alert warn rk-ethics"><HeartHandshake size={15} /> {ETHICS}</p>}

      {tab === "all" && (
        <div className="rk-overview">
          <div className="rk-overview-main">
            {calendar && <ComplianceCalendar calendar={calendar} canMark={viewer.isHr || viewer.isPayroll} onChanged={refresh} compact />}
            <section aria-labelledby="rk-top-title">
              <h2 id="rk-top-title" className="rk-h2">Most urgent</h2>
              {overview.top.length === 0 ? (
                <div className="cw-empty rk-clear"><span><ShieldCheck size={26} /></span><h2>No active signals</h2><p>Nothing needs attention right now. Detectors run every hour.</p></div>
              ) : <div className="rk-table">{overview.top.map((signal) => <SignalRow key={signal.id} signal={signal} onOpen={open} />)}</div>}
            </section>
          </div>
          <aside className="rk-overview-side">
            <AreaBars overview={overview} onPick={pickTab} />
            {skipped.length > 0 && (
              <section className="rk-skipped" aria-labelledby="rk-skipped-title">
                <h2 id="rk-skipped-title" className="rk-h2">Not checked — and why</h2>
                <ul>{skipped.map((item) => <li key={item.key}><b>{item.label}</b><p>{item.reason}</p></li>)}</ul>
              </section>
            )}
          </aside>
        </div>
      )}

      {tab === "compliance" && calendar && <ComplianceCalendar calendar={calendar} canMark={viewer.isHr || viewer.isPayroll} onChanged={refresh} />}

      <section className="rk-list" aria-labelledby="rk-list-title">
        <div className="rk-list-head">
          <h2 id="rk-list-title" className="rk-h2">{tab === "all" ? "All signals" : `${AREA_LABELS[tab]} signals`}{list ? <span className="rk-muted"> · {list.total}</span> : null}</h2>
          <div className="rk-filters">
            <label className="cw-search"><Search size={15} aria-hidden="true" /><input aria-label="Search signals" placeholder="Search signals" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
            <label className="rk-select"><span className="sr-only">Status</span>
              <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="active">Active (open + acknowledged)</option><option value="OPEN">Open</option><option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="closed">Closed (resolved + dismissed)</option><option value="all">All</option>
              </select></label>
            {severity && <button className="cw-btn ghost rk-clear-filter" onClick={() => setSeverity("")}>{SEVERITY_LABEL[severity]} <X size={13} /></button>}
          </div>
        </div>
        {listError && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {listError}</p>}
        {!list ? <div className="cw-list-skeleton"><i /><i /><i /></div> : list.items.length === 0 ? (
          <div className="cw-empty"><span><ShieldCheck size={26} /></span><h2>{status === "active" ? "Nothing to act on here" : "No signals match"}</h2>
            <p>{status === "active" ? "No active signals for these filters. Closed signals are under the status filter." : "Try a different status or clear the search."}</p></div>
        ) : (
          <div className="rk-table">
            <div className="rk-row head" aria-hidden="true"><span>Severity</span><span>Signal</span><span>Who</span><span>When</span><span>Status</span><span /></div>
            {list.items.map((signal) => <SignalRow key={signal.id} signal={signal} onOpen={open} />)}
          </div>
        )}
        {tab !== "all" && skipped.length > 0 && (
          <div className="rk-skipped inline">{skipped.map((item) => <p key={item.key}><b>{item.label}:</b> {item.reason}</p>)}</div>
        )}
      </section>

      {tab === "all" && overview.detectors.length > 0 && (
        <details className="rk-howto">
          <summary>How the {overview.detectors.length} checks work <ArrowRight size={14} /></summary>
          <ul>{overview.detectors.map((detector) => <li key={detector.key} className={detector.enabled ? "" : "off"}><b>{detector.label}</b> <small>{AREA_SHORT[detector.area]}{detector.enabled ? "" : " · switched off"}{detector.autoResolve ? " · resolves itself when fixed" : ""}</small><p>{detector.description}</p></li>)}</ul>
        </details>
      )}

      {openId && <SignalDrawer id={openId} onClose={close} onChanged={refreshCb} />}
      {settingsOpen && <RiskSettingsDrawer onClose={closeSettings} onSaved={refreshCb} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
