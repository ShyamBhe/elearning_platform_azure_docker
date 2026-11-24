import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import type { Role } from "./types";

export function Layout() {
  const { user, logout } = useAuth();
  const staff = user?.role === "instructor" || user?.role === "admin";
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand">
            Course<b>way</b>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Courses</NavLink>
            {user && <NavLink to="/my">My learning</NavLink>}
            {staff && <NavLink to="/teach">Teach</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="who">
            {user ? (
              <>
                <span>{user.full_name}</span>
                <button className="btn ghost small" onClick={logout}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <Link to="/register" className="btn small">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export const Loading = () => <p className="muted" role="status">Loading…</p>;
export const ErrorNote = ({ message }: { message: string }) => <p className="notice error" role="alert">{message}</p>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Turns a YouTube / Vimeo / direct-file URL into a player. Anything else becomes a link. */
export function VideoPlayer({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (yt) {
    return (
      <div className="video">
        <iframe src={`https://www.youtube-nocookie.com/embed/${yt[1]}`} title="Lesson video" allowFullScreen />
      </div>
    );
  }
  if (vimeo) {
    return (
      <div className="video">
        <iframe src={`https://player.vimeo.com/video/${vimeo[1]}`} title="Lesson video" allowFullScreen />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return (
      <div className="video">
        <video src={url} controls />
      </div>
    );
  }
  return (
    <p>
      <a href={url} target="_blank" rel="noreferrer">Open the video in a new tab</a>
    </p>
  );
}
