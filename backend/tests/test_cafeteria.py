import base64
from pathlib import Path

import pytest

from conftest import PNG, login


@pytest.fixture()
def caf(client):
    res = login(client, "cafeteria", "canteen@sjp.ac.lk")
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


def data_url(raw: bytes, mime="image/png"):
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def test_cafeteria_only(client, customer_headers):
    assert client.get("/api/cafeteria/vendor").status_code == 401
    assert client.get("/api/cafeteria/vendor", headers=customer_headers).status_code == 403


def test_vendor_open_close_and_details(client, caf, sql):
    assert client.get("/api/cafeteria/vendor", headers=caf).get_json()["name"] == "Central Canteen"
    res = client.patch("/api/cafeteria/vendor", json={"openNow": False, "closesAt": "5:00 PM"}, headers=caf)
    assert res.status_code == 200 and res.get_json()["openNow"] is False
    assert sql("SELECT open_now, closes_at FROM vendors WHERE id='v_cc'") == [{"open_now": 0, "closes_at": "5:00 PM"}]
    assert sql("SELECT COUNT(*) n FROM system_logs WHERE message='Central Canteen is now closed'")[0]["n"] == 1
    # Another vendor is untouched.
    assert sql("SELECT open_now FROM vendors WHERE id='v_fc'") == [{"open_now": 1}]


def test_unlinked_cafeteria_gets_a_clear_404(client, sql):
    sql("UPDATE users SET verification_status='approved' WHERE id='u_caf_pending'")
    res = login(client, "cafeteria", "lawn.stall@sjp.ac.lk")
    h = {"Authorization": f"Bearer {res.get_json()['token']}"}
    assert client.get("/api/cafeteria/menu", headers=h).status_code == 404


def test_my_menu_and_inventory_only_show_my_items(client, caf):
    ids = {m["id"] for m in client.get("/api/cafeteria/menu", headers=caf).get_json()}
    assert ids == {"m_rice_curry", "m_kottu", "m_stringhop"}
    inv = {r["id"]: r for r in client.get("/api/cafeteria/inventory", headers=caf).get_json()}
    assert inv["m_kottu"] == {"id": "m_kottu", "name": "Cheesy Chicken Kottu", "stock": 12, "price": 1100, "available": True}


def test_patch_inventory_updates_the_database(client, caf, sql):
    res = client.patch("/api/cafeteria/inventory/m_kottu", json={"stock": 2, "price": 1150, "available": False}, headers=caf)
    assert res.status_code == 200 and res.get_json() == {"id": "m_kottu", "name": "Cheesy Chicken Kottu", "stock": 2, "price": 1150, "available": False}
    [row] = sql("SELECT stock, price, available FROM menu_items WHERE id='m_kottu'")
    assert row["stock"] == 2 and float(row["price"]) == 1150 and row["available"] == 0
    assert sql("SELECT COUNT(*) n FROM system_logs WHERE message='Stock low: Cheesy Chicken Kottu (2)'")[0]["n"] == 1
    assert client.patch("/api/cafeteria/inventory/m_kottu", json={"price": 0}, headers=caf).status_code == 400
    assert client.patch("/api/cafeteria/inventory/m_kottu", json={"stock": -5}, headers=caf).get_json()["stock"] == 0
    # Another vendor's item can't be edited.
    assert client.patch("/api/cafeteria/inventory/m_rolls", json={"stock": 1}, headers=caf).status_code == 404


def test_photo_upload_is_saved_as_a_file_and_served(client, caf, sql, app):
    res = client.patch("/api/cafeteria/inventory/m_kottu", json={"image": data_url(PNG)}, headers=caf)
    assert res.status_code == 200
    url = sql("SELECT image_url FROM menu_items WHERE id='m_kottu'")[0]["image_url"]
    assert url.startswith("/media/menu/") and url.endswith(".png") and len(url) < 255
    assert (Path(app.config["UPLOAD_FOLDER"]) / "menu" / url.rsplit("/", 1)[-1]).read_bytes() == PNG
    photo = client.get("/api" + url)
    assert photo.status_code == 200 and photo.data == PNG and photo.mimetype == "image/png"
    assert client.get("/api/menu/m_kottu").get_json()["image"] == url
    # Fake images, other links and path tricks are refused.
    assert client.patch("/api/cafeteria/inventory/m_kottu", json={"image": data_url(b"<svg/>", "image/svg+xml")}, headers=caf).status_code == 400
    assert client.patch("/api/cafeteria/inventory/m_kottu", json={"image": "https://evil.example/x.png"}, headers=caf).status_code == 400
    assert client.get("/api/media/menu/..%2Fverification%2Fx.pdf").status_code == 404
    big = data_url(PNG + b"\x00" * (401 * 1024))
    assert client.patch("/api/cafeteria/inventory/m_kottu", json={"image": big}, headers=caf).status_code == 400


def test_create_menu_item(client, caf, sql):
    res = client.post("/api/cafeteria/menu", json={
        "name": "Fish Bun", "category": "Snacks", "description": "", "price": 150, "stock": 20,
        "maxPerOrder": 6, "prepMin": 5, "prepMax": 8, "image": data_url(PNG),
    }, headers=caf)
    assert res.status_code == 201
    item = res.get_json()
    assert item["slug"] == "fish-bun" and item["vendorId"] == "v_cc" and item["tags"] == ["New"]
    assert item["description"] == "Freshly prepared on campus." and item["image"].startswith("/media/menu/")
    assert sql("SELECT name, price, stock FROM menu_items WHERE id=%s", (item["id"],))[0]["name"] == "Fish Bun"
    assert any(m["id"] == item["id"] for m in client.get("/api/menu").get_json())
    # Same name again gets a unique slug.
    again = client.post("/api/cafeteria/menu", json={"name": "Fish Bun", "price": 160, "stock": 1, "maxPerOrder": 1, "prepMin": 5, "prepMax": 5}, headers=caf)
    assert again.status_code == 201 and again.get_json()["slug"] != "fish-bun"
    assert client.post("/api/cafeteria/menu", json={"name": "", "price": 100}, headers=caf).status_code == 400
    assert client.post("/api/cafeteria/menu", json={"name": "Free", "price": 0}, headers=caf).status_code == 400


def test_delete_menu_item(client, caf, sql):
    created = client.post("/api/cafeteria/menu", json={"name": "Temp", "price": 100, "stock": 1, "maxPerOrder": 1, "prepMin": 1, "prepMax": 1}, headers=caf).get_json()
    assert client.delete(f"/api/cafeteria/menu/{created['id']}", headers=caf).get_json() == {"ok": True}
    assert sql("SELECT COUNT(*) n FROM menu_items WHERE id=%s", (created["id"],))[0]["n"] == 0
    # Items in past orders are kept (order history needs them).
    res = client.delete("/api/cafeteria/menu/m_rice_curry", headers=caf)
    assert res.status_code == 409 and "Hide it" in res.get_json()["error"]
    assert sql("SELECT COUNT(*) n FROM menu_items WHERE id='m_rice_curry'")[0]["n"] == 1
    assert client.delete("/api/cafeteria/menu/m_rolls", headers=caf).status_code == 404


def test_queue_broadcast(client, caf, sql):
    assert client.get("/api/cafeteria/queue", headers=caf).get_json() == {"queueLength": 14}
    assert client.post("/api/cafeteria/queue", json={"n": 7}, headers=caf).get_json() == {"queueLength": 7}
    assert sql("SELECT queue_length FROM vendors WHERE id='v_cc'") == [{"queue_length": 7}]
    assert sql("SELECT COUNT(*) n FROM notifications WHERE role='customer' AND title='Central Canteen queue update'")[0]["n"] == 1
    vendors = {v["id"]: v for v in client.get("/api/vendors").get_json()}
    assert vendors["v_cc"]["queue"] == 7


def test_create_works_without_the_tag_column(client, caf, sql):
    sql("ALTER TABLE menu_items DROP COLUMN tag")
    res = client.post("/api/cafeteria/menu", json={"name": "Old DB", "price": 100, "stock": 1, "maxPerOrder": 1, "prepMin": 1, "prepMax": 1}, headers=caf)
    assert res.status_code == 201 and res.get_json()["tags"] == []
