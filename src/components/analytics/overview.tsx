"use client";
import Link from "next/link";
import {
  ArrowUpRight, CalendarDays, CalendarX2, ChartNoAxesCombined, ChartPie, CircleCheck, Clock3, GraduationCap, Hourglass,
  IndianRupee, LifeBuoy, Lightbulb, UserRoundPlus, Network, Receipt, ShieldCheck, Smile, Target, TriangleAlert, UserMinus, Users, UserSearch, type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useCatalogue, useFilterOptions, useFilters, useOverview, type CatalogueItem, type Chart, type Insight, type ReportCategory } from "./analytics-api";
import { ChartCard } from "./charts";
import { ChartsSkeleton, FilterBar, Forbidden, KpiTile, LoadError, TilesSkeleton } from "./parts";

export const REPORT_ICONS: Record<string, LucideIcon> = {
  headcount: Users, attrition: UserMinus, tenure: Hourglass, "span-of-control": Network, "workforce-composition": ChartPie,
  "leave-utilisation": CalendarDays, "unplanned-leave": CalendarX2, attendance: Clock3, "service-desk": LifeBuoy, expenses: Receipt,
  recruitment: UserSearch, "payroll-cost": IndianRupee, learning: GraduationCap, engagement: Smile, "performance-goals": Target, onboarding: UserRoundPlus,
};
export const CATEGORY_ORDER: ReportCategory[] = ["Workforce", "Time & leave", "Talent", "Engagement", "Service delivery", "Cost"];
export const CATEGORY_ACCENT: Record<ReportCategory, string> = {
  Workforce: "#00897d", "Time & leave": "#2a78d6", Talent: "#4a3aa7", Engagement: "#e87ba4", "Service delivery": "#eb6834", Cost: "#c78c2b",
};

const INSIGHT_ICON = { positive: CircleCheck, negative: TriangleAlert, warning: TriangleAlert, neutral: Lightbulb } as const;

export function ExecutiveOverview() {
  const { filters, setFilters, query } = useFilters();
  const options = useFilterOptions();
  const overview = useOverview(query);
  const catalogue = useCatalogue();
  const data = overview.data;
  const forbidden = overview.status === 403 || options.status === 403;

  const chartOrder = ["headcount", "movement", "attrition", "departments", "leaveHeatmap", "expenseMix", "funnel", "backlog", "payroll"];
  const charts = useMemo(() => (data ? chartOrder.map((key) => data.charts[key]).filter((chart): chart is Chart => Boolean(chart)) : []), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const chartLinks: Record<string, string> = { headcount: "headcount", movement: "headcount", attrition: "attrition", departments: "headcount", leaveHeatmap: "unplanned-leave", expenseMix: "expenses", funnel: "recruitment", backlog: "service-desk", payroll: "payroll-cost" };

  return (
    <div className="cw-page an-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero an-hero">
        <span className="cw-hero-icon"><ChartNoAxesCombined size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">WORKFORCE INTELLIGENCE</p>
          <h1>People analytics</h1>
          <p>Live metrics from every Northstar module — headcount, attrition, time, service, hiring and cost — with the story behind the numbers.</p>
        </div>
        {data && <span className="an-scope"><ShieldCheck size={15} /> {data.scope.label}</span>}
      </header>

      {forbidden ? <Forbidden message={overview.error || options.error} /> : (
        <>
          <FilterBar filters={filters} setFilters={setFilters} options={options.data} generatedAt={data?.generatedAt} cached={data?.cached}
            loading={overview.loading} onRefresh={overview.refresh} />
          {overview.error && <LoadError message={overview.error} onRetry={overview.refresh} />}

          {!data && overview.loading ? <><TilesSkeleton /><ChartsSkeleton /></> : data && (
            <div className={overview.loading ? "an-stale" : ""} aria-busy={overview.loading}>
              <p className="an-period">
                {periodText(data.filters.from, data.filters.to)}{data.filters.partialLastMonth ? " (month to date)" : ""}
                {data.filters.previous && <> · compared with {periodText(data.filters.previous.from, data.filters.previous.to)}</>}
                {data.filters.department && <> · {data.filters.department}</>}{data.filters.location && <> · {data.filters.location}</>}
              </p>
              <section className="an-tiles" aria-label="Key metrics">
                {data.tiles.map((tile) => <KpiTile key={tile.key} kpi={tile} href={`/reports/${tile.slug}${query ? `?${query}` : ""}`} />)}
              </section>
              {data.unavailable.length > 0 && <p className="cw-alert warn"><TriangleAlert size={15} /> Not available right now: {data.unavailable.join(", ")}. Other metrics are unaffected.</p>}

              <div className="an-overview-grid">
                <Insights items={data.insights} query={query} />
                {charts.slice(0, 1).map((chart) => <ChartCard key={chart.id} chart={chart} action={<OpenLink slug={chartLinks[chart.id]} query={query} />} />)}
              </div>
              <div className="an-grid">
                {charts.slice(1).map((chart) => <ChartCard key={chart.id} chart={chart} action={<OpenLink slug={chartLinks[chart.id]} query={query} />} />)}
              </div>
            </div>
          )}

          <Catalogue items={catalogue.data?.items || []} loading={catalogue.loading} query={query} />
        </>
      )}
    </div>
  );
}

const periodText = (from: string, to: string) => {
  const fmt = (month: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
};

function OpenLink({ slug, query }: { slug?: string; query: string }) {
  if (!slug) return null;
  return <Link className="cw-icon-button" href={`/reports/${slug}${query ? `?${query}` : ""}`} aria-label="Open full report" title="Open full report"><ArrowUpRight size={16} /></Link>;
}

function Insights({ items, query }: { items: Insight[]; query: string }) {
  return (
    <section className="an-card an-insights" aria-labelledby="an-insights-title">
      <header><div><h3 id="an-insights-title">Top insights</h3><p>Generated from this period's data</p></div><Lightbulb size={18} className="an-muted-icon" aria-hidden="true" /></header>
      {items.length === 0 ? <p className="an-chart-empty">Nothing stands out yet — insights appear as activity builds up.</p> : (
        <ul>
          {items.map((item) => {
            const Icon = INSIGHT_ICON[item.tone];
            return (
              <li key={item.title} className={`tone-${item.tone}`}>
                <Link href={`/reports/${item.slug}${query ? `?${query}` : ""}`}>
                  <span className="an-insight-icon"><Icon size={16} aria-hidden="true" /></span>
                  <span><b>{item.title}</b><small>{item.detail}</small></span>
                  <ArrowUpRight size={15} className="an-insight-go" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Catalogue({ items, loading, query, exclude }: { items: CatalogueItem[]; loading: boolean; query: string; exclude?: string }) {
  const groups = CATEGORY_ORDER.map((category) => ({ category, items: items.filter((item) => item.category === category && item.slug !== exclude) })).filter((group) => group.items.length);
  return (
    <section className="an-catalogue" aria-labelledby="an-catalogue-title">
      <div className="an-section-head"><h2 id="an-catalogue-title">{exclude ? "Related reports" : "Report library"}</h2>{!exclude && <p>{items.length} ready-made reports · each with charts, a CSV export and metric definitions</p>}</div>
      {loading && !items.length ? <div className="an-report-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="an-report-card skeleton" />)}</div> : groups.map((group) => (
        <div key={group.category} className="an-report-group">
          <h3 style={{ ["--cat" as string]: CATEGORY_ACCENT[group.category] }}><i />{group.category}</h3>
          <div className="an-report-grid">
            {group.items.map((item) => {
              const Icon = REPORT_ICONS[item.slug] || ChartNoAxesCombined;
              return (
                <Link key={item.slug} href={`/reports/${item.slug}${query ? `?${query}` : ""}`} className="an-report-card" style={{ ["--cat" as string]: CATEGORY_ACCENT[item.category] }}>
                  <span className="an-report-icon"><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="an-report-text"><b>{item.title}</b><small>{item.summary}</small></span>
                  {!item.ready && <span className="cw-badge tone-neutral"><i />Coming soon</span>}
                  <ArrowUpRight size={16} className="an-report-go" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
