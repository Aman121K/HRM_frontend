"use client";
import Link from "next/link";
import { Lock, Minus, RefreshCw, RotateCcw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { absoluteTime, addMonths, formatValue, monthIndex, monthLabel, monthsBetween, relativeFromNow, type FilterOptions, type Filters, type Kpi } from "./analytics-api";
import { Sparkline } from "./charts";

// ---- KPI tile ------------------------------------------------------------------------------------
export function KpiTile({ kpi, href, compare = "vs previous period" }: { kpi: Kpi; href?: string; compare?: string }) {
  const value = kpi.format === "text" ? kpi.text || "—" : formatValue(kpi.value, kpi.format, true);
  const delta = kpi.delta;
  const direction = delta === null || delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const tone = !direction || direction === "flat" || kpi.goodWhen === "neutral" || !kpi.goodWhen ? "neutral" : direction === kpi.goodWhen ? "good" : "bad";
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const deltaText = direction ? `${delta! > 0 ? "+" : ""}${formatValue(delta, "decimal")}${kpi.deltaUnit === "pts" ? " pts" : "%"}` : null;
  const body = (
    <>
      <small>{kpi.label}</small>
      <b className={kpi.format === "text" ? "text" : ""}>{value}</b>
      <div className="an-tile-meta">
        {deltaText && (
          <span className={`an-delta ${tone}`} title={kpi.previous !== undefined && kpi.previous !== null ? `Previous: ${formatValue(kpi.previous, kpi.format, true)}` : undefined}>
            <Icon size={13} aria-hidden="true" />{deltaText}<span className="sr-only"> {compare}{tone === "good" ? ", an improvement" : tone === "bad" ? ", a deterioration" : ""}</span>
          </span>
        )}
        {kpi.note && <span className="an-tile-note">{kpi.note}</span>}
      </div>
      {kpi.spark && kpi.spark.some((point) => point !== null) && <Sparkline values={kpi.spark} />}
    </>
  );
  return href ? <Link href={href} className="an-tile">{body}</Link> : <article className="an-tile">{body}</article>;
}

// ---- filters -------------------------------------------------------------------------------------
const PRESETS = [{ key: "3", label: "3M" }, { key: "6", label: "6M" }, { key: "12", label: "12M" }, { key: "ytd", label: "YTD" }, { key: "24", label: "24M" }];

export function FilterBar({ filters, setFilters, options, generatedAt, cached, loading, onRefresh, children }: {
  filters: Filters; setFilters: (next: Filters) => void; options: FilterOptions | null;
  generatedAt?: string; cached?: boolean; loading: boolean; onRefresh: () => void; children?: ReactNode;
}) {
  const current = options?.currentMonth || new Date().toISOString().slice(0, 7);
  const from = filters.from || options?.defaultRange.from || addMonths(current, -11);
  const to = filters.to || options?.defaultRange.to || current;
  const [draft, setDraft] = useState({ from, to });
  useEffect(() => setDraft({ from, to }), [from, to]);
  const floor = options ? (monthIndex(options.earliestMonth) > monthIndex(addMonths(current, -47)) ? options.earliestMonth : addMonths(current, -47)) : addMonths(current, -47);
  const months = useMemo(() => monthsBetween(floor, current).reverse(), [floor, current]);
  const span = monthIndex(draft.to) - monthIndex(draft.from) + 1;
  const invalid = span < 1 ? "Start must be before end." : span > (options?.maxMonths || 24) ? `At most ${options?.maxMonths || 24} months.` : "";
  const preset = (key: string) => {
    const start = key === "ytd" ? `${current.slice(0, 4)}-${Number(current.slice(5)) >= 4 ? "04" : "01"}` : addMonths(current, -(Number(key) - 1));
    setFilters({ ...filters, from: start, to: current });
  };
  const activePreset = to === current ? PRESETS.find((p) => (p.key === "ytd" ? from === `${current.slice(0, 4)}-${Number(current.slice(5)) >= 4 ? "04" : "01"}` : from === addMonths(current, -(Number(p.key) - 1))))?.key : undefined;
  const applyRange = (next: { from: string; to: string }) => {
    setDraft(next);
    const n = monthIndex(next.to) - monthIndex(next.from) + 1;
    if (n >= 1 && n <= (options?.maxMonths || 24)) setFilters({ ...filters, ...next });
  };
  const dirty = Boolean(filters.from || filters.to || filters.department || filters.location);
  return (
    <div className="an-filters" role="search" aria-label="Report filters">
      <div className="an-presets" role="group" aria-label="Quick periods">
        {PRESETS.map((p) => <button key={p.key} type="button" className={activePreset === p.key ? "active" : ""} aria-pressed={activePreset === p.key} onClick={() => preset(p.key)}>{p.label}</button>)}
      </div>
      <label className="an-select"><span>From</span>
        <select value={draft.from} onChange={(event) => applyRange({ ...draft, from: event.target.value })} aria-invalid={Boolean(invalid)}>
          {months.map((month) => <option key={month} value={month}>{monthLabel(month, true)}</option>)}
        </select></label>
      <label className="an-select"><span>To</span>
        <select value={draft.to} onChange={(event) => applyRange({ ...draft, to: event.target.value })} aria-invalid={Boolean(invalid)}>
          {months.map((month) => <option key={month} value={month}>{monthLabel(month, true)}</option>)}
        </select></label>
      <label className="an-select"><span>Department</span>
        <select value={filters.department || ""} onChange={(event) => setFilters({ ...filters, department: event.target.value || undefined })}>
          <option value="">All departments</option>
          {options?.departments.map((d) => <option key={d.value} value={d.value}>{d.value} ({d.people})</option>)}
        </select></label>
      <label className="an-select"><span>Location</span>
        <select value={filters.location || ""} onChange={(event) => setFilters({ ...filters, location: event.target.value || undefined })}>
          <option value="">All locations</option>
          {options?.locations.map((l) => <option key={l.value} value={l.value}>{l.value} ({l.people})</option>)}
        </select></label>
      {dirty && <button type="button" className="cw-btn ghost an-reset" onClick={() => setFilters({})}><RotateCcw size={14} /> Reset</button>}
      <div className="an-refresh">
        {generatedAt && <span title={absoluteTime(generatedAt)}>{cached ? "Cached" : "Refreshed"} {relativeFromNow(generatedAt)}</span>}
        <button type="button" className="cw-icon-button" onClick={onRefresh} disabled={loading} aria-label="Refresh data now" title="Refresh data now"><RefreshCw size={15} className={loading ? "an-spin" : ""} /></button>
        {children}
      </div>
      {invalid && <p className="an-filter-error" role="alert">{invalid}</p>}
    </div>
  );
}

// ---- states --------------------------------------------------------------------------------------
export function Forbidden({ message }: { message: string }) {
  return (
    <div className="cw-empty an-forbidden">
      <span><Lock size={24} /></span>
      <h2>Analytics are restricted</h2>
      <p>{message} If you need access, ask your HR administrator to grant a manager, HR or payroll role.</p>
      <Link href="/" className="cw-btn ghost">Back to home</Link>
    </div>
  );
}
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <p className="cw-alert" role="alert"><TriangleAlert size={15} /> <span>{message}</span> <button type="button" className="cw-btn ghost an-retry" onClick={onRetry}>Try again</button></p>;
}
export function TilesSkeleton({ count = 6 }: { count?: number }) {
  return <div className="an-tiles" aria-busy="true" aria-label="Loading metrics">{Array.from({ length: count }, (_, i) => <div key={i} className="an-tile skeleton"><i /><i /><i /></div>)}</div>;
}
export function ChartsSkeleton({ count = 4 }: { count?: number }) {
  return <div className="an-grid" aria-hidden="true">{Array.from({ length: count }, (_, i) => <div key={i} className="an-card skeleton" />)}</div>;
}
