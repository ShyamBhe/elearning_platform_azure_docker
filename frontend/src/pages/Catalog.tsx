import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { Course } from "../types";

export default function Catalog() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data, error, loading } = useLoad(
    () => api.get<Course[]>(`/courses${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    [q, user?.id],
  );

  return (
    <div className="stack">
      <div className="row between">
        <h1>Courses</h1>
        <div style={{ minWidth: 260 }}>
          <label htmlFor="search" className="muted small">Search courses</label>
          <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Python" />
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty>No courses match yet. Check back soon.</Empty>}
      <div className="grid">
        {data?.map((c) => (
          <article key={c.id} className="card course-card">
            <span className="pill" style={{ alignSelf: "flex-start" }}>{c.level}</span>
            <h3><Link to={`/courses/${c.id}`}>{c.title}</Link></h3>
            <p className="muted small" style={{ margin: 0 }}>
              {c.description.slice(0, 120)}{c.description.length > 120 ? "…" : ""}
            </p>
            <div className="push muted small">
              {c.instructor_name} · {c.lesson_count} lessons {c.enrolled && <span className="pill ok">Enrolled</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
