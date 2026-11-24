"""Cafeteria dashboard: the signed-in operator's vendor, menu, inventory and queue.

GET   /api/cafeteria/vendor               -> my vendor
PATCH /api/cafeteria/vendor               {openNow?, closesAt?, location?}
GET   /api/cafeteria/menu                 -> my menu items
POST  /api/cafeteria/menu                 {name, category, description, price, stock, maxPerOrder, image?, prepMin, prepMax}
DELETE /api/cafeteria/menu/<id>
GET   /api/cafeteria/inventory            -> [{id, name, stock, price, available}]
PATCH /api/cafeteria/inventory/<id>       {price?, stock?, available?, image?, ...}
GET   /api/cafeteria/queue                -> {queueLength}
POST  /api/cafeteria/queue                {n}
GET   /api/media/menu/<file>              -> an uploaded food photo (public)

Orders and stats for the cafeteria live in routes/orders.py.
"""
import re

from flask import Blueprint, jsonify, request, send_file

import uploads
from auth import current_user, require_role
from common import error, has_column, log_event, new_id, notify, settings
from db import query, query_one, transaction
from .menu import menu_item_json, vendor_json

bp = Blueprint("cafeteria", __name__)


def my_vendor_id() -> str | None:
    return current_user()["vendor_id"]


def _no_vendor():
    return error(404, "No cafeteria is linked to this account yet.")


def _inventory_row(m: dict) -> dict:
    j = menu_item_json(m, 0)
    return {"id": j["id"], "name": j["name"], "stock": j["stock"], "price": j["price"], "available": j["available"]}


def _int(value, name: str, minimum: int = 0) -> int:
    try:
        n = round(float(value))
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number.")
    return max(minimum, n)


# ---------------------------------------------------------------- vendor
@bp.get("/cafeteria/vendor")
@require_role("cafeteria")
def get_vendor():
    vid = my_vendor_id()
    row = query_one("SELECT * FROM vendors WHERE id = %s", (vid,)) if vid else None
    if not row:
        return _no_vendor()
    return jsonify(vendor_json(row))


@bp.patch("/cafeteria/vendor")
@require_role("cafeteria")
def update_vendor():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    body = request.get_json(silent=True) or {}
    with transaction() as tx:
        vendor = tx.query_one("SELECT * FROM vendors WHERE id = %s FOR UPDATE", (vid,))
        if not vendor:
            return _no_vendor()
        open_now, closes_at, location = vendor["open_now"], vendor["closes_at"], vendor["location"]
        if "openNow" in body:
            open_now = bool(body["openNow"])
        if "closesAt" in body:
            closes_at = str(body["closesAt"] or "").strip()[:10] or closes_at
        if "location" in body:
            location = str(body["location"] or "").strip()[:160] or location
        tx.execute(
            "UPDATE vendors SET open_now = %s, closes_at = %s, location = %s WHERE id = %s",
            (open_now, closes_at, location, vid),
        )
        if "openNow" in body and bool(open_now) != bool(vendor["open_now"]):
            log_event(tx, "info", f"{vendor['name']} is now {'open' if open_now else 'closed'}")
        row = tx.query_one("SELECT * FROM vendors WHERE id = %s", (vid,))
    return jsonify(vendor_json(row))


# ---------------------------------------------------------------- menu
@bp.get("/cafeteria/menu")
@require_role("cafeteria")
def my_menu():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    fee = settings()["delivery_fee"]
    return jsonify([menu_item_json(r, fee) for r in query("SELECT * FROM menu_items WHERE vendor_id = %s ORDER BY name", (vid,))])


@bp.get("/cafeteria/inventory")
@require_role("cafeteria")
def inventory():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    return jsonify([_inventory_row(r) for r in query("SELECT * FROM menu_items WHERE vendor_id = %s ORDER BY name", (vid,))])


def _slugify(name: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))[:120] or "item"


@bp.post("/cafeteria/menu")
@require_role("cafeteria")
def create_item():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    body = request.get_json(silent=True) or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return error(400, "Item name is required.")
    if len(name) > 120:
        return error(400, "Item names can be up to 120 characters.")
    try:
        price = float(body.get("price"))
    except (TypeError, ValueError):
        price = 0
    if not price > 0:
        return error(400, "Price must be greater than zero.")
    try:
        stock = _int(body.get("stock", 0), "Stock")
        max_per = _int(body.get("maxPerOrder", 5), "Max per order", 1)
        prep_min = _int(body.get("prepMin", 10), "Prep time", 1)
        prep_max = max(prep_min, _int(body.get("prepMax", prep_min), "Prep time", 1))
    except ValueError as exc:
        return error(400, str(exc))
    try:
        image_url = uploads.save_menu_photo(body.get("image"))
    except uploads.UploadError as exc:
        return error(400, str(exc))

    item_id = new_id("m")
    with transaction() as tx:
        vendor = tx.query_one("SELECT name FROM vendors WHERE id = %s", (vid,))
        slug = _slugify(name)
        if tx.query_one("SELECT 1 FROM menu_items WHERE slug = %s", (slug,)):
            slug = f"{slug[:110]}-{item_id[-6:]}"
        cols = ["id", "vendor_id", "name", "slug", "category", "description", "price", "image_url", "rating",
                "review_count", "prep_min", "prep_max", "stock", "max_per_order", "allergens", "available"]
        vals = [item_id, vid, name, slug, (str(body.get("category") or "").strip() or "Snacks")[:60],
                str(body.get("description") or "").strip() or "Freshly prepared on campus.", round(price), image_url,
                0, 0, prep_min, prep_max, stock, max_per, "Contact the vendor for specific dietary needs.", True]
        if has_column("menu_items", "tag"):
            cols.append("tag")
            vals.append("New")
        tx.execute(
            f"INSERT INTO menu_items ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            tuple(vals),
        )
        log_event(tx, "ok", f"{vendor['name'] if vendor else 'Cafeteria'} added {name} (Rs. {round(price):,})")
        row = tx.query_one("SELECT * FROM menu_items WHERE id = %s", (item_id,))
    return jsonify(menu_item_json(row, settings()["delivery_fee"])), 201


EDITABLE = {"name", "category", "description", "price", "stock", "maxPerOrder", "available", "image", "allergens", "prepMinutes"}


@bp.patch("/cafeteria/inventory/<item_id>")
@require_role("cafeteria")
def patch_item(item_id: str):
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    body = {k: v for k, v in (request.get_json(silent=True) or {}).items() if k in EDITABLE}
    sets: dict[str, object] = {}
    try:
        if "price" in body:
            price = float(body["price"])
            if not price > 0:
                raise ValueError("Price must be greater than zero.")
            sets["price"] = round(price, 2)
        if "stock" in body:
            sets["stock"] = _int(body["stock"], "Stock")
        if "maxPerOrder" in body:
            sets["max_per_order"] = _int(body["maxPerOrder"], "Max per order", 1)
        if "available" in body:
            sets["available"] = bool(body["available"])
        if "name" in body:
            name = str(body["name"] or "").strip()
            if not name or len(name) > 120:
                raise ValueError("Item names need 1 to 120 characters.")
            sets["name"] = name
        if "category" in body:
            sets["category"] = (str(body["category"] or "").strip() or "Snacks")[:60]
        if "description" in body:
            sets["description"] = str(body["description"] or "").strip()
        if "allergens" in body:
            sets["allergens"] = str(body["allergens"] or "").strip()[:255]
        if "prepMinutes" in body:
            lo, hi = (_int(x, "Prep time", 1) for x in body["prepMinutes"])
            sets["prep_min"], sets["prep_max"] = lo, max(lo, hi)
        if "image" in body:
            sets["image_url"] = uploads.save_menu_photo(body["image"])
    except (TypeError, ValueError, uploads.UploadError) as exc:
        return error(400, str(exc) if str(exc) else "Check the values and try again.")

    with transaction() as tx:
        item = tx.query_one("SELECT * FROM menu_items WHERE id = %s AND vendor_id = %s FOR UPDATE", (item_id, vid))
        if not item:
            return error(404, "Menu item not found.")
        if sets:
            assignments = ", ".join(f"{col} = %s" for col in sets)
            tx.execute(f"UPDATE menu_items SET {assignments} WHERE id = %s", (*sets.values(), item_id))
        if "available" in sets and bool(sets["available"]) != bool(item["available"]):
            log_event(tx, "info", f"{item['name']} {'shown on' if sets['available'] else 'hidden from'} the menu")
        if "stock" in sets and sets["stock"] <= 3:
            log_event(tx, "warn", f"Stock low: {item['name']} ({sets['stock']})")
        row = tx.query_one("SELECT * FROM menu_items WHERE id = %s", (item_id,))
    return jsonify(_inventory_row(row))


@bp.delete("/cafeteria/menu/<item_id>")
@require_role("cafeteria")
def delete_item(item_id: str):
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    with transaction() as tx:
        item = tx.query_one("SELECT * FROM menu_items WHERE id = %s AND vendor_id = %s FOR UPDATE", (item_id, vid))
        if not item:
            return error(404, "Menu item not found.")
        # Past orders must keep pointing at the item, so ordered items can only be hidden.
        if tx.query_one("SELECT 1 FROM order_lines WHERE item_id = %s LIMIT 1", (item_id,)):
            return error(409, "This item is part of past orders, so it can't be deleted. Hide it from the menu instead.")
        tx.execute("DELETE FROM menu_items WHERE id = %s", (item_id,))
        log_event(tx, "info", f"{item['name']} removed from the menu")
    return jsonify(ok=True)


# ---------------------------------------------------------------- queue
@bp.get("/cafeteria/queue")
@require_role("cafeteria")
def get_queue():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    row = query_one("SELECT queue_length FROM vendors WHERE id = %s", (vid,))
    return jsonify(queueLength=row["queue_length"] if row else 0)


@bp.post("/cafeteria/queue")
@require_role("cafeteria")
def broadcast_queue():
    vid = my_vendor_id()
    if not vid:
        return _no_vendor()
    try:
        n = _int((request.get_json(silent=True) or {}).get("n"), "Queue length")
    except ValueError as exc:
        return error(400, str(exc))
    n = min(n, 9999)
    with transaction() as tx:
        vendor = tx.query_one("SELECT name FROM vendors WHERE id = %s FOR UPDATE", (vid,))
        if not vendor:
            return _no_vendor()
        tx.execute("UPDATE vendors SET queue_length = %s WHERE id = %s", (n, vid))
        log_event(tx, "info", f"Queue broadcast {vendor['name']} → {n}")
        notify(tx, role="customer", title=f"{vendor['name']} queue update", body=f"{n} people waiting right now.", href="/customer/explore")
    return jsonify(queueLength=n)


# ---------------------------------------------------------------- photos
@bp.get("/media/menu/<name>")
def menu_photo(name: str):
    try:
        path = uploads.menu_photo_path(name)
    except uploads.UploadError:
        return error(404, "Photo not found.")
    if not path.is_file():
        return error(404, "Photo not found.")
    resp = send_file(path, mimetype=uploads.ALLOWED[name.rsplit(".", 1)[-1]][0], max_age=86400)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
