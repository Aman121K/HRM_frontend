"use client";
import { useEffect, useState } from "react";
import { httpRequest } from "@/lib/http-client";
import { money, type FieldDef } from "@/lib/cases";

type Colleague = { id: string; fullName: string; designation: string | null; department: string | null };
let colleagueCache: Promise<Colleague[]> | null = null;
function loadColleagues() {
  colleagueCache ||= httpRequest<{ items: Colleague[] }>("/api/v2/employees?limit=100").then((data) => data.items).catch((error) => {
    colleagueCache = null;
    throw error;
  });
  return colleagueCache;
}

export function CaseFields({ fields, values, onChange, excludeEmployeeId, limits }: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  excludeEmployeeId?: string;
  limits?: Record<string, number>;
}) {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const needsPeople = fields.some((field) => field.type === "employee");
  useEffect(() => { if (needsPeople) loadColleagues().then(setColleagues).catch(() => setColleagues([])); }, [needsPeople]);
  const limit = limits && values.category ? limits[values.category] : undefined;
  return (
    <div className="cw-fields">
      {fields.map((field) => {
        const id = `field-${field.key}`;
        const value = values[field.key] ?? "";
        const wide = field.type === "textarea" || field.column === "title" || field.type === "employee";
        const label = <span>{field.label}{field.required ? <em aria-hidden> *</em> : <small> optional</small>}</span>;
        let control;
        if (field.type === "textarea")
          control = <textarea id={id} value={value} required={field.required} maxLength={field.max} rows={4} placeholder={field.placeholder} onChange={(event) => onChange(field.key, event.target.value)} />;
        else if (field.type === "select")
          control = (
            <select id={id} value={value} required={field.required} onChange={(event) => onChange(field.key, event.target.value)}>
              <option value="">Select…</option>
              {field.options?.map((option) => <option key={option} value={option}>{field.key === "priority" ? option[0] + option.slice(1).toLowerCase() : option}</option>)}
            </select>
          );
        else if (field.type === "employee")
          control = (
            <select id={id} value={value} required={field.required} onChange={(event) => onChange(field.key, event.target.value)}>
              <option value="">{colleagues.length ? "Choose a colleague…" : "Loading colleagues…"}</option>
              {colleagues.filter((person) => person.id !== excludeEmployeeId).map((person) => (
                <option key={person.id} value={person.id}>{person.fullName}{person.designation ? ` — ${person.designation}` : ""}</option>
              ))}
            </select>
          );
        else
          control = (
            <input id={id} value={value} required={field.required} placeholder={field.placeholder}
              type={field.type === "money" || field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : field.type === "email" ? "email" : "text"}
              min={field.type === "money" || field.type === "number" ? 0 : undefined} step={field.type === "money" ? "0.01" : undefined}
              max={field.type === "number" ? field.max : undefined} maxLength={field.type === "text" ? field.max : undefined}
              inputMode={field.type === "money" ? "decimal" : undefined}
              onChange={(event) => onChange(field.key, event.target.value)} />
          );
        return (
          <label key={field.key} htmlFor={id} className={wide ? "wide" : ""}>
            {label}
            {control}
            {field.column === "amount" && limit !== undefined && (
              <small className={Number(value) > limit ? "cw-limit over" : "cw-limit"}>
                Policy limit for {values.category}: {money(limit)}{Number(value) > limit ? " — this claim will be flagged for your approver." : ""}
              </small>
            )}
            {field.help && <small className="cw-help">{field.help}</small>}
          </label>
        );
      })}
    </div>
  );
}

/** Drop empty strings and coerce numeric inputs before sending to the API. */
export function cleanValues(fields: FieldDef[], values: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || value === "") continue;
    out[field.key] = field.type === "money" || field.type === "number" ? Number(value) : value;
  }
  return out;
}
