"""Test fixtures.

The tests build a THROWAWAY database (default name `j_eats_test`) from
database/schema.sql + seed.sql before every test, and drop it at the end.
They never connect to `j_eats`. Point them at a MariaDB/MySQL server with:

    TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3307 TEST_DB_USER=root TEST_DB_PASSWORD= pytest
"""
import os
import re
import sys
from pathlib import Path

import pymysql
import pytest
from pymysql.constants import CLIENT

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))

TEST_DB = os.getenv("TEST_DB_NAME", "j_eats_test")
if TEST_DB == "j_eats" or not re.fullmatch(r"[A-Za-z0-9_]+", TEST_DB):
    raise RuntimeError("TEST_DB_NAME must be a separate, disposable database (not j_eats).")

SERVER = dict(
    host=os.getenv("TEST_DB_HOST", "127.0.0.1"),
    port=int(os.getenv("TEST_DB_PORT", "3307")),
    user=os.getenv("TEST_DB_USER", "root"),
    password=os.getenv("TEST_DB_PASSWORD", ""),
)


def _sql(name: str) -> str:
    text = (REPO / "database" / name).read_text(encoding="utf-8")
    # Retarget the scripts at the test database instead of j_eats.
    text = re.sub(r"CREATE DATABASE IF NOT EXISTS j_eats\b", f"CREATE DATABASE IF NOT EXISTS `{TEST_DB}`", text)
    text = re.sub(r"\bUSE j_eats;", f"USE `{TEST_DB}`;", text)
    assert "j_eats;" not in text.replace(f"`{TEST_DB}`;", "")
    return text


SCHEMA, SEED = _sql("schema.sql"), _sql("seed.sql")


def _server(**kw):
    return pymysql.connect(**SERVER, charset="utf8mb4", client_flag=CLIENT.MULTI_STATEMENTS, autocommit=True, **kw)


def _run_script(script: str):
    conn = _server()
    try:
        with conn.cursor() as cur:
            cur.execute(script)
            while cur.nextset():
                pass
    finally:
        conn.close()


@pytest.fixture(scope="session", autouse=True)
def _database_server():
    try:
        _server().close()
    except pymysql.MySQLError as exc:
        pytest.skip(f"No test MariaDB/MySQL server reachable at {SERVER['host']}:{SERVER['port']}: {exc}")
    yield
    _run_script(f"DROP DATABASE IF EXISTS `{TEST_DB}`;")


@pytest.fixture()
def fresh_db():
    _run_script(f"DROP DATABASE IF EXISTS `{TEST_DB}`;" + SCHEMA + SEED)


@pytest.fixture()
def app(fresh_db, tmp_path):
    from app import create_app
    from config import Config

    class TestConfig(Config):
        TESTING = True
        DEBUG = False
        DB_HOST = SERVER["host"]
        DB_PORT = SERVER["port"]
        DB_USER = SERVER["user"]
        DB_PASSWORD = SERVER["password"]
        DB_NAME = TEST_DB
        JWT_SECRET = "test-secret-" + "x" * 40
        JWT_EXPIRES_MINUTES = 30
        UPLOAD_FOLDER = str(tmp_path / "uploads")

    return create_app(TestConfig)


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def sql():
    """Read the test database directly, the way you would in phpMyAdmin."""
    conn = pymysql.connect(**SERVER, database=TEST_DB, charset="utf8mb4", autocommit=True,
                           cursorclass=pymysql.cursors.DictCursor)

    def run(statement, params=None):
        with conn.cursor() as cur:
            cur.execute(statement, params)
            return list(cur.fetchall())

    yield run
    conn.close()


def login(client, role, identifier, password="demo123", **extra):
    return client.post("/api/auth/login", json={"role": role, "identifier": identifier, "password": password, **extra})


@pytest.fixture()
def admin_headers(client):
    res = login(client, "admin", "admin@jeats.lk")
    assert res.status_code == 200, res.get_json()
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


@pytest.fixture()
def customer_headers(client):
    res = login(client, "customer", "mira.demo@example.edu", customerSubRole="student")
    assert res.status_code == 200, res.get_json()
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
