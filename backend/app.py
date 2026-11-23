"""J Eats Flask API - entry point.

Run it with:  python app.py   (then open http://localhost:5000/api/health)
"""
from flask import Flask, jsonify
from flask_cors import CORS

import db
from config import Config
from routes import register_routes


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Let the Next.js frontend (localhost:3000) call /api/* from the browser.
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    db.init_app(app)
    register_routes(app)

    # Return JSON (not HTML) for unknown routes and server errors.
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify(error="Not found"), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify(error="Internal server error"), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=app.config["PORT"], debug=app.config["DEBUG"])
