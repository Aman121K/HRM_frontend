import Link from "next/link";
import { Doc, V } from "./_lib/doc";
import { legalEntity } from "./_lib/legal-config";

export default function LegalIndex() {
  const e = legalEntity();
  return (
    <Doc eyebrow="LEGAL & TRUST" title="Legal documents" meta={<>Operated by <V v={e.name} /> · Questions: <V v={e.email} /></>}>
      <p>Northstar HRM is a human-resources platform that companies use to manage their employees. Each client company decides why and how its
        employees&apos; data is used (it is the <b>Data Fiduciary</b> under India&apos;s Digital Personal Data Protection Act, 2023); we process that data on its
        behalf (we are its <b>Data Processor</b>).</p>
      <nav className="lg-cards" aria-label="Documents">
        <Link href="/legal/terms"><b>Terms of Service</b><small>The agreement between the platform and client companies.</small></Link>
        <Link href="/legal/privacy"><b>Privacy Policy</b><small>How the platform handles personal data, as a processor and for its own accounts.</small></Link>
        <Link href="/legal/dpa"><b>Data Processing Agreement</b><small>Processor obligations: purpose, security, breaches, deletion, audits.</small></Link>
        <Link href="/legal/subprocessors"><b>Sub-processors</b><small>Third parties that help run the service, from this deployment&apos;s configuration.</small></Link>
        <Link href="/legal/security"><b>Security overview</b><small>Controls for your IT and security team&apos;s review.</small></Link>
      </nav>
      <p>Employees: to see, correct or erase your data, sign in and open <b>My space → My data &amp; privacy</b>, or contact your employer&apos;s grievance officer.</p>
    </Doc>
  );
}
