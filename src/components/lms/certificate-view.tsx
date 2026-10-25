"use client";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Award, BadgeCheck, Loader2, Lock, Printer, Search, ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { shortDate } from "@/lib/cases";
import { errorText, minutesLabel, useAsync } from "./lms-api";

type CertificateData = {
  id: string; code: string; courseTitle: string; employeeName: string; employeeNumber: string; designation: string | null; category: string; durationMinutes: number;
  coverColor: string; coverEmoji: string; organizationName: string; issuedAt: string; score: number | null; courseVersion: number; courseId: string;
};

export function CertificateView({ id }: { id: string }) {
  const certificate = useAsync(() => httpRequest<CertificateData>(`/api/v2/lms/certificates/${id}`), [id]);
  if (certificate.error) return (
    <div className="cw-page lms-page">
      <Link href="/learning?tab=certificates" className="lms-back"><ArrowLeft size={15} /> My certificates</Link>
      <div className="cw-empty"><span><Lock size={26} /></span><h2>Certificate not available</h2><p>{certificate.status === 404 ? "Only the learner, their manager and HR can open this certificate. Use the verification page to check a code." : certificate.error}</p>
        <Link className="cw-btn ghost" href="/learning/verify">Verify a code</Link></div>
    </div>
  );
  const data = certificate.data;
  if (!data) return <div className="cw-page lms-page"><div className="cw-hero-skeleton" aria-label="Loading certificate" /></div>;
  return (
    <div className="cw-page lms-page lms-cert-page">
      <div className="lms-player-top lms-no-print">
        <Link href="/learning?tab=certificates" className="lms-back"><ArrowLeft size={15} /> My certificates</Link>
        <div className="cw-action-row">
          <Link className="cw-btn ghost" href={`/learning/course/${data.courseId}`}>Open course</Link>
          <button className="cw-btn primary" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</button>
        </div>
      </div>
      <article className="lms-certificate" style={{ ["--cover" as string]: data.coverColor }} aria-label={`Certificate of completion for ${data.employeeName}`}>
        <div className="lms-cert-border">
          <header>
            <span className="lms-cert-seal"><Award size={34} /></span>
            <p className="lms-cert-org">{data.organizationName}</p>
            <p className="lms-cert-kicker">Certificate of completion</p>
          </header>
          <p className="lms-cert-line">This certifies that</p>
          <h1>{data.employeeName}</h1>
          <p className="lms-cert-sub">{data.designation ? `${data.designation} · ` : ""}{data.employeeNumber}</p>
          <p className="lms-cert-line">has successfully completed</p>
          <h2><span aria-hidden="true">{data.coverEmoji}</span> {data.courseTitle}</h2>
          <p className="lms-cert-sub">{data.category} · {minutesLabel(data.durationMinutes)}{data.score !== null ? ` · assessment score ${data.score}%` : ""}</p>
          <footer>
            <div><small>Issued</small><b>{shortDate(data.issuedAt)}</b></div>
            <div><small>Verification code</small><b className="code">{data.code}</b></div>
            <div><small>Course version</small><b>v{data.courseVersion}</b></div>
          </footer>
          <p className="lms-cert-verify">Verify this certificate in Northstar People → Learning → Verify a certificate.</p>
        </div>
      </article>
    </div>
  );
}

export function VerifyCertificate() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ valid: boolean; code: string; courseTitle?: string; employeeName?: string; issuedAt?: string } | null>(null);
  const check = async (value = code) => {
    if (!value.trim()) return;
    setBusy(true); setError("");
    try { setResult(await httpRequest(`/api/v2/lms/certificates/verify/${encodeURIComponent(value.trim().toUpperCase())}`)); }
    catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("code");
    if (initial) { setCode(initial); check(initial); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="cw-page lms-page" style={{ ["--accent" as string]: "#0f8177" }}>
      <Link href="/learning" className="lms-back"><ArrowLeft size={15} /> Learning</Link>
      <header className="cw-hero">
        <span className="cw-hero-icon"><BadgeCheck size={26} strokeWidth={1.7} /></span>
        <div><p className="cw-eyebrow">LEARNING · VERIFY</p><h1>Verify a certificate</h1><p>Enter the code printed on a Northstar learning certificate (for example NS-7K2P-QX9D) to confirm it is genuine.</p></div>
      </header>
      <form className="lms-verify" onSubmit={(event) => { event.preventDefault(); check(); }}>
        <label className="cw-search"><Search size={15} /><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="NS-XXXX-XXXX" aria-label="Verification code" maxLength={12} autoComplete="off" /></label>
        <button className="cw-btn primary" disabled={busy || !code.trim()}>{busy ? <Loader2 size={15} className="spin" /> : <BadgeCheck size={15} />} Verify</button>
      </form>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {result && (result.valid ? (
        <div className="lms-verify-result ok" role="status"><BadgeCheck size={30} /><div><b>Valid certificate · {result.code}</b><p>{result.employeeName} completed “{result.courseTitle}” on {shortDate(result.issuedAt)}.</p></div></div>
      ) : (
        <div className="lms-verify-result bad" role="status"><ShieldQuestion size={30} /><div><b>No certificate found for {result.code || "that code"}</b><p>Check the code for typos. Codes look like NS-XXXX-XXXX.</p></div></div>
      ))}
    </div>
  );
}
