"use client";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export function Drawer({ title, eyebrow, onClose, children, footer, wide = false }: {
  title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, ref);
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className={`cw-drawer lms-drawer ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className="cw-drawer-head">
          {eyebrow && <p className="cw-eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          <button className="cw-icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="cw-drawer-body">{children}</div>
        {footer && <footer className="lms-drawer-foot">{footer}</footer>}
      </div>
    </>
  );
}
