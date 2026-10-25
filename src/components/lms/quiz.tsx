"use client";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Send, Trophy, XCircle } from "lucide-react";
import { useState } from "react";
import { errorText, lmsApi, type AttemptResult, type LessonContent } from "./lms-api";

export function Quiz({ lesson, onResult }: { lesson: LessonContent; onResult: (result: AttemptResult) => void }) {
  const questions = lesson.questions || [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = result || lesson.quiz!;
  const answered = questions.filter((question) => answers[question.id]?.length).length;

  const toggle = (questionId: string, optionId: string, multi: boolean) => {
    if (result) return;
    setAnswers((current) => {
      const picked = current[questionId] || [];
      const next = multi ? (picked.includes(optionId) ? picked.filter((id) => id !== optionId) : [...picked, optionId]) : [optionId];
      return { ...current, [questionId]: next };
    });
  };
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const graded = await lmsApi.attempt(lesson.courseId, lesson.id, answers);
      setResult(graded); onResult(graded);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const retry = () => { setResult(null); setAnswers({}); };

  if (lesson.preview) return (
    <div className="lms-quiz">
      <p className="cw-alert warn"><AlertTriangle size={15} /> Preview — learners see these questions without answers. Submitting is disabled while you are not enrolled.</p>
      {questions.map((question, index) => <QuestionCard key={question.id} index={index} question={question} picked={[]} onPick={() => {}} disabled />)}
    </div>
  );

  if (!result && state.passed) return (
    <div className="lms-quiz-summary pass"><Trophy size={28} /><div><b>You passed this quiz</b><p>Best score {state.bestScore}% · pass mark {lesson.passMark}%.</p></div></div>
  );
  if (!result && state.locked) return (
    <div className="lms-quiz-summary fail"><XCircle size={28} /><div><b>No attempts left</b><p>Best score {state.bestScore ?? 0}% (pass mark {lesson.passMark}%). Ask your manager or HR to reset your attempts.</p></div></div>
  );

  return (
    <div className="lms-quiz">
      {result ? (
        <div className={`lms-quiz-summary ${result.passed ? "pass" : "fail"}`} role="status">
          {result.passed ? <Trophy size={28} /> : <XCircle size={28} />}
          <div>
            <b>{result.passed ? "Passed — nicely done!" : "Not quite there yet"}</b>
            <p>You scored <strong>{result.score}%</strong> ({result.correctCount} of {result.total} correct). Pass mark is {result.passMark}%.
              {!result.passed && (result.locked ? " You have used every attempt — ask your manager or HR to reset the quiz." : result.attemptsLeft !== null ? ` ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.` : " You can try again.")}</p>
          </div>
          {!result.passed && !result.locked && <button className="cw-btn primary" onClick={retry}><RotateCcw size={15} /> Try again</button>}
        </div>
      ) : (
        <div className="lms-quiz-intro">
          <span><b>{questions.length}</b> questions</span>
          <span><b>{lesson.passMark}%</b> to pass</span>
          <span><b>{lesson.maxAttempts ? `${state.attemptsLeft} of ${lesson.maxAttempts}` : "Unlimited"}</b> attempts{lesson.maxAttempts ? " left" : ""}</span>
          {state.bestScore !== null && <span><b>{state.bestScore}%</b> best so far</span>}
        </div>
      )}
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {questions.map((question, index) => {
        const graded = result?.results.find((item) => item.questionId === question.id);
        return <QuestionCard key={question.id} index={index} question={question} picked={graded?.picked || answers[question.id] || []}
          onPick={(optionId) => toggle(question.id, optionId, question.kind === "MULTI")} disabled={!!result} graded={graded} />;
      })}
      {!result && (
        <div className="lms-quiz-foot">
          <span>{answered} of {questions.length} answered</span>
          <button className="cw-btn primary lg" onClick={submit} disabled={busy || answered < questions.length}>
            {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Submit answers
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, index, picked, onPick, disabled, graded }: {
  question: NonNullable<LessonContent["questions"]>[number]; index: number; picked: string[]; onPick: (id: string) => void; disabled: boolean;
  graded?: AttemptResult["results"][number];
}) {
  const multi = question.kind === "MULTI";
  const name = `q-${question.id}`;
  return (
    <fieldset className={`lms-question ${graded ? (graded.correct ? "right" : "wrong") : ""}`}>
      <legend>
        <span className="lms-q-num">{index + 1}</span>
        <span>{question.prompt}{multi && <small> Select all that apply</small>}</span>
        {graded && (graded.correct ? <CheckCircle2 size={20} className="lms-q-mark right" aria-label="Correct" /> : <XCircle size={20} className="lms-q-mark wrong" aria-label="Incorrect" />)}
      </legend>
      <div className="lms-options">
        {question.options.map((option) => {
          const checked = picked.includes(option.id);
          const isCorrect = graded?.correctOptions?.includes(option.id);
          const cls = [checked ? "checked" : "", graded && isCorrect ? "correct" : "", graded && checked && graded.correctOptions && !isCorrect ? "incorrect" : ""].join(" ");
          return (
            <label key={option.id} className={`lms-option ${cls}`}>
              <input type={multi ? "checkbox" : "radio"} name={name} checked={checked} disabled={disabled} onChange={() => onPick(option.id)} />
              <span>{option.text}</span>
              {graded && isCorrect && <small>Correct answer</small>}
            </label>
          );
        })}
      </div>
      {graded && (graded.explanation || !graded.correct) && (
        <p className="lms-explain">{graded.explanation || (graded.correctOptions ? "Compare your choice with the highlighted answer." : "Review the lessons and try again — answers are revealed once you pass or run out of attempts.")}</p>
      )}
    </fieldset>
  );
}
