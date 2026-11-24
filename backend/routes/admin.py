"""Admin: review customer, rider and cafeteria applications.

GET  /api/admin/approvals              -> every application, pending first
POST /api/admin/approvals/<id>         {status: "approved" | "rejected"}
GET  /api/admin/documents/<doc_id>     -> the uploaded file (admins only)
"""
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, send_file

import uploads
from auth import current_user, require_role
from db import query, query_one, transaction
from serializers import iso

bp = Blueprint("admin", __name__)


def _error(status: int, message: str):
    return jsonify(error=message), status


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


APPLICATION_SQL = """
    SELECT a.id, a.user_id, a.role, a.extra, a.verification_status, a.submitted_at,
           u.name, u.email, u.customer_sub_role, u.id_number
    FROM verification_applications a
    JOIN users u ON u.id = a.user_id
"""


def _documents(app_ids: list[str]) -> dict[str, list[dict]]:
    by_app: dict[str, list[dict]] = {i: [] for i in app_ids}
    if not app_ids:
        return by_app
    marks = ", ".join(["%s"] * len(app_ids))
    rows = query(
        f"SELECT id, application_id, name, kind, file_url FROM verification_documents "
        f"WHERE application_id IN ({marks}) ORDER BY id",
        tuple(app_ids),
    )
    for d in rows:
        stored = bool(d["file_url"]) and bool(uploads.STORED_NAME.match(d["file_url"] or ""))
        by_app[d["application_id"]].append(
            {
                "name": d["name"],
                "kind": d["kind"],
                # A path on this API, fetched with the admin's token (not a public link).
                "url": f"/admin/documents/{d['id']}" if stored else "",
                **({"contentType": uploads.content_type(d["file_url"])} if stored else {}),
            }
        )
    return by_app


def _application_json(row: dict, docs: list[dict]) -> dict:
    out = {
        "id": row["id"],
        "userId": row["user_id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "customerSubRole": row["customer_sub_role"],
        "idNumber": row["id_number"],
        "extra": row["extra"],
        "documents": docs,
        "verificationStatus": row["verification_status"],
        "submittedAt": iso(row["submitted_at"]),
    }
    return {k: v for k, v in out.items() if v is not None}


@bp.get("/admin/approvals")
@require_role("admin")
def list_approvals():
    rows = query(
        APPLICATION_SQL
        + " ORDER BY (a.verification_status = 'pending') DESC, a.submitted_at DESC, a.id"
    )
    docs = _documents([r["id"] for r in rows])
    return jsonify([_application_json(r, docs[r["id"]]) for r in rows])


@bp.post("/admin/approvals/<app_id>")
@require_role("admin")
def review_application(app_id: str):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in ("approved", "rejected"):
        return _error(400, 'Status must be "approved" or "rejected".')
    admin = current_user()
    now = _utcnow()

    # Everything below runs on one connection and commits once, or not at all.
    with transaction() as tx:
        row = tx.query_one(
            APPLICATION_SQL + " WHERE a.id = %s FOR UPDATE",
            (app_id,),
        )
        if not row:
            return _error(404, "Application not found.")
        if row["verification_status"] != "pending":
            return _error(409, f"This application was already {row['verification_status']}.")
        user = tx.query_one("SELECT * FROM users WHERE id = %s FOR UPDATE", (row["user_id"],))
        if user["role"] != row["role"]:
            return _error(409, "This application no longer matches the account's role.")

        tx.execute(
            "UPDATE verification_applications SET verification_status = %s WHERE id = %s",
            (status, app_id),
        )
        tx.execute("UPDATE users SET verification_status = %s WHERE id = %s", (status, user["id"]))

        if status == "approved":
            if user["role"] in ("customer", "courier"):
                # Same as the demo: approved customers and riders get an empty wallet.
                tx.execute("INSERT IGNORE INTO wallets (user_id, balance) VALUES (%s, 0)", (user["id"],))
            if user["role"] == "cafeteria" and not user["vendor_id"]:
                # An approved cafeteria gets its own vendor listing.
                vendor_id = _id("v")
                extra = row["extra"] or ""
                location = "" if extra.startswith("Owner:") else extra
                tx.execute(
                    """INSERT INTO vendors (id, name, location, distance_km, open_now, closes_at, queue_length)
                       VALUES (%s, %s, %s, 0.50, TRUE, '6:00 PM', 0)""",
                    (vendor_id, user["name"][:120], (location or "University campus")[:160]),
                )
                tx.execute("UPDATE users SET vendor_id = %s WHERE id = %s", (vendor_id, user["id"]))

        tx.execute(
            """INSERT INTO notifications (id, user_id, role, title, body, href, is_read, created_at)
               VALUES (%s, %s, NULL, %s, %s, NULL, FALSE, %s)""",
            (
                _id("n"),
                user["id"],
                "Account approved" if status == "approved" else "Verification rejected",
                "Welcome to J Eats! You can now sign in."
                if status == "approved"
                else "Your documents could not be verified.",
                now,
            ),
        )
        label = "rider" if row["role"] == "courier" else row["role"]
        tx.execute(
            "INSERT INTO system_logs (id, level, message, created_at) VALUES (%s, %s, %s, %s)",
            (
                _id("log"),
                "ok" if status == "approved" else "warn",
                f"Admin {status} {label} application: {row['name']} (by {admin['email']})",
                now,
            ),
        )
        row["verification_status"] = status

    docs = _documents([app_id])
    return jsonify(_application_json(row, docs[app_id]))


@bp.get("/admin/documents/<int:doc_id>")
@require_role("admin")
def download_document(doc_id: int):
    doc = query_one("SELECT name, file_url FROM verification_documents WHERE id = %s", (doc_id,))
    if not doc or not doc["file_url"]:
        return _error(404, "Document not found.")
    try:
        path = uploads.resolve(doc["file_url"])
    except uploads.UploadError:
        return _error(404, "Document not found.")
    if not path.is_file():
        return _error(404, "The document file is missing on the server.")
    resp = send_file(
        path,
        mimetype=uploads.content_type(doc["file_url"]),
        as_attachment=False,
        download_name=doc["name"],
        max_age=0,
    )
    resp.headers["Cache-Control"] = "private, no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
    return resp
