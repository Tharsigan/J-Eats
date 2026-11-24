from conftest import login


def test_only_admins_can_list_or_change_users(client, customer_headers):
    assert client.get("/api/admin/users").status_code == 401
    assert client.get("/api/admin/users", headers=customer_headers).status_code == 403
    res = client.post("/api/admin/users/u_cou/status", json={"status": "suspended"}, headers=customer_headers)
    assert res.status_code == 403


def test_list_users_comes_from_the_database(client, admin_headers, sql):
    res = client.get("/api/admin/users", headers=admin_headers)
    assert res.status_code == 200
    users = {u["id"]: u for u in res.get_json()}
    assert len(users) == sql("SELECT COUNT(*) n FROM users")[0]["n"]
    assert users["u_cus"]["email"] == "mira.demo@example.edu"
    assert users["u_cus"]["customerSubRole"] == "student"
    assert users["u_cou_pending"]["verificationStatus"] == "pending"
    assert users["u_caf"]["vendorId"] == "v_cc"
    assert all("password" not in k.lower() for u in users.values() for k in u)


def test_suspend_and_reactivate_update_mariadb(client, admin_headers, sql):
    res = client.post("/api/admin/users/u_cou/status", json={"status": "suspended"}, headers=admin_headers)
    assert res.status_code == 200 and res.get_json()["status"] == "suspended"
    assert sql("SELECT status FROM users WHERE id='u_cou'") == [{"status": "suspended"}]
    assert sql("SELECT level FROM system_logs WHERE message LIKE 'Admin suspended Ari Perera%%'") == [{"level": "warn"}]
    assert login(client, "courier", "ari@sjp.ac.lk").status_code == 403

    res = client.post("/api/admin/users/u_cou/status", json={"status": "active"}, headers=admin_headers)
    assert res.status_code == 200 and res.get_json()["status"] == "active"
    assert sql("SELECT status FROM users WHERE id='u_cou'") == [{"status": "active"}]
    assert login(client, "courier", "ari@sjp.ac.lk").status_code == 200
    # Only the target account changed.
    assert sql("SELECT COUNT(*) n FROM users WHERE status='suspended'")[0]["n"] == 0


def test_suspended_user_loses_access_with_an_existing_token(client, admin_headers, customer_headers):
    client.post("/api/admin/users/u_cus/status", json={"status": "suspended"}, headers=admin_headers)
    assert client.get("/api/auth/me", headers=customer_headers).status_code == 403


def test_admins_cannot_be_suspended_and_bad_input_is_refused(client, admin_headers, sql):
    res = client.post("/api/admin/users/u_adm/status", json={"status": "suspended"}, headers=admin_headers)
    assert res.status_code == 403
    assert sql("SELECT status FROM users WHERE id='u_adm'") == [{"status": "active"}]
    assert client.post("/api/admin/users/u_cou/status", json={"status": "deleted"}, headers=admin_headers).status_code == 400
    assert client.post("/api/admin/users/nope/status", json={"status": "suspended"}, headers=admin_headers).status_code == 404


def test_repeating_the_same_status_is_harmless(client, admin_headers, sql):
    for _ in range(2):
        assert client.post("/api/admin/users/u_cou/status", json={"status": "suspended"}, headers=admin_headers).status_code == 200
    assert sql("SELECT COUNT(*) n FROM system_logs WHERE message LIKE 'Admin suspended Ari%%'")[0]["n"] == 1
