"use client";
import { BookOpen, CheckCircle2, Download, FileSpreadsheet, FileCode2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadFile } from "@/lib/http-client";
import { BASE, get, send, dateTime, periodLabel, rupees, type ExportRow, type LedgerSettings, type Preview, type Run } from "./api";
import { Badge, Empty, ErrorNote, Skeleton, useLoad } from "./ui";

const monthOptions = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    return date.toISOString().slice(0, 7);
  });
};

export function AccountingTab({ notify, onChange }: { notify: (message: string) => void; onChange: () => void }) {
  const settings = useLoad(() => get<LedgerSettings>("/accounting/settings"));
  const runs = useLoad(() => get<{ items: Run[] }>("/accounting/runs"));
  const history = useLoad(() => get<{ items: ExportRow[] }>("/accounting/exports"));
  return (
    <section aria-label="Accounting exports" className="ig-stack">
      <LedgerForm state={settings} notify={notify} onSaved={() => { settings.reload(); onChange(); }} />
      <ExportPanel runs={runs.data?.items || []} runsError={runs.error} configured={!!settings.data?.configured} notify={notify}
        onExported={() => { history.reload(); runs.reload(); onChange(); }} />
      <History state={history} />
    </section>
  );
}

function LedgerForm({ state, notify, onSaved }: { state: ReturnType<typeof useLoad<LedgerSettings>>; notify: (message: string) => void; onSaved: () => void }) {
  const [form, setForm] = useState<LedgerSettings | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (state.data) { setForm(state.data); setOpen(!state.data.configured); } }, [state.data]);
  if (state.loading && !state.data) return <Skeleton rows={2} />;
  if (state.error) return <ErrorNote message={state.error} />;
  if (!form) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await send("/accounting/settings", { companyName: form.companyName, ledgers: form.ledgers, journalVoucherType: form.journalVoucherType, paymentVoucherType: form.paymentVoucherType, version: form.version }, "PUT");
      notify("Ledger mapping saved."); setOpen(false); onSaved();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="ig-card">
      <div className="ig-section-head">
        <div><h3>Ledger mapping</h3><p className="cw-help">Names must match the ledgers in your Tally company exactly (or the account names in your ERP).</p></div>
        <div className="cw-action-row">{form.configured ? <Badge status="ACTIVE" text="Configured" /> : <Badge status="PENDING" text="Not saved yet" />}
          <button className="cw-btn ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Edit mapping"}</button></div>
      </div>
      {open && (
        <form onSubmit={save} className="ig-ledger-form">
          <ErrorNote message={error} />
          <div className="cw-fields">
            <label className="wide"><span>Tally company name</span><input required minLength={2} maxLength={120} value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label>
            <label><span>Journal voucher type</span><input required value={form.journalVoucherType} onChange={(event) => setForm({ ...form, journalVoucherType: event.target.value })} /></label>
            <label><span>Payment voucher type</span><input required value={form.paymentVoucherType} onChange={(event) => setForm({ ...form, paymentVoucherType: event.target.value })} /></label>
            {form.fields.map((field) => (
              <label key={field.key}><span>{field.label}</span><input required minLength={2} maxLength={120} value={form.ledgers[field.key] || ""} onChange={(event) => setForm({ ...form, ledgers: { ...form.ledgers, [field.key]: event.target.value } })} /></label>
            ))}
          </div>
          <div className="cw-create-foot"><button type="button" className="cw-btn ghost" onClick={() => { setForm(state.data); setOpen(false); }}>Cancel</button><button className="cw-btn primary" disabled={busy}>{busy ? "Saving…" : "Save mapping"}</button></div>
        </form>
      )}
    </div>
  );
}

function ExportPanel({ runs, runsError, configured, notify, onExported }: { runs: Run[]; runsError: string; configured: boolean; notify: (message: string) => void; onExported: () => void }) {
  const [kind, setKind] = useState<"PAYROLL_JOURNAL" | "EXPENSE_PAYMENTS">("PAYROLL_JOURNAL");
  const exportable = runs.filter((run) => run.exportable);
  const [runId, setRunId] = useState("");
  const [month, setMonth] = useState(monthOptions()[0]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!runId && exportable[0]) setRunId(exportable[0].id); }, [exportable, runId]);
  useEffect(() => {
    const query = kind === "PAYROLL_JOURNAL" ? (runId ? `runId=${runId}` : "") : `month=${month}`;
    if (!query) { setPreview(null); return; }
    let live = true;
    setBusy(true); setError("");
    get<Preview>(`/accounting/preview?kind=${kind}&${query}`).then((value) => live && setPreview(value)).catch((reason: Error) => { if (live) { setPreview(null); setError(reason.message); } }).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [kind, runId, month]);
  const create = async (format: "TALLY_XML" | "CSV") => {
    setBusy(true); setError("");
    try {
      const result = await send<{ id: string; fileName: string }>("/accounting/exports", { kind, format, ...(kind === "PAYROLL_JOURNAL" ? { runId } : { month }) });
      await downloadFile(`${BASE}/accounting/exports/${result.id}/download`, result.fileName);
      notify(`Exported ${result.fileName}.`); onExported();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const nothing = preview && preview.vouchers.length === 0;
  return (
    <div className="ig-card">
      <div className="ig-section-head"><div><h3>Export vouchers</h3><p className="cw-help">Every export is checked against the payroll run totals and refused unless debits equal credits.</p></div></div>
      <div className="cw-fields ig-export-controls">
        <label><span>What to export</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="PAYROLL_JOURNAL">Payroll journal (approved run)</option><option value="EXPENSE_PAYMENTS">Paid expense claims (month)</option>
          </select></label>
        {kind === "PAYROLL_JOURNAL" ? (
          <label><span>Payroll run</span>
            <select value={runId} onChange={(event) => setRunId(event.target.value)} disabled={!exportable.length}>
              {!exportable.length && <option value="">No approved runs</option>}
              {exportable.map((run) => <option key={run.id} value={run.id}>{periodLabel(run.period)} · {run.status.toLowerCase()}{run.lastExportedAt ? " · exported" : ""}</option>)}
            </select></label>
        ) : (
          <label><span>Month paid</span><select value={month} onChange={(event) => setMonth(event.target.value)}>{monthOptions().map((value) => <option key={value} value={value}>{periodLabel(value)}</option>)}</select></label>
        )}
      </div>
      <ErrorNote message={runsError || error} />
      {!configured && <p className="cw-alert warn">Save the ledger mapping above before exporting. The preview uses the suggested ledger names.</p>}
      {busy && !preview ? <Skeleton rows={3} /> : preview && (
        nothing ? <Empty icon={<BookOpen size={24} />} title="Nothing to export">{preview.notes[0]}</Empty> : (
          <>
            {preview.vouchers.slice(0, 20).map((voucher) => (
              <div key={voucher.number} className="ig-voucher">
                <header><b>{voucher.type} · {voucher.number}</b><span>{voucher.date}</span></header>
                <p>{voucher.narration}</p>
                <div className="ig-lines" role="table" aria-label={`Voucher ${voucher.number} lines`}>
                  <div className="ig-line head" role="row"><span>Ledger</span><span className="num">Debit</span><span className="num">Credit</span></div>
                  {voucher.lines.map((line, index) => (
                    <div key={index} className="ig-line" role="row"><span>{line.ledger}{line.note && <small>{line.note}</small>}</span><span className="num">{line.debit ? rupees(line.debit) : ""}</span><span className="num">{line.credit ? rupees(line.credit) : ""}</span></div>
                  ))}
                </div>
              </div>
            ))}
            {preview.vouchers.length > 20 && <p className="cw-help">+ {preview.vouchers.length - 20} more vouchers in the file.</p>}
            <div className="ig-totals">
              <div><small>Total debit</small><b>{rupees(preview.totals.debit)}</b></div>
              <div><small>Total credit</small><b>{rupees(preview.totals.credit)}</b></div>
              <div><small>Vouchers · lines</small><b>{preview.totals.vouchers} · {preview.totals.lines}</b></div>
              <div className={preview.balanced ? "ok" : "bad"}><small>Status</small><b>{preview.balanced ? "Balanced & reconciled" : "Does not reconcile"}</b></div>
            </div>
            <ul className="ig-checks" aria-label="Reconciliation checks">
              {preview.checks.map((check) => (
                <li key={check.label} className={check.ok ? "ok" : "bad"}>{check.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}<span>{check.label}</span><em>{check.ok ? rupees(check.actual) : `${rupees(check.expected)} expected, ${rupees(check.actual)} found`}</em></li>
              ))}
            </ul>
            {preview.notes.map((note) => <p key={note} className="cw-help">{note}</p>)}
            <div className="cw-action-row">
              <button className="cw-btn ghost" disabled={busy || !preview.balanced || !configured} onClick={() => create("CSV")}><FileSpreadsheet size={15} /> Export CSV (ERP)</button>
              <button className="cw-btn primary" disabled={busy || !preview.balanced || !configured} onClick={() => create("TALLY_XML")}><FileCode2 size={15} /> Export Tally XML</button>
            </div>
          </>
        )
      )}
    </div>
  );
}

function History({ state }: { state: ReturnType<typeof useLoad<{ items: ExportRow[] }>> }) {
  const [error, setError] = useState("");
  return (
    <div>
      <p className="cw-section-label">Export history</p>
      <ErrorNote message={state.error || error} />
      {state.loading && !state.data ? <Skeleton rows={2} /> : !state.data?.items.length ? <p className="ig-muted">No exports yet.</p> : (
        <div className="cw-table" role="table" aria-label="Export history">
          <div className="cw-row head ig-export-row" role="row"><span>File</span><span>Period</span><span className="num">Debit = credit</span><span>Exported</span><span>Checksum</span><span /></div>
          {state.data.items.map((row) => (
            <div key={row.id} className="cw-row ig-export-row" role="row">
              <span className="cw-title-cell"><small>{row.kind === "PAYROLL_JOURNAL" ? "Payroll journal" : "Expense payments"} · {row.format === "TALLY_XML" ? "Tally XML" : "CSV"}</small><b>{row.fileName}</b></span>
              <span>{periodLabel(row.period)}</span>
              <span className="num">{rupees(row.totalDebit)}</span>
              <span>{dateTime(row.createdAt)}<small className="ig-sub">{row.exportedBy}</small></span>
              <span><code className="ig-hash" title={row.checksum}>{row.checksum.slice(0, 12)}…</code></span>
              <span className="cw-row-cta"><button className="cw-icon-button" aria-label={`Download ${row.fileName}`} title="Download again"
                onClick={() => downloadFile(`${BASE}/accounting/exports/${row.id}/download`, row.fileName).catch((reason: Error) => setError(reason.message))}><Download size={15} /></button></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
