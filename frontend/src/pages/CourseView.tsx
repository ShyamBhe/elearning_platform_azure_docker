import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { CourseDetail } from "../types";

export default function CourseView() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: c, error, loading, reload } = useLoad(() => api.get<CourseDetail>(`/courses/${courseId}`), [courseId, user?.id]);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !c) return <Loading />;
  if (error || !c) return <ErrorNote message={error ?? "Course not found"} />;

  const firstLesson = c.modules.flatMap((m) => m.lessons)[0];

  async function enroll() {
    if (!user) return navigate("/login");
    try {
      await api.post(`/courses/${c!.id}/enroll`);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div>
        <span className="pill">{c.level}</span> {!c.is_published && <span className="pill warn">Draft</span>}
        <h1 style={{ marginTop: ".5rem" }}>{c.title}</h1>
        <p className="muted">By {c.instructor_name}</p>
        <p>{c.description}</p>
        {actionError && <ErrorNote message={actionError} />}
        {c.enrolled && firstLesson ? (
          <Link className="btn" to={`/learn/${c.id}`}>Continue learning</Link>
        ) : (
          c.is_published && <button className="btn" onClick={enroll}>Enroll for free</button>
        )}
      </div>

      <section className="card">
        <h2>What you will learn</h2>
        {c.modules.length === 0 && <p className="muted">This course has no lessons yet.</p>}
        {c.modules.map((m) => (
          <div key={m.id}>
            <h3>{m.title}</h3>
            <ul>
              {m.lessons.map((l) => (
                <li key={l.id}>{l.title} <span className="muted small">({l.kind})</span></li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {c.quizzes.length > 0 && (
        <section className="card">
          <h2>Quizzes</h2>
          <ul>
            {c.quizzes.map((q) => (
              <li key={q.id}>{q.title} <span className="muted small">(pass mark {q.pass_mark}%)</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
