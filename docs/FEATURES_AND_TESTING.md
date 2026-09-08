# RestKit — Features, Routes & Testing Guide

> Generated from the actual codebase on 2026-07-12. This document lists every feature, every route, the automated test suite, and a step-by-step manual QA plan for the flows automation can't cover (printing, wallet passes, real devices).

---

## 1. Running the App & Tests

```bash
npm install
npm run dev        # Next.js dev server on http://localhost:3000
npm run build      # production build (also a good type/lint smoke test)
npm run lint       # eslint
npm test           # unit + integration tests (Vitest, ~5s)
npm run test:watch # watch mode while developing
npm run test:e2e   # browser UX tests (Playwright, ~25s, self-contained)
npm run test:e2e:ui # Playwright UI mode for debugging
```

### Automated test suite (`tests/`)

Vitest + **mongodb-memory-server** (real MongoDB semantics — indexes, aggregations — no external DB needed). The better-auth session and `next/headers` are mocked in `tests/setup.ts`, so **API route handlers run unmodified** and tests choose the acting user/role per call.

| Suite | Covers |
|---|---|
| `tests/unit/waiter-token.test.ts` | PIN scrypt hashing, HMAC token sign/verify, 90s expiry, tampering, cross-tenant rejection |
| `tests/unit/receipt-html.test.ts` | IVA breakdown math, pre-bill (cuenta), CASH change lines, fiscal header, 80mm format |
| `tests/unit/waiter-session.test.ts` | Client rolling 90s window in sessionStorage, header attach, token refresh (jsdom) |
| `tests/integration/inventory-service.test.ts` | adjustStock movements, negative stock, recipe deduction merging |
| `tests/integration/inventory-api.test.ts` | Inventory CRUD, RBAC, quantity-only-via-movements, RESTOCK/WASTE sign forcing |
| `tests/integration/orders-api.test.ts` | Order create/dedupe, waiter attribution + token refresh, kitchenAt stamping, PAID flow (ticket #, change, table freed, idempotent inventory deduction) |
| `tests/integration/orders-move-api.test.ts` | Table transfer: success, 409 occupied, cross-tenant 404, no-op |
| `tests/integration/kitchen-api.test.ts` | KDS FIFO feed, line/ticket bump, READY flip, un-bump |
| `tests/integration/pos-session-api.test.ts` | Register open/close, one-session rule, cash cut math, variance notes |
| `tests/integration/verify-pin-api.test.ts` | PIN exchange, wrong/cross-tenant PIN, throttle lockout + reset |
| `tests/integration/tables-api.test.ts` | Tables CRUD + RBAC, activeOrder aggregation, occupancy toggle |
| `tests/integration/staff-pin-api.test.ts` | OWNER-only PIN set, format validation, staff removal cascade |
| `tests/unit/plans.test.ts` | Plan catalog: annual discount math, plan id narrowing, MXN formatting, period parsing, tier gating (`planAllows`) |
| `tests/unit/subscription.test.ts` | `evaluateSubscription` gate logic: grandfathered/trialing/expired/active/past_due/canceled branches |
| `tests/integration/billing-service.test.ts` | Webhook event application: activate/past_due/cancel, tenant match by metadata or customer id, unknown-tenant no-op, ignores unrelated events |
| `tests/integration/billing-checkout-api.test.ts` | Checkout route (mocked Stripe): OWNER-only, invalid plan 400, missing price 500, customer create/reuse, returns url |
| `tests/integration/subscription-gate.test.ts` | Opening the POS register: 402 when trial expired / past_due, allowed while trialing / active / grandfathered |
| `tests/integration/feature-gate-api.test.ts` | Tier matrix across every gated handler (inventory, KDS, POS register): Lite blocked on everything including POS, Básico blocked on inventory/KDS/reports but keeps POS, Profesional gets everything, trial/grandfathered always full access |

Helpers: `tests/helpers/auth-state.ts` (choose the acting user), `tests/helpers/db.ts` (in-memory Mongo wired into `lib/db.ts`'s cache), `tests/helpers/fixtures.ts` (request builders, raw better-auth user docs with string `businessId`).

### End-to-end UX suite (`e2e/`, Playwright)

Real Chromium driving the real app. Fully self-contained: `e2e/server.mjs` boots an **in-memory MongoDB** and `next dev` on port 3100 per run — no external services, no leftover state. `e2e/global.setup.ts` registers the owner through the real `/registro` flow, seeds demo data via `/api/restaurants/seed-current`, and saves the session (`e2e/.auth/owner.json`) for authenticated specs. Runs with 1 worker (shared DB, one register per business).

| Spec | User journey |
|---|---|
| `e2e/auth.spec.ts` | Wrong password shows an error and stays on /login; correct login lands on the dashboard; unauthenticated visits redirect to /login |
| `e2e/dashboard.spec.ts` | Sidebar reaches all 8 sections; no `/dashboard/pos` links exist; seeded menu is visible |
| `e2e/menu.spec.ts` | Create a product through the form → appears in its category with its price |
| `e2e/inventory.spec.ts` | Create an item → restock +10 through the adjust-stock modal → quantity updates |
| `e2e/pos.spec.ts` | **The full shift**: terminal login → open register ($500) → occupy/free a table manually → take an order as manager (PIN escape hatch) → send to kitchen → bump on the KDS → charge $85 cash with live change calc → table freed, sales rollup updates → close register with a balanced $585 cash cut. Plus: `/pos/dashboard` without the terminal marker redirects to the POS login |
| `e2e/tables.spec.ts` | **Fresh-database path**: registers its own owner (no seed data) → `/pos/dashboard` shows the empty state → adds a table from `/dashboard/tables` → duplicate table number 409s cleanly in the UI → the new table is immediately usable from the POS. Uses a separate owner (`FRESH_OWNER` in `e2e/helpers.ts`) so it starts from zero, independent of the shared seeded session |
| `e2e/pricing.spec.ts` | Landing pricing: monthly/annual toggle recomputes prices ($599 → $479), plan CTA carries `?plan=&period=` into `/registro` (which shows the chosen plan) — all 3 plans (Lite/Básico/Profesional) are self-serve, including Lite |

Print dialogs are stubbed (`window.print`) since receipts print into a hidden iframe.

The **manual test plans in section 6 remain relevant** for what automation doesn't reach: thermal printing hardware, wallet passes on real devices, and visual polish.

### Required environment variables (`.env.local`)

| Variable | Needed for | Notes |
|---|---|---|
| `MONGODB_URI` | Everything | MongoDB connection string |
| `BETTER_AUTH_SECRET` | Auth | Session signing |
| `POS_TOKEN_SECRET` | POS waiter PIN | HMAC secret for 90s waiter tokens (`lib/waiter-token.ts`) |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Auth client, wallet links | `http://localhost:3000` locally |
| `APPLE_PASS_TYPE_IDENTIFIER`, `APPLE_TEAM_ID`, `APPLE_SIGNER_CERT_BASE`, `APPLE_SIGNER_KEY_BASE`, `APPLE_SIGNER_KEY_PASSPHRASE`, `APPLE_WWDR_CERT_BASE`, `APPLE_PASS_ENV` | Apple Wallet only | Can be omitted if not testing passes |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Google Wallet only | Can be omitted if not testing passes |

The app works for POS/dashboard testing with just the first four; wallet features fail gracefully without their vars.

### Fastest way to get test data

1. Register at `/registro` (creates OWNER + Business).
2. Log in, then `POST /api/restaurants/seed-current` (or use the seed button in the dashboard) — creates 5 staff, tables, products, and customers for the current business. Refuses to run if the business already has tables.

---

## 2. Roles & Auth Model (what to test against)

| Role | Dashboard | POS |
|---|---|---|
| OWNER | Everything (incl. Staff page) | Can open terminal, open/close register |
| ADMIN | Everything except Staff page | Can open terminal, open/close register |
| STAFF | **No access** (redirected) | Acts via waiter PIN on an open terminal |

Two auth layers:

1. **Terminal session (the security boundary)** — better-auth httpOnly cookie. Every POS API derives `businessId` from it via `getBusinessContext()` (`lib/pos-auth.ts`). Client storage is display-only.
2. **Waiter PIN** — `POST /api/pos/waiter/verify-pin` exchanges a 4–6 digit PIN for a **90-second rolling HMAC token** sent as `x-waiter-token` on order mutations. The server refreshes the token in the response header on each use.

⚠️ Known debt: `user.businessId` is a **string**; domain collections use **ObjectId**. User lookups match both (`$in`).

---

## 3. Page Routes

### Public
| Route | What it is |
|---|---|
| `/` | Landing page |
| `/login` | better-auth email+password login |
| `/registro` | Sign-up: creates user + Business (owner flow) |
| `/c/[customerId]` | Public customer loyalty card (progress bar + Apple/Google Wallet buttons). No auth — anyone with the link sees it. |

### Dashboard (OWNER/ADMIN; STAFF redirected)
| Route | What it is |
|---|---|
| `/dashboard` | Analytics home: stats, 7-day revenue chart, top customers, recent activity |
| `/dashboard/menu` | Products by category: add/edit/delete/toggle availability, **recipe editor** (links product → inventory items) |
| `/dashboard/tables` | **NEW** — Table management by section: add/edit/soft-delete. The only UI path to create tables; a fresh business has none until a manager adds them here (see §6.2a) |
| `/dashboard/inventory` | Inventory items: stock, low-stock alerts, restock/waste/adjust with movement history |
| `/dashboard/orders` | Order history: period + status filters, revenue strip, reprint receipts |
| `/dashboard/reports` | "Ventas por mesero" — revenue split by `items[].addedBy` per period |
| `/dashboard/customers` | Loyalty customers grid + `/new` + `/[id]` detail (QR, wallet buttons, visit history) |
| `/dashboard/loyalty` | Loyalty config + top-customers leaderboard |
| `/dashboard/staff` | **OWNER only** — staff list, invite, set POS PIN, remove |
| `/dashboard/billing` | **OWNER only** — subscription status (trial countdown / active / past_due), plan chooser (monthly/annual) → Stripe Checkout, "Administrar facturación" → Stripe Billing Portal. Always reachable even when the gate is active (so an expired business can pay) |
| `/dashboard/settings` | Business info, ticket (fiscal) data with receipt preview, loyalty settings |

### POS (`/pos` — the old `/dashboard/pos/*` tree is deleted; do not test/recreate it)
| Route | What it is |
|---|---|
| `/pos` | Terminal login — a manager signs in with better-auth to open the terminal |
| `/pos/dashboard` | Table grid (Todas/Ocupadas/Libres chips; amber = active order, rose = manually occupied, emerald = free) + register open/close |
| `/pos/order/[tableId]` | Waiter PIN modal → `OrderBuilder` (cart, kitchen rounds, payment) |
| `/pos/kitchen` | Kitchen Display System — live `IN_KITCHEN` tickets, per-line and whole-ticket bump |

---

## 4. API Routes

All routes require the better-auth session cookie unless noted. "Manager" = OWNER or ADMIN.

### Auth & business
| Method + path | Auth | Purpose |
|---|---|---|
| `POST/GET /api/auth/[...all]` | — | better-auth handler (sign-in/up/out, session) |
| `POST /api/business` | none ⚠️ | Register business + owner (used by sign-up flow). Accepts optional `plan`/`billingPeriod` (from the pricing page) and starts a 14-day `trialing` subscription |

### Billing (Stripe subscriptions)
| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/billing/checkout` | OWNER | Create/reuse the business's Stripe customer, start a subscription Checkout session for `{ plan, period }`, return `{ url }`. 400 invalid plan, 500 if the `STRIPE_PRICE_*` env for that plan/period is missing |
| `POST /api/billing/portal` | OWNER | Stripe Billing Portal session (update card / change plan / cancel) → `{ url }` |
| `POST /api/stripe/webhook` | Stripe signature | Raw-body, `STRIPE_WEBHOOK_SECRET`-verified. Applies `customer.subscription.created/updated/deleted` to `Business.subscription` (status, plan, period, `currentPeriodEnd`). Idempotent |

### Tables
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/tables` | session | Active tables + open orders |
| `POST /api/tables` | manager | Create table (`number`, `name`, `capacity`, `section`). 409 on a duplicate `number` within the business (unique `{businessId, number}` index) — never a raw 500 |
| `GET/PATCH /api/tables/[tableId]` | manager | Fetch/update table. PATCH 409s the same way on a number collision |
| `DELETE /api/tables/[tableId]` | manager | Soft delete (`isActive: false`) |

### Products
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/products` | session | All products (active + inactive) |
| `POST /api/products` | manager | Create (accepts optional `recipe[]`) |
| `PATCH /api/products/[productId]` | manager | Update (incl. `isAvailable`, `recipe`) |
| `DELETE /api/products/[productId]` | manager | Hard delete |

### Orders
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/orders?tableId=` | session | Active order for a table |
| `POST /api/orders` | session | Create or return active order for a table |
| `GET /api/orders/[orderId]` | session | Order detail |
| `PATCH /api/orders/[orderId]` | session (+ optional `x-waiter-token`) | Update items/status/payment. Sets `kitchenAt` on first IN_KITCHEN; on PAID generates `ticketNumber`, computes `change`, frees the table, and **deducts inventory once** (`inventoryDeducted` guard) |
| `POST /api/orders/[orderId]/move` | terminal session | Move active order to a free table (409 if target has an active order); frees old table |

Status flow: `OPEN → IN_KITCHEN → READY → PAID | CANCELLED`.

### POS session, PIN, tables, kitchen (all derive `businessId` via `getBusinessContext()`)
| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/pos-session/start` | manager | Open register — body `{ openingBalance }` |
| `GET /api/pos-session/current` | session | Open session + live sales rollups |
| `POST /api/pos-session/close` | manager | Close register, returns cash cut (`expectedCash`, `variance`) |
| `POST /api/pos/waiter/verify-pin` | terminal session | PIN → `{ staffId, staffName, token }`. **Throttled** (in-memory, per process) |
| `POST /api/waiter/available-tables` | terminal session | POS grid: tables + active order summary + `isOccupied` |
| `PATCH /api/pos/tables/[tableId]/occupancy` | terminal session | Toggle manual `isOccupied` |
| `GET /api/pos/kitchen` | terminal session | KDS feed: all `IN_KITCHEN` orders, FIFO by `kitchenAt` |
| `PATCH /api/pos/kitchen/[orderId]/bump` | terminal session | `{ all: true }` bump ticket, or `{ productId, prepared }` toggle a line. All lines prepared → order flips to READY; un-bump pulls a READY ticket back |

### Inventory (NEW)
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/inventory` | session | Active items, sorted by category/name |
| `POST /api/inventory` | manager | Create item (`name`, `unit`, `quantity`, `lowStockThreshold`, `category`, `notes`) |
| `PATCH /api/inventory/[itemId]` | manager | Edit metadata only — **quantity cannot be edited here**; stock changes go through movements |
| `DELETE /api/inventory/[itemId]` | manager | Soft delete |
| `GET /api/inventory/[itemId]/movements` | manager | Last 50 movements (newest first) |
| `POST /api/inventory/[itemId]/movements` | manager | Manual stock change `{ type: RESTOCK\|WASTE\|ADJUSTMENT, delta, note }`. RESTOCK forces +, WASTE forces −, ADJUSTMENT keeps sign. `SALE` movements are only written internally on payment |

### Staff (OWNER only)
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/staff` | owner | List staff |
| `POST /api/staff` | owner | Create. STAFF inserted directly; ADMIN via `auth.api.signUpEmail()`. Optional `pin` (4–6 digits) → `pinHash` |
| `PATCH /api/staff/[staffId]` | owner | Set/reset POS PIN `{ pin }` |
| `DELETE /api/staff/[staffId]` | owner | Remove staff + their sessions/accounts |

### Customers, visits, loyalty
| Method + path | Auth | Purpose |
|---|---|---|
| `GET/POST /api/customers` | session | List / create |
| `PATCH/DELETE /api/customers/[customerId]` | session | Update / delete |
| `POST /api/visits` | session | Record visit → increments `currentVisits`, may unlock reward, triggers Apple push + Google Wallet PATCH |

### Settings
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/settings` | session | Business settings |
| `PATCH /api/settings` | manager | Update name/branding/settings/**ticket** (fiscal data) |

### Wallet
| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/passes/apple/[customerId]` | link-based | Download `.pkpass` |
| `GET /api/passes/google/[customerId]` | link-based | JWT → Google Wallet save URL redirect |
| `POST/DELETE /api/wallet/apple/v1/devices/.../registrations/...` | Apple auth token | Device (de)registration for push |
| `GET /api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]` | Apple auth token | Updated pass for pushes |
| `POST /api/wallet/apple/v1/log` | — | Apple error logging |

### Seed / dev utilities
| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/seed` | owner | Seed the current business (staff, tables, products, customers, ticket data) |
| `POST /api/restaurants/seed-current` | manager | Seed current business; refuses if tables already exist |
| `POST /api/restaurants/seed` | none ⚠️ | Create a whole new demo restaurant from scratch (`restaurantName`, `slug`, `ownerName`, `ownerEmail`) |

⚠️ = unauthenticated endpoint. Fine in dev; should be locked down or removed before production.

---

## 5. Data Model Cheat Sheet (for verifying test results in Mongo)

| Collection | Key fields to check while testing |
|---|---|
| `user` | `role`, `businessId` (**string** here), `employeeNumber`, `pinHash` |
| `businesses` | `slug`, `branding`, `settings` (loyalty), `ticket` (fiscal) |
| `tables` | `isActive` (soft delete), `isOccupied` (manual busy), `assignedStaffId` |
| `products` | `isAvailable`, `recipe[] { inventoryItemId, quantity }` |
| `orders` | `status`, `items[].addedBy`, `items[].preparedQty`, `kitchenAt`, `ticketNumber`, `paymentMethod`, `amountReceived`, `change`, `inventoryDeducted` |
| `possessions` | `status`, `openingBalance`, `cashSales/cardSales/transferSales`, `expectedCash`, `actualCash`, `variance` |
| `inventoryitems` | `quantity` (may go **negative** by design), `lowStockThreshold`, `isActive` |
| `inventorymovements` | `type` (RESTOCK/WASTE/ADJUSTMENT/SALE), `delta`, `resultingQuantity`, `orderId`, `staffId` |
| `customers` | `stats.currentVisits/totalVisits/points`, `externalIds` |
| `visits` | `customerId`, `createdAt` |

---

## 6. Manual Test Plans (per feature)

### 6.1 Registration & login
1. `/registro` → fill business + owner data → should land on `/dashboard` as OWNER.
2. `/login` with the same credentials → `/dashboard`.
3. Log in as a STAFF user → must be **redirected away** from every `/dashboard/*` page.
4. Log out → hitting any `/dashboard/*` or `/pos/dashboard` should redirect to login.

### 6.2 Seeding
1. As OWNER on a fresh business: `POST /api/restaurants/seed-current` → 200; tables/products/customers/staff appear.
2. Call it again → 400 "ya tiene datos".
3. Verify seeded staff exist in `user` collection with `businessId` **as string**.

### 6.2a Fresh business without seeding (no demo data)
Everything except tables has a working "create" UI on an empty collection, so a real business can self-serve onboarding without ever calling the seed routes:
1. Register via `/registro` → lands on `/dashboard` with a `Business` doc (sane defaults) and an OWNER user. No tables/products/staff/customers exist yet.
2. `/dashboard` (analytics home) must render cleanly with all-zero stats — no crash, explicit empty states ("Sin actividad aún", "Sin visitas esta semana todavía").
3. `/pos/dashboard` before any table exists shows "Sin mesas configuradas" — expected, not a bug.
4. `/dashboard/tables` → "Nueva Mesa" → create table #1. Duplicate table numbers within the business 409 with a clear message (unique `{businessId, number}` index), never a raw crash.
5. That table now appears immediately on `/pos/dashboard` — a manager can open the register and take orders with zero use of the demo seed routes.
6. Products, inventory items, staff, and customers can each be added the same way from their own dashboard pages — none of them require seeding either.

### 6.3 Menu & recipes
1. `/dashboard/menu`: create a product with a custom category (datalist accepts free text).
2. Edit price → verify POS shows new price on next order.
3. Toggle availability off → product disappears from POS product list but **remains** in old orders.
4. Open the recipe editor → link the product to 1–2 inventory items with per-unit quantities → save → check `products.recipe` in Mongo.
5. Delete a product → hard-deleted; historical orders keep name/price (embedded).

### 6.4 Inventory (NEW)
1. `/dashboard/inventory`: create item (e.g. "Café en grano", unit `kg`, quantity 10, threshold 2).
2. **Restock** +5 → quantity 15; movement `RESTOCK, delta +5, resultingQuantity 15`.
3. **Waste** with delta 3 (even if typed positive) → quantity −3 applied; movement `WASTE, delta -3`.
4. **Adjustment** −0.5 → sign preserved as sent.
5. Try `POST` movement with `delta: 0` or bad type → 400.
6. Try `PATCH /api/inventory/[id]` with `{ quantity: 999 }` → quantity must **not** change (only name/unit/threshold/category/notes are editable).
7. Set quantity between 1 and threshold → item shows "Stock bajo" in UI.
8. Delete item → gone from list, still in DB with `isActive: false`.
9. **Sale deduction**: give a product a recipe (e.g. 0.02 kg per unit) → sell 3 on the POS and pay → inventory drops by 0.06 with a single `SALE` movement referencing the `orderId`. Products **without** a recipe must not create movements.
10. **Idempotency**: re-PATCH the same order with `status: PAID` → no second deduction (`inventoryDeducted: true`).
11. **Negative stock**: sell more than stock → quantity goes negative and is displayed (by design, not clamped).

### 6.5 Tables & occupancy
1. Create/edit/soft-delete tables from the dashboard; deleted tables disappear from POS grid.
2. On `/pos/dashboard`, mark a free table as occupied (manual flag) → chip turns **rose**; "Ocupadas" filter includes it.
3. Open an order on another table → chip turns **amber**.
4. Pay or cancel the order → table returns to **emerald** (both `isOccupied` and `assignedStaffId` cleared).

### 6.6 POS terminal & cash session
1. `/pos`: log in as OWNER/ADMIN → `/pos/dashboard`. A STAFF login must be rejected.
2. Open register with opening balance 500 → session appears; `GET /api/pos-session/current` shows it.
3. Try `POST /api/pos-session/start` again → must refuse (one open session per business).
4. Make sales: 1 cash, 1 card, 1 transfer.
5. Close register entering counted cash → verify cash cut: `expectedCash = openingBalance + cashSales`, `variance = actualCash − expectedCash`. Card/transfer must not affect expected cash.

### 6.7 Waiter PIN flow
1. As OWNER, set a PIN for a STAFF member (`/dashboard/staff` or `PATCH /api/staff/[id]` `{ pin: "1234" }`).
2. Tap a table on `/pos/dashboard` → PIN modal → correct PIN opens `OrderBuilder` under that waiter's name.
3. Wrong PIN → error; hammer it repeatedly → throttle kicks in (in-memory; resets on server restart).
4. "Continuar como gerente" escape hatch works without a PIN.
5. Stay idle > 90 s without mutations, then add an item → PIN should be requested again (token expired). Active use keeps rolling the window (token refreshed on each response).
6. A PIN from business A must not verify on a terminal logged into business B.

### 6.8 Order building & kitchen rounds
1. Add items → order auto-creates then auto-saves (800 ms debounce). Reload the page: items persist.
2. "Enviar a cocina" → status IN_KITCHEN, `kitchenAt` set once (not reset by later rounds).
3. Add 2 more items after sending → "Enviar 2 más a cocina" badge appears; sending again must **not** duplicate previously sent items on the kitchen ticket.
4. Per-line notes reach the kitchen ticket.
5. Two waiters on the same order: each new line's `addedBy` is the acting waiter (verify in Mongo).

### 6.9 Kitchen Display System (`/pos/kitchen`)
1. Send 2+ orders to kitchen → both appear, **oldest first**.
2. Bump one line (`prepared`) → line marked; ticket stays IN_KITCHEN.
3. Bump all lines (or "bump ticket") → order flips to **READY**; waiter's OrderBuilder shows it ready to charge.
4. Un-bump a line on a READY ticket → order returns to IN_KITCHEN and reappears on the KDS.
5. Bump an order from another business by ID via curl → 404 (business-scoped).

### 6.10 Move order to another table
1. With an active order on table A: move it to free table B → order shows on B, table A freed.
2. Move to a table that already has an active order → 409.
3. Move to the same table → no-op 200.
4. Move to a soft-deleted or other-business table → 404.

### 6.11 Payment & receipt
1. "Cobrar" → PaymentModal. CASH: enter received amount → change computed; quick-amount buttons work; received < total must not be accepted.
2. Pay → status PAID, sequential `ticketNumber` assigned, receipt opens in print dialog (80 mm format).
3. Receipt shows fiscal data from `/dashboard/settings` and the **IVA breakdown**: subtotal = total / 1.16, IVA line, "IVA incluido en el precio" (default rate 16%; hidden if 0).
4. CARD/TRANSFER: no change calculation; verify they land in the right `POSSession` rollup.
5. Cancel an order → CANCELLED, table freed, **no** inventory deduction, no ticket number.

### 6.12 Order history & reprint
1. `/dashboard/orders`: filters by period (Hoy/7/30 días) and status work; stats strip (revenue, paid count, avg ticket) matches the filtered set.
2. Reprint a paid order → receipt regenerates with **current** business settings (not a historical snapshot — change the footer message and reprint to confirm).

### 6.13 Reports — ventas por mesero
1. Have two waiters add lines to orders (mixed on the same order too), pay them.
2. `/dashboard/reports`: each waiter's revenue = sum of **their own lines** (`items[].addedBy`), not whole orders. Legacy lines without `addedBy` fall back to `order.staffId`.
3. Period filter changes the aggregate.

### 6.14 Staff management (OWNER only)
1. ADMIN user must get 401/redirect on `/dashboard/staff` and `/api/staff`.
2. Create STAFF with a PIN → can use POS PIN flow immediately.
3. Create ADMIN → created via better-auth (`signUpEmail`), can log into the dashboard.
4. Duplicate PIN within the business → should be rejected/handled.
5. Remove staff → their sessions/accounts deleted; historical orders still show their name.

### 6.15 Settings
1. Change business name, brand color, ticket fields → single save persists all; reload to confirm.
2. "Ver ticket de prueba" previews the receipt with **unsaved** current form values.
3. STAFF hitting `/dashboard/settings` → redirected.

### 6.16 Loyalty, customers & wallet
1. Create customer → `stats` start at 0.
2. Record visits until `requiredVisits` → reward unlocks; `currentVisits` resets per loyalty rules; `totalVisits` keeps counting.
3. `/c/[customerId]` public card shows correct progress and brand color — **works logged out** (note: unauthenticated by design; the ID is the only secret).
4. Apple/Google wallet buttons (needs wallet env vars + real devices): pass downloads, registers for push; recording a visit pushes an update.
5. `/dashboard/loyalty`: leaderboard ordering matches visit counts.

---

## 7. API Testing with curl

Better-auth uses an httpOnly cookie — capture it once, reuse everywhere:

```bash
BASE=http://localhost:3000

# 1. Sign in and store the session cookie
curl -s -c /tmp/rk-cookies.txt -X POST "$BASE/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"secret123"}'

# 2. Authenticated calls
curl -s -b /tmp/rk-cookies.txt "$BASE/api/tables" | jq
curl -s -b /tmp/rk-cookies.txt -X POST "$BASE/api/pos-session/start" \
  -H 'Content-Type: application/json' -d '{"openingBalance":500}'

# 3. Waiter token flow
TOKEN=$(curl -s -b /tmp/rk-cookies.txt -X POST "$BASE/api/pos/waiter/verify-pin" \
  -H 'Content-Type: application/json' -d '{"pin":"1234"}' | jq -r .token)

curl -s -b /tmp/rk-cookies.txt -X PATCH "$BASE/api/orders/$ORDER_ID" \
  -H 'Content-Type: application/json' -H "x-waiter-token: $TOKEN" \
  -d '{"items":[{"productId":"...","name":"Tacos","price":45,"quantity":2}]}'
# → response carries a refreshed token in the x-waiter-token response header

# 4. Pay an order
curl -s -b /tmp/rk-cookies.txt -X PATCH "$BASE/api/orders/$ORDER_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PAID","paymentMethod":"CASH","amountReceived":200}'

# 5. Inventory movement
curl -s -b /tmp/rk-cookies.txt -X POST "$BASE/api/inventory/$ITEM_ID/movements" \
  -H 'Content-Type: application/json' \
  -d '{"type":"RESTOCK","delta":5,"note":"Compra semanal"}'
```

---

## 8. Security Test Cases (regression-critical)

These verify the POS v2 security model. All should **fail safely**:

1. **Client-supplied businessId is ignored**: send `businessId` of another business in any POS body/query → operation still scoped to the cookie's business.
2. **Cross-business access**: with business A's session, GET/PATCH business B's order, table, inventory item, or staff by ID → 404/401, never data.
3. **No session**: every `/api/*` route (except `auth`, `business`, `restaurants/seed`, wallet, `/c/*` passes) returns 401 without a cookie.
4. **Role escalation**: STAFF session hitting manager endpoints (`POST /api/tables`, `/api/settings` PATCH, `/api/inventory` POST, pos-session start/close) → 401.
5. **Waiter token**: expired (>90 s idle) token → rejected; token tampered with → rejected; token from business A used on business B's terminal → rejected.
6. **PIN throttle**: repeated wrong PINs → throttled (note: in-memory, resets on restart — known limitation).
7. **localStorage is display-only**: clearing/faking `posEmployeeSession` in localStorage must not grant API access (the `/pos/kitchen` gate is cosmetic; APIs still check the cookie).
8. **Unauthenticated endpoints to lock down before prod**: `POST /api/business`, `POST /api/restaurants/seed`.

---

## 9. Known Limitations That Affect Testing

- E2E covers the happy paths in Chromium only; cross-browser (WebKit/Firefox), mobile viewports, and visual regression are not set up.
- PIN throttle is per-process in-memory (restart clears it).
- PaymentModal does not send the waiter token — payment is attributed to the terminal user, not the waiter.
- `businessId` string-vs-ObjectId debt on the `user` collection — when writing Mongo queries by hand, match both forms.
- Existing staff have no `pinHash` until one is set.
- No payment processor, CFDI, delivery, CSV export, or multi-language (es-MX only).
- Receipt/IVA: prices are IVA-inclusive; the breakdown is display-only math on the total.
