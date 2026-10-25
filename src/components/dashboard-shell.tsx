"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { peopleOnLeave, peopleWorkingFromHome, week } from "@/lib/dashboard-data";
import { caseApi, dueLabel, loadDefinitions, relativeTime } from "@/lib/cases";
import { caseUi } from "@/lib/case-ui";
import { formatMinutes, useAttendanceToday } from "@/lib/attendance-client";
import { useSelfieCapture } from "@/components/attendance/selfie-capture";
import { useOrgs } from "@/lib/org";
import { OrgSwitcher, RoleSwitcher, SidebarNav } from "@/components/sidebar-nav";
import { tenant } from "@/lib/tenant";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { ensureSession, signOut } from "@/lib/auth";
import { NotificationList } from "@/components/notifications/notification-list";
import { httpRequest } from "@/lib/http-client";
import { DashboardPulse } from "@/components/cases/dashboard-pulse";
import { PolicyGate } from "@/components/policy-gate";

type WelcomeContext = {
  greeting: string;
  topbarDate: string;
  workdayDate: string;
  message: string;
};

const defaultWelcome: WelcomeContext = {
  greeting: "Hello",
  topbarDate: "Today",
  workdayDate: "TODAY",
  message: "Here’s what needs your attention today.",
};

function getWelcomeContext(date: Date): WelcomeContext {
  const hour = date.getHours();
  const day = date.getDay();
  const greeting =
    hour < 5
      ? "Good night"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : hour < 22
            ? "Good evening"
            : "Good night";
  const message =
    day === 0 || day === 6
      ? "Your weekend overview is ready. Take a look whenever it suits you."
      : hour < 12
        ? "Three approvals need your attention. Your team is mostly in and moving well."
        : hour < 17
          ? "Here’s where your workday stands and what still needs your attention."
          : "Your workday summary is ready. Review anything you’d like to close out.";

  return {
    greeting,
    topbarDate: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date),
    workdayDate: new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
      .format(date)
      .toUpperCase(),
    message,
  };
}

export function DashboardShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setPunchedOut] = useState(true);
  const [notice, setNotice] = useState(2);
  const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [identity, setIdentity] = useState({ fullName: "", designation: "", employeeNumber: "", department: "", location: "" });
  useEffect(() => {
    void ensureSession();
    httpRequest<{ fullName: string; designation: string | null; employeeNumber: string; department: string | null; location: string | null }>("/api/v2/me")
      .then((me) => setIdentity({ fullName: me.fullName, designation: me.designation || "Employee", employeeNumber: me.employeeNumber, department: me.department || "", location: me.location || "" }))
      .catch(() => setIdentity((current) => ({ ...current, fullName: current.fullName || "there" })));
    httpRequest<{ unread: number }>("/api/v2/notifications").then((data) => setNotice(data.unread)).catch(() => {});
    Promise.all([loadDefinitions(), caseApi.inbox()])
      .then(([definitions, inbox]) => {
        const labels = new Map(definitions.items.map((module) => [module.key, module.label]));
        setTasks({
          total: inbox.total,
          items: inbox.items.slice(0, 4).map((item) => ({
            id: item.id, type: labels.get(item.module) || item.module, title: item.title,
            person: item.relation === "mine" ? `Your request · ${item.statusLabel}` : item.requester.name,
            due: item.dueAt ? dueLabel(item.dueAt, item.slaStopped) : relativeTime(item.createdAt), urgent: item.overdue,
            href: caseUi[item.module]?.href || "/approvals",
          })),
        });
      })
      .catch(() => setTasks({ total: 0, items: [] }));
  }, []);
  const [shiftToday, setShiftToday] = useState<{ status: string; weekHours: number; shift: { name: string; startTime: string; endTime: string; breakMinutes: number } | null; next: { name: string; date: string } | null } | null>(null);
  useEffect(() => { httpRequest<any>("/api/v2/roster/me/today").then(setShiftToday).catch(() => {}); }, []);
  const [tasks, setTasks] = useState<{ total: number; items: { id: string; type: string; title: string; person: string; due: string; urgent: boolean; href: string }[] } | null>(null);
  const identityInitials = identity.fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("");
  const firstName = identity.fullName.split(" ")[0];
  const [panel, setPanel] = useState<"profile" | "help" | "notifications" | "">(
    "",
  );
  const panelRef = useRef<HTMLElement>(null);
  const closePanel = useCallback(() => setPanel(""), []);
  useDialogFocus(Boolean(panel), closePanel, panelRef);
  const [welcome, setWelcome] = useState<WelcomeContext>(defaultWelcome);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [attendanceProof, setAttendanceProof] = useState<{
    photo: string;
    capturedAt: string;
  } | null>(null);
  const [punchInTime, setPunchInTime] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraDialogRef = useRef<HTMLElement>(null);
  const act = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    setCameraBusy(false);
  }, [stopCamera]);
  useDialogFocus(cameraOpen, closeCamera, cameraDialogRef);
  const startCamera = useCallback(async () => {
    setCameraBusy(true);
    setCameraError("");
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported here. Try a current browser on localhost or HTTPS.");
      setCameraBusy(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setCameraError(denied ? "Camera permission was denied. Allow camera access in your browser, then retry." : "We couldn’t start your camera. Check that it isn’t in use elsewhere, then retry.");
    } finally {
      setCameraBusy(false);
    }
  }, [stopCamera]);
  useEffect(() => {
    if (cameraOpen) void startCamera();
    return stopCamera;
  }, [cameraOpen, startCamera, stopCamera]);
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError("The camera is still getting ready. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const capturedAt = new Date();
    setAttendanceProof({ photo: canvas.toDataURL("image/jpeg", 0.86), capturedAt: capturedAt.toISOString() });
    setPunchInTime(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(capturedAt));
    setPunchedOut(false);
    closeCamera();
    act("You’re punched in — photo saved on this device");
  };
  const { current: currentOrg } = useOrgs();
  const orgName = currentOrg?.shortName || "";
  const attendance = useAttendanceToday();
  const selfieCapture = useSelfieCapture();
  const punchedOut = attendance.today?.state !== "PUNCHED_IN";
  const timeOf = (iso?: string) => iso ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";
  const capturePunch = async () => {
    const result = await attendance.punch(selfieCapture.request);
    if (!result) return;
    const last = result.events[result.events.length - 1];
    const where = last?.withinGeofence === true ? " at your site" : last?.withinGeofence === false ? ` — ${Math.round(last.distanceMetres || 0)} m from your site, flagged for review` : "";
    act(result.state === "PUNCHED_IN" ? `You’re punched in${where}` : `Punched out · ${formatMinutes(result.workedMinutes)} worked today`);
  };

  useEffect(() => {
    const refreshWelcome = () => setWelcome(getWelcomeContext(new Date()));
    refreshWelcome();
    const timer = window.setInterval(refreshWelcome, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell module-shell">
      <aside
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
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
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <SidebarNav onNavigate={() => setMenuOpen(false)} />
        <div className="sidebar-foot">
          <RoleSwitcher />
          <OrgSwitcher />
        </div>
      </aside>

      {menuOpen && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main>
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </button>
          <div className={`search ${searchOpen ? "searching" : ""}`}>
            <Search size={17} />
            {searchOpen ? (
              <input
                autoFocus
                aria-label="Search"
                placeholder="Try “leave” or “payslip”"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  act(`Search ready for “${e.currentTarget.value}”`)
                }
              />
            ) : (
              <button onClick={() => setSearchOpen(true)}>
                Search people, actions, or pages
              </button>
            )}
            <kbd>⌘ K</kbd>
          </div>
          <div className="date-context">
            <CalendarDays size={16} />
            <span>{welcome.topbarDate}</span>
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
          <button
            className="profile"
            aria-label={`Open ${identity.fullName}'s employee profile`}
            onClick={() => setPanel("profile")}
          >
            <span>{identityInitials}</span>
            <i>
              {identity.fullName}<small>{identity.designation}</small>
            </i>
            <ChevronDown size={15} />
          </button>
        </header>

        <div className="page-wrap">
          <section className="welcome">
            <div>
              <p className="eyebrow">YOUR WORKDAY · {welcome.workdayDate}</p>
              <h1>{welcome.greeting}{firstName ? `, ${firstName}` : ""}.</h1>
              <p>{welcome.message}</p>
            </div>
            <button
              className="day-brief"
              onClick={() => act("Daily brief: 3 approvals, payroll in 4 days")}
            >
              <Sparkles size={16} /> View daily brief
            </button>
          </section>

          <div className="dashboard-grid">
            <section className="attendance panel-dark">
              <div className="panel-head inverse">
                <div>
                  <p className="eyebrow">ATTENDANCE</p>
                  <h2>
                    {attendance.today?.state === "PUNCHED_IN" ? "You’re on the clock" : attendance.today?.state === "PUNCHED_OUT" ? "Workday complete" : "Ready to start your day"}
                  </h2>
                </div>
                <span className={`live-dot ${punchedOut ? "off" : ""}`}>
                  <i />
                  {punchedOut ? "Punched out" : "Live"}
                </span>
              </div>
              <div className="attendance-summary">
                <div>
                  <strong>{formatMinutes(attendance.workedMinutes)}</strong>
                  <span>{attendance.error ? attendance.error : punchedOut ? (attendance.today?.state === "PUNCHED_OUT" ? `Last out ${timeOf(attendance.last?.occurredAt)}` : "Ready to begin") : `Since ${timeOf(attendance.firstIn?.occurredAt)}${attendance.last?.withinGeofence === false ? " · outside site" : ""}`}</span>
                </div>
                <div className="shift">
                  <span>Today’s shift</span>
                  <b>{shiftToday?.status === "SHIFT" && shiftToday.shift ? `${shiftToday.shift.name} · ${shiftToday.shift.startTime}–${shiftToday.shift.endTime}` : shiftToday?.status === "WEEKLY_OFF" ? "Weekly off" : shiftToday?.status === "LEAVE" ? "On leave" : shiftToday ? "Not rostered" : "—"}</b>
                  <small>{shiftToday?.shift ? `${shiftToday.shift.breakMinutes} min break · ${shiftToday.weekHours} h this week` : shiftToday?.next ? `Next: ${shiftToday.next.name} on ${shiftToday.next.date}` : "See your roster"}</small>
                </div>
                <button onClick={capturePunch} disabled={attendance.busy || !attendance.today} aria-busy={attendance.busy}>
                  {punchedOut ? (
                    <Clock3 size={18} />
                  ) : (
                    <Zap size={18} fill="currentColor" />
                  )}
                  {punchedOut ? "Punch in" : "Punch out"}
                </button>
              </div>
              {attendanceProof && (
                <div className="attendance-proof">
                  <img src={attendanceProof.photo} alt="Your punch-in camera capture" />
                  <div>
                    <span>PUNCH-IN PHOTO</span>
                    <b>Visual check-in saved</b>
                    <small>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(attendanceProof.capturedAt))}</small>
                  </div>
                  <button type="button" onClick={() => setCameraOpen(true)} aria-label="Retake punch-in photo">
                    <Camera size={14} /> Retake
                  </button>
                </div>
              )}
              <div className="timeline" aria-label="Workday progress timeline">
                <div className="time-labels">
                  <span>9 AM</span>
                  <span>12 PM</span>
                  <span>3 PM</span>
                  <span>6 PM</span>
                </div>
                <div className="track">
                  <div className="expected" />
                  <div
                    className="elapsed"
                    style={{ width: punchedOut ? "93%" : "42%" }}
                  />
                  <i className="punch start" />
                  <i
                    className="now"
                    style={{ left: punchedOut ? "93%" : "42%" }}
                  />
                </div>
                <div className="event-labels">
                  <span>{attendance.firstIn ? <><b>{timeOf(attendance.firstIn.occurredAt)}</b> Punched in</> : "No punch recorded"}</span>
                  <span
                    className="now-label"
                    style={{ left: punchedOut ? "93%" : "42%" }}
                  >
                    {punchedOut ? "5:38 PM" : "Now · 12:50"}
                  </span>
                </div>
              </div>
              <div className="week-rhythm">
                <span>This week</span>
                {week.map((d) => (
                  <div key={d.day}>
                    <small>{d.day}</small>
                    <i>
                      <b
                        className={d.tone}
                        style={{ width: `${(d.value / 9) * 100}%` }}
                      />
                    </i>
                    <em>{d.value}h</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="quick-actions">
              <div className="section-title">
                <div>
                  <p className="eyebrow">SELF SERVICE</p>
                  <h2>Quick actions</h2>
                </div>
                <button
                  aria-label="More self-service actions"
                  aria-expanded={moreOpen}
                  aria-controls="more-self-service"
                  onClick={() => setMoreOpen((value) => !value)}
                >
                  <MoreHorizontal />
                </button>
              </div>
              {moreOpen && (
                <div className="quick-more-menu" id="more-self-service">
                  <Link href="/expenses">Submit an expense claim</Link>
                  <Link href="/helpdesk">Raise a helpdesk ticket</Link>
                  <Link href="/letters">Request an HR letter</Link>
                  <Link href="/travel">Plan business travel</Link>
                  <Link href="/learning">Request training</Link>
                  <Link href="/my-space">Update personal details</Link>
                </div>
              )}
              <div className="action-list">
                <Link href="/leave/apply">
                  <span className="action-icon teal">
                    <CalendarDays />
                  </span>
                  <i>
                    Request leave<small>Plan time away</small>
                  </i>
                  <b>→</b>
                </Link>
                <Link href="/attendance/regularize">
                  <span className="action-icon coral">
                    <Clock3 />
                  </span>
                  <i>
                    Regularize time<small>Fix a missed punch</small>
                  </i>
                  <b>→</b>
                </Link>
                <Link href="/payroll/payslips/2026-06">
                  <span className="action-icon gold">
                    <WalletCards />
                  </span>
                  <i>
                    View payslip<small>June 2026</small>
                  </i>
                  <b>→</b>
                </Link>
                <Link href="/payroll/tax">
                  <span className="action-icon blue">
                    <FileText />
                  </span>
                  <i>
                    Tax documents<small>Form 16 & declarations</small>
                  </i>
                  <b>→</b>
                </Link>
                <Link href="/people">
                  <span className="action-icon green">
                    <Users />
                  </span>
                  <i>
                    People directory<small>Find a colleague</small>
                  </i>
                  <b>→</b>
                </Link>
              </div>
            </section>

            <section className="leave panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">TIME OFF</p>
                  <h2>Leave balance</h2>
                </div>
                <Link className="text-action" href="/leave">
                  View details →
                </Link>
              </div>
              <div className="leave-grid">
                <div>
                  <span className="leave-ring teal-ring">
                    <b>12</b>
                  </span>
                  <p>
                    Earned leave<small>of 18 days</small>
                  </p>
                </div>
                <div>
                  <span className="leave-ring coral-ring">
                    <b>5</b>
                  </span>
                  <p>
                    Casual leave<small>of 8 days</small>
                  </p>
                </div>
                <div>
                  <span className="leave-ring gold-ring">
                    <b>7</b>
                  </span>
                  <p>
                    Sick leave<small>of 10 days</small>
                  </p>
                </div>
              </div>
              <div className="holiday">
                <span className="calendar-tile">
                  <b>15</b>
                  <small>AUG</small>
                </span>
                <p>
                  <small>UPCOMING HOLIDAY</small>
                  <b>Independence Day</b>
                  <span>Saturday · in 19 days</span>
                </p>
                <Link href="/leave/apply">Plan leave</Link>
              </div>
            </section>

            <section className="tasks panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">INBOX</p>
                  <h2>
                    Needs your attention {!!tasks?.total && <span>{tasks.total}</span>}
                  </h2>
                </div>
                <Link className="text-action" href="/approvals">
                  View all →
                </Link>
              </div>
              <div className="task-list">
                {tasks && !tasks.items.length && (
                  <p className="task-empty"><Check size={15} /> You’re all caught up — nothing is waiting on you.</p>
                )}
                {tasks?.items.map((task) => (
                  <Link
                    href={task.person.startsWith("Your request") ? task.href : "/approvals"}
                    className="task-link"
                    key={task.id}
                  >
                    <span
                      className={`task-check ${task.urgent ? "urgent" : ""}`}
                    >
                      <Check size={15} />
                    </span>
                    <div>
                      <small>{task.type}</small>
                      <b>{task.title}</b>
                      <p>{task.person}</p>
                    </div>
                    <em className={task.urgent ? "urgent-text" : ""}>
                      {task.due}
                    </em>
                  </Link>
                ))}
              </div>
            </section>

            <section className="team-panel panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">COMPANY AVAILABILITY · {peopleOnLeave.length + peopleWorkingFromHome.length} PEOPLE</p>
                  <h2>Who’s away &amp; remote today</h2>
                </div>
                <Link className="text-action" href="/people/organization-chart">
                  View organization →
                </Link>
              </div>
              <div className="availability-board">
                <section className="availability-group leave-group" aria-labelledby="leave-today-heading">
                  <header>
                    <span className="availability-mark"><CalendarDays size={16} /></span>
                    <div><h3 id="leave-today-heading">On leave today</h3><p>{peopleOnLeave.length} colleagues away</p></div>
                  </header>
                  <div className="availability-list">
                    {peopleOnLeave.map((person) => (
                      <Link href="/people/organization-chart" key={person.name}>
                        <span className={`avatar ${person.color}`}>{person.initials}</span>
                        <span><b>{person.name}</b><small>{person.role}</small></span>
                        <em>{person.leaveType}<small>{person.returns}</small></em>
                      </Link>
                    ))}
                  </div>
                </section>
                <section className="availability-group remote-group" aria-labelledby="wfh-today-heading">
                  <header>
                    <span className="availability-mark"><Home size={16} /></span>
                    <div><h3 id="wfh-today-heading">Working from home</h3><p>{peopleWorkingFromHome.length} colleagues remote</p></div>
                  </header>
                  <div className="availability-list">
                    {peopleWorkingFromHome.map((person) => (
                      <Link href="/people/organization-chart" key={person.name}>
                        <span className={`avatar ${person.color}`}>{person.initials}</span>
                        <span><b>{person.name}</b><small>{person.role}</small></span>
                        <em>{person.location}<small>{person.availability}</small></em>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <section className="payroll panel-dark compact-dark">
              <div className="panel-head inverse">
                <div>
                  <p className="eyebrow">PAYROLL</p>
                  <h2>June salary</h2>
                </div>
                <WalletCards size={22} />
              </div>
              <div className="net-pay">
                <small>NET PAY</small>
                <strong>₹1,24,860</strong>
                <span>Credited 30 Jun 2026</span>
              </div>
              <div className="payroll-next">
                <span>
                  Next payroll<small>31 Jul · 4 days</small>
                </span>
                <Link href="/payroll/payslips/2026-06">Download payslip</Link>
              </div>
            </section>

            <section className="announcements panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">
                    AROUND {(orgName || "YOUR COMPANY").toUpperCase()}
                  </p>
                  <h2>News & events</h2>
                </div>
                <Link className="text-action" href="/announcements">
                  See all →
                </Link>
              </div>
              <Link href="/announcements" className="feature-news">
                <span className="news-date">
                  30<small>JUL</small>
                </span>
                <div>
                  <small>TOWN HALL · 4:00 PM</small>
                  <h3>Quarterly all-hands</h3>
                  <p>Join leadership for company updates and a live Q&A.</p>
                </div>
              </Link>
              <Link href="/announcements" className="news-row">
                <span className="news-symbol coral-bg">✦</span>
                <div>
                  <small>ANNOUNCEMENT</small>
                  <b>New parental leave policy</b>
                  <p>More flexibility, effective 1 August.</p>
                </div>
              </Link>
            </section>
          </div>
          <DashboardPulse />
          <footer>
            Northstar People · Workspace data refreshed just now{" "}
            <span>Privacy · Help centre</span>
          </footer>
        </div>
      </main>
      {panel && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close panel"
            onClick={closePanel}
          />
          <aside
            className="record-drawer drawer-compact drawer-content shell-flow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-panel-title"
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
            {panel === "profile" ? (
              <>
                <p className="eyebrow">SIGNED IN AS</p>
                <h2 id="dashboard-panel-title">{identity.fullName}</h2>
                <p className="flow-intro">
                  {identity.designation}{orgName ? ` · ${orgName}` : ""}
                </p>
                <div className="profile-drawer-summary">
                  <span>{identityInitials}</span>
                  <div>
                    <b>{identity.fullName}</b>
                    <small>{identity.department} · {identity.location} · Employee ID {identity.employeeNumber}</small>
                  </div>
                </div>
                <div className="flow-link-list">
                  <Link href="/my-space" onClick={closePanel}>
                    View full profile <span>→</span>
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
            ) : panel === "help" ? (
              <>
                <p className="eyebrow">HELP CENTRE</p>
                <h2 id="dashboard-panel-title">How can we help?</h2>
                <p className="flow-intro">
                  Guidance for your most common employee tasks.
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
                      act("Support request created: NS-1049");
                      closePanel();
                    }}
                  >
                    Contact People Support <span>→</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">NOTIFICATIONS</p>
                <h2 id="dashboard-panel-title">Your updates</h2>
                <p className="flow-intro">
                  Recent activity requiring your attention.
                </p>
                <NotificationList onNavigate={closePanel} onCount={setNotice} />
              </>
            )}
          </aside>
        </>
      )}
      {selfieCapture.element}
      {cameraOpen && (
        <>
          <button className="flow-backdrop" aria-label="Cancel camera capture" onClick={closeCamera} />
          <section className="flow-dialog camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title" ref={cameraDialogRef} tabIndex={-1}>
            <button className="flow-close" aria-label="Close camera" onClick={closeCamera}><X size={18} /></button>
            <p className="eyebrow">ATTENDANCE CHECK-IN</p>
            <h2 id="camera-dialog-title">Take your punch-in photo</h2>
            <p className="camera-intro">Center your face in the frame. Your photo stays in this local demo and appears beside today’s attendance.</p>
            <div className={`camera-frame ${cameraError ? "has-error" : ""}`}>
              <video ref={videoRef} muted playsInline aria-label="Live front-facing camera preview" />
              {cameraBusy && <div className="camera-state"><i /><span>Starting camera…</span></div>}
              {cameraError && <div className="camera-state camera-error"><Camera size={28} /><b>Camera unavailable</b><span>{cameraError}</span></div>}
              {!cameraBusy && !cameraError && <span className="camera-guide" aria-hidden="true" />}
            </div>
            <div className="camera-actions">
              <button className="secondary-button" onClick={closeCamera}>Cancel</button>
              {cameraError ? <button className="camera-primary" onClick={() => void startCamera()}><Camera size={17} /> Retry camera</button> : <button className="camera-primary" disabled={cameraBusy} onClick={capturePhoto}><Camera size={17} /> Capture photo</button>}
            </div>
          </section>
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
