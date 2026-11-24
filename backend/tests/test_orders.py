import pytest

from conftest import login


def headers(client, role, ident, **extra):
    res = login(client, role, ident, **extra)
    assert res.status_code == 200, res.get_json()
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


@pytest.fixture()
def caf(client):
    return headers(client, "cafeteria", "canteen@sjp.ac.lk")


@pytest.fixture()
def no_cutoff(app, monkeypatch):
    """Cash is allowed: pretend it's 10 AM on campus, before the 11:00 cutoff."""
    import routes.orders as orders
    from common import local_now

    with app.app_context():
        now = local_now()
    monkeypatch.setattr(orders, "local_now", lambda: now.replace(hour=10))


def line(item, qty=1, **kw):
    # unitPrice is sent the way the browser does, but the server must ignore it.
    return {"itemId": item, "quantity": qty, "unitPrice": 1, "name": "x", "spice": "hot", **kw}


def place(client, h, lines, **kw):
    body = {"lines": lines, "fulfillment": "pickup", "payment": "wallet", "destination": "", "slot": "12:30", "notes": "", **kw}
    return client.post("/api/orders", json=body, headers=h)


def balance(sql, user="u_cus"):
    return float(sql("SELECT balance FROM wallets WHERE user_id=%s", (user,))[0]["balance"])


def test_place_wallet_order_writes_everything(client, customer_headers, sql):
    res = place(client, customer_headers, [line("m_kottu", 2, notes="no onion")])
    assert res.status_code == 201, res.get_json()
    body = res.get_json()
    [o] = body["orders"]
    assert o["id"] == "JE-1044" or o["id"] == "JE-1045"
    assert o["total"] == 2200 and body["total"] == 2200 and o["status"] == "placed"
    assert o["lines"][0]["unitPrice"] == 1100 and o["lines"][0]["spice"] == "hot" and o["lines"][0]["notes"] == "no onion"
    assert o["paymentStatus"] == "paid" and o["paymentRef"] == body["paymentRef"] and o["destination"] == "Central Canteen"
    assert balance(sql) == 300
    assert sql("SELECT stock FROM menu_items WHERE id='m_kottu'") == [{"stock": 10}]
    assert sql("SELECT status FROM order_status_history WHERE order_id=%s", (o["id"],)) == [{"status": "placed"}]
    assert sql("SELECT type FROM ledger_entries WHERE ref=%s", (o["id"],)) == [{"type": "sale"}]
    assert sql("SELECT kind, type FROM wallet_transactions WHERE ref=%s", (body["paymentRef"],)) == [{"kind": "payment", "type": "debit"}]
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_cus' AND title='Order confirmed'")[0]["n"] == 1
    assert sql("SELECT COUNT(*) n FROM notifications WHERE title=%s", (f"New order {o['id']}",))[0]["n"] == 1
    # It shows up for the customer, the kitchen and the admin.
    assert o["id"] in [x["id"] for x in client.get("/api/orders/mine", headers=customer_headers).get_json()]
    assert client.get(f"/api/orders/{o['id']}", headers=customer_headers).get_json()["total"] == 2200
    assert client.get("/api/orders/latest", headers=customer_headers).get_json()["status"] in ("placed", "preparing")


def test_order_numbers_follow_the_highest(client, customer_headers):
    a = place(client, customer_headers, [line("m_rolls")]).get_json()["orders"][0]["id"]
    b = place(client, customer_headers, [line("m_rolls")]).get_json()["orders"][0]["id"]
    assert a == "JE-1044" and b == "JE-1045"


def test_one_order_per_vendor_and_delivery_fee(client, customer_headers, sql):
    res = place(client, customer_headers, [line("m_rice_curry"), line("m_rolls")], fulfillment="delivery", destination="Library")
    assert res.status_code == 201
    orders = res.get_json()["orders"]
    assert {o["vendorId"] for o in orders} == {"v_cc", "v_fc"}
    assert sorted(o["total"] for o in orders) == [480, 950]
    assert res.get_json()["total"] == 1430 and balance(sql) == 1070
    assert all(o["destination"] == "Library" for o in orders)


def test_validation(client, customer_headers, sql):
    assert place(client, customer_headers, []).status_code == 400
    assert place(client, customer_headers, [line("m_kottu")], fulfillment="air").status_code == 400
    assert place(client, customer_headers, [line("m_kottu")], fulfillment="delivery").status_code == 400
    assert place(client, customer_headers, [line("m_kottu", 0)]).status_code == 400
    assert place(client, customer_headers, [line("m_kottu")], slot="03:00").status_code == 400
    assert place(client, customer_headers, [line("nope")]).status_code == 409
    res = place(client, customer_headers, [line("m_kottu", 13)])
    assert res.status_code == 409 and "Only 12" in res.get_json()["error"]
    sql("UPDATE vendors SET open_now = FALSE WHERE id='v_cc'")
    assert "closed" in place(client, customer_headers, [line("m_kottu")]).get_json()["error"]
    sql("UPDATE platform_settings SET ordering_open = FALSE")
    assert place(client, customer_headers, [line("m_rolls")]).status_code == 423
    assert sql("SELECT COUNT(*) n FROM orders")[0]["n"] == 2


def test_cash_cutoff(client, customer_headers, sql):
    sql("UPDATE platform_settings SET cash_cutoff_hour = 0")
    res = place(client, customer_headers, [line("m_kottu")], payment="cash")
    assert res.status_code == 400 and "Cash orders close" in res.get_json()["error"]
    # Pre-orders are still allowed.
    assert place(client, customer_headers, [line("m_kottu")], payment="cash", preOrder=True, scheduledFor="2026-12-01").status_code == 201


def test_not_enough_wallet_rolls_everything_back(client, customer_headers, sql):
    res = place(client, customer_headers, [line("m_kottu", 3)])
    assert res.status_code == 402 and "too low" in res.get_json()["error"]
    assert balance(sql) == 2500
    assert sql("SELECT stock FROM menu_items WHERE id='m_kottu'") == [{"stock": 12}]
    assert sql("SELECT COUNT(*) n FROM orders")[0]["n"] == 2
    assert sql("SELECT COUNT(*) n FROM notifications WHERE title LIKE 'New order%%'")[0]["n"] == 0


def test_promos(client, customer_headers, sql):
    check = lambda code, sub, fees: client.post("/api/promos/check", json={"code": code, "subtotal": sub, "deliveryFees": fees}, headers=customer_headers)
    # Mira already has orders, so FIRSTBITE is refused.
    assert check("firstbite", 1000, 0).status_code == 400
    assert check("CAMPUSCREW", 1000, 100).status_code == 400
    assert check("CAMPUSCREW", 2000, 0).status_code == 400
    assert check("CAMPUSCREW", 2000, 100).get_json() == {"discount": 100, "code": "CAMPUSCREW", "description": "Free delivery on orders over Rs. 1,500"}
    assert check("", 100, 0).get_json() == {"discount": 0, "description": ""}
    assert check("BOGUS", 100, 0).status_code == 400
    sql("DELETE FROM order_status_history"); sql("DELETE FROM order_lines"); sql("DELETE FROM orders")
    assert check("FIRSTBITE", 1000, 0).get_json()["discount"] == 200
    res = place(client, customer_headers, [line("m_kottu")], promoCode="FIRSTBITE")
    [o] = res.get_json()["orders"]
    assert o["total"] == 880 and o["discount"] == 220 and o["promoCode"] == "FIRSTBITE" and balance(sql) == 1620


def test_cancel_refunds_and_restocks(client, customer_headers, caf, sql):
    o = place(client, customer_headers, [line("m_kottu", 2)]).get_json()["orders"][0]
    res = client.post(f"/api/orders/{o['id']}/cancel", json={"reason": "Changed my mind"}, headers=customer_headers)
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "cancelled" and body["paymentStatus"] == "refunded" and body["cancelReason"] == "Changed my mind"
    assert body["timeline"][-1]["note"] == "Customer: Changed my mind"
    assert balance(sql) == 2500
    assert sql("SELECT stock FROM menu_items WHERE id='m_kottu'") == [{"stock": 12}]
    assert sql("SELECT type FROM ledger_entries WHERE ref=%s ", (o["id"],)) and sorted(r["type"] for r in sql("SELECT type FROM ledger_entries WHERE ref=%s", (o["id"],))) == ["refund", "sale"]
    assert client.post(f"/api/orders/{o['id']}/cancel", json={}, headers=customer_headers).status_code == 409
    # JE-1042 is already being prepared.
    assert client.post("/api/orders/JE-1042/cancel", json={}, headers=customer_headers).status_code == 409
    # Someone else's order looks missing.
    other = headers(client, "customer", "anika.staff@sjp.ac.lk", customerSubRole="academic")
    assert client.post("/api/orders/JE-1043/cancel", json={}, headers=other).status_code == 404


def test_cancel_cash_order_makes_no_refund(client, customer_headers, sql, no_cutoff):
    o = place(client, customer_headers, [line("m_kottu")], payment="cash").get_json()["orders"][0]
    assert o["paymentStatus"] == "pending" and balance(sql) == 2500
    assert sql("SELECT COUNT(*) n FROM ledger_entries WHERE ref=%s", (o["id"],))[0]["n"] == 0
    body = client.post(f"/api/orders/{o['id']}/cancel", json={}, headers=customer_headers).get_json()
    assert body["paymentStatus"] == "pending" and body["cancelReason"] == "Cancelled by customer"
    assert balance(sql) == 2500


def test_reschedule(client, customer_headers, sql):
    res = client.post("/api/orders/JE-1043/reschedule", json={"slot": "13:00", "scheduledFor": "2026-11-20"}, headers=customer_headers)
    assert res.status_code == 200 and res.get_json()["slot"] == "13:00"
    assert sql("SELECT slot, scheduled_for FROM orders WHERE id='JE-1043'")[0]["slot"] == "13:00"
    assert str(sql("SELECT scheduled_for FROM orders WHERE id='JE-1043'")[0]["scheduled_for"]) == "2026-11-20"
    assert client.post("/api/orders/JE-1043/reschedule", json={"slot": "nope"}, headers=customer_headers).status_code == 400
    assert client.post("/api/orders/JE-1042/reschedule", json={"slot": "13:00"}, headers=customer_headers).status_code == 409


def test_receipt(client, customer_headers):
    text = client.get("/api/orders/JE-1042/receipt", headers=customer_headers).get_json()
    assert "Order      JE-1042" in text and "Receipt    RC-1042" in text and "TOTAL" in text and "Rs. 850" in text
    assert client.get("/api/orders/JE-1042/receipt").status_code == 401


def test_kitchen_pickup_flow_and_cash_is_paid_on_collection(client, customer_headers, caf, sql, no_cutoff):
    o = place(client, customer_headers, [line("m_kottu")], payment="cash").get_json()["orders"][0]
    assert o["id"] in [x["id"] for x in client.get("/api/cafeteria/orders", headers=caf).get_json()]
    seen = []
    for _ in range(4):
        r = client.post(f"/api/cafeteria/orders/{o['id']}/status", json={}, headers=caf)
        assert r.status_code == 200, r.get_json()
        seen.append(r.get_json()["status"])
    assert seen == ["accepted", "preparing", "ready", "delivered"]
    assert sql("SELECT payment_status FROM orders WHERE id=%s", (o["id"],)) == [{"payment_status": "paid"}]
    assert [h["status"] for h in sql("SELECT status FROM order_status_history WHERE order_id=%s ORDER BY id", (o["id"],))] == [
        "placed", "accepted", "preparing", "ready", "delivered"]
    assert client.post(f"/api/cafeteria/orders/{o['id']}/status", json={}, headers=caf).status_code == 409
    assert sql("SELECT COUNT(*) n FROM courier_jobs WHERE order_id=%s", (o["id"],))[0]["n"] == 0
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_cus' AND body='Central Canteen marked your order as collected.'")[0]["n"] == 1


def test_delivery_order_opens_a_courier_job_when_ready(client, customer_headers, caf, sql):
    o = place(client, customer_headers, [line("m_kottu")], fulfillment="delivery", destination="Library").get_json()["orders"][0]
    for _ in range(3):
        last = client.post(f"/api/cafeteria/orders/{o['id']}/status", json={}, headers=caf).get_json()
    assert last["status"] == "ready" and last["jobId"].startswith("job")
    [job] = sql("SELECT * FROM courier_jobs WHERE order_id=%s", (o["id"],))
    assert job["status"] == "open" and job["pickup_from"] == "Central Canteen" and job["drop_to"] == "Library"
    assert float(job["payout"]) == 150 and job["items"] == 1
    assert sql("SELECT COUNT(*) n FROM notifications WHERE role='courier' AND title='New delivery job'")[0]["n"] == 1
    # The kitchen can't mark a delivery order delivered; a rider does that.
    assert client.post(f"/api/cafeteria/orders/{o['id']}/status", json={"status": "delivered"}, headers=caf).status_code == 409
    # Riders can see the order while the job is open.
    rider = headers(client, "courier", "ari@sjp.ac.lk")
    assert client.get(f"/api/orders/{o['id']}", headers=rider).status_code == 200
    assert client.get("/api/orders/JE-1042", headers=rider).status_code == 404


def test_kitchen_reject_refunds(client, customer_headers, caf, sql):
    o = place(client, customer_headers, [line("m_kottu")]).get_json()["orders"][0]
    res = client.post(f"/api/cafeteria/orders/{o['id']}/reject", json={"reason": "Out of cheese"}, headers=caf)
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "cancelled" and body["paymentStatus"] == "refunded" and body["timeline"][-1]["note"] == "Central Canteen: Out of cheese"
    assert balance(sql) == 2500
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_cus' AND title=%s", (f"Order {o['id']} declined",))[0]["n"] == 1
    assert client.post(f"/api/cafeteria/orders/{o['id']}/reject", json={}, headers=caf).status_code == 409


def test_kitchens_only_touch_their_own_orders(client, customer_headers, sql):
    fc = headers(client, "cafeteria", "cafe@sjp.ac.lk")
    assert client.get("/api/cafeteria/orders", headers=fc).get_json() == []
    assert client.post("/api/cafeteria/orders/JE-1042/status", json={}, headers=fc).status_code == 404
    assert client.post("/api/cafeteria/orders/JE-1042/reject", json={}, headers=fc).status_code == 404
    assert client.get("/api/orders/JE-1042", headers=fc).status_code == 404
    assert client.post("/api/cafeteria/orders/JE-1042/status", json={}, headers=customer_headers).status_code == 403


def test_admin_sees_all_orders(client, admin_headers, customer_headers):
    ids = [o["id"] for o in client.get("/api/orders", headers=admin_headers).get_json()]
    assert ids == ["JE-1042", "JE-1043"]
    assert client.get("/api/orders", headers=customer_headers).status_code == 403
    assert client.get("/api/orders/JE-1042", headers=admin_headers).get_json()["customerName"] == "Mira Sen"


def test_vendor_stats(client, customer_headers, caf):
    place(client, customer_headers, [line("m_kottu")])
    s = client.get("/api/cafeteria/stats?range=today", headers=caf).get_json()
    assert s["total"] == 1 and s["sales"] == 1100 and s["active"] == 3
    assert s["bestsellers"][0]["itemId"] == "m_kottu" and len(s["byHour"]) == 10 and len(s["byDay"]) == 7
    assert sum(d["v"] for d in s["byDay"]) == 1100
    month = client.get("/api/cafeteria/stats?range=month", headers=caf).get_json()
    assert month["total"] >= 1
