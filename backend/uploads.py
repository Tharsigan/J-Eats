"""Verification document storage.

Files are saved under UPLOAD_FOLDER/verification/ with random names, outside
any public folder. They are only ever sent back through the admin-only route
GET /api/admin/documents/<id>.
"""
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage

SUBDIR = "verification"

# extension -> (content type, check on the first bytes of the file)
ALLOWED = {
    "pdf": ("application/pdf", lambda b: b.startswith(b"%PDF-")),
    "png": ("image/png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    "jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    "webp": ("image/webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}
EXT_ALIASES = {"jpeg": "jpg"}
STORED_NAME = re.compile(r"^verification/[0-9a-f]{32}\.(pdf|png|jpg|webp)$")


class UploadError(ValueError):
    pass


@dataclass
class Upload:
    data: bytes
    ext: str
    display_name: str
    kind: str


def _detect(data: bytes) -> str | None:
    for ext, (_, check) in ALLOWED.items():
        if check(data[:16]):
            return ext
    return None


def read_upload(file: FileStorage | None, kind: str) -> Upload | None:
    """Validate one uploaded file. Returns None when no file was sent."""
    if file is None or not file.filename:
        return None
    max_bytes = current_app.config["MAX_DOCUMENT_MB"] * 1024 * 1024
    data = file.read(max_bytes + 1)
    if not data:
        return None
    if len(data) > max_bytes:
        raise UploadError(f"Each document must be {current_app.config['MAX_DOCUMENT_MB']} MB or smaller.")
    claimed = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    claimed = EXT_ALIASES.get(claimed, claimed)
    actual = _detect(data)
    # The file's real contents decide the type, and they must agree with its name.
    if actual is None or claimed not in ALLOWED or claimed != actual:
        raise UploadError("Documents must be PDF, JPG, PNG or WebP files.")
    display = os.path.basename(file.filename.replace("\\", "/")).strip()[:160] or f"document.{actual}"
    kind = (kind or display).strip()[:80]
    return Upload(data=data, ext=actual, display_name=display, kind=kind)


def _root() -> Path:
    return Path(current_app.config["UPLOAD_FOLDER"]).resolve()


def save(upload: Upload) -> str:
    """Write the file and return its stored path, e.g. 'verification/<hex>.pdf'."""
    folder = _root() / SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    rel = f"{SUBDIR}/{uuid.uuid4().hex}.{upload.ext}"
    with open(_root() / rel, "xb") as fh:
        fh.write(upload.data)
    return rel


def remove(paths: list[str]) -> None:
    for rel in paths:
        try:
            resolve(rel).unlink(missing_ok=True)
        except (OSError, UploadError):
            pass


def resolve(rel: str) -> Path:
    """Map a stored path to the file on disk, refusing anything outside the folder."""
    if not rel or not STORED_NAME.match(rel):
        raise UploadError("Unknown document path.")
    path = (_root() / rel).resolve()
    if _root() not in path.parents:
        raise UploadError("Unknown document path.")
    return path


def content_type(rel: str) -> str:
    return ALLOWED[rel.rsplit(".", 1)[-1]][0]


# ---------------------------------------------------------------- food photos
MENU_SUBDIR = "menu"
MENU_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|webp)$")
MAX_PHOTO_BYTES = 400 * 1024  # the browser shrinks photos to 800px JPEGs first
UNSPLASH_PREFIX = "https://images.unsplash.com/"


def save_menu_photo(image: str | None) -> str | None:
    """Turn the frontend's image value into what menu_items.image_url stores.

    - "" / None          -> None (use the default photo)
    - Unsplash URL       -> kept as is
    - data:image/...     -> decoded, checked, saved; returns "/media/menu/<file>"
    - "/media/menu/..."  -> an already-saved photo, kept as is
    """
    import base64
    import binascii

    value = (image or "").strip()
    if not value:
        return None
    if value.startswith(UNSPLASH_PREFIX):
        if len(value) > 255:
            raise UploadError("That image link is too long.")
        return value
    if value.startswith("/media/menu/") and MENU_NAME.match(value.rsplit("/", 1)[-1]):
        return value
    if not value.startswith("data:image/") or ";base64," not in value:
        raise UploadError("Upload the photo as a JPG or PNG file.")
    try:
        data = base64.b64decode(value.split(";base64,", 1)[1], validate=True)
    except (binascii.Error, ValueError):
        raise UploadError("That photo could not be read. Try another file.")
    if len(data) > MAX_PHOTO_BYTES:
        raise UploadError("That photo is too large. Choose a smaller image.")
    ext = _detect(data)
    if ext not in ("png", "jpg", "webp"):
        raise UploadError("Upload the photo as a JPG or PNG file.")
    folder = _root() / MENU_SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(folder / name, "xb") as fh:
        fh.write(data)
    return f"/media/menu/{name}"


def menu_photo_path(name: str) -> Path:
    if not MENU_NAME.match(name or ""):
        raise UploadError("Unknown photo.")
    path = (_root() / MENU_SUBDIR / name).resolve()
    if _root() not in path.parents:
        raise UploadError("Unknown photo.")
    return path

