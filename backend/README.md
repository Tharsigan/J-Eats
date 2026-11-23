# J Eats API (Flask) - Phase 1

This folder is the Python backend. Right now it only **starts Flask, connects to
MySQL, and has a health check**. Login, orders and payments come in Phase 2.

```
backend/
├── app.py            # starts Flask, turns on CORS, registers routes
├── config.py         # reads settings from .env
├── db.py             # MySQL connection + query helpers
├── routes/
│   ├── __init__.py   # registers every route group under /api
│   └── health.py     # GET /api/health and GET /api/health/db
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
`DB_PASSWORD`. `.env` is ignored by git, so it never gets pushed.

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
`http://localhost:3000` (set in `FRONTEND_ORIGINS`). Keep
`NEXT_PUBLIC_USE_MOCKS=true` until Phase 2 adds the real routes.

## Writing queries (for Phase 2)

```python
from db import query, query_one, execute

items = query("SELECT * FROM menu_items WHERE vendor_id = %s", (vendor_id,))
user = query_one("SELECT * FROM users WHERE email = %s", (email,))
```

Always use `%s` placeholders for values, never f-strings. That keeps the app
safe from SQL injection.
