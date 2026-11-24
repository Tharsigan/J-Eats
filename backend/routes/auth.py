"""Sign in, register and the signed-in user's profile.

POST  /api/auth/login      {role, identifier, password, customerSubRole?} -> {user, token}
POST  /api/auth/register   multipart form (see register()) -> {status: "pending"}
GET   /api/auth/me         -> the signed-in user
PATCH /api/auth/me         {name?, phone?} -> the updated user
POST  /api/auth/logout     -> {ok: true}
"""
import logging
import re
import uuid
from datetime import datetime, timezone

import pymysql
from flask import Blueprint, jsonify, request

import uploads
from auth import (
    burn_password_check,
    current_user,
    hash_password,
    issue_token,
    require_auth,
    verify_password,
)
from db import query, query_one, transaction
from serializers import user_json

log = logging.getLogger(__name__)
bp = Blueprint("auth", __name__)

ROLE_LABEL = {"customer": "a customer", "courier": "a rider", "cafeteria": "a cafeteria", "admin": "an administrator"}
SUB_ROLE_LABEL = {"student": "Student", "academic": "Academic Staff", "non-academic": "Non-Academic Staff"}
REGISTER_ROLES = ("customer", "courier", "cafeteria")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 6
MAX_PASSWORD = 128


def _error(status: int, message: str):
    return jsonify(error=message), status


def _utcnow() -> datetime:
    """Naive UTC datetime for DATETIME columns (the seed data is stored in UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


# ---------------------------------------------------------------- login
@bp.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    role = str(body.get("role") or "")
    identifier = str(body.get("identifier") or "").strip()
    password = str(body.get("password") or "")
    sub_role = body.get("customerSubRole") or None

    if role not in ROLE_LABEL:
        return _error(400, "Choose which kind of account you are signing in to.")
    if not identifier:
        return _error(400, "Enter your email or campus ID.")
    if not password:
        return _error(400, "Enter your password.")
    if len(password) > MAX_PASSWORD:
        return _error(401, "Incorrect email/ID or password.")

    candidates = query(
        "SELECT * FROM users WHERE email = %s OR id_number = %s OR campus_id = %s",
        (identifier, identifier, identifier),
    )
    # Only accounts whose password matches count, so these messages never reveal
    # whether an email is registered to someone who doesn't know the password.
    matching = [u for u in candidates if verify_password(u["password_hash"], password)]
    if not candidates:
        burn_password_check(password)

    user = next(
        (
            u
            for u in matching
            if u["role"] == role and (role != "customer" or not sub_role or u["customer_sub_role"] == sub_role)
        ),
        None,
    )
    if not user:
        other = matching[0] if matching else None
        if other and other["role"] != role:
            return _error(401, f"This account is registered as {ROLE_LABEL[other['role']]}. Use that login instead.")
        if other and other["customer_sub_role"]:
            label = SUB_ROLE_LABEL.get(other["customer_sub_role"], other["customer_sub_role"])
            return _error(401, f"This account is registered as {label}. Switch to the {label} tab above.")
        return _error(401, "Incorrect email/ID or password.")

    if user["status"] == "suspended":
        return _error(403, "This account has been suspended by an administrator. Contact J Eats support.")
    status = "approved" if user["role"] == "admin" else user["verification_status"]
    if status == "rejected":
        return _error(403, "Your verification documents were rejected. Please register again with clearer documents.")
    if status != "approved":
        return _error(
            403,
            "Your documents are still under review. You can sign in after an administrator approves your account.",
        )

    try:
        with transaction() as tx:
            tx.execute(
                "INSERT INTO system_logs (id, level, message, created_at) VALUES (%s, 'info', %s, %s)",
                (new_id("log"), f"{user['name']} signed in ({user['role']})", _utcnow()),
            )
    except pymysql.MySQLError:  # logging must never block a valid sign-in
        log.exception("Could not write the sign-in log entry")

    return jsonify(user=user_json(user), token=issue_token(user))


# ---------------------------------------------------------------- profile
@bp.get("/auth/me")
@require_auth
def me():
    return jsonify(user_json(current_user()))


@bp.patch("/auth/me")
@require_auth
def update_me():
    body = request.get_json(silent=True) or {}
    user = current_user()
    name, phone = user["name"], user["phone"]
    if "name" in body:
        name = str(body.get("name") or "").strip()
        if not name:
            return _error(400, "Name cannot be empty.")
        if len(name) > 120:
            return _error(400, "Name must be 120 characters or fewer.")
    if "phone" in body:
        phone = str(body.get("phone") or "").strip() or None
        if phone and len(phone) > 20:
            return _error(400, "Phone number must be 20 characters or fewer.")
    with transaction() as tx:
        tx.execute("UPDATE users SET name = %s, phone = %s WHERE id = %s", (name, phone, user["id"]))
        updated = tx.query_one("SELECT * FROM users WHERE id = %s", (user["id"],))
    return jsonify(user_json(updated))


@bp.post("/auth/logout")
def logout():
    # Tokens are stateless: the browser deletes its copy and it expires on its own.
    return jsonify(ok=True)


# ---------------------------------------------------------------- register
# Which documents each role must upload (matches the three registration forms).
REQUIRED_DOCS = {"customer": 1, "courier": 2, "cafeteria": 2}


@bp.post("/auth/register")
def register():
    """Create a pending account + verification application from the registration forms.

    Form fields: role, name, email, password, idNumber (customer & rider),
    customerSubRole (customer), extra, verificationDoc + verificationDocKind,
    verificationDoc2 + verificationDocKind2.
    """
    form = request.form
    role = form.get("role", "")
    name = form.get("name", "").strip()
    email = form.get("email", "").strip()
    password = form.get("password", "")
    id_number = (form.get("idNumber") or form.get("campusId") or "").strip() or None
    sub_role = form.get("customerSubRole") or None
    extra = form.get("extra", "").strip() or None

    if role not in REGISTER_ROLES:
        return _error(400, "Choose customer, rider or cafeteria.")
    if not name or len(name) > 120:
        return _error(400, "Enter a name of up to 120 characters.")
    if not EMAIL_RE.match(email) or len(email) > 160:
        return _error(400, "Enter a valid email address.")
    if not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return _error(400, f"Passwords need {MIN_PASSWORD} to {MAX_PASSWORD} characters.")
    if role in ("customer", "courier") and not id_number:
        return _error(400, "Enter your ID number.")
    if id_number and len(id_number) > 40:
        return _error(400, "ID number must be 40 characters or fewer.")
    if role == "customer":
        if sub_role not in SUB_ROLE_LABEL:
            return _error(400, "Choose Student, Academic Staff or Non-Academic Staff.")
    else:
        sub_role = None
    if extra and len(extra) > 500:
        return _error(400, "Extra details must be 500 characters or fewer.")

    # Check uploads before touching the database or the disk.
    try:
        docs = []
        for file_key, kind_key in (("verificationDoc", "verificationDocKind"), ("verificationDoc2", "verificationDocKind2")):
            doc = uploads.read_upload(request.files.get(file_key), form.get(kind_key, ""))
            if doc:
                docs.append(doc)
    except uploads.UploadError as exc:
        return _error(400, str(exc))
    if len(docs) < REQUIRED_DOCS[role]:
        return _error(400, "Attach every required verification document.")

    saved_paths: list[str] = []
    try:
        for doc in docs:
            saved_paths.append(uploads.save(doc))

        now = _utcnow()
        app_id = new_id("app")
        with transaction() as tx:
            # Lock any account using this email / ID so two sign-ups can't race.
            taken = tx.query(
                "SELECT id, verification_status FROM users WHERE email = %s OR (%s IS NOT NULL AND id_number = %s) FOR UPDATE",
                (email, id_number, id_number),
            )
            if any(t["verification_status"] != "rejected" for t in taken) or len(taken) > 1:
                raise _Conflict()
            password_hash = hash_password(password)
            if taken:
                # A rejected applicant re-applies: reuse their row instead of deleting it.
                user_id = taken[0]["id"]
                tx.execute(
                    """UPDATE users SET name = %s, email = %s, password_hash = %s, role = %s,
                              customer_sub_role = %s, campus_id = %s, id_number = %s,
                              verification_status = 'pending'
                       WHERE id = %s""",
                    (name, email, password_hash, role, sub_role, id_number, id_number, user_id),
                )
            else:
                user_id = new_id("u")
                tx.execute(
                    """INSERT INTO users (id, name, email, password_hash, role, customer_sub_role, campus_id,
                                          id_number, verification_status, status, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'active', %s)""",
                    (user_id, name, email, password_hash, role, sub_role, id_number, id_number, now),
                )
            tx.execute(
                """INSERT INTO verification_applications (id, user_id, role, extra, verification_status, submitted_at)
                   VALUES (%s, %s, %s, %s, 'pending', %s)""",
                (app_id, user_id, role, extra, now),
            )
            tx.executemany(
                "INSERT INTO verification_documents (application_id, name, kind, file_url) VALUES (%s, %s, %s, %s)",
                [(app_id, d.display_name, d.kind, path) for d, path in zip(docs, saved_paths)],
            )
            label = "rider" if role == "courier" else role
            tx.execute(
                """INSERT INTO notifications (id, user_id, role, title, body, href, is_read, created_at)
                   VALUES (%s, NULL, 'admin', %s, %s, '/admin#pending-approvals', FALSE, %s)""",
                (new_id("n"), f"New {label} application", f"{name} · {email} submitted {len(docs)} document(s).", now),
            )
            tx.execute(
                "INSERT INTO system_logs (id, level, message, created_at) VALUES (%s, 'info', %s, %s)",
                (new_id("log"), f"{label.capitalize()} application submitted: {name}", now),
            )
    except _Conflict:
        uploads.remove(saved_paths)
        return _error(409, "An account with this email or ID already exists. Try logging in instead.")
    except pymysql.err.IntegrityError:
        uploads.remove(saved_paths)
        return _error(409, "An account with this email or ID already exists. Try logging in instead.")
    except Exception:
        uploads.remove(saved_paths)
        raise

    return jsonify(status="pending"), 201


class _Conflict(Exception):
    pass
