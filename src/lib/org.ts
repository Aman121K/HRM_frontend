"use client";
import { useEffect, useState } from "react";
import { brandUrl, hostBrand } from "./brand-host";
import { httpRequest } from "./http-client";

export type OrgSummary = {
  id: string; slug: string; displayName: string; shortName: string; legalName: string | null; brandColor: string; accentColor: string; logoDataUrl: string | null;
  industry: string | null; defaultState: string; timezone: string; employeePrefix: string; enabledModules: string[]; status: string; groupId: string | null; version: number;
  role?: string; employeeNumber?: string | null; fullName?: string | null; designation?: string | null; groupName?: string | null;
};
export type MyOrgs = { currentOrganizationId: string; organizations: OrgSummary[]; groups: { id: string; name: string; slug: string; role: string }[]; isPlatformAdmin: boolean };

export const ORG_SLUG_KEY = "hrm.org_slug";
export const ORG_ID_KEY = "hrm.org_id";
export const DEMO_IDENTITY_KEY = "hrm.demo_identity";

const read = (key: string) => { try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => { try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } };

/** The organization the browser is working in: slug for demo identities, id for SSO sessions. */
export const activeOrgSlug = () => read(ORG_SLUG_KEY);
export const activeOrgId = () => read(ORG_ID_KEY);
export function demoIdentity(): { slug: string; employeeNumber: string } | null {
  try { return JSON.parse(read(DEMO_IDENTITY_KEY) || "null"); } catch { return null; }
}
export function setDemoIdentity(slug: string, employeeNumber: string) {
  write(DEMO_IDENTITY_KEY, JSON.stringify({ slug, employeeNumber }));
  write(ORG_SLUG_KEY, slug);
}

/** Switch brand. In demo mode the same person's employee number in the target brand is used. Reloads so every cache resets. */
export function switchOrganization(org: OrgSummary) {
  // Each brand has its own address; sessions are per address, so switching means signing in on that brand's page.
  const current = hostBrand();
  if (current && current !== org.slug) { window.location.assign(brandUrl(org.slug)); return; }
  write(ORG_ID_KEY, org.id);
  write(ORG_SLUG_KEY, org.slug);
  if (org.employeeNumber) write(DEMO_IDENTITY_KEY, JSON.stringify({ slug: org.slug, employeeNumber: org.employeeNumber }));
  window.location.assign("/");
}

let mineCache: Promise<MyOrgs> | null = null;
export function loadMyOrgs() {
  mineCache ||= httpRequest<MyOrgs>("/api/v2/orgs/mine").catch((error) => { mineCache = null; throw error; });
  return mineCache;
}

/** Current organization (branding, enabled modules) plus the person's other organizations. */
export function useOrgs() {
  const [state, setState] = useState<{ mine?: MyOrgs; current?: OrgSummary }>({});
  useEffect(() => {
    loadMyOrgs().then((mine) => {
      const current = mine.organizations.find((org) => org.id === mine.currentOrganizationId);
      if (current) { write(ORG_ID_KEY, current.id); write(ORG_SLUG_KEY, current.slug); applyBranding(current); }
      setState({ mine, current });
    }).catch(() => setState({}));
  }, []);
  return state;
}

/** Brand colours as CSS variables so shells and pages can pick them up. */
export function applyBranding(org: Pick<OrgSummary, "brandColor" | "accentColor" | "shortName">) {
  const root = document.documentElement;
  root.style.setProperty("--org-brand", org.brandColor);
  root.style.setProperty("--org-accent", org.accentColor);
  if (!document.title.includes(org.shortName)) document.title = `${org.shortName} · Northstar People`;
}

export const orgInitials = (name: string) => name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
