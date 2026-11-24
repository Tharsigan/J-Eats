from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from conftest import login


def test_menu_comes_from_the_database_in_the_frontend_shape(client, sql):
    res = client.get("/api/menu")
    assert res.status_code == 200
    items = {m["id"]: m for m in res.get_json()}
    assert len(items) == sql("SELECT COUNT(*) n FROM menu_items")[0]["n"] == 9
    rice = items["m_rice_curry"]
    assert rice["name"] == "Campus Chicken Rice & Curry" and rice["price"] == 850 and rice["currency"] == "LKR"
    assert rice["prepMinutes"] == [15, 20] and rice["deliveryFrom"] == 100 and rice["maxPerOrder"] == 18
    assert rice["favourite"] is True and rice["tags"] == ["Campus favourite"]
    assert items["m_rolls"]["favourite"] is False and items["m_rolls"]["tags"] == ["Quick bite"]
    assert items["m_stringhop"]["available"] is False


def test_get_item_by_id_or_slug(client):
    assert client.get("/api/menu/m_kottu").get_json()["slug"] == "cheesy-chicken-kottu"
    assert client.get("/api/menu/cheesy-chicken-kottu").get_json()["id"] == "m_kottu"
    assert client.get("/api/menu/nope").status_code == 404


def test_delivery_fee_follows_platform_settings(client, sql):
    sql("UPDATE platform_settings SET delivery_fee = 120 WHERE id = 1")
    assert client.get("/api/menu/m_kottu").get_json()["deliveryFrom"] == 120


def test_related_prefers_same_vendor_and_skips_unavailable(client):
    related = client.get("/api/menu/m_rice_curry/related").get_json()
    assert len(related) == 3
    assert related[0]["vendorId"] == "v_cc"
    assert all(r["available"] and r["id"] != "m_rice_curry" for r in related)


def test_vendors_and_queue(client):
    vendors = {v["id"]: v for v in client.get("/api/vendors").get_json()}
    assert vendors["v_cc"]["name"] == "Central Canteen" and vendors["v_cc"]["queue"] == 14
    assert client.get("/api/vendors/v_fc").get_json()["closesAt"] == "6:30 PM"
    assert client.get("/api/vendors/nope").status_code == 404


def test_reviews(client):
    reviews = client.get("/api/menu/m_rice_curry/reviews").get_json()
    assert [r["author"] for r in reviews] == ["Nethmi P.", "Kasun D."]
    assert reviews[0]["verified"] is True and reviews[0]["daysAgo"] >= 0
    assert len(client.get("/api/reviews").get_json()) == 2


def test_adding_a_review_updates_rating_and_notifies_the_vendor(client, customer_headers, sql):
    res = client.post("/api/menu/m_kottu/reviews", json={"rating": 5, "body": "Great!", "orderId": "JE-1043"}, headers=customer_headers)
    assert res.status_code == 201
    review = res.get_json()
    assert review["author"] == "Mira S." and review["rating"] == 5 and review["verified"] is False
    [item] = sql("SELECT rating, review_count FROM menu_items WHERE id='m_kottu'")
    assert item["review_count"] == 89 and float(item["rating"]) == round((4.6 * 88 + 5) / 89, 1)
    assert sql("SELECT reviewed FROM orders WHERE id='JE-1043'") == [{"reviewed": 1}]
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_caf' AND title='New 5★ review'")[0]["n"] == 1
    assert client.get("/api/menu/m_kottu/reviews").get_json()[0]["body"] == "Great!"


def test_review_rules(client, customer_headers, admin_headers):
    assert client.post("/api/menu/m_kottu/reviews", json={"rating": 5, "body": "x"}).status_code == 401
    assert client.post("/api/menu/m_kottu/reviews", json={"rating": 5, "body": "x"}, headers=admin_headers).status_code == 403
    assert client.post("/api/menu/m_kottu/reviews", json={"rating": 5, "body": "  "}, headers=customer_headers).status_code == 400
    assert client.post("/api/menu/nope/reviews", json={"rating": 5, "body": "x"}, headers=customer_headers).status_code == 404
    res = client.post("/api/menu/m_kottu/reviews", json={"rating": 9, "body": "Too good"}, headers=customer_headers)
    assert res.get_json()["rating"] == 5


def test_review_is_verified_after_a_delivered_order(client, customer_headers, sql):
    sql("UPDATE orders SET status='delivered' WHERE id='JE-1042'")
    res = client.post("/api/menu/m_rice_curry/reviews", json={"rating": 4, "body": "Nice"}, headers=customer_headers)
    assert res.get_json()["verified"] is True


def test_favourites(client, customer_headers, sql):
    assert client.get("/api/favourites").get_json() == []
    assert client.get("/api/favourites", headers=customer_headers).get_json() == ["m_rice_curry"]
    assert client.post("/api/favourites/m_kottu", headers=customer_headers).get_json() == ["m_kottu", "m_rice_curry"]
    assert client.post("/api/favourites/m_rice_curry", headers=customer_headers).get_json() == ["m_kottu"]
    assert sql("SELECT item_id FROM favourites WHERE user_id='u_cus'") == [{"item_id": "m_kottu"}]
    assert client.post("/api/favourites/m_kottu").status_code == 401
    assert client.post("/api/favourites/nope", headers=customer_headers).status_code == 404


def test_slots_count_bookings_and_hide_past_times(client, sql, app):
    tomorrow = (datetime.now(ZoneInfo(app.config["TIMEZONE"])) + timedelta(days=1)).date().isoformat()
    for i in range(6):
        sql(
            "INSERT INTO orders (id, customer_id, vendor_id, status, fulfillment, payment_method, total, slot, scheduled_for) "
            "VALUES (%s, 'u_cus', 'v_cc', 'placed', 'pickup', 'cash', 100, '12:00', %s)",
            (f"T-{i}", tomorrow),
        )
    sql("INSERT INTO orders (id, customer_id, vendor_id, status, fulfillment, payment_method, total, slot, scheduled_for) "
        "VALUES ('T-9', 'u_cus', 'v_cc', 'placed', 'pickup', 'cash', 100, '13:00', %s)", (tomorrow,))
    slots = {s["id"]: s for s in client.get(f"/api/slots?date={tomorrow}").get_json()}
    assert len(slots) == 14 and slots["08:30"]["label"] == "8:30 AM" and slots["13:00"]["label"] == "1:00 PM"
    assert slots["12:00"] == {"id": "12:00", "label": "12:00 PM", "hint": "Fully booked", "available": False}
    assert slots["13:00"]["hint"] == "5 left" and slots["13:00"]["available"] is True
    assert slots["08:30"]["hint"] == "Available"
    assert client.get("/api/slots?date=not-a-date").status_code == 400


def test_works_on_an_older_database_without_the_migration_columns(client, sql, app):
    sql("ALTER TABLE menu_items DROP COLUMN tag, DROP COLUMN featured")
    rice = client.get("/api/menu/m_rice_curry").get_json()
    assert rice["tags"] == [] and rice["favourite"] is False
