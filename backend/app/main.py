from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import User
from .routers import admin, auth, content, courses, progress, quizzes
from .security import hash_password


def seed_admin() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.role == "admin")) is None:
            db.add(
                User(
                    email=settings.first_admin_email.lower(),
                    full_name="Administrator",
                    hashed_password=hash_password(settings.first_admin_password),
                    role="admin",
                )
            )
            db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fine for a first release. Move to Alembic migrations before you change the schema in production.
    Base.metadata.create_all(engine)
    seed_admin()
    yield


app = FastAPI(title="Courseway LMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
for module in (auth, courses, content, quizzes, progress, admin):
    api.include_router(module.router)


@api.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


app.include_router(api)
