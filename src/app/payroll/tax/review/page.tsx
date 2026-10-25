"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileCheck2,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ApiRequestError, httpRequest } from "@/lib/http-client";

const TAX = "/api/v2/payroll/tax";

type DeclarationItem = { amount?: number | string; label?: string; category?: string };
type Declaration = {
  id: string;
  status: string;
  regime: string;
  version: number;
  employeeName?: string;
  employeeNumber?: string;
  items?: DeclarationItem[];
};

function requestError(value: unknown, fallback: string) {
  if (value instanceof ApiRequestError && value.status === 403) return "Only Payroll or HR can review tax declarations. Switch to a payroll reviewer to open this queue.";
  return value instanceof Error && value.message !== "Failed to fetch"
    ? value.message
    : fallback;
}

export default function TaxReview() {
  const [items, setItems] = useState<Declaration[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");
    try {
      // Submitted declarations from everyone except the reviewer (maker-checker is enforced by the API).
      const body = await httpRequest<{ items?: Declaration[] }>(`${TAX}/declarations/review-queue`);
      if (mounted.current) setItems(Array.isArray(body.items) ? body.items : []);
    } catch (error) {
      if (mounted.current) {
        setItems([]);
        setLoadError(requestError(error, "The tax service is not responding. Your review queue is safe; retry when the service is available."));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  const act = async (declaration: Declaration, action: string, amount: number) => {
    const reason = (reasons[declaration.id] || "").trim();
    if (action !== "ACCEPT" && !reason) {
      setFeedback({ kind: "error", text: "Add a reviewer reason before requesting clarification or rejecting a declaration." });
      return;
    }
    setBusyId(declaration.id);
    setFeedback(null);
    try {
      const body = await httpRequest<{ status?: string }>(`${TAX}/declarations/${declaration.id}/review`, {
        method: "POST",
        body: {
          action,
          reason,
          version: declaration.version,
          amounts: {
            declared: amount,
            accepted: action === "ACCEPT" ? amount : 0,
            rejected: action === "REJECT" ? amount : 0,
          },
        },
      });
      if (!mounted.current) return;
      setFeedback({ kind: "success", text: `Decision recorded: ${body.status || action.toLowerCase().replaceAll("_", " ")}. The audit history has been updated.` });
      setReasons((current) => ({ ...current, [declaration.id]: "" }));
      await load(false);
    } catch (error) {
      if (mounted.current) setFeedback({ kind: "error", text: requestError(error, "The tax service is unavailable. No decision was recorded—please try again.") });
    } finally {
      if (mounted.current) setBusyId("");
    }
  };

  return (
    <AppShell>
      <main className="tax-page tax-review-page">
        <header className="tax-title reviewer-title">
          <div>
            <p className="eyebrow">PAYROLL · DECLARATION REVIEWER</p>
            <h1>Tax declaration review</h1>
            <p>Review employee declarations with a clear, permanent record of accepted amounts and decision reasons.</p>
          </div>
          <Link href="/payroll/tax" className="review-return"><ArrowLeft size={15} /> Employee workspace</Link>
        </header>

        <section className="review-summary" aria-label="Queue summary">
          <div><Inbox size={19} /><span><small>IN REVIEW QUEUE</small><b>{loading ? "—" : items.length}</b></span></div>
          <div><ShieldCheck size={19} /><span><small>REVIEW STANDARD</small><b>Audit-ready decisions</b></span></div>
          <p><span /> Live queue · FY 2026–27</p>
        </section>

        {feedback && (
          <div className={`review-feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
            {feedback.kind === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={15} /></button>
          </div>
        )}

        <section className="review-workspace" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="review-state"><Loader2 className="review-spinner" /><p className="eyebrow">OPENING REVIEW QUEUE</p><h2>Loading declarations…</h2><span>Checking the latest submitted versions.</span></div>
          ) : loadError ? (
            <div className="review-state review-state-error"><AlertTriangle /><p className="eyebrow">SERVICE UNAVAILABLE</p><h2>We couldn’t open the review queue.</h2><span>{loadError}</span><button onClick={() => void load()}><RefreshCw size={15} /> Retry</button></div>
          ) : items.length === 0 ? (
            <div className="review-state"><FileCheck2 /><p className="eyebrow">QUEUE CLEAR</p><h2>No declarations need review.</h2><span>New employee submissions will appear here automatically.</span><button onClick={() => void load()} className="review-secondary"><RefreshCw size={15} /> Refresh queue</button></div>
          ) : (
            <div className="review-cases">
              <header><div><p className="eyebrow">ACTIVE CASES</p><h2>Declarations awaiting a decision</h2></div><button onClick={() => void load()} disabled={Boolean(busyId)}><RefreshCw size={14} /> Refresh</button></header>
              {items.map((declaration) => {
                const total = (declaration.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                const busy = busyId === declaration.id;
                return (
                  <article className="review-case" key={declaration.id}>
                    <header>
                      <div className="review-identity"><span>{(declaration.employeeName || declaration.employeeNumber || "Employee").slice(0, 2).toUpperCase()}</span><div><small>{declaration.employeeName || declaration.employeeNumber || "Employee declaration"}</small><b>{declaration.id.slice(0, 8).toUpperCase()}</b></div></div>
                      <span className="review-status">{declaration.status.replaceAll("_", " ")}</span>
                    </header>
                    <dl>
                      <div><dt>REGIME</dt><dd>{declaration.regime} regime</dd></div>
                      <div><dt>DECLARED VALUE</dt><dd className="review-amount">₹{total.toLocaleString("en-IN")}</dd></div>
                      <div><dt>VERSION</dt><dd>v{declaration.version}</dd></div>
                      <div><dt>LINE ITEMS</dt><dd>{declaration.items?.length || 0}</dd></div>
                    </dl>
                    <label className="review-reason"><span>Reviewer reason <small>Required for clarification or rejection</small></span><textarea value={reasons[declaration.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [declaration.id]: event.target.value }))} placeholder="State the evidence needed or explain the decision…" disabled={busy} /></label>
                    <div className="review-actions">
                      <button onClick={() => void act(declaration, "REQUEST_CLARIFICATION", total)} disabled={busy}><MessageSquareText size={15} /> Request clarification</button>
                      <button className="review-reject" onClick={() => void act(declaration, "REJECT", total)} disabled={busy}><X size={15} /> Reject</button>
                      <button className="review-accept" onClick={() => void act(declaration, "ACCEPT", total)} disabled={busy}>{busy ? <Loader2 className="review-spinner" size={15} /> : <Check size={15} />} {busy ? "Recording…" : "Accept declared amount"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
