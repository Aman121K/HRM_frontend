"use client";
import { AlertTriangle, Loader2, ScanLine, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { money, shortDate } from "@/lib/cases";

export type ReceiptScan = {
  scanId: string; fileId: string; provider: "tesseract" | "anthropic" | "pdf-text"; confidence: number;
  fields: { merchant?: string; date?: string; total?: number; currency?: string; tax?: number; gstin?: string; invoiceNumber?: string; category?: string };
  lines?: { description: string; amount: number }[]; warnings: string[]; duplicateOf?: { caseId: string; caseNumber: string; reason: string };
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

/** Shrink large photos in the browser before upload so scans stay fast and under the size limit. */
async function prepare(file: File): Promise<{ base64: string; mimeType: string }> {
  const read = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
  if (file.type === "application/pdf" || file.size < 1.5 * 1024 * 1024) return { base64: await read(file), mimeType: file.type };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not process the image.")), "image/jpeg", 0.85));
  return { base64: await read(blob), mimeType: "image/jpeg" };
}

/** Upload a bill, read it with OCR and hand the extracted fields back to the claim form. */
export function ReceiptScanner({ onScanned, scan, onClear }: { onScanned: (scan: ReceiptScan, fileName: string) => void; scan: ReceiptScan | null; onClear: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) { setError("Use a photo (JPG, PNG, WebP) or a PDF of the bill."); return; }
    if (file.size > MAX_BYTES * 3) { setError("That file is too large. Use a photo under 24 MB."); return; }
    setBusy(true); setError(""); setName(file.name);
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    try {
      const { base64, mimeType } = await prepare(file);
      onScanned(await httpRequest<ReceiptScan>("/api/v2/receipts/scan", { method: "POST", body: { originalName: file.name, mimeType, base64 } }), file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't read that receipt.");
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  if (scan) {
    const confidence = Math.round(scan.confidence * 100);
    return (
      <section className="rs-result" aria-live="polite">
        {preview ? <img src={preview} alt="Scanned receipt" /> : <span className="rs-doc"><ScanLine size={20} /></span>}
        <div>
          <p className="rs-head"><Sparkles size={14} /> <b>Read from {name || "your receipt"}</b>
            <span className={`cw-badge ${confidence >= 80 ? "tone-success" : confidence >= 55 ? "tone-warning" : "tone-danger"}`}><i />{confidence}% confident</span></p>
          <p className="rs-facts">
            {scan.fields.merchant && <span>{scan.fields.merchant}</span>}
            {scan.fields.date && <span>{shortDate(scan.fields.date)}</span>}
            {scan.fields.total !== undefined && <span><b>{money(scan.fields.total)}</b></span>}
            {scan.fields.gstin && <span>GSTIN {scan.fields.gstin}</span>}
          </p>
          <small>Fields below were filled in for you — check them before submitting. The receipt is attached to the claim automatically.</small>
          {scan.duplicateOf && <p className="cw-alert warn"><AlertTriangle size={15} /> Looks like a duplicate of {scan.duplicateOf.caseNumber}: {scan.duplicateOf.reason}</p>}
          {scan.warnings.map((warning) => <p key={warning} className="rs-warning"><AlertTriangle size={13} /> {warning}</p>)}
        </div>
        <button type="button" className="cw-icon-button" aria-label="Remove scanned receipt" onClick={() => { setPreview(""); onClear(); }}><X size={15} /></button>
      </section>
    );
  }

  return (
    <label className={`rs-drop ${busy ? "busy" : ""}`}
      onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); pick(event.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept={ACCEPT} capture="environment" disabled={busy} onChange={(event) => pick(event.target.files?.[0])} />
      <span className="rs-icon">{busy ? <Loader2 size={20} className="spin" /> : <ScanLine size={20} />}</span>
      <span><b>{busy ? "Reading your receipt…" : "Scan a receipt to fill this in"}</b>
        <small>{busy ? "Finding the merchant, date, total and GST" : "Drop a photo or PDF of the bill — we'll read the amount, date and merchant"}</small></span>
      {error && <em role="alert"><AlertTriangle size={13} /> {error}</em>}
    </label>
  );
}
