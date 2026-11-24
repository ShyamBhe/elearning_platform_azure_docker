export type Role = "student" | "instructor" | "admin";
export type Level = "beginner" | "intermediate" | "advanced";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  level: Level;
  is_published: boolean;
  instructor_id: number;
  instructor_name: string;
  lesson_count: number;
  enrolled: boolean;
  created_at: string;
}

export interface LessonOutline {
  id: number;
  title: string;
  kind: "video" | "reading";
  position: number;
}
export interface ModuleT {
  id: number;
  title: string;
  position: number;
  lessons: LessonOutline[];
}
export interface QuizSummary {
  id: number;
  title: string;
  pass_mark: number;
}
export interface CourseDetail extends Course {
  modules: ModuleT[];
  quizzes: QuizSummary[];
}
export interface Lesson {
  id: number;
  module_id: number;
  title: string;
  kind: "video" | "reading";
  video_url: string | null;
  body: string;
  resource_url: string | null;
  position: number;
}

export interface Choice {
  id: number;
  text: string;
  is_correct: boolean | null;
}
export interface Question {
  id: number;
  text: string;
  choices: Choice[];
}
export interface Quiz {
  id: number;
  course_id: number;
  title: string;
  pass_mark: number;
  questions: Question[];
}
export interface Attempt {
  id: number;
  quiz_id: number;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  created_at: string;
}
export interface AttemptReview {
  attempt: Attempt;
  correct_choice_ids: Record<string, number>;
}
export interface QuizDraft {
  title: string;
  pass_mark: number;
  questions: { text: string; choices: { text: string; is_correct: boolean }[] }[];
}

export interface QuizProgress {
  quiz_id: number;
  title: string;
  attempts: number;
  best_percent: number | null;
  passed: boolean;
}
export interface CourseProgress {
  course_id: number;
  title: string;
  total_lessons: number;
  completed_lessons: number;
  percent: number;
  completed_lesson_ids: number[];
  quizzes: QuizProgress[];
}

export interface AdminStats {
  users: number;
  students: number;
  instructors: number;
  admins: number;
  courses: number;
  published_courses: number;
  enrollments: number;
  lessons_completed: number;
  quiz_attempts: number;
  quiz_pass_rate: number;
  top_courses: { course_id: number; title: string; enrollments: number }[];
  recent_users: User[];
}
