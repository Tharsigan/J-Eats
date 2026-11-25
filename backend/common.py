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


# ---------------------------------------------------------------- money
class InsufficientFunds(Exception):
    pass


def short_ref(prefix: str) -> str:
    import secrets

    return f"{prefix}-{secrets.token_hex(3).upper()}"


def lock_wallet(tx, user_id: str) -> dict:
    """Create the wallet if needed and lock it for the rest of the transaction."""
    tx.execute("INSERT IGNORE INTO wallets (user_id, balance) VALUES (%s, 0)", (user_id,))
    return tx.query_one("SELECT * FROM wallets WHERE user_id = %s FOR UPDATE", (user_id,))


def wallet_txn(tx, user_id: str, *, label: str, amount, type: str, kind: str, ref: str | None = None) -> float:
    """Credit or debit a wallet and record the transaction. Returns the new balance.

    Raises InsufficientFunds (nothing written) when a debit is larger than the balance.
    """
    wallet = lock_wallet(tx, user_id)
    amount = round(float(amount), 2)
    balance = float(wallet["balance"])
    new_balance = round(balance + amount if type == "credit" else balance - amount, 2)
    if new_balance < 0:
        raise InsufficientFunds()
    tx.execute("UPDATE wallets SET balance = %s WHERE user_id = %s", (new_balance, user_id))
    tx.execute(
        """INSERT INTO wallet_transactions (id, user_id, label, amount, type, kind, ref, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (new_id("w"), user_id, label[:160], amount, type, kind, ref, utcnow()),
    )
    return new_balance


def add_ledger(tx, *, ref: str, party: str, amount, type: str) -> None:
    tx.execute(
        "INSERT INTO ledger_entries (id, ref, party, amount, type, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (new_id("l"), ref[:40], (party or "")[:120], round(float(amount), 2), type, utcnow()),
    )


def rs(amount) -> str:
    """Rs. 1,250 (how the frontend's formatRs shows money)."""
    f = float(amount)
    return f"Rs. {f:,.0f}" if f.is_integer() else f"Rs. {f:,.2f}"
