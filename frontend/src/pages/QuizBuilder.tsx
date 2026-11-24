import { useState } from "react";
import { ErrorNote } from "../components";
import type { QuizDraft } from "../types";

const blankQuestion = () => ({
  text: "",
  choices: [{ text: "", is_correct: true }, { text: "", is_correct: false }],
});

export default function QuizBuilder({
  initial, onSave, onCancel,
}: {
  initial?: QuizDraft;
  onSave: (q: QuizDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [quiz, setQuiz] = useState<QuizDraft>(initial ?? { title: "", pass_mark: 70, questions: [blankQuestion()] });
  const [error, setError] = useState<string | null>(null);

  const setQuestion = (qi: number, patch: Partial<QuizDraft["questions"][number]>) =>
    setQuiz((s) => ({ ...s, questions: s.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) }));

  async function save() {
    setError(null);
    try {
      await onSave(quiz);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card stack">
      {error && <ErrorNote message={error} />}
      <div className="row">
        <div style={{ flex: 3, minWidth: 220 }}>
          <label htmlFor="qt">Quiz title</label>
          <input id="qt" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="pm">Pass mark (%)</label>
          <input id="pm" type="number" min={1} max={100} value={quiz.pass_mark}
            onChange={(e) => setQuiz({ ...quiz, pass_mark: Number(e.target.value) })} />
        </div>
      </div>

      {quiz.questions.map((q, qi) => (
        <fieldset key={qi} className="card">
          <legend><b>Question {qi + 1}</b></legend>
          <label htmlFor={`q${qi}`}>Question text</label>
          <textarea id={`q${qi}`} style={{ minHeight: 60 }} value={q.text} onChange={(e) => setQuestion(qi, { text: e.target.value })} />
          <p className="muted small" style={{ margin: ".75rem 0 .25rem" }}>Choices. Select the one correct answer.</p>
          {q.choices.map((c, ci) => (
            <div className="row" key={ci} style={{ marginBottom: ".4rem", flexWrap: "nowrap" }}>
              <input type="radio" name={`correct${qi}`} checked={c.is_correct} aria-label={`Choice ${ci + 1} is correct`}
                onChange={() => setQuestion(qi, { choices: q.choices.map((x, i) => ({ ...x, is_correct: i === ci })) })} />
              <input value={c.text} aria-label={`Choice ${ci + 1} text`}
                onChange={(e) => setQuestion(qi, { choices: q.choices.map((x, i) => (i === ci ? { ...x, text: e.target.value } : x)) })} />
              {q.choices.length > 2 && (
                <button type="button" className="btn danger small"
                  onClick={() => setQuestion(qi, { choices: q.choices.filter((_, i) => i !== ci).map((x, i, arr) => (arr.some((y) => y.is_correct) ? x : { ...x, is_correct: i === 0 })) })}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="row">
            {q.choices.length < 8 && (
              <button type="button" className="btn ghost small"
                onClick={() => setQuestion(qi, { choices: [...q.choices, { text: "", is_correct: false }] })}>Add choice</button>
            )}
            {quiz.questions.length > 1 && (
              <button type="button" className="btn danger small"
                onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== qi) })}>Remove question</button>
            )}
          </div>
        </fieldset>
      ))}

      <div className="row">
        <button type="button" className="btn ghost" onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}>Add question</button>
        <button type="button" className="btn" onClick={save}>Save quiz</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
