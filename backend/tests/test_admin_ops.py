from conftest import login


def test_admin_only(client, customer_headers):
    for path in ("/api/admin/ledger", "/api/admin/logs", "/api/admin/stats", "/api/admin/settings", "/api/admin/orders",
                 "/api/admin/analytics/peak"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=customer_headers).status_code == 403


def test_ledger_and_filter(client, admin_headers):
    all_rows = client.get("/api/admin/ledger", headers=admin_headers).get_json()
    assert [r["id"] for r in all_rows] == ["l1", "l2", "l4", "l3"]  # newest first, then id DESC
    assert all_rows[0] == {"id": "l1", "ref": "JE-1042", "party": "Nethmi P.", "amount": 850, "type": "sale",
                           "at": "2026-11-16T12:08:00.000Z", "createdAt": "2026-11-16T12:08:00.000Z"}
    assert [r["id"] for r in client.get("/api/admin/ledger?type=refund", headers=admin_headers).get_json()] == ["l4"]


def test_logs(client, admin_headers):
    logs = client.get("/api/admin/logs", headers=admin_headers).get_json()
    assert logs[0]["msg"] == "J Eats Admin signed in (admin)"  # the sign-in just now is newest
    assert logs[1] == {"id": "log1", "level": "info", "msg": "Queue broadcast Central Canteen → 14",
                       "at": "2026-11-16T12:11:00.000Z", "createdAt": "2026-11-16T12:11:00.000Z"}


def test_settings_round_trip(client, admin_headers, sql):
    assert client.get("/api/admin/settings", headers=admin_headers).get_json() == {
        "deliveryFee": 100, "riderPayout": 150, "cashCutoffHour": 11, "orderingOpen": True, "maxActiveJobsPerRider": 1}
    new = {"deliveryFee": 120, "riderPayout": 175.5, "cashCutoffHour": 14, "orderingOpen": False, "maxActiveJobsPerRider": 2}
    assert client.put("/api/admin/settings", json=new, headers=admin_headers).get_json() == new
    [row] = sql("SELECT * FROM platform_settings")
    assert float(row["delivery_fee"]) == 120 and row["cash_cutoff_hour"] == 14 and row["ordering_open"] == 0
    assert sql("SELECT COUNT(*) n FROM notifications WHERE role='customer' AND title='Ordering paused'")[0]["n"] == 1
    assert sql("SELECT COUNT(*) n FROM system_logs WHERE message LIKE 'Settings saved · delivery Rs. 120%%'")[0]["n"] == 1
    # The new fee is what checkout and the menu use.
    assert client.get("/api/menu/m_kottu").get_json()["deliveryFrom"] == 120
    for bad in ({**new, "deliveryFee": -1}, {**new, "cashCutoffHour": 24}, {"deliveryFee": 1}):
        assert client.put("/api/admin/settings", json=bad, headers=admin_headers).status_code == 400
    assert float(sql("SELECT delivery_fee FROM platform_settings")[0]["delivery_fee"]) == 120


def test_stats(client, admin_headers, customer_headers):
    client.post("/api/orders", json={"lines": [{"itemId": "m_kottu", "quantity": 1}], "fulfillment": "pickup",
                                     "payment": "wallet", "destination": "", "slot": "12:30", "notes": ""}, headers=customer_headers)
    s = client.get("/api/admin/stats?range=today", headers=admin_headers).get_json()
    assert s["orders"] == {"total": 1, "completed": 0, "active": 3, "cancelled": 0}
    assert s["volume"] == 1100 and s["byVendor"][0] == {"name": "Central Canteen", "revenue": 1100, "orders": 1}
    assert s["customers"]["total"] >= 3 and s["riders"]["approved"] == 2 and s["riders"]["pending"] == 1
    assert s["pendingApplications"]["courier"] == 1
    assert len(s["byHour"]) == 10 and {b["status"] for b in s["byStatus"]} >= {"placed", "cancelled"}
    peak = client.get("/api/admin/analytics/peak?range=week", headers=admin_headers).get_json()
    assert len(peak) == 10
    assert [o["id"] for o in client.get("/api/admin/orders", headers=admin_headers).get_json()][0].startswith("JE-")


def test_reset_is_refused(client, admin_headers, sql):
    res = client.post("/api/admin/reset", headers=admin_headers)
    assert res.status_code == 403 and "turned off" in res.get_json()["error"]
    assert sql("SELECT COUNT(*) n FROM orders")[0]["n"] == 2
