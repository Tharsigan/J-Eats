"""Public menu, vendors, reviews, time slots and favourites.

GET  /api/menu                     -> every menu item
GET  /api/menu/<id or slug>        -> one item
GET  /api/menu/<id>/related        -> up to 3 similar items
GET  /api/menu/<id>/reviews        -> reviews for one item (newest first)
POST /api/menu/<id>/reviews        {rating, body, orderId?}  (customers)
GET  /api/reviews                  -> every review
GET  /api/vendors                  -> vendors with their queue length
GET  /api/vendors/<id>             -> one vendor
GET  /api/slots?date=yyyy-mm-dd    -> pickup / delivery slots
GET  /api/favourites               -> the signed-in user's favourite item ids
POST /api/favourites/<item_id>     -> toggle a favourite
"""
from datetime import date

from flask import Blueprint, jsonify, request

from auth import current_user, optional_user, require_auth, require_role
from common import error, has_column, local_now, log_event, money, new_id, notify_vendor, settings, short_name, utcnow
from db import query, query_one, transaction
from serializers import iso

bp = Blueprint("menu", __name__)

DEFAULT_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"
SLOT_TIMES = ["08:30", "10:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
SLOT_CAPACITY = 6


def menu_item_json(row: dict, delivery_fee) -> dict:
    tag = row.get("tag")
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "category": row["category"],
        "description": row["description"] or "",
        "price": money(row["price"]),
        "currency": "LKR",
        "image": row["image_url"] or DEFAULT_IMAGE,
        "rating": float(row["rating"]),
        "reviewCount": row["review_count"],
        "prepMinutes": [row["prep_min"], row["prep_max"]],
        "deliveryFrom": money(delivery_fee),
        "stock": row["stock"],
        "maxPerOrder": row["max_per_order"],
        # "Campus favourite" badge (menu_items.featured, added by the optional migration).
        "favourite": bool(row.get("featured", False)),
        "tags": [tag] if tag else [],
        "vendorId": row["vendor_id"],
        "allergens": row["allergens"] or "",
        "available": bool(row["available"]),
    }


def vendor_json(row: dict, with_queue: bool = False) -> dict:
    out = {
        "id": row["id"],
        "name": row["name"],
        "location": row["location"],
        "distanceKm": float(row["distance_km"]),
        "openNow": bool(row["open_now"]),
        "closesAt": row["closes_at"],
    }
    if with_queue:
        out["queue"] = row["queue_length"]
    return out


def review_json(row: dict) -> dict:
    created = row["created_at"]
    days = max(0, (utcnow().date() - created.date()).days) if created else 0
    out = {
        "id": row["id"],
        "itemId": row["item_id"],
        "author": row["author_name"],
        "rating": row["rating"],
        "body": row["body"],
        "daysAgo": days,
        "verified": bool(row["verified"]),
        "userId": row["user_id"],
        "createdAt": iso(created),
    }
    return {k: v for k, v in out.items() if v is not None}


def _fee() -> float:
    return settings()["delivery_fee"]


def _find_item(id_or_slug: str) -> dict | None:
    return query_one("SELECT * FROM menu_items WHERE id = %s OR slug = %s LIMIT 1", (id_or_slug, id_or_slug))


@bp.get("/menu")
def list_menu():
    fee = _fee()
    return jsonify([menu_item_json(r, fee) for r in query("SELECT * FROM menu_items ORDER BY vendor_id, name")])


@bp.get("/menu/<item_id>")
def get_menu_item(item_id: str):
    row = _find_item(item_id)
    if not row:
        return error(404, "Menu item not found.")
    return jsonify(menu_item_json(row, _fee()))


@bp.get("/menu/<item_id>/related")
def related(item_id: str):
    item = _find_item(item_id)
    vendor = item["vendor_id"] if item else None
    rows = query(
        "SELECT * FROM menu_items WHERE id <> %s AND available = TRUE "
        "ORDER BY (vendor_id = %s) DESC, rating DESC, name LIMIT 3",
        (item["id"] if item else item_id, vendor),
    )
    fee = _fee()
    return jsonify([menu_item_json(r, fee) for r in rows])


@bp.get("/reviews")
def all_reviews():
    return jsonify([review_json(r) for r in query("SELECT * FROM reviews ORDER BY created_at DESC, id")])


@bp.get("/menu/<item_id>/reviews")
def item_reviews(item_id: str):
    item = _find_item(item_id)
    if not item:
        return jsonify([])
    rows = query("SELECT * FROM reviews WHERE item_id = %s ORDER BY created_at DESC, id", (item["id"],))
    return jsonify([review_json(r) for r in rows])


@bp.post("/menu/<item_id>/reviews")
@require_role("customer")
def add_review(item_id: str):
    body = request.get_json(silent=True) or {}
    user = current_user()
    text = str(body.get("body") or "").strip()
    try:
        rating = min(5, max(1, round(float(body.get("rating")))))
    except (TypeError, ValueError):
        return error(400, "Choose a rating from 1 to 5.")
    if not text:
        return error(400, "Tell other students a little about the meal.")
    if len(text) > 2000:
        return error(400, "Reviews can be up to 2,000 characters.")
    order_id = body.get("orderId") or None

    with transaction() as tx:
        item = tx.query_one("SELECT * FROM menu_items WHERE id = %s FOR UPDATE", (item_id,))
        if not item:
            return error(404, "Menu item not found.")
        verified = bool(
            tx.query_one(
                """SELECT 1 FROM orders o JOIN order_lines l ON l.order_id = o.id
                   WHERE o.customer_id = %s AND o.status = 'delivered' AND l.item_id = %s LIMIT 1""",
                (user["id"], item["id"]),
            )
        )
        if order_id and not tx.query_one(
            "SELECT 1 FROM orders WHERE id = %s AND customer_id = %s", (order_id, user["id"])
        ):
            order_id = None
        review_id = new_id("r")
        author = short_name(user["name"])
        now = utcnow()
        tx.execute(
            """INSERT INTO reviews (id, item_id, user_id, order_id, author_name, rating, body, verified, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (review_id, item["id"], user["id"], order_id, author, rating, text, verified, now),
        )
        # Running average so the menu card reflects new feedback immediately.
        count = item["review_count"]
        new_rating = round((float(item["rating"]) * count + rating) / (count + 1), 1)
        tx.execute(
            "UPDATE menu_items SET rating = %s, review_count = review_count + 1 WHERE id = %s",
            (new_rating, item["id"]),
        )
        if order_id:
            tx.execute("UPDATE orders SET reviewed = TRUE WHERE id = %s", (order_id,))
        notify_vendor(tx, item["vendor_id"], f"New {rating}★ review", f"{author} on {item['name']}: “{text[:60]}”", "/cafeteria")
        log_event(tx, "info", f"{author} rated {item['name']} {rating}/5")
        row = tx.query_one("SELECT * FROM reviews WHERE id = %s", (review_id,))
    return jsonify(review_json(row)), 201


@bp.get("/vendors")
def list_vendors():
    return jsonify([vendor_json(r, with_queue=True) for r in query("SELECT * FROM vendors ORDER BY name")])


@bp.get("/vendors/<vendor_id>")
def get_vendor(vendor_id: str):
    row = query_one("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
    if not row:
        return error(404, "Vendor not found.")
    return jsonify(vendor_json(row))


def slot_label(t: str) -> str:
    h, m = (int(x) for x in t.split(":"))
    return f"{(h + 11) % 12 + 1}:{m:02d} {'PM' if h >= 12 else 'AM'}"


@bp.get("/slots")
def list_slots():
    now = local_now()
    today = now.date()
    raw = request.args.get("date")
    try:
        day = date.fromisoformat(raw) if raw else today
    except ValueError:
        return error(400, "Use a date like 2026-11-24.")
    rows = query(
        """SELECT slot, COUNT(*) AS n FROM orders
           WHERE status NOT IN ('cancelled', 'delivered') AND slot IS NOT NULL
             AND (scheduled_for = %s OR (scheduled_for IS NULL AND %s))
           GROUP BY slot""",
        (day, day == today),
    )
    booked = {r["slot"]: r["n"] for r in rows}
    minutes_now = now.hour * 60 + now.minute
    out = []
    for t in SLOT_TIMES:
        h, m = (int(x) for x in t.split(":"))
        past = day == today and h * 60 + m <= minutes_now + 10
        n = booked.get(t, 0)
        full = n >= SLOT_CAPACITY
        hint = "Past" if past else "Fully booked" if full else f"{SLOT_CAPACITY - n} left" if n else "Available"
        out.append({"id": t, "label": slot_label(t), "hint": hint, "available": not past and not full})
    return jsonify(out)


@bp.get("/favourites")
def list_favourites():
    user = optional_user()
    if not user:
        return jsonify([])
    rows = query("SELECT item_id FROM favourites WHERE user_id = %s ORDER BY item_id", (user["id"],))
    return jsonify([r["item_id"] for r in rows])


@bp.post("/favourites/<item_id>")
@require_auth
def toggle_favourite(item_id: str):
    user = current_user()
    with transaction() as tx:
        if not tx.query_one("SELECT 1 FROM menu_items WHERE id = %s", (item_id,)):
            return error(404, "Menu item not found.")
        existing = tx.query_one(
            "SELECT 1 FROM favourites WHERE user_id = %s AND item_id = %s FOR UPDATE", (user["id"], item_id)
        )
        if existing:
            tx.execute("DELETE FROM favourites WHERE user_id = %s AND item_id = %s", (user["id"], item_id))
        else:
            tx.execute("INSERT INTO favourites (user_id, item_id) VALUES (%s, %s)", (user["id"], item_id))
        rows = tx.query("SELECT item_id FROM favourites WHERE user_id = %s ORDER BY item_id", (user["id"],))
    return jsonify([r["item_id"] for r in rows])


__all__ = ["bp", "menu_item_json", "vendor_json", "review_json", "DEFAULT_IMAGE", "has_column"]
