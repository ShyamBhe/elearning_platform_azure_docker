from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Level = Literal["beginner", "intermediate", "advanced"]
LessonKind = Literal["video", "reading"]
Role = Literal["student", "instructor", "admin"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=64)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserAdminUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


# ---------- courses / content ----------
class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    level: Level = "beginner"


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    level: Level | None = None
    is_published: bool | None = None


class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: LessonKind = "reading"
    video_url: str | None = None
    body: str = ""
    resource_url: str | None = None
    position: int | None = None


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: LessonKind | None = None
    video_url: str | None = None
    body: str | None = None
    resource_url: str | None = None
    position: int | None = None


class LessonOut(ORM):
    id: int
    module_id: int
    title: str
    kind: str
    video_url: str | None
    body: str
    resource_url: str | None
    position: int


class LessonOutline(ORM):
    id: int
    title: str
    kind: str
    position: int


class ModuleIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    position: int | None = None


class ModuleOut(ORM):
    id: int
    title: str
    position: int
    lessons: list[LessonOutline]


class QuizSummary(ORM):
    id: int
    title: str
    pass_mark: int


class CourseOut(ORM):
    id: int
    title: str
    description: str
    level: str
    is_published: bool
    instructor_id: int
    instructor_name: str
    lesson_count: int
    enrolled: bool = False
    created_at: datetime


class CourseDetail(CourseOut):
    modules: list[ModuleOut]
    quizzes: list[QuizSummary]


# ---------- quizzes ----------
class ChoiceIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuestionIn(BaseModel):
    text: str = Field(min_length=1)
    choices: list[ChoiceIn] = Field(min_length=2, max_length=8)


class QuizIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    pass_mark: int = Field(default=70, ge=1, le=100)
    questions: list[QuestionIn] = Field(min_length=1)


class ChoiceOut(BaseModel):
    id: int
    text: str
    is_correct: bool | None = None  # hidden from students


class QuestionOut(BaseModel):
    id: int
    text: str
    choices: list[ChoiceOut]


class QuizOut(BaseModel):
    id: int
    course_id: int
    title: str
    pass_mark: int
    questions: list[QuestionOut]


class AttemptIn(BaseModel):
    answers: dict[int, int]  # question_id -> choice_id


class AttemptResult(ORM):
    id: int
    quiz_id: int
    score: int
    total: int
    percent: int
    passed: bool
    created_at: datetime


class AttemptReview(BaseModel):
    attempt: AttemptResult
    correct_choice_ids: dict[int, int]  # question_id -> correct choice id


# ---------- progress ----------
class QuizProgress(BaseModel):
    quiz_id: int
    title: str
    attempts: int
    best_percent: int | None
    passed: bool


class CourseProgress(BaseModel):
    course_id: int
    title: str
    total_lessons: int
    completed_lessons: int
    percent: int
    completed_lesson_ids: list[int]
    quizzes: list[QuizProgress]


# ---------- admin ----------
class TopCourse(BaseModel):
    course_id: int
    title: str
    enrollments: int


class AdminStats(BaseModel):
    users: int
    students: int
    instructors: int
    admins: int
    courses: int
    published_courses: int
    enrollments: int
    lessons_completed: int
    quiz_attempts: int
    quiz_pass_rate: int
    top_courses: list[TopCourse]
    recent_users: list[UserOut]
