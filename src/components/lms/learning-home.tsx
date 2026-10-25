"use client";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Award, BellRing, BookOpenCheck, CalendarClock, ChevronRight, Download, ExternalLink, GraduationCap, Loader2,
  PlayCircle, Search, Settings2, Sparkles, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { initials, shortDate } from "@/lib/cases";
import { CourseCard, CourseCover, EnrollmentBadge, ProgressRing } from "./course-card";
import { dueText, errorText, lmsApi, minutesLabel, useAsync, type Course } from "./lms-api";

type Tab = "catalog" | "mine" | "certificates" | "team";

export function LearningHome() {
  const options = useAsync(() => lmsApi.options(), []);
  const mine = useAsync(() => lmsApi.me(), []);
  const [tab, setTab] = useState<Tab>("catalog");
  const [toast, setToast] = useState("");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "mine" || requested === "certificates" || requested === "team" || requested === "catalog") setTab(requested);
  }, []);
  const choose = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "catalog") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const viewer = options.data?.viewer;
  const stats = mine.data?.stats;
  const assigned = useMemo(() => (mine.data?.items || []).filter((course) => course.enrollment && course.enrollment.status !== "COMPLETED" && (course.enrollment.dueDate || course.enrollment.source !== "SELF")), [mine.data]);
  const resume = useMemo(() => (mine.data?.items || []).filter((course) => course.enrollment?.status === "IN_PROGRESS" && course.enrollment.lastLessonId)[0], [mine.data]);

  if (options.error) return (
    <div className="cw-page lms-page"><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {options.error} Make sure the platform API is running.</p></div>
  );

  return (
    <div className="cw-page lms-page" style={{ ["--accent" as string]: "#0f8177" }}>
      <header className="cw-hero lms-hero">
        <span className="cw-hero-icon"><GraduationCap size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">GROW · LEARNING</p>
          <h1>{viewer ? `Keep growing, ${viewer.name.split(" ")[0]}` : "Learning"}</h1>
          <p>Coffee craft, service and leadership courses built by our own teams — plus the compliance training everyone needs. Pick up where you left off on any device.</p>
        </div>
        <div className="lms-hero-actions">
          <Link className="cw-btn ghost" href="/learning/requests"><ExternalLink size={15} /> Request external training</Link>
          {viewer?.canAuthor && <Link className="cw-btn primary" href="/learning/admin"><Settings2 size={15} /> Manage courses</Link>}
        </div>
      </header>

      <section className="cw-stats" aria-label="Your learning summary">
        <article><small>In progress</small><b>{stats ? stats.inProgress : "—"}</b><span>courses underway</span></article>
        <article className={stats?.overdue ? "attention lms-danger" : stats?.dueSoon ? "attention" : ""}>
          <small>Assigned to you</small><b>{stats ? stats.assigned : "—"}</b>
          <span>{stats ? (stats.overdue ? `${stats.overdue} overdue` : stats.dueSoon ? `${stats.dueSoon} due this week` : "nothing overdue") : "loading"}</span>
        </article>
        <article><small>Completed</small><b>{stats ? stats.completed : "—"}</b><span>{stats ? `${stats.certificates} certificate${stats.certificates === 1 ? "" : "s"}` : "loading"}</span></article>
        <article><small>Time learned</small><b>{stats ? hours(stats.minutesLearned) : "—"}</b><span>across all courses</span></article>
      </section>

      {mine.error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {mine.error}</p>}

      {resume && (
        <Link href={`/learning/course/${resume.id}?lesson=${resume.enrollment!.lastLessonId}`} className="lms-resume">
          <CourseCover course={resume} compact />
          <span><small>Pick up where you left off</small><b>{resume.title}</b><em>{resume.lastLessonTitle ? `Next: ${resume.lastLessonTitle}` : "Continue the course"}</em></span>
          <ProgressRing value={resume.enrollment!.progressPct} size={48} />
          <span className="cw-btn primary"><PlayCircle size={16} /> Resume</span>
        </Link>
      )}

      {assigned.length > 0 && (
        <section className="lms-rail" aria-labelledby="assigned-heading">
          <header><h2 id="assigned-heading"><CalendarClock size={17} /> Assigned to you</h2><span>{assigned.length} to finish</span></header>
          <div className="lms-rail-track">
            {assigned.map((course) => (
              <Link key={course.id} href={`/learning/course/${course.id}`} className={`lms-rail-card ${course.enrollment!.overdue ? "overdue" : course.enrollment!.dueSoon ? "soon" : ""}`}>
                <CourseCover course={course} compact />
                <span className="lms-rail-text">
                  <b>{course.title}</b>
                  <small>{course.enrollment!.source === "MANDATORY" ? "Mandatory compliance" : course.enrollment!.assignedBy ? `Assigned by ${course.enrollment!.assignedBy}` : "Assigned"}</small>
                  <em>{course.enrollment!.dueDate ? `${dueText(course.enrollment!.dueDate)} · ${shortDate(course.enrollment!.dueDate)}` : "No due date"}</em>
                </span>
                <ProgressRing value={course.enrollment!.progressPct} size={40} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist" aria-label="Learning views">
          {([["catalog", "Catalogue"], ["mine", "My learning"], ["certificates", "Certificates"], ...(viewer?.hasReports ? [["team", "My team"]] : [])] as [Tab, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => choose(key)}>{label}</button>
          ))}
        </div>
      </div>

      {tab === "catalog" && <Catalogue />}
      {tab === "mine" && <MyLearning loading={mine.loading} items={mine.data?.items || []} onBrowse={() => choose("catalog")} />}
      {tab === "certificates" && <Certificates loading={mine.loading} items={mine.data?.certificates || []} />}
      {tab === "team" && viewer?.hasReports && <TeamView flash={flash} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

const hours = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)} h`);

function Catalogue() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const catalog = useAsync(() => lmsApi.catalog(query, category), [query, category]);
  const all = useAsync(() => lmsApi.catalog(), []);
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer); }, [search]);
  const categories = all.data?.categories || [];
  const total = categories.reduce((sum, row) => sum + row.count, 0);
  const items = catalog.data?.items || [];
  return (
    <section aria-label="Course catalogue">
      <div className="lms-filter-row">
        <div className="cw-chips" aria-label="Filter by category">
          <button className={!category ? "active" : ""} onClick={() => setCategory("")} aria-pressed={!category}>All <b>{total}</b></button>
          {categories.map((row) => (
            <button key={row.category} className={category === row.category ? "active" : ""} aria-pressed={category === row.category} onClick={() => setCategory(category === row.category ? "" : row.category)}>{row.category} <b>{row.count}</b></button>
          ))}
        </div>
        <label className="cw-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses" aria-label="Search courses" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={13} /></button>}</label>
      </div>
      {catalog.error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {catalog.error}</p>}
      {catalog.loading && !items.length ? <div className="lms-grid">{[0, 1, 2].map((key) => <div key={key} className="lms-card-skeleton" />)}</div>
        : !items.length ? (
          <div className="cw-empty">
            <span><BookOpenCheck size={26} /></span>
            <h2>{query || category ? "No courses match" : "The catalogue is empty"}</h2>
            <p>{query || category ? "Try another search or category." : "Your HR team hasn't published any courses yet. You can still request external training."}</p>
            <Link className="cw-btn ghost" href="/learning/requests"><ExternalLink size={15} /> Request external training</Link>
          </div>
        ) : <div className="lms-grid">{items.map((course) => <CourseCard key={course.id} course={course} />)}</div>}
      <Link href="/learning/requests" className="lms-external">
        <Sparkles size={18} />
        <span><b>Can&apos;t find what you need?</b><small>Request a workshop, certification or conference — your manager approves it in Learning requests.</small></span>
        <ArrowRight size={17} />
      </Link>
    </section>
  );
}

function MyLearning({ items, loading, onBrowse }: { items: Course[]; loading: boolean; onBrowse: () => void }) {
  if (loading && !items.length) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  if (!items.length) return (
    <div className="cw-empty"><span><GraduationCap size={26} /></span><h2>You haven&apos;t started any courses</h2>
      <p>Browse the catalogue and enrol in anything that interests you — progress is saved lesson by lesson.</p>
      <button className="cw-btn primary" onClick={onBrowse}>Browse courses</button></div>
  );
  const groups: [string, Course[]][] = [
    ["In progress", items.filter((course) => course.enrollment?.status === "IN_PROGRESS")],
    ["Not started", items.filter((course) => course.enrollment?.status === "NOT_STARTED")],
    ["Completed", items.filter((course) => course.enrollment?.status === "COMPLETED")],
  ];
  return (
    <div className="lms-groups">
      {groups.filter(([, list]) => list.length).map(([label, list]) => (
        <section key={label}>
          <p className="cw-section-label">{label} · {list.length}</p>
          <div className="cw-table">
            {list.map((course) => (
              <Link key={course.id} href={`/learning/course/${course.id}${course.enrollment?.lastLessonId && course.enrollment.status !== "COMPLETED" ? `?lesson=${course.enrollment.lastLessonId}` : ""}`} className="lms-row">
                <CourseCover course={course} compact />
                <span className="cw-title-cell"><small>{course.category} · {minutesLabel(course.durationMinutes)}</small><b>{course.title}</b></span>
                <span className="lms-row-status"><EnrollmentBadge course={course} /></span>
                <span className="lms-row-date">{course.enrollment?.status === "COMPLETED" ? `Completed ${shortDate(course.enrollment.completedAt)}` : course.enrollment?.dueDate ? `Due ${shortDate(course.enrollment.dueDate)}` : "Self-paced"}</span>
                <ProgressRing value={course.enrollment?.progressPct || 0} size={40} />
                <ChevronRight size={16} className="lms-row-chevron" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Certificates({ items, loading }: { items: { id: string; code: string; courseTitle: string; issuedAt: string; score: number | null }[]; loading: boolean }) {
  if (loading && !items.length) return <div className="cw-list-skeleton"><i /><i /></div>;
  if (!items.length) return (
    <div className="cw-empty"><span><Award size={26} /></span><h2>No certificates yet</h2><p>Finish every lesson in a course (and pass its quizzes) to earn a certificate with a verification code.</p>
      <Link className="cw-btn ghost" href="/learning/verify">Verify a certificate</Link></div>
  );
  return (
    <>
      <div className="lms-cert-grid">
        {items.map((item) => (
          <Link key={item.id} href={`/learning/certificates/${item.id}`} className="lms-cert-card">
            <Award size={26} />
            <b>{item.courseTitle}</b>
            <small>Issued {shortDate(item.issuedAt)}{item.score !== null ? ` · score ${item.score}%` : ""}</small>
            <code>{item.code}</code>
            <span>View &amp; print <ArrowRight size={14} /></span>
          </Link>
        ))}
      </div>
      <p className="lms-footnote">Anyone in the organisation can check a code at <Link href="/learning/verify">Verify a certificate</Link>.</p>
    </>
  );
}

type TeamData = {
  members: { id: string; name: string; employeeNumber: string; designation: string | null; location: string | null; total: number; completed: number; overdue: number; completionPct: number | null;
    enrollments: { id: string; courseId: string; title: string; mandatory: boolean; coverEmoji: string; coverColor: string; status: string; progressPct: number; dueDate: string | null; overdue: boolean }[] }[];
  stats: { members: number; enrollments: number; completed: number; completionPct: number; overdue: number; inProgress: number };
};

function TeamView({ flash }: { flash: (message: string) => void }) {
  const team = useAsync(() => httpRequest<TeamData>("/api/v2/lms/team"), []);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const remind = useCallback(async () => {
    setBusy("remind");
    try {
      const result = await httpRequest<{ sent: number; overdue: number }>("/api/v2/lms/admin/reminders", { method: "POST", body: {} });
      flash(result.sent ? `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"} (${result.overdue} overdue)` : "Everyone is on track — no reminders needed today");
    } catch (reason) { flash(errorText(reason)); } finally { setBusy(""); }
  }, [flash]);
  const exportCsv = async () => {
    setBusy("csv");
    try { await downloadFile("/api/v2/lms/team.csv", "team-learning.csv"); } catch (reason) { flash(errorText(reason)); } finally { setBusy(""); }
  };
  if (team.error) return <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {team.error}</p>;
  if (!team.data) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  const { members, stats } = team.data;
  return (
    <section aria-label="Team learning">
      <div className="lms-team-head">
        <div className="lms-team-kpis">
          <span><b>{stats.completionPct}%</b><small>team completion</small></span>
          <span><b>{stats.inProgress}</b><small>in progress</small></span>
          <span className={stats.overdue ? "bad" : ""}><b>{stats.overdue}</b><small>overdue</small></span>
          <span><b>{stats.members}</b><small>direct reports</small></span>
        </div>
        <div className="cw-action-row">
          <button className="cw-btn ghost" onClick={exportCsv} disabled={!!busy}>{busy === "csv" ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Export CSV</button>
          <button className="cw-btn ghost" onClick={remind} disabled={!!busy}>{busy === "remind" ? <Loader2 size={15} className="spin" /> : <BellRing size={15} />} Send due reminders</button>
          <Link className="cw-btn primary" href="/learning/admin?assign=1"><Users size={15} /> Assign a course</Link>
        </div>
      </div>
      {!members.length ? <div className="cw-empty"><span><Users size={26} /></span><h2>No direct reports</h2><p>Team learning appears here once people report to you.</p></div> : (
        <div className="cw-table lms-team">
          {members.map((member) => (
            <div key={member.id} className="lms-team-member">
              <button className="lms-team-row" aria-expanded={open === member.id} onClick={() => setOpen(open === member.id ? null : member.id)}>
                <span className="cw-person"><span className="cw-avatar small">{initials(member.name)}</span><span>{member.name}<small>{member.designation || member.employeeNumber}{member.location ? ` · ${member.location}` : ""}</small></span></span>
                <span className="lms-bar" aria-label={`${member.completionPct ?? 0}% of assigned learning completed`}><i style={{ width: `${member.completionPct ?? 0}%` }} /></span>
                <span className="lms-team-num">{member.total ? `${member.completed}/${member.total}` : "—"}<small>completed</small></span>
                <span>{member.overdue ? <span className="cw-badge tone-danger"><i />{member.overdue} overdue</span> : member.total ? <span className="cw-badge tone-success"><i />On track</span> : <span className="cw-badge tone-neutral"><i />No courses</span>}</span>
                <ChevronRight size={16} className={open === member.id ? "lms-rot" : ""} />
              </button>
              {open === member.id && (
                <ul className="lms-team-courses">
                  {member.enrollments.length ? member.enrollments.map((item) => (
                    <li key={item.id}>
                      <span className="lms-mini-cover" style={{ ["--cover" as string]: item.coverColor }} aria-hidden="true">{item.coverEmoji}</span>
                      <b>{item.title}{item.mandatory && <em> · mandatory</em>}</b>
                      <span className="lms-bar small"><i style={{ width: `${item.progressPct}%` }} /></span>
                      <small className={item.overdue ? "bad" : ""}>{item.status === "COMPLETED" ? "Completed" : item.dueDate ? dueText(item.dueDate) : `${item.progressPct}%`}</small>
                    </li>
                  )) : <li className="empty">No courses yet — assign one from “Assign a course”.</li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
