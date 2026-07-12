# RestKit — Restaurant Management SaaS

**RestKit** is a comprehensive restaurant management system for the Mexican market, built with Next.js 16, MongoDB, TypeScript, and React 19. It started as a loyalty card system (Apple/Google Wallet) and has evolved into a full POS, analytics, and business management platform.

**Related docs**: [`docs/FEATURES_AND_TESTING.md`](docs/FEATURES_AND_TESTING.md) (full route/feature map + test suites), [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) (production deployment steps).

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API routes, Node.js
- **Database**: MongoDB + Mongoose ODM
- **Auth**: better-auth (session-based)
- **Styling**: Tailwind CSS v4 with custom color config
- **Icons**: lucide-react
- **Wallet**: Apple Wallet (.pkpass), Google Wallet (JWT)
- **Printing**: HTML/CSS to browser print dialog (80mm thermal paper format)
- **POS auth**: two-layer — better-auth terminal session + per-waiter PIN (scrypt hash + HMAC ephemeral token)

---

## ⭐ POS Architecture (v2 — CURRENT, read this first)

The POS was refactored away from an insecure localStorage flow. **The POS now lives entirely under `/pos`** — the old `/dashboard/pos/*` tree was **deleted**. Do not reference `/dashboard/pos`.

### POS routes (the daily tool)
- `/pos` — terminal login. A **manager (OWNER/ADMIN) signs in with better-auth** (email+password) to open the terminal for the shift. Sets an httpOnly session cookie. (`components/pos/POSLoginPage.tsx`)
- `/pos/dashboard` — table grid + cash session. Opens/closes the register (`POSSession`).
- `/pos/order/[tableId]` — gated by a **waiter PIN modal**, then renders `OrderBuilder`.

### Two-layer auth (the security model)
1. **Terminal session = the security boundary.** Every POS API route derives `businessId`/identity from the better-auth cookie via `getBusinessContext()` in **`lib/pos-auth.ts`** — never from client-supplied body/query. Client `localStorage`/`sessionStorage` is display-only and never trusted for authorization.
2. **Waiter PIN = lightweight actor selection** on top of the trusted terminal. On a correct PIN the server issues a short-lived (90s) signed HMAC token. Logic in **`lib/waiter-token.ts`** (server: `hashPin`, `verifyPinHash`, `signWaiterToken`, `verifyWaiterToken`) and **`lib/waiter-session.ts`** (client: active waiter in `sessionStorage`, rolling 90s window, `waiterHeader()`, `refreshWaiterFromResponse()`).
   - PIN modal: `components/pos/WaiterPinModal.tsx` (keypad + "continuar como gerente" escape hatch).
   - Order mutations send `x-waiter-token`; the server attributes `staffId`/`items[].addedBy` and **refreshes the token in the response header** (rolling window, no re-typing while active).
   - PINs are hashed (scrypt) in `user.pinHash`, set at staff creation or via `PATCH /api/staff/[staffId]` `{ pin }`. 4–6 digits, unique per business in practice.

### Attribution & reporting (Fase 3)
- `Order.items[].addedBy` records which waiter added each line (falls back to `order.staffId` for legacy lines).
- **`/dashboard/reports`** ("Ventas por mesero") aggregates paid orders by `addedBy` for tips/commissions — `analyticsService.getWaiterSales(businessId, period)`.
- Order history (`/dashboard/orders`) shows the waiter who opened each order.

### Busy tables
- A table is **busy** if it has an active order **OR** `Table.isOccupied === true` (manual "seated, no order yet").
- `PATCH /api/pos/tables/[tableId]/occupancy` toggles the manual flag (terminal-session scoped).
- Paying/cancelling an order frees the table (`isOccupied = false`).
- `/pos/dashboard` grid: filter chips (Todas / Ocupadas / Libres); 3 visual states (amber = order, rose = manual busy, emerald = free).

### Key files
`lib/pos-auth.ts`, `lib/waiter-token.ts`, `lib/waiter-session.ts`, `components/pos/{POSLoginPage,OrderBuilder,PaymentModal,WaiterPinModal,POSSessionStart,POSSessionClose,ReprintButton}.tsx`.

### Deleted in this refactor (do not recreate)
- Pages: entire `app/dashboard/pos/*` tree (grid, order, table-layout editor, staff/waiter login + lobby).
- Components: `StaffLoginForm`, `WaiterLoginForm`, `TableLayoutEditor`, `POSContainer`, `AddTableButton`, `POSPageWrapper`, `TablesFilterBar`.
- API routes: `api/pos/login`, `api/staff/login`, `api/waiter/check-in`, `api/tables/layout`, `api/staff/[staffId]/tables` (old passwordless lookups / layout editor).
- ⚠️ Deleting the old `AddTableButton`/`TableLayoutEditor` left **no dashboard UI to create tables at all** until `/dashboard/tables` (see Dashboard Pages below) was added later — that page is a new, unrelated feature (simple form + list, no drag-and-drop layout), not a recreation of the deleted layout editor.

---

## Project Structure

```
restkit/
├── models/              # Mongoose schemas
├── repositories/        # Data access layer
├── services/            # Business logic
├── app/
│   ├── api/            # RESTful endpoints
│   ├── dashboard/      # Protected routes (OWNER/ADMIN/STAFF)
│   ├── auth/           # Auth pages (login, register)
│   └── page.tsx        # Landing page
├── components/
│   ├── pos/            # POS-specific (OrderBuilder, PaymentModal, etc.)
│   ├── dashboard/      # Dashboard UI (forms, buttons, lists)
│   ├── settings/       # Settings forms
│   └── appleWallet/    # Wallet integration
├── lib/
│   ├── auth.ts         # better-auth config
│   ├── db.ts           # MongoDB connection
│   └── receipt-html.ts # Ticket template generator
└── public/             # Static assets
```

---

## Data Models

### **User**
Role-based access control (RBAC). Three roles: OWNER, ADMIN, STAFF.
- `_id`, `name`, `email`, `password`, `businessId`, `role`, `employeeNumber`, `pinHash`, `createdAt`, `updatedAt`
- `employeeNumber`: short staff identifier. `pinHash`: scrypt-hashed POS PIN (waiter identity).
- ⚠️ **`businessId` type inconsistency (known debt)**: the Better Auth `user` collection stores `businessId` as a **string**; domain collections (Order/Table/POSSession) use **ObjectId**. When querying `user` by business, match both forms (`$in: [businessIdStr, businessId]`). `getBusinessContext()` exposes both `businessId` (ObjectId) and `businessIdStr`.
- OWNER: Full access to all features
- ADMIN: Analytics, menu management, settings, staff management
- STAFF: Takes orders on the POS (terminal) via PIN; no dashboard access

### **Business**
Restaurant entity. One per subscription account.
- `name`, `slug`, `branding` (logo, primaryColor), `settings` (requiredVisits, rewardDescription)
- **ticket** (NEW): `fiscalName`, `rfc`, `phone`, `address`, `fiscalAddress`, `website`, `footerMessage`
- Used to scope all other data (tables, products, orders, customers, staff)

### **Table**
Physical dining table.
- `businessId`, `number`, `name`, `capacity`, `isActive`, `isOccupied`, `position`, `section`, `assignedStaffId`
- Soft-deleted via `isActive: false`
- `isOccupied`: manual "busy" flag (seated, no order yet). Effective **busy = `isOccupied` OR has active order**. Reset to `false` when the order is paid/cancelled.

### **Product**
Menu item.
- `businessId`, `name`, `price`, `description`, `category`, `isAvailable`, `sortOrder`
- `isAvailable: false` hides from POS but keeps historical references

### **Order**
Per-table order during a shift.
- `tableId`, `tableName`, `businessId`, `staffId`, `status`, `items[]`, `total`, `notes`
- **New payment fields**: `paymentMethod`, `amountReceived`, `change`, `ticketNumber`
- Status flow: OPEN → IN_KITCHEN → READY → PAID/CANCELLED
- One active order per table (enforced by `uniq_active_order_per_table`, a **unique** partial index on `tableId` for OPEN/IN_KITCHEN/READY; `POST /api/orders` catches the E11000 race and returns the existing order)

### **OrderItem** (embedded in Order)
- `productId`, `name`, `price`, `quantity`, `notes`, `addedBy`
- `addedBy`: waiter (User `_id`) who first added the line — used for per-waiter sales (Fase 3). Preserved on item replace; new lines stamped with the acting waiter.

### **POSSession**
Cash register session (one open per business at a time).
- `businessId`, `staffId`, `staffName`, `status` (OPEN/CLOSED), `openingBalance`, `closingBalance`
- Sales rollups: `totalSales`, `totalOrders`, `cashSales`, `cardSales`, `transferSales`, `expectedCash`, `actualCash`, `variance`
- Opened/closed by a manager from `/pos/dashboard`. Sales computed from PAID orders since `startedAt`.

### **Customer**
Loyalty program member.
- `businessId`, `name`, `email`, `phone`
- `stats` (totalVisits, currentVisits, points)
- `externalIds` (appleAuthToken, applePass, googlePass)

### **Visit**
Loyalty record per customer visit.
- `customerId`, `businessId`, `notes`, `createdAt`
- Triggers loyalty updates (increments currentVisits, may unlock reward)

### **AppleDevice**
Device registration for Apple Wallet push updates.
- `deviceId`, `pushToken`, `businessId`, customers[]

### **Reward** (unused)
Placeholder for future reward customization.

---

## API Routes

All routes require authentication via `better-auth`.

### Tables
- `GET /api/tables` — List active tables with their open orders
- `POST /api/tables` — Create table (OWNER/ADMIN). 409 on a duplicate `number` within the business (unique `{businessId, number}` index)
- `PATCH /api/tables/[tableId]` — Update table (OWNER/ADMIN). Same 409 on a number collision
- `DELETE /api/tables/[tableId]` — Soft-delete table (OWNER/ADMIN)

### Products
- `GET /api/products` — List all products (active + inactive)
- `POST /api/products` — Create product (OWNER/ADMIN)
- `PATCH /api/products/[productId]` — Update product (OWNER/ADMIN)
- `DELETE /api/products/[productId]` — Hard-delete product (OWNER/ADMIN)

### Orders
- `GET /api/orders` — List active orders for a table
- `POST /api/orders` — Create new order or get active one
- `GET /api/orders/[orderId]` — Fetch order details
- `PATCH /api/orders/[orderId]` — Update order items/status/payment
  - Accepts: `items[]`, `status`, `paymentMethod`, `amountReceived`
  - Auto-generates `ticketNumber` and calculates `change` on PAID status
  - Reads optional `x-waiter-token` header → attributes `staffId`/`items[].addedBy`, refreshes the token in the response. On PAID/CANCELLED frees the table (`isOccupied=false`, unsets `assignedStaffId`).

### POS — sessions, waiter PIN, occupancy (all derive businessId from `getBusinessContext()`)
- `POST /api/pos-session/start` — Open register (manager only). Body: `openingBalance`.
- `GET  /api/pos-session/current` — Current open session + live sales.
- `POST /api/pos-session/close` — Close register, returns cash-cut (manager only).
- `POST /api/pos/waiter/verify-pin` — Validate a waiter PIN within the business → returns ephemeral token (`{ staffId, staffName, token }`). Throttled.
- `POST /api/waiter/available-tables` — POS table grid: tables + active order summary + `isOccupied`.
- `PATCH /api/pos/tables/[tableId]/occupancy` — Toggle manual `isOccupied`. Body: `{ isOccupied: boolean }`.

### Customers
- `GET /api/customers` — List all customers
- `POST /api/customers` — Create customer
- `PATCH /api/customers/[customerId]` — Update customer
- `DELETE /api/customers/[customerId]` — Delete customer

### Visits
- `POST /api/visits` — Record a visit
  - Increments `currentVisits`, checks if reward unlocked
  - Triggers Apple push notifications (if registered)
  - Triggers Google Wallet PATCH

### Staff (OWNER only)
- `GET /api/staff` — List staff
- `POST /api/staff` — Create staff. STAFF inserted directly; **ADMIN created via `auth.api.signUpEmail()`** (server API, no HTTP self-fetch / no `APP_URL` dependency) passing `role` + `businessId`. Optional `pin` (4–6 digits) → hashed into `pinHash`.
- `PATCH /api/staff/[staffId]` — Set/reset a staff member's POS PIN (`{ pin }`).
- `DELETE /api/staff/[staffId]` — Remove staff (+ sessions/accounts)

### Settings
- `GET /api/settings` — Fetch business settings
- `PATCH /api/settings` — Update business settings (OWNER/ADMIN)
  - Accepts full Business object: name, branding, settings, ticket

### Apple Wallet
- `GET /api/passes/apple/[customerId]` — Download .pkpass file
- `POST /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` — Register device for push
- `GET /api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]` — Fetch updated pass (for pushes)
- `POST /api/wallet/apple/v1/log` — Log Apple errors

### Google Wallet
- `GET /api/passes/google/[customerId]` — Generate JWT → redirect to Google Wallet save URL

---

## Dashboard Pages

All pages are protected by `auth()` and redirect to `/login` if unauthenticated.

### `/dashboard`
Analytics home (OWNER/ADMIN). Stats, 7-day revenue chart, top customers, recent activity.

> **POS is NOT in the dashboard.** It lives under `/pos` (see the POS Architecture section above). The old `/dashboard/pos/*` pages were deleted.

### `/dashboard/reports` (Ventas por mesero)
Per-waiter sales report (OWNER/ADMIN). Period filter (today/7d/30d). Revenue split by `items.addedBy`, with share bars. Backed by `analyticsService.getWaiterSales`.

### `/dashboard/menu`
Menu management (OWNER/ADMIN).
- Products grouped by category
- Add/edit/delete/toggle-availability per product
- ProductForm uses datalist for category (can enter custom)

### `/dashboard/tables` (NEW)
Table management (OWNER/ADMIN). The only UI path to create tables — a freshly registered business has none until a manager adds them here (previously tables could only be created via the demo seed routes or the raw API; this page closes that gap). Grouped by section; add/edit/soft-delete via `TableForm`/`EditTableButton`/`DeleteTableButton` in `components/tables/`. `POST`/`PATCH /api/tables` 409 on a duplicate table number within the business instead of a raw 500.

### `/dashboard/inventory`
Inventory management (OWNER/ADMIN). Items grouped by category with low-stock/out-of-stock badges; add/edit/soft-delete via `InventoryItemForm`/`EditInventoryItemButton`/`DeleteInventoryItemButton`, stock changes only through `StockAdjustButton` (RESTOCK/WASTE/ADJUSTMENT), never by editing quantity directly — see Inventory data model above.

### `/dashboard/customers`
Customer grid with visit progress bars and loyalty status.
- RecordVisitButton per customer
- Links to `/dashboard/customers/[id]` for details

### `/dashboard/customers/[id]`
Customer detail page.
- QR code (appleAuthToken)
- Apple Wallet + Google Wallet buttons
- Visit recording form
- Visit history

### `/dashboard/loyalty`
Loyalty configuration.
- Reward settings (visits required, description)
- Top customers leaderboard with progress bars

### `/dashboard/orders` (NEW)
Order history page (OWNER/ADMIN).
- **Filters**: Period (Today/7 days/30 days), Status (All/Active/Paid/Cancelled)
- **Stats strip**: Total revenue, paid orders count, average ticket
- **List**: Ticket #, table name, status badge, item summary, payment method, total, time
- **Reprint button**: Re-opens receipt for any paid order

### `/dashboard/staff`
Staff list and invite (OWNER only).
- Shows role badges (Dueño/Gerente/Empleado)
- AddStaffForm modal
- RemoveStaffButton per staff member

### `/dashboard/settings` (NEW)
Business configuration (OWNER/ADMIN, redirects STAFF to /customers).
- **Información del negocio**: Name, color, logo
- **Datos del ticket**: Fiscal name, RFC, phone, address, website, footer message
  - "Ver ticket de prueba" button previews receipt with current settings
- **Programa de fidelización**: Required visits, reward description
- Single save button persists all changes

---

## Key Components

### Client Components

**OrderBuilder** (`components/pos/OrderBuilder.tsx`)
- Hosted by `/pos/order/[tableId]` (after the waiter PIN gate). Redirects to `/pos/dashboard` after pay/cancel.
- Manages product search, category filtering, shopping cart
- State: `orderId`, `status`, `items`, `kitchenSnapshot` (tracks what was sent to kitchen)
- Auto-save to `/api/orders` on item changes; attaches `x-waiter-token` (`waiterHeader()`) and rolls the window (`refreshWaiterFromResponse`)
- Status flow buttons: "Enviar a cocina" → "Marcar como lista" → "Cobrar" → PaymentModal
- Pending badge shows items not yet sent to kitchen

**PaymentModal** (`components/pos/PaymentModal.tsx`)
- Method selection (CASH/CARD/TRANSFER)
- For CASH: amount input, change calculator, quick-amount buttons
- Prints receipt via `printReceipt()` from `lib/receipt-html.ts`
- Shows success screen with reprint and done buttons

**SettingsForm** (`components/settings/SettingsForm.tsx`)
- Editable fields for business, ticket, and loyalty settings
- Color picker for brand color
- "Ver ticket de prueba" button to preview receipt
- Single save button POSTs to `/api/settings`

**RecordVisitButton** (`components/dashboard/RecordVisitButton.tsx`)
- Modal to input visit notes
- POSTs to `/api/visits`, triggers loyalty update
- Shows pending badge until saved

### Server Components

All dashboard pages are async server components that:
1. Check session via `auth.api.getSession()`
2. Validate role for that page
3. Fetch data from MongoDB (fast queries, proper indexes)
4. Pass serialized data to client components

---

## Patterns & Conventions

### Service Layer
- **repositories**: Raw CRUD queries (find, create, update, delete)
- **services**: Business logic (customer creation with default stats, visit recording, loyalty checks)
- **API routes**: Thin wrappers that call services, handle auth, return JSON

### Auto-save
- OrderBuilder uses 800ms debounced save
- Auto-creates order on first add, then updates items on each change
- No data loss: debounce is on the save function, not state updates

### RBAC
- Route-level checks: `if (!['OWNER', 'ADMIN'].includes(session.user.role)) return 401`
- Page-level redirects: STAFF → `/pos` (no dashboard access), unauthenticated → `/login`
- Sidebar hides nav items based on role; **the sidebar has no POS link** (POS is `/pos` only)
- POS routes use `getBusinessContext()` / `isManager()` instead of inline session checks

### Multi-round Kitchen Orders
- `kitchenSnapshot` Map tracks products sent to kitchen in previous rounds
- "Enviar N más a cocina" button appears only if new items added after IN_KITCHEN status
- Prevents duplicate sends of the same item

### Product Availability
- `isAvailable: false` hides from POS but keeps in historical orders
- Toggle via button, don't delete products

### Receipt Printing
- `lib/receipt-html.ts` generates fixed-width monospace HTML for 80mm thermal paper
- `@page { size: 80mm auto; }` in CSS ensures correct print size
- Browser print dialog → staff selects thermal printer
- No driver or app installation needed

### Ticket Config in Receipt
- All ticket fields (fiscal name, RFC, phone, etc.) come from `Business.ticket`
- Receipt HTML is generated on-demand at payment or reprint time
- Current settings always used (not historical snapshot)

---

## Authentication & Sessions

**better-auth** with database-backed sessions (the only real auth boundary).
- Sign up creates Business if first user
- Login returns session with `user.businessId`, `user.role`, `user.name`
- Session is passed through `headers()` to every protected route
- Logout clears session cookie

### POS (two layers — see POS Architecture section)
1. **Terminal**: a manager signs in with better-auth at `/pos` (shift open). All POS API routes call `getBusinessContext()` (`lib/pos-auth.ts`) to derive `businessId`/identity from the cookie — **never** from client input.
2. **Waiter PIN**: identifies the acting waiter on the trusted terminal. PIN → ephemeral 90s HMAC token (`lib/waiter-token.ts`); client holds it in `sessionStorage` (`lib/waiter-session.ts`) and sends it as `x-waiter-token` on order mutations.
- ⚠️ Never trust `role`/`businessId` coming from the client (`localStorage`/`sessionStorage` are display-only).

---

## Database Indexes

### Key Indexes
- `User`: `email` (unique)
- `Business`: `slug` (unique)
- `Table`: `businessId`, `isActive`
- `Product`: `businessId`, `category`, `sortOrder`, `name`
- `Order`: 
  - `businessId`, `tableId`
  - `uniq_active_order_per_table`: unique partial `{ tableId: 1 }` over active statuses (one active order per table, race-proof)
  - `createdAt` (for filtering by date)
- `Customer`: `businessId`, `email`
- `Visit`: `customerId`, `businessId`, `createdAt`

---

## Known Limitations & TODOs

1. **Receipt template**: Currently hardcoded 80mm format. No per-business customization yet.
2. **Payment processing**: Collects payment data but doesn't integrate with payment processors (Stripe, MercadoPago).
3. **Inventory**: No stock tracking yet.
4. **KDS**: Kitchen display system (status push) planned but not built.
5. **Delivery**: Not implemented.
6. **CFDI**: Fiscal invoice integration not built.
7. **Multi-language**: Spanish only (es-MX).
8. **Export/Reports**: No CSV/PDF export of orders or customers.
9. **`businessId` type debt (Fase 4, not done)**: string in `user` collection vs ObjectId in domain collections. Currently mitigated with `$in: [businessIdStr, businessId]` on `user` lookups; normalize at the root eventually.
10. **PIN throttle is in-memory** (per process) in `verify-pin` — move to Redis / a per-user lockout for multi-node.
11. **PaymentModal does not send the waiter token** — the payment is attributed to the terminal user, not the waiter (usually fine; cobro is done by cashier/manager).
12. **PINs need backfilling**: existing staff have no `pinHash` until set via staff create or `PATCH /api/staff/[id]`.

---

## Development Notes

### How to Add a New Feature

1. **Database**: Define model in `models/`
2. **Repository**: Create CRUD in `repositories/` if needed
3. **Service**: Add business logic in `services/`
4. **API**: Create route in `app/api/` (check auth, call service, return JSON)
5. **Page/Component**: Build UI in `app/dashboard/` or `components/`
6. **Tests**: `npm test` — Vitest + mongodb-memory-server in `tests/` (unit: token/receipt/session libs; integration: API route handlers with mocked better-auth session against in-memory Mongo). `npm run test:e2e` — Playwright UX suite in `e2e/` (self-contained: boots its own in-memory Mongo + `next dev` on port 3100; covers login, dashboard nav, menu/inventory forms, and the full POS shift). Add coverage for new routes/services and extend the E2E flow for new user-facing features.

### Type Safety

- All models are typed with Mongoose interfaces (`IOrder`, `ICustomer`, etc.)
- API responses and requests are typed in component props
- Use `const _id = new mongoose.Types.ObjectId(id)` to convert string IDs

### Form Patterns

- Use controlled inputs with useState for client forms
- Debounce saves if auto-saving (e.g., OrderBuilder)
- Show loading state during async operations
- Display success/error feedback

---

## Future Roadmap (Inferred)

- [ ] Full CFDI integration (Mexico tax invoicing)
- [ ] Delivery route optimization
- [ ] Kitchen display system with live status push
- [ ] Inventory tracking & purchase orders
- [ ] Multi-location support
- [ ] Advanced reporting & exports
- [ ] Mobile app (React Native or Flutter)
- [ ] Real payment processor integration

---

**Last updated**: 2026-07-12  
**Status**: MVP + POS v2. POS lives only under `/pos` with two-layer auth (terminal session + waiter PIN), per-waiter sales reporting, busy-table tracking, a Kitchen Display System, and recipe-linked inventory. Recent work: Fase 1 (POS auth hardening), Fase 2 (waiter PIN + attribution), Fase 3 (ventas por mesero), ADMIN-creation fix (`auth.api.signUpEmail`), POS removed from dashboard, busy-table filters, automated test suites (Vitest + Playwright, see `docs/FEATURES_AND_TESTING.md`), unique active-order-per-table index (race fix), `/dashboard/tables` (fresh businesses can now self-serve table setup — previously only possible via the demo seed routes).
