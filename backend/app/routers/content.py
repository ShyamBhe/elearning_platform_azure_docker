from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import can_edit_course, ensure_can_edit, get_current_user, require_staff
from ..models import Lesson, Module, User
from ..schemas import LessonIn, LessonOut, LessonUpdate, ModuleIn, ModuleOut
from .courses import get_course_or_404, is_enrolled

router = APIRouter(tags=["content"])


def _module(db: Session, module_id: int) -> Module:
    module = db.get(Module, module_id)
    if module is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return module


def _lesson(db: Session, lesson_id: int) -> Lesson:
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    return lesson


@router.post("/courses/{course_id}/modules", response_model=ModuleOut, status_code=status.HTTP_201_CREATED)
def add_module(course_id: int, data: ModuleIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    course = get_course_or_404(db, course_id)
    ensure_can_edit(user, course)
    position = data.position if data.position is not None else len(course.modules)
    module = Module(course_id=course.id, title=data.title, position=position)
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


@router.put("/modules/{module_id}", response_model=ModuleOut)
def update_module(module_id: int, data: ModuleIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    module = _module(db, module_id)
    ensure_can_edit(user, module.course)
    module.title = data.title
    if data.position is not None:
        module.position = data.position
    db.commit()
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(module_id: int, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    module = _module(db, module_id)
    ensure_can_edit(user, module.course)
    db.delete(module)
    db.commit()


@router.post("/modules/{module_id}/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def add_lesson(module_id: int, data: LessonIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    module = _module(db, module_id)
    ensure_can_edit(user, module.course)
    values = data.model_dump()
    if values["position"] is None:
        values["position"] = len(module.lessons)
    lesson = Lesson(module_id=module.id, **values)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.get("/lessons/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lesson = _lesson(db, lesson_id)
    course = get_course_or_404(db, lesson.module.course_id)
    if not (can_edit_course(user, course) or (course.is_published and is_enrolled(db, user, course.id))):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Enroll in this course to view its lessons")
    return lesson


@router.put("/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: int, data: LessonUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff)
):
    lesson = _lesson(db, lesson_id)
    ensure_can_edit(user, lesson.module.course)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lesson, key, value)
    db.commit()
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    lesson = _lesson(db, lesson_id)
    ensure_can_edit(user, lesson.module.course)
    db.delete(lesson)
    db.commit()
