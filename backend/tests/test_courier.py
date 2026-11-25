import pytest

from conftest import login


def headers(client, role, ident, **extra):
    res = login(client, role, ident, **extra)
    assert res.status_code == 200, res.get_json()
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


@pytest.fixture()
def rider(client):
    return headers(client, "courier", "ari@sjp.ac.lk")


@pytest.fixture()
def rider2(client):
    return headers(client, "courier", "dilan.rider@sjp.ac.lk")


@pytest.fixture()
def ready_order(client, customer_headers):
    """A wallet-paid delivery order the kitchen has marked ready (so a job is open)."""
    caf = headers(client, "cafeteria", "canteen@sjp.ac.lk")
    res = client.post("/api/orders", json={
        "lines": [{"itemId": "m_kottu", "quantity": 1}], "fulfillment": "delivery", "payment": "wallet",
        "destination": "Library", "slot": "12:30", "notes": "",
    }, headers=customer_headers)
    order = res.get_json()["orders"][0]
    for _ in range(3):
        order = client.post(f"/api/cafeteria/orders/{order['id']}/status", json={}, headers=caf).get_json()
    assert order["status"] == "ready"
    return order


def test_riders_only(client, customer_headers):
    assert client.get("/api/courier/jobs").status_code == 401
    assert client.get("/api/courier/jobs", headers=customer_headers).status_code == 403


def test_open_job_listed_with_its_order(client, rider, ready_order):
    [job] = client.get("/api/courier/jobs", headers=rider).get_json()
    assert job["id"] == ready_order["jobId"] and job["status"] == "open" and job["from"] == "Central Canteen"
    assert job["to"] == "Library" and job["payout"] == 150 and job["customerName"] == "Mira Sen"
    assert job["order"]["id"] == ready_order["id"] and job["declinedBy"] == []
    assert client.get("/api/courier/jobs/active", headers=rider).get_json() is None


def test_full_delivery_pays_the_rider(client, rider, rider2, ready_order, customer_headers, sql):
    jid, oid = ready_order["jobId"], ready_order["id"]
    accepted = client.post(f"/api/courier/jobs/{jid}/accept", headers=rider).get_json()
    assert accepted["status"] == "accepted" and accepted["courierId"] == "u_cou"
    assert sql("SELECT courier_id FROM orders WHERE id=%s", (oid,)) == [{"courier_id": "u_cou"}]
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_cus' AND title=%s", (f"Rider assigned · {oid}",))[0]["n"] == 1
    # The second rider can't take it, and no longer sees it.
    assert client.post(f"/api/courier/jobs/{jid}/accept", headers=rider2).status_code == 409
    assert client.get("/api/courier/jobs", headers=rider2).get_json() == []
    assert client.get(f"/api/orders/{oid}", headers=rider2).status_code == 404
    # Completing before pickup is refused.
    assert client.post(f"/api/courier/jobs/{jid}/complete", headers=rider).status_code == 409
    assert client.get("/api/courier/jobs/active", headers=rider).get_json()["order"]["courierName"] == "Ari Perera"

    assert client.post(f"/api/courier/jobs/{jid}/pickup", headers=rider).get_json()["status"] == "picked"
    assert sql("SELECT status FROM orders WHERE id=%s", (oid,)) == [{"status": "out_for_delivery"}]
    # The kitchen can no longer reject it.
    caf = headers(client, "cafeteria", "canteen@sjp.ac.lk")
    assert client.post(f"/api/cafeteria/orders/{oid}/reject", json={}, headers=caf).status_code == 409

    done = client.post(f"/api/courier/jobs/{jid}/complete", headers=rider).get_json()
    assert done["status"] == "delivered" and done["completedAt"]
    assert sql("SELECT status FROM orders WHERE id=%s", (oid,)) == [{"status": "delivered"}]
    assert [h["status"] for h in client.get(f"/api/orders/{oid}", headers=customer_headers).get_json()["timeline"]][-2:] == [
        "out_for_delivery", "delivered"]
    assert float(sql("SELECT balance FROM wallets WHERE user_id='u_cou'")[0]["balance"]) == 150
    assert sql("SELECT kind, type FROM wallet_transactions WHERE user_id='u_cou'") == [{"kind": "earning", "type": "credit"}]
    assert sql("SELECT party FROM ledger_entries WHERE ref=%s AND type='payout'", (oid,)) == [{"party": "Ari Perera"}]
    assert client.get("/api/courier/jobs/active", headers=rider).get_json() is None

    stats = client.get("/api/courier/stats", headers=rider).get_json()
    assert stats["today"] == 150 and stats["todayCount"] == 1 and stats["week"] == 150 and stats["balance"] == 150
    assert [j["id"] for j in stats["history"]] == [jid]

    assert client.post("/api/courier/withdraw", headers=rider).get_json() == {"amount": 150}
    assert float(sql("SELECT balance FROM wallets WHERE user_id='u_cou'")[0]["balance"]) == 0
    assert client.post("/api/courier/withdraw", headers=rider).status_code == 400


def test_cash_delivery_is_paid_on_drop_off(client, rider, customer_headers, sql, monkeypatch):
    import routes.orders as orders
    from datetime import datetime
    monkeypatch.setattr(orders, "local_now", lambda: datetime(2026, 11, 24, 10, 0))
    caf = headers(client, "cafeteria", "canteen@sjp.ac.lk")
    o = client.post("/api/orders", json={"lines": [{"itemId": "m_kottu", "quantity": 1}], "fulfillment": "delivery",
                                         "payment": "cash", "destination": "Gym", "slot": "12:30", "notes": ""},
                    headers=customer_headers).get_json()["orders"][0]
    for _ in range(3):
        o = client.post(f"/api/cafeteria/orders/{o['id']}/status", json={}, headers=caf).get_json()
    for step in ("accept", "pickup", "complete"):
        assert client.post(f"/api/courier/jobs/{o['jobId']}/{step}", headers=rider).status_code == 200
    assert sql("SELECT payment_status FROM orders WHERE id=%s", (o["id"],)) == [{"payment_status": "paid"}]


def test_one_active_job_at_a_time(client, rider, ready_order, customer_headers, sql):
    sql("""INSERT INTO courier_jobs (id, order_id, pickup_from, drop_to, payout, status)
           VALUES ('job_x', 'JE-1042', 'Central Canteen', 'Hostel', 150, 'open')""")
    assert client.post(f"/api/courier/jobs/{ready_order['jobId']}/accept", headers=rider).status_code == 200
    res = client.post("/api/courier/jobs/job_x/accept", headers=rider)
    assert res.status_code == 409 and "Finish your active delivery" in res.get_json()["error"]


def test_decline_hides_the_job_and_shows_in_history(client, rider, rider2, ready_order, sql):
    jid = ready_order["jobId"]
    assert client.post(f"/api/courier/jobs/{jid}/decline", headers=rider).get_json() == {"ok": True}
    assert client.post(f"/api/courier/jobs/{jid}/decline", headers=rider).status_code == 200
    assert sql("SELECT courier_id FROM job_declines WHERE job_id=%s", (jid,)) == [{"courier_id": "u_cou"}]
    assert client.get("/api/courier/jobs", headers=rider).get_json() == []
    assert [j["id"] for j in client.get("/api/courier/jobs", headers=rider2).get_json()] == [jid]
    assert client.get("/api/courier/stats", headers=rider).get_json()["history"][0]["declinedBy"] == ["u_cou"]
    assert client.post("/api/courier/jobs/nope/decline", headers=rider).status_code == 404


def test_online_switch(client, rider, ready_order, sql):
    assert client.get("/api/courier/status", headers=rider).get_json() is True
    assert client.post("/api/courier/status", json={"online": False}, headers=rider).get_json() is False
    assert sql("SELECT is_online FROM users WHERE id='u_cou'") == [{"is_online": 0}]
    assert client.get("/api/courier/status", headers=rider).get_json() is False
    # Offline riders don't see open jobs and can't accept them.
    assert client.get("/api/courier/jobs", headers=rider).get_json() == []
    res = client.post(f"/api/courier/jobs/{ready_order['jobId']}/accept", headers=rider)
    assert res.status_code == 409 and "Go online" in res.get_json()["error"]
    client.post("/api/courier/status", json={"online": True}, headers=rider)
    assert client.post(f"/api/courier/jobs/{ready_order['jobId']}/accept", headers=rider).status_code == 200


def test_cancelled_order_cancels_its_open_job(client, rider, ready_order, sql):
    caf = headers(client, "cafeteria", "canteen@sjp.ac.lk")
    assert client.post(f"/api/cafeteria/orders/{ready_order['id']}/reject", json={"reason": "Spilled"}, headers=caf).status_code == 200
    assert sql("SELECT status FROM courier_jobs WHERE id=%s", (ready_order["jobId"],)) == [{"status": "cancelled"}]
    assert client.get("/api/courier/jobs", headers=rider).get_json() == []


def test_without_the_online_column(client, rider, sql, app):
    sql("ALTER TABLE users DROP COLUMN is_online")
    assert client.get("/api/courier/status", headers=rider).get_json() is True
    assert client.post("/api/courier/status", json={"online": False}, headers=rider).status_code == 503
