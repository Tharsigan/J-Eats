# J Eats database (MySQL)

| File | Purpose |
| --- | --- |
| `schema.sql` | Creates the `j_eats` database and all 20 tables (drops and recreates them if they exist) |
| `seed.sql` | Demo data matching the frontend mock data: vendors, menu, users, applications, sample orders, wallets, ledger, reviews, stalls, settings |

## Load it

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p j_eats < database/seed.sql
```

Works on MySQL 8.0+ and MariaDB 10.5+.

## Demo logins

Every seeded account uses the password **`demo123`**. Hashes are Werkzeug PBKDF2, so Flask can check them with:

```python
from werkzeug.security import check_password_hash, generate_password_hash

check_password_hash(user["password_hash"], password)   # login
generate_password_hash(password)                         # registration
```

Emails are the same as the frontend demo, e.g. `mira.demo@example.edu` (customer),
`canteen@sjp.ac.lk` (cafeteria), `ari@sjp.ac.lk` (rider), `admin@jeats.lk` (admin).

## Tables

| Group | Tables |
| --- | --- |
| Accounts | `users`, `verification_applications`, `verification_documents` |
| Menu | `vendors`, `menu_items` |
| Orders | `orders`, `order_lines`, `order_status_history` |
| Delivery | `courier_jobs`, `job_declines` |
| Money | `wallets`, `wallet_transactions`, `ledger_entries` |
| Feedback | `reviews`, `favourites` |
| Notifications & logs | `notifications`, `notification_reads`, `system_logs` |
| Other | `stalls`, `platform_settings` (single row, `id = 1`) |

## Notes for the Flask API

- Column names are `snake_case`; the frontend (`lib/types.ts`) uses `camelCase`
  (e.g. `customer_id` → `customerId`, `prep_min`/`prep_max` → `prepMinutes: [min, max]`).
- `notifications`: set `user_id` for one person, or leave it `NULL` and set `role` to broadcast
  to everyone in that role. `notification_reads` records who has read a broadcast.
- `reviews.author_name` stores the display name shown on the review (e.g. "Nethmi P.").
- Store prices and totals as `DECIMAL(10,2)`; `order_lines.unit_price` keeps the price at the time of ordering.
- Placing an order should run in one transaction: insert order + lines, decrement `menu_items.stock`,
  debit the wallet, and add a `ledger_entries` row.
