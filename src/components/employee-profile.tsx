"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, FileText, Users, WalletCards } from "lucide-react";
import { httpRequest } from "@/lib/http-client";

type Me = { id: string; employeeNumber: string; fullName: string; workEmail: string; department: string | null; designation: string | null;
  location: string | null; managerId: string | null; joiningDate: string | null; status: string };
type Row = { id: string; employeeNumber: string; fullName: string; manager: string | null };

const fmt = (v: string | null) => v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

/** The signed-in employee's own profile — only what the organisation has on record. */
export function EmployeeProfile() {
  const [me, setMe] = useState<Me | null>(null);
  const [manager, setManager] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    httpRequest<Me>("/api/v2/me").then((m) => {
      setMe(m);
      httpRequest<{ items: Row[] }>(`/api/v2/employees?search=${encodeURIComponent(m.employeeNumber)}&limit=5`)
        .then((d) => setManager(d.items.find((x) => x.id === m.id)?.manager ?? null)).catch(() => {});
    }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your profile."));
  }, []);
  const initials = me?.fullName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "";
  const facts: [string, string][] = me ? [
    ["Employee ID", me.employeeNumber], ["Work email", me.workEmail], ["Designation", me.designation || "—"],
    ["Department", me.department || "—"], ["Location", me.location || "—"], ["Reports to", manager || "—"],
    ["Date of joining", fmt(me.joiningDate)], ["Status", me.status[0] + me.status.slice(1).toLowerCase()],
  ] : [];
  return (
    <div className="core-page">
      <header className="core-heading">
        <div>
          <p className="eyebrow">MY PROFILE</p>
          <h1>{me ? me.fullName : error ? "Profile" : "Loading…"}</h1>
          <p>{me ? [me.designation, me.department].filter(Boolean).join(" · ") || "Your employment record" : ""}</p>
        </div>
        {initials && <span className="avatar" style={{ width: 56, height: 56, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, background: "var(--canvas)", border: "1px solid var(--line)" }}>{initials}</span>}
      </header>
      {error && <p className="core-error">{error}</p>}
      {me && (
        <>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0, border: "1px solid var(--line)", background: "var(--paper)", margin: "8px 0 24px" }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
                <dt style={{ fontSize: "var(--type-caption)", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>{k}</dt>
                <dd style={{ margin: "4px 0 0", color: "var(--ink)", overflowWrap: "anywhere" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <p style={{ color: "var(--muted)", fontSize: "var(--type-body-small)" }}>Something wrong here? Raise a Helpdesk request and HR will update your record.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <Link className="lo-secondary" style={{ padding: "11px 16px", border: "1px solid var(--line)", display: "inline-flex", gap: 8, alignItems: "center" }} href="/leave"><CalendarDays size={16} /> My leave</Link>
            <Link className="lo-secondary" style={{ padding: "11px 16px", border: "1px solid var(--line)", display: "inline-flex", gap: 8, alignItems: "center" }} href="/payroll"><WalletCards size={16} /> Payslips</Link>
            <Link className="lo-secondary" style={{ padding: "11px 16px", border: "1px solid var(--line)", display: "inline-flex", gap: 8, alignItems: "center" }} href="/directory/organization-chart"><Users size={16} /> Org chart</Link>
            <Link className="lo-secondary" style={{ padding: "11px 16px", border: "1px solid var(--line)", display: "inline-flex", gap: 8, alignItems: "center" }} href="/helpdesk"><FileText size={16} /> Helpdesk</Link>
          </div>
          
        </>
      )}
    </div>
  );
}
