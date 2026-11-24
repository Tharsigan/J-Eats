"""Admin dashboards: ledger, logs, peak hours, platform stats, settings, all orders.

GET  /api/admin/ledger?type=sale|payout|topup|refund|donation
GET  /api/admin/logs
GET  /api/admin/analytics/peak?range=today|week|month
GET  /api/admin/orders
GET  /api/admin/stats?range=today|week|month
GET  /api/admin/settings
PUT  /api/admin/settings   {deliveryFee, riderPayout, cashCutoffHour, orderingOpen, maxActiveJobsPerRider}
POST /api/admin/reset      refused: the browser demo reset never touches MariaDB
"""
from flask import Blueprint, jsonify, request

from auth import require_role
from common import error, has_column, log_event, money, notify, rs, settings
from db import query, transaction
from serializers import iso

from .orders import ACTIVE, hour_buckets, orders_json, range_start_utc

bp = Blueprint("admin_ops", __name__)

LEDGER_TYPES = ("sale", "payout", "topup", "refund", "donation")
STATUSES = ("placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled")


def _range() -> str:
    rng = request.args.get("range", "today")
    return rng if rng in ("today", "week", "month") else "today"


def settings_json(row: dict) -> dict:
    return {
        "deliveryFee": money(row["delivery_fee"]),
        "riderPayout": money(row["rider_payout"]),
        "cashCutoffHour": int(row["cash_cutoff_hour"]),
        "orderingOpen": bool(row["ordering_open"]),
        "maxActiveJobsPerRider": int(row["max_active_jobs_per_rider"]),
    }


@bp.get("/admin/ledger")
@require_role("admin")
def ledger():
    kind = request.args.get("type")
    if kind in LEDGER_TYPES:
        rows = query("SELECT * FROM ledger_entries WHERE type = %s ORDER BY created_at DESC, id DESC LIMIT 500", (kind,))
    else:
        rows = query("SELECT * FROM ledger_entries ORDER BY created_at DESC, id DESC LIMIT 500")
    return jsonify([
        {"id": r["id"], "ref": r["ref"], "party": r["party"], "amount": money(r["amount"]), "type": r["type"],
         "at": iso(r["created_at"]), "createdAt": iso(r["created_at"])}
        for r in rows
    ])


@bp.get("/admin/logs")
@require_role("admin")
def logs():
    rows = query("SELECT * FROM system_logs ORDER BY created_at DESC, id DESC LIMIT 200")
    return jsonify([
        {"id": r["id"], "level": r["level"], "msg": r["message"], "at": iso(r["created_at"]), "createdAt": iso(r["created_at"])}
        for r in rows
    ])


@bp.get("/admin/analytics/peak")
@require_role("admin")
def peak_hours():
    rng = request.args.get("range", "week")
    rng = rng if rng in ("today", "week", "month") else "week"
    return jsonify(hour_buckets(query("SELECT created_at FROM orders WHERE created_at >= %s", (range_start_utc(rng),))))


@bp.get("/admin/orders")
@require_role("admin")
def all_orders():
    return jsonify(orders_json(query("SELECT * FROM orders ORDER BY created_at DESC, id DESC")))


@bp.get("/admin/stats")
@require_role("admin")
def stats():
    start = range_start_utc(_range())
    orders = query("SELECT id, vendor_id, status, total, created_at FROM orders WHERE created_at >= %s", (start,))
    active_all = query("SELECT COUNT(*) AS n FROM orders WHERE status IN (%s, %s, %s, %s, %s)", ACTIVE)[0]["n"]
    users = query("SELECT * FROM users")

    def count(role, status=None):
        return sum(1 for u in users if u["role"] == role and (not status or u["verification_status"] == status))

    customers = [u for u in users if u["role"] == "customer" and u["verification_status"] == "approved"]
    online_col = has_column("users", "is_online")
    pending = query("SELECT role, COUNT(*) AS n FROM verification_applications WHERE verification_status = 'pending' GROUP BY role")
    pending_by = {p["role"]: p["n"] for p in pending}
    vendors = query("SELECT id, name FROM vendors")
    live = [o for o in orders if o["status"] != "cancelled"]
    by_vendor = sorted(
        (
            {"name": v["name"], "revenue": money(sum(float(o["total"]) for o in live if o["vendor_id"] == v["id"])),
             "orders": sum(1 for o in live if o["vendor_id"] == v["id"])}
            for v in vendors
        ),
        key=lambda x: -x["revenue"],
    )
    active_jobs = query("SELECT COUNT(*) AS n FROM courier_jobs WHERE status IN ('accepted', 'picked')")[0]["n"]
    return jsonify(
        customers={
            "total": len(customers),
            "student": sum(1 for u in customers if u["customer_sub_role"] == "student"),
            "academic": sum(1 for u in customers if u["customer_sub_role"] == "academic"),
            "nonAcademic": sum(1 for u in customers if u["customer_sub_role"] == "non-academic"),
        },
        riders={
            "approved": count("courier", "approved"),
            "pending": count("courier", "pending"),
            "online": sum(1 for u in users if u["role"] == "courier" and u["verification_status"] == "approved"
                          and (not online_col or u["is_online"])),
        },
        cafeterias={"approved": count("cafeteria", "approved"), "pending": count("cafeteria", "pending")},
        orders={
            "total": len(orders),
            "completed": sum(1 for o in orders if o["status"] == "delivered"),
            "active": active_all,
            "cancelled": sum(1 for o in orders if o["status"] == "cancelled"),
        },
        volume=money(sum(float(o["total"]) for o in live)),
        activeDeliveries=active_jobs,
        pendingApplications={
            "courier": pending_by.get("courier", 0),
            "cafeteria": pending_by.get("cafeteria", 0),
            "customer": pending_by.get("customer", 0),
        },
        byHour=hour_buckets(orders),
        byVendor=by_vendor,
        byStatus=[{"status": s, "count": sum(1 for o in orders if o["status"] == s)} for s in STATUSES],
    )


@bp.get("/admin/settings")
@require_role("admin")
def get_settings():
    return jsonify(settings_json(settings()))


@bp.put("/admin/settings")
@require_role("admin")
def save_settings():
    body = request.get_json(silent=True) or {}
    try:
        fee = round(float(body["deliveryFee"]), 2)
        payout = round(float(body["riderPayout"]), 2)
        cutoff = int(body["cashCutoffHour"])
        max_jobs = max(1, min(10, round(float(body["maxActiveJobsPerRider"]))))
    except (KeyError, TypeError, ValueError):
        return error(400, "Fill in every setting.")
    if fee < 0 or payout < 0 or fee != fee or payout != payout:
        return error(400, "Fees cannot be negative.")
    if fee > 10_000 or payout > 10_000:
        return error(400, "Fees can be up to Rs. 10,000.")
    if not 0 <= cutoff <= 23:
        return error(400, "Cash cutoff must be an hour between 0 and 23.")
    open_now = bool(body.get("orderingOpen"))
    with transaction() as tx:
        before = tx.query_one("SELECT * FROM platform_settings WHERE id = 1 FOR UPDATE")
        tx.execute(
            """INSERT INTO platform_settings (id, delivery_fee, rider_payout, cash_cutoff_hour, ordering_open, max_active_jobs_per_rider)
               VALUES (1, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE delivery_fee = VALUES(delivery_fee), rider_payout = VALUES(rider_payout),
                 cash_cutoff_hour = VALUES(cash_cutoff_hour), ordering_open = VALUES(ordering_open),
                 max_active_jobs_per_rider = VALUES(max_active_jobs_per_rider)""",
            (fee, payout, cutoff, open_now, max_jobs),
        )
        was_open = bool(before["ordering_open"]) if before else True
        if was_open != open_now:
            notify(tx, role="customer", title="Ordering is open" if open_now else "Ordering paused",
                   body="Campus kitchens are taking orders again." if open_now else "New orders are paused by campus operations.")
        log_event(tx, "ok", f"Settings saved · delivery {rs(fee)} · rider payout {rs(payout)} · cash until {cutoff}:00 · "
                            f"ordering {'open' if open_now else 'paused'}")
        row = tx.query_one("SELECT * FROM platform_settings WHERE id = 1")
    return jsonify(settings_json(row))


@bp.post("/admin/reset")
@require_role("admin")
def reset():
    return error(403, "Reset demo data only clears this browser's demo copy. It is turned off while the app uses MariaDB.")
