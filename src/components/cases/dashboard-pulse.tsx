"use client";
import Link from "next/link";
import { ArrowRight, Award, Briefcase, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { caseUi } from "@/lib/case-ui";
import { caseApi, initials, loadDefinitions, relativeTime, type CaseItem } from "@/lib/cases";
import { PollWidget } from "@/components/engagement/poll-widget";
import { UpcomingJoiners } from "@/components/onboarding-flow/upcoming-joiners";

const shortcutOrder = ["helpdesk", "expenses", "travel", "letters", "assets", "learning", "shifts", "exit"];
const shortcutLabels: Record<string, string> = {
  helpdesk: "Helpdesk", expenses: "Expenses", travel: "Travel", letters: "Letters", assets: "Assets", learning: "Learning", shifts: "Shifts", exit: "Exit",
};

/** Live widgets on the home dashboard backed by the case engine. */
export function DashboardPulse() {
  const [data, setData] = useState<{ mine: { module: string; open: number; total: number }[]; recognition: CaseItem[]; openings: CaseItem[] } | null>(null);
  const [pending, setPending] = useState(0);
  const [lead, setLead] = useState(false);
  useEffect(() => {
    loadDefinitions().then(({ viewer }) => setLead(viewer.isHr || viewer.roles.includes("MANAGER"))).catch(() => {});
    caseApi.summary().then(setData).catch(() => setData({ mine: [], recognition: [], openings: [] }));
    caseApi.inbox().then((inbox) => setPending(inbox.total)).catch(() => {});
  }, []);
  const open = new Map((data?.mine || []).map((row) => [row.module, row.open]));
  const openTotal = [...open.values()].reduce((sum, value) => sum + value, 0);
  return (
    <>
    <section className="pulse-grid" aria-label="Workplace services">
      <article className="pulse-card pulse-services">
        <header>
          <div><p className="eyebrow">SERVICES</p><h2>My requests</h2></div>
          <span className="pulse-count">{openTotal} open{pending ? ` · ${pending} awaiting you` : ""}</span>
        </header>
        <div className="pulse-tiles">
          {shortcutOrder.map((key) => {
            const ui = caseUi[key];
            const Icon = ui.icon;
            return (
              <Link key={key} href={ui.href} style={{ ["--accent" as string]: ui.accent }}>
                <span><Icon size={18} strokeWidth={1.8} /></span>
                <b>{shortcutLabels[key]}</b>
                <small>{open.get(key) ? `${open.get(key)} open` : "Nothing open"}</small>
              </Link>
            );
          })}
        </div>
        {pending > 0 && <Link className="pulse-banner" href="/approvals">{pending} item{pending > 1 ? "s" : ""} waiting for your decision <ArrowRight size={14} /></Link>}
      </article>

      <article className="pulse-card pulse-kudos">
        <header>
          <div><p className="eyebrow">CULTURE</p><h2>Recognition</h2></div>
          <Link className="text-action" href="/recognition">Give kudos →</Link>
        </header>
        {!data ? <div className="cw-list-skeleton"><i /><i /></div> : !data.recognition.length ? (
          <p className="pulse-empty"><Award size={18} /> No kudos yet — be the first to thank a colleague.</p>
        ) : (
          <ul>
            {data.recognition.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span className="cw-avatar small">{initials(item.subject?.name)}</span>
                <p><b>{item.subject?.name}</b> · <em>{item.category}</em><span>{item.title}</span><small>from {item.requester.name} · {relativeTime(item.createdAt)}</small></p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="pulse-card pulse-jobs">
        <header>
          <div><p className="eyebrow">INTERNAL MOBILITY</p><h2>Open roles</h2></div>
          <Link className="text-action" href="/jobs">Job board →</Link>
        </header>
        {!data ? <div className="cw-list-skeleton"><i /><i /></div> : !data.openings.length ? (
          <p className="pulse-empty"><Briefcase size={18} /> No open roles right now.</p>
        ) : (
          <ul>
            {data.openings.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span className="pulse-job-icon"><Briefcase size={15} /></span>
                <p><b>{item.title}</b><span><MapPin size={11} /> {item.details.location} · {item.details.employmentType}</span></p>
                <Link href="/jobs" aria-label={`Refer someone for ${item.title}`}>Refer</Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
    <section className="pulse-grid pulse-row-2" aria-label="Engagement and onboarding">
      <PollWidget className="pulse-card" />
      {lead && <UpcomingJoiners />}
    </section>
    </>
  );
}
