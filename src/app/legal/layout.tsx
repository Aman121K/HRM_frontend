import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import "./legal.css";

export const metadata: Metadata = { title: "Legal — Northstar HRM", robots: { index: true, follow: true } };
// Company particulars come from the environment at request time (and the root layout renders per request for the CSP nonce).
export const dynamic = "force-dynamic";

const LINKS: [string, string][] = [["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/dpa", "DPA"], ["/legal/subprocessors", "Sub-processors"], ["/legal/security", "Security"]];

/** Public legal pages: no sign-in, no client JavaScript. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg-shell">
      <header className="lg-bar">
        <Link href="/legal" className="auth-logo"><span className="brand-mark"><i /><i /><i /></span><span>northstar<small>LEGAL</small></span></Link>
        <nav aria-label="Legal documents">{LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      </header>
      <p className="lg-draft" role="note"><AlertTriangle size={18} aria-hidden /> <span><b>Draft — review with your lawyer before use.</b> These are templates. Bracketed
        items are placeholders filled from the deployment settings; nothing here is legal advice, and timelines quoted from the DPDP Act 2023, DPDP Rules 2025 and
        CERT-In Directions must be confirmed by counsel before publication.</span></p>
      <main className="lg-main">{children}</main>
      <footer className="lg-foot"><Link href="/login">Sign in</Link> · <Link href="/legal">All legal documents</Link></footer>
    </div>
  );
}
