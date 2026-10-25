"use client";
import { Check, Loader2, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Pending = { id: string; title: string; summary: string; body: string; version: number };
const noop = () => {};

/**
 * Asks the signed-in person to read and accept every current company policy (ISO 27001 A.5.1 / SOC 2 CC2.2).
 * Each acceptance is stored with time and IP as audit evidence. Shown once per new policy version.
 */
export function PolicyGate() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(pending.length > 0, noop, ref, false);
  useEffect(() => {
    httpRequest<{ items: Pending[] }>("/api/v2/compliance/policies/pending").then((data) => setPending(data.items)).catch(() => setPending([]));
  }, []);
  if (!pending.length) return null;
  const policy = pending[0];
  const accept = async () => {
    setBusy(true); setError("");
    try {
      await httpRequest(`/api/v2/compliance/policies/${policy.id}/acknowledge`, { method: "POST", body: {} });
      setPending((current) => current.slice(1)); setAgreed(false);
      ref.current?.querySelector(".pg-body")?.scrollTo({ top: 0 });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <div className="pg-backdrop">
      <div className="pg-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pg-title" aria-describedby="pg-summary">
        <header>
          <span className="pg-icon"><ScrollText size={20} /></span>
          <div>
            <p className="cw-eyebrow">COMPANY POLICY · {pending.length > 1 ? `${pending.length} TO REVIEW` : "LAST ONE"}</p>
            <h2 id="pg-title">{policy.title} <small>v{policy.version}</small></h2>
            <p id="pg-summary">{policy.summary}</p>
          </div>
        </header>
        <div className="pg-body" tabIndex={0}>{policy.body}</div>
        {error && <p className="cw-alert" role="alert">{error}</p>}
        <footer>
          <label><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I have read and accept this policy</label>
          <button className="cw-btn primary" disabled={!agreed || busy} onClick={accept}>{busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Accept</button>
        </footer>
      </div>
    </div>
  );
}
