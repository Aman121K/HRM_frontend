"use client";
import Link from "next/link";
import { BellOff, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { caseUi } from "@/lib/case-ui";
import { relativeTime } from "@/lib/cases";

type Notification = { id: string | number; eventType: string; entityType: string; entityId: string; payload: Record<string, any>; createdAt: string; read?: boolean };

/** Where a notification should take the user. */
export function notificationHref(item: Notification) {
  const payload = item.payload || {};
  if (typeof payload.href === "string" && payload.href.startsWith("/")) return payload.href;
  if (item.entityType === "hr_case") return caseUi[payload.module]?.href || "/approvals";
  if (item.entityType === "leave") return item.eventType === "LEAVE_SUBMITTED" ? "/approvals" : "/leave";
  if (item.entityType === "survey") return `/surveys/${item.entityId}`;
  if (item.entityType.startsWith("payroll") || item.entityType === "payslip") return "/payroll";
  if (item.entityType.startsWith("roster")) return "/roster";
  return "/";
}

const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());

export function NotificationList({ onNavigate, onCount }: { onNavigate: () => void; onCount?: (unread: number) => void }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    httpRequest<{ items: Notification[]; unread: number }>("/api/v2/notifications")
      .then((data) => { setItems(data.items); onCount?.(data.unread); })
      .catch((reason) => { setError(reason.message); setItems([]); });
  }, [onCount]);
  const markAll = async () => {
    try {
      await httpRequest("/api/v2/notifications/read", { method: "POST", body: { all: true } });
      setItems((current) => current?.map((item) => ({ ...item, read: true })) || null);
      onCount?.(0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't mark as read."); }
  };
  return (
    <>
      {error && <p className="cw-alert" role="alert">{error}</p>}
      {!items ? <div className="cw-list-skeleton"><i /><i /><i /></div> : !items.length ? (
        <p className="notif-empty"><BellOff size={18} /> You’re all caught up.</p>
      ) : (
        <div className="notification-list">
          {items.slice(0, 20).map((item) => (
            <Link key={item.id} href={notificationHref(item)} onClick={onNavigate} className={item.read === false ? "unread" : ""}>
              <b>{item.payload?.message || item.payload?.title || humanize(item.eventType)}</b>
              <span>{[item.payload?.caseNumber, relativeTime(item.createdAt)].filter(Boolean).join(" · ")}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="notif-actions">
        {!!items?.length && <button className="secondary-button" onClick={markAll}>Mark all as read</button>}
        <Link className="notif-settings" href="/settings/notifications" onClick={onNavigate}><Settings2 size={14} /> Notification settings</Link>
      </div>
    </>
  );
}
