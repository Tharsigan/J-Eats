from conftest import login


def test_signed_in_users_see_their_own_and_role_broadcasts(client, customer_headers, admin_headers):
    assert client.get("/api/notifications").status_code == 401
    mine = client.get("/api/notifications", headers=customer_headers).get_json()
    assert [n["id"] for n in mine] == ["n1"]
    assert mine[0] == {"id": "n1", "title": "Order JE-1042", "body": "Central Canteen started preparing your rice & curry.",
                       "at": "2026-11-16T12:14:00.000Z", "read": False, "userId": "u_cus",
                       "href": "/customer/track?id=JE-1042", "createdAt": "2026-11-16T12:14:00.000Z"}
    admin = client.get("/api/notifications", headers=admin_headers).get_json()
    assert [n["id"] for n in admin] == ["n4"] and admin[0]["role"] == "admin" and admin[0]["read"] is False


def test_mark_read_own_and_broadcast(client, customer_headers, admin_headers, sql):
    assert client.post("/api/notifications/n1/read", headers=customer_headers).get_json() == {"ok": True}
    assert sql("SELECT is_read FROM notifications WHERE id='n1'") == [{"is_read": 1}]
    # Someone else's notification looks missing.
    assert client.post("/api/notifications/n4/read", headers=customer_headers).status_code == 404
    assert client.post("/api/notifications/n1/read", headers=admin_headers).status_code == 404

    # A broadcast is read per admin, not for everyone.
    client.post("/api/notifications/n4/read", headers=admin_headers)
    assert len(sql("SELECT user_id FROM notification_reads WHERE notification_id='n4'")) == 1
    assert sql("SELECT is_read FROM notifications WHERE id='n4'") == [{"is_read": 0}]
    assert client.get("/api/notifications", headers=admin_headers).get_json()[0]["read"] is True


def test_mark_all_read(client, customer_headers, sql):
    sql("""INSERT INTO notifications (id, user_id, role, title, body) VALUES
           ('nb', NULL, 'customer', 'Queue update', 'Short queue now'),
           ('nc', 'u_cus_ac', NULL, 'Not yours', 'x')""")
    assert {n["id"] for n in client.get("/api/notifications", headers=customer_headers).get_json()} == {"n1", "nb"}
    assert client.post("/api/notifications/read-all", headers=customer_headers).get_json() == {"ok": True}
    assert all(n["read"] for n in client.get("/api/notifications", headers=customer_headers).get_json())
    assert sql("SELECT is_read FROM notifications WHERE id='nc'") == [{"is_read": 0}]
    # Another customer still sees the broadcast as unread.
    res = login(client, "customer", "anika.staff@sjp.ac.lk", customerSubRole="academic")
    other = {"Authorization": f"Bearer {res.get_json()['token']}"}
    nb = [n for n in client.get("/api/notifications", headers=other).get_json() if n["id"] == "nb"]
    assert nb[0]["read"] is False
