"use client";
import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { signOut as endSession } from "@/lib/auth";
import { AdminInvite } from "./admin-invite";
import { PlatformConsole } from "./platform-console";
import { ComplianceCenter } from "./compliance-center";
import { SecurityCenter } from "./security-center";
import { BillingConsole } from "@/components/billing/billing-console";
import { PlatformPrivacy } from "@/components/privacy/platform-privacy";

/** Standalone super-admin workspace: no brand navigation, only platform administration. */
export function AdminConsole() {
  const [me, setMe] = useState<{ fullName: string; email: string } | null>(null);
  const [tab, setTab] = useState<"brands" | "security" | "compliance" | "billing" | "privacy">("brands");
  useEffect(() => {
    httpRequest<{ fullName: string; email: string }>("/api/v2/platform/me").then(setMe)
      .catch(() => window.location.replace("/admin/login"));
  }, []);
  // Revokes the refresh session on the server, then returns to the admin sign-in page.
  const signOut = () => {
    try { ["hrm.org_id", "hrm.org_slug"].forEach((key) => window.localStorage.removeItem(key)); } catch { /* ignore */ }
    void endSession();
  };
  if (!me) return <div className="adm-shell"><div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div></div>;
  return (
    <div className="adm-shell">
      <header className="adm-bar">
        <div className="auth-logo"><span className="brand-mark"><i /><i /><i /></span><span>northstar<small>PLATFORM</small></span></div>
        <span className="adm-badge"><ShieldCheck size={14} /> Super admin</span>
        <nav className="adm-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "brands"} className={tab === "brands" ? "active" : ""} onClick={() => setTab("brands")}>Brands</button>
          <button role="tab" aria-selected={tab === "security"} className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}>Security</button>
          <button role="tab" aria-selected={tab === "compliance"} className={tab === "compliance" ? "active" : ""} onClick={() => setTab("compliance")}>Compliance</button>
          <button role="tab" aria-selected={tab === "billing"} className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")}>Billing</button>
          <button role="tab" aria-selected={tab === "privacy"} className={tab === "privacy" ? "active" : ""} onClick={() => setTab("privacy")}>Data privacy</button>
        </nav>
        <span className="adm-user"><b>{me.fullName}</b><small>{me.email}</small></span>
        <button className="cw-btn ghost" onClick={signOut}><LogOut size={15} /> Sign out</button>
      </header>
      {tab === "privacy" ? <PlatformPrivacy /> : tab === "billing" ? <BillingConsole /> : tab === "brands" ? <PlatformConsole /> : tab === "security" ? <><AdminInvite /><SecurityCenter /></> : <ComplianceCenter />}
    </div>
  );
}
