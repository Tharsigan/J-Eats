"""All route groups (blueprints) live in this package.

Phase 2 will add auth.py, menu.py, orders.py, ... here and register them in
register_routes() below. Every route is served under /api to match
NEXT_PUBLIC_API_URL in the frontend (http://localhost:5000/api).
"""
from flask import Flask

from .health import bp as health_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_bp, url_prefix="/api")
