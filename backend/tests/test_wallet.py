from conftest import login


def test_wallet_comes_from_the_database(client, customer_headers):
    assert client.get("/api/wallet").status_code == 401
    w = client.get("/api/wallet", headers=customer_headers).get_json()
    assert w["userId"] == "u_cus" and w["balance"] == 2500
    assert [t["id"] for t in w["txns"]] == ["w1", "w2"]
    assert w["txns"][0] == {"id": "w1", "label": "Top-up · Dialog", "amount": 2000, "type": "credit", "at": "2026-11-16T09:12:00.000Z",
                            "kind": "topup", "ref": "TOP-441", "createdAt": "2026-11-16T09:12:00.000Z"}


def test_top_up_credits_wallet_ledger_and_notifies(client, customer_headers, sql):
    res = client.post("/api/wallet/topup", json={"amount": 500, "method": "Card"}, headers=customer_headers)
    assert res.status_code == 200
    body = res.get_json()
    assert body["ok"] is True and body["amount"] == 500 and body["balance"] == 3000 and body["ref"].startswith("TU-")
    assert float(sql("SELECT balance FROM wallets WHERE user_id='u_cus'")[0]["balance"]) == 3000
    assert sql("SELECT label, kind, type FROM wallet_transactions WHERE ref=%s", (body["ref"],)) == [
        {"label": "Top-up · Card", "kind": "topup", "type": "credit"}]
    assert sql("SELECT party, type FROM ledger_entries WHERE ref=%s", (body["ref"],)) == [{"party": "Mira Sen", "type": "topup"}]
    assert sql("SELECT COUNT(*) n FROM notifications WHERE user_id='u_cus' AND title='Wallet topped up'")[0]["n"] == 1


def test_top_up_limits(client, customer_headers):
    for amount in (50, 60000, "abc", None):
        assert client.post("/api/wallet/topup", json={"amount": amount}, headers=customer_headers).status_code == 400


def test_new_user_without_a_wallet_starts_at_zero(client, sql):
    h = {"Authorization": "Bearer " + login(client, "cafeteria", "canteen@sjp.ac.lk").get_json()["token"]}
    assert client.get("/api/wallet", headers=h).get_json() == {"userId": "u_caf", "balance": 0, "txns": []}


def test_stalls_and_support(client, customer_headers, sql):
    stalls = {s["id"]: s for s in client.get("/api/stalls").get_json()}
    assert stalls["st1"]["raised"] == 42000 and stalls["st1"]["goal"] == 80000
    res = client.post("/api/stalls/st1/support", json={"amount": 200}, headers=customer_headers)
    assert res.status_code == 200 and res.get_json()["raised"] == 42200
    assert float(sql("SELECT balance FROM wallets WHERE user_id='u_cus'")[0]["balance"]) == 2300
    assert sql("SELECT kind, type, ref FROM wallet_transactions WHERE user_id='u_cus' AND kind='donation'") == [
        {"kind": "donation", "type": "debit", "ref": "st1"}]
    assert sql("SELECT type FROM ledger_entries WHERE ref='ST1'") == [{"type": "donation"}]


def test_support_rules_and_insufficient_funds_rolls_back(client, customer_headers, sql):
    assert client.post("/api/stalls/st1/support", json={"amount": 10}, headers=customer_headers).status_code == 400
    assert client.post("/api/stalls/nope/support", json={"amount": 100}, headers=customer_headers).status_code == 404
    res = client.post("/api/stalls/st1/support", json={"amount": 9999}, headers=customer_headers)
    assert res.status_code == 402
    assert float(sql("SELECT raised FROM stalls WHERE id='st1'")[0]["raised"]) == 42000
    assert float(sql("SELECT balance FROM wallets WHERE user_id='u_cus'")[0]["balance"]) == 2500
    assert sql("SELECT COUNT(*) n FROM wallet_transactions WHERE user_id='u_cus'")[0]["n"] == 2
