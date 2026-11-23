"""Health checks: is the API running, and can it reach MySQL?"""
from flask import Blueprint, current_app, jsonify

from db import query, query_one

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    """GET /api/health -> the API is up (does not touch the database)."""
    return jsonify(status="ok", service="j-eats-api")


@bp.get("/health/db")
def health_db():
    """GET /api/health/db -> connects to MySQL and counts rows in a few tables."""
    try:
        version = query_one("SELECT VERSION() AS version")["version"]
        tables = [list(row.values())[0] for row in query("SHOW TABLES")]
        counts = {}
        for table in ("users", "vendors", "menu_items", "orders"):
            if table in tables:
                counts[table] = query_one(f"SELECT COUNT(*) AS n FROM `{table}`")["n"]
        return jsonify(
            status="ok",
            database=current_app.config["DB_NAME"],
            mysql_version=version,
            table_count=len(tables),
            row_counts=counts,
        )
    except Exception as exc:  # show a clear message instead of a crash page
        return (
            jsonify(
                status="error",
                database=current_app.config["DB_NAME"],
                message=str(exc),
                hint="Is MySQL running in XAMPP, and did you import database/schema.sql and seed.sql?",
            ),
            503,
        )
