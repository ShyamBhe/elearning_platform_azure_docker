import { Route, Routes } from "react-router-dom";
import { Layout, RequireAuth } from "./components";
import AuthPage from "./pages/AuthPage";
import Catalog from "./pages/Catalog";
import CourseView from "./pages/CourseView";
import Learn from "./pages/Learn";
import QuizPage from "./pages/QuizPage";
import MyLearning from "./pages/MyLearning";
import Teach from "./pages/Teach";
import CourseEditor from "./pages/CourseEditor";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="courses/:courseId" element={<CourseView />} />
        <Route path="learn/:courseId/:lessonId?" element={<RequireAuth><Learn /></RequireAuth>} />
        <Route path="quizzes/:quizId" element={<RequireAuth><QuizPage /></RequireAuth>} />
        <Route path="my" element={<RequireAuth><MyLearning /></RequireAuth>} />
        <Route path="teach" element={<RequireAuth roles={["instructor", "admin"]}><Teach /></RequireAuth>} />
        <Route path="teach/:courseId" element={<RequireAuth roles={["instructor", "admin"]}><CourseEditor /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth roles={["admin"]}><Admin /></RequireAuth>} />
        <Route path="*" element={<p>Page not found.</p>} />
      </Route>
    </Routes>
  );
}
