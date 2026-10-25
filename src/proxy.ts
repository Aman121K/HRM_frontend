import { NextResponse, type NextRequest } from "next/server";
import { APP_DOMAIN, brandFromHostname } from "@/lib/brand-host";
import { buildCsp } from "@/lib/csp";

/**
 * Runs before every page: sets a per-request CSP nonce, and maps <brand>.<APP_DOMAIN> → that brand's workspace. /login shows the brand's own sign-in page, other brands' pages are
 * unreachable from this address, and the super admin console always lives on the main domain.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const response = route(request, headers);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function route(request: NextRequest, headers: Headers) {
  const brand = brandFromHostname(request.headers.get("host"));
  if (!brand) return NextResponse.next({ request: { headers } });
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/platform") {
    const host = request.headers.get("host") || "";
    const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
    const target = `${request.nextUrl.protocol}//${APP_DOMAIN}${port}${pathname}${search}`;
    // Not NextResponse.redirect: Next relativizes a Location on the same host as the dev server (localhost), which would loop.
    const safe = target.replace(/[&"<>]/g, (char) => `&#${char.charCodeAt(0)};`);
    return new NextResponse(`<!doctype html><meta http-equiv="refresh" content="0;url=${safe}"><a href="${safe}">Continue to the platform console</a>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `/b/${brand}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (pathname === "/b" || pathname.startsWith("/b/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/|api/|favicon|.*\\.(?:png|jpg|svg|ico|webmanifest|js|css)$).*)"] };
