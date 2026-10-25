"use client";
import Link from "next/link";
import { Award, CalendarClock, Clock3, Layers, ShieldCheck } from "lucide-react";
import { dueText, levelLabel, minutesLabel, type Course } from "./lms-api";

export function ProgressRing({ value, size = 44, stroke = 4, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg className="lms-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || `${clamped}% complete`}>
      <title>{label || `${clamped}% complete`}</title>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="track" />
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="bar"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{clamped === 100 ? "✓" : `${clamped}%`}</text>
    </svg>
  );
}

export function CourseCover({ course, compact = false }: { course: Pick<Course, "coverColor" | "coverEmoji" | "category" | "mandatory">; compact?: boolean }) {
  return (
    <div className={`lms-cover ${compact ? "compact" : ""}`} style={{ ["--cover" as string]: course.coverColor }} aria-hidden="true">
      <span className="lms-cover-emoji">{course.coverEmoji}</span>
      {!compact && <span className="lms-cover-cat">{course.category}</span>}
    </div>
  );
}

export function EnrollmentBadge({ course }: { course: Course }) {
  const enrollment = course.enrollment;
  if (!enrollment) return course.mandatory ? <span className="cw-badge tone-warning"><i />Mandatory</span> : null;
  if (enrollment.status === "COMPLETED") return <span className="cw-badge tone-success"><i />Completed</span>;
  if (enrollment.overdue) return <span className="cw-badge tone-danger"><i />{dueText(enrollment.dueDate)}</span>;
  if (enrollment.dueDate) return <span className={`cw-badge ${enrollment.dueSoon ? "tone-warning" : "tone-info"}`}><i />{dueText(enrollment.dueDate)}</span>;
  if (enrollment.status === "IN_PROGRESS") return <span className="cw-badge tone-info"><i />In progress</span>;
  return <span className="cw-badge tone-neutral"><i />Enrolled</span>;
}

export function CourseCard({ course }: { course: Course }) {
  const enrollment = course.enrollment;
  return (
    <Link href={`/learning/course/${course.id}`} className="lms-card">
      <CourseCover course={course} />
      <div className="lms-card-body">
        <div className="lms-card-tags">
          {course.mandatory && <span className="lms-tag mandatory"><ShieldCheck size={12} /> Mandatory</span>}
          {course.teamCourse && <span className="lms-tag">Team course</span>}
          <span className="lms-tag plain">{levelLabel(course.level)}</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.summary}</p>
        <footer>
          <span className="lms-meta"><Clock3 size={13} /> {minutesLabel(course.durationMinutes)}</span>
          <span className="lms-meta"><Layers size={13} /> {course.lessonCount} lesson{course.lessonCount === 1 ? "" : "s"}</span>
          {enrollment ? <ProgressRing value={enrollment.progressPct} size={40} /> : null}
        </footer>
        <div className="lms-card-status">
          <EnrollmentBadge course={course} />
          {enrollment?.certificateId && <span className="lms-meta"><Award size={13} /> Certificate</span>}
          {enrollment?.dueDate && enrollment.status !== "COMPLETED" && !enrollment.overdue && <span className="lms-meta"><CalendarClock size={13} /> {enrollment.source === "MANDATORY" ? "Compliance" : enrollment.assignedBy ? `from ${enrollment.assignedBy}` : "Assigned"}</span>}
        </div>
      </div>
    </Link>
  );
}
