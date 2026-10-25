/**
 * The one place a post-sign-in "returnTo" is validated. Only same-origin, single-slash, absolute paths are accepted.
 *
 * Rejected (falls back): absolute or protocol-relative URLs ("https://x", "//x"), backslashes ("/\evil.com" — browsers
 * treat "\" as "/"), control characters (tabs/newlines are stripped by the URL parser and can turn "/\t/x" into "//x"),
 * and encoded slashes or backslashes in the path ("/%2F%2Fevil.com", "/%5Cevil.com") which a later decode could turn
 * into a protocol-relative URL.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || !value || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  const pathPart = value.split(/[?#]/)[0];
  if (/%(2f|5c)/i.test(pathPart)) return fallback;
  let decodedPath: string;
  try { decodedPath = decodeURIComponent(pathPart); } catch { return fallback; }
  if (decodedPath.startsWith("//") || decodedPath.includes("\\")) return fallback;
  if (typeof window === "undefined") return fallback;
  let url: URL;
  try { url = new URL(value, window.location.origin); } catch { return fallback; }
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
