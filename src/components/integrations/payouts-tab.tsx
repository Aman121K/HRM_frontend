"use client";
import { Banknote, CheckCircle2, Download, Plus, RefreshCw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { loadDefinitions } from "@/lib/cases";
import { downloadFile } from "@/lib/http-client";
import { BASE, get, send, dateTime, label, periodLabel, rupees, type Batch, type BatchDetail, type PayoutConfig, type Run } from "./api";
import { Badge, Drawer, Empty, ErrorNote, Skeleton, readTextFile, useLoad } from "./ui";

export function PayoutsTab({ notify, onChange }: { notify: (message: string) => void; onChange: () => void }) {
  const config = useLoad(() => get<PayoutConfig>("/payouts/config"));
  const batches = useLoad(() => get<{ items: Batch[] }>("/payouts/batches"));
  const runs = useLoad(() => get<{ items: Run[] }>("/payouts/runs"));
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [viewer, setViewer] = useState("");
  useEffect(() => { loadDefinitions().then(({ viewer: v }) => setViewer(v.employeeId)).catch(() => undefined); }, []);
  const refresh = () => { batches.reload(); runs.reload(); onChange(); };
  return (
    <section aria-label="Bank payouts" className="ig-stack">
      <div className="ig-adapters">
        {config.loading && !config.data ? <Skeleton rows={1} /> : config.error ? <ErrorNote message={config.error} /> : config.data?.adapters.map((adapter) => (
          <article key={adapter.key}>
            <header><b>{adapter.label}</b>{adapter.mode ? <Badge status={adapter.mode === "LIVE" ? "ACTIVE" : "PENDING"} text={adapter.mode === "LIVE" ? "Live" : "Sandbox"} /> : <Badge status="ACTIVE" text="Ready" />}</header>
            <p>{adapter.description}</p><small>{adapter.detail}</small>
          </article>
        ))}
        {config.data && <article><header><b>Status webhook</b><Badge status={config.data.statusWebhook.configured ? "ACTIVE" : "PENDING"} text={config.data.statusWebhook.configured ? "Configured" : "Not configured"} /></header>
          <p>Providers POST status changes to <code>{config.data.statusWebhook.path}</code>, verified with <code>{config.data.statusWebhook.signatureHeader}</code>.</p><small>{config.data.statusWebhook.detail} · polled every {config.data.syncJob.every}</small></article>}
      </div>

      <div className="ig-section-head">
        <div><h3>Payout batches</h3><p className="cw-help">Maker-checker: the administrator who prepares a batch cannot release it. Account numbers stay masked except inside the released bank file.</p></div>
        <div className="cw-action-row"><button className="cw-icon-button" aria-label="Refresh" title="Refresh" onClick={refresh}><RefreshCw size={15} /></button>
          <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> New batch from payroll</button></div>
      </div>
      {batches.loading && !batches.data ? <Skeleton /> : batches.error ? <ErrorNote message={batches.error} /> : !batches.data?.items.length ? (
        <Empty icon={<Banknote size={26} />} title="No payout batches yet" action={<button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> Create from an approved run</button>}>
          Turn an approved payroll run into bank payouts — as a host-to-host file or through the payouts API.
        </Empty>
      ) : (
        <div className="cw-table" role="table" aria-label="Payout batches">
          <div className="cw-row head ig-batch-row" role="row"><span>Batch</span><span>Channel</span><span className="num">Amount</span><span>Progress</span><span>Status</span><span /></div>
          {batches.data.items.map((batch) => (
            <button key={batch.id} className={`cw-row ig-batch-row ${batch.status === "DRAFT" && batch.createdById !== viewer ? "actionable" : ""}`} role="row" onClick={() => setOpen(batch.id)}>
              <span className="cw-title-cell"><small>{batch.reference}</small><b>{periodLabel(batch.period)} salaries</b></span>
              <span>{label(batch.adapter.replace("API_RAZORPAYX", "Payouts API").replace("H2H_BANK_CSV", "Bank CSV").replace("H2H_GENERIC", "H2H file"))}<small className="ig-sub">{batch.mode}</small></span>
              <span className="num">{rupees(batch.totalAmount)}<small className="ig-sub">{batch.payoutCount} payees{batch.skippedCount ? ` · ${batch.skippedCount} skipped` : ""}</small></span>
              <span><Progress done={batch.processed || 0} failed={batch.failed || 0} total={batch.payoutCount} /></span>
              <span><Badge status={batch.status} text={batch.status === "DRAFT" ? "Awaiting release" : undefined} /></span>
              <span className="cw-row-cta"><em>Open</em></span>
            </button>
          ))}
        </div>
      )}
      {creating && <CreateBatch runs={runs.data?.items || []} adapters={config.data?.adapters || []} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refresh(); setOpen(id); notify("Draft batch created — another administrator must release it."); }} />}
      {open && <BatchDrawer id={open} onClose={() => setOpen(null)} notify={notify} onChange={refresh} />}
    </section>
  );
}

function Progress({ done, failed, total }: { done: number; failed: number; total: number }) {
  const pct = (value: number) => (total ? (value / total) * 100 : 0);
  return (
    <span className="ig-progress" role="img" aria-label={`${done} of ${total} processed, ${failed} failed`}>
      <span><i style={{ width: `${pct(done)}%` }} /><i className="bad" style={{ width: `${pct(failed)}%` }} /></span>
      <small>{done}/{total}{failed ? ` · ${failed} failed` : ""}</small>
    </span>
  );
}

function CreateBatch({ runs, adapters, onClose, onCreated }: { runs: Run[]; adapters: PayoutConfig["adapters"]; onClose: () => void; onCreated: (id: string) => void }) {
  const eligible = runs.filter((run) => run.payable && !run.batchId);
  const [form, setForm] = useState({ runId: eligible[0]?.id || "", adapter: "API_RAZORPAYX", mode: "NEFT" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = runs.find((item) => item.id === form.runId);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await send<{ id: string }>("/payouts/batches", form); onCreated(result.id); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  return (
    <Drawer title="New payout batch" eyebrow="BANK PAYOUTS" onClose={onClose}>
      <form className="cw-create" onSubmit={submit}>
        <ErrorNote message={error} />
        {!eligible.length && <p className="cw-alert warn">No approved payroll run is waiting for payment. Runs must be approved (or published) and not already in a live batch.</p>}
        <div className="cw-fields">
          <label className="wide"><span>Payroll run</span>
            <select required value={form.runId} onChange={(event) => setForm({ ...form, runId: event.target.value })}>
              {!eligible.length && <option value="">None available</option>}
              {eligible.map((item) => <option key={item.id} value={item.id}>{periodLabel(item.period)} · {item.status.toLowerCase()} · net {rupees(item.totals?.net)}</option>)}
            </select></label>
          <label className="wide"><span>Channel</span>
            <select value={form.adapter} onChange={(event) => setForm({ ...form, adapter: event.target.value })}>
              {adapters.map((adapter) => <option key={adapter.key} value={adapter.key}>{adapter.label}{adapter.mode === "SANDBOX" ? " (sandbox)" : ""}</option>)}
            </select></label>
          <label><span>Transfer mode</span><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option>NEFT</option><option>IMPS</option><option>RTGS</option></select></label>
        </div>
        {run && <dl className="cw-facts">
          <div><dt>Employees payable</dt><dd>{run.totals?.payable ?? "—"}<small>{run.totals?.held ? `${run.totals.held} held — skipped` : "No holds"}</small></dd></div>
          <div><dt>Run net pay</dt><dd className="cw-amount">{rupees(run.totals?.net)}</dd></div>
        </dl>}
        <p className="cw-help">Held, zero-pay and missing-bank lines are skipped with a reason. The batch total plus skipped amounts must equal the run’s net pay.</p>
        <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy || !form.runId}>{busy ? "Preparing…" : "Prepare draft batch"}</button></div>
      </form>
    </Drawer>
  );
}

function BatchDrawer({ id, onClose, notify, onChange }: { id: string; onClose: () => void; notify: (message: string) => void; onChange: () => void }) {
  const state = useLoad(() => get<BatchDetail>(`/payouts/batches/${id}`), [id]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const batch = state.data;
  const inFlight = batch && ["RELEASED", "PROCESSING"].includes(batch.status) && batch.adapterKind === "API";
  const reload = state.reload;
  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => reload(), 10_000);
    return () => window.clearInterval(timer);
  }, [inFlight, reload]);
  const act = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true); setError("");
    try { const next = await work(); if (next && typeof next === "object" && "items" in (next as object)) state.setData(next as BatchDetail); else await state.reload(); notify(message); onChange(); }
    catch (reason) { setError((reason as Error).message); } finally { setBusy(false); setConfirm(false); }
  };
  if (!batch) return <Drawer title="Payout batch" eyebrow="BANK PAYOUTS" onClose={onClose}>{state.error ? <ErrorNote message={state.error} /> : <Skeleton rows={4} />}</Drawer>;
  const paid = batch.items.filter((item) => item.status !== "SKIPPED");
  const skipped = batch.items.filter((item) => item.status === "SKIPPED");
  return (
    <Drawer title={`${periodLabel(batch.period)} salaries`} eyebrow={`${batch.reference} · ${batch.adapterLabel.toUpperCase()}`} onClose={onClose}>
      <div className="cw-head-meta"><Badge status={batch.status} text={batch.status === "DRAFT" ? "Awaiting release" : undefined} /><span>Prepared by {batch.createdBy} · {dateTime(batch.createdAt)}</span>{batch.releasedBy && <span>Released by {batch.releasedBy} · {dateTime(batch.releasedAt)}</span>}</div>
      <ErrorNote message={error} />
      <div className="ig-totals">
        <div><small>To pay</small><b>{rupees(batch.totalAmount)}</b></div>
        <div><small>Skipped (owed)</small><b>{rupees(batch.skippedAmount)}</b></div>
        <div><small>Run net pay</small><b>{rupees(batch.runNet)}</b></div>
        <div className={batch.reconciled ? "ok" : "bad"}><small>Reconciliation</small><b>{batch.reconciled ? <><CheckCircle2 size={15} /> Matches run</> : <><XCircle size={15} /> Mismatch</>}</b></div>
      </div>

      {batch.status === "DRAFT" && (
        <div className="cw-action-panel">
          {batch.releaseBlockedReason ? <p className="ig-maker"><ShieldCheck size={16} /> {batch.releaseBlockedReason}</p> : confirm ? (
            <div className="ig-confirm"><p>Release {rupees(batch.totalAmount)} to {batch.payoutCount} employees via {batch.adapterLabel}? {batch.adapterKind === "API" ? "Payouts are submitted immediately." : "The bank file becomes downloadable."}</p>
              <div className="cw-action-row"><button className="cw-btn ghost" onClick={() => setConfirm(false)}>Not yet</button><button className="cw-btn primary" disabled={busy} onClick={() => act(() => send(`/payouts/batches/${id}/release`, { version: batch.version }), "Batch released.")}>Release payouts</button></div></div>
          ) : <div className="cw-action-row"><button className="cw-btn primary" onClick={() => setConfirm(true)}><ShieldCheck size={15} /> Review &amp; release</button></div>}
          <div className="cw-action-row"><button className="cw-btn ghost" disabled={busy} onClick={() => act(() => send(`/payouts/batches/${id}/cancel`, { version: batch.version }), "Batch cancelled.")}>Cancel batch</button></div>
        </div>
      )}
      {batch.status !== "DRAFT" && batch.status !== "CANCELLED" && (
        <div className="cw-action-row ig-left">
          {batch.adapterKind === "FILE" && batch.canDownloadFile === false && <p className="ig-maker"><ShieldCheck size={16} /> The bank file can be downloaded only by a payroll administrator or owner who did not prepare this payroll run.</p>}
          {batch.adapterKind === "FILE" && batch.canDownloadFile !== false && <button className="cw-btn primary" onClick={() => downloadFile(`${BASE}/payouts/batches/${id}/file`, `${batch.reference}.txt`).then(() => notify("Bank file downloaded.")).catch((reason: Error) => setError(reason.message))}><Download size={15} /> Download bank file</button>}
          {batch.adapterKind === "API" && <button className="cw-btn ghost" disabled={busy} onClick={() => act(() => send(`/payouts/batches/${id}/sync`, {}), "Statuses refreshed.")}><RefreshCw size={15} /> Sync status now</button>}
          {batch.adapterKind === "FILE" && ["RELEASED", "PROCESSING", "PARTIAL"].includes(batch.status) && <BankResponse id={id} onDone={(message) => { notify(message); state.reload(); onChange(); }} onError={setError} />}
        </div>
      )}
      {batch.fileChecksum && <p className="cw-help">File checksum (SHA-256): <code className="ig-hash">{batch.fileChecksum}</code></p>}

      <div>
        <p className="cw-section-label">Payouts ({paid.length})</p>
        <ul className="ig-payouts">
          {paid.map((item) => (
            <li key={item.id}>
              <span><b>{item.employeeName}</b><small>{item.employeeNumber} · {item.bankName || "Bank"} {item.account} · {item.ifsc}</small>
                {item.utr && <small>UTR {item.utr}</small>}{item.failureReason && <small className="ig-warn">{item.failureReason}</small>}</span>
              <span className="num">{rupees(item.amount)}</span>
              <Badge status={item.status} />
            </li>
          ))}
        </ul>
        {skipped.length > 0 && <>
          <button className="cw-btn ghost ig-left" aria-expanded={showSkipped} onClick={() => setShowSkipped(!showSkipped)}>{showSkipped ? "Hide" : "Show"} {skipped.length} skipped</button>
          {showSkipped && <ul className="ig-payouts">{skipped.map((item) => (
            <li key={item.id}><span><b>{item.employeeName}</b><small className="ig-warn">{item.skipReason}</small></span><span className="num">{rupees(item.amount)}</span><Badge status="SKIPPED" /></li>
          ))}</ul>}
        </>}
      </div>

      <div className="cw-timeline">
        <p className="cw-section-label">Status timeline</p>
        <ol>{batch.events.map((event) => (
          <li key={event.id}><span className={`cw-avatar small ${event.source === "USER" ? "" : "muted"}`}>{event.source === "USER" ? (event.actor || "U").split(" ").map((part) => part[0]).slice(0, 2).join("") : event.source.slice(0, 2)}</span>
            <div><b className="to">{label(event.status)}</b>{event.employeeName && <> · {event.employeeName}</>}<time>{dateTime(event.createdAt)}</time>
              <p>{event.note}<span className="cw-event-data">{label(event.source)}{event.actor ? ` · ${event.actor}` : ""}</span></p></div></li>
        ))}</ol>
      </div>
    </Drawer>
  );
}

function BankResponse({ id, onDone, onError }: { id: string; onDone: (message: string) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`cw-btn ghost ig-file-button ${busy ? "busy" : ""}`}>
      <Upload size={15} /> Import bank response
      <input type="file" accept=".csv,text/csv" aria-label="Bank response CSV (reference,status,utr,reason)" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true);
        try {
          const csv = await readTextFile(file);
          const result = await send<{ applied: number; errors: string[] }>(`/payouts/batches/${id}/bank-response`, { csv });
          if (result.errors.length) onError(result.errors.slice(0, 5).join(" · "));
          onDone(`Applied ${result.applied} status update(s) from the bank.`);
        } catch (reason) { onError((reason as Error).message); } finally { setBusy(false); event.target.value = ""; }
      }} />
    </label>
  );
}
