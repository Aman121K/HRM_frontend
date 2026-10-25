"use client";
import { AlertTriangle, Lock, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { RISK_LABEL, RISK_TONE, SCOPE_SHORT, type Risk, type Scope, type ScopeInfo } from "./api";

export const ACCENT = "#28536b";

export function Badge({ tone, label, title }: { tone: string; label: string; title?: string }) {
  return <span className={`cw-badge tone-${tone}`} title={title}><i />{label}</span>;
}
export function RiskBadge({ risk, compact }: { risk: Risk; compact?: boolean }) {
  return <span className={`ax-risk tone-${RISK_TONE[risk]}`} title={`${RISK_LABEL[risk]} risk`}>{compact ? RISK_LABEL[risk][0] : RISK_LABEL[risk]}</span>;
}
export function ScopeChip({ info, scopable = true }: { info?: ScopeInfo | { scope: Scope }; scopable?: boolean }) {
  if (!info) return null;
  if (!scopable) return <span className="ax-scope muted">Org-wide</span>;
  const restricted = "departments" in info || "locations" in info ? [...((info as ScopeInfo).departments || []), ...((info as ScopeInfo).locations || [])] : [];
  return <span className={`ax-scope s-${info.scope.toLowerCase()}`}>{SCOPE_SHORT[info.scope]}{restricted.length ? <small> · {restricted.join(", ")}</small> : null}</span>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="cw-alert" role="alert">
      <AlertTriangle size={15} />
      <span>{message} {onRetry && <button className="ax-link" onClick={onRetry}>Try again</button>}</span>
    </div>
  );
}

export function PermissionState({ title, body }: { title: string; body: string }) {
  return (
    <div className="cw-empty">
      <span><Lock size={24} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="cw-btn ghost" href="/">Back to home</Link>
    </div>
  );
}

export function Drawer({ title, eyebrow, onClose, children, wide, head, footer }: {
  title: string; eyebrow: string; onClose: () => void; children: React.ReactNode; wide?: boolean; head?: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stableClose = useCallback(() => closeRef.current(), []);
  useDialogFocus(true, stableClose, ref);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <aside className={`cw-drawer ax-drawer ${wide ? "wide" : ""}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="cw-drawer-head" style={{ ["--accent" as string]: ACCENT }}>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <p className="cw-eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
          {head}
        </header>
        <div className="cw-drawer-body">{children}</div>
        {footer && <footer className="ax-drawer-foot">{footer}</footer>}
      </aside>
    </>
  );
}

/**
 * Explicit confirmation for high-risk grants: the admin types a reason (sent to the API and kept in the audit log).
 * Rendered as a modal on top of any drawer.
 */
export function ConfirmDialog({ title, body, items, confirmLabel, requireReason = true, danger, busy, error, onConfirm, onClose }: {
  title: string; body: React.ReactNode; items?: string[]; confirmLabel: string; requireReason?: boolean; danger?: boolean; busy?: boolean; error?: string;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stableClose = useCallback(() => closeRef.current(), []);
  useDialogFocus(true, stableClose, ref, false);
  // Escape closes only this dialog, not the drawer underneath (capture runs before the drawer's listener).
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, []);
  const minimum = requireReason ? 10 : 0;
  const ready = (!requireReason || reason.trim().length >= minimum) && (!danger || ack);
  return createPortal(
    <>
      <button className="flow-backdrop ax-modal-backdrop" aria-label="Cancel" onClick={onClose} />
      <div className="ax-modal" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header>
          <span className={danger ? "danger" : ""}><ShieldAlert size={20} /></span>
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className="ax-modal-body">
          <div className="ax-modal-text">{body}</div>
          {!!items?.length && <ul className="ax-modal-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>}
          {error && <ErrorState message={error} />}
          <form className="cw-fields" onSubmit={(event) => { event.preventDefault(); if (ready && !busy) onConfirm(reason.trim()); }}>
            {requireReason && (
              <label className="wide">
                <span>Reason <em>*</em> <small>kept in the audit log</small></span>
                <textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Finance controller is the second approver for October payroll" />
                <small className={`cw-limit ${reason.trim().length && reason.trim().length < minimum ? "over" : ""}`}>{reason.trim().length < minimum ? `At least ${minimum} characters` : "Looks good"}</small>
              </label>
            )}
            {danger && (
              <label className="wide ax-check">
                <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
                <span>I understand this grants high-risk access.</span>
              </label>
            )}
            <div className="ax-modal-actions wide">
              <button type="button" className="cw-btn ghost" onClick={onClose}>Cancel</button>
              <button className={`cw-btn ${danger ? "danger" : "primary"}`} disabled={!ready || busy}>{busy ? "Saving…" : confirmLabel}</button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function Toast({ message }: { message: string }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}
