import { Link } from "react-router-dom";
import { api } from "../api";
import { Empty, ErrorNote, Loading, ProgressBar } from "../components";
import { useLoad } from "../hooks";
import type { CourseProgress } from "../types";

export default function MyLearning() {
  const { data, error, loading } = useLoad(() => api.get<CourseProgress[]>("/progress/me"), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div className="stack">
      <h1>My learning</h1>
      {data?.length === 0 && (
        <Empty>You have not enrolled in a course yet. <Link to="/">Browse courses</Link></Empty>
      )}
      <div className="grid">
        {data?.map((p) => (
          <article key={p.course_id} className="card stack">
            <h3>{p.title}</h3>
            <ProgressBar percent={p.percent} />
            <p className="muted small" style={{ margin: 0 }}>
              {p.completed_lessons} of {p.total_lessons} lessons · {p.percent}%
            </p>
            {p.quizzes.map((q) => (
              <p key={q.quiz_id} className="small" style={{ margin: 0 }}>
                {q.title}:{" "}
                {q.best_percent === null ? <span className="muted">not attempted</span> : (
                  <span className={`pill ${q.passed ? "ok" : "warn"}`}>best {q.best_percent}%{q.passed ? " · passed" : ""}</span>
                )}
              </p>
            ))}
            <Link className="btn" to={`/learn/${p.course_id}`}>{p.percent === 100 ? "Review course" : "Continue"}</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
