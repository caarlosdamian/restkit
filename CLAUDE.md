# RestKit — Restaurant Management SaaS

**RestKit** is a comprehensive restaurant management system for the Mexican market, built with Next.js 16, MongoDB, TypeScript, and React 19. It started as a loyalty card system (Apple/Google Wallet) and has evolved into a full POS, analytics, and business management platform.

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
- `_id`, `name`, `email`, `password`, `businessId`, `role`, `createdAt`, `updatedAt`
- OWNER: Full access to all features
- ADMIN: Analytics, menu management, settings, staff management
- STAFF: Can view customers/loyalty, record visits, add items to orders (POS)

### **Business**
Restaurant entity. One per subscription account.
- `name`, `slug`, `branding` (logo, primaryColor), `settings` (requiredVisits, rewardDescription)
- **ticket** (NEW): `fiscalName`, `rfc`, `phone`, `address`, `fiscalAddress`, `website`, `footerMessage`
- Used to scope all other data (tables, products, orders, customers, staff)

### **Table**
Physical dining table.
- `businessId`, `number`, `name`, `capacity`, `isActive`
- Soft-deleted via `isActive: false`

### **Product**
Menu item.
- `businessId`, `name`, `price`, `description`, `category`, `isAvailable`, `sortOrder`
- `isAvailable: false` hides from POS but keeps historical references

### **Order**
Per-table order during a shift.
- `tableId`, `tableName`, `businessId`, `staffId`, `status`, `items[]`, `total`, `notes`
- **New payment fields**: `paymentMethod`, `amountReceived`, `change`, `ticketNumber`
- Status flow: OPEN → IN_KITCHEN → READY → PAID/CANCELLED
- One active order per table (enforced by compound index on tableId+status)

### **OrderItem** (embedded in Order)
- `productId`, `name`, `price`, `quantity`, `notes`

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
- `POST /api/tables` — Create table (OWNER/ADMIN)
- `PATCH /api/tables/[tableId]` — Update table (OWNER/ADMIN)
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

### Staff
- `GET /api/staff` — List staff (OWNER only)
- `POST /api/staff` — Create staff (invite, OWNER only)
- `DELETE /api/staff/[staffId]` — Remove staff (OWNER only)

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

### `/dashboard/pos`
Table grid. Color-coded status (gray=free, amber=open, blue pulsing=in kitchen, green=ready).
- Occupied count badge
- Links to `/dashboard/pos/[tableId]` to build orders

### `/dashboard/pos/[tableId]`
**OrderBuilder** — main POS interface.
- Left: searchable product grid, category filters
- Right: shopping cart, status indicators
- Multi-round kitchen sends via `kitchenSnapshot` Map
- Auto-save (800ms debounce) to `/api/orders`
- **"Cobrar" button** opens **PaymentModal** instead of direct PAID
- PaymentModal: method selection (CASH/CARD/TRANSFER) → change calculator → "Ver ticket de prueba"
- On confirm: PATCH to API, generates ticket #, prints receipt

### `/dashboard/menu`
Menu management (OWNER/ADMIN).
- Products grouped by category
- Add/edit/delete/toggle-availability per product
- ProductForm uses datalist for category (can enter custom)

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
- Manages product search, category filtering, shopping cart
- State: `orderId`, `status`, `items`, `kitchenSnapshot` (tracks what was sent to kitchen)
- Auto-save to `/api/orders` on item changes
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
- Page-level redirects: STAFF → `/dashboard/customers`, unauthenticated → `/login`
- Sidebar hides nav items based on role

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

**better-auth** with database-backed sessions.
- Sign up creates Business if first user
- Login returns session with `user.businessId`, `user.role`, `user.name`
- Session is passed through `headers()` to every protected route
- Logout clears session cookie

---

## Database Indexes

### Key Indexes
- `User`: `email` (unique)
- `Business`: `slug` (unique)
- `Table`: `businessId`, `isActive`
- `Product`: `businessId`, `category`, `sortOrder`, `name`
- `Order`: 
  - `businessId`, `tableId`
  - Compound: `{ tableId: 1, status: 1 }` with `partialFilterExpression` for active orders
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

---

## Development Notes

### How to Add a New Feature

1. **Database**: Define model in `models/`
2. **Repository**: Create CRUD in `repositories/` if needed
3. **Service**: Add business logic in `services/`
4. **API**: Create route in `app/api/` (check auth, call service, return JSON)
5. **Page/Component**: Build UI in `app/dashboard/` or `components/`
6. **Tests**: None currently (manual QA)

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

**Last updated**: 2026-06-04  
**Status**: MVP complete with POS, loyalty, analytics, settings, and order history.
