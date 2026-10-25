import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Todo, V } from "../_lib/doc";
import { legalEntity } from "../_lib/legal-config";

export const metadata: Metadata = { title: "Data Processing Agreement — Northstar HRM" };

export default function Dpa() {
  const e = legalEntity();
  return (
    <Doc eyebrow="DATA PROCESSING AGREEMENT" title="Data Processing Agreement (DPA)" meta={<>Version 1 · Effective <V v={e.effectiveDate} /> · between the Customer and <V v={e.name} /></>}>
      <p>This DPA forms part of the <Link href="/legal/terms">Terms of Service</Link> between the client company (&quot;Customer&quot;, the <b>Data Fiduciary</b>) and{" "}
        <V v={e.name} />, CIN <V v={e.cin} /> (&quot;Provider&quot;, the <b>Data Processor</b>) under the Digital Personal Data Protection Act, 2023 (&quot;Act&quot;)
        and the Digital Personal Data Protection Rules, 2025 (&quot;Rules&quot;).</p>

      <h2>1. Subject matter, purpose and duration</h2>
      <p>The Provider processes Customer personal data solely to provide the HR platform: employee records, attendance, leave, payroll and statutory computations, tax
        declarations, requests, learning and engagement, notifications and related support — for the subscription term and the exit period in clause 10.</p>
      <table className="lg-table">
        <thead><tr><th>Data principals</th><th>Categories of personal data</th></tr></thead>
        <tbody>
          <tr><td>Employees, former employees, joiners, contractors, and their nominees</td>
            <td>Identity and contact; employment; attendance incl. GPS location, IP/device and optional punch selfies; leave; payroll, salary and statutory identifiers
              (PAN, UAN, ESI, bank account); tax declarations and proofs; uploaded documents; requests and grievances; sign-in and audit logs.</td></tr>
          <tr><td>Customer administrators</td><td>Name, work email, role, sign-in and activity logs.</td></tr>
        </tbody>
      </table>
      <Todo>whether any data is &quot;children&apos;s data&quot; (apprentices under 18) needing verifiable parental consent under s.9.</Todo>

      <h2>2. Instructions</h2>
      <p>The Provider processes personal data only on the Customer&apos;s documented instructions — this DPA, the Customer&apos;s configuration of the Service, and
        written requests — and informs the Customer if an instruction appears to break the law. The Customer is responsible for the lawful basis (consent or legitimate
        use under s.7(i), employment) and for the privacy notice to its employees. The Service records employees&apos; acknowledgement of that notice.</p>

      <h2>3. Confidentiality and personnel</h2>
      <p>Only personnel who need access to run or support the Service have it, under confidentiality obligations, with access reviewed periodically. Platform
        administrators act outside client workspaces and cannot read client employee data through the application except via audited support functions.</p>

      <h2>4. Security measures (s.8(5), Rules — reasonable security safeguards)</h2>
      <p>The Provider maintains at least the following controls, which are implemented in the Service:</p>
      <ul>
        <li><b>Tenant isolation in the database:</b> every client table is protected by PostgreSQL row-level security (enabled and forced) on a least-privilege
          application role, so a query can only see the signed-in company&apos;s rows; each company&apos;s web address is bound to its own workspace.</li>
        <li><b>Encryption:</b> TLS in transit; encryption at rest for database and storage; PAN, UAN, ESI and bank account numbers are additionally encrypted per field
          (AES-256-GCM, bound to company, table, column and row, with key rotation and keyed blind indexes for matching).</li>
        <li><b>Files:</b> stored in a separate folder per company (<code>tenants/&lt;company&gt;/…</code>) in S3 with server-side encryption (KMS where configured), never
          publicly accessible, served only through the API after an access check, verified against a SHA-256 checksum, and every download audited.</li>
        <li><b>Access control:</b> role- and permission-based access with data scopes (self, team, organisation); multi-factor authentication (TOTP) and single
          sign-on (OIDC); rate limiting and lock-out on failed sign-ins.</li>
        <li><b>Logging:</b> an append-only, hash-chained audit log of changes and of views of sensitive data, verified automatically; security events monitored;
          logs retained for at least one year (Rules) and 180 days in India (CERT-In).</li>
        <li><b>Application security:</b> strict Content Security Policy with per-request nonces, input validation, dependency and configuration checks mapped to
          ISO/IEC 27001 and SOC 2 controls in the Provider&apos;s compliance centre.</li>
        <li><b>Resilience:</b> backups of database and storage with restore testing <span className="lg-ph">[frequency / RPO / RTO]</span>.</li>
      </ul>

      <h2>5. Sub-processors</h2>
      <p>The Customer authorises the sub-processors listed at <Link href="/legal/subprocessors">/legal/subprocessors</Link>. The Provider will give at least{" "}
        <span className="lg-ph">[30]</span> days&apos; notice of a new sub-processor, during which the Customer may object on reasonable data-protection grounds; if
        unresolved, the Customer may terminate the affected service. The Provider imposes equivalent obligations on each sub-processor and remains responsible for them.</p>

      <h2>6. Assistance with data principal rights</h2>
      <p>The Service gives the Customer tools to meet ss.11–14: employees can download a copy of their data (JSON/CSV, decrypted for them only), raise access,
        correction, erasure, nomination and grievance requests tracked against an SLA well inside the 90-day limit in the Rules, and see the grievance officer&apos;s
        contact. The Provider will otherwise assist on request at no extra charge for reasonable volumes.</p>

      <h2>7. Personal data breaches</h2>
      <p>The Provider will notify the Customer <b>without undue delay and in any case within <span className="lg-ph">[24]</span> hours</b> of becoming aware of a personal
        data breach affecting Customer data, with the nature, categories and approximate numbers affected, likely consequences, containment and mitigation, and a contact,
        and will update the Customer as facts emerge. This allows the Customer to inform affected data principals without delay and to give the Data Protection Board its
        intimation without delay and detailed report within 72 hours (Rules, rule 7). The Provider reports cyber incidents to CERT-In within 6 hours where its Directions
        of 28 April 2022 apply. The Service includes a breach register with these clocks and a template notice to affected employees.</p>
      <Todo>allocation of who files with the Board (fiduciary) vs CERT-In (both may be &quot;service providers&quot;); the 24-hour processor deadline.</Todo>

      <h2>8. Retention and erasure during the term</h2>
      <p>The Customer configures retention periods per category (defaults: documents, attendance location detail and personal profile 1 year after exit; requests and
        leave reasons 3 years; payroll and tax records 8 years). A nightly job prepares a report of former employees past retention for HR to review and then erases or
        anonymises their data (or does so automatically if the Customer opts in), respecting legal holds, and records an erasure certificate in the audit chain.</p>

      <h2>9. Audits and information</h2>
      <p>The Provider will make available information needed to demonstrate compliance, including its compliance-centre evidence pack and summaries of independent audits
        or certifications <span className="lg-ph">[ISO 27001 / SOC 2 status]</span>. The Customer (or an independent auditor bound by confidentiality) may audit once a year
        on 30 days&apos; notice, or after a breach, at its own cost and without disrupting other customers.</p>

      <h2>10. Return and deletion at end of contract</h2>
      <p>At the end of the subscription the Provider suspends the workspace and makes a complete export available (JSON and CSV per table plus a manifest of every
        uploaded file with its checksum), downloadable for 7 days. After a grace period of <span className="lg-ph">[30]</span> days — and after two Provider administrators
        confirm the closure — all Customer data is deleted from the database and storage, except: (a) the tamper-evident audit log, kept for security and legal evidence;
        (b) minimal billing records required by tax law. Backups containing Customer data expire within <span className="lg-ph">[35]</span> days. A deletion certificate is
        provided on request.</p>
      <Todo>the audit-log exception contains personal data (names in change records); justify under s.8(7)/s.17 or agree a cut-off.</Todo>

      <h2>11. Cross-border transfer</h2>
      <p>Primary processing is in India. Transfers outside India are limited to the sub-processors listed and comply with s.16 and any Government notification.</p>

      <h2>12. Liability and precedence</h2>
      <p>Liability is as set out in the Terms. For personal data, this DPA prevails over the Terms.</p>
    </Doc>
  );
}
