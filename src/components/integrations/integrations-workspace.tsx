"use client";
import { AlertTriangle, Banknote, BookOpen, Fingerprint, Lock, Plug, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/cases";
import { get, type Overview } from "./api";
import { AccountingTab } from "./accounting-tab";
import { DevicesTab } from "./devices-tab";
import { PayoutsTab } from "./payouts-tab";
import { WebhooksTab } from "./webhooks-tab";
import { Skeleton, useLoad, useToast } from "./ui";

type Tab = "devices" | "accounting" | "payouts" | "webhooks";
const TABS: { key: Tab; label: string; icon: typeof Plug }[] = [
  { key: "devices", label: "Devices", icon: Fingerprint }, { key: "accounting", label: "Accounting", icon: BookOpen },
  { key: "payouts", label: "Bank payouts", icon: Banknote }, { key: "webhooks", label: "Webhooks", icon: Webhook },
];

export function IntegrationsWorkspace() {
  const overview = useLoad(() => get<Overview>("/overview"));
  const toast = useToast();
  const [tab, setTab] = useState<Tab | null>(null);
  const viewer = overview.data?.viewer;
  const allowed = TABS.filter((item) => item.key === "accounting" || item.key === "payouts" ? viewer?.canManageFinance : viewer?.canManageDevices);

  useEffect(() => {
    if (!viewer || tab) return;
    const wanted = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    setTab(allowed.find((item) => item.key === wanted)?.key || allowed[0]?.key || null);
  }, [viewer, tab, allowed]);
  const choose = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next = allowed[(index + (event.key === "ArrowRight" ? 1 : allowed.length - 1)) % allowed.length];
    choose(next.key);
    document.getElementById(`ig-tab-${next.key}`)?.focus();
  };
  const forbidden = overview.error && (overview.error.includes("role") || overview.error.includes("Forbidden"));

  return (
    <div className="cw-page ig-page" style={{ ["--accent" as string]: "#3d5a80" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Plug size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">SETTINGS · INTEGRATIONS</p>
          <h1>Integrations</h1>
          <p>Connect biometric terminals, post payroll to Tally or your ERP, pay salaries through the bank and stream events to your own systems — all signed, audited and reconciled.</p>
        </div>
      </header>

      {overview.loading && !overview.data ? <><div className="cw-stats"><article /><article /><article /><article /></div><Skeleton rows={4} /></> : forbidden ? (
        <div className="cw-empty"><span><Lock size={26} /></span><h2>Integrations are managed by administrators</h2><p>HR administrators manage devices and webhooks; payroll administrators manage accounting exports and bank payouts. Ask one of them if you need access.</p></div>
      ) : overview.error ? (
        <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {overview.error} <button className="cw-btn ghost" onClick={() => overview.reload()}>Retry</button></p>
      ) : overview.data && (
        <>
          {!overview.data.security.masterKeyConfigured && <p className="cw-alert warn"><AlertTriangle size={15} /> INTEGRATIONS_MASTER_KEY is not set — device and webhook secrets use a per-install development key. Set a 32+ character key before going live (production refuses to start without it).</p>}
          <Cards data={overview.data} onOpen={choose} />
          <div className="cw-toolbar">
            <div className="cw-tabs" role="tablist" aria-label="Integration areas">
              {allowed.map((item, index) => { const Icon = item.icon; return (
                <button key={item.key} id={`ig-tab-${item.key}`} role="tab" aria-selected={tab === item.key} aria-controls="ig-panel" tabIndex={tab === item.key ? 0 : -1}
                  className={tab === item.key ? "active" : ""} onClick={() => choose(item.key)} onKeyDown={(event) => onTabKey(event, index)}><Icon size={14} /> {item.label}</button>
              ); })}
            </div>
          </div>
          <div id="ig-panel" role="tabpanel" aria-labelledby={tab ? `ig-tab-${tab}` : undefined}>
            {tab === "devices" && <DevicesTab notify={toast.show} onChange={() => overview.reload()} />}
            {tab === "accounting" && <AccountingTab notify={toast.show} onChange={() => overview.reload()} />}
            {tab === "payouts" && <PayoutsTab notify={toast.show} onChange={() => overview.reload()} />}
            {tab === "webhooks" && <WebhooksTab notify={toast.show} onChange={() => overview.reload()} />}
          </div>
        </>
      )}
      {toast.node}
    </div>
  );
}

function Cards({ data, onOpen }: { data: Overview; onOpen: (tab: Tab) => void }) {
  const cards: { tab: Tab; title: string; value: string; detail: string; attention: boolean; tone: string }[] = [];
  if (data.devices) cards.push({ tab: "devices", title: "Biometric devices", value: data.devices.total ? `${data.devices.online}/${data.devices.total} online` : "Not set up",
    detail: data.devices.unmatched ? `${data.devices.unmatched} unmatched punches to resolve` : `${data.devices.recorded24h} punches recorded in 24 h · ${data.devices.mappings} PINs mapped`, attention: data.devices.unmatched > 0 || data.devices.offline > 0, tone: "devices" });
  if (data.accounting) cards.push({ tab: "accounting", title: "Tally / ERP", value: data.accounting.configured ? "Ledgers mapped" : "Map ledgers",
    detail: data.accounting.lastExportAt ? `Last export ${relativeTime(data.accounting.lastExportAt)}${data.accounting.runsNotExported ? ` · ${data.accounting.runsNotExported} runs not exported` : ""}` : "No exports yet", attention: !data.accounting.configured, tone: "accounting" });
  if (data.payouts) cards.push({ tab: "payouts", title: "Bank payouts", value: data.payouts.awaitingRelease ? `${data.payouts.awaitingRelease} awaiting release` : data.payouts.inFlight ? `${data.payouts.inFlight} in flight` : "Up to date",
    detail: `${data.payouts.adapters.find((adapter) => adapter.mode)?.mode === "LIVE" ? "Live API" : "API sandbox"} · H2H files ready${data.payouts.needsAttention ? ` · ${data.payouts.needsAttention} need attention` : ""}`, attention: data.payouts.awaitingRelease > 0 || data.payouts.needsAttention > 0, tone: "payouts" });
  if (data.webhooks) cards.push({ tab: "webhooks", title: "Webhooks", value: `${data.webhooks.active} active`,
    detail: `${data.webhooks.succeeded24h} delivered · ${data.webhooks.failed24h} failed in 24 h${data.webhooks.disabled ? ` · ${data.webhooks.disabled} disabled` : ""}`, attention: data.webhooks.failed24h > 0 || data.webhooks.disabled > 0, tone: "webhooks" });
  return (
    <section className="cw-stats ig-cards" aria-label="Integration status">
      {cards.map((card) => (
        <article key={card.tab} className={card.attention ? "attention" : ""}>
          <small>{card.title}</small><b className="text">{card.value}</b><span>{card.detail}</span>
          <button className="ig-card-link" onClick={() => onOpen(card.tab)}>Manage →</button>
        </article>
      ))}
    </section>
  );
}

