"use client";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NotificationList } from "@/components/notifications/notification-list";

export default function Page() {
  return (
    <AppShell>
      <div className="cw-page notif-page" style={{ ["--accent" as string]: "#0b615c" }}>
        <header className="cw-hero">
          <span className="cw-hero-icon"><Bell size={26} strokeWidth={1.7} /></span>
          <div><p className="cw-eyebrow">OVERVIEW · INBOX</p><h1>Notifications</h1><p>Everything that happened on your requests, approvals, payslips and roster.</p></div>
        </header>
        <section className="ns-card"><NotificationList onNavigate={() => {}} /></section>
      </div>
    </AppShell>
  );
}
