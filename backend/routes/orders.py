"""Orders: customers place, track, cancel and reschedule; cafeterias run the kitchen.

POST /api/promos/check                 {code, subtotal, deliveryFees} -> {discount, code?, description}
POST /api/orders                       place an order (one per vendor) -> {orders, total, paymentRef}
GET  /api/orders/mine                  the signed-in customer's orders
GET  /api/orders                       every order (admins)
GET  /api/orders/latest                the customer's latest active order
GET  /api/orders/<id>                  one order (its customer, vendor, rider or an admin)
POST /api/orders/<id>/cancel           {reason}
POST /api/orders/<id>/reschedule       {slot, scheduledFor?}
GET  /api/orders/<id>/receipt          plain-text receipt (JSON string)

GET  /api/cafeteria/orders             orders for my vendor
POST /api/cafeteria/orders/<id>/status {status?}  next kitchen step
POST /api/cafeteria/orders/<id>/reject {reason}
GET  /api/cafeteria/stats?range=today|week|month
"""
import random
import re
from datetime import datetime, time, timedelta, timezone

from flask import Blueprint, jsonify, request

from auth import current_user, require_auth, require_role
from common import (
    InsufficientFunds,
    add_ledger,
    error,
    local_now,
    log_event,
    money,
    new_id,
    notify,
    notify_vendor,
    rs,
    settings,
    utcnow,
    wallet_txn,
)
from db import query, query_one, transaction
from serializers import iso

from .menu import DEFAULT_IMAGE, SLOT_TIMES

bp = Blueprint("orders", __name__)

ACTIVE = ("placed", "accepted", "preparing", "ready", "out_for_delivery")
PROMOS = {
    "FIRSTBITE": "20% off your first order, up to Rs. 350",
    "CAMPUSCREW": "Free delivery on orders over Rs. 1,500",
}
SPICES = ("mild", "medium", "hot")


class OrderError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@bp.errorhandler(OrderError)
def _order_error(exc: OrderError):
    return error(exc.status, str(exc))


# ---------------------------------------------------------------- JSON
def orders_json(rows: list[dict], q=query) -> list[dict]:
    """Order rows -> the frontend Order type (lines, timeline, names, job)."""
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    marks = ", ".join(["%s"] * len(ids))
    lines = q(
        f"""SELECT l.*, m.name, m.image_url FROM order_lines l JOIN menu_items m ON m.id = l.item_id
            WHERE l.order_id IN ({marks}) ORDER BY l.id""",
        tuple(ids),
    )
    history = q(f"SELECT * FROM order_status_history WHERE order_id IN ({marks}) ORDER BY at, id", tuple(ids))
    jobs = q(f"SELECT id, order_id FROM courier_jobs WHERE order_id IN ({marks})", tuple(ids))
    people = {r["customer_id"] for r in rows} | {r["courier_id"] for r in rows if r["courier_id"]}
    pmarks = ", ".join(["%s"] * len(people))
    names = {u["id"]: u["name"] for u in q(f"SELECT id, name FROM users WHERE id IN ({pmarks})", tuple(people))}
    vendors = {v["id"]: v["name"] for v in q("SELECT id, name FROM vendors")}
    by_order: dict[str, dict] = {i: {"lines": [], "timeline": [], "job": None} for i in ids}
    for l in lines:
        by_order[l["order_id"]]["lines"].append(l)
    for h in history:
        by_order[h["order_id"]]["timeline"].append(h)
    for j in jobs:
        by_order[j["order_id"]]["job"] = j["id"]

    out = []
    for r in rows:
        extra = by_order[r["id"]]
        olines = [
            {
                "itemId": l["item_id"],
                "name": l["name"],
                "qty": l["qty"],
                "unitPrice": money(l["unit_price"]),
                "spice": l["spice"],
                "notes": l["notes"] or "",
                "image": l["image_url"] or DEFAULT_IMAGE,
            }
            for l in extra["lines"]
        ]
        vendor_name = vendors.get(r["vendor_id"])
        o = {
            "id": r["id"],
            "customerId": r["customer_id"],
            "customerName": names.get(r["customer_id"], "Customer"),
            "vendorId": r["vendor_id"],
            "vendorName": vendor_name,
            "items": [{"name": l["name"], "qty": l["qty"], "price": money(l["unitPrice"] * l["qty"])} for l in olines],
            "lines": olines,
            "total": money(r["total"]),
            "deliveryFee": money(r["delivery_fee"]),
            "discount": money(r["discount"]) or None,
            "promoCode": r["promo_code"],
            "status": r["status"],
            "fulfillment": r["fulfillment"],
            "payment": r["payment_method"],
            "paymentStatus": r["payment_status"],
            "paymentRef": r["payment_ref"],
            "placedAt": iso(r["created_at"]),
            "createdAt": iso(r["created_at"]),
            "pickupPoint": vendor_name if r["fulfillment"] == "pickup" else r["destination"],
            "destination": r["destination"],
            "slot": r["slot"],
            "scheduledFor": iso(r["scheduled_for"]),
            "preOrder": bool(r["pre_order"]),
            "notes": r["notes"],
            "cancelReason": r["cancel_reason"],
            "reviewed": bool(r["reviewed"]),
            "courierId": r["courier_id"],
            "courierName": names.get(r["courier_id"]) if r["courier_id"] else None,
            "jobId": extra["job"],
            "timeline": [
                {k: v for k, v in {"status": h["status"], "at": iso(h["at"]), "note": h["note"]}.items() if v is not None}
                for h in extra["timeline"]
            ],
        }
        out.append({k: v for k, v in o.items() if v is not None})
    return out


def _one(order_id: str, q=query) -> dict:
    rows = q("SELECT * FROM orders WHERE id = %s", (order_id,))
    return orders_json(rows, q)[0]


# ---------------------------------------------------------------- promos
def promo_discount(tx, user_id: str, code, subtotal: float, delivery_fees: float) -> tuple[float, str | None]:
    c = str(code or "").strip().upper()
    if not c:
        return 0, None
    if c == "FIRSTBITE":
        if tx.query_one("SELECT 1 FROM orders WHERE customer_id = %s AND status <> 'cancelled' LIMIT 1", (user_id,)):
            raise OrderError(400, "FIRSTBITE is only valid on your first order.")
        return min(350, round(subtotal * 0.2)), c
    if c == "CAMPUSCREW":
        if subtotal < 1500:
            raise OrderError(400, "CAMPUSCREW needs a meal subtotal of Rs. 1,500 or more.")
        if not delivery_fees:
            raise OrderError(400, "CAMPUSCREW gives free delivery — choose delivery to use it.")
        return delivery_fees, c
    raise OrderError(400, f"Promo code “{c}” is not valid.")


class _Reader:
    """Lets promo_discount() run outside a transaction."""

    query_one = staticmethod(query_one)


@bp.post("/promos/check")
@require_role("customer")
def check_promo():
    body = request.get_json(silent=True) or {}
    try:
        subtotal = float(body.get("subtotal") or 0)
        fees = float(body.get("deliveryFees") or 0)
    except (TypeError, ValueError):
        return error(400, "Check the cart totals and try again.")
    discount, code = promo_discount(_Reader, current_user()["id"], body.get("code"), subtotal, fees)
    out = {"discount": money(discount), "description": PROMOS.get(code, "") if code else ""}
    if code:
        out["code"] = code
    return jsonify(out)


# ---------------------------------------------------------------- place
def _next_order_number(tx) -> int:
    rows = tx.query("SELECT id FROM orders WHERE id LIKE 'JE-%%'")
    nums = [int(m.group(1)) for r in rows if (m := re.fullmatch(r"JE-(\d+)", r["id"]))]
    return max(nums, default=1044) + 1


def _payment_ref(tx, prefix: str) -> str:
    row = tx.query_one(
        "SELECT COUNT(*) AS n FROM orders WHERE payment_ref LIKE %s", (f"{prefix}-%",)
    )
    return f"{prefix}-{2000 + row['n'] + random.randint(1, 999)}"


@bp.post("/orders")
@require_role("customer")
def place_order():
    body = request.get_json(silent=True) or {}
    user = current_user()
    lines = body.get("lines") or []
    fulfillment = body.get("fulfillment")
    payment = body.get("payment")
    destination = str(body.get("destination") or "").strip()[:160]
    slot = str(body.get("slot") or "").strip() or None
    notes = str(body.get("notes") or "").strip()[:2000] or None
    pre_order = bool(body.get("preOrder"))
    scheduled_for = body.get("scheduledFor") or None

    if not isinstance(lines, list) or not lines:
        return error(400, "Your cart is empty.")
    if fulfillment not in ("pickup", "delivery"):
        return error(400, "Choose pickup or delivery.")
    if payment not in ("cash", "card", "wallet"):
        return error(400, "Choose cash, card or wallet.")
    if fulfillment == "delivery" and not destination:
        return error(400, "Enter a campus delivery destination.")
    if slot and slot not in SLOT_TIMES:
        return error(400, "Choose one of the listed time slots.")
    if scheduled_for:
        try:
            scheduled_for = datetime.strptime(str(scheduled_for)[:10], "%Y-%m-%d").date()
        except ValueError:
            return error(400, "Choose a valid date for the pre-order.")

    wanted: dict[str, int] = {}
    clean_lines = []
    for l in lines:
        try:
            qty = int(l.get("quantity"))
        except (TypeError, ValueError, AttributeError):
            return error(400, "Each cart line needs a quantity.")
        if qty < 1:
            return error(400, "Quantities must be at least 1.")
        item_id = str(l.get("itemId") or "")
        spice = l.get("spice") if l.get("spice") in SPICES else "medium"
        clean_lines.append({"itemId": item_id, "qty": qty, "spice": spice, "notes": str(l.get("notes") or "").strip()[:255] or None})
        wanted[item_id] = wanted.get(item_id, 0) + qty

    try:
        with transaction() as tx:
            # Locking the settings row makes order placement one-at-a-time, so order
            # numbers and stock checks can't race.
            cfg = tx.query_one("SELECT * FROM platform_settings WHERE id = 1 FOR UPDATE") or settings(tx)
            if not cfg["ordering_open"]:
                raise OrderError(423, "Ordering is temporarily paused by the campus administrator.")
            if payment == "cash" and not pre_order and local_now().hour >= cfg["cash_cutoff_hour"]:
                raise OrderError(400, f"Cash orders close at {cfg['cash_cutoff_hour']}:00. Use wallet or card.")

            marks = ", ".join(["%s"] * len(wanted))
            items = {
                m["id"]: m
                for m in tx.query(f"SELECT * FROM menu_items WHERE id IN ({marks}) FOR UPDATE", tuple(wanted))
            }
            vendors = {v["id"]: v for v in tx.query("SELECT * FROM vendors")}
            for item_id, qty in wanted.items():
                item = items.get(item_id)
                if not item or not item["available"]:
                    raise OrderError(409, f"{item['name'] if item else 'An item'} is no longer on the menu.")
                if item["stock"] < qty:
                    raise OrderError(409, f"Only {item['stock']} × {item['name']} left. Update the quantity to continue.")
                vendor = vendors.get(item["vendor_id"])
                if vendor and not vendor["open_now"]:
                    raise OrderError(409, f"{vendor['name']} is closed right now.")

            # One order per vendor, so each kitchen only sees its own ticket. Prices come
            # from the database, never from the browser.
            by_vendor: dict[str, list[dict]] = {}
            for l in clean_lines:
                item = items[l["itemId"]]
                by_vendor.setdefault(item["vendor_id"], []).append({**l, "unitPrice": float(item["price"]), "name": item["name"]})
            fee = float(cfg["delivery_fee"]) if fulfillment == "delivery" else 0.0
            cart_subtotal = sum(float(items[l["itemId"]]["price"]) * l["qty"] for l in clean_lines)
            discount_total, promo = promo_discount(tx, user["id"], body.get("promoCode"), cart_subtotal, fee * len(by_vendor))
            grand_total = round(sum(sum(l["unitPrice"] * l["qty"] for l in ls) + fee for ls in by_vendor.values()) - discount_total, 2)

            prefix = "CASH" if payment == "cash" else "PAY"
            payment_ref = _payment_ref(tx, prefix)
            now = utcnow()
            number = _next_order_number(tx)
            discount_left = discount_total
            created_ids = []
            for vendor_id, vlines in by_vendor.items():
                vendor = vendors.get(vendor_id) or {"name": "Campus vendor"}
                order_id = f"JE-{number}"
                number += 1
                subtotal = sum(l["unitPrice"] * l["qty"] for l in vlines)
                discount = min(discount_left, subtotal + fee)
                discount_left -= discount
                total = round(subtotal + fee - discount, 2)
                dest = vendor["name"] if fulfillment == "pickup" else destination
                tx.execute(
                    """INSERT INTO orders (id, customer_id, vendor_id, status, fulfillment, payment_method, payment_status,
                                           payment_ref, total, delivery_fee, discount, promo_code, destination, slot,
                                           scheduled_for, pre_order, notes, created_at)
                       VALUES (%s, %s, %s, 'placed', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (order_id, user["id"], vendor_id, fulfillment, payment, "pending" if payment == "cash" else "paid",
                     payment_ref, total, fee, discount, promo if discount else None, dest, slot, scheduled_for,
                     pre_order, notes, now),
                )
                tx.executemany(
                    "INSERT INTO order_lines (order_id, item_id, qty, unit_price, spice, notes) VALUES (%s, %s, %s, %s, %s, %s)",
                    [(order_id, l["itemId"], l["qty"], l["unitPrice"], l["spice"], l["notes"]) for l in vlines],
                )
                for l in vlines:
                    tx.execute("UPDATE menu_items SET stock = stock - %s WHERE id = %s", (l["qty"], l["itemId"]))
                tx.execute("INSERT INTO order_status_history (order_id, status, at) VALUES (%s, 'placed', %s)", (order_id, now))
                if payment != "cash":
                    add_ledger(tx, ref=order_id, party=user["name"], amount=total, type="sale")
                summary = ", ".join(f"{l['qty']}× {l['name']}" for l in vlines)
                notify_vendor(
                    tx, vendor_id, f"New {'pre-order' if pre_order else 'order'} {order_id}",
                    f"{user['name']} · {summary} · {fulfillment}", "/cafeteria/orders",
                )
                log_event(tx, "info", f"Order {order_id} placed by {user['name']} at {vendor['name']} ({rs(total)})")
                for l in vlines:
                    left = items[l["itemId"]]["stock"] - wanted[l["itemId"]]
                    if left <= 3:
                        log_event(tx, "warn", f"Stock low: {l['name']} ({left})")
                created_ids.append(order_id)

            if payment == "wallet":
                try:
                    wallet_txn(tx, user["id"], label=f"Order {', '.join(created_ids)}", amount=grand_total,
                               type="debit", kind="payment", ref=payment_ref)
                except InsufficientFunds:
                    bal = tx.query_one("SELECT balance FROM wallets WHERE user_id = %s", (user["id"],))
                    raise OrderError(402, f"Wallet balance {rs(bal['balance'] if bal else 0)} is too low for {rs(grand_total)}. Top up first.")
            method = "card (simulated)" if payment == "card" else payment
            notify(tx, user_id=user["id"], title="Order confirmed",
                   body=f"{', '.join(created_ids)} · {rs(grand_total)} · {method}", href=f"/customer/track?id={created_ids[0]}")
            marks = ", ".join(["%s"] * len(created_ids))
            created = orders_json(tx.query(f"SELECT * FROM orders WHERE id IN ({marks}) ORDER BY id", tuple(created_ids)), tx.query)
    except OrderError as exc:
        return error(exc.status, str(exc))
    return jsonify(orders=created, total=money(grand_total), paymentRef=payment_ref), 201


# ---------------------------------------------------------------- read
@bp.get("/orders/mine")
@require_role("customer")
def my_orders():
    rows = query("SELECT * FROM orders WHERE customer_id = %s ORDER BY created_at DESC, id DESC", (current_user()["id"],))
    return jsonify(orders_json(rows))


@bp.get("/orders")
@require_role("admin")
def all_orders():
    return jsonify(orders_json(query("SELECT * FROM orders ORDER BY created_at DESC, id DESC")))


def _can_see(user: dict, order: dict) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] == "customer":
        return order["customer_id"] == user["id"]
    if user["role"] == "cafeteria":
        return order["vendor_id"] == user["vendor_id"]
    if user["role"] == "courier":
        job = query_one("SELECT status, courier_id FROM courier_jobs WHERE order_id = %s", (order["id"],))
        return bool(job) and (job["courier_id"] == user["id"] or job["status"] == "open")
    return False


@bp.get("/orders/latest")
@require_role("customer")
def latest_order():
    rows = query("SELECT * FROM orders WHERE customer_id = %s ORDER BY created_at DESC, id DESC", (current_user()["id"],))
    active = [r for r in rows if r["status"] in ACTIVE]
    pick = (active or rows)[:1]
    if not pick:
        return error(404, "No orders yet.")
    return jsonify(orders_json(pick)[0])


@bp.get("/orders/<order_id>")
@require_auth
def get_order(order_id: str):
    row = query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    if not row or not _can_see(current_user(), row):
        return error(404, "Order not found.")
    return jsonify(orders_json([row])[0])


# ---------------------------------------------------------------- release / cancel
def release_order(tx, order: dict, reason: str, by: str, customer_name: str) -> dict:
    """Restock, cancel the job and refund a paid order. Returns the updated order row."""
    for l in tx.query("SELECT item_id, qty FROM order_lines WHERE order_id = %s", (order["id"],)):
        tx.execute("UPDATE menu_items SET stock = stock + %s WHERE id = %s", (l["qty"], l["item_id"]))
    payment_status = order["payment_status"]
    if payment_status == "paid":
        payment_status = "refunded"
        if order["payment_method"] == "wallet" and tx.query_one("SELECT 1 FROM wallets WHERE user_id = %s", (order["customer_id"],)):
            wallet_txn(tx, order["customer_id"], label=f"Refund · {order['id']}", amount=order["total"],
                       type="credit", kind="refund", ref=order["id"])
        add_ledger(tx, ref=order["id"], party=customer_name, amount=order["total"], type="refund")
    tx.execute(
        "UPDATE orders SET status = 'cancelled', cancel_reason = %s, payment_status = %s WHERE id = %s",
        (reason[:255], payment_status, order["id"]),
    )
    tx.execute(
        "INSERT INTO order_status_history (order_id, status, note, at) VALUES (%s, 'cancelled', %s, %s)",
        (order["id"], f"{by}: {reason}"[:255], utcnow()),
    )
    tx.execute(
        "UPDATE courier_jobs SET status = 'cancelled' WHERE order_id = %s AND status <> 'delivered'", (order["id"],)
    )
    return tx.query_one("SELECT * FROM orders WHERE id = %s", (order["id"],))


@bp.post("/orders/<order_id>/cancel")
@require_role("customer")
def cancel_order(order_id: str):
    user = current_user()
    reason = str((request.get_json(silent=True) or {}).get("reason") or "").strip() or "Cancelled by customer"
    with transaction() as tx:
        order = tx.query_one("SELECT * FROM orders WHERE id = %s AND customer_id = %s FOR UPDATE", (order_id, user["id"]))
        if not order:
            return error(404, "Order not found.")
        if order["status"] not in ("placed", "accepted"):
            return error(409, "This order is already being prepared and can no longer be cancelled.")
        updated = release_order(tx, order, reason, "Customer", user["name"])
        notify_vendor(tx, order["vendor_id"], f"Order {order_id} cancelled", f"{user['name']}: {reason}", "/cafeteria/orders")
        notify(
            tx, user_id=user["id"], title=f"Order {order_id} cancelled",
            body=f"{rs(order['total'])} refunded to your {order['payment_method']}." if updated["payment_status"] == "refunded" else "No charge was made.",
            href="/customer/orders",
        )
        log_event(tx, "info", f"Order {order_id} cancelled by customer")
        out = _one(order_id, tx.query)
    return jsonify(out)


@bp.post("/orders/<order_id>/reschedule")
@require_role("customer")
def reschedule_order(order_id: str):
    user = current_user()
    body = request.get_json(silent=True) or {}
    slot = str(body.get("slot") or "")
    if slot not in SLOT_TIMES:
        return error(400, "Choose one of the listed time slots.")
    scheduled_for = body.get("scheduledFor") or None
    if scheduled_for:
        try:
            scheduled_for = datetime.strptime(str(scheduled_for)[:10], "%Y-%m-%d").date()
        except ValueError:
            return error(400, "Choose a valid date.")
    with transaction() as tx:
        order = tx.query_one("SELECT * FROM orders WHERE id = %s AND customer_id = %s FOR UPDATE", (order_id, user["id"]))
        if not order:
            return error(404, "Order not found.")
        if order["status"] != "placed":
            return error(409, "Only orders the kitchen has not accepted can be rescheduled.")
        tx.execute(
            "UPDATE orders SET slot = %s, scheduled_for = COALESCE(%s, scheduled_for) WHERE id = %s",
            (slot, scheduled_for, order_id),
        )
        notify_vendor(tx, order["vendor_id"], f"Order {order_id} rescheduled", f"{user['name']} moved pickup to {slot}.", "/cafeteria/orders")
        log_event(tx, "info", f"Order {order_id} rescheduled to {slot}")
        out = _one(order_id, tx.query)
    return jsonify(out)


@bp.get("/orders/<order_id>/receipt")
@require_auth
def receipt(order_id: str):
    row = query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    if not row or not _can_see(current_user(), row):
        return error(404, "Order not found.")
    o = orders_json([row])[0]
    placed = row["created_at"].replace(tzinfo=timezone.utc).astimezone(local_now().tzinfo)
    promo = o.get("promoCode") or ""
    text = "\n".join(
        [
            "J EATS · UNIVERSITY OF SRI JAYEWARDENEPURA",
            "Demo receipt — no real payment was processed",
            "-" * 52,
            f"Order      {o['id']}",
            f"Receipt    RC-{o['id'][3:]}",
            f"Payment    {o.get('paymentRef', '-')} · {o['payment']} · {o.get('paymentStatus', 'paid')}",
            f"Vendor     {o.get('vendorName', '-')}",
            f"Customer   {o['customerName']}",
            f"Placed     {placed.strftime('%d/%m/%Y, %H:%M:%S')}",
            f"Fulfilment {o['fulfillment']}{' · ' + o['destination'] if o.get('destination') else ''}{' · ' + o['slot'] if o.get('slot') else ''}",
            f"Status     {o['status'].replace('_', ' ')}",
            "-" * 52,
            *[f"  {l['qty']} × {l['name']:<32} {rs(l['unitPrice'] * l['qty'])}" for l in o["lines"]],
            f"  Delivery fee{'':<29} {rs(o.get('deliveryFee', 0))}",
            *([f"  Promo {promo}{'':<{max(1, 35 - len(promo))}}-{rs(o['discount'])}"] if o.get("discount") else []),
            "-" * 52,
            f"  TOTAL{'':<36} {rs(o['total'])}",
            "",
        ]
    )
    return jsonify(text)


# ---------------------------------------------------------------- cafeteria side
NEXT_STEP = {"placed": "accepted", "accepted": "preparing", "preparing": "ready"}
CUSTOMER_COPY = {
    "accepted": "accepted your order",
    "preparing": "started preparing your order",
    "ready": "has your order ready",
    "delivered": "marked your order as collected",
}


def _vendor_or_404():
    vid = current_user()["vendor_id"]
    if not vid:
        raise OrderError(404, "No cafeteria is linked to this account yet.")
    return vid


@bp.get("/cafeteria/orders")
@require_role("cafeteria")
def vendor_orders():
    vid = _vendor_or_404()
    return jsonify(orders_json(query("SELECT * FROM orders WHERE vendor_id = %s ORDER BY created_at DESC, id DESC", (vid,))))


@bp.post("/cafeteria/orders/<order_id>/status")
@require_role("cafeteria")
def advance_order(order_id: str):
    vid = _vendor_or_404()
    wanted = (request.get_json(silent=True) or {}).get("status") or None
    with transaction() as tx:
        order = tx.query_one("SELECT * FROM orders WHERE id = %s AND vendor_id = %s FOR UPDATE", (order_id, vid))
        if not order:
            return error(404, "Order not found.")
        target = wanted or NEXT_STEP.get(order["status"])
        if order["status"] == "ready" and order["fulfillment"] == "pickup":
            target = "delivered"
        allowed = {NEXT_STEP.get(order["status"])} | ({"delivered"} if order["status"] == "ready" else set())
        if not target or target not in allowed:
            return error(409, "This order has no further kitchen step.")
        if target == "delivered" and order["fulfillment"] == "delivery":
            return error(409, "Delivery orders are completed by the rider.")
        now = utcnow()
        paid = "paid" if target == "delivered" and order["payment_method"] == "cash" else order["payment_status"]
        tx.execute("UPDATE orders SET status = %s, payment_status = %s WHERE id = %s", (target, paid, order_id))
        tx.execute("INSERT INTO order_status_history (order_id, status, at) VALUES (%s, %s, %s)", (order_id, target, now))
        vendor = tx.query_one("SELECT name FROM vendors WHERE id = %s", (vid,))
        if target == "ready" and order["fulfillment"] == "delivery" and not tx.query_one(
            "SELECT 1 FROM courier_jobs WHERE order_id = %s", (order_id,)
        ):
            cfg = settings(tx)
            items = tx.query_one("SELECT COALESCE(SUM(qty), 0) AS n FROM order_lines WHERE order_id = %s", (order_id,))["n"]
            tx.execute(
                """INSERT INTO courier_jobs (id, order_id, pickup_from, drop_to, payout, distance_m, items, status, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'open', %s)""",
                (new_id("job"), order_id, vendor["name"], order["destination"] or "Campus pickup zone",
                 cfg["rider_payout"], random.randint(350, 1049), int(items), now),
            )
            notify(tx, role="courier", title="New delivery job",
                   body=f"{vendor['name']} → {order['destination'] or 'Campus pickup zone'} · earn {rs(cfg['rider_payout'])}", href="/courier/jobs")
        copy = CUSTOMER_COPY.get(target)
        if copy:
            extra = " A rider is being assigned." if target == "ready" and order["fulfillment"] == "delivery" else ""
            notify(tx, user_id=order["customer_id"], title=f"Order {order_id}", body=f"{vendor['name']} {copy}.{extra}",
                   href=f"/customer/track?id={order_id}")
        log_event(tx, "ok" if target == "delivered" else "info", f"{vendor['name']}: {order_id} → {target.replace('_', ' ')}")
        out = _one(order_id, tx.query)
    return jsonify(out)


@bp.post("/cafeteria/orders/<order_id>/reject")
@require_role("cafeteria")
def reject_order(order_id: str):
    vid = _vendor_or_404()
    reason = str((request.get_json(silent=True) or {}).get("reason") or "").strip() or "Kitchen unable to fulfil"
    with transaction() as tx:
        order = tx.query_one("SELECT * FROM orders WHERE id = %s AND vendor_id = %s FOR UPDATE", (order_id, vid))
        if not order:
            return error(404, "Order not found.")
        if order["status"] in ("delivered", "cancelled", "out_for_delivery"):
            return error(409, "This order can no longer be rejected.")
        vendor = tx.query_one("SELECT name FROM vendors WHERE id = %s", (vid,))
        customer = tx.query_one("SELECT name FROM users WHERE id = %s", (order["customer_id"],))
        updated = release_order(tx, order, reason, vendor["name"], customer["name"] if customer else "Customer")
        refund = f" {rs(order['total'])} refunded." if updated["payment_status"] == "refunded" else ""
        notify(tx, user_id=order["customer_id"], title=f"Order {order_id} declined",
               body=f"{vendor['name']}: {reason}.{refund}", href="/customer/orders")
        log_event(tx, "warn", f"{vendor['name']} rejected {order_id}: {reason}")
        out = _one(order_id, tx.query)
    return jsonify(out)


# ---------------------------------------------------------------- stats
HOURS = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"]


def range_start_utc(rng: str) -> datetime:
    """Local midnight today (minus 6 or 29 days), as naive UTC for comparing with created_at."""
    now = local_now()
    start = datetime.combine(now.date(), time.min, tzinfo=now.tzinfo)
    if rng == "week":
        start -= timedelta(days=6)
    elif rng == "month":
        start -= timedelta(days=29)
    return start.astimezone(timezone.utc).replace(tzinfo=None)


def to_local(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(local_now().tzinfo)


def hour_buckets(rows: list[dict]) -> list[dict]:
    counts = {h: 0 for h in HOURS}
    for r in rows:
        h = f"{to_local(r['created_at']).hour:02d}"
        if h in counts:
            counts[h] += 1
    return [{"hour": h, "value": counts[h]} for h in HOURS]


@bp.get("/cafeteria/stats")
@require_role("cafeteria")
def vendor_stats():
    vid = _vendor_or_404()
    rng = request.args.get("range", "today")
    if rng not in ("today", "week", "month"):
        rng = "today"
    start = range_start_utc(rng)
    all_orders = query("SELECT * FROM orders WHERE vendor_id = %s", (vid,))
    in_range = [o for o in all_orders if o["created_at"] >= start]
    live = [o for o in in_range if o["status"] != "cancelled"]
    qty: dict[str, int] = {}
    if live:
        marks = ", ".join(["%s"] * len(live))
        for l in query(f"SELECT item_id, qty FROM order_lines WHERE order_id IN ({marks})", tuple(o["id"] for o in live)):
            qty[l["item_id"]] = qty.get(l["item_id"], 0) + l["qty"]
    menu = {m["id"]: m for m in query("SELECT * FROM menu_items")}
    best = sorted(qty.items(), key=lambda kv: -kv[1])[:3]
    reviews = query(
        "SELECT r.rating FROM reviews r JOIN menu_items m ON m.id = r.item_id WHERE m.vendor_id = %s", (vid,)
    )
    today = local_now().date()
    days = []
    for i in range(7):
        d = today - timedelta(days=6 - i)
        v = sum(
            float(o["total"]) for o in all_orders if o["status"] != "cancelled" and to_local(o["created_at"]).date() == d
        )
        days.append({"d": d.strftime("%a"), "v": money(v)})
    return jsonify(
        sales=money(sum(float(o["total"]) for o in live)),
        completed=sum(1 for o in in_range if o["status"] == "delivered"),
        active=sum(1 for o in all_orders if o["status"] in ACTIVE),
        cancelled=sum(1 for o in in_range if o["status"] == "cancelled"),
        total=len(in_range),
        rating=(sum(r["rating"] for r in reviews) / len(reviews)) if reviews else 0,
        reviewCount=len(reviews),
        bestsellers=[
            {
                "itemId": i,
                "name": menu[i]["name"] if i in menu else i,
                "qty": q,
                "image": (menu[i]["image_url"] if i in menu else None) or DEFAULT_IMAGE,
                "price": money(menu[i]["price"]) if i in menu else 0,
                "stock": menu[i]["stock"] if i in menu else 0,
            }
            for i, q in best
        ],
        byHour=hour_buckets(in_range),
        byDay=days,
    )
