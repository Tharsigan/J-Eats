"""Notifications for the signed-in user: their own plus broadcasts to their role.

GET  /api/notifications              newest 40, each with `read` for this user
POST /api/notifications/<id>/read
POST /api/notifications/read-all
"""
from flask import Blueprint, jsonify

from auth import current_user, require_auth
from common import error, utcnow
from db import query, transaction
from serializers import iso

bp = Blueprint("notifications", __name__)

VISIBLE = "(n.user_id = %s OR (n.user_id IS NULL AND n.role = %s))"


def notification_json(row: dict) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "at": iso(row["created_at"]),
        "read": bool(row["read_flag"]),
        "userId": row["user_id"],
        "role": row["role"],
        "href": row["href"],
        "createdAt": iso(row["created_at"]),
    }
    return {k: v for k, v in out.items() if v is not None}


@bp.get("/notifications")
@require_auth
def list_notifications():
    user = current_user()
    rows = query(
        f"""SELECT n.*, IF(n.user_id IS NULL, r.user_id IS NOT NULL, n.is_read) AS read_flag
            FROM notifications n
            LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE {VISIBLE}
            ORDER BY n.created_at DESC, n.id DESC LIMIT 40""",
        (user["id"], user["id"], user["role"]),
    )
    return jsonify([notification_json(r) for r in rows])


def _mark(tx, user: dict, rows: list[dict]) -> None:
    now = utcnow()
    own = [r["id"] for r in rows if r["user_id"]]
    shared = [r["id"] for r in rows if not r["user_id"]]
    if own:
        marks = ", ".join(["%s"] * len(own))
        tx.execute(f"UPDATE notifications SET is_read = TRUE WHERE id IN ({marks})", tuple(own))
    if shared:
        tx.executemany(
            "INSERT IGNORE INTO notification_reads (notification_id, user_id, read_at) VALUES (%s, %s, %s)",
            [(nid, user["id"], now) for nid in shared],
        )


@bp.post("/notifications/<notification_id>/read")
@require_auth
def mark_read(notification_id: str):
    user = current_user()
    with transaction() as tx:
        rows = tx.query(f"SELECT n.id, n.user_id FROM notifications n WHERE n.id = %s AND {VISIBLE}",
                        (notification_id, user["id"], user["role"]))
        if not rows:
            return error(404, "Notification not found.")
        _mark(tx, user, rows)
    return jsonify(ok=True)


@bp.post("/notifications/read-all")
@require_auth
def mark_all_read():
    user = current_user()
    with transaction() as tx:
        rows = tx.query(f"SELECT n.id, n.user_id FROM notifications n WHERE {VISIBLE}", (user["id"], user["role"]))
        _mark(tx, user, rows)
    return jsonify(ok=True)
