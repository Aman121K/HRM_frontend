import type { LucideIcon } from "lucide-react";
import { Timer, Award, Briefcase, CalendarClock, DoorOpen, GraduationCap, Laptop, LifeBuoy, Plane, Receipt, ScrollText, Target, UserPlus, Fingerprint } from "lucide-react";

export type CaseUi = {
  href: string;
  icon: LucideIcon;
  accent: string;
  eyebrow: string;
  createLabel: string;
  /** Status keys shown as the progress stepper, in order. */
  path: string[];
  emptyMine: string;
  layout?: "list" | "wall" | "board";
  /** Which date to show in the list's date column. */
  dateLabel?: string;
};

export const caseUi: Record<string, CaseUi> = {
  kpi: { href: "/performance/kpis", icon: Target, accent: "#7a4b9c", eyebrow: "PERFORMANCE · KPI", createLabel: "Submit KPI progress", path: ["SUBMITTED", "APPROVED"], emptyMine: "No KPI updates yet. Set a measurable goal, report progress and your manager will review it." },
  regularization: { href: "/attendance/regularize", icon: Timer, accent: "#0b615c", eyebrow: "ATTENDANCE CORRECTIONS", createLabel: "Request a correction", path: ["SUBMITTED", "APPROVED"], emptyMine: "No corrections requested. If you miss a punch, request a correction and your manager will review it.", dateLabel: "Date" },
  helpdesk: { href: "/helpdesk", icon: LifeBuoy, accent: "#2f6f9f", eyebrow: "EMPLOYEE SERVICE DESK", createLabel: "Raise a ticket", path: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], emptyMine: "No tickets yet. Ask HR, payroll or IT anything — every ticket is tracked against an SLA." },
  assets: { href: "/assets", icon: Laptop, accent: "#6a5acd", eyebrow: "WORKPLACE ASSETS", createLabel: "Request an asset", path: ["REQUESTED", "APPROVED", "ALLOCATED", "RETURN_REQUESTED", "RETURNED"], emptyMine: "Nothing is assigned to you yet. Request equipment and it will be tracked here until you return it.", dateLabel: "Needed by" },
  expenses: { href: "/expenses", icon: Receipt, accent: "#c78c2b", eyebrow: "CLAIMS & REIMBURSEMENTS", createLabel: "New claim", path: ["SUBMITTED", "APPROVED", "PAID"], emptyMine: "No claims yet. Submit a business expense and follow it through approval to payment.", dateLabel: "Expense date" },
  travel: { href: "/travel", icon: Plane, accent: "#0f8177", eyebrow: "BUSINESS TRAVEL", createLabel: "Plan a trip", path: ["SUBMITTED", "APPROVED", "BOOKED", "COMPLETED"], emptyMine: "No trips planned. Request travel and HR will book it once your manager approves.", dateLabel: "Departure" },
  learning: { href: "/learning/requests", icon: GraduationCap, accent: "#26855a", eyebrow: "LEARNING & DEVELOPMENT", createLabel: "Request training", path: ["REQUESTED", "APPROVED", "ENROLLED", "COMPLETED"], emptyMine: "No training requests yet. Ask for a course or certification that helps your role.", dateLabel: "Starts" },
  shifts: { href: "/shifts", icon: CalendarClock, accent: "#b5577a", eyebrow: "ROSTER & SHIFTS", createLabel: "Request shift change", path: ["SUBMITTED", "APPROVED"], emptyMine: "No shift changes requested. Swap with a colleague or ask for a different shift here.", dateLabel: "From" },
  letters: { href: "/letters", icon: ScrollText, accent: "#5b6f7a", eyebrow: "HR DOCUMENTS", createLabel: "Request a letter", path: ["REQUESTED", "IN_PROGRESS", "ISSUED"], emptyMine: "No letters requested. Get salary certificates, verification and experience letters from HR." },
  recognition: { href: "/recognition", icon: Award, accent: "#d66555", eyebrow: "APPRECIATION WALL", createLabel: "Give kudos", path: ["PUBLISHED"], emptyMine: "No recognition yet. Be the first to thank a colleague publicly.", layout: "wall" },
  requisitions: { href: "/jobs", icon: Briefcase, accent: "#0b615c", eyebrow: "INTERNAL JOB BOARD", createLabel: "Raise requisition", path: ["PENDING_APPROVAL", "OPEN", "FILLED"], emptyMine: "No job openings right now. Approved requisitions appear here for referrals.", layout: "board" },
  candidates: { href: "/candidates", icon: UserPlus, accent: "#8a6d1f", eyebrow: "RECRUITMENT PIPELINE", createLabel: "Refer / add candidate", path: ["APPLIED", "SCREENING", "INTERVIEW", "OFFERED", "HIRED"], emptyMine: "You haven't referred anyone yet. Referrals from the job board show up here with live status." },
  exit: { href: "/exit", icon: DoorOpen, accent: "#7a4b3a", eyebrow: "SEPARATION", createLabel: "Submit resignation", path: ["SUBMITTED", "ACCEPTED", "CLEARANCE", "SETTLEMENT", "COMPLETED"], emptyMine: "No resignation on record. If you decide to move on, start here — your manager is notified privately.", dateLabel: "Last working day" },
  privacy_request: { href: "/my-space/privacy/requests", icon: Fingerprint, accent: "#3c5a8a", eyebrow: "MY DATA & PRIVACY · DPDP", createLabel: "New privacy request", path: ["SUBMITTED", "IN_REVIEW", "COMPLETED"], emptyMine: "No privacy requests. Ask for a correction or erasure of your data, nominate someone, or raise a grievance — HR replies well within 90 days." },
};
