"""Optional demo data:  python -m app.seed_demo
Creates an instructor (instructor@example.com / Instructor123!) and one published course with a quiz."""
from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import Choice, Course, Lesson, Module, Question, Quiz, User
from .security import hash_password


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == "instructor@example.com")):
            print("Demo data already present.")
            return
        teacher = User(
            email="instructor@example.com", full_name="Ines Instructor",
            hashed_password=hash_password("Instructor123!"), role="instructor",
        )
        db.add(teacher)
        db.flush()
        course = Course(
            title="Python for Beginners",
            description="Learn the core of Python: variables, control flow and functions, with short videos, readings and a quiz.",
            level="beginner", is_published=True, instructor_id=teacher.id,
        )
        course.modules = [
            Module(title="Getting started", position=0, lessons=[
                Lesson(title="What is Python?", kind="video", position=0,
                       video_url="https://www.youtube.com/watch?v=kqtD5dpn9C8",
                       body="Watch the overview, then continue to the next lesson."),
                Lesson(title="Variables and types", kind="reading", position=1,
                       body="A variable is a name that points to a value.\n\nage = 30\nname = 'Ada'\n\nPython figures out the type for you."),
            ]),
            Module(title="Control flow", position=1, lessons=[
                Lesson(title="If statements", kind="reading", position=0,
                       body="Use if, elif and else to choose between paths.",
                       resource_url="https://docs.python.org/3/tutorial/controlflow.html"),
            ]),
        ]
        quiz = Quiz(title="Python basics check", pass_mark=60)
        quiz.questions = [
            Question(text="Which keyword starts a conditional?", position=0, choices=[
                Choice(text="if", is_correct=True), Choice(text="when"), Choice(text="check")]),
            Question(text="What does age = 30 do?", position=1, choices=[
                Choice(text="Compares age to 30"), Choice(text="Assigns 30 to age", is_correct=True)]),
        ]
        course.quizzes = [quiz]
        db.add(course)
        db.commit()
        print("Demo data created.")


if __name__ == "__main__":
    main()
