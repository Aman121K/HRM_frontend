"use client";
import { Plus, RefreshCw, RotateCcw, Send, Webhook } from "lucide-react";
import { useState } from "react";
import { relativeTime } from "@/lib/cases";
import { get, send, dateTime, type Delivery, type Subscription, type SubscriptionList } from "./api";
import { Badge, Drawer, Empty, ErrorNote, SecretReveal, Skeleton, useLoad } from "./ui";

type EventType = { type: string; description: string };

export function WebhooksTab({ notify, onChange }: { notify: (message: string) => void; onChange: () => void }) {
  const subs = useLoad(() => get<SubscriptionList>("/webhooks/subscriptions"));
  const types = useLoad(() => get<{ items: EventType[] }>("/webhooks/event-types"));
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Subscription | null>(null);
  const refresh = () => { subs.reload(); onChange(); };
  return (
    <section aria-label="Outgoing webhooks" className="ig-stack">
      <div className="ig-section-head">
        <div><h3>Subscriptions</h3><p className="cw-help">
          Each delivery is signed: <code>x-northstar-signature: v1=HMAC-SHA256(secret, timestamp + "." + body)</code> with <code>x-northstar-timestamp</code>.
          Failed deliveries retry with exponential backoff{subs.data ? ` (${subs.data.maxAttempts} attempts)` : ""}; a subscription is disabled after {subs.data?.disableAfter ?? 10} consecutive failures.</p></div>
        <div className="cw-action-row"><button className="cw-icon-button" aria-label="Refresh" title="Refresh" onClick={refresh}><RefreshCw size={15} /></button>
          <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Add endpoint</button></div>
      </div>
      {subs.loading && !subs.data ? <Skeleton /> : subs.error ? <ErrorNote message={subs.error} /> : !subs.data?.items.length ? (
        <Empty icon={<Webhook size={26} />} title="No webhook endpoints" action={<button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Add your first endpoint</button>}>
          Push employee, leave, payroll, attendance, case and payout events to your own systems in real time.
        </Empty>
      ) : (
        <div className="cw-table" role="table" aria-label="Webhook subscriptions">
          <div className="cw-row head ig-sub-row" role="row"><span>Endpoint</span><span>Events</span><span>Last delivery</span><span className="num">24 h</span><span>Status</span><span /></div>
          {subs.data.items.map((sub) => (
            <button key={sub.id} className="cw-row ig-sub-row" role="row" onClick={() => setOpen(sub)}>
              <span className="cw-title-cell"><small className="ig-url">{sub.url}</small><b>{sub.name}</b></span>
              <span>{sub.eventTypes.length} event{sub.eventTypes.length === 1 ? "" : "s"}<small className="ig-sub">{sub.eventTypes.slice(0, 2).join(", ")}{sub.eventTypes.length > 2 ? "…" : ""}</small></span>
              <span>{sub.lastDeliveryAt ? relativeTime(sub.lastDeliveryAt) : "—"}{sub.consecutiveFailures > 0 && <small className="ig-warn">{sub.consecutiveFailures} failures in a row</small>}</span>
              <span className="num">{sub.deliveries24h}{sub.failed24h > 0 && <small className="ig-warn">{sub.failed24h} failed</small>}</span>
              <span><Badge status={sub.status} /></span>
              <span className="cw-row-cta"><em>Open</em></span>
            </button>
          ))}
        </div>
      )}
      {creating && <SubscriptionForm types={types.data?.items || []} onClose={() => setCreating(false)} onSaved={() => { refresh(); notify("Endpoint added."); }} />}
      {open && <SubscriptionDrawer sub={open} types={types.data?.items || []} onClose={() => setOpen(null)} notify={notify} onChange={(next) => { refresh(); if (next) setOpen(next); }} />}
    </section>
  );
}

function EventPicker({ types, value, onChange }: { types: EventType[]; value: string[]; onChange: (value: string[]) => void }) {
  const groups = types.reduce<Record<string, EventType[]>>((acc, type) => ({ ...acc, [type.type.split(".")[0]]: [...(acc[type.type.split(".")[0]] || []), type] }), {});
  return (
    <fieldset className="ig-events">
      <legend>Events <em>*</em></legend>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <small>{group}</small>
          {items.map((type) => (
            <label key={type.type} title={type.description}>
              <input type="checkbox" checked={value.includes(type.type)} onChange={(event) => onChange(event.target.checked ? [...value, type.type] : value.filter((item) => item !== type.type))} />
              <span><code>{type.type}</code><small>{type.description}</small></span>
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}

function SubscriptionForm({ types, onClose, onSaved }: { types: EventType[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", url: "https://", eventTypes: ["employee.created", "leave.approved", "payroll.published"] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ secret: string; secretNotice: string } | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { setSecret(await send<{ secret: string; secretNotice: string }>("/webhooks/subscriptions", form)); onSaved(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  return (
    <Drawer title={secret ? "Endpoint added" : "Add a webhook endpoint"} eyebrow="WEBHOOKS" onClose={onClose}>
      {secret ? <SecretReveal title="Signing secret" notice={secret.secretNotice} onDone={onClose} items={[{ label: "Signing secret", value: secret.secret, hint: "Verify x-northstar-signature with it" }]} /> : (
        <form className="cw-create" onSubmit={submit}>
          <ErrorNote message={error} />
          <div className="cw-fields">
            <label className="wide"><span>Name <em>*</em></span><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Finance ERP sync" /></label>
            <label className="wide"><span>Endpoint URL <em>*</em> <small>https only (http://localhost allowed in development)</small></span><input required type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label>
          </div>
          <EventPicker types={types} value={form.eventTypes} onChange={(eventTypes) => setForm({ ...form, eventTypes })} />
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy || !form.eventTypes.length}>{busy ? "Adding…" : "Add endpoint"}</button></div>
        </form>
      )}
    </Drawer>
  );
}

function SubscriptionDrawer({ sub, types, onClose, notify, onChange }: { sub: Subscription; types: EventType[]; onClose: () => void; notify: (message: string) => void; onChange: (next?: Subscription) => void }) {
  const [form, setForm] = useState({ name: sub.name, url: sub.url, eventTypes: sub.eventTypes });
  const [filter, setFilter] = useState("");
  const deliveries = useLoad(() => get<{ items: Delivery[] }>(`/webhooks/subscriptions/${sub.id}/deliveries?limit=50${filter ? `&status=${filter}` : ""}`), [sub.id, filter]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ secret: string; secretNotice: string } | null>(null);
  const [expanded, setExpanded] = useState("");
  const act = async (work: () => Promise<void>, message: string) => {
    setBusy(true); setError("");
    try { await work(); notify(message); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const patch = (body: Record<string, unknown>, message: string) => act(async () => {
    const row = await send<{ version: number; status: string }>(`/webhooks/subscriptions/${sub.id}`, { ...body, version: sub.version }, "PATCH");
    onChange({ ...sub, ...form, ...body, status: row.status, version: row.version, consecutiveFailures: body.status === "ACTIVE" ? 0 : sub.consecutiveFailures, disabledReason: body.status === "ACTIVE" ? null : sub.disabledReason } as Subscription);
  }, message);
  const test = () => act(async () => {
    const result = await send<{ status: string; responseCode: number | null; error: string | null }>(`/webhooks/subscriptions/${sub.id}/test`, {});
    await deliveries.reload(); onChange();
    if (result.status !== "SUCCEEDED") throw new Error(`Test delivery failed: ${result.error || `HTTP ${result.responseCode}`}. It will be retried.`);
  }, "Test event delivered.");
  return (
    <Drawer title={sub.name} eyebrow="WEBHOOK ENDPOINT" onClose={onClose}>
      {secret ? <SecretReveal title="New signing secret" notice={secret.secretNotice} onDone={() => setSecret(null)} items={[{ label: "Signing secret", value: secret.secret }]} /> : (
        <>
          <div className="cw-head-meta"><Badge status={sub.status} /><span>Secret …{sub.secretHint}</span><span>Added by {sub.createdBy}</span></div>
          {sub.disabledReason && sub.status === "DISABLED" && <p className="cw-alert warn">{sub.disabledReason}</p>}
          <ErrorNote message={error} />
          <div className="cw-action-row ig-left">
            <button className="cw-btn primary" disabled={busy || sub.status !== "ACTIVE"} onClick={test}><Send size={14} /> Send test event</button>
            <button className="cw-btn ghost" disabled={busy} onClick={() => patch({ status: sub.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }, sub.status === "ACTIVE" ? "Endpoint disabled." : "Endpoint re-enabled.")}>{sub.status === "ACTIVE" ? "Disable" : "Enable"}</button>
            <button className="cw-btn ghost" disabled={busy} onClick={() => act(async () => { const result = await send<{ secret: string; secretNotice: string; version: number }>(`/webhooks/subscriptions/${sub.id}/rotate`, { version: sub.version }); setSecret(result); onChange({ ...sub, version: result.version }); }, "Secret rotated.")}><RotateCcw size={14} /> Rotate secret</button>
          </div>
          <form className="cw-create" onSubmit={(event) => { event.preventDefault(); patch({ name: form.name, url: form.url, eventTypes: form.eventTypes }, "Endpoint saved."); }}>
            <div className="cw-fields">
              <label className="wide"><span>Name</span><input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="wide"><span>URL</span><input required type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label>
            </div>
            <EventPicker types={types} value={form.eventTypes} onChange={(eventTypes) => setForm({ ...form, eventTypes })} />
            <div className="cw-action-row"><button className="cw-btn primary" disabled={busy || !form.eventTypes.length}>Save changes</button></div>
          </form>
          <div>
            <div className="ig-section-head"><p className="cw-section-label">Delivery log</p>
              <select aria-label="Filter deliveries" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="">All</option><option value="SUCCEEDED">Succeeded</option><option value="RETRYING">Retrying</option><option value="FAILED">Failed</option><option value="PENDING">Pending</option><option value="SKIPPED">Skipped</option>
              </select></div>
            {deliveries.loading && !deliveries.data ? <Skeleton rows={2} /> : deliveries.error ? <ErrorNote message={deliveries.error} /> : !deliveries.data?.items.length ? <p className="ig-muted">No deliveries yet — send a test event.</p> : (
              <ul className="ig-deliveries">
                {deliveries.data.items.map((item) => (
                  <li key={item.id}>
                    <button className="ig-delivery-head" aria-expanded={expanded === item.id} onClick={() => setExpanded(expanded === item.id ? "" : item.id)}>
                      <span><b>{item.isTest ? "webhook.test" : item.eventType}</b><small>{dateTime(item.createdAt)} · attempt {item.attempts}{item.responseCode ? ` · HTTP ${item.responseCode}` : ""}{item.responseMs !== null ? ` · ${item.responseMs} ms` : ""}</small></span>
                      <Badge status={item.status} />
                    </button>
                    {expanded === item.id && (
                      <div className="ig-delivery-body">
                        {item.error && <p className="ig-warn">{item.error}</p>}
                        <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                        {item.responseExcerpt && <><small>Response</small><pre>{item.responseExcerpt}</pre></>}
                        {["FAILED", "SUCCEEDED", "SKIPPED"].includes(item.status) && sub.status === "ACTIVE" &&
                          <button className="cw-btn ghost" disabled={busy} onClick={() => act(async () => { await send(`/webhooks/deliveries/${item.id}/redeliver`, {}); await deliveries.reload(); }, "Delivery re-queued.")}>Redeliver</button>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
