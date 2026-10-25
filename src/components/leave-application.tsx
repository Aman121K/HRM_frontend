"use client";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  FileText,
  Info,
  Paperclip,
  Save,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  leavePolicy,
  pendingLeaveRequests,
  type PendingLeave,
} from "@/lib/leave-policy";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {httpRequest} from "@/lib/http-client";

type Errors = Partial<
  Record<
    "type" | "from" | "to" | "reason" | "note" | "handover" | "file" | "days",
    string
  >
>;
const DRAFT_KEY = "hrm.leave.application.draft.v1";
const iso = (d: Date) => d.toISOString().slice(0, 10),
  parse = (s: string) => new Date(`${s}T12:00:00`);
const fmt = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(parse(s));
const calendarDays = (from: string, to: string) => {
  const out: string[] = [];
  if (!from || !to || to < from) return out;
  for (
    let d = parse(from), end = parse(to);
    d <= end;
    d.setDate(d.getDate() + 1)
  )
    out.push(iso(d));
  return out;
};

export function LeaveApplication() {
  const [type, setType] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [fromPart, setFromPart] = useState("full"),
    [toPart, setToPart] = useState("full"),
    [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [contact, setContact] = useState(""),
    [handover, setHandover] = useState(""),
    [file, setFile] = useState(""),
    [errors, setErrors] = useState<Errors>({}),
    [sent, setSent] = useState(false),
    [draftMessage, setDraftMessage] = useState(""),
    [requests, setRequests] = useState<PendingLeave[]>([]),
    [policyTypes,setPolicyTypes]=useState(leavePolicy.types),
    [networkError,setNetworkError]=useState(""),
    [submitting,setSubmitting]=useState(false),
    [detail, setDetail] = useState<PendingLeave | null>(null),
    [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null),
    confirmRef = useRef<HTMLDivElement>(null);
  const closeDetail = useCallback(() => {
      setDetail(null);
      setConfirmWithdraw(false);
    }, []),
    closeConfirm = useCallback(() => setConfirmWithdraw(false), []);
  useDialogFocus(Boolean(detail && !confirmWithdraw), closeDetail, detailRef);
  useDialogFocus(confirmWithdraw, closeConfirm, confirmRef);
  const selected = policyTypes.find((x) => x.id === type),
    today = useMemo(() => iso(new Date()), []);
  const dateRows = useMemo(
    () =>
      calendarDays(from, to).map((date, index, all) => {
        const d = parse(date),
          holiday = leavePolicy.holidays.find((h) => h.date === date),
          weekend = !leavePolicy.workweek.includes(d.getDay());
        let amount =
          selected &&
          (weekend
            ? selected.includeWeekends
            : holiday
              ? selected.includeHolidays
              : true)
            ? 1
            : 0;
        let label = weekend
          ? "Weekend"
          : holiday
            ? holiday.name
            : "Working day";
        if (amount && index === 0 && fromPart !== "full") {
          amount = 0.5;
          label = fromPart === "first" ? "First half" : "Second half";
        }
        if (
          amount &&
          index === all.length - 1 &&
          all.length > 1 &&
          toPart !== "full"
        ) {
          amount = 0.5;
          label = toPart === "first" ? "First half" : "Second half";
        }
        if (amount && all.length === 1 && fromPart !== "full") {
          amount = 0.5;
          label = fromPart === "first" ? "First half" : "Second half";
        }
        return { date, label, amount, weekend, holiday };
      }),
    [from, to, fromPart, toPart, selected],
  );
  const days = dateRows.reduce((n, x) => n + x.amount, 0),
    documentRequired =
      !!selected &&
      selected.documentAfter !== undefined &&
      days > selected.documentAfter;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setType(d.type || "");
      setFrom(d.from || "");
      setTo(d.to || "");
      setFromPart(d.fromPart || "full");
      setToPart(d.toPart || "full");
      setReason(d.reason || "");
      setNote(d.note || "");
      setContact(d.contact || "");
      setHandover(d.handover || "");
      setDraftMessage("Draft restored from this device");
    } catch {}
  }, []);
  const loadRequests=useCallback(async()=>{try{const [types,history]=await Promise.all([httpRequest<any>("/api/v2/leave-types"),httpRequest<any>("/api/v2/leaves")]);setPolicyTypes(types.items.map((x:any,index:number)=>({...leavePolicy.types[index%leavePolicy.types.length],id:x.id,name:x.name,available:Number(x.balance??x.annual_quota),annual:Number(x.opening_balance??x.annual_quota),documentAfter:x.requires_document_after_days===null?undefined:Number(x.requires_document_after_days)})));setRequests(history.items.map((x:any)=>({id:x.id,type:x.leave_type,dates:`${String(x.start_date).slice(0,10)} to ${String(x.end_date).slice(0,10)}`,duration:`${x.days} day${Number(x.days)===1?"":"s"}`,from:String(x.start_date).slice(0,10),to:String(x.end_date).slice(0,10),reason:x.reason,note:x.decision_note||"No decision note",attachment:false,status:x.status[0]+x.status.slice(1).toLowerCase(),submitted:new Date(x.submitted_at).toLocaleString("en-IN"),sla:x.decided_at?`Decided ${new Date(x.decided_at).toLocaleString("en-IN")}`:"Awaiting manager decision"})));setNetworkError("")}catch(e){setNetworkError(e instanceof Error?e.message:"Unable to load leave data")}},[]);useEffect(()=>{loadRequests()},[loadRequests]);
  const validate = () => {
    const e: Errors = {};
    if (!type) e.type = "Select a leave type.";
    if (!from) e.from = "Choose a start date.";
    else if (from < today) e.from = "Past dates cannot be requested.";
    if (!to) e.to = "Choose an end date.";
    else if (from && to < from)
      e.to = "End date must be on or after the start date.";
    if (
      from &&
      to &&
      requests.some(
        (r) => r.status !== "Withdrawn" && from <= r.to && to >= r.from,
      )
    )
      e.to = "These dates overlap an existing pending request.";
    if (selected && days < selected.minDays)
      e.days = `Minimum request is ${selected.minDays} day${selected.minDays === 1 ? "" : "s"}.`;
    if (selected && days > selected.maxDays)
      e.days = `Maximum request is ${selected.maxDays} days.`;
    if (selected && !selected.negativeBalance && days > selected.available)
      e.days = `Only ${selected.available} days are available.`;
    if (selected && from) {
      const notice = Math.ceil(
        (parse(from).getTime() - parse(today).getTime()) / 86400000,
      );
      if (notice < selected.noticeDays)
        e.from = `This policy requires ${selected.noticeDays} calendar days' notice.`;
    }
    if (!reason) e.reason = "Select the reason for leave.";
    if (reason === "Other" && note.trim().length < 10)
      e.note = "Add at least 10 characters when selecting Other.";
    if (days >= 3 && !handover.trim())
      e.handover = "Add a handover colleague for requests of 3 days or more.";
    if (documentRequired && !file)
      e.file = `Attach supporting evidence for requests over ${selected?.documentAfter} days.`;
    setErrors(e);
    return !Object.keys(e).length;
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      document
        .querySelector(".leave-error")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);setNetworkError("");try{await httpRequest("/api/v2/leaves",{method:"POST",body:{leaveTypeId:type,startDate:from,endDate:to,days,reason:note.trim()?`${reason}: ${note.trim()}`:reason}});localStorage.removeItem(DRAFT_KEY);await loadRequests();setSent(true);window.scrollTo({top:0,behavior:"smooth"})}catch(e){setNetworkError(e instanceof Error?e.message:"Leave request failed")}finally{setSubmitting(false)}
  };
  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        type,
        from,
        to,
        fromPart,
        toPart,
        reason,
        note,
        contact,
        handover,
      }),
    );
    setDraftMessage(
      `Draft saved on this device · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
    );
  };
  const withdraw = async () => {
    if (!detail) return;
    try{await httpRequest(`/api/v2/leaves/${detail.id}/withdraw`,{method:"POST"});await loadRequests();setDetail(null);setConfirmWithdraw(false)}catch(e){setNetworkError(e instanceof Error?e.message:"Withdrawal failed");setConfirmWithdraw(false)}
  };
  if (sent)
    return (
      <div className="leave-page">
        <div className="leave-success">
          <span>
            <Check />
          </span>
          <p className="eyebrow">REQUEST SUBMITTED</p>
          <h1>Your leave request is on its way</h1>
          <p>
            {days} day{days === 1 ? "" : "s"} of {selected?.name} has been sent
            to {leavePolicy.approver}. Your balance now reserves this request as
            pending.
          </p>
          <div>
            <Link className="secondary-button" href="/leave">
              Back to Leave
            </Link>
            <button className="primary-button" onClick={() => setSent(false)}>
              Apply another leave
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="leave-page">
      <header className="leave-page-head">
        <Link href="/leave" aria-label="Back to Leave">
          <ArrowLeft />
        </Link>
        <div>
          <p className="eyebrow">TIME & LEAVE · {leavePolicy.year}</p>
          <h1>Apply for leave</h1>
          <p>
            Review eligibility, day calculation and balance impact before
            submitting.
          </p>
        </div>
      </header>
      <div className="leave-layout">
        <form className="leave-form-card" noValidate onSubmit={submit}>
          <div className="leave-card-title">
            <div>
              <h2>Leave request</h2>
              <p>Fields marked * are required</p>
            </div>
            <span>
              <CalendarDays />
              Approver: <b>{leavePolicy.approver}</b>
            </span>
          </div>
          {networkError&&<div className="leave-error" role="alert"><AlertCircle/><div><b>Leave service unavailable</b><p>{networkError}</p></div></div>}
          {Object.keys(errors).length > 0 && (
            <div className="leave-error" role="alert" tabIndex={-1}>
              <AlertCircle />
              <div>
                <b>
                  Please review {Object.keys(errors).length} item
                  {Object.keys(errors).length === 1 ? "" : "s"}
                </b>
                <ul>
                  {Object.values(errors).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {draftMessage && (
            <p className="draft-status" role="status">
              <Save /> {draftMessage}
            </p>
          )}
          <div className="leave-fields">
            <Field label="Leave type *" wide error={errors.type}>
              <select
                value={type}
                aria-invalid={!!errors.type}
                onChange={(e) => {
                  setType(e.target.value);
                  setErrors((v) => ({ ...v, type: undefined }));
                }}
              >
                <option value="">Select leave type</option>
                {policyTypes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ·{" "}
                    {x.id === "unpaid"
                      ? "No balance required"
                      : `${x.available} days available`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date *" error={errors.from}>
              <input
                type="date"
                min={today}
                value={from}
                aria-invalid={!!errors.from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (!to || to < e.target.value) setTo(e.target.value);
                  setErrors((v) => ({ ...v, from: undefined, to: undefined }));
                }}
              />
            </Field>
            <Field label="Start duration">
              <select
                value={fromPart}
                disabled={!!selected && !selected.halfDay}
                onChange={(e) => setFromPart(e.target.value)}
              >
                <option value="full">Full day</option>
                <option value="first">First half</option>
                <option value="second">Second half</option>
              </select>
            </Field>
            <Field label="End date *" error={errors.to}>
              <input
                type="date"
                min={from || today}
                value={to}
                aria-invalid={!!errors.to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setErrors((v) => ({ ...v, to: undefined }));
                }}
              />
            </Field>
            <Field label="End duration">
              <select
                value={toPart}
                disabled={from === to || (!!selected && !selected.halfDay)}
                onChange={(e) => setToPart(e.target.value)}
              >
                <option value="full">Full day</option>
                <option value="first">First half</option>
                <option value="second">Second half</option>
              </select>
            </Field>
            <Field label="Reason *" wide error={errors.reason}>
              <select
                value={reason}
                aria-invalid={!!errors.reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((v) => ({ ...v, reason: undefined }));
                }}
              >
                <option value="">Select reason</option>
                <option>Personal commitment</option>
                <option>Medical / wellness</option>
                <option>Family care</option>
                <option>Travel</option>
                <option>Life event</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Additional note" wide error={errors.note}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Share context that will help your approver (maximum 500 characters)"
              />
            </Field>
            <Field label="Emergency contact">
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Name and phone number"
              />
            </Field>
            <Field label="Handover to" error={errors.handover}>
              <input
                value={handover}
                onChange={(e) => setHandover(e.target.value)}
                placeholder="Colleague name"
              />
            </Field>
            <label
              className={`wide upload-field ${errors.file ? "field-invalid" : ""}`}
            >
              Supporting document{" "}
              {documentRequired && <b>* Required by policy</b>}
              <span>
                <Paperclip />
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0]?.name || "")}
                />
                {file || "Choose a file (PDF, image or document · max 10 MB)"}
              </span>
              {errors.file && <em>{errors.file}</em>}
            </label>
            <label className="check-field wide">
              <input type="checkbox" defaultChecked />
              Notify my approver and handover colleague by email
            </label>
          </div>
          {selected && <PolicySummary policy={selected} />}{" "}
          {errors.days && (
            <p className="field-error standalone">{errors.days}</p>
          )}
          {dateRows.length > 0 && (
            <div className="day-calculation">
              <div>
                <h3>Day-by-day calculation</h3>
                <span>
                  {days} day{days === 1 ? "" : "s"} charged
                </span>
              </div>
              <div className="day-table" role="table">
                <div className="day-row head" role="row">
                  <b>Date</b>
                  <b>Policy treatment</b>
                  <b>Charge</b>
                </div>
                {dateRows.map((x) => (
                  <div className="day-row" role="row" key={x.date}>
                    <span>{fmt(x.date)}</span>
                    <span>
                      {x.label}
                      {x.amount === 0 ? " · excluded" : ""}
                    </span>
                    <strong>
                      {x.amount
                        ? `${x.amount} day${x.amount === 1 ? "" : "s"}`
                        : "—"}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="leave-submit">
            <div>
              <span>Applied leave</span>
              <strong>
                {days} day{days === 1 ? "" : "s"}
              </strong>
              <small>
                {selected?.includeWeekends
                  ? "Calendar days per policy"
                  : "Weekends excluded"}{" "}
                · holidays evaluated above
              </small>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={saveDraft}
            >
              <Save /> Save draft
            </button>
            <Link className="secondary-button" href="/leave">
              Cancel
            </Link>
            <button className="primary-button" disabled={submitting}>{submitting?"Submitting…":"Submit request"}</button>
          </div>
        </form>
        <aside className="leave-side">
          <section>
            <div className="leave-card-title">
              <div>
                <h2>Pending requests</h2>
                <p>
                  {requests.filter((x) => x.status !== "Withdrawn").length}{" "}
                  awaiting approval
                </p>
              </div>
            </div>
            {requests.map((x) => (
              <button
                className={`pending-leave ${x.status === "Withdrawn" ? "withdrawn" : ""}`}
                key={x.id}
                onClick={() => setDetail(x)}
              >
                <span>
                  <b>{x.type}</b>
                  <small>
                    {x.id} · Submitted {x.submitted.split(" · ")[0]}
                  </small>
                </span>
                <strong>{x.duration}</strong>
                <em>{x.dates}</em>
                <i>{x.status}</i>
              </button>
            ))}
          </section>
          <section className="balance-section">
            <div className="leave-card-title">
              <div>
                <h2>Balance ledger</h2>
                <p>All values in days · as of today</p>
              </div>
            </div>
            <div className="balance-ledger">
              <div className="ledger-head">
                <span>Leave type</span>
                <span>Open</span>
                <span>Carry</span>
                <span>Accrued</span>
                <span>Availed</span>
                <span>Pending</span>
                <span>Available</span>
              </div>
              {policyTypes
                .filter((x) => x.id !== "unpaid")
                .map((x) => (
                  <div className="ledger-row" key={x.id}>
                    <b style={{ borderLeftColor: x.color }}>
                      {x.name}
                      <small>{x.expiry}</small>
                    </b>
                    <span>{x.opening}d</span>
                    <span>{x.carried}d</span>
                    <span>{x.accrued}d</span>
                    <span>{x.availed}d</span>
                    <span>{x.pending}d</span>
                    <strong>{x.available}d</strong>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
      {detail && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close request details"
            onClick={closeDetail}
          />
          <div
            className="record-drawer drawer-detail drawer-content leave-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-detail-title"
            ref={detailRef}
            tabIndex={-1}
          >
            <button
              className="flow-close"
              onClick={closeDetail}
              aria-label="Close"
            >
              <X />
            </button>
            <p className="eyebrow">
              {detail.id} · {detail.status.toUpperCase()}
            </p>
            <h2 id="leave-detail-title">{detail.type}</h2>
            <dl>
              <div>
                <dt>Dates</dt>
                <dd>{detail.dates}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{detail.duration}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{detail.reason}</dd>
              </div>
              <div>
                <dt>Note / handover</dt>
                <dd>{detail.note}</dd>
              </div>
              <div>
                <dt>Attachment</dt>
                <dd>{detail.attachment ? "Attached" : "Not attached"}</dd>
              </div>
              <div>
                <dt>Decision SLA</dt>
                <dd>{detail.sla}</dd>
              </div>
            </dl>
            <div className="approval-timeline">
              <h3>Approval timeline</h3>
              <span className="done">
                <i>✓</i>
                <b>Submitted by Vikas Tiwari</b>
                <small>{detail.submitted}</small>
              </span>
              <span
                className={detail.status === "Withdrawn" ? "done" : "active"}
              >
                <i>{detail.status === "Withdrawn" ? "✓" : "2"}</i>
                <b>
                  {detail.status === "Withdrawn"
                    ? "Withdrawn by employee"
                    : `Awaiting ${detail.approver}`}
                </b>
                <small>
                  {detail.status === "Withdrawn"
                    ? "Request closed; reserved balance released"
                    : detail.sla}
                </small>
              </span>
              <span>
                <i>3</i>
                <b>Final decision</b>
                <small>
                  {detail.status === "Withdrawn"
                    ? "No longer required"
                    : "Not started"}
                </small>
              </span>
            </div>
            <div className="flow-actions">
              <button className="secondary-button" onClick={closeDetail}>
                Close
              </button>
              {detail.status !== "Withdrawn" && (
                <button
                  className="danger-button"
                  onClick={() => setConfirmWithdraw(true)}
                >
                  Withdraw request
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {confirmWithdraw && detail && (
        <>
          <button
            className="confirm-backdrop"
            aria-label="Cancel withdrawal"
            onClick={closeConfirm}
          />
          <div
            className="withdraw-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
            ref={confirmRef}
            tabIndex={-1}
          >
            <AlertCircle />
            <h2 id="withdraw-title">Withdraw {detail.id}?</h2>
            <p>
              This will close the approval and release {detail.days} pending day
              {detail.days === 1 ? "" : "s"} back to your available balance.
              This action is recorded in the timeline.
            </p>
            <div>
              <button className="secondary-button" onClick={closeConfirm}>
                Keep request
              </button>
              <button className="danger-button" onClick={withdraw}>
                Yes, withdraw
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  wide,
  error,
  children,
}: {
  label: string;
  wide?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`${wide ? "wide " : ""}${error ? "field-invalid" : ""}`}>
      {label}
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}
function PolicySummary({
  policy,
}: {
  policy: (typeof leavePolicy.types)[number];
}) {
  return (
    <section className="policy-summary">
      <div className="policy-summary-head">
        <Info />
        <div>
          <p className="eyebrow">SELECTED POLICY</p>
          <h3>{policy.name}</h3>
          <span>
            {policy.paid
              ? "Paid entitlement"
              : "Unpaid · payroll impact applies"}
          </span>
        </div>
        <strong>
          {policy.available}
          <small>days available</small>
        </strong>
      </div>
      <div className="policy-math">
        <span>
          Opening <b>{policy.opening}d</b>
        </span>
        <i>+</i>
        <span>
          Carried <b>{policy.carried}d</b>
        </span>
        <i>+</i>
        <span>
          Accrued <b>{policy.accrued}d</b>
        </span>
        <i>−</i>
        <span>
          Availed <b>{policy.availed}d</b>
        </span>
        <i>−</i>
        <span>
          Pending <b>{policy.pending}d</b>
        </span>
        <i>=</i>
        <span className="result">
          Available <b>{policy.available}d</b>
        </span>
      </div>
      <dl>
        <div>
          <dt>Annual entitlement</dt>
          <dd>
            {policy.annualEntitlement
              ? `${policy.annualEntitlement} days`
              : "As approved"}
          </dd>
        </div>
        <div>
          <dt>Accrual & expiry</dt>
          <dd>
            {policy.accrual}. {policy.expiry}.
          </dd>
        </div>
        <div>
          <dt>Duration & notice</dt>
          <dd>
            {policy.minDays}–{policy.maxDays} days ·{" "}
            {policy.noticeDays
              ? `${policy.noticeDays} days' notice`
              : "No advance notice required"}
          </dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>
            {policy.documentAfter === undefined
              ? "Not normally required"
              : policy.documentAfter === 0
                ? "Required for every request"
                : `Required over ${policy.documentAfter} days`}
          </dd>
        </div>
        <div>
          <dt>Day rules</dt>
          <dd>
            {policy.halfDay ? "Half-day allowed" : "Full days only"} ·{" "}
            {policy.negativeBalance
              ? "Negative balance allowed"
              : "No negative balance"}{" "}
            · {policy.sandwich ? "Sandwich rule applies" : "No sandwich rule"} ·
            weekends/holidays{" "}
            {policy.includeWeekends || policy.includeHolidays
              ? "may be charged"
              : "excluded"}
          </dd>
        </div>
        <div>
          <dt>Eligibility & approval</dt>
          <dd>
            {policy.eligibility} · {policy.approvalChain.join(" → ")}
          </dd>
        </div>
      </dl>
    </section>
  );
}
