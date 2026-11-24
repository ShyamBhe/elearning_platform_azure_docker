import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["FIRST_ADMIN_EMAIL"] = "admin@test.dev"
os.environ["FIRST_ADMIN_PASSWORD"] = "AdminPass123"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
