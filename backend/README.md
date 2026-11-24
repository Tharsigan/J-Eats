# J Eats API (Flask)

This folder is the Python backend. It connects to MySQL / MariaDB and serves:

- **Sign-in** with real password checks and signed, expiring login tokens (JWT)
- **Registration** for customers, riders and cafeterias, with document uploads
- **Admin approvals**: list, approve and reject applications, view documents (admins only)
- Health checks

Orders, menus, wallets and the other dashboards still run on the frontend's
browser mock until they get endpoints here.

```
backend/
├── app.py            # starts Flask, turns on CORS, registers routes
├── config.py         # reads settings from .env
├── db.py             # MySQL connection, query helpers, transaction()
├── auth.py           # password hashing, JWT tokens, @require_role
├── uploads.py        # verification document checks and storage
├── serializers.py    # database rows -> the JSON shapes the frontend uses
├── routes/
│   ├── __init__.py   # registers every route group under /api
│   ├── health.py     # GET /api/health and GET /api/health/db
│   ├── auth.py       # /api/auth/login, /register, /me, /logout
│   └── admin.py      # /api/admin/approvals, /api/admin/documents/<id>
├── tests/            # pytest, runs against a throwaway database
├── uploads/          # uploaded documents (created automatically, gitignored)
├── requirements.txt  # Python packages
└── .env.example      # copy to .env and fill in
```

## 1. Start MySQL in XAMPP and load the database

1. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**
   (Apache too, if you want phpMyAdmin).
2. Open http://localhost/phpmyadmin
3. Click the **Import** tab, choose `database/schema.sql`, click **Import**.
   This creates the `j_eats` database with 20 tables.
4. Click the new **j_eats** database on the left, then **Import** again and choose
   `database/seed.sql`. This adds the demo data.

## 2. Install Python packages (first time only)

You need Python 3.10 or newer. In a terminal, from the project folder:

```bash
cd backend
python -m venv .venv
```

Turn on the virtual environment:

- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- Windows (cmd): `.venv\Scripts\activate.bat`
- Mac / Linux: `source .venv/bin/activate`

Then install:

```bash
pip install -r requirements.txt
```

## 3. Create your .env

Copy `.env.example` to a new file called `.env` in this folder.

- Windows: `copy .env.example .env`
- Mac / Linux: `cp .env.example .env`

XAMPP's MySQL uses user `root` with **no password** by default, so the example
values usually work as they are. If you set a MySQL password, put it in
`DB_PASSWORD`. If MariaDB runs on another port (for example 3307), set `DB_PORT`.
`.env` is ignored by git, so it never gets pushed.

Set `JWT_SECRET` to a long random string. Generate one with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## 4. Run the API

```bash
python app.py
```

Then open these in your browser:

| URL | What you should see |
| --- | --- |
| http://localhost:5000/api/health | `{"status": "ok", ...}` - Flask is running |
| http://localhost:5000/api/health/db | `"status": "ok"`, `"table_count": 20`, and row counts like `"users": 14` - MySQL is connected |

If `/api/health/db` shows `"status": "error"`, read the `message`:

- **Can't connect to MySQL server** - MySQL isn't started in XAMPP, or `DB_PORT` is wrong.
- **Access denied for user 'root'** - `DB_PASSWORD` in `.env` doesn't match.
- **Unknown database 'j_eats'** - you haven't imported `database/schema.sql` yet.

## Connecting the Next.js frontend

The frontend calls `NEXT_PUBLIC_API_URL`, which is already
`http://localhost:5000/api` in the root `.env.example`. CORS here allows
`http://localhost:3000` (set in `FRONTEND_ORIGINS`).

To run the whole app on MariaDB, create `.env.local` in the project root with:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_USE_MOCKS=false
```

To switch only some features, keep `NEXT_PUBLIC_USE_MOCKS=true` and list them,
for example `NEXT_PUBLIC_LIVE_FEATURES=auth,registration,approvals,users,menu,cafeteria,wallet,orders,courier,notifications,admin`. Pages that aren't listed keep
the browser mock data, so a mix can show different numbers on different pages.

If your `j_eats` database was created before these changes, run
`database/migrations/001_menu_tags_featured_rider_online.sql` once (back up
first; it only adds 3 columns), then restart Flask.

Restart `npm run dev` after changing it. Sign in with the seeded accounts and
their real password, `demo123` (the quick demo buttons do this for you).

## Endpoints

| Method | Path | Who | What |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | `{role, identifier, password, customerSubRole?}` -> `{user, token}` |
| POST | `/api/auth/register` | anyone | multipart form from the registration pages -> `{status: "pending"}` |
| GET / PATCH | `/api/auth/me` | signed in | read / update name and phone |
| POST | `/api/auth/logout` | anyone | the browser forgets its token |
| GET | `/api/admin/approvals` | admin | every application, pending first |
| POST | `/api/admin/approvals/<id>` | admin | `{status: "approved" \| "rejected"}`; pending applications only |
| GET | `/api/admin/documents/<id>` | admin | an uploaded verification document |
| GET | `/api/menu`, `/api/menu/<id or slug>`, `/api/menu/<id>/related` | anyone | menu items |
| GET / POST | `/api/menu/<id>/reviews`, GET `/api/reviews` | anyone / customer | reviews (posting updates the item's rating) |
| GET | `/api/vendors`, `/api/vendors/<id>` | anyone | cafeterias and their queue length |
| GET | `/api/slots?date=yyyy-mm-dd` | anyone | pickup / delivery slots (6 orders per slot) |
| GET / POST | `/api/favourites`, `/api/favourites/<item_id>` | signed in | list / toggle favourites |
| GET | `/api/admin/users` | admin | every account (never password hashes) |
| POST | `/api/admin/users/<id>/status` | admin | `{status: "active" \| "suspended"}`; admins can't be suspended |
| POST | `/api/auth/forgot-password` | anyone | `{email}`; confirms the account exists (no email is sent) |
| GET / PATCH / POST / DELETE | `/api/cafeteria/vendor`, `/menu`, `/inventory/<id>`, `/queue` | cafeteria | my kitchen, menu items, stock, photos and queue |
| GET | `/api/media/menu/<file>` | anyone | uploaded food photos |
| GET | `/api/wallet`, POST `/api/wallet/topup` | signed in | wallet and simulated top-ups (Rs. 100 to 50,000) |
| GET / POST | `/api/stalls`, `/api/stalls/<id>/support` | anyone / customer | fundraising stalls, paid from the wallet |
| POST | `/api/promos/check` | customer | preview FIRSTBITE / CAMPUSCREW |
| POST | `/api/orders` | customer | place an order (one per vendor); prices and stock come from the database |
| GET | `/api/orders/mine`, `/api/orders/latest`, `/api/orders/<id>` | customer (or its kitchen, rider, admin) | orders and tracking |
| POST | `/api/orders/<id>/cancel`, `/reschedule`; GET `/receipt` | customer | cancel (refund + restock), new slot, receipt text |
| GET / POST | `/api/cafeteria/orders`, `/orders/<id>/status`, `/orders/<id>/reject`, GET `/cafeteria/stats` | cafeteria | kitchen tickets; "ready" on a delivery order opens a rider job |
| GET / POST | `/api/courier/jobs`, `/jobs/active`, `/jobs/<id>/accept \| decline \| pickup \| complete` | rider | delivery jobs; completing pays the rider's wallet |
| GET / POST | `/api/courier/status`, `/courier/stats`, `/courier/withdraw` | rider | Online switch, earnings, simulated withdrawal |
| GET / POST | `/api/notifications`, `/notifications/<id>/read`, `/notifications/read-all` | signed in | my notifications and role broadcasts |
| GET | `/api/admin/ledger`, `/admin/logs`, `/admin/stats`, `/admin/analytics/peak`, `/admin/orders` | admin | dashboards |
| GET / PUT | `/api/admin/settings` | signed in / admin | platform settings (fees, cash cutoff, ordering on/off) |
| POST | `/api/admin/reset` | admin | always refused: the demo reset never touches MariaDB |

Send the token as `Authorization: Bearer <token>`. Tokens expire after
`JWT_EXPIRES_MINUTES`. Every request re-reads the user from the database, so
suspending or rejecting an account takes effect immediately.

Approving an application updates `verification_applications` and the matching
`users` row in one transaction. It also creates an empty `wallets` row for
customers and riders, and a `vendors` row for a cafeteria that doesn't have one,
the same as the demo did.

## Tests

The tests build a throwaway database called `j_eats_test` from
`database/schema.sql` and `seed.sql`, and drop it afterwards. They never touch
`j_eats`.

```bash
pip install -r requirements.txt -r requirements-dev.txt
TEST_DB_PORT=3307 TEST_DB_USER=root TEST_DB_PASSWORD= pytest
```

(On Windows PowerShell: `$env:TEST_DB_PORT=3307; pytest`.)

## Writing queries

```python
from db import query, query_one, execute, transaction

items = query("SELECT * FROM menu_items WHERE vendor_id = %s", (vendor_id,))
user = query_one("SELECT * FROM users WHERE email = %s", (email,))

# Several writes that must all succeed or all fail:
with transaction() as tx:
    tx.execute("UPDATE ...", (...))
    tx.execute("INSERT ...", (...))
```

Always use `%s` placeholders for values, never f-strings. That keeps the app
safe from SQL injection.
