"use client";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "./http-client";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";
export type FieldDef = {
  key: string; label: string; type: "text" | "textarea" | "number" | "money" | "date" | "time" | "select" | "employee" | "email";
  required?: boolean; options?: string[]; column?: string; placeholder?: string; help?: string; max?: number;
};
export type StatusDef = { key: string; label: string; tone: Tone; terminal?: boolean };
export type CaseModule = {
  key: string; label: string; singular: string; prefix: string; group: string; description: string;
  routing: "manager" | "hr" | "none"; visibility: "private" | "public"; publicStatuses?: string[]; createRoles?: string[];
  initial: string; statuses: StatusDef[]; fields: FieldDef[]; limits?: Record<string, number>;
  slaHours?: Record<string, number>;
};
export type CaseAction = { action: string; label: string; noteRequired: boolean; fields: FieldDef[]; intent: "primary" | "danger" | "neutral"; optional: boolean };
export type Person = { id: string; name: string; number?: string; department?: string; designation?: string };
export type CaseItem = {
  id: string; module: string; caseNumber: string; title: string; category: string | null;
  status: string; statusLabel: string; tone: Tone; terminal: boolean; priority: string;
  amount: number | null; currency: string; startDate: string | null; endDate: string | null; dueAt: string | null;
  details: Record<string, any>; version: number; createdAt: string; updatedAt: string; closedAt: string | null; overdue: boolean; slaStopped: boolean;
  requester: Person; subject: Person | null; approver: Person | null; assignee: Person | null;
  relation: "mine" | "about-me" | "other"; actions: CaseAction[];
};
export type CaseEvent = {
  id: string; kind: "CREATED" | "TRANSITION" | "COMMENT"; action: string | null; fromStatus: string | null; toStatus: string | null;
  note: string | null; data: Record<string, any>; createdAt: string; actorName: string; actorDesignation: string | null;
};
export type Viewer = { employeeId: string; roles: string[]; isHr: boolean };

let definitionCache: Promise<{ items: CaseModule[]; viewer: Viewer }> | null = null;
let cachedActor = "";

export function loadDefinitions() {
  const actor = identityKey();
  if (!definitionCache || cachedActor !== actor) {
    cachedActor = actor;
    definitionCache = httpRequest<{ items: CaseModule[]; viewer: Viewer }>("/api/v2/cases/modules").catch((error) => {
      definitionCache = null;
      throw error;
    });
  }
  return definitionCache;
}

export function useCaseModule(key: string) {
  const [state, setState] = useState<{ module?: CaseModule; viewer?: Viewer; error?: string }>({});
  useEffect(() => {
    loadDefinitions()
      .then(({ items, viewer }) => setState({ module: items.find((item) => item.key === key), viewer }))
      .catch((error) => setState({ error: error instanceof Error ? error.message : "Unable to load this module." }));
  }, [key]);
  return state;
}

export function useCases(module: string, scope: string, status = "", search = "") {
  const [data, setData] = useState<{ items: CaseItem[]; counts: { status: string; count: number; amount: number }[] }>({ items: [], counts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ module, scope });
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      setData(await httpRequest(`/api/v2/cases?${params}`));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }, [module, scope, status, search]);
  useEffect(() => { load(); }, [load]);
  return { ...data, loading, error, reload: load };
}

export const caseApi = {
  get: (id: string) => httpRequest<CaseItem & { events: CaseEvent[] }>(`/api/v2/cases/${id}`),
  create: (module: string, values: Record<string, unknown>) => httpRequest<CaseItem>("/api/v2/cases", { method: "POST", body: { module, values } }),
  transition: (id: string, body: { action: string; version: number; note?: string; values?: Record<string, unknown> }) =>
    httpRequest<CaseItem>(`/api/v2/cases/${id}/transitions`, { method: "POST", body }),
  comment: (id: string, note: string) => httpRequest(`/api/v2/cases/${id}/comments`, { method: "POST", body: { note } }),
  inbox: () => httpRequest<{ items: CaseItem[]; byModule: Record<string, number>; total: number }>("/api/v2/cases/inbox"),
  summary: () => httpRequest<{ mine: { module: string; open: number; total: number }[]; recognition: CaseItem[]; openings: CaseItem[] }>("/api/v2/cases/summary"),
};

// ---- demo identity switcher (local development only) -------------------------------------------
export type DemoActor = "employee" | "manager" | "hr" | "finance";
export const DEMO_ACTOR_KEY = "hrm.demo_actor";
/** Cache key for the identity the browser acts as (brand + person), so switching never shows stale data. */
function identityKey() {
  try { return `${window.localStorage.getItem("hrm.demo_identity") || currentActor()}|${window.localStorage.getItem("hrm.org_id") || ""}`; } catch { return currentActor(); }
}
export function currentActor(): DemoActor {
  if (typeof window === "undefined") return "employee";
  try {
    const value = window.localStorage.getItem(DEMO_ACTOR_KEY);
    return value === "manager" || value === "hr" || value === "finance" ? value : "employee";
  } catch {
    return "employee";
  }
}
export function setActor(actor: DemoActor) {
  try { window.localStorage.setItem(DEMO_ACTOR_KEY, actor); window.localStorage.removeItem("hrm.demo_identity"); } catch { /* storage unavailable */ }
  definitionCache = null;
}

// ---- formatting -----------------------------------------------------------------------------------
export const money = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const shortDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value)) : "—";
export function relativeTime(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return shortDate(value);
}
export function dueLabel(value: string | null, closed: boolean) {
  if (!value || closed) return "";
  const hours = (new Date(value).getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return `Overdue by ${Math.ceil(-hours) >= 24 ? `${Math.round(-hours / 24)} d` : `${Math.ceil(-hours)} h`}`;
  return `Due in ${hours >= 24 ? `${Math.round(hours / 24)} d` : `${Math.max(1, Math.round(hours))} h`}`;
}
export const initials = (name = "") => name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
