import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Todo, V } from "../_lib/doc";
import { legalEntity } from "../_lib/legal-config";

export const metadata: Metadata = { title: "Security overview — Northstar HRM" };

const CONTROLS: [string, string[]][] = [
  ["Tenant isolation", [
    "Every company's data lives in shared tables protected by PostgreSQL row-level security, enabled and forced, with a tenant policy on each table.",
    "The application connects with a least-privilege database role that cannot bypass row-level security, own tables, or write platform tables; the API refuses to start in production if it could.",
    "Each company has its own web address; the API rejects requests from one company's address that target another company.",
  ]],
  ["Encryption", [
    "TLS for all traffic; HSTS and a strict Content Security Policy with a fresh nonce per request (no inline scripts).",
    "PAN, UAN, ESI and bank account numbers are encrypted per field with AES-256-GCM. Each value is bound to its company, table, column and row, so a copied ciphertext cannot be read elsewhere. Keys are versioned and rotatable (KMS-wrapped in production); searches use keyed blind indexes; screens show masked values and every reveal is audited.",
    "Database and file storage are encrypted at rest (S3 server-side encryption with KMS where configured).",
  ]],
  ["Files", [
    "Uploads are type-checked by content (magic bytes), size-limited, and stored under the company's own prefix: tenants/<company>/<record>/<category>/…",
    "Objects are private and never served directly: downloads go through the API, which checks access, verifies the SHA-256 recorded at upload, and writes an audit entry.",
    "Deleted files are purged by a retention job; punch selfies follow the company's selfie-retention setting.",
  ]],
  ["Identity and access", [
    "Single sign-on (OpenID Connect) or native sign-in with strong password rules, breached/common-password checks and TOTP multi-factor authentication.",
    "Role- and permission-based access with data scopes (own, direct reports, organisation); requesters can never approve their own requests.",
    "Rate limiting for sign-in, enumeration and API use; denied and failed requests are recorded for the security team.",
    "Quarterly user access reviews and policy acknowledgements in the compliance centre.",
  ]],
  ["Audit and monitoring", [
    "An append-only audit log, hash-chained per company and protected by database triggers against update, delete and truncate, verified nightly; tampering raises a critical finding.",
    "Reads of sensitive data (identifiers, payslips, documents) are audited, and employees can see a summary of who accessed their records in their data export.",
    "Live configuration checks mapped to ISO/IEC 27001 Annex A and SOC 2 criteria, with immutable evidence snapshots.",
  ]],
  ["Privacy engineering (DPDP Act 2023)", [
    "Self-service data export for employees, tracked privacy requests (access, correction, erasure, nomination, grievance) and the grievance officer's contact in-app.",
    "Configurable retention per data category, a reviewed dry-run before erasure, legal holds, irreversible removal of identifiers, and erasure certificates in the audit chain.",
    "A breach register with DPDP and CERT-In reporting clocks and an employee notification template.",
    "Customer exit: complete export, suspension, two-administrator-confirmed deletion after a grace period.",
  ]],
  ["Operations", [
    "Background work runs in a separate worker with per-company transactions; failures are isolated per company.",
    "Hosting in India (AWS Mumbai) with backups and restore testing.",
    "Responsible disclosure: report vulnerabilities to the security contact below; we acknowledge within 2 business days.",
  ]],
];

export default function Security() {
  const e = legalEntity();
  return (
    <Doc eyebrow="SECURITY OVERVIEW" title="Security overview for IT teams" meta={<>Last reviewed <V v={e.effectiveDate} /> · Security contact <V v={e.securityEmail} /></>}>
      <p>This summary describes the controls built into <V v={e.brand} />. It is intended for client IT, security and procurement reviews; a detailed questionnaire
        response, penetration-test summary and the compliance evidence pack are available under NDA.</p>
      {CONTROLS.map(([title, items]) => (
        <section key={title}>
          <h2>{title}</h2>
          <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ))}
      <h2>Shared responsibility</h2>
      <p>Client companies configure roles, enable MFA or SSO for their administrators, set retention periods, appoint a grievance officer, and review statutory outputs.
        See the <Link href="/legal/dpa">DPA</Link> for contractual commitments and <Link href="/legal/subprocessors">sub-processors</Link> for third parties.</p>
      <Todo>backup frequency, RPO/RTO, penetration-test date and certification status before sharing with customers.</Todo>
    </Doc>
  );
}
