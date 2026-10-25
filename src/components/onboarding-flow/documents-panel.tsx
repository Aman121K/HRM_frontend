"use client";
import { BadgeCheck, CircleAlert, Download, FileImage, FileText, ShieldCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Attachments } from "@/components/files/attachments";
import { downloadFile } from "@/lib/http-client";
import { relativeTime, shortDate } from "@/lib/cases";
import { DOC_CATEGORIES, errorText, onboardingApi, type DocCategory, type DocFile, type Documents, type JoinerDetail } from "./api";
import { Badge } from "./shared";

const STATUS: Record<string, { label: string; tone: string }> = {
  MISSING: { label: "Missing", tone: "danger" }, PENDING_REVIEW: { label: "Awaiting verification", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" }, REJECTED: { label: "Re-upload needed", tone: "danger" },
};

export function DocumentsPanel({ joinerId, documents, fileAccess, onChanged, onDetail, flash, maskedIds }: {
  joinerId: string; documents: Documents; fileAccess: "read" | "write" | null; onChanged: () => void; onDetail: (detail: JoinerDetail) => void;
  flash?: (message: string) => void; maskedIds?: { pan: string | null; aadhaar: string | null };
}) {
  const firstMissing = documents.items.find((item) => item.status === "MISSING" || item.status === "REJECTED")?.category;
  const [category, setCategory] = useState<DocCategory>(firstMissing || documents.items[0]?.category || "OTHER");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { summary } = documents;
  // Attachments reports its count on every load; only a real upload or removal should refresh the checklist.
  const lastCount = useRef<number | null>(null);
  const counted = (count: number) => { if (lastCount.current !== null && lastCount.current !== count) onChanged(); lastCount.current = count; };

  const review = async (file: DocFile, decision: "VERIFIED" | "REJECTED") => {
    if (decision === "REJECTED" && !reason.trim()) { setError("Tell the joiner what to fix."); return; }
    setBusy(true); setError("");
    try {
      onDetail(await onboardingApi.review(file.id, { decision, reason: reason.trim() || undefined }));
      setRejecting(null); setReason("");
      flash?.(decision === "VERIFIED" ? `${file.originalName} verified` : `${file.originalName} rejected — joiner asked to re-upload`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  return (
    <section className="ob-panel ob-docs" aria-labelledby="ob-docs-title">
      <header>
        <h2 id="ob-docs-title"><ShieldCheck size={16} /> Documents</h2>
        <span className="ob-docs-score">{summary.verified}/{summary.required} verified</span>
      </header>
      {summary.required > 0 && (
        <div className="ob-doc-meter" aria-label={`${summary.verified} verified, ${summary.pendingReview} awaiting verification, ${summary.missing} missing`}>
          <i className="v" style={{ flex: summary.verified }} /><i className="p" style={{ flex: summary.pendingReview }} /><i className="m" style={{ flex: summary.missing }} />
        </div>
      )}
      {error && <p className="cw-alert" role="alert">{error}</p>}
      <ul className="ob-doc-list">
        {documents.items.map((item) => (
          <li key={item.category} className={`doc-${item.status.toLowerCase()}`}>
            <div className="ob-doc-head">
              <span className="ob-doc-icon">{item.status === "VERIFIED" ? <BadgeCheck size={16} /> : item.status === "MISSING" ? <CircleAlert size={16} /> : item.status === "REJECTED" ? <XCircle size={16} /> : <FileText size={16} />}</span>
              <p><b>{item.label}</b>
                <small>{item.category === "AADHAAR" && maskedIds?.aadhaar ? `${maskedIds.aadhaar} · ` : item.category === "PAN" && maskedIds?.pan ? `${maskedIds.pan} · ` : ""}
                  {item.required ? item.dueDate ? `Due ${shortDate(item.dueDate)}` : "Required" : "Optional"}</small></p>
              <Badge tone={STATUS[item.status].tone} label={STATUS[item.status].label} />
            </div>
            {item.files.map((file) => (
              <div key={file.id} className="ob-doc-file">
                <span>{file.mimeType === "application/pdf" ? <FileText size={14} /> : <FileImage size={14} />}</span>
                <p><b>{file.originalName}</b>
                  <small>{file.uploadedBy} · {relativeTime(file.createdAt)}{file.reviewStatus ? ` · ${file.reviewStatus === "VERIFIED" ? "verified" : "rejected"} by ${file.reviewedBy}` : ""}</small>
                  {file.reviewStatus === "REJECTED" && file.reviewReason && <em>“{file.reviewReason}”</em>}
                </p>
                <button type="button" className="cw-icon-button" aria-label={`Download ${file.originalName}`} onClick={() => downloadFile(`/api/v2/files/${file.id}/content`, file.originalName).catch((reason) => setError(errorText(reason)))}><Download size={14} /></button>
                {documents.canReview && file.reviewStatus !== "VERIFIED" && (
                  <button type="button" className="cw-btn ghost ob-mini" onClick={() => review(file, "VERIFIED")} disabled={busy}><BadgeCheck size={13} /> Verify</button>
                )}
                {documents.canReview && file.reviewStatus !== "REJECTED" && (
                  <button type="button" className="cw-btn danger ob-mini" onClick={() => { setRejecting(rejecting === file.id ? null : file.id); setReason(""); setError(""); }} disabled={busy}>Reject</button>
                )}
                {rejecting === file.id && (
                  <div className="ob-reject">
                    <input autoFocus value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Reason, e.g. blurred or cropped" aria-label="Rejection reason"
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); review(file, "REJECTED"); } }} />
                    <button type="button" className="cw-btn danger ob-mini" onClick={() => review(file, "REJECTED")} disabled={busy}>Send back</button>
                  </div>
                )}
              </div>
            ))}
          </li>
        ))}
        {!documents.items.length && <li className="ob-column-empty">No documents are required by this checklist.</li>}
      </ul>
      {fileAccess === "write" ? (
        <div className="ob-upload">
          <label className="ob-upload-type"><span>Upload as</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as DocCategory)}>
              {DOC_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <Attachments key={category} entityType="onboarding_joiner" entityId={joinerId} category={category} label="All uploaded files"
            hint={`Saved as ${DOC_CATEGORIES.find((item) => item.key === category)?.label.toLowerCase()} · PDF, JPG, PNG or WebP up to 8 MB`} onChange={counted} />
        </div>
      ) : fileAccess === "read" ? <p className="cw-help">You can view and download these documents. HR manages uploads and verification.</p> : null}
    </section>
  );
}
