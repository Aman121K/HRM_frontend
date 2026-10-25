"use client";
import { X } from "lucide-react";
import { useRef } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export type ConfirmRequest = { title: string; body: React.ReactNode; confirm: string; tone?: "primary" | "danger"; run: () => Promise<void> | void };

export function ConfirmDialog({ request, busy, onClose }: { request: ConfirmRequest; busy: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, ref);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <div className="flow-dialog eg-confirm" role="alertdialog" aria-modal="true" aria-labelledby="eg-confirm-title" ref={ref} tabIndex={-1}>
        <button className="cw-icon-button eg-confirm-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <h2 id="eg-confirm-title">{request.title}</h2>
        <div className="eg-confirm-body">{request.body}</div>
        <div className="eg-confirm-actions">
          <button className="cw-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`cw-btn ${request.tone === "danger" ? "danger" : "primary"}`} onClick={() => request.run()} disabled={busy}>{busy ? "Working…" : request.confirm}</button>
        </div>
      </div>
    </>
  );
}
