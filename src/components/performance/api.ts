"use client";
import { httpRequest } from "@/lib/http-client";

export type Competency = { key: string; label: string; description: string };
export type KeyResult = { title: string; target: number; current: number; unit: string };
export type Cycle = {
  id: string; name: string; periodStart: string; periodEnd: string; status: CycleStatus; statusLabel: string; nextStatus: CycleStatus | null;
  goalWeight: number; selfReview: boolean; peerReview: boolean; maxPeers: number; competencies: Competency[]; department: string | null;
  goalsDue: string | null; reviewsDue: string | null; version: number; participants?: number;
};
export type CycleStatus = "DRAFT" | "GOAL_SETTING" | "REVIEW" | "CALIBRATION" | "PUBLISHED" | "CLOSED";
export type Context = {
  viewer: { employeeId: string; isHr: boolean; reportCount: number; pendingFeedback: number };
  cycles: Cycle[]; defaultCompetencies: Competency[]; ratingLabels: Record<number, string>; departments: string[];
};
export type Goal = {
  id: string; title: string; description: string | null; weight: number; keyResults: KeyResult[]; progress: number;
  selfRating: number | null; selfComment: string | null; managerRating: number | null; managerComment: string | null;
};
export type Review = { status: string; competencyRatings: Record<string, number>; overallRating: number | null; submittedAt: string | null; strengths?: string | null; improvements?: string | null; comments?: string | null };
export type Feedback = {
  responses: number; competencies: { key: string; label: string; average: number | null; responses: number }[];
  strengths: { text: string; by: string | null; relation: string }[]; improvements: { text: string; by: string | null; relation: string }[]; comments: { text: string; by: string | null; relation: string }[];
};
export type Sheet = {
  cycle: Cycle; viewerRole: "self" | "manager" | "hr" | "peer";
  employee: { id: string; name: string; number: string; designation: string | null; department: string | null; manager: string | null };
  participant: {
    id: string; goalsStatus: string; goalsNote: string | null; selfStatus: string; managerStatus: string; version: number;
    computedScore?: number | null; finalRating?: number | null; band?: string | null; calibrationNote?: string | null; incrementPct?: number | null;
    promote?: boolean; newDesignation?: string | null; revisionStatus?: string | null;
  };
  goals: Goal[]; selfReview: Review | null; managerReview: Review | { status: string } | null;
  nominations: { id: string; relation: string; status: string; reviewer: string | null }[];
  feedback: Feedback | null; live: { score: number; rating: number; band: string } | null; anonymityMin: number;
};
export type TeamRow = {
  participantId: string; employeeId: string; name: string; number: string; designation: string | null; department: string | null; manager: string | null;
  goals: number; progress: number; goalsStatus: string; selfStatus: string; managerStatus: string; feedback: { received: number; requested: number };
  computedScore: number | null; finalRating: number | null; incrementPct: number | null; promote: boolean; newDesignation: string | null;
  revisionStatus: string; revisionCtc: number | null; version: number; calibrationNote: string | null; proposedByMe: boolean;
};
export type Team = {
  cycle: Cycle; scope: "all" | "team"; people: TeamRow[];
  distribution: { rating: number; label: string; count: number; pct: number }[];
  summary: { total: number; goalsApproved: number; selfDone: number; managerDone: number; rated: number; averageRating: number | null };
};
export type FeedbackRequest = {
  id: string; relation: string; status: string; cycle: { id: string; name: string; status: string; reviewsDue: string | null };
  subject: { name: string; designation: string | null }; competencies: Competency[];
  draft: { competencyRatings: Record<string, number>; overallRating: number | null; strengths: string | null; improvements: string | null; comments: string | null };
};
export type GoalInput = { id?: string; title: string; description?: string; weight: number; keyResults: KeyResult[] };
export type ReviewInput = {
  goals?: { goalId: string; rating: number; comment?: string }[]; competencyRatings?: Record<string, number>; overallRating?: number;
  strengths?: string; improvements?: string; comments?: string; incrementPct?: number; promote?: boolean; newDesignation?: string; submit?: boolean;
};
export type CycleInput = {
  name: string; periodStart: string; periodEnd: string; goalWeight?: number; selfReview?: boolean; peerReview?: boolean; maxPeers?: number;
  competencies?: Competency[]; department?: string; goalsDue?: string; reviewsDue?: string;
};

const base = "/api/v2/performance";
export const perfApi = {
  context: () => httpRequest<Context>(`${base}/context`),
  createCycle: (body: CycleInput) => httpRequest<Cycle>(`${base}/cycles`, { method: "POST", body }),
  advance: (id: string, version: number) => httpRequest<{ cycle: Cycle; notes: string[] }>(`${base}/cycles/${id}/advance`, { method: "POST", body: { version } }),
  mine: (id: string) => httpRequest<Sheet>(`${base}/cycles/${id}/me`),
  person: (id: string, employeeId: string) => httpRequest<Sheet>(`${base}/cycles/${id}/people/${employeeId}`),
  saveMyGoals: (id: string, goals: GoalInput[], submit: boolean) => httpRequest<{ goalsStatus: string }>(`${base}/cycles/${id}/me/goals`, { method: "PUT", body: { goals, submit } }),
  savePersonGoals: (id: string, employeeId: string, goals: GoalInput[], submit: boolean) =>
    httpRequest<{ goalsStatus: string }>(`${base}/cycles/${id}/people/${employeeId}/goals`, { method: "PUT", body: { goals, submit } }),
  decideGoals: (id: string, employeeId: string, decision: "approve" | "return", note?: string) =>
    httpRequest<{ goalsStatus: string }>(`${base}/cycles/${id}/people/${employeeId}/goals/decision`, { method: "POST", body: { decision, note } }),
  progress: (goalId: string, keyResults: KeyResult[]) => httpRequest<{ progress: number }>(`${base}/goals/${goalId}/progress`, { method: "PATCH", body: { keyResults } }),
  saveMyReview: (id: string, body: ReviewInput) => httpRequest(`${base}/cycles/${id}/me/review`, { method: "PUT", body }),
  saveManagerReview: (id: string, employeeId: string, body: ReviewInput) => httpRequest(`${base}/cycles/${id}/people/${employeeId}/review`, { method: "PUT", body }),
  nominate: (id: string, reviewerIds: string[], subjectId?: string) => httpRequest<{ nominated: number }>(`${base}/cycles/${id}/nominations`, { method: "POST", body: { reviewerIds, subjectId } }),
  team: (id: string) => httpRequest<Team>(`${base}/cycles/${id}/team`),
  calibrate: (id: string, employeeId: string, body: { finalRating: number; note?: string; incrementPct?: number; promote?: boolean; newDesignation?: string; version: number }) =>
    httpRequest<{ finalRating: number; band: string; incrementPct: number; revisionStatus: string }>(`${base}/cycles/${id}/people/${employeeId}/calibration`, { method: "PUT", body }),
  revisions: (id: string, body: { participantIds: string[]; action: "approve" | "apply"; effectiveFrom?: string }) =>
    httpRequest<{ approved?: number; skipped?: string[]; effectiveFrom?: string; applied?: { name: string; from: number; to: number }[]; failed?: { name: string; reason: string }[] }>(`${base}/cycles/${id}/revisions`, { method: "POST", body }),
  feedback: () => httpRequest<FeedbackRequest[]>(`${base}/feedback`),
  submitFeedback: (reviewId: string, body: ReviewInput) => httpRequest(`${base}/feedback/${reviewId}`, { method: "PUT", body }),
  declineFeedback: (reviewId: string) => httpRequest(`${base}/feedback/${reviewId}/decline`, { method: "POST" }),
};

export const STEPS: CycleStatus[] = ["DRAFT", "GOAL_SETTING", "REVIEW", "CALIBRATION", "PUBLISHED", "CLOSED"];
export const STEP_LABEL: Record<CycleStatus, string> = { DRAFT: "Draft", GOAL_SETTING: "Goal setting", REVIEW: "Reviews", CALIBRATION: "Calibration", PUBLISHED: "Published", CLOSED: "Closed" };
export const STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral", SUBMITTED: "info", APPROVED: "success", PENDING: "neutral", REQUESTED: "info", DECLINED: "neutral",
  NONE: "neutral", PROPOSED: "warning", APPLIED: "success",
};
export const RELATION_LABEL: Record<string, string> = { SELF: "Self", MANAGER: "Manager", PEER: "Peer", REPORT: "Direct report" };
