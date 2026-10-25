// Content-Security-Policy for every HTML response, built per request in src/proxy.ts with a fresh nonce so scripts
// run only when Next.js (or our code) issued them — no 'unsafe-inline' for scripts. Next.js reads the nonce from the
// request's CSP header and applies it to its own bootstrap scripts.
const isProd = process.env.NODE_ENV === "production";
const origin = (value?: string) => { try { return value ? new URL(value).origin : ""; } catch { return ""; } };

export function buildCsp(nonce: string) {
  const connect = ["'self'", origin(process.env.NEXT_PUBLIC_PLATFORM_API_URL || "http://localhost:4100"),
    origin(process.env.OIDC_ISSUER || process.env.NEXT_PUBLIC_OIDC_ISSUER)].filter(Boolean);
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce'd scripts load their chunks; MediaPipe needs WebAssembly; dev adds eval for fast refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isProd ? "" : " 'unsafe-eval'"}`,
    // React style={} attributes need inline styles; no script can be injected through style-src.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src ${connect.join(" ")}${isProd ? "" : " ws: http://localhost:* http://*.localhost:*"}`,
    "worker-src 'self' blob:",
    // LMS video lessons embed only privacy-friendly players.
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
