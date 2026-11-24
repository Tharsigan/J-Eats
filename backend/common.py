"""Small helpers shared by the route modules."""
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import current_app, g, jsonify

from db import query, query_one


def error(status: int, message: str):
    return jsonify(error=message), status


def utcnow() -> datetime:
    """Naive UTC datetime for DATETIME columns (all times are stored in UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def local_now() -> datetime:
    """The campus's local time (TIMEZONE in .env, default Asia/Colombo)."""
    return datetime.now(ZoneInfo(current_app.config["TIMEZONE"]))


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


def money(value) -> float:
    """DECIMAL -> number for JSON (Rs. amounts have at most 2 decimals)."""
    if value is None:
        return 0
    f = float(value)
    return int(f) if f.is_integer() else round(f, 2)


def settings(tx=None) -> dict:
    """The single platform_settings row (defaults if it is missing)."""
    sql = "SELECT * FROM platform_settings WHERE id = 1"
    row = tx.query_one(sql) if tx else query_one(sql)
    return row or {
        "delivery_fee": 100,
        "rider_payout": 150,
        "cash_cutoff_hour": 11,
        "ordering_open": True,
        "max_active_jobs_per_rider": 1,
    }


def has_column(table: str, column: str) -> bool:
    """True when the optional column exists (see database/migrations/).

    Cached per process: restart Flask after running a migration.
    """
    cache = current_app.extensions.setdefault("jeats_columns", {})
    key = (table, column)
    if key not in cache:
        row = query_one(
            "SELECT COUNT(*) AS n FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (table, column),
        )
        cache[key] = bool(row and row["n"])
    return cache[key]


def log_event(tx, level: str, message: str) -> None:
    tx.execute(
        "INSERT INTO system_logs (id, level, message, created_at) VALUES (%s, %s, %s, %s)",
        (new_id("log"), level, message[:2000], utcnow()),
    )


def notify(tx, *, user_id: str | None = None, role: str | None = None, title: str, body: str, href: str | None = None):
    """Queue a notification for one user, or for every user of a role."""
    if bool(user_id) == bool(role):
        raise ValueError("notify() needs exactly one of user_id or role")
    tx.execute(
        """INSERT INTO notifications (id, user_id, role, title, body, href, is_read, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s)""",
        (new_id("n"), user_id, role, title[:160], body, href, utcnow()),
    )


def notify_vendor(tx, vendor_id: str | None, title: str, body: str, href: str | None = None):
    """Notify everyone who operates a vendor (its cafeteria accounts)."""
    if not vendor_id:
        return
    for u in tx.query("SELECT id FROM users WHERE role = 'cafeteria' AND vendor_id = %s", (vendor_id,)):
        notify(tx, user_id=u["id"], title=title, body=body, href=href)


def short_name(name: str) -> str:
    """'Nethmi Perera' -> 'Nethmi P.' (how reviews and orders show a customer)."""
    parts = (name or "").split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else (name or "")
