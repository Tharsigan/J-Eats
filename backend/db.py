"""MySQL connection helpers.

Each web request gets its own connection (stored on Flask's `g`), and it is
closed automatically when the request finishes.

Usage inside a route:
    from db import query, query_one, execute

    items = query("SELECT * FROM menu_items WHERE vendor_id = %s", (vendor_id,))
    user = query_one("SELECT * FROM users WHERE email = %s", (email,))
    new_id = execute("INSERT INTO favourites (user_id, item_id) VALUES (%s, %s)", (uid, iid))

Always pass values with %s placeholders (never build SQL with f-strings),
which keeps the app safe from SQL injection.
"""
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
    """Run an INSERT/UPDATE/DELETE, commit it, and return the new row id."""
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(sql, params)
            last_id = cur.lastrowid
        db.commit()
        return last_id
    except Exception:
        db.rollback()
        raise


def init_app(app) -> None:
    """Tell Flask to close the connection at the end of every request."""
    app.teardown_appcontext(close_db)
