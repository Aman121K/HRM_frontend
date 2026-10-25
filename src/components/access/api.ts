import { ApiRequestError, downloadFile, httpRequest } from "@/lib/http-client";

export type Scope = "OWN" | "DIRECT_REPORTS" | "ALL_REPORTS" | "DEPARTMENT" | "LOCATION" | "ORGANIZATION";
export type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Grant = { key: string; scope: Scope };
export type PermissionDef = { key: string; label: string; description: string; risk: Risk; scopable: boolean; enforcedAt?: string[]; confirm: boolean; routes: number };
export type PermissionGroup = { key: string; label: string; description: string; permissions: PermissionDef[] };
export type SodRule = { id: string; permissions: [string, string]; message: string };
export type Catalogue = { groups: PermissionGroup[]; scopes: { key: Scope; label: string }[]; baseRoles: string[]; sodRules: SodRule[] };
export type ScopeInfo = { scope: Scope; departments?: string[]; locations?: string[] };
export type RiskSummary = { riskCounts: Record<Risk, number>; highestRisk: Risk; sod: SodRule[] };

export type SystemRole = RiskSummary & { id: string; type: "SYSTEM"; baseRole: string; name: string; description: string; grants: Grant[]; note?: string; holders: number };
export type CustomRole = RiskSummary & {
  id: string; type: "CUSTOM"; name: string; description: string; grants: Grant[]; basedOn: string | null; status: "ACTIVE" | "ARCHIVED"; version: number;
  createdAt: string; updatedAt: string; updatedBy: string | null; holders?: number; temporary?: number;
};
export type RoleHistory = {
  id: string; action: string; actor: string | null; at: string; reason: string | null; version: number | null; status: string | null;
  diff: { added: Grant[]; removed: Grant[]; changed: { key: string; from: Scope; to: Scope }[] };
  renamed: { from: string; to: string } | null; descriptionChanged: boolean;
};
export type RoleAssignment = {
  id: string; expiresAt: string | null; startsAt: string; department: string | null; location: string | null; reason: string | null; createdAt: string;
  employeeId: string; name: string; number: string; designation: string | null; employeeDepartment: string | null; grantedBy: string | null; expired: boolean;
};
export type RoleDetail = CustomRole & { assignments: RoleAssignment[]; history: RoleHistory[] };

export type PersonRow = {
  id: string; name: string; number: string; email: string | null; designation: string | null; department: string | null; location: string | null;
  managerId: string | null; userId: string | null; baseRole: string | null; hasLogin: boolean; isSelf: boolean; elevated: boolean;
  customRoles: { assignmentId: string; roleId: string; name: string; expiresAt: string | null; department: string | null; location: string | null }[];
};
export type Source =
  | { type: "BASE"; role: string; roleName: string; scope: Scope }
  | { type: "CUSTOM"; roleId: string; roleName: string; assignmentId: string; expiresAt: string | null; department: string | null; location: string | null; scope: Scope };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EffectiveGroup = { key: string; label: string; permissions: { key: string; label: string; risk: Risk; scopable: boolean; scope: ScopeInfo; sources: Source[] }[] };
export type PersonDetail = {
  person: PersonRow;
  baseRole: { id: string; name: string; description: string; grants: Grant[] } | null;
  assignments: { assignmentId: string; roleId: string; name: string; expiresAt: string | null; startsAt: string; department: string | null; location: string | null; reason: string | null; grantedBy: string | null; createdAt: string; permissions: Grant[] }[];
  history: { id: string; role: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; revokeReason: string | null; reason: string | null; grantedBy: string | null; revokedBy: string | null }[];
  effective: EffectiveGroup[];
  sod: SodRule[];
};
export type AssignImpact = { gained: Grant[]; critical: Grant[]; confirmationRequired: boolean; sod: SodRule[]; newSod: SodRule[]; hasLogin: boolean };
export type WhoCan = {
  permission: PermissionDef & { group?: string };
  items: { person: { id: string; name: string; number: string; designation: string | null; department: string | null; location: string | null; baseRole: string | null; hasLogin: boolean }; scope: ScopeInfo; sources: (Grant & { source: DistributiveOmit<Source, "scope"> })[] }[];
};
export type AuditItem = {
  id: string; action: string; entityType: string; entityId: string; createdAt: string; actorUserId: string; actorName: string | null; actorNumber: string | null;
  actorDesignation: string | null; hasBefore: boolean; hasAfter: boolean; summary: string;
};
export type AuditPage = { items: AuditItem[]; total: number; page: number; pageSize: number; pages: number };
export type AuditEntry = Omit<AuditItem, "hasBefore" | "hasAfter" | "summary" | "actorUserId"> & { before: unknown; after: unknown };
export type AuditFacets = {
  actions: { key: string; count: number }[]; entityTypes: { key: string; count: number }[];
  actors: { id: string; name: string; number: string | null; count: number }[]; counts: { day: number; week: number; total: number };
};
export type Me = {
  employeeId: string; roles: string[]; permissions: string[]; scopes: Record<string, ScopeInfo>;
  customRoles: { roleId: string; roleName: string; expiresAt: string | null }[];
  can: { manageAccess: boolean; viewAudit: boolean; reviewAccess: boolean; settingsHub: boolean };
};
export type OrgProfile = {
  profile: { id: string; name: string; slug: string; createdAt: string };
  people: { active: number; total: number; withLogin: number };
  departments: { name: string; n: number }[]; locations: { name: string; n: number }[];
  baseRoles: Record<string, number>; customRoles: number; grants: { live: number; temporary: number; expiringSoon: number }; auditLast24h: number;
  sites: { active: number; total: number };
};
export type Confirmable = { confirm?: boolean; reason?: string };

const q = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

const base = "/api/v2/access";
export const accessApi = {
  me: () => httpRequest<Me>(`${base}/me`),
  organization: () => httpRequest<OrgProfile>(`${base}/organization`),
  catalogue: () => httpRequest<Catalogue>(`${base}/catalogue`),
  roles: () => httpRequest<{ system: SystemRole[]; custom: CustomRole[] }>(`${base}/roles`),
  role: (id: string) => httpRequest<RoleDetail>(`${base}/roles/${id}`),
  createRole: (body: { name: string; description?: string; permissions: Grant[]; basedOn?: string } & Confirmable) => httpRequest<CustomRole>(`${base}/roles`, { method: "POST", body }),
  updateRole: (id: string, body: { version: number; name?: string; description?: string; permissions?: Grant[] } & Confirmable) => httpRequest<CustomRole>(`${base}/roles/${id}`, { method: "PATCH", body }),
  roleStatus: (id: string, body: { version: number; status: "ACTIVE" | "ARCHIVED" } & Confirmable) => httpRequest<CustomRole>(`${base}/roles/${id}/status`, { method: "POST", body }),
  people: (params: { search?: string; roleId?: string; baseRole?: string; filter?: string; limit?: number } = {}) =>
    httpRequest<{ items: PersonRow[]; total: number; departments: string[]; locations: string[] }>(`${base}/people${q(params)}`),
  person: (id: string) => httpRequest<PersonDetail>(`${base}/people/${id}`),
  baseRole: (id: string, body: { role: string; expectedRole: string } & Confirmable) => httpRequest<{ changed: boolean; role: string }>(`${base}/people/${id}/base-role`, { method: "PATCH", body }),
  assign: (body: { employeeId: string; roleId: string; expiresAt?: string; department?: string; location?: string; dryRun?: boolean } & Confirmable) =>
    httpRequest<AssignImpact & { id?: string; dryRun?: boolean }>(`${base}/assignments`, { method: "POST", body }),
  revoke: (id: string, reason: string) => httpRequest<{ revoked: boolean }>(`${base}/assignments/${id}/revoke`, { method: "POST", body: { reason } }),
  whoCan: (key: string) => httpRequest<WhoCan>(`${base}/review/permissions/${encodeURIComponent(key)}`),
  exportReview: (permission?: string) => downloadFile(`${base}/review/export.csv${q({ permission })}`, permission ? `access-${permission}.csv` : "access-review.csv"),
  audit: (params: Record<string, string | number | undefined>) => httpRequest<AuditPage>(`${base}/audit${q(params)}`),
  auditFacets: () => httpRequest<AuditFacets>(`${base}/audit/facets`),
  auditEntry: (id: string) => httpRequest<AuditEntry>(`${base}/audit/${id}`),
  exportAudit: (params: Record<string, string | number | undefined>) => downloadFile(`${base}/audit/export.csv${q(params)}`, "audit-log.csv"),
};

export const errorText = (reason: unknown, fallback: string) => (reason instanceof ApiRequestError || reason instanceof Error ? reason.message || fallback : fallback);
export const isForbidden = (reason: unknown) => reason instanceof ApiRequestError && reason.status === 403;
export const isConflict = (reason: unknown) => reason instanceof ApiRequestError && reason.status === 409;

export const RISK_TONE: Record<Risk, string> = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" };
export const RISK_LABEL: Record<Risk, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
export const SCOPE_SHORT: Record<Scope, string> = {
  OWN: "Own", DIRECT_REPORTS: "Direct reports", ALL_REPORTS: "All reports", DEPARTMENT: "Department", LOCATION: "Location", ORGANIZATION: "Organization",
};
export const BASE_ROLE_LABEL: Record<string, string> = { OWNER: "Owner", HR_ADMIN: "HR administrator", PAYROLL_ADMIN: "Payroll administrator", MANAGER: "People manager", EMPLOYEE: "Employee" };
export const SCOPES: Scope[] = ["OWN", "DIRECT_REPORTS", "ALL_REPORTS", "DEPARTMENT", "LOCATION", "ORGANIZATION"];
export const scopeRank = (scope: Scope) => SCOPES.indexOf(scope);

export function indexCatalogue(catalogue: Catalogue) {
  const map = new Map<string, PermissionDef & { group: string }>();
  for (const group of catalogue.groups) for (const permission of group.permissions) map.set(permission.key, { ...permission, group: group.label });
  return map;
}
export function sodFor(rules: SodRule[], keys: Iterable<string>) {
  const set = new Set(keys);
  return rules.filter((rule) => rule.permissions.every((key) => set.has(key)));
}
export const dateLabel = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const dateTimeLabel = (value: string) =>
  new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const humanAction = (action: string) => action.replace(/[._]/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
