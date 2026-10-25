"use client";
import { useCallback, useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";

export type LessonType = "TEXT" | "VIDEO" | "PDF" | "QUIZ";
export type Enrollment = {
  id: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; progressPct: number; dueDate: string | null; source: "SELF" | "ASSIGNED" | "MANDATORY";
  lastLessonId: string | null; startedAt: string | null; completedAt: string | null; enrolledAt: string; overdue: boolean; dueSoon: boolean;
  assignedBy: string | null; certificateId: string | null; certificateCode: string | null; justCompleted?: boolean;
};
export type Course = {
  id: string; title: string; summary: string; description: string; category: string; level: string; durationMinutes: number;
  coverColor: string; coverEmoji: string; mandatory: boolean; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; version: number;
  publishedAt: string | null; updatedAt: string; lessonCount: number; learnerCount: number; author: string; teamCourse: boolean; teamManager: string | null;
  enrollment: Enrollment | null; lastLessonTitle?: string | null; completedCount?: number;
};
export type OutlineLesson = { id: string; title: string; type: LessonType; durationMinutes: number; position: number; completed: boolean };
export type CourseDetail = Course & { lessons: OutlineLesson[]; canManage: boolean };
export type QuizQuestion = { id: string; prompt: string; kind: "SINGLE" | "MULTI"; options: { id: string; text: string }[] };
export type QuizState = { attemptsUsed: number; attemptsLeft: number | null; bestScore: number | null; passed: boolean; locked: boolean };
export type LessonContent = {
  id: string; courseId: string; title: string; type: LessonType; body: string; durationMinutes: number; videoUrl: string | null; embedUrl: string | null;
  completed: boolean; preview: boolean; passMark?: number; maxAttempts?: number | null; questions?: QuizQuestion[]; quiz?: QuizState;
};
export type AttemptResult = QuizState & {
  score: number; passMark: number; correctCount: number; total: number; reveal: boolean;
  results: { questionId: string; correct: boolean; picked: string[]; explanation: string | null; correctOptions: string[] | null }[];
  enrollment: Enrollment;
};
export type BuilderQuestion = { id?: string; prompt: string; kind: "SINGLE" | "MULTI"; options: { id: string; text: string }[]; correct: string[]; explanation: string };
export type BuilderLesson = {
  id: string; title: string; type: LessonType; body: string; videoUrl: string | null; embedUrl: string | null; durationMinutes: number;
  passMark: number | null; maxAttempts: number | null; position: number; files: number; questions: BuilderQuestion[];
};
export type BuilderCourse = Omit<Course, "enrollment"> & { enrollment: null; mandatoryDueDays: number; lessons: BuilderLesson[]; canManage: true; mandatoryEnrolled?: number; lessonId?: string };
export type Person = { id: string; employeeNumber: string; fullName: string; designation: string | null; department: string | null; location: string | null };
export type LmsOptions = {
  categories: string[]; levels: string[]; people: Person[]; departments: string[]; locations: string[];
  viewer: { employeeId: string; name: string; roles: string[]; isHr: boolean; isManager: boolean; canAuthor: boolean; hasReports: boolean };
};
export type Certificate = { id: string; code: string; courseTitle: string; courseId: string; issuedAt: string; score: number | null };

export const lmsApi = {
  options: () => httpRequest<LmsOptions>("/api/v2/lms/options"),
  catalog: (search = "", category = "") => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (category) query.set("category", category);
    const text = query.toString();
    return httpRequest<{ items: Course[]; categories: { category: string; count: number }[] }>(`/api/v2/lms/catalog${text ? `?${text}` : ""}`);
  },
  me: () => httpRequest<{ items: Course[]; certificates: Certificate[]; stats: Record<string, number> }>("/api/v2/lms/me"),
  course: (id: string) => httpRequest<CourseDetail>(`/api/v2/lms/courses/${id}`),
  enroll: (id: string) => httpRequest<{ enrolled: boolean }>(`/api/v2/lms/courses/${id}/enroll`, { method: "POST", body: {} }),
  lesson: (courseId: string, lessonId: string) => httpRequest<LessonContent>(`/api/v2/lms/courses/${courseId}/lessons/${lessonId}`),
  open: (courseId: string, lessonId: string) => httpRequest(`/api/v2/lms/courses/${courseId}/lessons/${lessonId}/open`, { method: "POST", body: {} }),
  complete: (courseId: string, lessonId: string) => httpRequest<Enrollment>(`/api/v2/lms/courses/${courseId}/lessons/${lessonId}/complete`, { method: "POST", body: {} }),
  attempt: (courseId: string, lessonId: string, answers: Record<string, string[]>) =>
    httpRequest<AttemptResult>(`/api/v2/lms/courses/${courseId}/lessons/${lessonId}/attempts`, { method: "POST", body: { answers } }),
};

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await run()); setError(""); setStatus(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong."); setStatus((reason as { status?: number }).status ?? null); }
    finally { setLoading(false); }
  }, [run]);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, status, loading, reload };
}

export const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : "Something went wrong.");
export const minutesLabel = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`);
export const levelLabel = (level: string) => level.charAt(0) + level.slice(1).toLowerCase();
export const lessonTypeLabel: Record<LessonType, string> = { TEXT: "Reading", VIDEO: "Video", PDF: "Document", QUIZ: "Quiz" };

/** "Due in 3 days" / "Overdue by 2 days" for a YYYY-MM-DD date (IST calendar days). */
export function dueText(date: string | null, completed = false) {
  if (!date || completed) return "";
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
