import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Todo, V } from "../_lib/doc";
import { legalEntity, subProcessors } from "../_lib/legal-config";

export const metadata: Metadata = { title: "Sub-processors — Northstar HRM" };

export default function SubProcessors() {
  const e = legalEntity();
  const list = subProcessors();
  return (
    <Doc eyebrow="SUB-PROCESSORS" title="Sub-processors" meta={<>Generated from this deployment&apos;s configuration · <V v={e.name} /></>}>
      <p>These third parties help us run the service and may process Customer personal data on our behalf, under written contracts with data-protection obligations
        equivalent to our <Link href="/legal/dpa">DPA</Link>. Items marked &quot;not in use&quot; are integrations this deployment has not switched on; they are listed so
        customers know what enabling them would add.</p>
      <table className="lg-table">
        <thead><tr><th>Sub-processor</th><th>Purpose</th><th>Personal data</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((item) => (
            <tr key={item.name} className={item.active ? "" : "off"}>
              <td><b>{item.name}</b>{item.note && <><br /><small>{item.note}</small></>}</td>
              <td>{item.purpose}</td><td>{item.data}</td><td>{item.location}</td>
              <td><span className={`lg-pill ${item.active ? "" : "off"}`}>{item.active ? "In use" : "Not in use"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>We give at least <span className="lg-ph">[30]</span> days&apos; notice of new sub-processors. To subscribe to changes, email <V v={e.privacyEmail} />.</p>
      <Todo>signed DPAs with each sub-processor, their own sub-processor lists, and cross-border transfer review (s.16).</Todo>
    </Doc>
  );
}
