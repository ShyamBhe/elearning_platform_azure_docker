from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Course, User
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def _user_from_creds(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    if creds is None:
        return None
    payload = decode_access_token(creds.credentials)
    if not payload:
        return None
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        return None
    return user


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    return _user_from_creds(creds, db)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = _user_from_creds(creds, db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def require_staff(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("instructor", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Instructor access required")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def can_edit_course(user: User, course: Course) -> bool:
    return user.role == "admin" or (user.role == "instructor" and course.instructor_id == user.id)


def ensure_can_edit(user: User, course: Course) -> None:
    if not can_edit_course(user, course):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot edit this course")
