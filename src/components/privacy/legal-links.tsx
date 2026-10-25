import Link from "next/link";
import "./privacy.css";

/** Footer links to the public legal pages (sign-in pages, admin console, privacy pages). */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Legal">
      <Link href="/legal/terms">Terms</Link>
      <Link href="/legal/privacy">Privacy</Link>
      <Link href="/legal/dpa">Data processing</Link>
      <Link href="/legal/subprocessors">Sub-processors</Link>
      <Link href="/legal/security">Security</Link>
    </nav>
  );
}
