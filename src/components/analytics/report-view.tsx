"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpen, ChartNoAxesCombined, ChevronRight, Download, EyeOff, Info, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { exportReport, formatValue, useCatalogue, useFilterOptions, useFilters, useReport, type Column, type Report } from "./analytics-api";
import { ChartCard } from "./charts";
import { CATEGORY_ACCENT, Catalogue, REPORT_ICONS } from "./overview";
import { ChartsSkeleton, FilterBar, Forbidden, KpiTile, LoadError, TilesSkeleton } from "./parts";

export function ReportView({ slug }: { slug: string }) {
  const { filters, setFilters, query } = useFilters();
  const options = useFilterOptions();
  const report = useReport(slug, query);
  const catalogue = useCatalogue();
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const data = report.data;
  const meta = data?.meta || catalogue.data?.items.find((item) => item.slug === slug);
  const Icon = REPORT_ICONS[slug] || ChartNoAxesCombined;
  const accent = meta ? CATEGORY_ACCENT[meta.category] : "#0b615c";

  const download = async () => {
    setExporting(true);
    try { await exportReport(slug, query); setToast("CSV downloaded."); }
    catch (error) { setToast(error instanceof Error ? error.message : "Export failed."); }
    finally { setExporting(false); window.setTimeout(() => setToast(""), 3000); }
  };

  if (report.status === 404) return (
    <div className="cw-page an-page"><div className="cw-empty"><span><ChartNoAxesCombined size={24} /></span><h2>Report not found</h2><p>This report does not exist or has moved.</p><Link className="cw-btn ghost" href="/reports">Browse all reports</Link></div></div>
  );

  return (
    <div className="cw-page an-page" style={{ ["--accent" as string]: accent }}>
      <nav className="an-crumbs" aria-label="Breadcrumb"><Link href={`/reports${query ? `?${query}` : ""}`}>Reports</Link><ChevronRight size={13} aria-hidden="true" /><span>{meta?.category || "Report"}</span></nav>
      <header className="cw-hero an-hero">
        <span className="cw-hero-icon"><Icon size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">{(meta?.category || "Report").toUpperCase()}</p>
          <h1>{meta?.title || "Loading report…"}</h1>
          <p>{meta?.summary || " "}</p>
        </div>
        {data && <span className="an-scope"><ShieldCheck size={15} /> {data.scope.label}</span>}
      </header>

      {report.status === 403 ? <Forbidden message={report.error} /> : (
        <>
          <FilterBar filters={filters} setFilters={setFilters} options={options.data} generatedAt={data?.generatedAt} cached={data?.cached} loading={report.loading} onRefresh={report.refresh}>
            <button type="button" className="cw-btn primary" onClick={download} disabled={exporting || !data?.available}><Download size={15} /> {exporting ? "Preparing…" : "Export CSV"}</button>
          </FilterBar>
          {report.error && report.status !== 403 && <LoadError message={report.error} onRetry={report.refresh} />}
          {!data && report.loading ? <><TilesSkeleton count={4} /><ChartsSkeleton count={2} /></> : data && <ReportBody report={data} loading={report.loading} />}
          <Catalogue items={(catalogue.data?.items || []).filter((item) => item.category === meta?.category)} loading={catalogue.loading} query={query} exclude={slug} />
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ReportBody({ report, loading }: { report: Report; loading: boolean }) {
  if (!report.available) {
    return (
      <div className="cw-empty an-unavailable">
        <span><Info size={24} /></span>
        <h2>Not available yet</h2>
        <p>{report.unavailable}</p>
        <Definitions report={report} />
      </div>
    );
  }
  return (
    <div className={loading ? "an-stale" : ""} aria-busy={loading}>
      <section className="an-tiles" aria-label="Key metrics">{report.kpis.map((kpi) => <KpiTile key={kpi.key} kpi={kpi} />)}</section>
      {Boolean(report.suppressedGroups) && <p className="cw-alert warn an-privacy"><EyeOff size={15} /> {report.suppressedGroups} small group{report.suppressedGroups === 1 ? " was" : "s were"} pooled or hidden to protect individual privacy (fewer than 3 people).</p>}
      <div className="an-grid">{report.charts.map((chart) => <ChartCard key={chart.id} chart={chart} />)}</div>
      <DataTable report={report} />
      <Definitions report={report} />
    </div>
  );
}

function DataTable({ report }: { report: Report }) {
  const { columns, rows, title, note } = report.table;
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, sort]);
  const numeric = (column: Column) => column.format !== "text" && column.format !== "month";
  const toggle = (key: string) => setSort((current) => (current?.key === key ? (current.dir === -1 ? { key, dir: 1 } : null) : { key, dir: -1 }));
  return (
    <section className="an-card an-table-card" aria-labelledby="an-table-title">
      <header><div><h3 id="an-table-title">{title}</h3><p>{rows.length} row{rows.length === 1 ? "" : "s"} · click a column to sort · included in the CSV export</p></div></header>
      {rows.length === 0 ? <p className="an-chart-empty">No rows for this selection.</p> : (
        <div className="an-table-scroll" tabIndex={0} role="region" aria-label={`${title} table`}>
          <table className="an-table">
            <thead><tr>{columns.map((column) => (
              <th key={column.key} scope="col" className={numeric(column) ? "num" : ""} aria-sort={sort?.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggle(column.key)}>{column.label}{sort?.key === column.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button>
              </th>))}</tr></thead>
            <tbody>{sorted.map((row, index) => (
              <tr key={index} className={row.suppressed ? "suppressed" : ""}>
                {columns.map((column, ci) => {
                  const value = row[column.key];
                  const content = row.suppressed && (value === null || value === undefined) && numeric(column)
                    ? <span className="an-suppressed" title="Hidden: fewer than 3 people in this group">Suppressed</span>
                    : formatValue(value, column.format);
                  return ci === 0 ? <th key={column.key} scope="row">{content}</th> : <td key={column.key} className={numeric(column) ? "num" : ""}>{content}</td>;
                })}
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {note && <p className="an-chart-note">{note}</p>}
    </section>
  );
}

function Definitions({ report }: { report: Report }) {
  return (
    <section className="an-card an-defs" aria-labelledby="an-defs-title">
      <header><div><h3 id="an-defs-title"><BookOpen size={16} aria-hidden="true" /> Definitions & methodology</h3><p>How every number on this page is calculated</p></div></header>
      <dl>{report.meta.definitions.map((definition) => <div key={definition.term}><dt>{definition.term}</dt><dd>{definition.text}</dd></div>)}</dl>
      {report.footnotes.length > 0 && <ol className="an-footnotes">{report.footnotes.map((note) => <li key={note}>{note}</li>)}</ol>}
      <p className="an-provenance">
        Period {formatValue(report.filters.from, "month")} – {formatValue(report.filters.to, "month")}{report.filters.partialLastMonth ? " (last month to date)" : ""} · {report.scope.label}
        {report.source && <> · source: {report.source === "payroll_engine" ? "payroll runs" : "published payslips"}</>} · computed live from Northstar records, cached up to 5 minutes.
      </p>
    </section>
  );
}
