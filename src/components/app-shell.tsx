"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigation } from "@/lib/modules";
import { OrgSwitcher, RoleSwitcher, SidebarNav } from "@/components/sidebar-nav";
import { tenant } from "@/lib/tenant";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { ensureSession, signOut } from "@/lib/auth";
import { NotificationList } from "@/components/notifications/notification-list";
import { useOrgs } from "@/lib/org";
import { httpRequest } from "@/lib/http-client";
import { PolicyGate } from "@/components/policy-gate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [panel, setPanel] = useState(""),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [notice, setNotice] = useState(2),
    [toast, setToast] = useState(""),
    [identity, setIdentity] = useState({ fullName: "Vikas Tiwari", designation: "Product Lead" });
  const initials = identity.fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("");
  const panelRef = useRef<HTMLDivElement>(null);
  const { current: currentOrg } = useOrgs();
  const orgName = currentOrg?.shortName || "";
  const closePanel = useCallback(() => setPanel(""), []);
  useDialogFocus(Boolean(panel), closePanel, panelRef);
  const notify = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };
  const date = new Intl.DateTimeFormat(tenant.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tenant.timezone,
  }).format(new Date());
  const results = useMemo(
    () =>
      navigation
        .filter(
          (x) =>
            !query ||
            `${x.label} ${x.href}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 7),
    [query],
  );
  useEffect(() => {
    void ensureSession();
    httpRequest<{ unread: number }>("/api/v2/notifications").then((data) => setNotice(data.unread)).catch(() => {});
    httpRequest<any>("/api/v2/me")
      .then((data) => {
        setIdentity({ fullName: data.fullName, designation: data.designation || "Employee" });
      })
      .catch(() => {});
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
      if (e.key === "Escape") {
        setSearching(false);
        setPanel("");
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="app-shell module-shell">
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/" className="brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            northstar<small>PEOPLE</small>
          </span>
        </Link>
        <button
          className="mobile-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="sidebar-foot">
          <RoleSwitcher />
          <OrgSwitcher />
        </div>
      </aside>
      {open && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <main>
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className={`search ${searching ? "searching" : ""}`}>
            <Search size={17} />
            <input
              value={query}
              onFocus={() => setSearching(true)}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search this workspace"
              placeholder="Search people, actions, or pages"
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0])
                  router.push(results[0].href);
              }}
            />
            {query && (
              <button
                className="search-clear"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
            <kbd>⌘ K</kbd>
            {searching && (
              <div className="workspace-results" role="listbox">
                {results.map((x) => (
                  <button
                    key={x.href}
                    onClick={() => {
                      router.push(x.href);
                      setSearching(false);
                    }}
                  >
                    <b>{x.label}</b>
                    <span>
                      {x.href === "/"
                        ? "Dashboard"
                        : x.href.slice(1).replaceAll("-", " ")}
                    </span>
                  </button>
                ))}
                {!results.length && <p>No matching workspace pages.</p>}
              </div>
            )}
          </div>
          <div className="date-context">
            <CalendarDays size={16} />
            <span>{date}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Help"
            onClick={() => setPanel("help")}
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="icon-button notification"
            aria-label={`${notice} notifications`}
            onClick={() => setPanel("notifications")}
          >
            <Bell size={19} />
            {notice > 0 && <b>{notice}</b>}
          </button>
          <button className="profile" onClick={() => setPanel("profile")}>
            <span>{initials}</span>
            <i>
              {identity.fullName}<small>{identity.designation}</small>
            </i>
            <ChevronDown size={15} />
          </button>
        </header>
        {children}
      </main>
      {panel && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close panel"
            onClick={closePanel}
          />
          <div
            className="record-drawer drawer-compact drawer-content shell-flow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shell-title"
            ref={panelRef}
            tabIndex={-1}
          >
            <button
              className="flow-close"
              aria-label="Close"
              onClick={closePanel}
            >
              <X size={18} />
            </button>
            {panel === "help" ? (
              <>
                <p className="eyebrow">HELP CENTRE</p>
                <h2 id="shell-title">Workspace help</h2>
                <p className="flow-intro">
                  Find guidance or connect with People Support.
                </p>
                <div className="flow-link-list">
                  <Link href="/my-space" onClick={closePanel}>
                    Profile and documents <span>→</span>
                  </Link>
                  <Link href="/leave" onClick={closePanel}>
                    Leave and holidays <span>→</span>
                  </Link>
                  <Link href="/attendance" onClick={closePanel}>
                    Attendance and punches <span>→</span>
                  </Link>
                  <Link href="/payroll" onClick={closePanel}>
                    Payroll and taxes <span>→</span>
                  </Link>
                  <button
                    onClick={() => {
                      notify("Support request created: NS-1049");
                      setPanel("");
                    }}
                  >
                    Contact support <span>→</span>
                  </button>
                </div>
              </>
            ) : panel === "notifications" ? (
              <>
                <p className="eyebrow">NOTIFICATIONS</p>
                <h2 id="shell-title">Your updates</h2>
                <NotificationList onNavigate={closePanel} onCount={setNotice} />
              </>
            ) : (
              <>
                <p className="eyebrow">SIGNED IN AS</p>
                <h2 id="shell-title">{identity.fullName}</h2>
                <p className="flow-intro">
                  {identity.designation}{orgName ? ` · ${orgName}` : ""}
                </p>
                <div className="flow-link-list">
                  <Link href="/my-space" onClick={closePanel}>
                    View profile <span>→</span>
                  </Link>
                  <Link href="/settings/security" onClick={closePanel}>
                    My security (password, 2-step, sessions) <span>→</span>
                  </Link>
                  <Link href="/my-space/privacy" onClick={closePanel}>
                    My data &amp; privacy <span>→</span>
                  </Link>
                  <Link href="/settings" onClick={closePanel}>
                    Workspace settings <span>→</span>
                  </Link>
                  <button
                    onClick={() => { void signOut(); }}
                  >
                    Sign out <span>→</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <PolicyGate />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
