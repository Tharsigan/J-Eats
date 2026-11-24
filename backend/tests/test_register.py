import io
from pathlib import Path

from conftest import PDF, PNG, login


def rider_form(**over):
    form = {
        "role": "courier",
        "name": "Test Rider",
        "email": "test.rider@sjp.ac.lk",
        "password": "rider-pass-1",
        "idNumber": "200012345678",
        "extra": "bicycle",
        "verificationDoc": (io.BytesIO(PNG), "nic.png"),
        "verificationDocKind": "NIC / Student ID",
        "verificationDoc2": (io.BytesIO(PDF), "licence.pdf"),
        "verificationDocKind2": "Driving License / Vehicle Proof",
    }
    form.update(over)
    return form


def post(client, form):
    return client.post("/api/auth/register", data=form, content_type="multipart/form-data")


def test_rider_registration_is_stored_in_the_database(client, sql, app):
    res = post(client, rider_form())
    assert res.status_code == 201 and res.get_json() == {"status": "pending"}

    [user] = sql("SELECT * FROM users WHERE email='test.rider@sjp.ac.lk'")
    assert user["role"] == "courier" and user["verification_status"] == "pending"
    assert user["id_number"] == "200012345678"
    assert user["password_hash"] != "rider-pass-1" and user["password_hash"].startswith(("scrypt:", "pbkdf2:"))
    [application] = sql("SELECT * FROM verification_applications WHERE user_id=%s", (user["id"],))
    assert application["verification_status"] == "pending" and application["extra"] == "bicycle"
    docs = sql("SELECT * FROM verification_documents WHERE application_id=%s ORDER BY id", (application["id"],))
    assert [d["kind"] for d in docs] == ["NIC / Student ID", "Driving License / Vehicle Proof"]
    assert [d["name"] for d in docs] == ["nic.png", "licence.pdf"]
    root = Path(app.config["UPLOAD_FOLDER"])
    assert (root / docs[0]["file_url"]).read_bytes() == PNG
    assert (root / docs[1]["file_url"]).read_bytes() == PDF
    assert sql("SELECT COUNT(*) n FROM notifications WHERE role='admin' AND title='New rider application'")[0]["n"] == 1

    # Still blocked until an admin approves.
    assert login(client, "courier", "test.rider@sjp.ac.lk", "rider-pass-1").status_code == 403


def test_customer_and_cafeteria_registration(client, sql):
    res = post(client, {
        "role": "customer", "name": "New Student", "email": "new.student@sjp.ac.lk", "password": "secret12",
        "idNumber": "SJP-2026-001", "customerSubRole": "student",
        "verificationDoc": (io.BytesIO(PDF), "id.pdf"), "verificationDocKind": "Student ID Card / Record Book",
    })
    assert res.status_code == 201
    assert sql("SELECT customer_sub_role FROM users WHERE email='new.student@sjp.ac.lk'") == [{"customer_sub_role": "student"}]

    res = post(client, {
        "role": "cafeteria", "name": "Test Kiosk", "email": "kiosk@sjp.ac.lk", "password": "secret12",
        "extra": "Owner: A. Owner",
        "verificationDoc": (io.BytesIO(PDF), "tender.pdf"), "verificationDocKind": "Tender",
        "verificationDoc2": (io.BytesIO(PDF), "food.pdf"), "verificationDocKind2": "Food handling",
    })
    assert res.status_code == 201
    assert sql("SELECT role, id_number FROM users WHERE email='kiosk@sjp.ac.lk'") == [{"role": "cafeteria", "id_number": None}]


def test_duplicate_email_or_id_is_refused(client, sql):
    assert post(client, rider_form()).status_code == 201
    assert post(client, rider_form(idNumber="other-id")).status_code == 409
    assert post(client, rider_form(email="someone.else@sjp.ac.lk")).status_code == 409
    assert post(client, rider_form(email="ARI@sjp.ac.lk", idNumber="x1")).status_code == 409  # seeded, case-insensitive
    assert sql("SELECT COUNT(*) n FROM users WHERE email='test.rider@sjp.ac.lk'")[0]["n"] == 1


def test_bad_documents_are_refused_and_nothing_is_saved(client, sql, app):
    before = sql("SELECT COUNT(*) n FROM users")[0]["n"]
    fake = rider_form(verificationDoc=(io.BytesIO(b"<script>alert(1)</script>"), "nic.png"))
    assert post(client, fake).status_code == 400
    renamed = rider_form(verificationDoc=(io.BytesIO(PDF), "nic.png"))  # PDF pretending to be a PNG
    assert post(client, renamed).status_code == 400
    exe = rider_form(verificationDoc=(io.BytesIO(b"MZ\x90\x00"), "nic.exe"))
    assert post(client, exe).status_code == 400
    missing = rider_form()
    missing.pop("verificationDoc2")
    assert post(client, missing).status_code == 400
    big = rider_form(verificationDoc=(io.BytesIO(PNG + b"\x00" * (5 * 1024 * 1024)), "nic.png"))
    assert post(client, big).status_code == 400
    assert sql("SELECT COUNT(*) n FROM users")[0]["n"] == before
    folder = Path(app.config["UPLOAD_FOLDER"]) / "verification"
    assert not folder.exists() or not any(folder.iterdir())


def test_validation_errors(client):
    assert post(client, rider_form(email="not-an-email")).status_code == 400
    assert post(client, rider_form(password="12345")).status_code == 400
    assert post(client, rider_form(role="admin")).status_code == 400
    assert post(client, rider_form(idNumber="")).status_code == 400


def test_failed_insert_leaves_no_partial_rows_or_files(client, sql, app, monkeypatch):
    import db

    real = db.Tx.executemany

    def boom(self, statement, rows):
        raise RuntimeError("simulated failure while saving documents")

    monkeypatch.setattr(db.Tx, "executemany", boom)
    app.config["PROPAGATE_EXCEPTIONS"] = False
    assert post(client, rider_form()).status_code == 500
    monkeypatch.setattr(db.Tx, "executemany", real)

    assert sql("SELECT COUNT(*) n FROM users WHERE email='test.rider@sjp.ac.lk'")[0]["n"] == 0
    assert sql("SELECT COUNT(*) n FROM verification_applications WHERE submitted_at > '2026-11-17'")[0]["n"] == 0
    folder = Path(app.config["UPLOAD_FOLDER"]) / "verification"
    assert not any(folder.iterdir())


def test_rejected_applicant_can_reapply_and_keeps_the_same_row(client, sql, admin_headers):
    assert post(client, rider_form()).status_code == 201
    [user] = sql("SELECT id FROM users WHERE email='test.rider@sjp.ac.lk'")
    [first] = sql("SELECT id FROM verification_applications WHERE user_id=%s", (user["id"],))
    client.post(f"/api/admin/approvals/{first['id']}", json={"status": "rejected"}, headers=admin_headers)

    assert post(client, rider_form(password="new-pass-2")).status_code == 201
    rows = sql("SELECT id, verification_status FROM users WHERE email='test.rider@sjp.ac.lk'")
    assert rows == [{"id": user["id"], "verification_status": "pending"}]
    apps = sql("SELECT verification_status FROM verification_applications WHERE user_id=%s ORDER BY submitted_at, id", (user["id"],))
    assert sorted(a["verification_status"] for a in apps) == ["pending", "rejected"]
