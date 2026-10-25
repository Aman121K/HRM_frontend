"use client";
import { AlertTriangle, Ban, Check, Download, FilePlus2, Play, Plus, Power, ReceiptIndianRupee, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { MODULE_LABELS } from "@/components/org/platform-console";
import styles from "./billing.module.css";
import { day, inr, monthLabel, PAYMENT_LABEL, PAYMENT_TONE, rupees, type InvoiceRow } from "./format";
import { UsageChart } from "./usage-chart";

type Plan = { id: string; code: string; name: string; description: string | null; pepmPaise: number; minimumPaise: number; setupFeePaise: number; includedModules: string[];
  billingCycle: "MONTHLY" | "ANNUAL"; annualDiscountPct: number; trialDays: number; usageBasis: "PEAK" | "AVERAGE"; active: boolean; version: number; accounts: number };
type Subscription = { id: string; planName: string; planCode: string; pepmPaise: number; minimumPaise: number; setupFeePaise: number; discountPct: number; cycle: string;
  usageBasis: string; trialDays: number; committedSeats: number | null; contractStart: string; contractEnd: string | null; customPrice: boolean };
type Account = { id: string; kind: "BRAND" | "GROUP"; organizationId: string | null; groupId: string | null; groupName: string | null; legalName: string; gstin: string | null;
  billingAddress: string; stateCode: string; contactName: string | null; contactEmail: string; contactPhone: string | null; paymentTermsDays: number | null; notes: string | null; version: number;
  brands: { organizationId: string; name: string; slug: string; status: string; liveCount: number }[]; subscriptions: Subscription[]; current: Subscription | null; liveTotal: number;
  suspensions: { organizationId: string; suspendOn: string; suspendedAt: string | null }[];
  estimate: { monthlyPaise: number; annual: boolean } | null;
  receivable: { billedPaise: number; paidPaise: number; creditedPaise: number; outstandingPaise: number; drafts: number } };
type Unbilled = { organizationId: string; name: string; slug: string; status: string; groupId: string | null; groupName: string | null; legalName: string | null; defaultState: string; liveCount: number };
type Accounts = { items: Account[]; unbilled: Unbilled[]; groups: { id: string; name: string; brands: number; hasAccount: boolean }[]; plans: Plan[];
  states: Record<string, { code: string; name: string }>; today: string; rule: { key: string; text: string } };
type Settings = { legalName: string; tradeName: string; gstin: string; pan: string; address: string; stateCode: string; email: string; phone: string; sacCode: string; gstRate: number;
  invoicePrefix: string; creditNotePrefix: string; paymentTermsDays: number; bankDetails: string; headcountRule: string; headcountRuleText: string; autoSuspendEnabled: boolean;
  autoSuspendAfterDays: number; suspendWarningDays: number; sources: Record<string, string>; readiness: { canIssue: boolean; problems: string[] } };
type Tab = "accounts" | "invoices" | "receivables" | "plans" | "settings";

const previousMonth = () => { const now = new Date(); now.setUTCDate(1); now.setUTCMonth(now.getUTCMonth() - 1); return now.toISOString().slice(0, 7); };
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : "Something went wrong.");

/** Super admin billing: billing accounts and plans, usage metering, invoice review/issue, payments and receivables. */
export function BillingConsole() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ account?: Account; brand?: Unbilled; groupId?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 4000); };
  const load = useCallback(() => httpRequest<Accounts>("/api/v2/platform/billing/accounts").then(setAccounts).catch((reason) => setError(errorText(reason))), []);
  useEffect(() => { load(); }, [load, version]);
  const refresh = () => setVersion((value) => value + 1);
  const totals = accounts?.items.reduce((sum, account) => ({ live: sum.live + account.liveTotal, outstanding: sum.outstanding + account.receivable.outstandingPaise, drafts: sum.drafts + account.receivable.drafts,
    run: sum.run + (account.estimate?.monthlyPaise || 0) }), { live: 0, outstanding: 0, drafts: 0, run: 0 });
  const tabs: [Tab, string][] = [["accounts", "Accounts & usage"], ["invoices", "Invoices"], ["receivables", "Payments & aging"], ["plans", "Plans"], ["settings", "Settings"]];
  return (
    <div className="cw-page" style={{ ["--accent" as string]: "#0b615c" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><ReceiptIndianRupee size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">PLATFORM · BILLING</p>
          <h1>Billing</h1>
          <p>Plans per employee per month, nightly usage metering, GST invoices, payments and reminders. Invoices are drafted on the 1st; you review and issue them.</p>
        </div>
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error} <button className="cw-btn ghost" onClick={() => setError("")}>Dismiss</button></p>}
      {accounts && totals && (
        <section className="cw-stats">
          <article><small>Billing accounts</small><b>{accounts.items.length}</b><span>{accounts.unbilled.length} brands not billed yet</span></article>
          <article><small>Billable today</small><b>{totals.live}</b><span>employees on billed brands</span></article>
          <article><small>Monthly run-rate</small><b className="text">{inr(totals.run)}</b><span>before GST, at today's headcount</span></article>
          <article className={totals.outstanding ? "attention" : ""}><small>Outstanding</small><b className="text">{inr(totals.outstanding)}</b><span>{totals.drafts} draft invoice(s) to review</span></article>
        </section>
      )}
      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Billing sections">
          {tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </div>
      </div>
      {tab === "accounts" && (accounts ? <AccountsTab data={accounts} onEdit={setEditing} onChanged={refresh} flash={flash} onError={setError} /> : <div className="cw-list-skeleton"><i /><i /></div>)}
      {tab === "invoices" && <InvoicesTab version={version} onOpen={setInvoiceId} flash={flash} onError={setError} onChanged={refresh} />}
      {tab === "receivables" && <AgingTab version={version} onOpen={setInvoiceId} flash={flash} onError={setError} />}
      {tab === "plans" && <PlansTab onError={setError} flash={flash} />}
      {tab === "settings" && <SettingsTab onError={setError} flash={flash} />}
      {invoiceId && <InvoiceDrawer id={invoiceId} onClose={() => setInvoiceId(null)} onChanged={() => { refresh(); }} flash={flash} />}
      {editing && accounts && <AccountDrawer data={accounts} target={editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); flash(message); refresh(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ---- accounts & usage ----------------------------------------------------------------------------------------------------

function AccountsTab({ data, onEdit, onChanged, flash, onError }: { data: Accounts; onEdit: (target: { account?: Account; brand?: Unbilled; groupId?: string }) => void;
  onChanged: () => void; flash: (message: string) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ period: string; items: { organizationId: string; name: string; days: { day: string; count: number; source: string }[]; peak: number | null; average: number | null }[] } | null>(null);
  const [month, setMonth] = useState(data.today.slice(0, 7));
  useEffect(() => { httpRequest<typeof usage>(`/api/v2/platform/billing/usage?month=${month}`).then(setUsage).catch((reason) => onError(errorText(reason))); }, [month, onError]);
  const snapshot = async () => {
    setBusy(true);
    try { const result = await httpRequest<{ rows: number }>("/api/v2/platform/billing/usage/snapshot", { method: "POST", body: {} }); flash(`Recorded today's headcount (${result.rows} brands)`); onChanged(); }
    catch (reason) { onError(errorText(reason)); } finally { setBusy(false); }
  };
  const reactivate = async (account: Account) => {
    if (!window.confirm(`Lift the billing suspension of ${account.legalName} now, even though invoices are still overdue?`)) return;
    try { await httpRequest(`/api/v2/platform/billing/accounts/${account.id}/reactivate`, { method: "POST" }); flash("Access restored"); onChanged(); } catch (reason) { onError(errorText(reason)); }
  };
  const billed = usage?.items.filter((item) => data.items.some((account) => account.brands.some((brand) => brand.organizationId === item.organizationId))) || [];
  return (
    <>
      <p className={styles.rule}><b>Billable headcount rule:</b> {data.rule.text} Snapshotted nightly at 23:50 IST; the month is billed on each plan's peak (default) or average.</p>
      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>Billing accounts</h2><p>A brand billed on its own, or a group whose brands share one invoice.</p></div>
          <div className={styles.actions}><button className="cw-btn ghost" disabled={busy} onClick={snapshot}><RefreshCw size={14} /> Record today's usage</button></div></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Account</th><th>Plan</th><th className="num">Billable today</th><th className="num">Run-rate</th><th className="num">Outstanding</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.items.map((account) => (
                <tr key={account.id}>
                  <td><b>{account.legalName}</b><small>{account.kind === "GROUP" ? `Group ${account.groupName} · ` : ""}{account.brands.map((brand) => brand.name).join(", ")} · {data.states[account.stateCode]?.name || account.stateCode}{account.gstin ? ` · ${account.gstin}` : " · unregistered"}</small>
                    {account.suspensions.map((item) => <small key={item.organizationId} style={{ color: "#a2402f" }}>{item.suspendedAt ? "Suspended for non-payment" : `Suspension warning — ${day(item.suspendOn)}`}</small>)}</td>
                  <td>{account.current ? <>{account.current.planName}{account.current.customPrice && <small>custom price</small>}<small>{inr(account.current.pepmPaise)} PEPM · min {inr(account.current.minimumPaise)} · from {day(account.current.contractStart)}</small></> : <span className="cw-help">No plan</span>}</td>
                  <td className="num">{account.liveTotal}</td>
                  <td className="num">{account.estimate ? inr(account.estimate.monthlyPaise) : "—"}</td>
                  <td className="num">{inr(account.receivable.outstandingPaise)}</td>
                  <td><div className={styles.actions}>
                    <button className="cw-btn ghost" onClick={() => onEdit({ account })}>Manage</button>
                    {account.suspensions.length > 0 && <button className="cw-btn ghost" onClick={() => reactivate(account)}><Power size={14} /> Lift</button>}
                  </div></td>
                </tr>
              ))}
              {!data.items.length && <tr><td colSpan={6} className="cw-help">No billing accounts yet — set one up for a brand below.</td></tr>}
            </tbody>
          </table>
        </div>
        {data.unbilled.length > 0 && (
          <div className={styles.cards}>
            {data.unbilled.map((brand) => (
              <article key={brand.organizationId} className={styles.card}>
                <h3>{brand.name}</h3>
                <p>{brand.liveCount} billable today · {brand.groupName ? `in ${brand.groupName}` : "no group"}{brand.status !== "ACTIVE" ? " · suspended" : ""}</p>
                <div className={styles.actions}>
                  <button className="cw-btn primary" onClick={() => onEdit({ brand })}><Plus size={14} /> Bill this brand</button>
                  {brand.groupId && !data.groups.find((group) => group.id === brand.groupId)?.hasAccount && <button className="cw-btn ghost" onClick={() => onEdit({ groupId: brand.groupId!, brand })}>Bill whole group</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>Daily usage</h2><p>Billable employees per brand per day. Pale bars are backfilled estimates.</p></div>
          <label className={styles.inline}>Month <input type="month" value={month} max={data.today.slice(0, 7)} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label></div>
        {!usage ? <div className="cw-list-skeleton"><i /></div> : billed.length === 0 ? <p className="cw-help">Usage appears here once a brand has a billing account.</p> : (
          <div className={styles.cards}>
            {billed.map((item) => (
              <article key={item.organizationId} className={styles.card}>
                <h3>{item.name}</h3>
                <p>Peak {item.peak ?? "—"} · average {item.average ?? "—"} · {item.days.length} days recorded</p>
                <UsageChart title={`${item.name} billable employees per day in ${monthLabel(month)}`} peak={item.peak}
                  points={item.days.map((point) => ({ label: String(Number(point.day.slice(8, 10))), value: point.count, muted: point.source === "BACKFILL", title: `${day(point.day)}: ${point.count}${point.source === "BACKFILL" ? " (backfilled)" : ""}` }))} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AccountDrawer({ data, target, onClose, onSaved }: { data: Accounts; target: { account?: Account; brand?: Unbilled; groupId?: string }; onClose: () => void; onSaved: (message: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const account = target.account;
  const [form, setForm] = useState({
    legalName: account?.legalName || target.brand?.legalName || (target.groupId ? target.brand?.groupName : target.brand?.name) || "", gstin: account?.gstin || "",
    billingAddress: account?.billingAddress || "", stateCode: account?.stateCode || target.brand?.defaultState || "KA", contactName: account?.contactName || "", contactEmail: account?.contactEmail || "",
    contactPhone: account?.contactPhone || "", paymentTermsDays: account?.paymentTermsDays?.toString() || "", notes: account?.notes || "" });
  const firstOfMonth = `${data.today.slice(0, 7)}-01`;
  const [plan, setPlan] = useState({ planId: data.plans[0]?.id || "", contractStart: firstOfMonth, contractEnd: "", pepmOverride: "", minimumOverride: "", setupFeeOverride: "", discountPct: "",
    trialDays: "", committedSeats: "", billingCycle: "", applyModules: false });
  const [adjust, setAdjust] = useState({ kind: "CREDIT", description: "", amount: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setP = (key: keyof typeof plan, value: string | boolean) => setPlan((current) => ({ ...current, [key]: value }));
  const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
  const run = async (work: () => Promise<string>) => { setBusy(true); setError(""); try { onSaved(await work()); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  const saveAccount = (event: React.FormEvent) => { event.preventDefault(); run(async () => {
    const body = { ...form, gstin: form.gstin.trim().toUpperCase(), paymentTermsDays: num(form.paymentTermsDays), contactPhone: form.contactPhone || undefined, contactName: form.contactName || undefined, notes: form.notes || undefined };
    if (account) { await httpRequest(`/api/v2/platform/billing/accounts/${account.id}`, { method: "PATCH", body: { ...body, version: account.version } }); return "Billing details saved"; }
    await httpRequest("/api/v2/platform/billing/accounts", { method: "POST", body: { ...body, gstin: body.gstin || undefined, kind: target.groupId ? "GROUP" : "BRAND",
      organizationId: target.groupId ? undefined : target.brand?.organizationId, groupId: target.groupId } });
    return "Billing account created — now assign a plan";
  }); };
  const assign = () => run(async () => {
    await httpRequest(`/api/v2/platform/billing/accounts/${account!.id}/subscriptions`, { method: "POST", body: {
      planId: plan.planId, contractStart: plan.contractStart, contractEnd: plan.contractEnd || undefined, pepmOverride: num(plan.pepmOverride), minimumOverride: num(plan.minimumOverride),
      setupFeeOverride: num(plan.setupFeeOverride), discountPct: num(plan.discountPct), trialDays: num(plan.trialDays), committedSeats: num(plan.committedSeats),
      billingCycle: plan.billingCycle || undefined, applyModules: plan.applyModules } });
    return "Plan assigned";
  });
  const addAdjustment = () => run(async () => {
    await httpRequest(`/api/v2/platform/billing/accounts/${account!.id}/adjustments`, { method: "POST", body: { kind: adjust.kind, description: adjust.description, amount: Number(adjust.amount) } });
    return `${adjust.kind === "CREDIT" ? "Credit" : "Charge"} queued for the next invoice`;
  });
  const chosen = data.plans.find((item) => item.id === plan.planId);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bill-acc-title">
        <header className="cw-drawer-head">
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{account ? (account.kind === "GROUP" ? `GROUP · ${account.groupName}` : "BRAND") : target.groupId ? "NEW GROUP ACCOUNT" : "NEW BRAND ACCOUNT"}</p>
          <h2 id="bill-acc-title">{account?.legalName || form.legalName || "Billing account"}</h2>
          <p className="cw-head-note">The GSTIN and state decide the tax: same state as the operator → CGST + SGST, otherwise IGST.</p>
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert">{error}</p>}
          <form onSubmit={saveAccount} className={styles.section}>
            <div className={styles.formGrid}>
              <label className="wide">Legal name (as on GST registration)<input required value={form.legalName} onChange={(event) => set("legalName", event.target.value)} /></label>
              <label>GSTIN <small>blank if unregistered</small><input value={form.gstin} maxLength={15} onChange={(event) => set("gstin", event.target.value.toUpperCase())} /></label>
              <label>State (place of supply)<select value={form.stateCode} onChange={(event) => set("stateCode", event.target.value)}>
                {Object.entries(data.states).map(([key, state]) => <option key={key} value={key}>{state.name} ({state.code})</option>)}</select></label>
              <label className="wide">Billing address<textarea required rows={2} value={form.billingAddress} onChange={(event) => set("billingAddress", event.target.value)} /></label>
              <label>Billing contact<input value={form.contactName} onChange={(event) => set("contactName", event.target.value)} /></label>
              <label>Billing email<input required type="email" value={form.contactEmail} onChange={(event) => set("contactEmail", event.target.value)} /></label>
              <label>Phone<input value={form.contactPhone} onChange={(event) => set("contactPhone", event.target.value)} /></label>
              <label>Payment terms (days) <small>default from settings</small><input type="number" min={0} max={120} value={form.paymentTermsDays} onChange={(event) => set("paymentTermsDays", event.target.value)} /></label>
            </div>
            <footer className="cw-create-foot"><button className="cw-btn primary" disabled={busy}><Check size={15} /> {account ? "Save details" : "Create account"}</button></footer>
          </form>
          {account && (
            <>
              <section className={styles.section}>
                <div className={styles.sectionHead}><h2>Subscriptions</h2></div>
                <table className={styles.table}><thead><tr><th>Plan</th><th>Contract</th><th className="num">PEPM</th></tr></thead><tbody>
                  {account.subscriptions.map((sub) => <tr key={sub.id}><td>{sub.planName}<small>{sub.cycle.toLowerCase()} · {sub.usageBasis.toLowerCase()}{sub.discountPct ? ` · ${sub.discountPct}% off` : ""}{sub.trialDays ? ` · ${sub.trialDays}-day trial` : ""}</small></td>
                    <td>{day(sub.contractStart)} – {sub.contractEnd ? day(sub.contractEnd) : "ongoing"}</td><td className="num">{inr(sub.pepmPaise)}</td></tr>)}
                  {!account.subscriptions.length && <tr><td colSpan={3} className="cw-help">No plan yet.</td></tr>}
                </tbody></table>
                <h3 style={{ margin: "16px 0 8px" }}>Assign or change plan</h3>
                <div className={styles.formGrid}>
                  <label>Plan<select value={plan.planId} onChange={(event) => setP("planId", event.target.value)}>{data.plans.map((item) => <option key={item.id} value={item.id}>{item.name} — {inr(item.pepmPaise)} PEPM</option>)}</select></label>
                  <label>Starts on <small>a running plan ends the day before</small><input type="date" value={plan.contractStart} onChange={(event) => setP("contractStart", event.target.value)} /></label>
                  <label>Contract end <small>optional</small><input type="date" value={plan.contractEnd} onChange={(event) => setP("contractEnd", event.target.value)} /></label>
                  <label>Billing cycle<select value={plan.billingCycle} onChange={(event) => setP("billingCycle", event.target.value)}><option value="">Plan default ({chosen?.billingCycle.toLowerCase()})</option><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual (committed seats)</option></select></label>
                  <label>Custom PEPM (₹) <small>plan: {inr(chosen?.pepmPaise)}</small><input type="number" min={0} step="0.01" value={plan.pepmOverride} onChange={(event) => setP("pepmOverride", event.target.value)} /></label>
                  <label>Custom minimum / month (₹) <small>plan: {inr(chosen?.minimumPaise)}</small><input type="number" min={0} step="0.01" value={plan.minimumOverride} onChange={(event) => setP("minimumOverride", event.target.value)} /></label>
                  <label>Custom setup fee (₹) <small>plan: {inr(chosen?.setupFeePaise)}</small><input type="number" min={0} step="0.01" value={plan.setupFeeOverride} onChange={(event) => setP("setupFeeOverride", event.target.value)} /></label>
                  <label>Discount % <small>on PEPM</small><input type="number" min={0} max={100} value={plan.discountPct} onChange={(event) => setP("discountPct", event.target.value)} /></label>
                  <label>Free trial days <small>plan: {chosen?.trialDays}</small><input type="number" min={0} max={90} value={plan.trialDays} onChange={(event) => setP("trialDays", event.target.value)} /></label>
                  <label>Committed seats <small>annual only</small><input type="number" min={0} value={plan.committedSeats} onChange={(event) => setP("committedSeats", event.target.value)} /></label>
                  <label className={`wide ${styles.check}`}><input type="checkbox" checked={plan.applyModules} onChange={(event) => setP("applyModules", event.target.checked)} /> Switch the brand(s) to exactly this plan's modules</label>
                </div>
                <footer className="cw-create-foot"><button className="cw-btn primary" disabled={busy || !plan.planId} onClick={assign}><Check size={15} /> Assign plan</button></footer>
              </section>
              <section className={styles.section}>
                <div className={styles.sectionHead}><h2>One-off credit or charge</h2><p>Added to the next draft invoice (credits never take it below zero).</p></div>
                <div className={styles.formGrid}>
                  <label>Type<select value={adjust.kind} onChange={(event) => setAdjust({ ...adjust, kind: event.target.value })}><option value="CREDIT">Credit (discount)</option><option value="CHARGE">Charge</option></select></label>
                  <label>Amount (₹, before GST)<input type="number" min={0.01} step="0.01" value={adjust.amount} onChange={(event) => setAdjust({ ...adjust, amount: event.target.value })} /></label>
                  <label className="wide">Description (shown on the invoice)<input value={adjust.description} maxLength={200} onChange={(event) => setAdjust({ ...adjust, description: event.target.value })} /></label>
                </div>
                <footer className="cw-create-foot"><button className="cw-btn ghost" disabled={busy || !adjust.amount || adjust.description.length < 3} onClick={addAdjustment}><Plus size={15} /> Queue</button></footer>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ---- invoices ------------------------------------------------------------------------------------------------------------

function InvoicesTab({ version, onOpen, flash, onError, onChanged }: { version: number; onOpen: (id: string) => void; flash: (message: string) => void; onError: (message: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState<InvoiceRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState(previousMonth());
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => httpRequest<{ items: InvoiceRow[] }>(`/api/v2/platform/billing/invoices${status ? `?status=${status}` : ""}`).then((data) => setItems(data.items)).catch((reason) => onError(errorText(reason))), [status, onError]);
  useEffect(() => { load(); }, [load, version]);
  const generate = async () => {
    setBusy(true);
    try {
      const result = await httpRequest<{ generated: number; results: { accountName: string; skipped?: string }[] }>("/api/v2/platform/billing/invoices/generate", { method: "POST", body: { period, demo } });
      const skipped = result.results.filter((item) => item.skipped).map((item) => `${item.accountName}: ${item.skipped}`);
      flash(`${result.generated} draft(s) for ${monthLabel(period)}${skipped.length ? ` · skipped ${skipped.length}` : ""}`);
      if (skipped.length) onError(skipped.join(" · "));
      load(); onChanged();
    } catch (reason) { onError(errorText(reason)); } finally { setBusy(false); }
  };
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.inline}>
          <label className={styles.inline}>Show <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option><option value="DRAFT">Drafts</option><option value="ISSUED">Issued</option></select></label>
        </div>
        <div className={styles.inline}>
          <input type="month" aria-label="Month to invoice" value={period} onChange={(event) => event.target.value && setPeriod(event.target.value)} />
          <label className={styles.inline}><input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} /> Demo (DM/ series)</label>
          <button className="cw-btn primary" disabled={busy} onClick={generate}><FilePlus2 size={15} /> Draft invoices</button>
        </div>
      </div>
      {!items ? <div className="cw-list-skeleton"><i /><i /></div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Invoice</th><th>Account</th><th>Period</th><th>Tax</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((invoice) => (
                <tr key={invoice.id} className="clickable" tabIndex={0} onClick={() => onOpen(invoice.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(invoice.id); } }}>
                  <td><b>{invoice.number || "Draft"}</b>{invoice.isDemo && <span className={styles.demo}>DEMO</span>}<small>{invoice.issueDate ? day(invoice.issueDate) : "not issued"}</small></td>
                  <td>{invoice.accountName}</td>
                  <td>{monthLabel(invoice.periodStart)}</td>
                  <td>{invoice.supplyType === "INTRA" ? "CGST+SGST" : "IGST"}</td>
                  <td className="num">{inr(invoice.totalPaise)}</td>
                  <td className="num">{invoice.status === "ISSUED" ? inr(invoice.outstandingPaise) : "—"}</td>
                  <td>{invoice.status === "DRAFT" ? <span className="cw-badge tone-neutral"><i />Draft</span>
                    : <span className={`cw-badge ${invoice.overdue ? "tone-danger" : PAYMENT_TONE[invoice.paymentState]}`}><i />{invoice.overdue ? `Overdue ${invoice.daysOverdue}d` : PAYMENT_LABEL[invoice.paymentState]}</span>}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="cw-help">No invoices yet. Drafts are created on the 1st of each month, or now with “Draft invoices”.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type InvoiceDetail = InvoiceRow & { seller: { legalName: string; stateCode: string }; buyer: { legalName: string; gstin: string | null; stateCode: string; address: string };
  lines: { id: string; position: number; kind: string; description: string; quantity: number | null; unitPricePaise: number | null; amountPaise: number }[];
  payments: { id: string; amountPaise: number; paidOn: string; mode: string; reference: string | null; status: string; reversedReason: string | null }[];
  creditNotes: { id: string; number: string; issueDate: string; reason: string; totalPaise: number }[]; reminders: { kind: string; sentAt: string }[]; excessPaise: number };

function InvoiceDrawer({ id, onClose, onChanged, flash }: { id: string; onClose: () => void; onChanged: () => void; flash: (message: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, onClose, ref);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const [payment, setPayment] = useState({ amount: "", paidOn: today, mode: "NEFT", reference: "", note: "" });
  const [credit, setCredit] = useState({ amount: "", reason: "" });
  const load = useCallback(() => httpRequest<InvoiceDetail>(`/api/v2/platform/billing/invoices/${id}`).then(setInvoice).catch((reason) => setError(errorText(reason))), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true); setError("");
    try { await work(); flash(message); await load(); onChanged(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const issue = () => { if (window.confirm("Issue this invoice? It gets the next number in the series and can't be edited afterwards (corrections need a credit note).")) act(() => httpRequest(`/api/v2/platform/billing/invoices/${id}/issue`, { method: "POST", body: {} }), "Invoice issued"); };
  const remove = () => { if (window.confirm("Delete this draft? Queued credits go back to the account.")) act(async () => { await httpRequest(`/api/v2/platform/billing/invoices/${id}`, { method: "DELETE" }); onClose(); }, "Draft deleted"); };
  const pay = () => act(() => httpRequest(`/api/v2/platform/billing/invoices/${id}/payments`, { method: "POST", body: { ...payment, amount: Number(payment.amount), reference: payment.reference || undefined, note: payment.note || undefined } })
    .then(() => setPayment({ ...payment, amount: "", reference: "", note: "" })), "Payment recorded");
  const creditNote = () => { if (window.confirm(`Issue a credit note of ₹${credit.amount} + GST? Credit notes are final.`)) act(() => httpRequest(`/api/v2/platform/billing/invoices/${id}/credit-notes`, { method: "POST", body: { amount: Number(credit.amount), reason: credit.reason } })
    .then(() => setCredit({ amount: "", reason: "" })), "Credit note issued"); };
  const reverse = (paymentId: string) => { const reason = window.prompt("Why is this payment being reversed?"); if (reason && reason.length >= 5) act(() => httpRequest(`/api/v2/platform/billing/payments/${paymentId}/reverse`, { method: "POST", body: { reason } }), "Payment reversed"); };
  const download = (path: string, name: string) => downloadFile(path, name).catch((reason) => setError(errorText(reason)));
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bill-inv-title">
        <header className="cw-drawer-head">
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{invoice ? `${invoice.status === "DRAFT" ? "DRAFT" : "TAX INVOICE"} · ${monthLabel(invoice.periodStart).toUpperCase()}` : "INVOICE"}</p>
          <h2 id="bill-inv-title">{invoice?.number || "Draft invoice"}{invoice?.isDemo && <span className={styles.demo}>DEMO</span>}</h2>
          {invoice && <p className="cw-head-note">{invoice.buyer.legalName} · {invoice.buyer.gstin || "unregistered"} · place of supply {invoice.placeOfSupply} → {invoice.supplyType === "INTRA" ? "CGST + SGST" : "IGST"} · SAC {invoice.sacCode}</p>}
        </header>
        <div className="cw-drawer-body">
          {error && <p className="cw-alert" role="alert">{error}</p>}
          {!invoice ? <div className="cw-list-skeleton"><i /></div> : (
            <>
              {invoice.warnings?.map((warning) => <p key={warning} className={styles.warn}>{warning}</p>)}
              <div className={styles.actions} style={{ marginBottom: 14 }}>
                {invoice.status === "DRAFT" && <button className="cw-btn primary" disabled={busy} onClick={issue}><Send size={15} /> Review done — issue</button>}
                {invoice.status === "DRAFT" && <button className="cw-btn danger" disabled={busy} onClick={remove}><Trash2 size={15} /> Delete draft</button>}
                <button className="cw-btn ghost" onClick={() => download(`/api/v2/platform/billing/invoices/${id}/pdf`, `${invoice.number || "draft"}.pdf`)}><Download size={15} /> PDF</button>
              </div>
              <table className={`${styles.table} ${styles.lines}`}>
                <thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>{invoice.lines.map((line) => (
                  <tr key={line.id}><td>{line.position}</td><td>{line.description}</td><td className="num">{line.quantity ?? ""}</td><td className="num">{line.unitPricePaise !== null ? inr(line.unitPricePaise) : ""}</td><td className="num">{inr(line.amountPaise)}</td></tr>))}</tbody>
              </table>
              <div className={styles.totals}>
                <div><span>Taxable value</span><span>{inr(invoice.subtotalPaise)}</span></div>
                {invoice.supplyType === "INTRA" ? <><div><span>CGST {invoice.gstRate / 2}%</span><span>{inr(invoice.cgstPaise)}</span></div><div><span>SGST {invoice.gstRate / 2}%</span><span>{inr(invoice.sgstPaise)}</span></div></>
                  : <div><span>IGST {invoice.gstRate}%</span><span>{inr(invoice.igstPaise)}</span></div>}
                <div className={styles.grand}><span>Total</span><span>{inr(invoice.totalPaise)}</span></div>
                {invoice.status === "ISSUED" && <><div><span>Paid</span><span>{inr(invoice.paidPaise)}</span></div><div><span>Credit notes</span><span>{inr(invoice.creditedPaise)}</span></div>
                  <div className={styles.grand}><span>Balance due {invoice.dueDate ? `(due ${day(invoice.dueDate)})` : ""}</span><span>{inr(invoice.outstandingPaise)}</span></div>
                  {invoice.excessPaise > 0 && <div><span>Excess to refund / adjust</span><span>{inr(invoice.excessPaise)}</span></div>}</>}
              </div>
              {invoice.status === "ISSUED" && (
                <>
                  <section className={styles.section}>
                    <div className={styles.sectionHead}><h2>Payments</h2></div>
                    {invoice.payments.length > 0 && <table className={styles.table}><tbody>{invoice.payments.map((item) => (
                      <tr key={item.id}><td>{day(item.paidOn)}<small>{item.mode}{item.reference ? ` · ${item.reference}` : ""}</small></td><td className="num">{inr(item.amountPaise)}</td>
                        <td>{item.status === "REVERSED" ? <span className="cw-badge tone-neutral" title={item.reversedReason || ""}><i />Reversed</span> : <button className="cw-btn ghost" onClick={() => reverse(item.id)}><Ban size={13} /> Reverse</button>}</td></tr>))}</tbody></table>}
                    {invoice.outstandingPaise > 0 && (
                      <div className={styles.formGrid} style={{ marginTop: 10 }}>
                        <label>Amount (₹) <small>max {inr(invoice.outstandingPaise)}</small><input type="number" min={0.01} max={rupees(invoice.outstandingPaise)} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></label>
                        <label>Received on<input type="date" max={today} value={payment.paidOn} onChange={(event) => setPayment({ ...payment, paidOn: event.target.value })} /></label>
                        <label>Mode<select value={payment.mode} onChange={(event) => setPayment({ ...payment, mode: event.target.value })}>{["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CARD", "CASH", "OTHER"].map((mode) => <option key={mode}>{mode}</option>)}</select></label>
                        <label>UTR / reference<input value={payment.reference} maxLength={60} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></label>
                        <label className="wide"><span /><button className="cw-btn primary" disabled={busy || !payment.amount} onClick={pay}><Check size={15} /> Record payment</button></label>
                      </div>
                    )}
                  </section>
                  <section className={styles.section}>
                    <div className={styles.sectionHead}><div><h2>Credit notes</h2><p>The only way to correct an issued invoice. GST is reversed in the same split.</p></div></div>
                    {invoice.creditNotes.length > 0 && <table className={styles.table}><tbody>{invoice.creditNotes.map((note) => (
                      <tr key={note.id}><td><b>{note.number}</b><small>{day(note.issueDate)} · {note.reason}</small></td><td className="num">{inr(note.totalPaise)}</td>
                        <td><button className="cw-btn ghost" onClick={() => download(`/api/v2/platform/billing/credit-notes/${note.id}/pdf`, `${note.number}.pdf`)}><Download size={13} /> PDF</button></td></tr>))}</tbody></table>}
                    <div className={styles.formGrid} style={{ marginTop: 10 }}>
                      <label>Taxable amount to credit (₹)<input type="number" min={0.01} step="0.01" value={credit.amount} onChange={(event) => setCredit({ ...credit, amount: event.target.value })} /></label>
                      <label>Reason<input value={credit.reason} maxLength={300} onChange={(event) => setCredit({ ...credit, reason: event.target.value })} /></label>
                      <label className="wide"><span /><button className="cw-btn ghost" disabled={busy || !credit.amount || credit.reason.length < 5} onClick={creditNote}><FilePlus2 size={15} /> Issue credit note</button></label>
                    </div>
                  </section>
                  {invoice.reminders.length > 0 && <p className="cw-help">Reminders sent: {invoice.reminders.map((item) => `${item.kind.replace(/_/g, " ").toLowerCase()} (${day(item.sentAt.slice(0, 10))})`).join(", ")}</p>}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ---- receivables ---------------------------------------------------------------------------------------------------------

type Aging = { today: string; totals: Record<string, number>; accounts: { accountId: string; accountName: string; buckets: Record<string, number>; invoices: InvoiceRow[] }[] };
const BUCKETS: [string, string][] = [["current", "Not due"], ["d1_30", "1–30 days"], ["d31_60", "31–60"], ["d61_90", "61–90"], ["d90_plus", "90+"], ["total", "Total"]];

function AgingTab({ version, onOpen, flash, onError }: { version: number; onOpen: (id: string) => void; flash: (message: string) => void; onError: (message: string) => void }) {
  const [data, setData] = useState<Aging | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => httpRequest<Aging>("/api/v2/platform/billing/aging").then(setData).catch((reason) => onError(errorText(reason))), [onError]);
  useEffect(() => { load(); }, [load, version]);
  const runNow = async () => {
    setBusy(true);
    try { const result = await httpRequest<{ reminders: unknown[]; suspension: { policy: string; warned: unknown[]; suspended: unknown[] } }>("/api/v2/platform/billing/receivables/run", { method: "POST", body: {} });
      flash(`${result.reminders.length} reminder(s) sent · suspension policy ${result.suspension.policy}${result.suspension.policy === "ON" ? ` (${result.suspension.warned.length} warned, ${result.suspension.suspended.length} suspended)` : ""}`); load(); }
    catch (reason) { onError(errorText(reason)); } finally { setBusy(false); }
  };
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><h2>Outstanding &amp; aging</h2><p>Issued invoices with a balance, by days past due. Reminders go out automatically 3 days before, on, and 7 days after the due date.</p></div>
        <button className="cw-btn ghost" disabled={busy} onClick={runNow}><Play size={14} /> Run reminders now</button></div>
      {!data ? <div className="cw-list-skeleton"><i /></div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Account</th>{BUCKETS.map(([key, label]) => <th key={key} className="num">{label}</th>)}</tr></thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.accountId}>
                  <td><b>{account.accountName}</b>{account.invoices.map((invoice) => (
                    <small key={invoice.id}><button className="cw-btn ghost" style={{ padding: "2px 6px", marginTop: 4 }} onClick={() => onOpen(invoice.id)}>{invoice.number}</button> {inr(invoice.outstandingPaise)} due {day(invoice.dueDate)}{invoice.isDemo ? " · DEMO" : ""}</small>))}</td>
                  {BUCKETS.map(([key]) => <td key={key} className="num">{account.buckets[key] ? inr(account.buckets[key]) : "—"}</td>)}
                </tr>
              ))}
              {!data.accounts.length && <tr><td colSpan={7} className="cw-help">Nothing outstanding.</td></tr>}
            </tbody>
            {data.accounts.length > 0 && <tfoot><tr><td><b>All accounts</b></td>{BUCKETS.map(([key]) => <td key={key} className="num"><b>{inr(data.totals[key])}</b></td>)}</tr></tfoot>}
          </table>
        </div>
      )}
    </section>
  );
}

// ---- plans ---------------------------------------------------------------------------------------------------------------

function PlansTab({ onError, flash }: { onError: (message: string) => void; flash: (message: string) => void }) {
  const [data, setData] = useState<{ items: Plan[]; modules: string[] } | null>(null);
  const [edit, setEdit] = useState<Partial<Plan> & { pepm?: string; minimum?: string; setup?: string } | null>(null);
  const load = useCallback(() => httpRequest<{ items: Plan[]; modules: string[] }>("/api/v2/platform/billing/plans").then(setData).catch((reason) => onError(errorText(reason))), [onError]);
  useEffect(() => { load(); }, [load]);
  const open = (plan?: Plan) => setEdit(plan ? { ...plan, pepm: String(rupees(plan.pepmPaise)), minimum: String(rupees(plan.minimumPaise)), setup: String(rupees(plan.setupFeePaise)) }
    : { code: "", name: "", description: "", pepm: "", minimum: "0", setup: "0", includedModules: ["core"], billingCycle: "MONTHLY", annualDiscountPct: 0, trialDays: 14, usageBasis: "PEAK", active: true });
  const save = async () => {
    if (!edit) return;
    const body = { name: edit.name, description: edit.description || undefined, pepm: Number(edit.pepm), minimumMonthly: Number(edit.minimum || 0), setupFee: Number(edit.setup || 0),
      includedModules: edit.includedModules, billingCycle: edit.billingCycle, annualDiscountPct: Number(edit.annualDiscountPct || 0), trialDays: Number(edit.trialDays || 0), usageBasis: edit.usageBasis, active: edit.active };
    try {
      if (edit.id) await httpRequest(`/api/v2/platform/billing/plans/${edit.id}`, { method: "PATCH", body: { ...body, version: edit.version } });
      else await httpRequest("/api/v2/platform/billing/plans", { method: "POST", body: { ...body, code: edit.code } });
      flash("Plan saved"); setEdit(null); load();
    } catch (reason) { onError(errorText(reason)); }
  };
  if (!data) return <div className="cw-list-skeleton"><i /></div>;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><h2>Plan catalogue</h2><p>Prices are per employee per month, before GST. Changes apply to invoices drafted afterwards.</p></div>
        <button className="cw-btn primary" onClick={() => open()}><Plus size={15} /> New plan</button></div>
      <div className={styles.cards}>
        {data.items.map((plan) => (
          <article key={plan.id} className={styles.card} style={plan.active ? undefined : { opacity: 0.6 }}>
            <h3>{plan.name} {!plan.active && <small>(retired)</small>}</h3>
            <div className={styles.price}>{inr(plan.pepmPaise)} <small>PEPM</small></div>
            <p>Minimum {inr(plan.minimumPaise)}/month · setup {inr(plan.setupFeePaise)} · {plan.trialDays}-day trial · {plan.billingCycle === "ANNUAL" ? `annual (−${plan.annualDiscountPct}%)` : "monthly"} · bills {plan.usageBasis === "PEAK" ? "peak" : "average"} headcount</p>
            <div className={styles.chips}>{plan.includedModules.map((key) => <span key={key}>{MODULE_LABELS[key] || key}</span>)}</div>
            <p>{plan.accounts} account(s) on this plan</p>
            <div className={styles.actions}><button className="cw-btn ghost" onClick={() => open(plan)}>Edit</button></div>
          </article>
        ))}
      </div>
      {edit && (
        <div className={styles.card}>
          <h3>{edit.id ? `Edit ${edit.name}` : "New plan"}</h3>
          <div className={styles.formGrid}>
            {!edit.id && <label>Code <small>lowercase, e.g. growth</small><input value={edit.code} onChange={(event) => setEdit({ ...edit, code: event.target.value })} /></label>}
            <label>Name<input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></label>
            <label>PEPM (₹)<input type="number" min={0} step="0.01" value={edit.pepm} onChange={(event) => setEdit({ ...edit, pepm: event.target.value })} /></label>
            <label>Minimum per month (₹)<input type="number" min={0} step="0.01" value={edit.minimum} onChange={(event) => setEdit({ ...edit, minimum: event.target.value })} /></label>
            <label>One-time setup fee (₹)<input type="number" min={0} step="0.01" value={edit.setup} onChange={(event) => setEdit({ ...edit, setup: event.target.value })} /></label>
            <label>Free trial (days)<input type="number" min={0} max={90} value={edit.trialDays} onChange={(event) => setEdit({ ...edit, trialDays: Number(event.target.value) })} /></label>
            <label>Billing cycle<select value={edit.billingCycle} onChange={(event) => setEdit({ ...edit, billingCycle: event.target.value as Plan["billingCycle"] })}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select></label>
            <label>Annual discount %<input type="number" min={0} max={50} value={edit.annualDiscountPct} onChange={(event) => setEdit({ ...edit, annualDiscountPct: Number(event.target.value) })} /></label>
            <label>Monthly headcount<select value={edit.usageBasis} onChange={(event) => setEdit({ ...edit, usageBasis: event.target.value as Plan["usageBasis"] })}><option value="PEAK">Peak day (default)</option><option value="AVERAGE">Average of days</option></select></label>
            <label className={styles.check}><input type="checkbox" checked={!!edit.active} onChange={(event) => setEdit({ ...edit, active: event.target.checked })} /> Available for new subscriptions</label>
            <label className="wide">Description<input value={edit.description || ""} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></label>
            <fieldset className="wide" style={{ gridColumn: "1 / -1", border: 0, padding: 0, margin: 0 }}>
              <legend style={{ font: "750 var(--type-label) var(--font-app)", marginBottom: 6 }}>Included modules</legend>
              <div className={styles.chips}>{data.modules.map((key) => (
                <label key={key} className={styles.check} style={{ fontWeight: 600 }}><input type="checkbox" disabled={key === "core"} checked={edit.includedModules?.includes(key) || key === "core"}
                  onChange={(event) => setEdit({ ...edit, includedModules: event.target.checked ? [...(edit.includedModules || []), key] : (edit.includedModules || []).filter((item) => item !== key) })} />{MODULE_LABELS[key] || key}</label>))}</div>
            </fieldset>
          </div>
          <footer className="cw-create-foot"><button className="cw-btn ghost" onClick={() => setEdit(null)}>Cancel</button><button className="cw-btn primary" onClick={save}><Check size={15} /> Save plan</button></footer>
        </div>
      )}
    </section>
  );
}

// ---- settings ------------------------------------------------------------------------------------------------------------

function SettingsTab({ onError, flash }: { onError: (message: string) => void; flash: (message: string) => void }) {
  const [data, setData] = useState<Settings | null>(null);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [states, setStates] = useState<Record<string, { code: string; name: string }>>({});
  const load = useCallback(() => httpRequest<Settings>("/api/v2/platform/billing/settings").then((settings) => { setData(settings); setForm(settings); }).catch((reason) => onError(errorText(reason))), [onError]);
  useEffect(() => { load(); httpRequest<Accounts>("/api/v2/platform/billing/accounts").then((result) => setStates(result.states)).catch(() => {}); }, [load]);
  if (!data) return <div className="cw-list-skeleton"><i /></div>;
  const set = (key: keyof Settings, value: string | number | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const keys: (keyof Settings)[] = ["legalName", "tradeName", "gstin", "pan", "address", "stateCode", "email", "phone", "sacCode", "gstRate", "invoicePrefix", "creditNotePrefix", "paymentTermsDays",
      "bankDetails", "headcountRule", "autoSuspendEnabled", "autoSuspendAfterDays", "suspendWarningDays"];
    const body: Record<string, unknown> = {};
    for (const key of keys) if (form[key] !== data[key]) body[key] = form[key];
    if (!Object.keys(body).length) { flash("Nothing changed"); return; }
    if (body.autoSuspendEnabled === true && !window.confirm(`Turn on automatic suspension? Brands will be warned, then paused ${form.autoSuspendAfterDays} days after an invoice falls due. Data is never deleted.`)) return;
    try { await httpRequest("/api/v2/platform/billing/settings", { method: "PUT", body }); flash("Billing settings saved"); load(); } catch (reason) { onError(errorText(reason)); }
  };
  const text = (key: keyof Settings, label: string, hint?: string, wide = false) => (
    <label className={wide ? "wide" : ""}>{label}{hint && <small>{hint}</small>}<input value={String(form[key] ?? "")} onChange={(event) => set(key, event.target.value)} /></label>);
  return (
    <section className={styles.section}>
      {!data.readiness.canIssue && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> Invoices can't be issued yet: {data.readiness.problems.join(" ")}</p>}
      <div className={styles.card}>
        <h3>Operator (seller) details</h3>
        <p>Printed on every tax invoice. Empty fields fall back to OPERATOR_LEGAL_NAME, OPERATOR_GSTIN, OPERATOR_ADDRESS, OPERATOR_STATE in the server environment.</p>
        <div className={styles.formGrid}>
          {text("legalName", "Legal name", data.sources.legalName === "env" ? "from environment" : undefined)}
          {text("tradeName", "Trade name")}
          {text("gstin", "GSTIN", data.sources.gstin === "env" ? "from environment" : undefined)}
          {text("pan", "PAN")}
          <label>State (decides CGST+SGST vs IGST)<select value={form.stateCode} onChange={(event) => set("stateCode", event.target.value)}>
            {Object.entries(states).map(([key, state]) => <option key={key} value={key}>{state.name} ({state.code})</option>)}</select></label>
          {text("email", "Billing email")}
          <label className="wide">Registered address<textarea rows={2} value={form.address || ""} onChange={(event) => set("address", event.target.value)} /></label>
          <label className="wide">Bank details for payment<textarea rows={2} value={form.bankDetails || ""} onChange={(event) => set("bankDetails", event.target.value)} /></label>
        </div>
      </div>
      <div className={styles.card} style={{ marginTop: 14 }}>
        <h3>Invoicing</h3>
        <div className={styles.formGrid}>
          {text("sacCode", "SAC code", "998315 by default — confirm with your CA")}
          <label>GST rate %<input type="number" min={0} max={28} value={form.gstRate} onChange={(event) => set("gstRate", Number(event.target.value))} /></label>
          {text("invoicePrefix", "Invoice series prefix", `e.g. ${form.invoicePrefix}/2026-27/0001 (max 16 chars)`)}
          {text("creditNotePrefix", "Credit note prefix", `e.g. ${form.creditNotePrefix}/2026-27/0001`)}
          <label>Payment terms (days)<input type="number" min={0} max={120} value={form.paymentTermsDays} onChange={(event) => set("paymentTermsDays", Number(event.target.value))} /></label>
          <label>Billable headcount<select value={form.headcountRule} onChange={(event) => set("headcountRule", event.target.value)}>
            <option value="ACTIVE_WITH_LOGIN">Active employees with a login (default)</option><option value="ALL_ACTIVE_EMPLOYEES">All active employee records</option></select></label>
        </div>
      </div>
      <div className={styles.card} style={{ marginTop: 14 }}>
        <h3>Overdue suspension policy</h3>
        <p>Off by default. When on, the owner is warned first and the brand is paused only after the warning period. Paying (or a credit note clearing the overdue amount) restores access automatically; no data is ever deleted.</p>
        <div className={styles.formGrid}>
          <label className={styles.check}><input type="checkbox" checked={!!form.autoSuspendEnabled} onChange={(event) => set("autoSuspendEnabled", event.target.checked)} /> Automatically suspend overdue brands</label>
          <span />
          <label>Suspend after (days overdue)<input type="number" min={7} max={365} value={form.autoSuspendAfterDays} onChange={(event) => set("autoSuspendAfterDays", Number(event.target.value))} /></label>
          <label>Warn the owner (days before)<input type="number" min={1} max={60} value={form.suspendWarningDays} onChange={(event) => set("suspendWarningDays", Number(event.target.value))} /></label>
        </div>
      </div>
      <footer className="cw-create-foot"><button className="cw-btn primary" onClick={save}><Check size={15} /> Save settings</button></footer>
    </section>
  );
}
