import io

from conftest import PDF, PNG, login
from test_register import post, rider_form


def test_only_admins_can_list_or_review(client, customer_headers):
    assert client.get("/api/admin/approvals").status_code == 401
    assert client.get("/api/admin/approvals", headers=customer_headers).status_code == 403
    res = client.post("/api/admin/approvals/app_rid_1", json={"status": "approved"}, headers=customer_headers)
    assert res.status_code == 403
    assert client.post("/api/admin/approvals/app_rid_1", json={"status": "approved"}).status_code == 401


def test_list_returns_seeded_applications_with_user_details(client, admin_headers):
    res = client.get("/api/admin/approvals", headers=admin_headers)
    assert res.status_code == 200
    apps = {a["id"]: a for a in res.get_json()}
    # All four seeded applications, including app_cus_ac now that seed.sql has its user.
    assert set(apps) == {"app_cus_pending", "app_rid_1", "app_caf_1", "app_cus_ac"}
    rider = apps["app_rid_1"]
    assert rider["userId"] == "u_cou_pending" and rider["name"] == "Kasun Dias"
    assert rider["email"] == "kasun.rider@sjp.ac.lk" and rider["role"] == "courier"
    assert rider["verificationStatus"] == "pending" and rider["submittedAt"] == "2026-11-16T05:40:00.000Z"
    assert [d["kind"] for d in rider["documents"]] == ["NIC / Student ID", "Driving License / Vehicle Proof"]
    assert all(d["url"] == "" for d in rider["documents"])  # seeded docs have no stored file
    assert apps["app_cus_ac"]["customerSubRole"] == "academic"


def test_approving_a_rider_updates_mariadb(client, admin_headers, sql):
    assert login(client, "courier", "kasun.rider@sjp.ac.lk").status_code == 403
    res = client.post("/api/admin/approvals/app_rid_1", json={"status": "approved"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json()["verificationStatus"] == "approved" and res.get_json()["name"] == "Kasun Dias"

    assert sql("SELECT verification_status FROM verification_applications WHERE id='app_rid_1'")[0]["verification_status"] == "approved"
    assert sql("SELECT verification_status FROM users WHERE id='u_cou_pending'")[0]["verification_status"] == "approved"
    assert sql("SELECT balance FROM wallets WHERE user_id='u_cou_pending'")[0]["balance"] == 0
    assert sql("SELECT title FROM notifications WHERE user_id='u_cou_pending'") == [{"title": "Account approved"}]
    assert sql("SELECT level FROM system_logs WHERE message LIKE 'Admin approved rider application: Kasun Dias%%'") == [{"level": "ok"}]
    # Other pending users are untouched.
    assert {r["id"] for r in sql("SELECT id FROM users WHERE verification_status='pending'")} == {
        "u_cus_pending", "u_caf_pending", "u_cus_ac_pending"}

    assert login(client, "courier", "kasun.rider@sjp.ac.lk").status_code == 200
    # Survives a "refresh": a brand-new request reads the same state back.
    listed = {a["id"]: a for a in client.get("/api/admin/approvals", headers=admin_headers).get_json()}
    assert listed["app_rid_1"]["verificationStatus"] == "approved"


def test_rejecting_a_customer_updates_mariadb(client, admin_headers, sql):
    res = client.post("/api/admin/approvals/app_cus_pending", json={"status": "rejected"}, headers=admin_headers)
    assert res.status_code == 200
    assert sql("SELECT verification_status FROM users WHERE id='u_cus_pending'")[0]["verification_status"] == "rejected"
    assert sql("SELECT verification_status FROM verification_applications WHERE id='app_cus_pending'")[0]["verification_status"] == "rejected"
    assert sql("SELECT COUNT(*) n FROM wallets WHERE user_id='u_cus_pending'")[0]["n"] == 0
    assert sql("SELECT title FROM notifications WHERE user_id='u_cus_pending'") == [{"title": "Verification rejected"}]
    res = login(client, "customer", "nimal.pending@sjp.ac.lk", customerSubRole="student")
    assert res.status_code == 403 and "rejected" in res.get_json()["error"]


def test_approving_a_cafeteria_creates_its_vendor(client, admin_headers, sql):
    vendors_before = sql("SELECT COUNT(*) n FROM vendors")[0]["n"]
    assert client.post("/api/admin/approvals/app_caf_1", json={"status": "approved"}, headers=admin_headers).status_code == 200
    [user] = sql("SELECT vendor_id, verification_status FROM users WHERE id='u_caf_pending'")
    assert user["verification_status"] == "approved" and user["vendor_id"]
    [vendor] = sql("SELECT name, location FROM vendors WHERE id=%s", (user["vendor_id"],))
    assert vendor == {"name": "Faculty Lawn Stall", "location": "University campus"}
    assert sql("SELECT COUNT(*) n FROM vendors")[0]["n"] == vendors_before + 1
    assert login(client, "cafeteria", "lawn.stall@sjp.ac.lk").get_json()["user"]["vendorId"] == user["vendor_id"]


def test_only_pending_applications_can_be_reviewed(client, admin_headers):
    url = "/api/admin/approvals/app_rid_1"
    assert client.post(url, json={"status": "approved"}, headers=admin_headers).status_code == 200
    again = client.post(url, json={"status": "rejected"}, headers=admin_headers)
    assert again.status_code == 409 and "already approved" in again.get_json()["error"]
    assert client.post(url, json={"status": "pending"}, headers=admin_headers).status_code == 400
    assert client.post("/api/admin/approvals/nope", json={"status": "approved"}, headers=admin_headers).status_code == 404


def test_review_is_atomic(client, admin_headers, sql, app, monkeypatch):
    """If any step fails, nothing from the review is saved."""
    import db

    real = db.Tx.execute

    def failing(self, statement, params=None):
        if statement.lstrip().startswith("INSERT INTO notifications"):
            raise RuntimeError("simulated failure after the UPDATEs and wallet insert")
        return real(self, statement, params)

    monkeypatch.setattr(db.Tx, "execute", failing)
    app.config["PROPAGATE_EXCEPTIONS"] = False
    res = client.post("/api/admin/approvals/app_rid_1", json={"status": "approved"}, headers=admin_headers)
    assert res.status_code == 500

    assert sql("SELECT verification_status FROM verification_applications WHERE id='app_rid_1'")[0]["verification_status"] == "pending"
    assert sql("SELECT verification_status FROM users WHERE id='u_cou_pending'")[0]["verification_status"] == "pending"
    assert sql("SELECT COUNT(*) n FROM wallets WHERE user_id='u_cou_pending'")[0]["n"] == 0


def test_suspended_admin_loses_access_immediately(client, admin_headers, sql):
    sql("UPDATE users SET status='suspended' WHERE id='u_adm'")
    assert client.get("/api/admin/approvals", headers=admin_headers).status_code == 403


def test_full_flow_register_then_approve(client, admin_headers, sql):
    assert post(client, rider_form()).status_code == 201
    apps = client.get("/api/admin/approvals", headers=admin_headers).get_json()
    mine = next(a for a in apps if a["email"] == "test.rider@sjp.ac.lk")
    assert mine["verificationStatus"] == "pending"
    assert apps[0]["id"] == mine["id"]  # newest pending application is listed first
    assert [d["contentType"] for d in mine["documents"]] == ["image/png", "application/pdf"]

    res = client.post(f"/api/admin/approvals/{mine['id']}", json={"status": "approved"}, headers=admin_headers)
    assert res.status_code == 200
    res = login(client, "courier", "test.rider@sjp.ac.lk", "rider-pass-1")
    assert res.status_code == 200 and res.get_json()["user"]["verificationStatus"] == "approved"


def test_documents_are_admin_only(client, admin_headers, customer_headers, sql):
    assert post(client, rider_form()).status_code == 201
    apps = client.get("/api/admin/approvals", headers=admin_headers).get_json()
    doc = next(a for a in apps if a["email"] == "test.rider@sjp.ac.lk")["documents"][0]
    assert doc["url"].startswith("/admin/documents/")
    url = "/api" + doc["url"]

    assert client.get(url).status_code == 401
    assert client.get(url, headers=customer_headers).status_code == 403
    res = client.get(url, headers=admin_headers)
    assert res.status_code == 200 and res.data == PNG
    assert res.mimetype == "image/png"
    assert res.headers["Cache-Control"] == "private, no-store"
    assert res.headers["X-Content-Type-Options"] == "nosniff"

    # Seeded documents have no file on the server.
    seeded = sql("SELECT id FROM verification_documents WHERE file_url IS NULL LIMIT 1")[0]["id"]
    assert client.get(f"/api/admin/documents/{seeded}", headers=admin_headers).status_code == 404


def test_document_paths_cannot_escape_the_upload_folder(client, admin_headers, sql):
    sql("UPDATE verification_documents SET file_url='../../config.py' WHERE application_id='app_rid_1'")
    doc_id = sql("SELECT id FROM verification_documents WHERE application_id='app_rid_1' LIMIT 1")[0]["id"]
    assert client.get(f"/api/admin/documents/{doc_id}", headers=admin_headers).status_code == 404
