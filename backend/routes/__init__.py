"""All route groups (blueprints) live in this package.

Every route is served under /api to match NEXT_PUBLIC_API_URL in the frontend
(http://localhost:5000/api). Add new groups here as features move off the mock.
"""
from flask import Flask

from .admin import bp as admin_bp
from .admin_ops import bp as admin_ops_bp
from .auth import bp as auth_bp
from .cafeteria import bp as cafeteria_bp
from .courier import bp as courier_bp
from .health import bp as health_bp
from .menu import bp as menu_bp
from .notifications import bp as notifications_bp
from .orders import bp as orders_bp
from .wallet import bp as wallet_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(menu_bp, url_prefix="/api")
    app.register_blueprint(cafeteria_bp, url_prefix="/api")
    app.register_blueprint(wallet_bp, url_prefix="/api")
    app.register_blueprint(orders_bp, url_prefix="/api")
    app.register_blueprint(courier_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(admin_ops_bp, url_prefix="/api")
