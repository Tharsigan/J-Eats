"""Wallet and fundraising stalls. Payments are simulated: nothing is charged.

GET  /api/wallet                 -> {userId, balance, txns}
POST /api/wallet/topup           {amount, method?} -> {ok, amount, ref, balance}
GET  /api/stalls                 -> fundraising stalls
POST /api/stalls/<id>/support    {amount} -> the stall (paid from the wallet)
"""
from flask import Blueprint, jsonify, request

from auth import current_user, require_auth, require_role
from common import (
    InsufficientFunds,
    add_ledger,
    error,
    log_event,
    money,
    notify,
    rs,
    short_ref,
    wallet_txn,
)
from db import query, query_one, transaction
from serializers import iso

bp = Blueprint("wallet", __name__)

TOPUP_MIN = 100
TOPUP_MAX = 50_000


def txn_json(row: dict) -> dict:
    out = {
        "id": row["id"],
        "label": row["label"],
        "amount": money(row["amount"]),
        "type": row["type"],
        "at": iso(row["created_at"]),
        "kind": row["kind"],
        "ref": row["ref"],
        "createdAt": iso(row["created_at"]),
    }
    return {k: v for k, v in out.items() if v is not None}


def wallet_json(user_id: str) -> dict:
    wallet = query_one("SELECT balance FROM wallets WHERE user_id = %s", (user_id,))
    txns = query(
        "SELECT * FROM wallet_transactions WHERE user_id = %s ORDER BY created_at DESC, id DESC LIMIT 200", (user_id,)
    )
    return {"userId": user_id, "balance": money(wallet["balance"]) if wallet else 0, "txns": [txn_json(t) for t in txns]}


def stall_json(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "faculty": row["faculty"],
        "cause": row["cause"],
        "raised": money(row["raised"]),
        "goal": money(row["goal"]),
    }


def _amount(body) -> float | None:
    try:
        value = float(body.get("amount"))
    except (TypeError, ValueError):
        return None
    return value if value == value and value not in (float("inf"), float("-inf")) else None


@bp.get("/wallet")
@require_auth
def get_wallet():
    return jsonify(wallet_json(current_user()["id"]))


@bp.post("/wallet/topup")
@require_auth
def top_up():
    body = request.get_json(silent=True) or {}
    amount = _amount(body)
    if amount is None or amount < TOPUP_MIN or amount > TOPUP_MAX:
        return error(400, f"Top-ups must be between {rs(TOPUP_MIN)} and {rs(TOPUP_MAX)}.")
    amount = round(amount, 2)
    method = str(body.get("method") or "Demo gateway").strip()[:60] or "Demo gateway"
    user = current_user()
    ref = short_ref("TU")
    with transaction() as tx:
        balance = wallet_txn(tx, user["id"], label=f"Top-up · {method}", amount=amount, type="credit", kind="topup", ref=ref)
        add_ledger(tx, ref=ref, party=user["name"], amount=amount, type="topup")
        notify(tx, user_id=user["id"], title="Wallet topped up", body=f"{rs(amount)} added · {ref}", href="/customer/wallet")
        log_event(tx, "ok", f"Wallet top-up {rs(amount)} settled for {user['name']} ({ref})")
    return jsonify(ok=True, amount=money(amount), ref=ref, balance=money(balance))


@bp.get("/stalls")
def list_stalls():
    return jsonify([stall_json(r) for r in query("SELECT * FROM stalls ORDER BY name")])


@bp.post("/stalls/<stall_id>/support")
@require_role("customer")
def support_stall(stall_id: str):
    amount = _amount(request.get_json(silent=True) or {})
    if amount is None or amount < 50:
        return error(400, "Minimum contribution is Rs. 50.")
    if amount > TOPUP_MAX:
        return error(400, f"Contributions can be up to {rs(TOPUP_MAX)}.")
    amount = round(amount, 2)
    user = current_user()
    try:
        with transaction() as tx:
            stall = tx.query_one("SELECT * FROM stalls WHERE id = %s FOR UPDATE", (stall_id,))
            if not stall:
                return error(404, "Stall not found.")
            wallet_txn(tx, user["id"], label=f"Stall support · {stall['name']}", amount=amount, type="debit", kind="donation", ref=stall["id"])
            tx.execute("UPDATE stalls SET raised = raised + %s WHERE id = %s", (amount, stall_id))
            add_ledger(tx, ref=stall["id"].upper(), party=user["name"], amount=amount, type="donation")
            log_event(tx, "ok", f"{user['name']} supported {stall['name']} with {rs(amount)}")
            row = tx.query_one("SELECT * FROM stalls WHERE id = %s", (stall_id,))
    except InsufficientFunds:
        return error(402, "Wallet balance is too low. Top up first.")
    return jsonify(stall_json(row))
