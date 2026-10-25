"use client";
import { ArrowRight, CalendarClock, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { shortDate } from "@/lib/cases";
import { countdown, errorText, onboardingApi, type JoinerCard } from "./api";
import { Avatar, ProgressBar } from "./shared";

/** Compact dashboard card: joiners starting in the next `days` days that the viewer is involved with. */
export function UpcomingJoiners({ days = 14 }: { days?: number }) {
  const [items, setItems] = useState<JoinerCard[] | null>(null);
  const [error, setError] = useState("");
  const [isHr, setIsHr] = useState(false);
  useEffect(() => {
    onboardingApi.upcoming(days).then((data) => { setItems(data.items); setIsHr(data.viewer.isHr); }).catch((reason) => { setError(errorText(reason, "Unable to load joiners.")); setItems([]); });
  }, [days]);
  return (
    <section className="pulse-card ob-upcoming" aria-labelledby="ob-upcoming-title" style={{ ["--accent" as string]: "#0f8177" }}>
      <header>
        <div><p className="cw-eyebrow">ONBOARDING</p><h2 id="ob-upcoming-title">Joining in the next {days} days</h2></div>
        <span className="pulse-count">{items ? items.length : "…"}</span>
      </header>
      {error ? <p className="pulse-empty">{error}</p>
        : !items ? <div className="cw-skeleton"><i /><i /><i /></div>
        : !items.length ? <p className="pulse-empty"><UserRoundPlus size={15} /> No one is joining{isHr ? "" : " your team"} soon.</p>
        : (
          <ul>
            {items.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Avatar name={item.fullName} small />
                <p><Link href={`/onboarding/${item.id}`}><b>{item.fullName}</b></Link><span>{item.designation} · {item.department}</span>
                  {item.progress && <span className="ob-upcoming-progress"><ProgressBar percent={item.progress.percent} overdue={item.progress.overdue} label={`${item.fullName} checklist`} /> {item.progress.percent}%</span>}
                </p>
                <small className={item.daysToJoin <= 3 ? "ob-soon" : ""} title={shortDate(item.joiningDate)}><CalendarClock size={12} /> {countdown(item.daysToJoin, item.status).replace("Joins ", "")}</small>
              </li>
            ))}
          </ul>
        )}
      <Link className="pulse-banner" href="/onboarding">{isHr ? "Open onboarding pipeline" : "My onboarding tasks"} <ArrowRight size={15} /></Link>
    </section>
  );
}
