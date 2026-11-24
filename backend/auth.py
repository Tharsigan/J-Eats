"""Login tokens (JWT), password hashing and role checks.

    from auth import require_role, current_user

    @bp.get("/admin/something")
    @require_role("admin")
    def something():
        admin = current_user()   # the users row of whoever is signed in
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db import query_one

log = logging.getLogger(__name__)

ALGORITHM = "HS256"
ROLES = ("customer", "courier", "cafeteria", "admin")
_PLACEHOLDER_SECRETS = {"", "change-me-to-a-long-random-string"}

# A real hash of a random string, used to keep login timing the same whether
# or not the account exists (so response time doesn't reveal valid emails).
_DUMMY_HASH = generate_password_hash(secrets.token_urlsafe(16))


def init_app(app) -> None:
    """Make sure tokens are signed with a strong secret."""
    secret = app.config.get("JWT_SECRET") or ""
    if secret in _PLACEHOLDER_SECRETS or len(secret) < 32:
        if not app.config.get("DEBUG") and not app.config.get("TESTING"):
            raise RuntimeError(
                "JWT_SECRET is missing or too short. Put a random string of 32+ characters in backend/.env "
                '(python -c "import secrets; print(secrets.token_urlsafe(48))").'
            )
        app.config["JWT_SECRET"] = secrets.token_urlsafe(48)
        log.warning(
            "JWT_SECRET is not set (or is the example value). Using a temporary random secret: "
            "everyone is signed out whenever the API restarts. Set JWT_SECRET in backend/.env."
        )


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    return generate_password_hash(password)  # Werkzeug scrypt/pbkdf2 with a random salt


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        check_password_hash(_DUMMY_HASH, password)
        return False
    try:
        return check_password_hash(password_hash, password)
    except ValueError:  # unknown / malformed hash format
        return False


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check (used when no account matched)."""
    check_password_hash(_DUMMY_HASH, password)


# ---------------------------------------------------------------- tokens
def issue_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=current_app.config["JWT_EXPIRES_MINUTES"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Return the token's claims, or raise jwt.InvalidTokenError (bad signature, expired, ...)."""
    return jwt.decode(
        token,
        current_app.config["JWT_SECRET"],
        algorithms=[ALGORITHM],  # never accept "none" or other algorithms
        options={"require": ["sub", "role", "exp", "iat"]},
        leeway=10,
    )


def _bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    return token.strip() if scheme.lower() == "bearer" else ""


def _error(status: int, message: str):
    return jsonify(error=message), status


def current_user() -> dict | None:
    return g.get("current_user")


def require_auth(view):
    """Allow any signed-in, active, approved user."""
    return require_role(*ROLES)(view)


def require_role(*roles: str):
    """Allow only signed-in users whose role is one of `roles`.

    The user is re-read from the database on every request, so a suspended,
    rejected or deleted account loses access straight away, and a role change
    in the database wins over the role inside an old token.
    """

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            token = _bearer_token()
            if not token:
                return _error(401, "Please sign in.")
            try:
                claims = decode_token(token)
            except jwt.ExpiredSignatureError:
                return _error(401, "Your session has expired. Please sign in again.")
            except jwt.InvalidTokenError:
                return _error(401, "Your session is not valid. Please sign in again.")

            user = query_one("SELECT * FROM users WHERE id = %s", (claims["sub"],))
            if not user or user["role"] != claims["role"]:
                return _error(401, "Your session is not valid. Please sign in again.")
            if user["status"] == "suspended":
                return _error(403, "This account has been suspended by an administrator.")
            if user["role"] != "admin" and user["verification_status"] != "approved":
                return _error(403, "This account has not been approved yet.")
            if user["role"] not in roles:
                return _error(403, "You do not have permission to do that.")
            g.current_user = user
            return view(*args, **kwargs)

        return wrapper

    return decorator


def optional_user() -> dict | None:
    """The signed-in, active user if a valid token was sent, else None (for public pages)."""
    token = _bearer_token()
    if not token:
        return None
    try:
        claims = decode_token(token)
    except jwt.InvalidTokenError:
        return None
    user = query_one("SELECT * FROM users WHERE id = %s", (claims["sub"],))
    if not user or user["role"] != claims["role"] or user["status"] == "suspended":
        return None
    return user
