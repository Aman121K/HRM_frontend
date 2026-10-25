"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ModuleData } from "@/lib/modules";
import { RichCreateForm } from "@/components/rich-create-form";
import { tenant } from "@/lib/tenant";

function saveFile(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8",
) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const cell = (v: string) => `"${v.replaceAll('"', '""')}"`;
function Instrument({ type }: { type: string }) {
  const labels: Record<string, string[]> = {
    composition: [
      "Engineering 33%",
      "Go to Market 23%",
      "Operations 18%",
      "Product 15%",
      "Corporate 11%",
    ],
    waterfall: ["Gross pay", "Benefits", "Tax", "Deductions", "Net pay"],
    funnel: [
      "Applied 186",
      "Screened 94",
      "Interview 42",
      "Offer 9",
      "Hired 7",
    ],
    pipeline: [
      "Initiated",
      "Approvals",
      "Handover",
      "Clearances",
      "Settlement",
    ],
    goals: [
      "Company priorities",
      "Product outcomes",
      "Team commitments",
      "Individual goals",
    ],
    pathway: [
      "Foundations",
      "Applied practice",
      "Live project",
      "Certification",
    ],
    skills: [
      "Strategy 92%",
      "Leadership 76%",
      "Commercial 58%",
      "Data 84%",
      "Execution 88%",
    ],
    bands: ["Committed 48%", "Proposed 24%", "Available 28%"],
    policy: ["Meals 42%", "Travel 68%", "Learning 63%"],
    profile: [
      "Identity verified",
      "Employment current",
      "Benefits enrolled",
      "Documents complete",
    ],
    settings: ["Identity", "Workflows", "Policies", "Integrations"],
    matrix: ["Ready now", "1–2 years", "3+ years", "No successor"],
    trend: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    calendar: [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
    ],
  };
  const items = labels[type] || [];
  if (type === "calendar")
    return (
      <div className="calendar-instrument">
        {["M", "T", "W", "T", "F", "S", "S"].map((x, i) => (
          <b key={i}>{x}</b>
        ))}
        {items.map((x, i) => (
          <span
            className={
              i === 26
                ? "today"
                : i % 7 > 4
                  ? "weekend"
                  : i === 3 || i === 14
                    ? "away"
                    : ""
            }
            key={x}
          >
            {x}
            <i />
          </span>
        ))}
      </div>
    );
  return (
    <div className={`signature-instrument ${type}`}>
      {items.map((x, i) => (
        <div key={x}>
          <span>{x}</span>
          <i>
            <b
              style={{
                width: `${Math.max(22, 96 - i * (type === "funnel" ? 16 : 8))}%`,
              }}
            />
          </i>
        </div>
      ))}
    </div>
  );
}
type Detail = {
  title: string;
  fields: { label: string; value: string }[];
  kind: "row" | "context";
};
const exitTasks = [
  {
    task: "Approve last working day",
    owner: "Reporting manager",
    due: "30 Jul",
    dependency: "Employee resignation",
    status: "Complete",
  },
  {
    task: "Complete knowledge transfer",
    owner: "Business owner",
    due: "08 Aug",
    dependency: "Replacement assignment",
    status: "In progress",
  },
  {
    task: "Return laptop and access card",
    owner: "Workplace & IT",
    due: "14 Aug",
    dependency: "Last working day",
    status: "Not started",
  },
  {
    task: "Revoke application access",
    owner: "Information Security",
    due: "14 Aug · 7:00 PM",
    dependency: "Manager confirmation",
    status: "Blocked",
  },
  {
    task: "Validate payroll inputs",
    owner: "Payroll",
    due: "19 Aug",
    dependency: "All clearances",
    status: "Not started",
  },
];
function ExitCaseWorkspace({
  title,
  act,
}: {
  title: string;
  act: (message: string) => void;
}) {
  const [section, setSection] = useState("Checklist"),
    [tasks, setTasks] = useState(exitTasks),
    [comment, setComment] = useState(""),
    [comments, setComments] = useState([
      "Priya · People Ops: Manager confirmed the proposed last working day.",
    ]),
    [withdraw, setWithdraw] = useState(false),
    [reason, setReason] = useState("");
  const complete = (i: number) =>
    setTasks((x) =>
      x.map((t, n) => (n === i ? { ...t, status: "Complete" } : t)),
    );
  const addComment = () => {
    if (!comment.trim()) return;
    setComments((x) => [...x, `You · just now: ${comment.trim()}`]);
    setComment("");
  };
  return (
    <div className="exit-workspace">
      <div className="case-summary">
        <div>
          <span>CASE ID</span>
          <b>SEP-2026-041</b>
        </div>
        <div>
          <span>LAST WORKING DAY</span>
          <b>14 Aug 2026</b>
        </div>
        <div>
          <span>CASE OWNER</span>
          <b>Priya Menon</b>
        </div>
        <div>
          <span>PROGRESS</span>
          <b>42% · 5 of 12</b>
        </div>
      </div>
      <nav aria-label="Exit case sections">
        {["Checklist", "Settlement", "Documents & interview", "Activity"].map(
          (x) => (
            <button
              key={x}
              className={section === x ? "active" : ""}
              onClick={() => setSection(x)}
            >
              {x}
            </button>
          ),
        )}
      </nav>
      {section === "Checklist" && (
        <div className="exit-task-list">
          <div className="exit-section-head">
            <div>
              <h3>Offboarding checklist</h3>
              <p>
                Every item has an accountable owner, due date and dependency.
              </p>
            </div>
            <span>2 items need attention</span>
          </div>
          {tasks.map((t, i) => (
            <article key={t.task}>
              <button
                className={`task-check ${t.status === "Complete" ? "done" : ""}`}
                aria-label={`Mark ${t.task} complete`}
                disabled={t.status === "Complete"}
                onClick={() => {
                  complete(i);
                  act(`${t.task} completed`);
                }}
              >
                {t.status === "Complete" && <Check size={13} />}
              </button>
              <div>
                <b>{t.task}</b>
                <small>Depends on: {t.dependency}</small>
              </div>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>{t.owner}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{t.due}</dd>
                </div>
              </dl>
              <span
                className={`case-status ${/blocked/i.test(t.status) ? "warn" : ""}`}
              >
                {t.status}
              </span>
            </article>
          ))}
        </div>
      )}
      {section === "Settlement" && (
        <div className="settlement-workspace">
          <div className="exit-section-head">
            <div>
              <h3>Full & final settlement</h3>
              <p>
                Payroll inputs remain provisional until all clearances are
                complete.
              </p>
            </div>
            <span>Expected payout · ₹1,38,420</span>
          </div>
          <div className="settlement-grid">
            <article>
              <span>Earned salary</span>
              <b>₹82,400</b>
              <small>14 payable days</small>
            </article>
            <article>
              <span>Leave encashment</span>
              <b>₹46,020</b>
              <small>12.5 eligible days</small>
            </article>
            <article>
              <span>Gratuity / benefits</span>
              <b>₹28,000</b>
              <small>Eligibility verified</small>
            </article>
            <article className="recovery">
              <span>Recoveries</span>
              <b>− ₹18,000</b>
              <small>Notice ₹12,000 · Asset ₹6,000</small>
            </article>
          </div>
          <div className="settlement-note">
            <ShieldCheck size={16} />
            <p>
              <b>Maker-checker control</b>
              <span>
                Payroll prepares the calculation; Finance approves it after HR
                and asset clearances.
              </span>
            </p>
            <button onClick={() => act("Settlement sent for validation")}>
              Send for validation
            </button>
          </div>
        </div>
      )}
      {section === "Documents & interview" && (
        <div className="exit-docs">
          <div>
            <h3>Letters & statutory documents</h3>
            {[
              ["Resignation acceptance", "Generated"],
              ["Experience letter", "Scheduled · 14 Aug"],
              ["Relieving letter", "Blocked by clearance"],
              ["Settlement statement", "Draft"],
            ].map((x) => (
              <article key={x[0]}>
                <span>
                  <b>{x[0]}</b>
                  <small>{x[1]}</small>
                </span>
                <button onClick={() => act(`${x[0]} opened`)}>Preview</button>
              </article>
            ))}
          </div>
          <div>
            <h3>Exit interview</h3>
            <p>Interview scheduled with People Partner on 12 Aug, 3:30 PM.</p>
            <dl>
              <div>
                <dt>Primary reason</dt>
                <dd>Career growth</dd>
              </div>
              <div>
                <dt>Rehire eligibility</dt>
                <dd>Pending review</dd>
              </div>
              <div>
                <dt>Confidential notes</dt>
                <dd>Restricted to HR</dd>
              </div>
            </dl>
            <button
              className="secondary-button"
              onClick={() => act("Exit interview form opened")}
            >
              Open interview form
            </button>
          </div>
        </div>
      )}
      {section === "Activity" && (
        <div className="case-activity">
          <h3>Comments & audit trail</h3>
          {comments.map((x) => (
            <p key={x}>
              <MessageSquare size={14} />
              {x}
            </p>
          ))}
          <p>
            <Check size={14} />
            System · 29 Jul: Case created from voluntary resignation request.
          </p>
          <div>
            <input
              aria-label="Add case comment"
              placeholder="Add a comment or @mention an owner"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button onClick={addComment}>Post</button>
          </div>
        </div>
      )}
      <div className="withdraw-zone">
        {withdraw ? (
          <>
            <label>
              Withdrawal reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this separation should be withdrawn"
              />
            </label>
            <div>
              <button onClick={() => setWithdraw(false)}>Cancel</button>
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  setWithdraw(false);
                  setReason("");
                  act(`${title} withdrawal submitted for HR approval`);
                }}
              >
                Submit withdrawal
              </button>
            </div>
            <small>
              Withdrawal preserves the complete audit trail and requires HR
              approval.
            </small>
          </>
        ) : (
          <>
            <span>
              <b>Need to stop this separation?</b>
              <small>Completed tasks will not be reversed automatically.</small>
            </span>
            <button onClick={() => setWithdraw(true)}>
              Request withdrawal
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export function ModulePage({ data }: { data: ModuleData }) {
  const router = useRouter(),
    dialogRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState(data.tabs[0]),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(""),
    [allRows, setAllRows] = useState(data.rows),
    [status, setStatus] = useState("All"),
    [filterOpen, setFilterOpen] = useState(false),
    [formOpen, setFormOpen] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [submitted, setSubmitted] = useState(false),
    [followUp, setFollowUp] = useState(false),
    [followUpOwner, setFollowUpOwner] = useState("People Operations"),
    [followUpDate, setFollowUpDate] = useState(""),
    [followUpNote, setFollowUpNote] = useState("");
  const statuses = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.at(-1) || ""))),
    [allRows],
  );
  const tabRows = useMemo(
    () =>
      allRows.filter(
        (_, i) =>
          tab === "Overview" ||
          (tab === "My items" && i % 2 === 0) ||
          (tab === "Team" && i % 2 === 1) ||
          (tab === "My exit" && i === 0) ||
          (tab === "Team exits" && i < 3) ||
          (tab === "Clearances" && i > 0) ||
          (tab === "Final settlement" && i === allRows.length - 1) ||
          (tab === "History" && i < 2),
      ),
    [allRows, tab],
  );
  const rows = useMemo(
    () =>
      tabRows.filter(
        (r) =>
          r.join(" ").toLowerCase().includes(query.toLowerCase()) &&
          (status === "All" || r.at(-1) === status),
      ),
    [tabRows, query, status],
  );
  const act = (m: string) => {
      setToast(m);
      window.setTimeout(() => setToast(""), 2300);
    },
    close = () => {
      setFormOpen(false);
      setDetail(null);
      setSubmitted(false);
      setFollowUp(false);
      setFollowUpDate("");
      setFollowUpNote("");
    },
    isOpen = Boolean(formOpen || detail);
  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFormOpen(false);
        setDetail(null);
        setSubmitted(false);
        setFollowUp(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialogRef.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", key);
      triggerRef.current?.focus();
    };
  }, [isOpen]);
  const exportRows = () => {
    saveFile(
      `${tenant.displayName.toLowerCase().replaceAll(" ", "-")}-${data.title.toLowerCase().replaceAll(" ", "-")}.csv`,
      [["Tenant", tenant.id], data.columns, ...rows]
        .map((r) => r.map(cell).join(","))
        .join("\n"),
    );
    act(`${rows.length} records exported`);
  };
  const primary = () => {
    if (data.title === "Leave") router.push("/leave/apply");
    else if (data.title === "Attendance") router.push("/attendance/regularize");
    else if (data.title === "Payroll") {
      saveFile(
        "meridian-works-payslip.txt",
        `${tenant.displayName}\nTenant: ${tenant.id}\nNet pay: INR 124,860`,
        `text/plain`,
      );
      act("Payslip downloaded");
    } else setFormOpen(true);
  };
  return (
    <>
      <div className="module-page">
        <header className="module-heading">
          <div>
            <p className="eyebrow">{data.eyebrow}</p>
            <h1>{data.title}</h1>
            <p>{data.intro}</p>
          </div>
          <div className="heading-actions">
            <button className="secondary-button" onClick={exportRows}>
              <ArrowDownToLine size={15} />
              Export
            </button>
            <button className="primary-button" onClick={primary}>
              {/download/i.test(data.action) ? (
                <ArrowDownToLine size={16} />
              ) : (
                <Plus size={16} />
              )}{" "}
              {data.action}
            </button>
          </div>
        </header>
        <section className="metric-strip">
          {data.stats.map((s, i) => (
            <article key={s.label}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              <small>
                <i className={i === 3 ? "warm" : ""} />
                {s.note}
              </small>
            </article>
          ))}
        </section>
        <nav className="module-tabs" aria-label={`${data.title} sections`}>
          {data.tabs.map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setStatus("All");
              }}
              key={t}
            >
              {t}
            </button>
          ))}
        </nav>
        <p className="tab-context">
          {tab} workspace <b>{tabRows.length} records</b>
        </p>
        <div className="module-layout">
          <div className="module-main">
            <section className="instrument-panel">
              <div className="instrument-head">
                <div>
                  <p className="eyebrow">LIVE VIEW</p>
                  <h2>
                    {data.title === "Exit & Separation"
                      ? "Exit journey health"
                      : `${tab} picture`}
                  </h2>
                </div>
                <span>Updated just now</span>
              </div>
              <Instrument type={data.instrument} />
            </section>
            <section className="data-panel">
              <div className="data-head">
                <div>
                  <p className="eyebrow">{tab.toUpperCase()}</p>
                  <h2>{data.panelTitle}</h2>
                </div>
                <div className="table-tools">
                  <label className="table-search">
                    <Search size={14} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search records"
                      placeholder="Search records"
                    />
                    {query && (
                      <button onClick={() => setQuery("")}>
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="filter-anchor">
                    <button
                      className="square-button"
                      onClick={() => setFilterOpen((v) => !v)}
                    >
                      <Filter size={15} />
                    </button>
                    {filterOpen && (
                      <div className="filter-menu">
                        <b>Filter by status</b>
                        {["All", ...statuses].map((x) => (
                          <label key={x}>
                            <input
                              type="radio"
                              checked={status === x}
                              onChange={() => setStatus(x)}
                            />
                            {x}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {data.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r[0]}-${i}`}>
                        {r.map((c, j) => (
                          <td key={j}>
                            {j === r.length - 1 ? (
                              <span
                                className={`status-badge ${/risk|pending|due|overdue/i.test(c) ? "warn" : ""}`}
                              >
                                {c}
                              </span>
                            ) : j === 0 ? (
                              <b>{c}</b>
                            ) : (
                              c
                            )}
                          </td>
                        ))}
                        <td>
                          <button
                            className="row-action"
                            aria-label={`View details for ${r[0]}`}
                            onClick={() =>
                              setDetail({
                                title: r[0],
                                kind: "row",
                                fields: data.columns.map((c, j) => ({
                                  label: c,
                                  value: r[j],
                                })),
                              })
                            }
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <div className="empty-state">
                    <Search size={24} />
                    <b>No matching records</b>
                    <span>Try another search or status.</span>
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatus("All");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
          <aside className="context-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">IN CONTEXT</p>
                <h2>{data.asideTitle}</h2>
              </div>
            </div>
            <div className="context-list">
              {data.aside.map((x, i) => (
                <button
                  onClick={() =>
                    setDetail({
                      title: x.title,
                      kind: "context",
                      fields: [
                        { label: "Summary", value: x.meta },
                        { label: "Status", value: x.status },
                        {
                          label: "Owner",
                          value:
                            data.title === "Exit & Separation"
                              ? "People Operations"
                              : data.title,
                        },
                      ],
                    })
                  }
                  key={x.title}
                >
                  <span className="context-index">0{i + 1}</span>
                  <span>
                    <b>{x.title}</b>
                    <small>{x.meta}</small>
                  </span>
                  <em>{x.status}</em>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            {data.title === "Exit & Separation" && (
              <div className="exit-checklist">
                <b>Standard offboarding controls</b>
                <span>Knowledge transfer</span>
                <span>Access revocation</span>
                <span>Asset return & condition</span>
                <span>Benefits and payroll holds</span>
                <span>Leave encashment & recoveries</span>
                <span>Settlement and letters</span>
                <span>Exit interview & rehire decision</span>
              </div>
            )}
            <div className="demo-note">
              <Check size={16} />
              <p>
                <b>Tenant-scoped workspace</b>
                <span>Records are separated by organization.</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
      {isOpen && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close dialog"
            onClick={close}
          />
          {detail ? (
            <aside
              className="record-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="flow-title"
              ref={dialogRef}
              tabIndex={-1}
            >
              <header className="drawer-header">
                <div>
                  <p className="eyebrow">
                    {followUp
                      ? "CREATE FOLLOW-UP"
                      : detail.kind === "row"
                        ? "RECORD DETAILS"
                        : "WORKFLOW DETAILS"}
                  </p>
                  <h2 id="flow-title">
                    {followUp ? `Follow up on ${detail.title}` : detail.title}
                  </h2>
                  <p>
                    {followUp
                      ? "Assign an accountable owner and a clear due date."
                      : "Review configuration ownership, coverage and current health."}
                  </p>
                </div>
                <button
                  className="drawer-close"
                  aria-label="Close details"
                  onClick={close}
                >
                  <X size={19} />
                </button>
              </header>
              <div className="drawer-body">
                {followUp ? (
                  <form
                    id="follow-up-form"
                    className="follow-up-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(`Follow-up created for ${detail.title}`);
                      close();
                    }}
                  >
                    <label>
                      Owner
                      <select
                        value={followUpOwner}
                        onChange={(e) => setFollowUpOwner(e.target.value)}
                      >
                        <option>People Operations</option>
                        <option>IT Security</option>
                        <option>Finance</option>
                        <option>Organization Admin</option>
                      </select>
                    </label>
                    <label>
                      Due date
                      <input
                        type="date"
                        required
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Action required
                      <textarea
                        required
                        minLength={8}
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="Describe the decision, review or change required"
                      />
                    </label>
                    <div className="follow-up-note">
                      <MessageSquare size={16} />
                      <span>
                        <b>Visible to {followUpOwner}</b>
                        <small>
                          The owner will see this in their task queue with a
                          link back to this record.
                        </small>
                      </span>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl className="record-facts">
                      {detail.fields.map((f) => (
                        <div key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {data.title === "Exit & Separation" && (
                      <div className="case-timeline">
                        <span className="done">
                          Initiated<small>Employee</small>
                        </span>
                        <span className="done">
                          Manager review<small>Completed</small>
                        </span>
                        <span>
                          Handover<small>Current stage</small>
                        </span>
                        <span>
                          Clearances<small>IT · Finance · Admin</small>
                        </span>
                        <span>
                          Settlement<small>Payroll owner</small>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <footer className="drawer-footer">
                {followUp ? (
                  <>
                    <button
                      className="secondary-button"
                      onClick={() => setFollowUp(false)}
                    >
                      Back
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      form="follow-up-form"
                    >
                      Create follow-up
                    </button>
                  </>
                ) : (
                  <>
                    <button className="secondary-button" onClick={close}>
                      Close
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => setFollowUp(true)}
                    >
                      Create follow-up
                    </button>
                  </>
                )}
              </footer>
            </aside>
          ) : (
            <div
              className="flow-dialog rich-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="flow-title"
              ref={dialogRef}
              tabIndex={-1}
            >
              <button className="flow-close" aria-label="Close" onClick={close}>
                <X size={18} />
              </button>
              {submitted ? (
                <div className="success-state">
                  <Check size={28} />
                  <p className="eyebrow">CREATED</p>
                  <h2 id="flow-title">Workflow started</h2>
                  <p>
                    The new record is in the current view and ready for its next
                    owner.
                  </p>
                  <button className="primary-button" onClick={close}>
                    Return to {data.title}
                  </button>
                </div>
              ) : (
                <RichCreateForm
                  module={data.title}
                  onCancel={close}
                  onCreated={(name, summary) => {
                    setAllRows((r) => [
                      [
                        name,
                        ...data.columns
                          .slice(1, -1)
                          .map((_, i) => (i === 0 ? summary : "—")),
                        "Draft",
                      ],
                      ...r,
                    ]);
                    setSubmitted(true);
                    act(`${name} created`);
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
