"use client";
import { AlertTriangle, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { EMPLOYMENT_TYPES, errorText, onboardingApi, type Candidate, type Joiner, type JoinerDetail, type TemplateSummary } from "./api";
import { PersonSelect } from "./shared";

type Values = Record<string, string>;
const DEPARTMENTS = ["Cafe Operations", "Retail Operations", "Roastery", "Supply Chain", "Marketing", "Technology", "Finance", "People"];

function fromJoiner(joiner: Joiner): Values {
  return {
    fullName: joiner.fullName, personalEmail: joiner.personalEmail || "", phone: joiner.phone || "", designation: joiner.designation,
    department: joiner.department, location: joiner.location || "", managerId: joiner.manager?.id || "", buddyId: joiner.buddy?.id || "",
    joiningDate: joiner.joiningDate, employmentType: joiner.employmentType, notes: joiner.notes || "", panNumber: joiner.panNumber || "", aadhaarNumber: "",
  };
}

/** Create a joiner (blank or from a hired candidate) or edit an existing one. */
export function JoinerDrawer({ joiner, candidate, departments = [], onClose, onSaved }: {
  joiner?: Joiner; candidate?: Candidate | null; departments?: string[]; onClose: () => void; onSaved: (detail: JoinerDetail) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDialogFocus(true, close, ref);
  const editing = !!joiner;
  const joined = joiner && joiner.status !== "PRE_BOARDING" && joiner.status !== "READY_TO_JOIN";
  const [values, setValues] = useState<Values>(() => joiner ? fromJoiner(joiner) : {
    fullName: candidate?.name || "", personalEmail: candidate?.email || "", phone: candidate?.phone || "",
    designation: candidate?.designation || "", department: "", location: candidate?.location || "", managerId: "", buddyId: "",
    joiningDate: candidate?.joiningDate || "", employmentType: "FULL_TIME", notes: candidate ? `Hired via ${candidate.caseNumber} (${candidate.position}).` : "", templateId: "",
  });
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (key: string) => ({ value: values[key] || "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key)(event.target.value) });

  useEffect(() => { if (!editing) onboardingApi.templates().then((data) => setTemplates(data.items)).catch(() => setTemplates([])); }, [editing]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (joiner) {
        const original = fromJoiner(joiner);
        const body: Record<string, unknown> = { version: joiner.version };
        for (const [key, value] of Object.entries(values)) if (value !== original[key] && !(key === "aadhaarNumber" && !value)) body[key] = value;
        onSaved(await onboardingApi.update(joiner.id, body));
      } else {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(values)) if (value.trim()) body[key] = value.trim();
        if (candidate) body.candidateId = candidate.id;
        onSaved(await onboardingApi.create(body));
      }
    } catch (reason) { setError(errorText(reason, "Unable to save.")); }
    finally { setBusy(false); }
  };

  const allDepartments = [...new Set([...departments, ...DEPARTMENTS])].sort();
  return (
    <>
      <button className="flow-backdrop" aria-label="Close" onClick={close} />
      <aside className="cw-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ob-joiner-title">
        <header className="cw-drawer-head" style={{ ["--accent" as string]: "#0f8177" }}>
          <button className="cw-icon-button" aria-label="Close" onClick={close}><X size={18} /></button>
          <p className="cw-eyebrow">{editing ? "EDIT JOINER" : candidate ? `FROM ${candidate.caseNumber}` : "NEW JOINER"}</p>
          <h2 id="ob-joiner-title">{editing ? joiner.fullName : candidate ? `Start onboarding ${candidate.name}` : "Add a new joiner"}</h2>
          <p className="cw-head-note">{editing
            ? joined ? "They have joined — job details now live on the employee record. Buddy, notes and ID details can still change." : "Changing the joining date moves every open task by the same number of days."
            : "The default checklist is created instantly, with each task assigned to HR, IT, Finance, the manager, the buddy or the joiner."}</p>
        </header>
        <form className="cw-drawer-body cw-create" onSubmit={submit}>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="cw-fields">
            <label className="wide"><span>Full name <em>*</em></span><input {...input("fullName")} required minLength={2} maxLength={160} disabled={!!joined} autoComplete="off" /></label>
            <label><span>Personal email <em>*</em></span><input type="email" {...input("personalEmail")} required maxLength={200} disabled={!!joined} /></label>
            <label><span>Phone</span><input {...input("phone")} maxLength={30} inputMode="tel" /></label>
            <label><span>Designation <em>*</em></span><input {...input("designation")} required minLength={2} maxLength={120} disabled={!!joined} placeholder="e.g. Barista" /></label>
            <label><span>Department <em>*</em></span>
              <input {...input("department")} list="ob-departments" required minLength={2} maxLength={120} disabled={!!joined} placeholder="e.g. Cafe Operations" />
              <datalist id="ob-departments">{allDepartments.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
            <label><span>Location</span><input {...input("location")} maxLength={120} disabled={!!joined} placeholder="e.g. Bengaluru — Indiranagar" /></label>
            <label><span>Joining date <em>*</em></span><input type="date" {...input("joiningDate")} required disabled={!!joined} /></label>
            <label><span>Reporting manager</span><PersonSelect value={values.managerId} onChange={set("managerId")} placeholder="Choose a manager" /></label>
            <label><span>Buddy <small>(peer who shows them around)</small></span><PersonSelect value={values.buddyId} onChange={set("buddyId")} placeholder="No buddy yet" exclude={values.managerId ? [values.managerId] : []} /></label>
            <label><span>Employment type</span>
              <select {...input("employmentType")} disabled={!!joined}>{EMPLOYMENT_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
            </label>
            {!editing && templates.length > 1 && (
              <label><span>Checklist template</span>
                <select {...input("templateId")}><option value="">Default ({templates.find((item) => item.isDefault)?.name})</option>
                  {templates.filter((item) => !item.isDefault).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.taskCount} tasks</option>)}
                </select>
              </label>
            )}
            {editing && (
              <>
                <label><span>PAN <small>{joiner?.panMasked ? `(on file: ${joiner.panMasked} — type a new PAN to replace it)` : "(stored encrypted)"}</small></span><input {...input("panNumber")} maxLength={10} placeholder="ABCDE1234F" style={{ textTransform: "uppercase" }} autoComplete="off" /></label>
                <label><span>Aadhaar <small>{joiner.aadhaarMasked ? `(on file: ${joiner.aadhaarMasked})` : "(only last 4 digits are stored)"}</small></span>
                  <input {...input("aadhaarNumber")} maxLength={14} inputMode="numeric" placeholder="12-digit number" autoComplete="off" />
                </label>
              </>
            )}
            <label className="wide"><span>Notes for HR</span><textarea rows={3} {...input("notes")} maxLength={2000} /></label>
          </div>
          <footer className="cw-create-foot">
            <button type="button" className="cw-btn ghost" onClick={close}>Cancel</button>
            <button className="cw-btn primary" disabled={busy}><UserPlus size={16} /> {busy ? "Saving…" : editing ? "Save changes" : "Add joiner"}</button>
          </footer>
        </form>
      </aside>
    </>
  );
}
