from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Course, Enrollment, Lesson, LessonProgress, QuizAttempt, User
from ..schemas import CourseProgress, QuizProgress
from .courses import get_course_or_404, is_enrolled

router = APIRouter(tags=["progress"])


def build_progress(db: Session, user: User, course: Course) -> CourseProgress:
    lesson_ids = [l.id for m in course.modules for l in m.lessons]
    done = (
        list(
            db.scalars(
                select(LessonProgress.lesson_id).where(
                    LessonProgress.user_id == user.id, LessonProgress.lesson_id.in_(lesson_ids)
                )
            )
        )
        if lesson_ids
        else []
    )
    quizzes = []
    for quiz in course.quizzes:
        count, best = db.execute(
            select(func.count(QuizAttempt.id), func.max(QuizAttempt.percent)).where(
                QuizAttempt.user_id == user.id, QuizAttempt.quiz_id == quiz.id
            )
        ).one()
        quizzes.append(
            QuizProgress(
                quiz_id=quiz.id, title=quiz.title, attempts=count, best_percent=best,
                passed=best is not None and best >= quiz.pass_mark,
            )
        )
    total = len(lesson_ids)
    return CourseProgress(
        course_id=course.id,
        title=course.title,
        total_lessons=total,
        completed_lessons=len(done),
        percent=round(100 * len(done) / total) if total else 0,
        completed_lesson_ids=done,
        quizzes=quizzes,
    )


@router.get("/progress/me", response_model=list[CourseProgress])
def my_progress(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == user.id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    return [build_progress(db, user, c) for c in db.scalars(stmt)]


@router.get("/progress/courses/{course_id}", response_model=CourseProgress)
def course_progress(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = get_course_or_404(db, course_id)
    return build_progress(db, user, course)


def _require_access(db: Session, user: User, lesson_id: int) -> Lesson:
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    if not is_enrolled(db, user, lesson.module.course_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Enroll in this course first")
    return lesson


@router.post("/lessons/{lesson_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def mark_complete(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_access(db, user, lesson_id)
    exists = db.scalar(
        select(LessonProgress.id).where(
            LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
        )
    )
    if not exists:
        db.add(LessonProgress(user_id=user.id, lesson_id=lesson_id))
        db.commit()


@router.delete("/lessons/{lesson_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def mark_incomplete(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_access(db, user, lesson_id)
    row = db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
        )
    )
    if row:
        db.delete(row)
        db.commit()
