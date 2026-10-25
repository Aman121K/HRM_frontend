import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Todo, V } from "../_lib/doc";
import { legalEntity } from "../_lib/legal-config";

export const metadata: Metadata = { title: "Terms of Service — Northstar HRM" };

export default function Terms() {
  const e = legalEntity();
  return (
    <Doc eyebrow="TERMS OF SERVICE" title="Software-as-a-Service Terms" meta={<>Effective <V v={e.effectiveDate} /> · <V v={e.name} />, CIN <V v={e.cin} />, GSTIN <V v={e.gstin} /></>}>
      <h2>1. Parties and acceptance</h2>
      <p>These Terms are an agreement between <V v={e.name} />, a company incorporated in India with its registered office at <V v={e.address} /> (&quot;we&quot;,
        &quot;Provider&quot;), and the organisation that subscribes to <V v={e.brand} /> (&quot;Customer&quot;). They apply together with the order form, the{" "}
        <Link href="/legal/dpa">Data Processing Agreement</Link> (&quot;DPA&quot;) and any service-level schedule. If documents conflict, the order form prevails, then
        the DPA (for personal data), then these Terms. The person accepting confirms they are authorised to bind the Customer.</p>

      <h2>2. The service</h2>
      <p>We provide a hosted human-resources platform: employee records, attendance (including geo-fenced punches and optional punch selfies), leave, payroll and
        statutory computations, tax declarations, requests and approvals, learning, engagement and related features, as enabled for the Customer&apos;s workspace
        (&quot;Service&quot;). We may improve the Service; we will not materially reduce core functionality during a paid term without notice.</p>

      <h2>3. Customer responsibilities</h2>
      <ol>
        <li>The Customer is the Data Fiduciary for its employees&apos; personal data. It decides the purposes of processing, gives employees the required privacy
          notice, appoints a grievance officer (and a Data Protection Officer if it is a Significant Data Fiduciary), and responds to its employees&apos; requests.</li>
        <li>The Customer is responsible for the accuracy of data it enters, for its configuration (e.g. pay components, statutory settings, retention periods), and for
          reviewing payroll, tax and statutory outputs before relying on them. Computations are tools, not professional tax, legal or accounting advice.</li>
        <li>The Customer manages its users, keeps credentials confidential, enables multi-factor authentication for administrators, and tells us promptly of any
          suspected unauthorised access.</li>
        <li>Acceptable use: no unlawful content, no attempt to access other customers&apos; data, no security testing without written permission, no reverse
          engineering except as the law allows, and no use that overloads the Service.</li>
      </ol>

      <h2>4. Fees and taxes</h2>
      <p>Fees are as stated in the order form, billed in advance and payable within <span className="lg-ph">[30]</span> days of invoice. Fees exclude GST and other
        applicable taxes, which are charged as required by law. We may suspend the Service for undisputed amounts unpaid more than <span className="lg-ph">[30]</span> days
        after written notice.</p>

      <h2>5. Data protection and security</h2>
      <p>We process Customer personal data only on the Customer&apos;s documented instructions and as set out in the DPA, and maintain the safeguards described in our{" "}
        <Link href="/legal/security">Security overview</Link>. Our current sub-processors are listed at <Link href="/legal/subprocessors">/legal/subprocessors</Link>.</p>

      <h2>6. Availability and support</h2>
      <p>We aim for <span className="lg-ph">[99.5%]</span> monthly availability, excluding scheduled maintenance announced in advance and events outside our reasonable
        control. Support is available by email at <V v={e.email} /> on Indian business days. Service credits, if any, are set out in the order form.</p>

      <h2>7. Intellectual property</h2>
      <p>We own the Service and its software. The Customer owns its data. The Customer grants us a licence to host and process its data only to provide, secure and
        support the Service. Feedback may be used without obligation. We may use aggregated, de-identified statistics that do not identify the Customer or any person.</p>

      <h2>8. Confidentiality</h2>
      <p>Each party keeps the other&apos;s confidential information confidential, uses it only for this agreement, and protects it with at least reasonable care.</p>

      <h2>9. Term, termination and exit</h2>
      <ol>
        <li>The subscription runs for the term in the order form and renews unless either party gives <span className="lg-ph">[30]</span> days&apos; notice.</li>
        <li>Either party may terminate for material breach not cured within 30 days of notice.</li>
        <li>On termination we suspend the workspace, provide a complete export of the Customer&apos;s data (JSON and CSV per table plus a manifest of uploaded files)
          available for 7 days, and delete the Customer&apos;s data after a grace period of <span className="lg-ph">[30]</span> days, except records we must keep by law
          (invoices and payments) and our tamper-evident security audit log, as described in the DPA.</li>
      </ol>

      <h2>10. Warranties and disclaimers</h2>
      <p>We will provide the Service with reasonable skill and care. Except as stated, the Service is provided &quot;as is&quot; and we disclaim implied warranties to the
        extent the law allows.</p>

      <h2>11. Limitation of liability</h2>
      <p>Neither party is liable for indirect or consequential loss or loss of profits. Each party&apos;s total liability is limited to the fees paid in the
        <span className="lg-ph"> [12]</span> months before the claim, except for breach of confidentiality, the Customer&apos;s payment obligations, and liability that
        cannot be limited by law.</p>
      <Todo>liability caps and any carve-out for data-protection penalties under DPDP Act s.33 (up to ₹250 crore) — allocate deliberately.</Todo>

      <h2>12. Indemnities</h2>
      <p>We will defend the Customer against third-party claims that the Service infringes intellectual-property rights in India. The Customer will defend us against
        claims arising from its data or its unlawful use of the Service.</p>

      <h2>13. Governing law and disputes</h2>
      <p>These Terms are governed by the laws of India. Disputes will first be escalated to senior management for 30 days, then referred to arbitration under the
        Arbitration and Conciliation Act, 1996 by a sole arbitrator, seated in <V v={e.jurisdiction} />, in English. Courts at <V v={e.jurisdiction} /> have
        exclusive jurisdiction for interim relief.</p>

      <h2>14. General</h2>
      <p>Notices go to the addresses in the order form (for us: <V v={e.email} />). Neither party may assign without consent except to a successor of its business.
        We may update these Terms with 30 days&apos; notice; changes that reduce the Customer&apos;s rights apply from the next renewal.</p>
      <Todo>stamp duty, e-acceptance mechanism (IT Act s.10A), and whether consumer protection rules apply to any customer segment.</Todo>
    </Doc>
  );
}
