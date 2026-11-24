import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorNote, Loading } from "../components";
import { useLoad } from "../hooks";
import type { CourseDetail, Level, Lesson, Quiz, QuizDraft } from "../types";
import QuizBuilder from "./QuizBuilder";

type Tab = "details" | "content" | "quizzes";

export default function CourseEditor() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: c, error, loading, reload } = useLoad(() => api.get<CourseDetail>(`/courses/${courseId}`), [courseId]);
  const [tab, setTab] = useState<Tab>("details");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading && !c) return <Loading />;
  if (error || !c) return <ErrorNote message={error ?? "Course not found"} />;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <p><Link to="/teach">All courses</Link></p>
      <div className="row between">
        <h1>{c.title}</h1>
        <span className={`pill ${c.is_published ? "ok" : "warn"}`}>{c.is_published ? "Published" : "Draft"}</span>
      </div>
      {msg && <p className="notice ok" role="status">{msg}</p>}
      {err && <ErrorNote message={err} />}

      <div className="tabs" role="tablist">
        {(["details", "content", "quizzes"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === "details" ? "Details" : t === "content" ? "Lessons" : "Quizzes"}
          </button>
        ))}
      </div>

      {tab === "details" && <Details c={c} run={run} onDeleted={() => navigate("/teach")} />}
      {tab === "content" && <Content c={c} run={run} />}
      {tab === "quizzes" && <Quizzes c={c} run={run} />}
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

function Details({ c, run, onDeleted }: { c: CourseDetail; run: Run; onDeleted: () => void }) {
  const [title, setTitle] = useState(c.title);
  const [description, setDescription] = useState(c.description);
  const [level, setLevel] = useState<Level>(c.level);
  useEffect(() => { setTitle(c.title); setDescription(c.description); setLevel(c.level); }, [c]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.put(`/courses/${c.id}`, { title, description, level }), "Course details saved.");
  };

  return (
    <form className="card" onSubmit={save}>
      <div className="field">
        <label htmlFor="t">Title</label>
        <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="d">Description</label>
        <textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="l">Level</label>
        <select id="l" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div className="row" style={{ marginTop: "1.25rem" }}>
        <button className="btn">Save details</button>
        <button type="button" className="btn ghost"
          onClick={() => run(() => api.put(`/courses/${c.id}`, { is_published: !c.is_published }), c.is_published ? "Course unpublished." : "Course published.")}>
          {c.is_published ? "Unpublish" : "Publish"}
        </button>
        <Link className="btn ghost" to={`/courses/${c.id}`}>Preview</Link>
        <button type="button" className="btn danger"
          onClick={() => { if (confirm("Delete this course and all of its content? This cannot be undone.")) void run(async () => { await api.del(`/courses/${c.id}`); onDeleted(); }); }}>
          Delete course
        </button>
      </div>
    </form>
  );
}

function LessonForm({ initial, onSave, onCancel }: {
  initial?: Lesson;
  onSave: (v: { title: string; kind: "video" | "reading"; video_url: string | null; body: string; resource_url: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<"video" | "reading">(initial?.kind ?? "reading");
  const [video, setVideo] = useState(initial?.video_url ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [resource, setResource] = useState(initial?.resource_url ?? "");

  return (
    <form className="card indent" onSubmit={(e) => { e.preventDefault(); void onSave({ title, kind, video_url: video || null, body, resource_url: resource || null }); }}>
      <div className="field">
        <label htmlFor="lt">Lesson title</label>
        <input id="lt" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="lk">Type</label>
        <select id="lk" value={kind} onChange={(e) => setKind(e.target.value as "video" | "reading")}>
          <option value="reading">Reading</option>
          <option value="video">Video</option>
        </select>
      </div>
      {kind === "video" && (
        <div className="field">
          <label htmlFor="lv">Video link (YouTube, Vimeo or .mp4)</label>
          <input id="lv" type="url" value={video} onChange={(e) => setVideo(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="lb">Lesson text</label>
        <textarea id="lb" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="lr">Learning material link (optional)</label>
        <input id="lr" type="url" value={resource} onChange={(e) => setResource(e.target.value)} placeholder="https://…/slides.pdf" />
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn small">Save lesson</button>
        <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Content({ c, run }: { c: CourseDetail; run: Run }) {
  const [moduleTitle, setModuleTitle] = useState("");
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);

  async function openEdit(id: number) {
    await run(async () => setEditing(await api.get<Lesson>(`/lessons/${id}`)));
    setAddingTo(null);
  }

  return (
    <div className="stack">
      {c.modules.length === 0 && <p className="empty">Add a module to start building the course.</p>}
      {c.modules.map((m) => (
        <section key={m.id} className="editor-module">
          <div className="row between">
            <h3>{m.title}</h3>
            <div className="row">
              <button className="btn ghost small" onClick={() => { const t = prompt("Rename module", m.title); if (t) void run(() => api.put(`/modules/${m.id}`, { title: t }), "Module renamed."); }}>Rename</button>
              <button className="btn danger small" onClick={() => { if (confirm(`Delete module "${m.title}" and its lessons?`)) void run(() => api.del(`/modules/${m.id}`)); }}>Delete</button>
            </div>
          </div>
          <ul>
            {m.lessons.map((l) => (
              <li key={l.id}>
                {l.title} <span className="muted small">({l.kind})</span>{" "}
                <button className="btn ghost small" onClick={() => openEdit(l.id)}>Edit</button>{" "}
                <button className="btn danger small" onClick={() => { if (confirm(`Delete lesson "${l.title}"?`)) void run(() => api.del(`/lessons/${l.id}`)); }}>Delete</button>
              </li>
            ))}
          </ul>
          {editing && editing.module_id === m.id && (
            <LessonForm key={editing.id} initial={editing} onCancel={() => setEditing(null)}
              onSave={async (v) => { await run(() => api.put(`/lessons/${editing.id}`, v), "Lesson saved."); setEditing(null); }} />
          )}
          {addingTo === m.id ? (
            <LessonForm onCancel={() => setAddingTo(null)}
              onSave={async (v) => { await run(() => api.post(`/modules/${m.id}/lessons`, v), "Lesson added."); setAddingTo(null); }} />
          ) : (
            <button className="btn ghost small" onClick={() => { setAddingTo(m.id); setEditing(null); }}>Add lesson</button>
          )}
        </section>
      ))}

      <form className="card" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.post(`/courses/${c.id}/modules`, { title: moduleTitle }); setModuleTitle(""); }, "Module added."); }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="mt">New module title</label>
            <input id="mt" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} required />
          </div>
          <button className="btn">Add module</button>
        </div>
      </form>
    </div>
  );
}

function Quizzes({ c, run }: { c: CourseDetail; run: Run }) {
  const [mode, setMode] = useState<"list" | "new" | { edit: Quiz }>("list");

  async function startEdit(id: number) {
    await run(async () => setMode({ edit: await api.get<Quiz>(`/quizzes/${id}`) }));
  }

  if (mode !== "list") {
    const editing = mode === "new" ? null : mode.edit;
    return (
      <QuizBuilder
        initial={editing ? {
          title: editing.title, pass_mark: editing.pass_mark,
          questions: editing.questions.map((q) => ({ text: q.text, choices: q.choices.map((ch) => ({ text: ch.text, is_correct: !!ch.is_correct })) })),
        } : undefined}
        onCancel={() => setMode("list")}
        onSave={async (draft: QuizDraft) => {
          if (editing) await api.put(`/quizzes/${editing.id}`, draft);
          else await api.post(`/courses/${c.id}/quizzes`, draft);
          setMode("list");
          await run(async () => undefined, "Quiz saved.");
        }}
      />
    );
  }

  return (
    <div className="stack">
      {c.quizzes.length === 0 && <p className="empty">No quizzes yet.</p>}
      {c.quizzes.map((q) => (
        <div key={q.id} className="card row between">
          <span>{q.title} <span className="muted small">(pass mark {q.pass_mark}%)</span></span>
          <span className="row">
            <button className="btn ghost small" onClick={() => startEdit(q.id)}>Edit</button>
            <button className="btn danger small" onClick={() => { if (confirm(`Delete quiz "${q.title}" and all attempts?`)) void run(() => api.del(`/quizzes/${q.id}`)); }}>Delete</button>
          </span>
        </div>
      ))}
      <button className="btn" onClick={() => setMode("new")}>New quiz</button>
    </div>
  );
}
