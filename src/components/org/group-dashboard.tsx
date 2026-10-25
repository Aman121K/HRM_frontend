"use client";
import { AlertTriangle, ArrowRight, Building2, LifeBuoy, UserCheck, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { money } from "@/lib/cases";
import { loadMyOrgs, switchOrganization, type OrgSummary } from "@/lib/org";
import { OrgMark } from "@/components/sidebar-nav";

type Metrics = { headcount: number; joinersThisMonth: number; exitsInProgress: number; presentToday: number; pendingApprovals: number; openTickets: number; overdueTickets: number; lastPayrollNet?: number | null; lastPayrollPeriod?: string | null; pendingClaimsAmount: number };
type Overview = { group: { id: string; name: string }; groups: { id: string; name: string }[]; generatedAt: string; brands: (OrgSummary & { metrics: Metrics })[]; totals: Metrics };

const pct = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;

export function GroupDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [memberships, setMemberships] = useState<Map<string, OrgSummary>>(new Map());
  useEffect(() => { loadMyOrgs().then((mine) => setMemberships(new Map(mine.organizations.map((org) => [org.id, org])))).catch(() => {}); }, []);
  useEffect(() => {
    httpRequest<Overview>(`/api/v2/group/overview${groupId ? `?groupId=${groupId}` : ""}`).then(setData).catch((reason) => setError(reason.message));
  }, [groupId]);
  const max = Math.max(1, ...(data?.brands.map((brand) => brand.metrics.headcount) || [1]));
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#132c38" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Building2 size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">GROUP · ALL BRANDS</p>
          <h1>{data?.group.name || "Group dashboard"}</h1>
          <p>Every brand side by side — people, attendance, approvals, service desk and payroll. Each brand's data stays in its own organization; this view only reads totals.</p>
        </div>
        {data && data.groups.length > 1 && (
          <select className="gd-select" value={data.group.id} onChange={(event) => setGroupId(event.target.value)} aria-label="Group">
            {data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        )}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!data ? !error && <div className="cw-list-skeleton"><i /><i /><i /></div> : (
        <>
          <section className="cw-stats gd-totals">
            <article><small><Users size={12} /> People</small><b>{data.totals.headcount}</b><span>{data.totals.joinersThisMonth} joined this month · {data.totals.exitsInProgress} exiting</span></article>
            <article><small><UserCheck size={12} /> Present today</small><b>{data.totals.presentToday}</b><span>{pct(data.totals.presentToday, data.totals.headcount)}% punched in</span></article>
            <article className={data.totals.pendingApprovals ? "attention" : ""}><small>Pending approvals</small><b>{data.totals.pendingApprovals}</b><span>leave, claims, requests</span></article>
            <article className={data.totals.overdueTickets ? "attention" : ""}><small><LifeBuoy size={12} /> Open tickets</small><b>{data.totals.openTickets}</b><span>{data.totals.overdueTickets} past SLA</span></article>
            <article><small><Wallet size={12} /> Last payroll (net)</small><b>{money(data.totals.lastPayrollNet || 0)}</b><span>claims pending {money(data.totals.pendingClaimsAmount)}</span></article>
          </section>

          <section className="gd-brands">
            {data.brands.map((brand) => (
              <article key={brand.id} style={{ ["--brand" as string]: brand.brandColor, ["--brand-accent" as string]: brand.accentColor }}>
                <header>
                  <OrgMark org={brand} size={40} />
                  <div><h3>{brand.displayName}</h3><small>{brand.industry || "—"}</small></div>
                  {memberships.has(brand.id) && <button className="cw-btn ghost" onClick={() => switchOrganization(memberships.get(brand.id)!)}>Open <ArrowRight size={14} /></button>}
                </header>
                <div className="gd-bar" aria-label={`${brand.metrics.headcount} people`}><i style={{ width: `${(brand.metrics.headcount / max) * 100}%` }} /><span>{brand.metrics.headcount} people</span></div>
                <dl>
                  <div><dt>Present today</dt><dd>{brand.metrics.presentToday}<small> · {pct(brand.metrics.presentToday, brand.metrics.headcount)}%</small></dd></div>
                  <div><dt>Joiners (month)</dt><dd>{brand.metrics.joinersThisMonth}</dd></div>
                  <div><dt>Pending approvals</dt><dd className={brand.metrics.pendingApprovals ? "warn" : ""}>{brand.metrics.pendingApprovals}</dd></div>
                  <div><dt>Open tickets</dt><dd className={brand.metrics.overdueTickets ? "bad" : ""}>{brand.metrics.openTickets}{brand.metrics.overdueTickets ? <small> · {brand.metrics.overdueTickets} late</small> : null}</dd></div>
                  <div><dt>Exits in progress</dt><dd>{brand.metrics.exitsInProgress}</dd></div>
                  <div><dt>Last payroll</dt><dd>{brand.metrics.lastPayrollNet ? <>{money(brand.metrics.lastPayrollNet)}<small> · {brand.metrics.lastPayrollPeriod}</small></> : <small>not run yet</small>}</dd></div>
                </dl>
              </article>
            ))}
          </section>
          <p className="gd-foot">Updated {new Intl.DateTimeFormat("en-IN", { timeStyle: "short", dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(data.generatedAt))}. Numbers are live from each brand; drill in with “Open”.</p>
        </>
      )}
    </div>
  );
}
