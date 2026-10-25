"use client";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  MessageSquare,
  Search,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { tenant } from "@/lib/tenant";
import { useDialogFocus } from "@/lib/use-dialog-focus";

const approvals = [
  {
    id: "LV-2048",
    type: "Leave request",
    title: "Casual leave · 2 days",
    person: "Aarav Mehta",
    meta: "03–04 Aug 2026",
    reason: "Family commitment",
    urgent: true,
  },
  {
    id: "AT-1182",
    type: "Attendance",
    title: "Missed punch regularization",
    person: "Nisha Rao",
    meta: "28 Jul 2026 · Punch out",
    reason: "Client meeting ran beyond office hours",
    urgent: false,
  },
  {
    id: "EX-0841",
    type: "Expense",
    title: "Team planning lunch · ₹4,260",
    person: "Kabir Singh",
    meta: "Submitted 27 Jul 2026",
    reason: "Quarterly product planning",
    urgent: false,
  },
];
export function RegularizePage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="workflow-page">
      <Link className="profile-back" href="/attendance">
        <ArrowLeft />
        Back to Attendance
      </Link>
      <header className="workflow-heading">
        <div>
          <p className="eyebrow">ATTENDANCE CORRECTION</p>
          <h1>Regularize a missed punch</h1>
          <p>
            Submit the expected time with evidence. Your reporting manager
            reviews every correction.
          </p>
        </div>
        <span>
          <Clock3 />
          Manager SLA
          <br />
          <b>Within 2 working days</b>
        </span>
      </header>
      {sent ? (
        <section className="workflow-success">
          <Check />
          <h2>Request sent to Priya Nair</h2>
          <p>
            Request AT-1191 is now pending manager approval. You’ll be notified
            when it changes.
          </p>
          <button onClick={() => setSent(false)}>
            Submit another correction
          </button>
        </section>
      ) : (
        <form
          className="regularize-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <section>
            <h2>Correction details</h2>
            <div className="form-grid">
              <label>
                Attendance date
                <input type="date" required />
              </label>
              <label>
                Correction type
                <select required defaultValue="">
                  <option value="" disabled>
                    Select missing event
                  </option>
                  <option>Missing punch in</option>
                  <option>Missing punch out</option>
                  <option>Both punches missing</option>
                </select>
              </label>
              <label>
                Expected punch in
                <input type="time" required />
              </label>
              <label>
                Expected punch out
                <input type="time" required />
              </label>
              <label className="full">
                Reason
                <textarea
                  required
                  minLength={12}
                  placeholder="Explain why the attendance event was missed"
                />
              </label>
              <label className="file-field full">
                <Upload />
                Evidence (optional)
                <input type="file" />
              </label>
            </div>
          </section>
          <aside>
            <p className="eyebrow">APPROVAL PREVIEW</p>
            <h2>What happens next</h2>
            <ol>
              <li>
                <span>1</span>
                <p>
                  <b>Policy checks</b>
                  <small>Shift, holiday and existing punch validation</small>
                </p>
              </li>
              <li>
                <span>2</span>
                <p>
                  <b>Priya Nair reviews</b>
                  <small>Your reporting manager receives the request</small>
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  <b>Attendance updates</b>
                  <small>Approved time flows into payroll</small>
                </p>
              </li>
            </ol>
            <button type="submit">Send for approval</button>
          </aside>
        </form>
      )}
      <section className="history-panel">
        <div>
          <p className="eyebrow">RECENT REQUESTS</p>
          <h2>Pending and completed corrections</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Date</th>
              <th>Correction</th>
              <th>Approver</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>AT-1189</b>
              </td>
              <td>25 Jul 2026</td>
              <td>Punch out · 6:18 PM</td>
              <td>Priya Nair</td>
              <td>
                <span className="status-badge warn">Pending</span>
              </td>
            </tr>
            <tr>
              <td>
                <b>AT-1164</b>
              </td>
              <td>08 Jul 2026</td>
              <td>Punch in · 9:06 AM</td>
              <td>Priya Nair</td>
              <td>
                <span className="status-badge">Approved</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function ApprovalsPage() {
  const [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState<(typeof approvals)[number] | null>(null),
    [message, setMessage] = useState("");
  const ref = useRef<HTMLElement>(null);
  const close = useCallback(() => setSelected(null), []);
  useDialogFocus(Boolean(selected), close, ref);
  const list = useMemo(
    () =>
      filter === "All" ? approvals : approvals.filter((x) => x.type === filter),
    [filter],
  );
  const resolve = (decision: string) => {
    setMessage(`${selected?.id} ${decision}`);
    setSelected(null);
    setTimeout(() => setMessage(""), 2200);
  };
  return (
    <div className="workflow-page">
      <header className="workflow-heading">
        <div>
          <p className="eyebrow">
            MANAGER WORKSPACE · {tenant.displayName.toUpperCase()}
          </p>
          <h1>Approval inbox</h1>
          <p>
            Review team requests with policy context and a complete decision
            trail.
          </p>
        </div>
        <span>
          <UserRound />
          Reporting team
          <br />
          <b>8 employees</b>
        </span>
      </header>
      <div className="approval-toolbar">
        <div>
          {["All", "Leave request", "Attendance", "Expense"].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <label>
          <Search />
          <input placeholder="Search requests or people" />
        </label>
      </div>
      <section className="approval-list">
        {list.length ? (
          list.map((x) => (
            <button key={x.id} onClick={() => setSelected(x)}>
              <span className={x.urgent ? "urgent" : ""}>
                {x.type.slice(0, 2).toUpperCase()}
              </span>
              <p>
                <small>
                  {x.type} · {x.id}
                </small>
                <b>{x.title}</b>
                <em>
                  {x.person} · {x.meta}
                </em>
              </p>
              <strong>{x.urgent ? "Due today" : "Review"} →</strong>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Check />
            <b>You’re all caught up</b>
            <span>No requests match this filter.</span>
          </div>
        )}
      </section>
      {selected && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close request"
            onClick={close}
          />
          <aside
            className="record-drawer approval-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-title"
            ref={ref}
            tabIndex={-1}
          >
            <header className="drawer-header">
              <div>
                <p className="eyebrow">
                  {selected.type.toUpperCase()} · {selected.id}
                </p>
                <h2 id="approval-title">{selected.title}</h2>
                <p>Submitted by {selected.person}</p>
              </div>
              <button className="drawer-close" onClick={close}>
                <X />
              </button>
            </header>
            <div className="drawer-body">
              <dl className="record-facts">
                <div>
                  <dt>Employee</dt>
                  <dd>{selected.person}</dd>
                </div>
                <div>
                  <dt>Requested period</dt>
                  <dd>{selected.meta}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{selected.reason}</dd>
                </div>
                <div>
                  <dt>Policy result</dt>
                  <dd>Within entitlement · no conflict found</dd>
                </div>
              </dl>
              <div className="approval-context">
                <Check />
                <p>
                  <b>Ready for decision</b>
                  <span>
                    The employee and People Operations will receive an immediate
                    update.
                  </span>
                </p>
              </div>
              <label className="decision-note">
                Decision note (required for rejection)
                <textarea placeholder="Add useful context for the employee" />
              </label>
            </div>
            <footer className="drawer-footer approval-actions">
              <button onClick={() => resolve("sent back for clarification")}>
                <MessageSquare />
                Ask clarification
              </button>
              <button className="reject" onClick={() => resolve("rejected")}>
                Reject
              </button>
              <button
                className="primary-button"
                onClick={() => resolve("approved")}
              >
                Approve
              </button>
            </footer>
          </aside>
        </>
      )}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

const news = [
  {
    category: "Town hall",
    date: "30 Jul",
    title: "Quarterly all-hands",
    summary: "Company performance, customer stories and a live leadership Q&A.",
    body: "Join the quarterly all-hands at 4:00 PM in the auditorium or through the company livestream. Submit questions before 2:00 PM.",
  },
  {
    category: "Policy",
    date: "29 Jul",
    title: "Parental leave policy expanded",
    summary: "More flexibility and inclusive caregiver coverage from 1 August.",
    body: "The updated policy increases paid primary-caregiver leave and introduces flexible return-to-work options. Open the policy library for eligibility details.",
  },
  {
    category: "People",
    date: "26 Jul",
    title: "Welcome our July joiners",
    summary: "Meet the 18 colleagues who joined teams across India this month.",
    body: "New colleagues have joined Product, Operations, Retail and Finance. Say hello in the next company coffee hour.",
  },
];
export function AnnouncementsPage() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [article, setArticle] = useState<(typeof news)[number] | null>(null);
  const ref = useRef<HTMLElement>(null);
  const close = useCallback(() => setArticle(null), []);
  useDialogFocus(Boolean(article), close, ref);
  const shown = news.filter(
    (x) =>
      (category === "All" || x.category === category) &&
      `${x.title} ${x.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="workflow-page">
      <header className="workflow-heading">
        <div>
          <p className="eyebrow">AROUND {tenant.displayName.toUpperCase()}</p>
          <h1>Announcements & events</h1>
          <p>
            Company news, policy updates and events in one readable archive.
          </p>
        </div>
        <span>
          <CalendarDays />
          Next event
          <br />
          <b>All-hands · 30 Jul</b>
        </span>
      </header>
      <div className="announcement-tools">
        <label>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search announcements"
          />
        </label>
        <div>
          {["All", "Town hall", "Policy", "People"].map((x) => (
            <button
              className={category === x ? "active" : ""}
              onClick={() => setCategory(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <section className="news-archive">
        {shown.map((x, i) => (
          <button
            key={x.title}
            className={i === 0 ? "featured" : ""}
            onClick={() => setArticle(x)}
          >
            <span>
              <b>{x.date.split(" ")[0]}</b>
              <small>{x.date.split(" ")[1]}</small>
            </span>
            <p>
              <small>{x.category}</small>
              <strong>{x.title}</strong>
              <em>{x.summary}</em>
            </p>
            <i>Read story →</i>
          </button>
        ))}
      </section>
      {article && (
        <>
          <button
            className="flow-backdrop"
            onClick={close}
            aria-label="Close article"
          />
          <aside
            className="record-drawer article-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-title"
            ref={ref}
            tabIndex={-1}
          >
            <header className="drawer-header">
              <div>
                <p className="eyebrow">
                  {article.category} · {article.date}
                </p>
                <h2 id="article-title">{article.title}</h2>
              </div>
              <button className="drawer-close" onClick={close}>
                <X />
              </button>
            </header>
            <article className="drawer-body article-body">
              <p className="article-lead">{article.summary}</p>
              <p>{article.body}</p>
              <h3>What you need to know</h3>
              <ul>
                <li>This update applies within your tenant workspace.</li>
                <li>Questions can be sent to the People Operations team.</li>
              </ul>
            </article>
            <footer className="drawer-footer">
              <button className="secondary-button" onClick={close}>
                Close
              </button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
