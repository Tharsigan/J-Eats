from datetime import datetime, timedelta, timezone

import jwt

from conftest import login


def test_seeded_accounts_sign_in_with_real_password_check(client):
    res = login(client, "customer", "mira.demo@example.edu", customerSubRole="student")
    assert res.status_code == 200
    body = res.get_json()
    assert body["user"]["id"] == "u_cus"
    assert body["user"]["verificationStatus"] == "approved"
    assert "password_hash" not in body["user"] and "passwordHash" not in body["user"]
    claims = jwt.decode(body["token"], options={"verify_signature": False})
    assert claims["sub"] == "u_cus" and claims["role"] == "customer"
    assert claims["exp"] - claims["iat"] == 30 * 60


def test_campus_id_also_works_as_identifier(client):
    assert login(client, "courier", "SJP-2023-118").status_code == 200


def test_wrong_password_is_refused(client):
    res = login(client, "customer", "mira.demo@example.edu", password="not-the-password")
    assert res.status_code == 401
    assert res.get_json()["error"] == "Incorrect email/ID or password."
    # Unknown accounts get the identical message (no account enumeration).
    res2 = login(client, "customer", "nobody@example.edu", password="whatever1")
    assert res2.get_json()["error"] == res.get_json()["error"]


def test_any_six_character_password_no_longer_works(client):
    assert login(client, "admin", "admin@jeats.lk", password="123456").status_code == 401


def test_wrong_role_hint_only_after_correct_password(client):
    res = login(client, "courier", "mira.demo@example.edu")
    assert res.status_code == 401 and "registered as a customer" in res.get_json()["error"]
    res = login(client, "customer", "anika.staff@sjp.ac.lk", customerSubRole="student")
    assert "Academic Staff" in res.get_json()["error"]
    res = login(client, "courier", "mira.demo@example.edu", password="wrongpass")
    assert res.get_json()["error"] == "Incorrect email/ID or password."


def test_pending_rejected_and_suspended_accounts_are_blocked(client, sql):
    res = login(client, "courier", "kasun.rider@sjp.ac.lk")
    assert res.status_code == 403 and "under review" in res.get_json()["error"]
    sql("UPDATE users SET verification_status='rejected' WHERE id='u_cou_pending'")
    assert "rejected" in login(client, "courier", "kasun.rider@sjp.ac.lk").get_json()["error"]
    sql("UPDATE users SET status='suspended' WHERE id='u_cou'")
    assert "suspended" in login(client, "courier", "ari@sjp.ac.lk").get_json()["error"]


def test_me_requires_a_valid_token(client, customer_headers, app):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer mock.admin.u_adm"}).status_code == 401
    res = client.get("/api/auth/me", headers=customer_headers)
    assert res.status_code == 200 and res.get_json()["email"] == "mira.demo@example.edu"


def _token(secret, **claims):
    now = datetime.now(timezone.utc)
    payload = {"sub": "u_adm", "role": "admin", "iat": now, "exp": now + timedelta(minutes=5), **claims}
    return jwt.encode(payload, secret, algorithm="HS256")


def test_expired_forged_and_unsigned_tokens_are_rejected(client, app):
    secret = app.config["JWT_SECRET"]
    past = datetime.now(timezone.utc) - timedelta(hours=2)
    expired = _token(secret, iat=past, exp=past + timedelta(minutes=5))
    res = client.get("/api/admin/approvals", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401 and "expired" in res.get_json()["error"]

    forged = _token("some-other-secret-" + "y" * 40)
    assert client.get("/api/admin/approvals", headers={"Authorization": f"Bearer {forged}"}).status_code == 401

    unsigned = jwt.encode({"sub": "u_adm", "role": "admin", "iat": 1, "exp": 9999999999}, None, algorithm="none")
    assert client.get("/api/admin/approvals", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401

    # A customer can't promote itself by editing the role claim (signature breaks), and
    # a correctly-signed token whose role disagrees with the database is refused too.
    mismatched = _token(secret, sub="u_cus", role="admin")
    assert client.get("/api/admin/approvals", headers={"Authorization": f"Bearer {mismatched}"}).status_code == 401


def test_suspending_a_user_cuts_off_an_existing_token(client, customer_headers, sql):
    sql("UPDATE users SET status='suspended' WHERE id='u_cus'")
    assert client.get("/api/auth/me", headers=customer_headers).status_code == 403


def test_update_profile(client, customer_headers, sql):
    res = client.patch("/api/auth/me", json={"name": " Mira S. ", "phone": "0771234567"}, headers=customer_headers)
    assert res.status_code == 200 and res.get_json()["name"] == "Mira S."
    assert sql("SELECT name, phone FROM users WHERE id='u_cus'") == [{"name": "Mira S.", "phone": "0771234567"}]
    assert client.patch("/api/auth/me", json={"name": "  "}, headers=customer_headers).status_code == 400


def test_logout(client):
    assert client.post("/api/auth/logout").get_json() == {"ok": True}


def test_production_refuses_to_start_without_a_jwt_secret():
    import pytest

    from app import create_app
    from config import Config

    class Prod(Config):
        DEBUG = False
        TESTING = False
        JWT_SECRET = "change-me-to-a-long-random-string"

    with pytest.raises(RuntimeError):
        create_app(Prod)
