"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, BarChart3, BellRing, BookPlus, ChevronRight, Download, GraduationCap, Loader2, Lock, Plus, ShieldAlert, Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { downloadFile, httpRequest } from "@/lib/http-client";
import { relativeTime, shortDate } from "@/lib/cases";
import { AssignDrawer } from "./assign-drawer";
import { CourseCover } from "./course-card";
import { Drawer } from "./drawer";
import { errorText, lmsApi, useAsync, type BuilderCourse, type Course, type LmsOptions } from "./lms-api";

type Analytics = {
  courses: { id: string; title: string; category: string; mandatory: boolean; status: string; coverEmoji: string; coverColor: string; teamManager: string | null;
    enrollments: number; completed: number; inProgress: number; notStarted: number; overdue: number; avgQuizScore: number | null; completionRate: number }[];
  overdueCompliance: { id: string; name: string; employeeNumber: string; department: string | null; location: string | null; manager: string | null; course: string; courseId: string; dueDate: string; progressPct: number; daysOverdue: number }[];
  monthly: { month: string; completions: number }[];
  totals: { enrollments: number; completed: number; learners: number; certificates: number; minutes: number; activeEmployees: number; completionRate: number; complianceRate: number; overdueCompliance: number };
};

export const statusTone: Record<string, string> = { DRAFT: "tone-neutral", PUBLISHED: "tone-success", ARCHIVED: "tone-warning" };

export function AdminConsole() {
  const options = useAsync(() => lmsApi.options(), []);
  const viewer = options.data?.viewer;
  if (options.error) return <div className="cw-page lms-page"><p className="cw-alert" role="alert"><AlertTriangle size={15} /> {options.error}</p></div>;
  if (!viewer) return <div className="cw-page lms-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  if (!viewer.canAuthor) return (
    <div className="cw-page lms-page">
      <Link href="/learning" className="lms-back"><ArrowLeft size={15} /> Learning</Link>
      <div className="cw-empty"><span><Lock size={26} /></span><h2>Course studio is for HR and managers</h2><p>You can browse and complete courses from the learning catalogue.</p><Link className="cw-btn primary" href="/learning">Go to Learning</Link></div>
    </div>
  );
  return <Console options={options.data!} />;
}

function Console({ options }: { options: LmsOptions }) {
  const router = useRouter();
  const viewer = options.viewer;
  const courses = useAsync(() => httpRequest<{ items: Course[] }>("/api/v2/lms/admin/courses"), []);
  const catalog = useAsync(() => lmsApi.catalog(), []);
  const [tab, setTab] = useState<"courses" | "analytics">("courses");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<{ courseId?: string } | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3600); };
  useEffect(() => { if (new URLSearchParams(window.location.search).get("assign")) setAssigning({}); }, []);

  // Managers can assign any published company course plus their own team courses.
  const assignable = [...new Map([...(catalog.data?.items || []), ...(courses.data?.items || [])].map((course) => [course.id, course])).values()];
  const items = courses.data?.items || [];
  const remind = async () => {
    setBusy("remind");
    try {
      const result = await httpRequest<{ sent: number; overdue: number; dueSoon: number }>("/api/v2/lms/admin/reminders", { method: "POST", body: {} });
      flash(result.sent ? `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"} · ${result.overdue} overdue, ${result.dueSoon} due within 7 days` : "No reminders needed — nobody is due in the next 7 days");
    } catch (reason) { flash(errorText(reason)); } finally { setBusy(""); }
  };
  const exportCsv = async () => {
    setBusy("csv");
    try { await downloadFile(viewer.isHr ? "/api/v2/lms/admin/export.csv" : "/api/v2/lms/team.csv", "learning-records.csv"); }
    catch (reason) { flash(errorText(reason)); } finally { setBusy(""); }
  };

  return (
    <div className="cw-page lms-page" style={{ ["--accent" as string]: "#0f8177" }}>
      <Link href="/learning" className="lms-back"><ArrowLeft size={15} /> Learning</Link>
      <header className="cw-hero">
        <span className="cw-hero-icon"><BookPlus size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">{viewer.isHr ? "HR · COURSE STUDIO" : "MANAGER · TEAM COURSES"}</p>
          <h1>Course studio</h1>
          <p>{viewer.isHr ? "Build courses, make compliance training mandatory, assign learning to people, departments or locations, and track completion across the company."
            : "Create short courses for your team, assign company courses to your direct reports and keep an eye on due dates."}</p>
        </div>
        <button className="cw-btn primary lg" onClick={() => setCreating(true)}><Plus size={17} /> New course</button>
      </header>

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "courses"} className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>Courses</button>
          {viewer.isHr && <button role="tab" aria-selected={tab === "analytics"} className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>Analytics</button>}
        </div>
        <div className="cw-action-row lms-toolbar-actions">
          <button className="cw-btn ghost" onClick={() => setAssigning({})}><Users size={15} /> Assign</button>
          <button className="cw-btn ghost" onClick={remind} disabled={!!busy}>{busy === "remind" ? <Loader2 size={15} className="spin" /> : <BellRing size={15} />} Send due reminders</button>
          <button className="cw-btn ghost" onClick={exportCsv} disabled={!!busy}>{busy === "csv" ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Export CSV</button>
        </div>
      </div>

      {tab === "courses" && (
        courses.error ? <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {courses.error}</p>
          : courses.loading && !items.length ? <div className="cw-list-skeleton"><i /><i /><i /></div>
          : !items.length ? (
            <div className="cw-empty"><span><GraduationCap size={26} /></span><h2>No courses yet</h2>
              <p>{viewer.isHr ? "Create your first course — add readings, videos, PDFs and quizzes, then publish it to the catalogue." : "Create a short course for your team, like your store's opening routine."}</p>
              <button className="cw-btn primary" onClick={() => setCreating(true)}><Plus size={16} /> New course</button></div>
          ) : (
            <div className="cw-table lms-admin-table" role="table" aria-label="Courses">
              <div className="lms-admin-row head" role="row"><span role="columnheader">Course</span><span role="columnheader">Status</span><span role="columnheader">Lessons</span><span role="columnheader">Learners</span><span role="columnheader">Completed</span><span role="columnheader">Updated</span><span /></div>
              {items.map((course) => (
                <div key={course.id} className="lms-admin-row" role="row">
                  <Link role="cell" href={`/learning/admin/course/${course.id}`} className="lms-admin-title">
                    <CourseCover course={course} compact />
                    <span className="cw-title-cell"><small>{course.category}{course.mandatory ? " · mandatory" : ""}{course.teamCourse ? ` · team of ${course.teamManager}` : ""}</small><b>{course.title}</b></span>
                  </Link>
                  <span role="cell"><span className={`cw-badge ${statusTone[course.status]}`}><i />{course.status.toLowerCase()}</span></span>
                  <span role="cell" className="num">{course.lessonCount}</span>
                  <span role="cell" className="num">{course.learnerCount}</span>
                  <span role="cell" className="num">{course.learnerCount ? `${Math.round(((course.completedCount || 0) / course.learnerCount) * 100)}%` : "—"}</span>
                  <span role="cell" className="lms-muted">{relativeTime(course.updatedAt)}</span>
                  <span role="cell" className="lms-admin-actions">
                    {course.status === "PUBLISHED" && <button className="cw-btn ghost" onClick={() => setAssigning({ courseId: course.id })}>Assign</button>}
                    <Link className="cw-icon-button" aria-label={`Edit ${course.title}`} href={`/learning/admin/course/${course.id}`}><ChevronRight size={16} /></Link>
                  </span>
                </div>
              ))}
            </div>
          )
      )}
      {tab === "analytics" && viewer.isHr && <AnalyticsView onExport={exportCsv} />}

      {creating && <CreateCourseDrawer options={options} onClose={() => setCreating(false)} onCreated={(course) => router.push(`/learning/admin/course/${course.id}`)} />}
      {assigning && <AssignDrawer courses={assignable} initialCourseId={assigning.courseId} options={options} onClose={() => setAssigning(null)}
        onDone={(message) => { setAssigning(null); flash(message); courses.reload(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export const EMOJIS = ["☕", "🫘", "🥛", "🧼", "🛡️", "💬", "🧭", "🗝️", "📘", "🧾", "💻", "🌱", "🤝", "🎯", "🧯", "📊"];
export const COLORS = ["#6b3e26", "#0b615c", "#0f8177", "#2f6f9f", "#6a5acd", "#c78c2b", "#d66555", "#152c38"];

export function CreateCourseDrawer({ options, onClose, onCreated }: { options: LmsOptions; onClose: () => void; onCreated: (course: BuilderCourse) => void }) {
  const [values, setValues] = useState({ title: "", summary: "", category: options.categories[0], level: "BEGINNER", durationMinutes: 30, coverEmoji: "📘", coverColor: "#0b615c", mandatory: false, mandatoryDueDays: 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const course = await httpRequest<BuilderCourse>("/api/v2/lms/admin/courses", { method: "POST", body: { ...values, durationMinutes: Number(values.durationMinutes), mandatoryDueDays: Number(values.mandatoryDueDays), mandatory: options.viewer.isHr ? values.mandatory : undefined } });
      onCreated(course);
    } catch (reason) { setError(errorText(reason)); setBusy(false); }
  };
  return (
    <Drawer title="New course" eyebrow={options.viewer.isHr ? "COMPANY COURSE" : "TEAM COURSE · VISIBLE TO YOUR REPORTS"} onClose={onClose}
      footer={<><button className="cw-btn ghost" onClick={onClose}>Cancel</button><button className="cw-btn primary" disabled={busy || values.title.trim().length < 3} onClick={submit}>{busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Create draft</button></>}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <CourseFields values={values} set={set} options={options} />
      <p className="cw-help">Courses start as drafts. Add lessons in the builder, then publish when ready.</p>
    </Drawer>
  );
}

export function CourseFields({ values, set, options }: {
  values: { title: string; summary: string; category: string; level: string; durationMinutes: number; coverEmoji: string; coverColor: string; mandatory: boolean; mandatoryDueDays: number; description?: string };
  set: (key: string, value: unknown) => void; options: LmsOptions;
}) {
  const update = set;
  return (
    <div className="cw-fields">
      <label className="wide"><span>Title <em>*</em></span><input value={values.title} maxLength={140} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Pour-over brewing" /></label>
      <label className="wide"><span>Summary <small>(shown on the course card)</small></span><textarea rows={2} maxLength={600} value={values.summary} onChange={(event) => update("summary", event.target.value)} /></label>
      {values.description !== undefined && <label className="wide"><span>About this course <small>(supports **bold**, lists and headings)</small></span><textarea rows={5} maxLength={8000} value={values.description} onChange={(event) => update("description", event.target.value)} /></label>}
      <label><span>Category</span><select value={values.category} onChange={(event) => update("category", event.target.value)}>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Level</span><select value={values.level} onChange={(event) => update("level", event.target.value)}>{options.levels.map((item) => <option key={item} value={item}>{item.charAt(0) + item.slice(1).toLowerCase()}</option>)}</select></label>
      <label><span>Estimated duration (minutes)</span><input type="number" min={1} max={6000} value={values.durationMinutes} onChange={(event) => update("durationMinutes", event.target.value)} /></label>
      <div className="lms-swatches wide" role="group" aria-label="Cover">
        <span>Cover</span>
        <div>{EMOJIS.map((emoji) => <button type="button" key={emoji} className={values.coverEmoji === emoji ? "on" : ""} aria-pressed={values.coverEmoji === emoji} aria-label={`Emoji ${emoji}`} onClick={() => update("coverEmoji", emoji)}>{emoji}</button>)}</div>
        <div>{COLORS.map((color) => <button type="button" key={color} className={`color ${values.coverColor === color ? "on" : ""}`} aria-pressed={values.coverColor === color} aria-label={`Colour ${color}`} style={{ background: color }} onClick={() => update("coverColor", color)} />)}</div>
      </div>
      {options.viewer.isHr && (
        <>
          <label className="lms-toggle"><input type="checkbox" checked={values.mandatory} onChange={(event) => update("mandatory", event.target.checked)} /><span>Mandatory for every employee <small>Auto-enrols everyone when published</small></span></label>
          {values.mandatory && <label><span>Due within (days of enrolment)</span><input type="number" min={1} max={365} value={values.mandatoryDueDays} onChange={(event) => update("mandatoryDueDays", event.target.value)} /></label>}
        </>
      )}
    </div>
  );
}

function AnalyticsView({ onExport }: { onExport: () => void }) {
  const analytics = useAsync(() => httpRequest<Analytics>("/api/v2/lms/admin/analytics"), []);
  if (analytics.error) return <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {analytics.error}</p>;
  if (!analytics.data) return <div className="cw-list-skeleton"><i /><i /><i /></div>;
  const { courses, totals, overdueCompliance, monthly } = analytics.data;
  return (
    <div className="lms-analytics">
      <section className="cw-stats lms-stats-6" aria-label="Learning totals">
        <article><small>Learners</small><b>{totals.learners}</b><span>of {totals.activeEmployees} active employees</span></article>
        <article><small>Completion rate</small><b>{totals.completionRate}%</b><span>{totals.completed} of {totals.enrollments} enrolments</span></article>
        <article className={totals.complianceRate < 80 ? "attention" : ""}><small>Compliance</small><b>{totals.complianceRate}%</b><span>mandatory courses completed</span></article>
        <article className={totals.overdueCompliance ? "attention lms-danger" : ""}><small>Overdue compliance</small><b>{totals.overdueCompliance}</b><span>{totals.overdueCompliance ? "people past due" : "all on track"}</span></article>
        <article><small>Certificates</small><b>{totals.certificates}</b><span>issued</span></article>
        <article><small>Time learned</small><b>{Math.round(totals.minutes / 60)} h</b><span>{totals.minutes} minutes total</span></article>
      </section>

      <div className="lms-chart-grid">
        <section className="lms-panel">
          <header><h3><BarChart3 size={16} /> Completion by course</h3><div className="lms-legend" aria-hidden="true"><span><i className="c" />Completed</span><span><i className="p" />In progress</span><span><i className="n" />Not started</span><span><i className="o" />Overdue (of open)</span></div></header>
          <CompletionChart courses={courses} />
        </section>
        <section className="lms-panel">
          <header><h3>Completions per month</h3></header>
          <MonthlyChart monthly={monthly} />
        </section>
      </div>

      <section className="lms-panel">
        <header><h3>Course analytics</h3><button className="cw-btn ghost" onClick={onExport}><Download size={15} /> Export CSV</button></header>
        <div className="lms-scroll">
          <table className="lms-data-table">
            <thead><tr><th scope="col">Course</th><th scope="col">Enrolments</th><th scope="col">Completed</th><th scope="col">In progress</th><th scope="col">Overdue</th><th scope="col">Completion</th><th scope="col">Avg quiz score</th></tr></thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <th scope="row"><Link href={`/learning/admin/course/${course.id}`}><span className="lms-mini-cover" style={{ ["--cover" as string]: course.coverColor }} aria-hidden="true">{course.coverEmoji}</span>{course.title}</Link>
                    <small>{course.category}{course.mandatory ? " · mandatory" : ""}{course.teamManager ? ` · team of ${course.teamManager}` : ""}{course.status === "ARCHIVED" ? " · archived" : ""}</small></th>
                  <td>{course.enrollments}</td><td>{course.completed}</td><td>{course.inProgress}</td>
                  <td className={course.overdue ? "bad" : ""}>{course.overdue}</td>
                  <td><span className="lms-bar small"><i style={{ width: `${course.completionRate}%` }} /></span> {course.completionRate}%</td>
                  <td>{course.avgQuizScore === null ? "—" : `${course.avgQuizScore}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lms-panel">
        <header><h3><ShieldAlert size={16} /> Overdue compliance</h3><span className="lms-muted">{overdueCompliance.length} people</span></header>
        {!overdueCompliance.length ? <p className="cw-muted">Everyone is within their compliance due dates. 🎉</p> : (
          <div className="lms-scroll">
            <table className="lms-data-table">
              <thead><tr><th scope="col">Employee</th><th scope="col">Course</th><th scope="col">Manager</th><th scope="col">Due</th><th scope="col">Progress</th></tr></thead>
              <tbody>
                {overdueCompliance.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}<small>{row.employeeNumber}{row.department ? ` · ${row.department}` : ""}{row.location ? ` · ${row.location}` : ""}</small></th>
                    <td>{row.course}</td><td>{row.manager || "—"}</td>
                    <td className="bad">{shortDate(row.dueDate)}<small>{row.daysOverdue} day{row.daysOverdue === 1 ? "" : "s"} late</small></td>
                    <td>{row.progressPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CompletionChart({ courses }: { courses: Analytics["courses"] }) {
  const rows = courses.filter((course) => course.enrollments);
  if (!rows.length) return <p className="cw-muted">No enrolments yet.</p>;
  const rowHeight = 34, labelWidth = 210, width = 640, barWidth = width - labelWidth - 60;
  const height = rows.length * rowHeight + 8;
  return (
    <svg className="lms-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stacked bars showing completed, in progress and not started enrolments per course">
      <title>Completion by course</title>
      {rows.map((course, index) => {
        const y = index * rowHeight + 6;
        const scale = barWidth / course.enrollments;
        const completed = course.completed * scale, progress = course.inProgress * scale, rest = course.notStarted * scale;
        return (
          <g key={course.id}>
            <text x={0} y={y + 14} className="label">{course.title.length > 30 ? `${course.title.slice(0, 29)}…` : course.title}</text>
            <rect x={labelWidth} y={y + 2} width={completed} height={18} className="c"><title>{`${course.completed} completed`}</title></rect>
            <rect x={labelWidth + completed} y={y + 2} width={progress} height={18} className="p"><title>{`${course.inProgress} in progress`}</title></rect>
            <rect x={labelWidth + completed + progress} y={y + 2} width={rest} height={18} className="n"><title>{`${course.notStarted} not started`}</title></rect>
            {course.overdue > 0 && <rect x={labelWidth + completed} y={y + 20} width={course.overdue * scale} height={3} className="o"><title>{`${course.overdue} overdue`}</title></rect>}
            <text x={labelWidth + barWidth + 8} y={y + 15} className="value">{course.completionRate}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyChart({ monthly }: { monthly: Analytics["monthly"] }) {
  const months: { key: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: date.toLocaleDateString("en-IN", { month: "short" }), value: monthly.find((row) => row.month === key)?.completions || 0 });
  }
  const max = Math.max(1, ...months.map((month) => month.value));
  const width = 320, height = 180, base = 150, column = width / months.length;
  return (
    <svg className="lms-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Course completions over the last six months: ${months.map((month) => `${month.label} ${month.value}`).join(", ")}`}>
      <title>Completions per month</title>
      <line x1={0} x2={width} y1={base} y2={base} className="axis" />
      {months.map((month, index) => {
        const h = (month.value / max) * 120;
        return (
          <g key={month.key}>
            <rect x={index * column + column * 0.22} y={base - h} width={column * 0.56} height={h} className="c"><title>{`${month.value} completions`}</title></rect>
            <text x={index * column + column / 2} y={base - h - 6} textAnchor="middle" className="value">{month.value}</text>
            <text x={index * column + column / 2} y={base + 18} textAnchor="middle" className="label">{month.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
