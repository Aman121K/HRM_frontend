"use client";
import { AlertTriangle, Check, Copy, KeyRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { label, statusTone } from "./api";

export function Badge({ status, text }: { status: string; text?: string }) {
  return <span className={`cw-badge tone-${statusTone[status] || "neutral"}`}><i />{text || label(status)}</span>;
}

export function Drawer({ title, eyebrow, onClose, children, footer, accent }: {
  title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; accent?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, ref);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close panel" tabIndex={-1} onClick={onClose} />
      <div className="cw-drawer ig-drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className="cw-drawer-head" style={accent ? { ["--accent" as string]: accent } : undefined}>
          {eyebrow && <p className="cw-eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="cw-drawer-body">{children}</div>
        {footer && <footer className="ig-drawer-foot">{footer}</footer>}
      </div>
    </>
  );
}

/** Shows a secret exactly once, with copy buttons and an explicit acknowledgement. */
export function SecretReveal({ title, notice, items, onDone }: { title: string; notice: string; items: { label: string; value: string; hint?: string }[]; onDone: () => void }) {
  const [copied, setCopied] = useState("");
  const [ack, setAck] = useState(false);
  const copy = async (key: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(""), 1600); } catch { setCopied(""); }
  };
  return (
    <section className="ig-secret" aria-live="polite">
      <header><KeyRound size={18} /><div><b>{title}</b><p>{notice}</p></div></header>
      {items.map((item) => (
        <div key={item.label} className="ig-secret-row">
          <span>{item.label}{item.hint && <small>{item.hint}</small>}</span>
          <code>{item.value}</code>
          <button type="button" className="cw-btn ghost" onClick={() => copy(item.label, item.value)}>
            {copied === item.label ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      ))}
      <label className="ig-check"><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} /> I have stored this securely — it will not be shown again.</label>
      <div className="cw-action-row"><button className="cw-btn primary" disabled={!ack} onClick={onDone}>Done</button></div>
    </section>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {message}</p>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="cw-list-skeleton" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, index) => <i key={index} />)}</div>;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="cw-empty"><span>{icon}</span><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}

export function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const node = toast ? <div className="toast" role="status">{toast}</div> : null;
  return { show: setToast, node };
}

/** Loads data with loading/error state and a reload function. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    return loader().then((value) => { setData(value); setError(""); return value; })
      .catch((reason: Error) => { setError(reason.message); return null; })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Reads a small text file chosen by the user (CSV imports). */
export function readTextFile(file: File, maxBytes = 2_000_000) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > maxBytes) return reject(new Error("That file is too large (2 MB max)."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}
