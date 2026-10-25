"use client";
import { Download, FileImage, FileText, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { relativeTime } from "@/lib/cases";

export type StoredFile = { id: string; category: string; originalName: string; mimeType: string; byteSize: number; createdAt: string; uploadedBy: string; uploadedById: string };
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX = 8 * 1024 * 1024;
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(entityType: string, entityId: string, file: File, category = "ATTACHMENT") {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Only PDF, JPEG, PNG and WebP files are supported.");
  if (file.size > MAX) throw new Error("Files must be 8 MB or smaller.");
  return httpRequest<StoredFile>("/api/v2/files", { method: "POST", body: { entityType, entityId, category, originalName: file.name, mimeType: file.type, base64: await toBase64(file) } });
}

/** Attachment list + drop zone for any record whose module registered a file policy. */
export function Attachments({ entityType, entityId, category = "ATTACHMENT", canUpload = true, label = "Attachments", hint, onChange }: {
  entityType: string; entityId: string; category?: string; canUpload?: boolean; label?: string; hint?: string; onChange?: (count: number) => void;
}) {
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const changed = useRef(onChange);
  changed.current = onChange;
  const load = useCallback(async () => {
    try {
      const data = await httpRequest<{ items: StoredFile[] }>(`/api/v2/files?entityType=${entityType}&entityId=${entityId}`);
      setFiles(data.items); changed.current?.(data.items.length);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load attachments."); setFiles([]); }
  }, [entityType, entityId]);
  useEffect(() => { load(); }, [load]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true); setError("");
    try { for (const file of Array.from(list)) await uploadFile(entityType, entityId, file, category); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async (file: StoredFile) => {
    if (!window.confirm(`Remove ${file.originalName}?`)) return;
    try { await httpRequest(`/api/v2/files/${file.id}`, { method: "DELETE" }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove."); }
  };

  return (
    <section className="att">
      <p className="cw-section-label"><Paperclip size={12} /> {label}{files?.length ? ` · ${files.length}` : ""}</p>
      {error && <p className="cw-alert" role="alert">{error}</p>}
      {files?.map((file) => (
        <div key={file.id} className="att-row">
          <span className="att-icon">{file.mimeType === "application/pdf" ? <FileText size={16} /> : <FileImage size={16} />}</span>
          <p><b>{file.originalName}</b><small>{size(file.byteSize)} · {file.uploadedBy} · {relativeTime(file.createdAt)}</small></p>
          <button type="button" className="cw-icon-button" aria-label={`Download ${file.originalName}`} onClick={() => downloadFile(`/api/v2/files/${file.id}/content`, file.originalName).catch((reason) => setError(reason.message))}><Download size={15} /></button>
          {canUpload && <button type="button" className="cw-icon-button" aria-label={`Remove ${file.originalName}`} onClick={() => remove(file)}><Trash2 size={15} /></button>}
        </div>
      ))}
      {files && !files.length && !canUpload && <p className="cw-muted">No files attached.</p>}
      {canUpload && (
        <label className={`att-drop ${dragging ? "drag" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }}>
          <input ref={input} type="file" accept={ACCEPT} multiple onChange={(event) => add(event.target.files)} disabled={busy} />
          {busy ? <Loader2 size={18} className="spin" /> : <UploadCloud size={18} />}
          <span><b>{busy ? "Uploading…" : "Drop files or browse"}</b><small>{hint || "PDF, JPG, PNG or WebP · up to 8 MB each"}</small></span>
        </label>
      )}
    </section>
  );
}
