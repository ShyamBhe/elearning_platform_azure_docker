import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ErrorNote } from "../components";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login(email, password);
      else await register(email, name, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-narrow" onSubmit={submit}>
      <h1>{isLogin ? "Sign in" : "Create your account"}</h1>
      {error && <ErrorNote message={error} />}
      {!isLogin && (
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required minLength={isLogin ? 1 : 8} maxLength={64}
          autoComplete={isLogin ? "current-password" : "new-password"}
        />
        {!isLogin && <span className="muted small">At least 8 characters.</span>}
      </div>
      <p style={{ marginTop: "1.25rem" }}>
        <button className="btn" disabled={busy}>{isLogin ? "Sign in" : "Create account"}</button>
      </p>
      <p className="muted small">
        {isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Already registered? <Link to="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
