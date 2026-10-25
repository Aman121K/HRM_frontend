"use client";
import Link from "next/link";
import {
  AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowUp, BookOpen, CheckCircle2, Eye, FileText, HelpCircle, Loader2, Lock, Pencil, PlayCircle, Plus,
  RotateCcw, Rocket, Save, Trash2, Undo2, Users, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Attachments } from "@/components/files/attachments";
import { httpRequest } from "@/lib/http-client";
import { shortDate } from "@/lib/cases";
import { AssignDrawer } from "./assign-drawer";
import { CourseFields, statusTone } from "./admin-console";
import { CourseCover } from "./course-card";
import { Drawer } from "./drawer";
import { RichText } from "./rich-text";
import { dueText, errorText, lessonTypeLabel, lmsApi, useAsync, type BuilderCourse, type BuilderLesson, type BuilderQuestion, type LessonType, type LmsOptions } from "./lms-api";

const typeIcon: Record<LessonType, typeof BookOpen> = { TEXT: BookOpen, VIDEO: PlayCircle, PDF: FileText, QUIZ: HelpCircle };
const typeHint: Record<LessonType, string> = {
  TEXT: "A reading with headings, lists and links",
  VIDEO: "YouTube or Vimeo (embedded privately) or any https link",
  PDF: "A handout or SOP learners can download",
  QUIZ: "Single or multiple choice, graded on the server",
};
type Learner = { id: string; name: string; employeeNumber: string; department: string | null; status: string; progressPct: number; dueDate: string | null; overdue: boolean; source: string; bestScore: number | null; attempts: number; completedAt: string | null };

export function CourseBuilder({ courseId }: { courseId: string }) {
  const options = useAsync(() => lmsApi.options(), []);
  const course = useAsync(() => httpRequest<BuilderCourse>(`/api/v2/lms/admin/courses/${courseId}`), [courseId]);
  if (course.error || options.error) return (
    <div className="cw-page lms-page">
      <Link href="/learning/admin" className="lms-back"><ArrowLeft size={15} /> Course studio</Link>
      <div className="cw-empty"><span><Lock size={26} /></span><h2>{course.status === 403 ? "You can't edit this course" : course.status === 404 ? "Course not found" : "Could not load the course"}</h2>
        <p>{course.status === 403 ? "Only HR, or the manager who created a team course, can edit it." : course.error || options.error}</p>
        <Link className="cw-btn ghost" href="/learning/admin">Back to course studio</Link></div>
    </div>
  );
  if (!course.data || !options.data) return <div className="cw-page lms-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>;
  return <Builder initial={course.data} options={options.data} />;
}

function Builder({ initial, options }: { initial: BuilderCourse; options: LmsOptions }) {
  const [course, setCourse] = useState(initial);
  const [tab, setTab] = useState<"lessons" | "details" | "learners">("lessons");
  const [editing, setEditing] = useState<{ lesson?: BuilderLesson; type: LessonType } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3600); };
  const fail = (reason: unknown) => {
    const details = (reason as { details?: { message?: unknown } }).details?.message;
    setError(Array.isArray(details) ? details.map(String) : [errorText(reason)]);
  };
  const run = async (key: string, work: () => Promise<BuilderCourse>, message?: string) => {
    setBusy(key); setError([]);
    try { const next = await work(); setCourse(next); if (message) flash(message); return next; }
    catch (reason) { fail(reason); return null; } finally { setBusy(""); }
  };
  const base = `/api/v2/lms/admin/courses/${course.id}`;
  const setStatus = (status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    if (status === "ARCHIVED" && !window.confirm("Archive this course? It leaves the catalogue; enrolled learners keep their progress and certificates.")) return;
    run(status, async () => {
      const next = await httpRequest<BuilderCourse>(`${base}/status`, { method: "POST", body: { status, version: course.version } });
      if (status === "PUBLISHED") flash(next.mandatoryEnrolled ? `Published — ${next.mandatoryEnrolled} employees enrolled and notified` : "Published to the catalogue");
      return next;
    });
  };
  const move = (index: number, delta: number) => {
    const ids = course.lessons.map((lesson) => lesson.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run("reorder", () => httpRequest<BuilderCourse>(`${base}/lessons/reorder`, { method: "POST", body: { courseVersion: course.version, lessonIds: ids } }));
  };
  const remove = (lesson: BuilderLesson) => {
    if (!window.confirm(`Remove “${lesson.title}”? Learner history is kept, but it disappears from the course.`)) return;
    run(`del-${lesson.id}`, () => httpRequest<BuilderCourse>(`${base}/lessons/${lesson.id}?courseVersion=${course.version}`, { method: "DELETE" }), "Lesson removed");
  };

  return (
    <div className="cw-page lms-page" style={{ ["--accent" as string]: course.coverColor }}>
      <div className="lms-player-top">
        <Link href="/learning/admin" className="lms-back"><ArrowLeft size={15} /> Course studio</Link>
        <div className="cw-action-row">
          <Link className="cw-btn ghost" href={`/learning/course/${course.id}`}><Eye size={15} /> Preview</Link>
          {course.status === "PUBLISHED" && <button className="cw-btn ghost" onClick={() => setAssigning(true)}><Users size={15} /> Assign</button>}
          {course.status === "PUBLISHED" && <button className="cw-btn ghost" disabled={!!busy} onClick={() => setStatus("ARCHIVED")}><Archive size={15} /> Archive</button>}
          {course.status === "PUBLISHED" && !course.learnerCount && <button className="cw-btn ghost" disabled={!!busy} onClick={() => setStatus("DRAFT")}><Undo2 size={15} /> Back to draft</button>}
          {course.status !== "PUBLISHED" && <button className="cw-btn primary" disabled={!!busy} onClick={() => setStatus("PUBLISHED")}>{busy === "PUBLISHED" ? <Loader2 size={15} className="spin" /> : <Rocket size={15} />} {course.status === "ARCHIVED" ? "Republish" : "Publish"}</button>}
        </div>
      </div>

      <header className="lms-course-head builder">
        <CourseCover course={course} />
        <div>
          <p className="cw-eyebrow">{course.teamCourse ? `TEAM COURSE · ${course.teamManager?.toUpperCase()}` : "COMPANY COURSE"} · VERSION {course.version}</p>
          <h1>{course.title}</h1>
          <p>{course.summary || "Add a short summary in Details."}</p>
          <div className="lms-head-meta">
            <span className={`cw-badge ${statusTone[course.status]}`}><i />{course.status.toLowerCase()}</span>
            {course.mandatory && <span className="cw-badge tone-warning"><i />Mandatory · due in {course.mandatoryDueDays} days</span>}
            <span>{course.lessons.length} lessons · {course.learnerCount} learners</span>
            {course.publishedAt && <span>Published {shortDate(course.publishedAt)}</span>}
          </div>
        </div>
      </header>
      {error.length > 0 && (
        <div className="cw-alert" role="alert"><AlertTriangle size={15} /><div>{error.length === 1 ? error[0] : <ul className="lms-error-list">{error.map((item) => <li key={item}>{item}</li>)}</ul>}</div></div>
      )}

      <div className="cw-toolbar">
        <div className="cw-tabs" role="tablist">
          {(["lessons", "details", "learners"] as const).map((key) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{key === "lessons" ? `Lessons (${course.lessons.length})` : key === "details" ? "Details" : `Learners (${course.learnerCount})`}</button>)}
        </div>
      </div>

      {tab === "lessons" && (
        <section className="lms-builder">
          {!course.lessons.length ? (
            <div className="cw-empty"><span><BookOpen size={26} /></span><h2>Add your first lesson</h2><p>Mix readings, videos, PDFs and a quiz. Learners complete lessons in any order; quizzes must be passed.</p></div>
          ) : (
            <ol className="lms-lesson-list">
              {course.lessons.map((lesson, index) => {
                const Icon = typeIcon[lesson.type];
                const warn = lesson.type === "QUIZ" && !lesson.questions.length ? "No questions yet" : lesson.type === "VIDEO" && !lesson.videoUrl ? "Video link missing" : lesson.type === "PDF" && !lesson.files ? "No PDF attached" : "";
                return (
                  <li key={lesson.id}>
                    <span className="lms-lesson-index">{index + 1}</span>
                    <span className="lms-lesson-icon"><Icon size={17} /></span>
                    <button className="lms-lesson-main" onClick={() => setEditing({ lesson, type: lesson.type })}>
                      <b>{lesson.title}</b>
                      <small>{lessonTypeLabel[lesson.type]} · {lesson.durationMinutes} min{lesson.type === "QUIZ" ? ` · ${lesson.questions.length} questions · pass ${lesson.passMark}%${lesson.maxAttempts ? ` · ${lesson.maxAttempts} attempts` : ""}` : ""}{lesson.type === "PDF" ? ` · ${lesson.files} file${lesson.files === 1 ? "" : "s"}` : ""}{lesson.type === "VIDEO" && lesson.videoUrl ? (lesson.embedUrl ? " · embedded" : " · external link") : ""}</small>
                      {warn && <em className="cw-flag"><AlertTriangle size={11} /> {warn}</em>}
                    </button>
                    <span className="lms-lesson-tools">
                      <button className="cw-icon-button" aria-label={`Move ${lesson.title} up`} disabled={!!busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                      <button className="cw-icon-button" aria-label={`Move ${lesson.title} down`} disabled={!!busy || index === course.lessons.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                      <button className="cw-icon-button" aria-label={`Edit ${lesson.title}`} onClick={() => setEditing({ lesson, type: lesson.type })}><Pencil size={15} /></button>
                      <button className="cw-icon-button" aria-label={`Remove ${lesson.title}`} disabled={!!busy} onClick={() => remove(lesson)}>{busy === `del-${lesson.id}` ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}</button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="lms-add-lesson" aria-label="Add a lesson">
            {(Object.keys(typeIcon) as LessonType[]).map((type) => {
              const Icon = typeIcon[type];
              return <button key={type} onClick={() => setEditing({ type })}><Icon size={20} /><b><Plus size={13} /> {lessonTypeLabel[type]}</b><small>{typeHint[type]}</small></button>;
            })}
          </div>
        </section>
      )}
      {tab === "details" && <DetailsForm course={course} options={options} onSaved={(next) => { setCourse(next); flash("Course details saved"); }} />}
      {tab === "learners" && <Learners course={course} flash={flash} />}

      {editing && (
        <LessonEditor course={course} lesson={editing.lesson} type={editing.type}
          onClose={() => { setEditing(null); httpRequest<BuilderCourse>(base).then(setCourse).catch(() => {}); }}
          onSaved={(next, keepOpen) => {
            setCourse(next);
            if (keepOpen) { const created = next.lessons.find((lesson) => lesson.id === next.lessonId); if (created) setEditing({ lesson: created, type: created.type }); }
            else { setEditing(null); flash("Lesson saved"); }
          }} />
      )}
      {assigning && <AssignDrawer courses={[course]} initialCourseId={course.id} options={options} onClose={() => setAssigning(false)} onDone={(message) => { setAssigning(false); flash(message); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function DetailsForm({ course, options, onSaved }: { course: BuilderCourse; options: LmsOptions; onSaved: (course: BuilderCourse) => void }) {
  const [values, setValues] = useState({
    title: course.title, summary: course.summary, description: course.description, category: course.category, level: course.level, durationMinutes: course.durationMinutes,
    coverEmoji: course.coverEmoji, coverColor: course.coverColor, mandatory: course.mandatory, mandatoryDueDays: course.mandatoryDueDays,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (values.mandatory && !course.mandatory && course.status === "PUBLISHED" && !window.confirm("Making this course mandatory enrols and notifies every active employee. Continue?")) return;
    setBusy(true); setError("");
    try {
      const body = { ...values, version: course.version, durationMinutes: Number(values.durationMinutes), mandatoryDueDays: Number(values.mandatoryDueDays), mandatory: options.viewer.isHr && !course.teamCourse ? values.mandatory : undefined };
      onSaved(await httpRequest<BuilderCourse>(`/api/v2/lms/admin/courses/${course.id}`, { method: "PATCH", body }));
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  return (
    <section className="lms-panel lms-details">
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      <CourseFields values={values} set={set} options={course.teamCourse ? { ...options, viewer: { ...options.viewer, isHr: false } } : options} />
      <div className="cw-action-row"><button className="cw-btn primary" onClick={save} disabled={busy || values.title.trim().length < 3}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save details</button></div>
    </section>
  );
}

function Learners({ course, flash }: { course: BuilderCourse; flash: (message: string) => void }) {
  const learners = useAsync(() => httpRequest<{ items: Learner[] }>(`/api/v2/lms/admin/courses/${course.id}/learners`), [course.id]);
  const quizzes = course.lessons.filter((lesson) => lesson.type === "QUIZ");
  const reset = async (learner: Learner) => {
    if (!window.confirm(`Reset failed quiz attempts for ${learner.name}? Passed attempts are kept.`)) return;
    try {
      let voided = 0;
      for (const quiz of quizzes) voided += (await httpRequest<{ voided: number }>(`/api/v2/lms/admin/enrollments/${learner.id}/reset-attempts`, { method: "POST", body: { lessonId: quiz.id } })).voided;
      flash(voided ? `Reset ${voided} attempt${voided === 1 ? "" : "s"} for ${learner.name}` : "No failed attempts to reset");
      learners.reload();
    } catch (reason) { flash(errorText(reason)); }
  };
  if (learners.error) return <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {learners.error}</p>;
  if (!learners.data) return <div className="cw-list-skeleton"><i /><i /></div>;
  if (!learners.data.items.length) return <div className="cw-empty"><span><Users size={26} /></span><h2>No learners yet</h2><p>{course.status === "PUBLISHED" ? "Assign the course or wait for people to enrol from the catalogue." : "Publish the course to open enrolment."}</p></div>;
  return (
    <div className="lms-scroll lms-panel">
      <table className="lms-data-table">
        <thead><tr><th scope="col">Learner</th><th scope="col">Source</th><th scope="col">Progress</th><th scope="col">Due</th><th scope="col">Best quiz</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {learners.data.items.map((learner) => (
            <tr key={learner.id}>
              <th scope="row">{learner.name}<small>{learner.employeeNumber}{learner.department ? ` · ${learner.department}` : ""}</small></th>
              <td>{learner.source.toLowerCase()}</td>
              <td>{learner.status === "COMPLETED" ? <span className="cw-badge tone-success"><i />Completed {shortDate(learner.completedAt)}</span> : <><span className="lms-bar small"><i style={{ width: `${learner.progressPct}%` }} /></span> {learner.progressPct}%</>}</td>
              <td className={learner.overdue ? "bad" : ""}>{learner.dueDate ? <>{shortDate(learner.dueDate)}<small>{dueText(learner.dueDate, learner.status === "COMPLETED")}</small></> : "—"}</td>
              <td>{learner.bestScore === null ? "—" : `${learner.bestScore}%`}<small>{learner.attempts ? `${learner.attempts} attempt${learner.attempts === 1 ? "" : "s"}` : ""}</small></td>
              <td>{quizzes.length > 0 && learner.attempts > 0 && learner.status !== "COMPLETED" && <button className="cw-btn ghost" onClick={() => reset(learner)}><RotateCcw size={14} /> Reset quiz</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

let optionSeed = 0;
const newOptionId = (existing: string[]) => { let id = ""; do { optionSeed += 1; id = `o${optionSeed.toString(36)}`; } while (existing.includes(id)); return id.slice(0, 8); };
const blankQuestion = (): BuilderQuestion => ({ prompt: "", kind: "SINGLE", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correct: ["a"], explanation: "" });

function LessonEditor({ course, lesson, type, onClose, onSaved }: {
  course: BuilderCourse; lesson?: BuilderLesson; type: LessonType; onClose: () => void; onSaved: (course: BuilderCourse, keepOpen: boolean) => void;
}) {
  const [title, setTitle] = useState(lesson?.title || "");
  const [body, setBody] = useState(lesson?.body || "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl || "");
  const [duration, setDuration] = useState(lesson?.durationMinutes || (type === "QUIZ" ? 10 : 5));
  const [passMark, setPassMark] = useState(lesson?.passMark || 70);
  const [maxAttempts, setMaxAttempts] = useState(lesson?.maxAttempts || 0);
  const [questions, setQuestions] = useState<BuilderQuestion[]>(lesson?.questions?.length ? lesson.questions : type === "QUIZ" ? [blankQuestion()] : []);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string[]>([]);
  useEffect(() => { setError([]); }, [lesson?.id]);

  const updateQuestion = (index: number, patch: Partial<BuilderQuestion>) => setQuestions((current) => current.map((question, position) => (position === index ? { ...question, ...patch } : question)));
  const localErrors = () => {
    const problems: string[] = [];
    if (title.trim().length < 2) problems.push("Give the lesson a title.");
    if (type === "VIDEO" && videoUrl && !/^https:\/\//i.test(videoUrl.trim())) problems.push("Video links must start with https://.");
    questions.forEach((question, index) => {
      if (question.prompt.trim().length < 3) problems.push(`Question ${index + 1} needs a prompt.`);
      if (question.options.some((option) => !option.text.trim())) problems.push(`Question ${index + 1} has an empty option.`);
      if (!question.correct.length) problems.push(`Question ${index + 1} needs a correct answer.`);
      if (question.kind === "SINGLE" && question.correct.length !== 1) problems.push(`Question ${index + 1} (single choice) needs exactly one correct answer.`);
    });
    return problems;
  };
  const save = async () => {
    const problems = localErrors();
    if (problems.length) { setError(problems); return; }
    setBusy(true); setError([]);
    const payload = {
      courseVersion: course.version, title: title.trim(), body, durationMinutes: Number(duration),
      ...(type === "VIDEO" ? { videoUrl: videoUrl.trim() } : {}),
      ...(type === "QUIZ" ? { passMark: Number(passMark), maxAttempts: Number(maxAttempts), questions: questions.map(({ prompt, kind, options, correct, explanation }) => ({ prompt: prompt.trim(), kind, options: options.map((option) => ({ id: option.id, text: option.text.trim() })), correct, explanation: explanation.trim() })) } : {}),
    };
    try {
      const next = lesson
        ? await httpRequest<BuilderCourse>(`/api/v2/lms/admin/courses/${course.id}/lessons/${lesson.id}`, { method: "PATCH", body: payload })
        : await httpRequest<BuilderCourse>(`/api/v2/lms/admin/courses/${course.id}/lessons`, { method: "POST", body: { ...payload, type } });
      onSaved(next, !lesson && type === "PDF");
    } catch (reason) {
      const details = (reason as { details?: { message?: unknown } }).details?.message;
      setError(Array.isArray(details) ? details.map(String) : [errorText(reason)]);
    } finally { setBusy(false); }
  };

  return (
    <Drawer wide title={lesson ? `Edit ${lessonTypeLabel[type].toLowerCase()}` : `New ${lessonTypeLabel[type].toLowerCase()} lesson`} eyebrow={course.title.toUpperCase()} onClose={onClose}
      footer={<><button className="cw-btn ghost" onClick={onClose}>{lesson ? "Close" : "Cancel"}</button><button className="cw-btn primary" onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} {lesson ? "Save lesson" : type === "PDF" ? "Create & attach PDF" : "Add lesson"}</button></>}>
      {error.length > 0 && <div className="cw-alert" role="alert"><AlertTriangle size={15} /><div>{error.length === 1 ? error[0] : <ul className="lms-error-list">{error.map((item) => <li key={item}>{item}</li>)}</ul>}</div></div>}
      <div className="cw-fields">
        <label className="wide"><span>Title <em>*</em></span><input value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Duration (minutes)</span><input type="number" min={1} max={600} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        {type === "QUIZ" && <>
          <label><span>Pass mark (%)</span><input type="number" min={1} max={100} value={passMark} onChange={(event) => setPassMark(Number(event.target.value))} /></label>
          <label><span>Attempts allowed <small>(0 = unlimited)</small></span><input type="number" min={0} max={20} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} /></label>
        </>}
        {type === "VIDEO" && <label className="wide"><span>Video link <small>YouTube and Vimeo embed via privacy-friendly players; other https links open in a new tab</small></span><input value={videoUrl} maxLength={500} placeholder="https://www.youtube.com/watch?v=…" onChange={(event) => setVideoUrl(event.target.value)} /></label>}
        <label className="wide">
          <span>{type === "QUIZ" ? "Instructions" : type === "TEXT" ? "Lesson text" : "Notes for learners"} <small># heading · **bold** · *italic* · - list · 1. steps · &gt; tip · [link](https://…)</small></span>
          {preview ? <div className="lms-preview-box"><RichText source={body || "_Nothing to preview yet._"} /></div>
            : <textarea rows={type === "TEXT" ? 14 : 4} maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} />}
          <button type="button" className="lms-link-button" onClick={() => setPreview(!preview)}>{preview ? "Back to editing" : "Preview formatting"}</button>
        </label>
      </div>
      {type === "PDF" && (lesson ? <Attachments entityType="lms_lesson" entityId={lesson.id} label="Lesson PDF" hint="PDF handouts, SOPs or posters · up to 8 MB" />
        : <p className="cw-help">Create the lesson first — the upload area appears straight after.</p>)}
      {type === "QUIZ" && (
        <section className="lms-q-editor">
          <p className="cw-section-label">Questions · {questions.length}</p>
          {questions.map((question, index) => (
            <fieldset key={index} className="lms-q-edit">
              <legend>Question {index + 1}</legend>
              <div className="lms-q-edit-head">
                <input aria-label={`Question ${index + 1} prompt`} value={question.prompt} maxLength={1000} placeholder="Ask something that checks understanding" onChange={(event) => updateQuestion(index, { prompt: event.target.value })} />
                <select aria-label="Question type" value={question.kind} onChange={(event) => updateQuestion(index, { kind: event.target.value as "SINGLE" | "MULTI", correct: event.target.value === "SINGLE" ? question.correct.slice(0, 1) : question.correct })}>
                  <option value="SINGLE">Single choice</option><option value="MULTI">Multiple choice</option>
                </select>
                <button type="button" className="cw-icon-button" aria-label={`Remove question ${index + 1}`} disabled={questions.length === 1 && course.status === "PUBLISHED"} onClick={() => setQuestions(questions.filter((_, position) => position !== index))}><Trash2 size={15} /></button>
              </div>
              {question.options.map((option, optionIndex) => {
                const correct = question.correct.includes(option.id);
                return (
                  <div key={option.id} className={`lms-opt-edit ${correct ? "correct" : ""}`}>
                    <label className="lms-correct-toggle" title="Mark as correct">
                      <input type={question.kind === "SINGLE" ? "radio" : "checkbox"} name={`correct-${index}`} checked={correct} aria-label={`Option ${optionIndex + 1} is correct`}
                        onChange={() => updateQuestion(index, { correct: question.kind === "SINGLE" ? [option.id] : correct ? question.correct.filter((id) => id !== option.id) : [...question.correct, option.id] })} />
                    </label>
                    <input aria-label={`Option ${optionIndex + 1}`} value={option.text} maxLength={300} placeholder={`Option ${optionIndex + 1}`}
                      onChange={(event) => updateQuestion(index, { options: question.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)) })} />
                    <button type="button" className="cw-icon-button" aria-label={`Remove option ${optionIndex + 1}`} disabled={question.options.length <= 2}
                      onClick={() => updateQuestion(index, { options: question.options.filter((item) => item.id !== option.id), correct: question.correct.filter((id) => id !== option.id) })}><X size={14} /></button>
                  </div>
                );
              })}
              {question.options.length < 8 && <button type="button" className="lms-link-button" onClick={() => updateQuestion(index, { options: [...question.options, { id: newOptionId(question.options.map((item) => item.id)), text: "" }] })}><Plus size={13} /> Add option</button>}
              <input className="lms-explain-input" aria-label={`Explanation for question ${index + 1}`} value={question.explanation} maxLength={1000} placeholder="Explanation shown after answering (optional)" onChange={(event) => updateQuestion(index, { explanation: event.target.value })} />
            </fieldset>
          ))}
          {questions.length < 40 && <button type="button" className="cw-btn ghost" onClick={() => setQuestions([...questions, blankQuestion()])}><Plus size={15} /> Add question</button>}
          <p className="cw-help">Correct answers are stored on the server and never sent to learners before they submit. Answers are revealed once a learner passes or runs out of attempts.</p>
        </section>
      )}
    </Drawer>
  );
}
