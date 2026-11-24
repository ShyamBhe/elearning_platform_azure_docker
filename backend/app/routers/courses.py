from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import can_edit_course, ensure_can_edit, get_current_user, get_optional_user, require_staff
from ..models import Course, Enrollment, User
from ..schemas import CourseCreate, CourseDetail, CourseOut, CourseUpdate

router = APIRouter(prefix="/courses", tags=["courses"])


def lesson_count(course: Course) -> int:
    return sum(len(m.lessons) for m in course.modules)


def course_out(course: Course, enrolled: bool = False) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "level": course.level,
        "is_published": course.is_published,
        "instructor_id": course.instructor_id,
        "instructor_name": course.instructor.full_name,
        "lesson_count": lesson_count(course),
        "enrolled": enrolled,
        "created_at": course.created_at,
    }


def enrolled_ids(db: Session, user: User | None) -> set[int]:
    if user is None:
        return set()
    return set(db.scalars(select(Enrollment.course_id).where(Enrollment.user_id == user.id)))


def get_course_or_404(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


def is_enrolled(db: Session, user: User, course_id: int) -> bool:
    return db.scalar(
        select(Enrollment.id).where(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
    ) is not None


@router.get("", response_model=list[CourseOut])
def list_courses(
    q: str | None = Query(default=None, max_length=100),
    manage: bool = False,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Public catalog of published courses. With manage=true, staff see the courses they can edit."""
    stmt = select(Course).order_by(Course.created_at.desc())
    if manage:
        if user is None or user.role not in ("instructor", "admin"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Instructor access required")
        if user.role == "instructor":
            stmt = stmt.where(Course.instructor_id == user.id)
    else:
        stmt = stmt.where(Course.is_published.is_(True))
    if q:
        stmt = stmt.where(Course.title.ilike(f"%{q}%"))
    mine = enrolled_ids(db, user)
    return [course_out(c, c.id in mine) for c in db.scalars(stmt)]


@router.get("/enrolled", response_model=list[CourseOut])
def my_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == user.id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    return [course_out(c, True) for c in db.scalars(stmt)]


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(data: CourseCreate, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    course = Course(**data.model_dump(), instructor_id=user.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course_out(course)


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    course = get_course_or_404(db, course_id)
    editable = user is not None and can_edit_course(user, course)
    if not course.is_published and not editable:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    enrolled = user is not None and is_enrolled(db, user, course.id)
    return {**course_out(course, enrolled), "modules": course.modules, "quizzes": course.quizzes}


@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int, data: CourseUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff)
):
    course = get_course_or_404(db, course_id)
    ensure_can_edit(user, course)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    return course_out(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    course = get_course_or_404(db, course_id)
    ensure_can_edit(user, course)
    db.delete(course)
    db.commit()


@router.post("/{course_id}/enroll", response_model=CourseOut)
def enroll(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = get_course_or_404(db, course_id)
    if not course.is_published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if not is_enrolled(db, user, course_id):
        db.add(Enrollment(user_id=user.id, course_id=course_id))
        db.commit()
    return course_out(course, True)


@router.delete("/{course_id}/enroll", status_code=status.HTTP_204_NO_CONTENT)
def unenroll(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    enrollment = db.scalar(
        select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
    )
    if enrollment:
        db.delete(enrollment)
        db.commit()
