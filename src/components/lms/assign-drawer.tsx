"use client";
import { AlertTriangle, Check, Loader2, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { initials } from "@/lib/cases";
import { Drawer } from "./drawer";
import { errorText, type Course, type LmsOptions } from "./lms-api";

export function AssignDrawer({ courses, initialCourseId, options, onClose, onDone }: {
  courses: Pick<Course, "id" | "title" | "status" | "mandatory" | "teamCourse">[]; initialCourseId?: string; options: LmsOptions; onClose: () => void; onDone: (message: string) => void;
}) {
  const published = courses.filter((course) => course.status === "PUBLISHED");
  const [courseId, setCourseId] = useState(initialCourseId && published.some((course) => course.id === initialCourseId) ? initialCourseId : published[0]?.id || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isHr = options.viewer.isHr;
  const people = useMemo(() => options.people.filter((person) => person.id !== options.viewer.employeeId && (!search.trim() || `${person.fullName} ${person.employeeNumber} ${person.department || ""}`.toLowerCase().includes(search.trim().toLowerCase()))), [options, search]);
  const today = new Date().toISOString().slice(0, 10);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const allVisible = people.length > 0 && people.every((person) => selected.includes(person.id));
  const nothing = !selected.length && !department && !location;

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const result = await httpRequest<{ assigned: number; updated: number; skipped: number; total: number }>(`/api/v2/lms/admin/courses/${courseId}/assign`, {
        method: "POST", body: { employeeIds: selected, department: department || undefined, location: location || undefined, dueDate: dueDate || undefined, note: note.trim() || undefined },
      });
      const parts = [`${result.assigned} newly assigned`];
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} already completed`);
      onDone(`Assigned to ${result.total} ${result.total === 1 ? "person" : "people"} — ${parts.join(", ")}`);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };

  return (
    <Drawer title="Assign a course" eyebrow={isHr ? "HR · ASSIGN LEARNING" : "MANAGER · ASSIGN TO MY TEAM"} onClose={onClose}
      footer={<>
        <span className="lms-foot-note">{selected.length} selected{department ? ` + ${department}` : ""}{location ? ` + ${location}` : ""}</span>
        <button className="cw-btn ghost" onClick={onClose}>Cancel</button>
        <button className="cw-btn primary" onClick={submit} disabled={busy || !courseId || nothing}>{busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Assign &amp; notify</button>
      </>}>
      {!published.length ? <p className="cw-alert warn"><AlertTriangle size={15} /> Publish a course before assigning it.</p> : (
        <>
          {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
          <div className="cw-fields">
            <label className="wide"><span>Course <em>*</em></span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                {published.map((course) => <option key={course.id} value={course.id}>{course.title}{course.mandatory ? " (mandatory)" : ""}{course.teamCourse ? " (team)" : ""}</option>)}
              </select>
            </label>
            <label><span>Due date</span><input type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label><span>Message <small>(optional)</small></span><input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Why this matters" /></label>
            {isHr && (
              <>
                <label><span>Whole department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">—</option>{options.departments.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Whole location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">—</option>{options.locations.map((item) => <option key={item}>{item}</option>)}</select></label>
              </>
            )}
          </div>
          <div className="lms-picker">
            <div className="lms-picker-head">
              <p className="cw-section-label">{isHr ? "People" : "Your direct reports"}</p>
              <label className="cw-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter people" aria-label="Filter people" /></label>
            </div>
            {!people.length ? <p className="cw-muted">{options.people.length ? "Nobody matches that filter." : "You have no direct reports to assign."}</p> : (
              <>
                <button className="lms-picker-all" onClick={() => setSelected(allVisible ? selected.filter((id) => !people.some((person) => person.id === id)) : [...new Set([...selected, ...people.map((person) => person.id)])])}>
                  {allVisible ? "Clear visible" : `Select all ${people.length}`}
                </button>
                <ul role="listbox" aria-multiselectable="true" aria-label="People to assign">
                  {people.map((person) => {
                    const on = selected.includes(person.id);
                    return (
                      <li key={person.id} role="option" aria-selected={on} tabIndex={0} className={on ? "on" : ""} onClick={() => toggle(person.id)}
                        onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(person.id); } }}>
                        <span className="cw-avatar small">{initials(person.fullName)}</span>
                        <span><b>{person.fullName}</b><small>{person.employeeNumber} · {person.designation || "—"}{person.department ? ` · ${person.department}` : ""}</small></span>
                        <span className="lms-check">{on && <Check size={14} />}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <p className="cw-help">Each person gets a notification. People who already completed the course are skipped; existing enrolments get the new due date.</p>
        </>
      )}
    </Drawer>
  );
}
