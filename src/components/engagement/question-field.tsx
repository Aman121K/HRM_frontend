"use client";
import { Check } from "lucide-react";
import { enpsBand, type AnswerValue, type Question } from "./engagement-api";

/** Renders one survey question as an accessible input. Used by the taker and the builder preview. */
export function QuestionField({ question, value, onChange, idPrefix = "q", preview = false }: {
  question: Pick<Question, "id" | "type" | "prompt" | "helpText" | "required" | "options" | "scaleLabels">;
  value: AnswerValue; onChange: (value: AnswerValue) => void; idPrefix?: string; preview?: boolean;
}) {
  const name = `${idPrefix}-${question.id}`;
  switch (question.type) {
    case "RATING": {
      const labels = question.scaleLabels.length === 5 ? question.scaleLabels : ["1", "2", "3", "4", "5"];
      return (
        <div className="eg-scale rating" role="radiogroup" aria-label={question.prompt}>
          {labels.map((label, index) => {
            const score = index + 1;
            const selected = value === score;
            return (
              <button key={score} type="button" role="radio" aria-checked={selected} className={selected ? "selected" : ""} data-score={score}
                onClick={() => onChange(selected && !question.required ? undefined : score)}>
                <b>{score}</b><span>{label}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case "ENPS": {
      const [low, high] = question.scaleLabels.length === 2 ? question.scaleLabels : ["Not at all likely", "Extremely likely"];
      return (
        <div className="eg-enps-input">
          <div className="eg-scale enps" role="radiogroup" aria-label={`${question.prompt} (0 = ${low}, 10 = ${high})`}>
            {Array.from({ length: 11 }, (_, score) => (
              <button key={score} type="button" role="radio" aria-checked={value === score} className={`${value === score ? "selected" : ""} band-${enpsBand(score)}`}
                onClick={() => onChange(score)}><b>{score}</b></button>
            ))}
          </div>
          <div className="eg-enps-ends" aria-hidden="true"><span>0 · {low}</span><span>{high} · 10</span></div>
        </div>
      );
    }
    case "SINGLE_CHOICE": case "MULTI_CHOICE": {
      const multiple = question.type === "MULTI_CHOICE";
      const selected = Array.isArray(value) ? value : [];
      const options = question.options.filter(Boolean);
      return (
        <div className="eg-choices" role={multiple ? "group" : "radiogroup"} aria-label={question.prompt}>
          {(options.length ? options : preview ? ["Option 1", "Option 2"] : []).map((option, index) => {
            const on = selected.includes(option);
            return (
              <button key={`${option}-${index}`} type="button" role={multiple ? "checkbox" : "radio"} aria-checked={on} className={on ? "selected" : ""}
                onClick={() => onChange(multiple ? (on ? selected.filter((item) => item !== option) : [...selected, option]) : on && !question.required ? [] : [option])}>
                <i className={multiple ? "box" : "dot"}>{on && <Check size={12} strokeWidth={3} />}</i>
                <span>{option}</span>
                {index < 9 && <kbd aria-hidden="true">{String.fromCharCode(65 + index)}</kbd>}
              </button>
            );
          })}
        </div>
      );
    }
    case "SHORT_TEXT": {
      const text = typeof value === "string" ? value : "";
      return (
        <label className="eg-text">
          <span className="sr-only">{question.prompt}</span>
          <input id={name} value={text} maxLength={280} placeholder="Type your answer" onChange={(event) => onChange(event.target.value)} />
          <small>{text.length}/280</small>
        </label>
      );
    }
    case "LONG_TEXT": {
      const text = typeof value === "string" ? value : "";
      return (
        <label className="eg-text">
          <span className="sr-only">{question.prompt}</span>
          <textarea id={name} value={text} maxLength={4000} rows={6} placeholder="Share as much or as little as you like" onChange={(event) => onChange(event.target.value)} />
          <small>{text.length.toLocaleString("en-IN")}/4,000</small>
        </label>
      );
    }
  }
}

/** Short human summary of an answer, for review screens. */
export function answerSummary(question: Pick<Question, "type" | "scaleLabels">, value: AnswerValue) {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length) || (typeof value === "string" && !value.trim())) return "Skipped";
  if (question.type === "RATING") return `${value} · ${question.scaleLabels[Number(value) - 1] || ""}`;
  if (question.type === "ENPS") return `${value} / 10`;
  if (Array.isArray(value)) return value.join(", ");
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
