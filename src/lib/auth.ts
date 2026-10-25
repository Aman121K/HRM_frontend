"use client";
// OpenID Connect Authorization Code flow with PKCE for a public browser client.
// Tokens are kept in sessionStorage (cleared when the tab closes) — never localStorage — and sent as Bearer tokens.
import { platformApiUrl } from "./api";
import { hostBrand, mainUrl } from "./brand-host";
import { safeReturnPath } from "./safe-return";

export type AuthConfig = { oidc: { issuer: string; clientId: string; scope: string; audience: string } | null; demoIdentity: boolean };
type Discovery = { authorization_endpoint: string; token_endpoint: string; end_session_endpoint?: string; issuer: string };

const TOKEN_KEY = "hrm.access_token";
const ID_TOKEN_KEY = "hrm.id_token";
const FLOW_KEY = "hrm.oidc_flow";
/** "native" when the session came from Northstar's own password sign-in (refresh cookie), "oidc" for company SSO. */
const AUTH_KIND_KEY = "hrm.auth_kind";
let configPromise: Promise<AuthConfig> | null = null;

export function authConfig() {
  configPromise ||= fetch(platformApiUrl("/api/v2/auth/config")).then((response) => {
    if (!response.ok) throw new Error("Sign-in service is unavailable.");
    return response.json() as Promise<AuthConfig>;
  }).catch((error) => { configPromise = null; throw error; });
  return configPromise;
}

async function discovery(issuer: string): Promise<Discovery> {
  const response = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!response.ok) throw new Error("Could not reach your organization's identity provider.");
  const doc = await response.json() as Discovery;
  if (doc.issuer.replace(/\/$/, "") !== issuer.replace(/\/$/, "")) throw new Error("Identity provider issuer mismatch.");
  return doc;
}

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (length = 32) => base64url(crypto.getRandomValues(new Uint8Array(length)));

export async function beginSignIn(returnTo = "/") {
  const config = await authConfig();
  if (!config.oidc) throw new Error("Single sign-on is not configured for this workspace.");
  const doc = await discovery(config.oidc.issuer);
  const verifier = random(48), state = random(), nonce = random();
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const safeReturn = safeReturnPath(returnTo, "/");
  sessionStorage.setItem(FLOW_KEY, JSON.stringify({ verifier, state, nonce, returnTo: safeReturn, startedAt: Date.now() }));
  const url = new URL(doc.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code", client_id: config.oidc.clientId, redirect_uri: `${window.location.origin}/auth/callback`,
    scope: config.oidc.scope, state, nonce, code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  window.location.assign(url.toString());
}

/** Completes the redirect: validates state, exchanges the code with the PKCE verifier and checks the ID token nonce. */
export async function completeSignIn(search: URLSearchParams) {
  const flow = JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null") as { verifier: string; state: string; nonce: string; returnTo: string; startedAt: number } | null;
  sessionStorage.removeItem(FLOW_KEY);
  if (search.get("error")) throw new Error(search.get("error_description") || "Sign-in was cancelled.");
  if (!flow || flow.state !== search.get("state") || Date.now() - flow.startedAt > 10 * 60_000) throw new Error("This sign-in link has expired. Please try again.");
  const config = await authConfig();
  if (!config.oidc) throw new Error("Single sign-on is not configured.");
  const doc = await discovery(config.oidc.issuer);
  const response = await fetch(doc.token_endpoint, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: search.get("code") || "", redirect_uri: `${window.location.origin}/auth/callback`, client_id: config.oidc.clientId, code_verifier: flow.verifier }),
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || "The identity provider rejected the sign-in.");
  // The API verifies the access token signature; here we only bind the ID token to this browser flow.
  const idClaims = tokens.id_token ? decodeJwt(tokens.id_token) : null;
  if (idClaims && idClaims.nonce !== flow.nonce) throw new Error("Sign-in response did not match this browser session.");
  sessionStorage.setItem(TOKEN_KEY, tokens.access_token);
  if (tokens.id_token) sessionStorage.setItem(ID_TOKEN_KEY, tokens.id_token);
  return safeReturnPath(flow.returnTo, "/");
}

export function decodeJwt(token: string): Record<string, any> | null {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
}

export function hasSession() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = token ? decodeJwt(token)?.exp : 0;
    return !!token && (!exp || exp * 1000 > Date.now() + 15_000);
  } catch { return false; }
}

export function clearSession() {
  try { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(ID_TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(AUTH_KIND_KEY); } catch { /* ignore */ }
}

// ---- first-party (password + MFA) sign-in ------------------------------------------------------------------------------

export type NativeStatus = "OK" | "MFA_REQUIRED" | "MFA_ENROLL_REQUIRED" | "MFA_ENROLL_OPTIONAL";
export type NativeResult = {
  status: NativeStatus; challenge?: string; methods?: ("totp" | "recovery" | "email")[]; email?: string; expiresIn?: number;
  accessToken?: string; organization?: { id: string; slug: string; name: string } | null; platform?: boolean;
  user?: { id: string; email: string; fullName: string }; recoveryCodes?: string[];
};
export class AuthError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } }

/** POST to the auth API. credentials: "include" so the HttpOnly refresh cookie is set/sent; JS never sees it. */
export async function authPost<T>(path: string, body: unknown = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(platformApiUrl(path), { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
    throw new AuthError(message || "Something went wrong. Please try again.", response.status, payload.code);
  }
  return payload as T;
}

export const nativeAuth = {
  login: (email: string, password: string, brand?: string) => authPost<NativeResult>("/api/v2/auth/login", { email, password, ...(brand ? { brand } : {}) }),
  verify: (challenge: string, method: "totp" | "recovery" | "email", code: string) => authPost<NativeResult>("/api/v2/auth/login/mfa", { challenge, method, code }),
  sendEmailCode: (challenge: string) => authPost<{ sent: boolean; email: string }>("/api/v2/auth/login/mfa/email", { challenge }),
  enrollStart: (challenge: string) => authPost<{ secret: string; otpauthUrl: string; account: string }>("/api/v2/auth/login/mfa/enroll/start", { challenge }),
  enrollConfirm: (challenge: string, code: string) => authPost<NativeResult>("/api/v2/auth/login/mfa/enroll/confirm", { challenge, code }),
  enrollSkip: (challenge: string) => authPost<NativeResult>("/api/v2/auth/login/mfa/enroll/skip", { challenge }),
  inspectInvite: (token: string) => authPost<{ email: string; fullName: string; workspace: { slug: string; name: string } }>("/api/v2/auth/invites/inspect", { token }),
  activate: (token: string, password: string) => authPost<NativeResult>("/api/v2/auth/activate", { token, password }),
  forgot: (email: string, brand?: string) => authPost<{ message: string }>("/api/v2/auth/password/forgot", { email, ...(brand ? { brand } : {}) }),
  reset: (token: string, password: string) => authPost<{ reset: boolean }>("/api/v2/auth/password/reset", { token, password }),
  unlock: (token: string) => authPost<{ unlocked: boolean }>("/api/v2/auth/unlock", { token }),
};

/** Keeps the access token (sessionStorage, as for SSO) and selects the brand the person signed into. */
export function storeNativeSession(result: NativeResult) {
  if (!result.accessToken) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(AUTH_KIND_KEY, "native");
    localStorage.removeItem("hrm.demo_identity");
    if (result.platform) localStorage.setItem("hrm.org_id", "platform");
    else if (result.organization) {
      localStorage.setItem("hrm.org_id", result.organization.id);
      localStorage.setItem("hrm.org_slug", result.organization.slug);
      localStorage.setItem("hrm.last_brand", result.organization.slug);
    }
  } catch { /* storage unavailable */ }
}

const isNativeSession = () => { try { return localStorage.getItem(AUTH_KIND_KEY) === "native"; } catch { return false; } };

let refreshing: Promise<boolean> | null = null;
/**
 * Exchanges the HttpOnly refresh cookie for a new access token (the cookie rotates on every use). One refresh at a time
 * per tab; concurrent callers share it. Resolves false when there is no valid session.
 */
export function refreshSession(): Promise<boolean> {
  if (typeof window === "undefined" || !isNativeSession()) return Promise.resolve(false);
  refreshing ||= (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await authPost<NativeResult>("/api/v2/auth/session/refresh");
        if (!result.accessToken) return false;
        sessionStorage.setItem(TOKEN_KEY, result.accessToken);
        return true;
      } catch (error) {
        // Another tab refreshed at the same instant: its new cookie is already in the jar, so try once more.
        if (error instanceof AuthError && error.code === "REFRESH_RACE" && attempt === 0) { await new Promise((r) => setTimeout(r, 400)); continue; }
        if (error instanceof AuthError && error.status === 401) { try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(AUTH_KIND_KEY); } catch { /* ignore */ } }
        return false;
      }
    }
    return false;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function signOut() {
  const idToken = sessionStorage.getItem(ID_TOKEN_KEY);
  const destination = signInPath();
  if (isNativeSession()) {
    // Revokes this device's refresh family on the server and clears the cookie.
    await authPost("/api/v2/auth/session/logout", {}, sessionStorage.getItem(TOKEN_KEY)).catch(() => undefined);
    clearSession();
    try { window.localStorage.removeItem("hrm.demo_identity"); } catch { /* ignore */ }
    window.location.assign(destination);
    return;
  }
  clearSession();
  try { window.localStorage.removeItem("hrm.demo_identity"); } catch { /* ignore */ }
  const config = await authConfig().catch(() => null);
  if (config?.oidc) {
    const doc = await discovery(config.oidc.issuer).catch(() => null);
    if (doc?.end_session_endpoint) {
      const url = new URL(doc.end_session_endpoint);
      url.search = new URLSearchParams({ post_logout_redirect_uri: `${window.location.origin}/login`, ...(idToken ? { id_token_hint: idToken } : {}) }).toString();
      // The IdP returns to /login, which offers "Continue to <last brand>".
      window.location.assign(url.toString());
      return;
    }
  }
  window.location.assign(destination);
}

/** Redirects to /login when SSO is required and there is no valid session. Returns true when the page may render. */
/** Platform (super admin) sessions have no brand, so they always live in the /admin console. */
export function isPlatformSession() {
  try {
    const demo = JSON.parse(window.localStorage.getItem("hrm.demo_identity") || "null");
    return demo?.slug === "platform" || window.localStorage.getItem("hrm.org_id") === "platform";
  } catch { return false; }
}

/** Where a signed-out person should land: their brand's own sign-in page when known. */
export function signInPath() {
  try {
    // On a brand subdomain /login is that brand's own page.
    if (hostBrand()) return "/login";
    if (isPlatformSession()) return "/admin/login";
    const brand = window.localStorage.getItem("hrm.last_brand") || window.localStorage.getItem("hrm.org_slug");
    return brand ? `/b/${brand}` : "/login";
  } catch { return "/login"; }
}

export async function ensureSession() {
  if (isPlatformSession() && !window.location.pathname.startsWith("/admin")) { window.location.replace(mainUrl("/admin")); return false; }
  if (hasSession()) return true;
  if (await refreshSession()) return true;
  const config = await authConfig().catch(() => null);
  if (!config || config.demoIdentity) return true;
  window.location.replace(`${signInPath()}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  return false;
}
