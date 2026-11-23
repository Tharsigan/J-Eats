"""Settings for the J Eats API, read from the .env file in this folder."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (if it exists) into environment variables.
load_dotenv(Path(__file__).with_name(".env"))


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    # Flask
    DEBUG = _bool(os.getenv("FLASK_DEBUG"), default=True)
    PORT = int(os.getenv("PORT", "5000"))

    # MySQL (XAMPP defaults)
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "j_eats")

    # Which websites may call this API from the browser (the Next.js app)
    FRONTEND_ORIGINS = [
        o.strip()
        for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]

    # Phase 2 placeholders
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-to-a-long-random-string")
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
