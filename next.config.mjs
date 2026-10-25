/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
// Content-Security-Policy is set per request with a nonce in src/proxy.ts (src/lib/csp.ts).

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera and location are used by attendance on this origin only; everything else is off.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }] : []),
];

const nextConfig = {
  // Container builds (Dockerfile.web) set NEXT_OUTPUT=standalone: .next/standalone carries a minimal server.js plus only the
  // node_modules it traces. src/proxy.ts (per-request CSP nonce) runs unchanged in standalone mode. Left unset for
  // `next dev` / `next start` so local workflows behave exactly as before.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
