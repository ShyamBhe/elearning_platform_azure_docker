from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import can_edit_course, ensure_can_edit, get_current_user, require_staff
from ..models import Choice, Question, Quiz, QuizAttempt, User
from ..schemas import AttemptIn, AttemptResult, AttemptReview, QuizIn, QuizOut
from .courses import get_course_or_404, is_enrolled

router = APIRouter(tags=["quizzes"])


def _quiz(db: Session, quiz_id: int) -> Quiz:
    quiz = db.get(Quiz, quiz_id)
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    return quiz


def _quiz_out(quiz: Quiz, reveal: bool) -> QuizOut:
    return QuizOut(
        id=quiz.id,
        course_id=quiz.course_id,
        title=quiz.title,
        pass_mark=quiz.pass_mark,
        questions=[
            {
                "id": q.id,
                "text": q.text,
                "choices": [
                    {"id": c.id, "text": c.text, "is_correct": c.is_correct if reveal else None}
                    for c in q.choices
                ],
            }
            for q in quiz.questions
        ],
    )


def _validate(data: QuizIn) -> None:
    for i, question in enumerate(data.questions, start=1):
        correct = sum(1 for c in question.choices if c.is_correct)
        if correct != 1:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Question {i} must have exactly one correct choice",
            )


def _build_questions(quiz: Quiz, data: QuizIn) -> None:
    quiz.questions = [
        Question(
            text=q.text,
            position=i,
            choices=[Choice(text=c.text, is_correct=c.is_correct) for c in q.choices],
        )
        for i, q in enumerate(data.questions)
    ]


@router.post("/courses/{course_id}/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(course_id: int, data: QuizIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    course = get_course_or_404(db, course_id)
    ensure_can_edit(user, course)
    _validate(data)
    quiz = Quiz(course_id=course.id, title=data.title, pass_mark=data.pass_mark)
    _build_questions(quiz, data)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _quiz_out(quiz, reveal=True)


@router.put("/quizzes/{quiz_id}", response_model=QuizOut)
def replace_quiz(quiz_id: int, data: QuizIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    quiz = _quiz(db, quiz_id)
    ensure_can_edit(user, quiz.course)
    _validate(data)
    quiz.title, quiz.pass_mark = data.title, data.pass_mark
    _build_questions(quiz, data)  # old questions are removed by delete-orphan
    db.commit()
    db.refresh(quiz)
    return _quiz_out(quiz, reveal=True)


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    quiz = _quiz(db, quiz_id)
    ensure_can_edit(user, quiz.course)
    db.delete(quiz)
    db.commit()


@router.get("/quizzes/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quiz = _quiz(db, quiz_id)
    course = get_course_or_404(db, quiz.course_id)
    editor = can_edit_course(user, course)
    if not (editor or (course.is_published and is_enrolled(db, user, course.id))):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Enroll in this course to take its quizzes")
    return _quiz_out(quiz, reveal=editor)


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptReview, status_code=status.HTTP_201_CREATED)
def submit_attempt(quiz_id: int, data: AttemptIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quiz = _quiz(db, quiz_id)
    course = get_course_or_404(db, quiz.course_id)
    if not is_enrolled(db, user, course.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Enroll in this course to take its quizzes")

    score = 0
    correct_ids: dict[int, int] = {}
    for question in quiz.questions:
        right = next(c for c in question.choices if c.is_correct)
        correct_ids[question.id] = right.id
        if data.answers.get(question.id) == right.id:
            score += 1
    total = len(quiz.questions)
    percent = round(100 * score / total) if total else 0
    attempt = QuizAttempt(
        user_id=user.id, quiz_id=quiz.id, score=score, total=total,
        percent=percent, passed=percent >= quiz.pass_mark,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return AttemptReview(attempt=attempt, correct_choice_ids=correct_ids)


@router.get("/quizzes/{quiz_id}/attempts/me", response_model=list[AttemptResult])
def my_attempts(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _quiz(db, quiz_id)
    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.created_at.desc())
    )
    return list(db.scalars(stmt))
