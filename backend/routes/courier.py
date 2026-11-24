"""Riders: delivery jobs, the Online switch, earnings and (simulated) withdrawals.

GET  /api/courier/jobs                 open jobs I haven't declined (when online) + my own jobs
GET  /api/courier/jobs/active          my accepted/picked job, or null
POST /api/courier/jobs/<id>/accept
POST /api/courier/jobs/<id>/decline
POST /api/courier/jobs/<id>/pickup     order -> out_for_delivery
POST /api/courier/jobs/<id>/complete   order -> delivered, payout to my wallet
GET  /api/courier/status               true/false
POST /api/courier/status               {online}
GET  /api/courier/stats                {today, todayCount, week, weekCount, balance, history}
POST /api/courier/withdraw             -> {amount}
"""
from datetime import datetime, time, timedelta, timezone

from flask import jsonify, request, Blueprint

from auth import current_user, require_role
from common import (
    add_ledger,
    error,
    has_column,
    local_now,
    lock_wallet,
    log_event,
    money,
    notify,
    notify_vendor,
    rs,
    settings,
    utcnow,
    wallet_txn,
)
from db import query, query_one, transaction
from serializers import iso

from .orders import orders_json

bp = Blueprint("courier", __name__)

ACTIVE_JOB = ("accepted", "picked")


def jobs_json(rows: list[dict], q=query) -> list[dict]:
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    marks = ", ".join(["%s"] * len(ids))
    declined: dict[str, list[str]] = {}
    for d in q(f"SELECT job_id, courier_id FROM job_declines WHERE job_id IN ({marks})", tuple(ids)):
        declined.setdefault(d["job_id"], []).append(d["courier_id"])
    order_ids = tuple({r["order_id"] for r in rows})
    omarks = ", ".join(["%s"] * len(order_ids))
    orders = {o["id"]: o for o in orders_json(q(f"SELECT * FROM orders WHERE id IN ({omarks})", order_ids), q)}
    out = []
    for r in rows:
        order = orders.get(r["order_id"])
        job = {
            "id": r["id"],
            "from": r["pickup_from"],
            "to": r["drop_to"],
            "payout": money(r["payout"]),
            "distanceM": r["distance_m"],
            "items": r["items"],
            "status": r["status"],
            "orderId": r["order_id"],
            "courierId": r["courier_id"],
            "declinedBy": declined.get(r["id"], []),
            "createdAt": iso(r["created_at"]),
            "completedAt": iso(r["completed_at"]),
            "customerName": order["customerName"] if order else None,
            "order": order,
        }
        out.append({k: v for k, v in job.items() if v is not None})
    return out


def _is_online(user_id: str, q=query_one) -> bool:
    if not has_column("users", "is_online"):
        return True
    row = q("SELECT is_online FROM users WHERE id = %s", (user_id,))
    return bool(row["is_online"]) if row else True


@bp.get("/courier/jobs")
@require_role("courier")
def list_jobs():
    me = current_user()["id"]
    rows = query(
        """SELECT * FROM courier_jobs j
           WHERE j.courier_id = %s
              OR (%s AND j.status = 'open'
                  AND NOT EXISTS (SELECT 1 FROM job_declines d WHERE d.job_id = j.id AND d.courier_id = %s))
           ORDER BY j.created_at DESC, j.id DESC""",
        (me, _is_online(me), me),
    )
    return jsonify(jobs_json(rows))


@bp.get("/courier/jobs/active")
@require_role("courier")
def active_job():
    rows = query(
        "SELECT * FROM courier_jobs WHERE courier_id = %s AND status IN ('accepted', 'picked') ORDER BY created_at LIMIT 1",
        (current_user()["id"],),
    )
    return jsonify(jobs_json(rows)[0] if rows else None)


def _job_out(tx, job_id: str) -> dict:
    # The plain job (no order) is what the mock returns from accept/pickup/complete.
    job = jobs_json(tx.query("SELECT * FROM courier_jobs WHERE id = %s", (job_id,)), tx.query)[0]
    job.pop("order", None)
    return job


@bp.post("/courier/jobs/<job_id>/accept")
@require_role("courier")
def accept_job(job_id: str):
    rider = current_user()
    with transaction() as tx:
        # Lock my own row first so two accepts from the same rider can't both pass the limit.
        tx.query_one("SELECT id FROM users WHERE id = %s FOR UPDATE", (rider["id"],))
        if not _is_online(rider["id"], tx.query_one):
            return error(409, "Go online before accepting jobs.")
        active = tx.query_one(
            "SELECT COUNT(*) AS n FROM courier_jobs WHERE courier_id = %s AND status IN ('accepted', 'picked')", (rider["id"],)
        )["n"]
        if active >= settings(tx)["max_active_jobs_per_rider"]:
            return error(409, "Finish your active delivery before accepting another job.")
        job = tx.query_one("SELECT * FROM courier_jobs WHERE id = %s FOR UPDATE", (job_id,))
        if not job or job["status"] != "open":
            return error(409, "This job was already taken by another rider.")
        tx.execute("UPDATE courier_jobs SET status = 'accepted', courier_id = %s WHERE id = %s", (rider["id"], job_id))
        order = tx.query_one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (job["order_id"],))
        if order:
            tx.execute("UPDATE orders SET courier_id = %s WHERE id = %s", (rider["id"], order["id"]))
            notify(tx, user_id=order["customer_id"], title=f"Rider assigned · {order['id']}",
                   body=f"{rider['name']} is heading to {job['pickup_from']}.", href=f"/customer/track?id={order['id']}")
            notify_vendor(tx, order["vendor_id"], f"Rider for {order['id']}",
                          f"{rider['name']} accepted the delivery and is on the way.", "/cafeteria/orders")
        log_event(tx, "info", f"Rider {rider['name']} accepted {job_id} ({job['order_id']})")
        out = _job_out(tx, job_id)
    return jsonify(out)


@bp.post("/courier/jobs/<job_id>/decline")
@require_role("courier")
def decline_job(job_id: str):
    rider = current_user()
    with transaction() as tx:
        if not tx.query_one("SELECT id FROM courier_jobs WHERE id = %s", (job_id,)):
            return error(404, "Job not found.")
        tx.execute("INSERT IGNORE INTO job_declines (job_id, courier_id) VALUES (%s, %s)", (job_id, rider["id"]))
        log_event(tx, "info", f"Rider {rider['name']} declined {job_id}")
    return jsonify(ok=True)


@bp.post("/courier/jobs/<job_id>/pickup")
@require_role("courier")
def pick_up(job_id: str):
    rider = current_user()
    with transaction() as tx:
        job = tx.query_one("SELECT * FROM courier_jobs WHERE id = %s AND courier_id = %s FOR UPDATE", (job_id, rider["id"]))
        if not job or job["status"] != "accepted":
            return error(409, "Accept the job before picking it up.")
        tx.execute("UPDATE courier_jobs SET status = 'picked' WHERE id = %s", (job_id,))
        order = tx.query_one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (job["order_id"],))
        if order:
            tx.execute("UPDATE orders SET status = 'out_for_delivery' WHERE id = %s", (order["id"],))
            tx.execute("INSERT INTO order_status_history (order_id, status, at) VALUES (%s, 'out_for_delivery', %s)",
                       (order["id"], utcnow()))
            notify(tx, user_id=order["customer_id"], title=f"On the way · {order['id']}",
                   body=f"{rider['name']} collected your food from {job['pickup_from']}.", href=f"/customer/track?id={order['id']}")
        log_event(tx, "info", f"Order {job['order_id']} collected by {rider['name']}")
        out = _job_out(tx, job_id)
    return jsonify(out)


@bp.post("/courier/jobs/<job_id>/complete")
@require_role("courier")
def complete(job_id: str):
    rider = current_user()
    with transaction() as tx:
        job = tx.query_one("SELECT * FROM courier_jobs WHERE id = %s AND courier_id = %s FOR UPDATE", (job_id, rider["id"]))
        if not job or job["status"] != "picked":
            return error(409, "Pick up the order before marking it delivered.")
        now = utcnow()
        tx.execute("UPDATE courier_jobs SET status = 'delivered', completed_at = %s WHERE id = %s", (now, job_id))
        order = tx.query_one("SELECT * FROM orders WHERE id = %s FOR UPDATE", (job["order_id"],))
        if order:
            paid = "paid" if order["payment_method"] == "cash" else order["payment_status"]
            tx.execute("UPDATE orders SET status = 'delivered', payment_status = %s WHERE id = %s", (paid, order["id"]))
            tx.execute("INSERT INTO order_status_history (order_id, status, at) VALUES (%s, 'delivered', %s)", (order["id"], now))
            notify(tx, user_id=order["customer_id"], title=f"Delivered · {order['id']}",
                   body="Enjoy your meal! Tap to rate your food.", href="/customer/profile")
            notify_vendor(tx, order["vendor_id"], f"Delivered · {order['id']}", f"{rider['name']} completed the drop-off.",
                          "/cafeteria/orders")
        payout = float(job["payout"])
        wallet_txn(tx, rider["id"], label=f"Delivery payout · {job['order_id']}", amount=payout, type="credit",
                   kind="earning", ref=job["order_id"])
        add_ledger(tx, ref=job["order_id"], party=rider["name"], amount=payout, type="payout")
        notify(tx, user_id=rider["id"], title="Payout credited", body=f"{rs(payout)} for {job['order_id']}.", href="/courier/earnings")
        log_event(tx, "ok", f"Order {job['order_id']} delivered by {rider['name']} · payout {rs(payout)}")
        out = _job_out(tx, job_id)
    return jsonify(out)


@bp.get("/courier/status")
@require_role("courier")
def get_status():
    return jsonify(_is_online(current_user()["id"]))


@bp.post("/courier/status")
@require_role("courier")
def set_status():
    if not has_column("users", "is_online"):
        return error(503, "Run database/migrations/001_menu_tags_featured_rider_online.sql to save the Online switch.")
    online = bool((request.get_json(silent=True) or {}).get("online"))
    rider = current_user()
    with transaction() as tx:
        tx.execute("UPDATE users SET is_online = %s WHERE id = %s", (online, rider["id"]))
        log_event(tx, "info", f"Rider {rider['name']} is {'online' if online else 'offline'}")
    return jsonify(online)


def _local_midnight_utc(days_back: int = 0) -> datetime:
    now = local_now()
    start = datetime.combine(now.date(), time.min, tzinfo=now.tzinfo) - timedelta(days=days_back)
    return start.astimezone(timezone.utc).replace(tzinfo=None)


@bp.get("/courier/stats")
@require_role("courier")
def stats():
    me = current_user()["id"]
    done = query("SELECT payout, completed_at FROM courier_jobs WHERE courier_id = %s AND status = 'delivered'", (me,))
    today_start, week_start = _local_midnight_utc(), _local_midnight_utc(6)
    today = [j for j in done if j["completed_at"] and j["completed_at"] >= today_start]
    week = [j for j in done if j["completed_at"] and j["completed_at"] >= week_start]
    wallet = query_one("SELECT balance FROM wallets WHERE user_id = %s", (me,))
    history = jobs_json(query(
        """SELECT * FROM courier_jobs j
           WHERE j.courier_id = %s OR EXISTS (SELECT 1 FROM job_declines d WHERE d.job_id = j.id AND d.courier_id = %s)
           ORDER BY COALESCE(j.completed_at, j.created_at) DESC, j.id DESC""",
        (me, me),
    ))
    return jsonify(
        today=money(sum(float(j["payout"]) for j in today)),
        todayCount=len(today),
        week=money(sum(float(j["payout"]) for j in week)),
        weekCount=len(week),
        balance=money(wallet["balance"]) if wallet else 0,
        history=history,
    )


@bp.post("/courier/withdraw")
@require_role("courier")
def withdraw():
    rider = current_user()
    with transaction() as tx:
        amount = float(lock_wallet(tx, rider["id"])["balance"])
        if amount <= 0:
            return error(400, "No earnings available to withdraw.")
        wallet_txn(tx, rider["id"], label="Withdrawal · simulated bank transfer", amount=amount, type="debit", kind="withdrawal")
        log_event(tx, "ok", f"Rider {rider['name']} withdrew {rs(amount)} (simulated)")
    return jsonify(amount=money(amount))
