import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorNote, Loading, ProgressBar, VideoPlayer } from "../components";
import { useLoad } from "../hooks";
import type { CourseDetail, CourseProgress, Lesson } from "../types";

export default function Learn() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const course = useLoad(() => api.get<CourseDetail>(`/courses/${courseId}`), [courseId]);
  const progress = useLoad(() => api.get<CourseProgress>(`/progress/courses/${courseId}`), [courseId]);
  const [busy, setBusy] = useState(false);

  const lessons = course.data?.modules.flatMap((m) => m.lessons) ?? [];
  const activeId = lessonId ? Number(lessonId) : lessons[0]?.id;
  const lesson = useLoad(
    () => (activeId ? api.get<Lesson>(`/lessons/${activeId}`) : Promise.resolve(null)),
    [activeId],
  );

  if (course.loading && !course.data) return <Loading />;
  if (course.error || !course.data) return <ErrorNote message={course.error ?? "Course not found"} />;
  const c = course.data;
  const done = new Set(progress.data?.completed_lesson_ids ?? []);
  const index = lessons.findIndex((l) => l.id === activeId);
  const next = lessons[index + 1];
  const isDone = activeId !== undefined && done.has(activeId);

  async function toggleDone() {
    if (!activeId) return;
    setBusy(true);
    try {
      if (isDone) await api.del(`/lessons/${activeId}/complete`);
      else {
        await api.post(`/lessons/${activeId}/complete`);
        if (next) navigate(`/learn/${c.id}/${next.id}`);
      }
      progress.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learn">
      <aside className="card outline" aria-label="Course outline">
        <h2 style={{ fontSize: "1.1rem" }}>{c.title}</h2>
        <ProgressBar percent={progress.data?.percent ?? 0} />
        <p className="muted small">{progress.data?.completed_lessons ?? 0} of {progress.data?.total_lessons ?? 0} lessons done</p>
        {c.modules.map((m) => (
          <div key={m.id}>
            <h3>{m.title}</h3>
            <ul>
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link to={`/learn/${c.id}/${l.id}`} className={l.id === activeId ? "current" : ""} aria-current={l.id === activeId ? "page" : undefined}>
                    <span className={`tick ${done.has(l.id) ? "done" : ""}`} aria-label={done.has(l.id) ? "Completed" : "Not completed"} />
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {c.quizzes.length > 0 && <h3>Quizzes</h3>}
        <ul>
          {progress.data?.quizzes.map((q) => (
            <li key={q.quiz_id}>
              <Link to={`/quizzes/${q.quiz_id}`}>
                <span className={`tick ${q.passed ? "done" : ""}`} />
                {q.title} {q.best_percent !== null && <span className="muted small">best {q.best_percent}%</span>}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="stack">
        {lessons.length === 0 && <p className="notice">This course has no lessons yet.</p>}
        {lesson.error && <ErrorNote message={lesson.error} />}
        {lesson.data && (
          <>
            <h1>{lesson.data.title}</h1>
            {lesson.data.video_url && <VideoPlayer url={lesson.data.video_url} />}
            {lesson.data.body && <div className="lesson-body">{lesson.data.body}</div>}
            {lesson.data.resource_url && (
              <p>
                <a className="btn ghost" href={lesson.data.resource_url} target="_blank" rel="noreferrer">Download learning material</a>
              </p>
            )}
            <div className="row">
              <button className="btn" onClick={toggleDone} disabled={busy}>
                {isDone ? "Mark as not done" : next ? "Mark done and continue" : "Mark done"}
              </button>
              {next && isDone && <Link className="btn ghost" to={`/learn/${c.id}/${next.id}`}>Next lesson</Link>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
