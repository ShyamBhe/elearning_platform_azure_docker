from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Course, Enrollment, LessonProgress, QuizAttempt, User
from ..schemas import AdminStats, TopCourse, UserAdminUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role_count = lambda r: _count(db, select(func.count(User.id)).where(User.role == r))  # noqa: E731
    attempts = _count(db, select(func.count(QuizAttempt.id)))
    passed = _count(db, select(func.count(QuizAttempt.id)).where(QuizAttempt.passed.is_(True)))
    top = db.execute(
        select(Course.id, Course.title, func.count(Enrollment.id).label("n"))
        .join(Enrollment, Enrollment.course_id == Course.id, isouter=True)
        .group_by(Course.id, Course.title)
        .order_by(func.count(Enrollment.id).desc())
        .limit(5)
    ).all()
    recent = list(db.scalars(select(User).order_by(User.created_at.desc()).limit(5)))
    return AdminStats(
        users=_count(db, select(func.count(User.id))),
        students=role_count("student"),
        instructors=role_count("instructor"),
        admins=role_count("admin"),
        courses=_count(db, select(func.count(Course.id))),
        published_courses=_count(db, select(func.count(Course.id)).where(Course.is_published.is_(True))),
        enrollments=_count(db, select(func.count(Enrollment.id))),
        lessons_completed=_count(db, select(func.count(LessonProgress.id))),
        quiz_attempts=attempts,
        quiz_pass_rate=round(100 * passed / attempts) if attempts else 0,
        top_courses=[TopCourse(course_id=r.id, title=r.title, enrollments=r.n) for r in top],
        recent_users=recent,
    )


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, data: UserAdminUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id and (data.role not in (None, "admin") or data.is_active is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot demote or deactivate yourself")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(target, key, value)
    db.commit()
    return target
