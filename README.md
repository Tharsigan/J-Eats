# J Eats — Japura Eats campus food demo

Campus cafeteria ordering and peer-to-peer delivery for the University of Sri Jayewardenepura.
This is a **fully interactive frontend demo**. There is no backend or database yet: every service in
`lib/api/*` runs against a mock database saved in the browser's `localStorage`, so data survives refreshes.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo accounts

**Fastest:** open `/login` and use the **Quick demo sign-in** buttons (no password). Seeded accounts also accept
**any password with 6+ characters** (`demo123` is pre-filled). Accounts you register in
the demo use the password you chose.

| Role | Login | Email |
| --- | --- | --- |
| Customer (student) | `/login/customer` → Student | `mira.demo@example.edu` |
| Customer (academic) | `/login/customer` → Academic Staff | `anika.staff@sjp.ac.lk` |
| Customer (non-academic) | `/login/customer` → Non-Academic Staff | `ruwan.ops@sjp.ac.lk` |
| Rider | `/login/rider` | `ari@sjp.ac.lk`, `dilan.rider@sjp.ac.lk` |
| Cafeteria | `/login/cafeteria` | `canteen@sjp.ac.lk` (Central Canteen), `cafe@sjp.ac.lk`, `burgerlab@sjp.ac.lk`, `slice@sjp.ac.lk`, `greenbowl@sjp.ac.lk` |
| Admin | `/login/admin` | `admin@jeats.lk` |
| Pending (blocked until approved) | — | `nimal.pending@sjp.ac.lk`, `kasun.rider@sjp.ac.lk`, `lawn.stall@sjp.ac.lk` |

## Suggested demo walkthrough

1. **Customer** — Explore Food → add *Campus Chicken Rice & Curry* → checkout (Delivery, Wallet) → Track Order shows *Placed*.
   Try promo codes `FIRSTBITE` / `CAMPUSCREW`, pre-orders, reschedule and cancel (wallet refund).
2. **Cafeteria** (`canteen@sjp.ac.lk`) — Orders → *Accept* → *Start preparing* → *Mark ready*. A delivery job opens for riders.
   Manage stock, prices, availability and new menu items; broadcast the queue.
3. **Rider** (`ari@sjp.ac.lk`) — Accept the job → Active Delivery → *Picked up* → *Mark delivered*. The payout lands in Earnings.
4. **Customer** — Track shows *Delivered* → *Rate this meal*; the rating updates on the menu.
5. **Register** a new rider/cafeteria/customer → login is blocked → **Admin** approves under *Pending Approvals* → the account can sign in.
   Admin also has Users (suspend/reactivate), Transactions (CSV export), Reports and System Settings (fees, cash cutoff, pause ordering).

Use two browser tabs (e.g. customer + cafeteria) to watch changes appear live. **Admin → System Settings → Reset demo data**
restores the original seed.

## Architecture notes (for the Flask + MySQL integration)

- `lib/api/*` — the only data layer used by the UI. Each function has a mock branch and an `apiFetch(...)` REST call.
  Set `NEXT_PUBLIC_USE_MOCKS=false` and `NEXT_PUBLIC_API_URL` to point the app at the Flask API.
- `lib/mock-db/` — the localStorage-backed mock database (seeded from `lib/mock-data/campus.ts`) plus workflow helpers
  (notifications, ledger, wallet, activity log). Never imported by UI components.
- `lib/hooks/useApi.ts` — fetches through the services and re-fetches whenever demo data changes (in this tab or another);
  against the real API it polls instead.
- No real payments are processed: wallet top-ups and card payments are simulated.
