// Brand subdomains: <slug>.<APP_DOMAIN> serves one brand (got-tea.localhost:3000 locally, got-tea.people.example.com live).
// Keep RESERVED in sync with backend/src/platform/organizations/brand-host.ts.
export const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost").toLowerCase();
const RESERVED = new Set([
  "www", "app", "api", "admin", "auth", "login", "sso", "idp", "mail", "smtp", "static", "cdn", "assets", "files", "status",
  "platform", "help", "support", "docs", "dev", "staging", "test", "demo", "northstar", "b", "m", "mobile", "ws",
]);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Brand slug for a hostname (port allowed), or null on the main domain. */
export function brandFromHostname(host: string | null | undefined): string | null {
  const name = (host || "").split(":")[0].toLowerCase();
  const suffix = `.${APP_DOMAIN}`;
  if (!name.endsWith(suffix)) return null;
  const sub = name.slice(0, -suffix.length);
  return SLUG.test(sub) && !RESERVED.has(sub) ? sub : null;
}

/** In the browser: the brand this page's address belongs to. */
export const hostBrand = () => (typeof window === "undefined" ? null : brandFromHostname(window.location.hostname));

/** True when the site is reached through APP_DOMAIN (so brand subdomains work), not e.g. 127.0.0.1 or a LAN IP. */
const onAppDomain = () => {
  const name = window.location.hostname.toLowerCase();
  return name === APP_DOMAIN || name.endsWith(`.${APP_DOMAIN}`);
};

/** Full address of a brand's own sign-in page: https://got-tea.<domain>/login, falling back to /b/<slug>. */
export function brandUrl(slug: string, path = "/login") {
  if (typeof window === "undefined" || !onAppDomain()) return `/b/${slug}${path === "/login" ? "" : path}`;
  const { protocol, port } = window.location;
  return `${protocol}//${slug}.${APP_DOMAIN}${port ? `:${port}` : ""}${path}`;
}

/** The main (brandless) domain, used for the workspace finder and the super admin console. */
export function mainUrl(path = "/") {
  if (typeof window === "undefined" || !onAppDomain()) return path;
  const { protocol, port } = window.location;
  return `${protocol}//${APP_DOMAIN}${port ? `:${port}` : ""}${path}`;
}
