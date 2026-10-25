"use client";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Award, BookOpen, CheckCircle2, ChevronLeft, Circle, Clock3, ExternalLink, FileText, HelpCircle, Layers, ListChecks,
  Loader2, Lock, PartyPopper, PlayCircle, Settings2, ShieldCheck, Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Attachments } from "@/components/files/attachments";
import { shortDate } from "@/lib/cases";
import { CourseCover, ProgressRing } from "./course-card";
import { Quiz } from "./quiz";
import { RichText } from "./rich-text";
import {
  dueText, errorText, lessonTypeLabel, levelLabel, lmsApi, minutesLabel, useAsync, type AttemptResult, type CourseDetail, type Enrollment, type LessonContent, type LessonType,
} from "./lms-api";

const typeIcon: Record<LessonType, typeof BookOpen> = { TEXT: BookOpen, VIDEO: PlayCircle, PDF: FileText, QUIZ: HelpCircle };
const EMBED_HOSTS = ["https://www.youtube-nocookie.com/embed/", "https://player.vimeo.com/video/"];

export function CoursePlayer({ courseId }: { courseId: string }) {
  const course = useAsync(() => lmsApi.course(courseId), [courseId]);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [lessonError, setLessonError] = useState("");
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [celebrate, setCelebrate] = useState<Enrollment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const main = useRef<HTMLDivElement>(null);
  const data = course.data;
  const enrolled = !!data?.enrollment;
  const canOpen = enrolled || !!data?.canManage;

  // Resume: ?lesson= wins, then the last lesson opened, otherwise the first unfinished one.
  useEffect(() => {
    if (!data || lessonId || !canOpen || !data.lessons.length) return;
    const requested = new URLSearchParams(window.location.search).get("lesson");
    const ids = data.lessons.map((item) => item.id);
    const pick = (requested && ids.includes(requested) && requested) || (data.enrollment?.lastLessonId && ids.includes(data.enrollment.lastLessonId) && data.enrollment.lastLessonId)
      || data.lessons.find((item) => !item.completed)?.id || ids[0];
    if (requested || data.enrollment?.status === "IN_PROGRESS" || data.canManage) setLessonId(pick);
  }, [data, lessonId, canOpen]);

  const loadLesson = useCallback(async (id: string) => {
    setLoadingLesson(true); setLessonError(""); setError("");
    try {
      const content = await lmsApi.lesson(courseId, id);
      setLesson(content);
      if (!content.preview) lmsApi.open(courseId, id).catch(() => {});
    } catch (reason) { setLessonError(errorText(reason)); setLesson(null); }
    finally { setLoadingLesson(false); }
  }, [courseId]);
  useEffect(() => {
    if (!lessonId) return;
    loadLesson(lessonId);
    const url = new URL(window.location.href);
    url.searchParams.set("lesson", lessonId);
    window.history.replaceState(null, "", url);
    main.current?.focus({ preventScroll: true });
  }, [lessonId, loadLesson]);

  const index = useMemo(() => data?.lessons.findIndex((item) => item.id === lessonId) ?? -1, [data, lessonId]);
  const next = data && index >= 0 ? data.lessons[index + 1] : undefined;
  const previous = data && index > 0 ? data.lessons[index - 1] : undefined;
  const go = (id: string) => { setLessonId(id); setMenuOpen(false); setCelebrate(null); window.scrollTo({ top: 0 }); };

  const applyEnrollment = (enrollment: Enrollment, completedLesson?: string) => {
    course.setData((current) => current && {
      ...current, enrollment,
      lessons: current.lessons.map((item) => (item.id === completedLesson ? { ...item, completed: true } : item)),
    });
    if (enrollment.justCompleted) setCelebrate(enrollment);
  };

  const enroll = async () => {
    setBusy(true); setError("");
    try {
      await lmsApi.enroll(courseId);
      const fresh = await lmsApi.course(courseId);
      course.setData(fresh);
      setLessonId(fresh.lessons.find((item) => !item.completed)?.id || fresh.lessons[0]?.id || null);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const complete = async () => {
    if (!lesson) return;
    setBusy(true); setError("");
    try {
      const enrollment = await lmsApi.complete(courseId, lesson.id);
      setLesson({ ...lesson, completed: true });
      applyEnrollment(enrollment, lesson.id);
      if (!enrollment.justCompleted && next) go(next.id);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const onQuiz = (result: AttemptResult) => applyEnrollment(result.enrollment, result.passed ? lesson?.id : undefined);

  if (course.error) return (
    <div className="cw-page lms-page">
      <Link href="/learning" className="lms-back"><ArrowLeft size={15} /> All courses</Link>
      <div className="cw-empty"><span><Lock size={26} /></span><h2>{course.status === 404 ? "Course not available" : "Could not load this course"}</h2>
        <p>{course.status === 404 ? "It may be a draft, archived, or a team course for another team." : course.error}</p>
        <Link className="cw-btn ghost" href="/learning">Back to the catalogue</Link></div>
    </div>
  );
  if (!data) return <div className="cw-page lms-page"><div className="cw-hero-skeleton" aria-label="Loading course" /></div>;

  const enrollment = data.enrollment;
  const done = data.lessons.filter((item) => item.completed).length;

  return (
    <div className="cw-page lms-page lms-player-page" style={{ ["--accent" as string]: data.coverColor }}>
      <div className="lms-player-top">
        <Link href="/learning" className="lms-back"><ArrowLeft size={15} /> All courses</Link>
        {data.canManage && <Link href={`/learning/admin/course/${data.id}`} className="cw-btn ghost"><Settings2 size={15} /> Edit course</Link>}
      </div>

      <header className="lms-course-head">
        <CourseCover course={data} />
        <div>
          <p className="cw-eyebrow">{data.category.toUpperCase()} · {levelLabel(data.level).toUpperCase()}</p>
          <h1>{data.title}</h1>
          <p>{data.summary}</p>
          <div className="lms-head-meta">
            <span><Clock3 size={14} /> {minutesLabel(data.durationMinutes)}</span>
            <span><Layers size={14} /> {data.lessonCount} lessons</span>
            <span><Users size={14} /> {data.learnerCount} learner{data.learnerCount === 1 ? "" : "s"}</span>
            {data.mandatory && <span className="cw-badge tone-warning"><i />Mandatory</span>}
            {data.teamCourse && <span className="cw-badge tone-info"><i />Team course · {data.teamManager}</span>}
            {data.status !== "PUBLISHED" && <span className="cw-badge tone-neutral"><i />{data.status.toLowerCase()}</span>}
          </div>
        </div>
        <div className="lms-head-progress">
          {enrollment ? (
            <>
              <ProgressRing value={enrollment.progressPct} size={76} stroke={6} />
              <span><b>{done} of {data.lessons.length} lessons</b>
                <small className={enrollment.overdue ? "bad" : ""}>{enrollment.status === "COMPLETED" ? `Completed ${shortDate(enrollment.completedAt)}` : enrollment.dueDate ? `${dueText(enrollment.dueDate)} · ${shortDate(enrollment.dueDate)}` : "Self-paced"}</small></span>
              {enrollment.certificateId && <Link className="cw-btn primary" href={`/learning/certificates/${enrollment.certificateId}`}><Award size={15} /> Certificate</Link>}
            </>
          ) : data.status === "PUBLISHED" ? (
            <button className="cw-btn primary lg" onClick={enroll} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <PlayCircle size={16} />} Enrol &amp; start</button>
          ) : null}
        </div>
      </header>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!enrolled && data.canManage && <p className="cw-alert warn"><AlertTriangle size={15} /> You are previewing this course as its author. Progress is not tracked until you enrol.</p>}

      {!canOpen ? (
        <section className="lms-overview">
          <div>
            <p className="cw-section-label">About this course</p>
            <RichText source={data.description || data.summary} />
            <p className="cw-muted">Built by {data.author}{data.publishedAt ? ` · published ${shortDate(data.publishedAt)}` : ""}</p>
          </div>
          <div>
            <p className="cw-section-label">What&apos;s inside</p>
            <ol className="lms-outline-preview">
              {data.lessons.map((item) => { const Icon = typeIcon[item.type]; return <li key={item.id}><Icon size={15} /><span>{item.title}</span><small>{lessonTypeLabel[item.type]} · {item.durationMinutes} min</small></li>; })}
            </ol>
            {data.status === "PUBLISHED" && <button className="cw-btn primary lg lms-wide" onClick={enroll} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <PlayCircle size={16} />} Enrol &amp; start learning</button>}
          </div>
        </section>
      ) : (
        <div className="lms-player">
          <button className="lms-outline-toggle cw-btn ghost" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><ListChecks size={15} /> Lessons · {done}/{data.lessons.length}</button>
          <nav className={`lms-outline ${menuOpen ? "open" : ""}`} aria-label="Course lessons">
            <p className="cw-section-label">Lessons</p>
            <ol>
              {data.lessons.map((item, position) => {
                const Icon = typeIcon[item.type];
                return (
                  <li key={item.id}>
                    <button className={`${item.id === lessonId ? "active" : ""} ${item.completed ? "done" : ""}`} aria-current={item.id === lessonId ? "step" : undefined} onClick={() => go(item.id)}>
                      <span className="lms-outline-state">{item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                      <span className="lms-outline-text"><b>{position + 1}. {item.title}</b><small><Icon size={12} /> {lessonTypeLabel[item.type]} · {item.durationMinutes} min</small></span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <article className="lms-lesson" ref={main} tabIndex={-1} aria-live="polite">
            {celebrate ? (
              <div className="lms-celebrate">
                <PartyPopper size={40} />
                <h2>Course complete!</h2>
                <p>You finished every lesson of “{data.title}”. Your certificate is ready{celebrate.certificateCode ? ` — verification code ${celebrate.certificateCode}` : ""}.</p>
                <div className="cw-action-row">
                  {celebrate.certificateId && <Link className="cw-btn primary lg" href={`/learning/certificates/${celebrate.certificateId}`}><Award size={16} /> View certificate</Link>}
                  <Link className="cw-btn ghost lg" href="/learning">Find another course</Link>
                </div>
              </div>
            ) : !lessonId ? (
              <div className="lms-start">
                <ShieldCheck size={30} />
                <h2>{enrollment?.status === "COMPLETED" ? "You have completed this course" : "Ready when you are"}</h2>
                <RichText source={data.description || data.summary} />
                {data.lessons[0] && <button className="cw-btn primary lg" onClick={() => go(data.lessons.find((item) => !item.completed)?.id || data.lessons[0].id)}><PlayCircle size={16} /> {done ? "Continue" : "Start the first lesson"}</button>}
              </div>
            ) : lessonError ? <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {lessonError}</p>
              : loadingLesson || !lesson ? <div className="cw-skeleton lms-lesson-skeleton"><i /><i /><i /><i /></div> : (
              <>
                <header className="lms-lesson-head">
                  <small>Lesson {index + 1} of {data.lessons.length} · {lessonTypeLabel[lesson.type]} · {lesson.durationMinutes} min</small>
                  <h2>{lesson.title}</h2>
                  {lesson.completed && <span className="cw-badge tone-success"><i />Completed</span>}
                </header>
                {lesson.type === "VIDEO" && <VideoBlock lesson={lesson} />}
                {lesson.body && <RichText source={lesson.body} />}
                {lesson.type === "PDF" && <Attachments entityType="lms_lesson" entityId={lesson.id} canUpload={false} label="Lesson documents" />}
                {lesson.type === "QUIZ" && <Quiz key={lesson.id} lesson={lesson} onResult={onQuiz} />}
                <footer className="lms-lesson-foot">
                  {previous ? <button className="cw-btn ghost" onClick={() => go(previous.id)}><ChevronLeft size={15} /> Previous</button> : <span />}
                  <div className="cw-action-row">
                    {lesson.type !== "QUIZ" && !lesson.preview && !lesson.completed && (
                      <button className="cw-btn primary lg" onClick={complete} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} {next ? "Mark complete & continue" : "Mark complete"}</button>
                    )}
                    {(lesson.completed || lesson.preview || lesson.type === "QUIZ") && next && <button className="cw-btn ghost" onClick={() => go(next.id)}>Next lesson <ArrowRight size={15} /></button>}
                  </div>
                </footer>
              </>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

function VideoBlock({ lesson }: { lesson: LessonContent }) {
  const embed = lesson.embedUrl && EMBED_HOSTS.some((host) => lesson.embedUrl!.startsWith(host)) ? lesson.embedUrl : null;
  if (embed) return (
    <div className="lms-video">
      <iframe src={embed} title={lesson.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
    </div>
  );
  if (!lesson.videoUrl) return <p className="cw-alert warn"><AlertTriangle size={15} /> This video has not been added yet.</p>;
  let host = "";
  try { host = new URL(lesson.videoUrl).hostname; } catch { host = ""; }
  return (
    <a className="lms-video-link" href={lesson.videoUrl} target="_blank" rel="noopener noreferrer nofollow">
      <PlayCircle size={34} />
      <span><b>Watch the video</b><small>Opens {host || "the video"} in a new tab</small></span>
      <ExternalLink size={16} />
    </a>
  );
}

export type { CourseDetail };
