import { AlignLeft, CheckSquare, CircleDot, Gauge, Star, Type as TypeIcon, type LucideIcon } from "lucide-react";
import { downloadFile, httpRequest } from "@/lib/http-client";

export const ENGAGEMENT_ACCENT = "#8c4a7a";

export type QuestionType = "RATING" | "ENPS" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "LONG_TEXT";
export type AudienceType = "ALL" | "DEPARTMENTS" | "LOCATIONS" | "TEAM";
export type SurveyState = "DRAFT" | "SCHEDULED" | "LIVE" | "CLOSED";
export type AnswerValue = number | string | string[] | undefined;

export type Question = {
  id: string; position: number; type: QuestionType; prompt: string; helpText: string | null; required: boolean; options: string[]; scaleLabels: string[];
};
export type EngagementViewer = { employeeId: string; roles: string[]; isHr: boolean; teamSize: number; canBuild: boolean };
export type Survey = {
  id: string; kind: "SURVEY" | "POLL"; title: string; description: string | null; status: "DRAFT" | "LIVE" | "CLOSED"; state: SurveyState;
  anonymous: boolean; allowEdit: boolean; shareResults: boolean; minGroupSize: number;
  audience: { type: AudienceType; values: string[]; label: string };
  opensAt: string | null; closesAt: string | null; launchedAt: string | null; closedAt: string | null; createdAt: string; updatedAt: string; version: number;
  owner: { id: string; name: string; designation: string | null };
  questionCount: number; estimatedMinutes: number; invited: number; responded: number; responseRate: number;
  canManage: boolean; canViewResults: boolean;
  me: { invited: boolean; respondedOn: string | null; canRespond: boolean; canEdit: boolean };
};
export type SurveyDetail = Survey & { questions: Question[]; myAnswers: Record<string, AnswerValue> | null };
export type Poll = Survey & {
  question: { id: string; prompt: string; multiple: boolean; options: string[] } | null;
  voted: boolean; votes: number; results: { option: string; count: number; pct: number }[] | null;
};
export type Home = { viewer: EngagementViewer; pending: Survey[]; editable: Survey[]; upcoming: Survey[]; completed: Survey[]; missed: Survey[] };
export type BuilderOptions = {
  viewer: EngagementViewer; departments: { name: string; count: number }[]; locations: { name: string; count: number }[];
  total: number; teamSize: number; audienceTypes: AudienceType[]; defaults: Record<string, string[]>; minGroupSize: number;
};
export type OptionResult = { option: string; count: number; pct: number };
/** A question with its aggregate. Locked questions (below the anonymity threshold) carry no numbers. */
export type ResultQuestion = Omit<Question, "options"> & {
  locked: boolean; answered?: number; average?: number | null; favorable?: number | null; unfavorable?: number | null; score?: number | null;
  promoters?: number; passives?: number; detractors?: number;
  distribution?: { label: string; value: number; count: number; pct: number }[];
  options: OptionResult[] | string[];
  texts?: { text: string; author: { name: string; department: string } | null }[];
};
export type Segment = {
  name: string; members: string[]; responses: number; suppressed: boolean; invited: number; responseRate: number | null;
  scores: Record<string, { score?: number | null; average?: number | null; favorable?: number | null; answered: number }>;
};
export type Results = {
  survey: Survey; threshold: number; anonymous: boolean; responses: number; invited: number; responded: number; responseRate: number;
  breakdownBy: "department" | "location"; locked: boolean; needed: number; trend: { day: string; count: number }[];
  questions: ResultQuestion[];
  headline: { enps: number | null; favorable: number | null; average: number | null } | null;
  breakdown: { by: string; threshold: number; questions: { id: string; type: QuestionType; prompt: string }[]; segments: Segment[]; hiddenCount: number } | null;
};

export type QuestionDraft = { key: string; type: QuestionType; prompt: string; helpText: string; required: boolean; options: string[]; scaleLabels: string[] };
export type SurveyDraft = {
  title: string; description: string; anonymous: boolean; allowEdit: boolean; shareResults: boolean;
  audienceType: AudienceType; audienceValues: string[]; opensAt: string; closesAt: string; questions: QuestionDraft[];
};

const base = "/api/v2/engagement";
export const engagementApi = {
  home: () => httpRequest<Home>(`${base}/home`),
  list: (kind: "SURVEY" | "POLL" = "SURVEY") => httpRequest<{ items: Survey[]; viewer: EngagementViewer }>(`${base}/surveys?scope=manage&kind=${kind}`),
  options: () => httpRequest<BuilderOptions>(`${base}/options`),
  get: (id: string) => httpRequest<SurveyDetail>(`${base}/surveys/${id}`),
  create: (body: unknown) => httpRequest<Survey>(`${base}/surveys`, { method: "POST", body }),
  update: (id: string, body: unknown) => httpRequest<Survey>(`${base}/surveys/${id}`, { method: "PATCH", body }),
  remove: (id: string, version: number) => httpRequest<{ deleted: boolean }>(`${base}/surveys/${id}?version=${version}`, { method: "DELETE" }),
  launch: (id: string, version: number) => httpRequest<Survey>(`${base}/surveys/${id}/launch`, { method: "POST", body: { version } }),
  close: (id: string, version: number) => httpRequest<Survey>(`${base}/surveys/${id}/close`, { method: "POST", body: { version } }),
  duplicate: (id: string) => httpRequest<Survey>(`${base}/surveys/${id}/duplicate`, { method: "POST", body: {} }),
  remind: (id: string) => httpRequest<{ reminded: number; pending: number; skippedRecent: number; cooldownHours: number }>(`${base}/surveys/${id}/reminders`, { method: "POST", body: {} }),
  respond: (id: string, answers: { questionId: string; value?: number; choices?: string[]; text?: string }[]) =>
    httpRequest<Survey>(`${base}/surveys/${id}/responses`, { method: "POST", body: { answers } }),
  results: (id: string, breakdown: "department" | "location" = "department") => httpRequest<Results>(`${base}/surveys/${id}/results?breakdown=${breakdown}`),
  exportCsv: (id: string, name: string) => downloadFile(`${base}/surveys/${id}/export.csv`, name),
  polls: () => httpRequest<{ items: Poll[]; viewer: EngagementViewer }>(`${base}/polls`),
  createPoll: (body: unknown) => httpRequest<Poll>(`${base}/polls`, { method: "POST", body }),
  vote: (id: string, choices: string[]) => httpRequest<Poll>(`${base}/polls/${id}/vote`, { method: "POST", body: { choices } }),
  closePoll: (id: string, version: number) => httpRequest<Survey>(`${base}/polls/${id}/close`, { method: "POST", body: { version } }),
};

export const errorText = (reason: unknown, fallback: string) => (reason instanceof Error && reason.message ? reason.message : fallback);

export const questionTypes: { type: QuestionType; label: string; hint: string; icon: LucideIcon }[] = [
  { type: "RATING", label: "Rating 1–5", hint: "Agreement or satisfaction scale", icon: Star },
  { type: "ENPS", label: "eNPS 0–10", hint: "Likelihood to recommend", icon: Gauge },
  { type: "SINGLE_CHOICE", label: "Single choice", hint: "Pick one option", icon: CircleDot },
  { type: "MULTI_CHOICE", label: "Multiple choice", hint: "Pick any that apply", icon: CheckSquare },
  { type: "SHORT_TEXT", label: "Short text", hint: "One line, up to 280 characters", icon: TypeIcon },
  { type: "LONG_TEXT", label: "Long text", hint: "Open feedback, up to 4,000 characters", icon: AlignLeft },
];
export const typeMeta = (type: QuestionType) => questionTypes.find((item) => item.type === type)!;

export const DEFAULT_SCALES: Record<string, string[]> = {
  RATING: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  ENPS: ["Not at all likely", "Extremely likely"],
};

export const stateTone: Record<SurveyState, string> = { DRAFT: "neutral", SCHEDULED: "info", LIVE: "success", CLOSED: "neutral" };
export const stateLabel: Record<SurveyState, string> = { DRAFT: "Draft", SCHEDULED: "Scheduled", LIVE: "Live", CLOSED: "Closed" };

export function isAnswered(question: { type: QuestionType }, value: AnswerValue) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return Number.isFinite(value);
}

export function toAnswerPayload(questions: Question[], answers: Record<string, AnswerValue>) {
  return questions.filter((question) => isAnswered(question, answers[question.id])).map((question) => {
    const value = answers[question.id];
    if (question.type === "RATING" || question.type === "ENPS") return { questionId: question.id, value: Number(value) };
    if (question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") return { questionId: question.id, choices: value as string[] };
    return { questionId: question.id, text: String(value).trim() };
  });
}

/** "Closes in 3 days" / "Closed 12 Sep" style copy. */
export function closingLabel(value: string | null, state?: SurveyState) {
  if (!value) return state === "CLOSED" ? "Closed" : "No close date";
  const diff = new Date(value).getTime() - Date.now();
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
  if (diff <= 0) return `Closed ${day}`;
  const hours = diff / 3_600_000;
  if (hours < 1) return "Closes within the hour";
  if (hours < 24) return `Closes in ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return days <= 14 ? `Closes in ${days} day${days === 1 ? "" : "s"}` : `Closes ${day}`;
}

export const dayLabel = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value)) : "—";

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const newKey = () => Math.random().toString(36).slice(2, 10);

export function blankQuestion(type: QuestionType): QuestionDraft {
  return {
    key: newKey(), type, prompt: "", helpText: "", required: type !== "LONG_TEXT" && type !== "SHORT_TEXT",
    options: type === "SINGLE_CHOICE" || type === "MULTI_CHOICE" ? ["", ""] : [],
    scaleLabels: DEFAULT_SCALES[type] ? [...DEFAULT_SCALES[type]] : [],
  };
}

/** eNPS band colouring shared by charts and the taker. */
export const enpsBand = (value: number) => (value >= 9 ? "promoter" : value >= 7 ? "passive" : "detractor");
