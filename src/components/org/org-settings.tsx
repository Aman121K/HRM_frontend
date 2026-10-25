"use client";
import { AlertTriangle, Check, Palette } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { applyBranding, type OrgSummary } from "@/lib/org";
import { OrgMark } from "@/components/sidebar-nav";
import { readLogo } from "./platform-console";

/** Owners and HR admins edit their own brand's identity: names, colours, logo, statutory state and ID prefix. */
export function OrgSettings() {
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [form, setForm] = useState<Partial<OrgSummary>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    httpRequest<OrgSummary>("/api/v2/orgs/current").then((value) => { setOrg(value); setForm(value); }).catch((reason) => setError(reason.message));
  }, []);
  const set = (key: keyof OrgSummary, value: string | null) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!org) return; setError(""); setSaved(false);
    try {
      const next = await httpRequest<OrgSummary>("/api/v2/orgs/current", { method: "PATCH", body: {
        displayName: form.displayName, shortName: form.shortName, legalName: form.legalName || undefined, industry: form.industry || undefined,
        brandColor: form.brandColor, accentColor: form.accentColor, logoDataUrl: form.logoDataUrl ?? null, defaultState: form.defaultState, employeePrefix: form.employeePrefix, version: org.version,
      } });
      setOrg(next); setForm(next); setSaved(true); applyBranding(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't save."); }
  };
  return (
    <div className="cw-page" style={{ ["--accent" as string]: form.brandColor || "#0b615c" }}>
      <p className="ns-back"><Link href="/settings">← Settings</Link></p>
      <header className="cw-hero">
        <span className="cw-hero-icon"><Palette size={26} strokeWidth={1.7} /></span>
        <div><p className="cw-eyebrow">SETTINGS · ORGANIZATION</p><h1>Brand & organization</h1><p>How this brand appears to its people, and the defaults used for payroll and employee IDs.</p></div>
        {saved && <span className="cw-badge tone-success"><i />Saved</span>}
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!org ? !error && <div className="cw-list-skeleton"><i /><i /></div> : (
        <form className="ns-grid" onSubmit={save}>
          <section className="ns-card">
            <h2>Identity</h2>
            <div className="cw-fields">
              <label className="wide"><span>Brand name</span><input required value={form.displayName || ""} onChange={(event) => set("displayName", event.target.value)} /></label>
              <label><span>Short name</span><input required maxLength={24} value={form.shortName || ""} onChange={(event) => set("shortName", event.target.value)} /></label>
              <label><span>Industry</span><input value={form.industry || ""} onChange={(event) => set("industry", event.target.value)} /></label>
              <label className="wide"><span>Legal entity</span><input value={form.legalName || ""} onChange={(event) => set("legalName", event.target.value)} /></label>
              <label><span>Professional-tax state</span><input value={form.defaultState || ""} maxLength={5} onChange={(event) => set("defaultState", event.target.value.toUpperCase())} /></label>
              <label><span>Employee ID prefix</span><input value={form.employeePrefix || ""} pattern="[A-Z]{2,6}" onChange={(event) => set("employeePrefix", event.target.value.toUpperCase())} /></label>
            </div>
          </section>
          <section className="ns-card">
            <h2>Look</h2>
            <div className="pc-preview" style={{ background: form.brandColor }}>
              <OrgMark org={{ logoDataUrl: form.logoDataUrl || null, brandColor: form.accentColor || "#c78c2b", shortName: form.shortName || "" }} size={40} />
              <b>{form.shortName}</b>
            </div>
            <div className="cw-fields">
              <label><span>Brand colour</span><input type="color" value={form.brandColor || "#0b615c"} onChange={(event) => set("brandColor", event.target.value)} /></label>
              <label><span>Accent colour</span><input type="color" value={form.accentColor || "#c78c2b"} onChange={(event) => set("accentColor", event.target.value)} /></label>
              <label className="wide"><span>Logo <small> PNG, JPG or WebP under 140 KB</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { set("logoDataUrl", await readLogo(file)); } catch (reason) { setError((reason as Error).message); } }} /></label>
              {form.logoDataUrl && <button type="button" className="cw-btn ghost" onClick={() => set("logoDataUrl", null)}>Remove logo</button>}
            </div>
            <button className="cw-btn primary"><Check size={15} /> Save changes</button>
          </section>
        </form>
      )}
    </div>
  );
}
