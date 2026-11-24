import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Empty, ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { Course, Level } from "../types";

export default function Teach() {
  const navigate = useNavigate();
  const { data, error, loading } = useLoad(() => api.get<Course[]>("/courses?manage=true"), []);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const course = await api.post<Course>("/courses", { title, level });
      navigate(`/teach/${course.id}`);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <h1>Teach</h1>
      <form className="card" onSubmit={create}>
        <h2>New course</h2>
        {formError && <ErrorNote message={formError} />}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label htmlFor="title">Course title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="level">Level</label>
            <select id="level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <button className="btn">Create course</button>
        </div>
      </form>

      <h2>Your courses</h2>
      {loading && !data && <Loading />}
      {error && <ErrorNote message={error} />}
      {data?.length === 0 && <Empty>No courses yet. Create your first one above.</Empty>}
      {data && data.length > 0 && (
        <div className="card">
          <table>
            <thead><tr><th>Title</th><th>Level</th><th>Lessons</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>{c.level}</td>
                  <td>{c.lesson_count}</td>
                  <td><span className={`pill ${c.is_published ? "ok" : "warn"}`}>{c.is_published ? "Published" : "Draft"}</span></td>
                  <td><Link to={`/teach/${c.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
