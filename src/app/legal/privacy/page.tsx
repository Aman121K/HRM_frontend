import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Todo, V } from "../_lib/doc";
import { legalEntity } from "../_lib/legal-config";

export const metadata: Metadata = { title: "Privacy Policy — Northstar HRM" };

export default function Privacy() {
  const e = legalEntity();
  return (
    <Doc eyebrow="PRIVACY POLICY" title="Platform Privacy Policy" meta={<>Effective <V v={e.effectiveDate} /> · <V v={e.name} /></>}>
      <h2>1. Who we are and our role</h2>
      <p><V v={e.name} /> (&quot;we&quot;) operates <V v={e.brand} />, a platform that companies use to manage their workforce. For employee data in a company&apos;s
        workspace, <b>the company (your employer) is the Data Fiduciary</b> under the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;), and{" "}
        <b>we are its Data Processor</b>: we process that data only on the company&apos;s instructions under a{" "}
        <Link href="/legal/dpa">Data Processing Agreement</Link>. Your employer&apos;s own privacy notice explains its purposes; you can read it in the app under
        My space → My data &amp; privacy.</p>
      <p>We are a Data Fiduciary only for limited data of our own: business contacts at client companies, billing records, website enquiries and the security logs
        we need to protect the service.</p>

      <h2>2. Data we process on behalf of client companies</h2>
      <ul>
        <li>Identity and contact: name, employee number, work email, designation, department, manager, date of birth and gender where provided.</li>
        <li>Attendance: punch times, location at punch (GPS), IP address and device details, and punch selfies if the employer enables them.</li>
        <li>Leave, requests, approvals, performance and learning records.</li>
        <li>Payroll and tax: salary structure, payslips, statutory deductions, tax declarations and proofs, PAN, UAN, ESI number and bank account (stored encrypted).</li>
        <li>Documents uploaded during onboarding and requests (e.g. ID and bank proofs).</li>
        <li>Security logs: sign-ins, and a tamper-evident audit trail of who viewed or changed records.</li>
      </ul>

      <h2>3. How we use it</h2>
      <p>Only to provide, secure, support and maintain the service for the client company, to comply with law, and as the company instructs. We do not sell personal data,
        use it for advertising, or train general-purpose AI models on it. Where an optional feature uses an AI provider (for example, reading an expense receipt), only
        the minimum content needed is sent, under contract, and it is listed on the <Link href="/legal/subprocessors">sub-processors</Link> page.</p>

      <h2>4. Sharing</h2>
      <p>With the client company&apos;s authorised users according to their roles; with our sub-processors under written contracts with equivalent protections; and with
        authorities when the law requires (we will tell the client company unless prohibited).</p>

      <h2>5. Where data is stored</h2>
      <p>Primary hosting is in India (<span className="lg-ph">[AWS Mumbai, ap-south-1]</span>). Some sub-processors (e.g. push notification services) may process limited
        data outside India; transfers follow DPDP Act s.16 and any restrictions notified by the Government.</p>
      <Todo>confirm production regions and whether any client sector rules (RBI, IRDAI, SEBI) require data localisation.</Todo>

      <h2>6. How long</h2>
      <p>For client data: as long as the client company keeps its subscription, according to the retention schedule it configures (our defaults: documents and
        attendance detail 1 year after an employee leaves, requests and leave reasons 3 years, payroll and tax records 8 years), then erased or anonymised. When a
        client leaves, we return its data and delete it after the agreed grace period. Security logs are kept for at least one year (DPDP Rules 2025) and 180 days in
        India for CERT-In purposes. Audit records are kept in a tamper-evident chain and are not altered.</p>
      <Todo>retention of personal data inside audit-log entries after an erasure (currently kept for security/legal evidence) and in backups.</Todo>

      <h2>7. Security</h2>
      <p>See our <Link href="/legal/security">Security overview</Link>: encryption in transit and at rest, field-level encryption of identifiers, tenant isolation
        enforced by the database, per-company storage folders, multi-factor authentication and a hash-chained audit trail.</p>

      <h2>8. Your rights</h2>
      <p>Under the DPDP Act you may access a summary of your data, correct, complete or update it, have it erased when it is no longer needed or the law allows,
        nominate someone to act for you, and seek grievance redressal. For employee data, these requests go to <b>your employer</b>: use My space → My data &amp; privacy
        (instant data download, and requests tracked against a deadline well within the 90 days the DPDP Rules allow). We will help your employer respond. If you contact
        us directly we will forward your request to your employer.</p>
      <p>If your grievance is not resolved, you may complain to the Data Protection Board of India.</p>

      <h2>9. Breaches</h2>
      <p>If a personal data breach affects you, your employer (with our help) will tell you without delay what happened, the likely consequences, what is being done,
        what you can do, and whom to contact.</p>

      <h2>10. Contact</h2>
      <p>Privacy questions: <V v={e.privacyEmail} />. Grievance officer for data we hold as fiduciary: <V v={e.grievanceOfficer} />, <V v={e.privacyEmail} />,{" "}
        <V v={e.address} />.</p>
      <Todo>whether the Provider itself may be notified as a Significant Data Fiduciary (volume/sensitivity) and needs a DPO and annual DPIA/audit.</Todo>
    </Doc>
  );
}
