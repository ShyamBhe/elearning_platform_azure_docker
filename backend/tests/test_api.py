def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, email, name="Test User"):
    r = client.post("/api/auth/register", json={"email": email, "full_name": name, "password": "Password123"})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_full_learning_flow(client):
    admin = login(client, "admin@test.dev", "AdminPass123")
    student = register(client, "stu@test.dev", "Stu Dent")

    # students cannot create courses; admins can
    assert client.post("/api/courses", json={"title": "X"}, headers=auth(student)).status_code == 403
    r = client.post("/api/courses", json={"title": "Intro to FastAPI", "level": "beginner"}, headers=auth(admin))
    assert r.status_code == 201
    cid = r.json()["id"]

    # unpublished courses are hidden from the catalog
    assert client.get("/api/courses").json() == []
    assert client.get(f"/api/courses/{cid}").status_code == 404

    mid = client.post(f"/api/courses/{cid}/modules", json={"title": "Basics"}, headers=auth(admin)).json()["id"]
    l1 = client.post(
        f"/api/modules/{mid}/lessons",
        json={"title": "Hello", "kind": "video", "video_url": "https://youtu.be/abc"},
        headers=auth(admin),
    ).json()["id"]
    l2 = client.post(
        f"/api/modules/{mid}/lessons", json={"title": "Routing", "body": "text"}, headers=auth(admin)
    ).json()["id"]

    quiz = client.post(
        f"/api/courses/{cid}/quizzes",
        json={
            "title": "Check",
            "pass_mark": 50,
            "questions": [
                {"text": "2+2?", "choices": [{"text": "4", "is_correct": True}, {"text": "5"}]},
                {"text": "3+3?", "choices": [{"text": "6", "is_correct": True}, {"text": "7"}]},
            ],
        },
        headers=auth(admin),
    )
    assert quiz.status_code == 201
    qid = quiz.json()["id"]

    bad = client.post(
        f"/api/courses/{cid}/quizzes",
        json={"title": "Bad", "questions": [{"text": "?", "choices": [{"text": "a"}, {"text": "b"}]}]},
        headers=auth(admin),
    )
    assert bad.status_code == 422

    client.put(f"/api/courses/{cid}", json={"is_published": True}, headers=auth(admin))
    catalog = client.get("/api/courses").json()
    assert len(catalog) == 1 and catalog[0]["lesson_count"] == 2

    # lessons are locked until enrolled
    assert client.get(f"/api/lessons/{l1}", headers=auth(student)).status_code == 403
    assert client.post(f"/api/courses/{cid}/enroll", headers=auth(student)).json()["enrolled"] is True
    assert client.get(f"/api/lessons/{l1}", headers=auth(student)).status_code == 200

    # progress
    assert client.post(f"/api/lessons/{l1}/complete", headers=auth(student)).status_code == 204
    assert client.post(f"/api/lessons/{l1}/complete", headers=auth(student)).status_code == 204  # idempotent
    prog = client.get(f"/api/progress/courses/{cid}", headers=auth(student)).json()
    assert prog["completed_lessons"] == 1 and prog["percent"] == 50 and prog["completed_lesson_ids"] == [l1]

    # quiz: students never see correct answers before submitting
    q = client.get(f"/api/quizzes/{qid}", headers=auth(student)).json()
    assert all(c["is_correct"] is None for question in q["questions"] for c in question["choices"])
    answers = {str(question["id"]): question["choices"][0]["id"] for question in q["questions"]}
    res = client.post(f"/api/quizzes/{qid}/attempts", json={"answers": answers}, headers=auth(student)).json()
    assert res["attempt"]["percent"] == 100 and res["attempt"]["passed"] is True

    prog = client.get("/api/progress/me", headers=auth(student)).json()
    assert prog[0]["quizzes"][0]["best_percent"] == 100 and prog[0]["quizzes"][0]["passed"]

    # admin dashboard
    stats = client.get("/api/admin/stats", headers=auth(admin)).json()
    assert stats["students"] == 1 and stats["enrollments"] == 1 and stats["quiz_pass_rate"] == 100
    assert client.get("/api/admin/stats", headers=auth(student)).status_code == 403

    # deleting a course removes everything under it
    assert client.delete(f"/api/courses/{cid}", headers=auth(admin)).status_code == 204
    assert client.get("/api/courses").json() == []


def test_auth_rules(client):
    register(client, "dup@test.dev")
    r = client.post("/api/auth/register", json={"email": "dup@test.dev", "full_name": "x", "password": "Password123"})
    assert r.status_code == 409
    assert client.post("/api/auth/login", json={"email": "dup@test.dev", "password": "wrong-pass"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_admin_manages_users(client):
    admin = login(client, "admin@test.dev", "AdminPass123")
    register(client, "promote@test.dev")
    users = client.get("/api/admin/users", headers=auth(admin)).json()
    target = next(u for u in users if u["email"] == "promote@test.dev")
    r = client.patch(f"/api/admin/users/{target['id']}", json={"role": "instructor"}, headers=auth(admin))
    assert r.json()["role"] == "instructor"
    me = next(u for u in users if u["role"] == "admin")
    assert client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False}, headers=auth(admin)).status_code == 400
