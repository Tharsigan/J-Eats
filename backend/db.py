"""MySQL / MariaDB connection helpers.

Each web request gets its own connection (stored on Flask's `g`), and it is
closed automatically when the request finishes.

Usage inside a route:
    from db import query, query_one, execute, transaction

    items = query("SELECT * FROM menu_items WHERE vendor_id = %s", (vendor_id,))
    user = query_one("SELECT * FROM users WHERE email = %s", (email,))
    new_id = execute("INSERT INTO favourites (user_id, item_id) VALUES (%s, %s)", (uid, iid))

    # Several writes that must succeed or fail together:
    with transaction() as tx:
        tx.execute("UPDATE ...", (...))
        tx.execute("INSERT ...", (...))
    # -> one COMMIT at the end, or ROLLBACK if anything raised

Always pass values with %s placeholders (never build SQL with f-strings),
which keeps the app safe from SQL injection.
"""
from contextlib import contextmanager

import pymysql
import pymysql.cursors
from flask import current_app, g


def get_db() -> pymysql.connections.Connection:
    """Return this request's database connection, opening it if needed."""
    if "db" not in g:
        cfg = current_app.config
        g.db = pymysql.connect(
            host=cfg["DB_HOST"],
            port=cfg["DB_PORT"],
            user=cfg["DB_USER"],
            password=cfg["DB_PASSWORD"],
            database=cfg["DB_NAME"],
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,  # rows come back as dicts
            autocommit=False,
            connect_timeout=5,
        )
    return g.db


def close_db(_exc=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _in_transaction() -> bool:
    return bool(g.get("db_tx_depth"))


def query(sql: str, params=None) -> list[dict]:
    """Run a SELECT and return all rows as a list of dicts."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def query_one(sql: str, params=None) -> dict | None:
    """Run a SELECT and return the first row (or None)."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(sql: str, params=None) -> int:
    """Run an INSERT/UPDATE/DELETE, commit it, and return the new row id.

    Inside `with transaction():` this does NOT commit on its own; the
    surrounding transaction commits (or rolls back) everything at once.
    """
    db = get_db()
    if _in_transaction():
        with db.cursor() as cur:
            cur.execute(sql, params)
            return cur.lastrowid
    try:
        with db.cursor() as cur:
            cur.execute(sql, params)
            last_id = cur.lastrowid
        db.commit()
        return last_id
    except Exception:
        db.rollback()
        raise


class Tx:
    """The handle `transaction()` yields. Every call uses the SAME connection
    and none of them commit; the transaction commits once at the end."""

    def __init__(self, conn: pymysql.connections.Connection):
        self.conn = conn

    def query(self, sql: str, params=None) -> list[dict]:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def query_one(self, sql: str, params=None) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def execute(self, sql: str, params=None) -> int:
        """Run a write and return the new row id (AUTO_INCREMENT tables)."""
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.lastrowid

    def executemany(self, sql: str, rows) -> int:
        with self.conn.cursor() as cur:
            return cur.executemany(sql, rows)


@contextmanager
def transaction():
    """Run several statements atomically on this request's connection.

    Commits once when the block finishes, rolls back if it raises.
    Nested `transaction()` blocks join the outer one.
    """
    conn = get_db()
    depth = g.get("db_tx_depth", 0)
    if depth == 0:
        # Drop any implicit snapshot left by earlier reads so this starts fresh.
        conn.rollback()
        conn.begin()
    g.db_tx_depth = depth + 1
    try:
        yield Tx(conn)
    except BaseException:
        g.db_tx_depth = depth
        if depth == 0:
            conn.rollback()
        raise
    g.db_tx_depth = depth
    if depth == 0:
        conn.commit()


def init_app(app) -> None:
    """Tell Flask to close the connection at the end of every request."""
    app.teardown_appcontext(close_db)
