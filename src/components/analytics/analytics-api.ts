"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError, downloadFile, httpRequest } from "@/lib/http-client";

// ---- types mirrored from backend/src/platform/analytics/analytics.types.ts --------------------------
export type Format = "number" | "percent" | "money" | "days" | "hours" | "months" | "decimal" | "text" | "month";
export type Series = { name: string; values: (number | null)[] };
type ChartBase = { id: string; title: string; subtitle?: string; format: Format; note?: string; wide?: boolean };
export type Chart = ChartBase & (
  | { type: "line" | "bar"; categories: string[]; series: Series[]; stacked?: boolean; horizontal?: boolean }
  | { type: "donut"; slices: { label: string; value: number }[] }
  | { type: "funnel"; steps: { label: string; value: number }[] }
  | { type: "heatmap"; rows: string[]; cols: string[]; values: (number | null)[][] }
  | { type: "empty"; message: string }
);
export type Kpi = {
  key: string; label: string; value: number | null; format: Format; note?: string; text?: string;
  previous?: number | null; delta?: number | null; deltaUnit?: "%" | "pts"; goodWhen?: "up" | "down" | "neutral";
  spark?: (number | null)[]; slug?: string;
};
export type Column = { key: string; label: string; format: Format; align?: "left" | "right" };
export type Definition = { term: string; text: string };
export type ReportCategory = "Workforce" | "Time & leave" | "Service delivery" | "Talent" | "Cost" | "Engagement";
export type ReportMeta = { slug: string; title: string; category: ReportCategory; summary: string; definitions: Definition[]; requires?: string[] };
export type CatalogueItem = ReportMeta & { scope: string; ready: boolean };
export type ScopeInfo = { kind: "org" | "team"; label: string };
export type AppliedFilters = { from: string; to: string; department: string | null; location: string | null; partialLastMonth: boolean; previous?: { from: string; to: string } };
export type Report = {
  meta: ReportMeta; scope: ScopeInfo; filters: AppliedFilters; generatedAt: string; cached: boolean;
  available: boolean; unavailable?: string; kpis: Kpi[]; charts: Chart[];
  table: { title: string; columns: Column[]; rows: Record<string, unknown>[]; note?: string };
  footnotes: string[]; suppressedGroups?: number; source?: string;
};
export type Insight = { tone: "positive" | "negative" | "warning" | "neutral"; title: string; detail: string; slug: string };
export type Overview = {
  tiles: (Kpi & { slug: string })[]; charts: Record<string, Chart | null>; insights: Insight[]; unavailable: string[];
  scope: ScopeInfo; audience: { people: boolean; finance: boolean; hr: boolean }; filters: AppliedFilters; generatedAt: string; cached: boolean;
};
export type FilterOptions = {
  departments: { value: string; people: number }[]; locations: { value: string; people: number }[];
  defaultRange: { from: string; to: string }; currentMonth: string; earliestMonth: string; scope: ScopeInfo; maxMonths: number;
};
export type Filters = { from?: string; to?: string; department?: string; location?: string };

// ---- formatting ----------------------------------------------------------------------------------
const nf = (digits = 1) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits });
export function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${nf(abs >= 1e8 ? 0 : 1).format(value / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${nf(abs >= 1e6 ? 0 : 1).format(value / 1e5)}L`;
  if (abs >= 1e3) return `₹${nf(abs >= 1e4 ? 0 : 1).format(value / 1e3)}k`;
  return `₹${nf(0).format(value)}`;
}
export const monthLabel = (month: string, long = false) =>
  /^\d{4}-\d{2}$/.test(month) ? new Intl.DateTimeFormat("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)) : month;

/** Format a metric value. `compact` is for axes, tiles and tooltips; tables use full precision. */
export function formatValue(value: unknown, format: Format, compact = false): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "text") return String(value);
  if (format === "month") return monthLabel(String(value));
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (format) {
    case "percent": return `${nf(1).format(n)}%`;
    case "money": return compact ? compactMoney(n) : `₹${nf(0).format(n)}`;
    case "days": return `${nf(1).format(n)} d`;
    case "hours": return n >= 48 && compact ? `${nf(1).format(n / 24)} d` : `${nf(1).format(n)} h`;
    case "months": return n >= 24 && compact ? `${nf(1).format(n / 12)} yrs` : `${nf(1).format(n)} mo`;
    case "decimal": return nf(1).format(n);
    default: return compact && Math.abs(n) >= 1e5 ? nf(1).format(n / 1e5) + "L" : nf(1).format(n);
  }
}
export function relativeFromNow(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export const absoluteTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

// ---- months --------------------------------------------------------------------------------------
export const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
export const addMonths = (month: string, delta: number) => { const index = monthIndex(month) + delta; return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`; };
export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let index = monthIndex(from); index <= monthIndex(to); index += 1) out.push(addMonths(from, index - monthIndex(from)));
  return out;
}

// ---- URL-backed filters ----------------------------------------------------------------------------
export function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters: Filters = useMemo(() => ({
    from: params.get("from") || undefined, to: params.get("to") || undefined,
    department: params.get("department") || undefined, location: params.get("location") || undefined,
  }), [params]);
  const setFilters = useCallback((next: Filters) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) search.set(key, value);
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);
  return { filters, setFilters, query: filterQuery(filters) };
}
export function filterQuery(filters: Filters, extra: Record<string, string> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) if (value) search.set(key, value);
  return search.toString();
}

// ---- data hooks ----------------------------------------------------------------------------------
export type LoadState<T> = { data: T | null; loading: boolean; error: string; status: number; refresh: () => void };

function useResource<T>(path: string | null): LoadState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string; status: number }>({ data: null, loading: true, error: "", status: 0 });
  const force = useRef(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    const url = force.current ? `${path}${path.includes("?") ? "&" : "?"}refresh=1` : path;
    force.current = false;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    httpRequest<T>(url)
      .then((data) => { if (live) setState({ data, loading: false, error: "", status: 200 }); })
      .catch((error) => {
        if (!live) return;
        const status = error instanceof ApiRequestError ? error.status : 0;
        const message = error instanceof Error ? error.message : "Unable to load analytics.";
        setState((previous) => ({ data: status === 400 ? previous.data : null, loading: false, error: status === 0 ? `${message} Make sure the platform API is running.` : message, status }));
      });
    return () => { live = false; };
  }, [path, tick]);
  const refresh = useCallback(() => { force.current = true; setTick((value) => value + 1); }, []);
  return { ...state, refresh };
}

export const useFilterOptions = () => useResource<FilterOptions>("/api/v2/analytics/filters");
export const useCatalogue = () => useResource<{ items: CatalogueItem[] }>("/api/v2/analytics/reports");
export const useOverview = (query: string) => useResource<Overview>(`/api/v2/analytics/overview${query ? `?${query}` : ""}`);
export const useReport = (slug: string, query: string) => useResource<Report>(`/api/v2/analytics/reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`);
export const exportReport = (slug: string, query: string) => downloadFile(`/api/v2/analytics/reports/${encodeURIComponent(slug)}/export${query ? `?${query}` : ""}`, `${slug}.csv`);
