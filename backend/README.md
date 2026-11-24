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

To use this API for sign-in, registration and approvals while the rest of the
app keeps its mock data, create `.env.local` in the project root with:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_LIVE_FEATURES=auth,registration,approvals
```

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
