import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { AttemptReview, Quiz } from "../types";

export default function QuizPage() {
  const { quizId } = useParams();
  const { data: quiz, error, loading } = useLoad(() => api.get<Quiz>(`/quizzes/${quizId}`), [quizId]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !quiz) return <Loading />;
  if (error || !quiz) return <ErrorNote message={error ?? "Quiz not found"} />;

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    setBusy(true);
    setSubmitError(null);
    try {
      setReview(await api.post<AttemptReview>(`/quizzes/${quiz!.id}/attempts`, { answers }));
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAnswers({});
    setReview(null);
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <p><Link to={`/learn/${quiz.course_id}`}>Back to course</Link></p>
      <h1>{quiz.title}</h1>
      <p className="muted">Pass mark: {quiz.pass_mark}%</p>

      {review && (
        <div className={`notice ${review.attempt.passed ? "ok" : "error"}`} role="status">
          You scored {review.attempt.score} of {review.attempt.total} ({review.attempt.percent}%).{" "}
          {review.attempt.passed ? "You passed." : "You did not reach the pass mark yet."}{" "}
          <button className="btn small ghost" onClick={retry}>Try again</button>
        </div>
      )}

      {quiz.questions.map((q, i) => (
        <fieldset key={q.id} className="card">
          <legend><b>Question {i + 1}</b></legend>
          <p>{q.text}</p>
          {q.choices.map((c) => {
            const correctId = review?.correct_choice_ids[String(q.id)];
            const picked = answers[q.id] === c.id;
            const cls = review ? (c.id === correctId ? "right" : picked ? "wrong" : "") : picked ? "picked" : "";
            return (
              <label key={c.id} className={`choice ${cls}`}>
                <input
                  type="radio" name={`q${q.id}`} checked={picked} disabled={!!review}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                />
                <span>{c.text}</span>
              </label>
            );
          })}
        </fieldset>
      ))}

      {submitError && <ErrorNote message={submitError} />}
      {!review && (
        <div>
          <button className="btn" onClick={submit} disabled={!allAnswered || busy}>Submit answers</button>
          {!allAnswered && <span className="muted small"> Answer every question to submit.</span>}
        </div>
      )}
    </div>
  );
}
