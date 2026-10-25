import { platformApiUrl } from "./api";
import { tenant } from "./tenant";

type DemoActor = "employee" | "manager" | "hr" | "finance";
type RequestOptions = Omit<RequestInit, "body"> & { actor?: DemoActor; body?: unknown };

const demoEmployees: Record<DemoActor, string> = {
  employee: process.env.NEXT_PUBLIC_DEMO_EMPLOYEE_ID || "BT002",
  manager: process.env.NEXT_PUBLIC_DEMO_MANAGER_ID || "BT001",
  hr: process.env.NEXT_PUBLIC_DEMO_HR_ID || "BT000",
  finance: process.env.NEXT_PUBLIC_DEMO_FINANCE_ID || "BT009",
};

// Local demo only: the header role switcher stores which seeded identity requests act as.
function storedActor(): DemoActor {
  if (typeof window === "undefined") return "employee";
  try {
    const value = window.localStorage.getItem("hrm.demo_actor");
    return value === "manager" || value === "hr" || value === "finance" ? value : "employee";
  } catch {
    return "employee";
  }
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) { super(message); }
}

/** Identity headers for API calls: the signed-in bearer token, or the local demo identity when enabled. */
export function authHeaders(actor?: DemoActor, supplied?: HeadersInit) {
  const headers = new Headers(supplied);
  const token = accessToken();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
    // People with several brands choose one; the API verifies the membership.
    const orgId = stored("hrm.org_id");
    if (orgId) headers.set("x-organization-id", orgId);
  } else if (process.env.NEXT_PUBLIC_ALLOW_DEMO_IDENTITY === "true") {
    const demo = demoIdentity();
    if (demo && !actor) {
      headers.set("x-tenant-id", demo.slug);
      headers.set("x-employee-id", demo.employeeNumber);
    } else {
      headers.set("x-tenant-id", tenant.id);
      headers.set("x-employee-id", demoEmployees[actor || storedActor()]);
    }
  }
  return headers;
}

function stored(key: string) {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

/** Local demo only: the brand + seeded employee the browser acts as (set from the sign-in page or sidebar). */
function demoIdentity(): { slug: string; employeeNumber: string } | null {
  try { return JSON.parse(stored("hrm.demo_identity") || "null"); } catch { return null; }
}

function accessToken() {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem("hrm.access_token") || window.localStorage.getItem("hrm.access_token"); } catch { return null; }
}

/** Fetch a binary download (payslip PDF, attachment) with identity headers. */
export async function downloadFile(path: string, fallbackName = "download") {
  const response = await fetch(platformApiUrl(path), { headers: authHeaders() });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiRequestError(payload.message || "Download failed.", response.status, payload);
  }
  const disposition = response.headers.get("content-disposition") || "";
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1] || /filename="?([^";]+)/.exec(disposition)?.[1] || fallbackName);
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function httpRequest<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { actor, body, headers: suppliedHeaders, ...init } = options;
  const headers = authHeaders(actor, suppliedHeaders);
  if (body !== undefined && !(body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(platformApiUrl(path), {
    ...init, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  // Expired access token from a password sign-in: refresh once through the HttpOnly cookie, then retry the request.
  if (response.status === 401 && headers.has("authorization") && !retried && typeof window !== "undefined") {
    const { refreshSession } = await import("./auth");
    if (await refreshSession()) return httpRequest<T>(path, options, true);
  }
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (response.status === 401 && headers.has("authorization") && typeof window !== "undefined") {
    // Expired or revoked session: drop the token and send the user back through sign-in.
    try { window.sessionStorage.removeItem("hrm.access_token"); window.localStorage.removeItem("hrm.access_token"); } catch { /* ignore */ }
    const { signInPath } = await import("./auth");
    window.location.assign(`${signInPath()}?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload ? payload.message || payload.error : payload;
    throw new ApiRequestError(Array.isArray(message) ? message.join(" ") : message || "Request failed.", response.status, payload);
  }
  return payload as T;
}
