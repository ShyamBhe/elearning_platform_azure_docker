import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { AdminStats, Course, Role, User } from "../types";

export default function Admin() {
  const [tab, setTab] = useState<"overview" | "users" | "courses">("overview");
  return (
    <div className="stack">
      <h1>Admin dashboard</h1>
      <div className="tabs" role="tablist">
        {(["overview", "users", "courses"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "courses" && <Courses />}
    </div>
  );
}

function Overview() {
  const { data: s, error, loading } = useLoad(() => api.get<AdminStats>("/admin/stats"), []);
  if (loading && !s) return <Loading />;
  if (error || !s) return <ErrorNote message={error ?? "Could not load stats"} />;
  const cards: [string, number | string][] = [
    ["Users", s.users], ["Students", s.students], ["Instructors", s.instructors],
    ["Courses", `${s.published_courses}/${s.courses}`], ["Enrollments", s.enrollments],
    ["Lessons completed", s.lessons_completed], ["Quiz attempts", s.quiz_attempts], ["Quiz pass rate", `${s.quiz_pass_rate}%`],
  ];
  return (
    <div className="stack">
      <div className="stats">
        {cards.map(([label, value]) => (
          <div key={label} className="card stat"><b>{value}</b><span className="muted small">{label}{label === "Courses" ? " (published/total)" : ""}</span></div>
        ))}
      </div>
      <div className="grid">
        <section className="card">
          <h2>Most popular courses</h2>
          {s.top_courses.length === 0 ? <p className="muted">No courses yet.</p> : (
            <table><tbody>
              {s.top_courses.map((c) => <tr key={c.course_id}><td><Link to={`/courses/${c.course_id}`}>{c.title}</Link></td><td>{c.enrollments} enrolled</td></tr>)}
            </tbody></table>
          )}
        </section>
        <section className="card">
          <h2>Newest users</h2>
          <table><tbody>
            {s.recent_users.map((u) => <tr key={u.id}><td>{u.full_name}</td><td className="muted small">{u.role}</td></tr>)}
          </tbody></table>
        </section>
      </div>
    </div>
  );
}

function Users() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api.get<User[]>("/admin/users"), []);
  const [err, setErr] = useState<string | null>(null);

  async function patch(id: number, body: { role?: Role; is_active?: boolean }) {
    setErr(null);
    try { await api.patch(`/admin/users/${id}`, body); reload(); } catch (e) { setErr((e as Error).message); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      {err && <ErrorNote message={err} />}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>
                <select aria-label={`Role for ${u.full_name}`} value={u.role} disabled={u.id === me?.id}
                  onChange={(e) => patch(u.id, { role: e.target.value as Role })}>
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>
                <button className={`btn small ${u.is_active ? "danger" : "ghost"}`} disabled={u.id === me?.id}
                  onClick={() => patch(u.id, { is_active: !u.is_active })}>
                  {u.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
              <td className="muted small">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Courses() {
  const { data, error, loading, reload } = useLoad(() => api.get<Course[]>("/courses?manage=true"), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table>
        <thead><tr><th>Title</th><th>Instructor</th><th>Lessons</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td><td>{c.instructor_name}</td><td>{c.lesson_count}</td>
              <td>
                <button className="btn ghost small"
                  onClick={async () => { await api.put(`/courses/${c.id}`, { is_published: !c.is_published }); reload(); }}>
                  {c.is_published ? "Unpublish" : "Publish"}
                </button>
              </td>
              <td><Link to={`/teach/${c.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
