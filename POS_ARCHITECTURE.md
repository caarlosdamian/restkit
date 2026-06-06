# POS System Architecture

## 🔐 Two Separate Authentication Systems

### Admin Dashboard (`/login`)
- **Login**: Email + Password
- **Access**: Full admin dashboard with sidebar
- **Features**: Menu management, staff management, analytics, settings
- **Users**: Owner, Admin, Staff (if they have email/password)

### POS System (`/pos`)
- **Login**: Restaurant Code + Employee Number
- **Access**: POS interface only (no sidebar, no admin features)
- **Features**: Take orders, manage tables, process payments, close session
- **Users**: All staff members in the restaurant

---

## 📱 POS Flow (Employee)

```
1. Employee goes to /pos (public page)
   ↓
2. Enters Restaurant Code (provided by manager)
   - Example: "rest-001"
   - Validated against Business.slug in database
   ↓
3. Enters Employee Number
   - Example: "001", "002", "003"
   - Validated against User.employeeNumber in that restaurant
   ↓
4. POS Employee Session created (stored in localStorage)
   {
     employeeId: "...",
     employeeName: "Juan",
     employeeNumber: "001",
     businessId: "...",
     role: "STAFF"
   }
   ↓
5. Redirects to /pos/dashboard
   ↓
6. Check POS Session (Caja)
   - If NO session open: Show "Caja cerrada" message
   - If YES session open: Show available tables
   ↓
7. Select table → Take orders → Process payment
   ↓
8. Click "Salir" to logout from POS
   - Clears localStorage
   - Returns to /pos login
```

---

## 📋 POS Manager Flow (Opening & Closing Shift)

```
MORNING:
1. Manager goes to /pos
2. Enters restaurant code + their employee number
3. Redirected to /pos/dashboard
4. Check POS Session:
   - If NO open session: Show POSSessionStart form
   - Manager enters opening balance (e.g., $100)
   - Session created with status "OPEN"
5. Now staff can log in and start working

EVENING:
1. Manager/Owner goes to /pos/dashboard
2. Sees "Cerrar caja" button
3. Enters closing balance (actual cash count)
4. System calculates variance:
   - Expected = opening + cash sales
   - Actual = closing balance
   - Variance = Actual - Expected
5. Shows cut report with reconciliation
6. Session closed with status "CLOSED"
```

---

## 🔑 Key Differences from Admin Dashboard

| Feature | Admin Dashboard | POS System |
|---------|-----------------|-----------|
| Login Method | Email + Password | Restaurant Code + Employee # |
| Access Control | Database (better-auth) | localStorage only |
| Sidebar | Yes | No |
| Admin Features | Full access | No access |
| Session Type | HTTP session cookie | localStorage token |
| Can Access Admin | Yes (if logged in) | No |
| Can Access POS | Yes (if has emp #) | Only this POS |

---

## 🛡️ Security Notes

1. **Isolation**: POS session is completely separate from admin session
   - Clearing browser cookies doesn't log out POS
   - Logging into admin doesn't auto-login POS
   - They use different storage mechanisms

2. **Employee Numbers are NOT Global**
   - Employee #001 can exist in Restaurant A AND Restaurant B
   - Both controlled by their respective `businessId`
   - Restaurant Code ensures you're in the right business

3. **No Cross-Restaurant Access**
   - Employee logged in to Restaurant A cannot access Restaurant B
   - Validated at API level: `{ businessId, employeeNumber }`

4. **No Sensitive Data in localStorage**
   - No passwords stored
   - No tokens that can be used for admin access
   - Only session metadata

---

## 📍 URL Structure

```
Admin System:
  /login                          → Admin login page
  /dashboard                      → Admin home
  /dashboard/pos                  → Table grid (old, for admin only)
  /dashboard/staff                → Staff management
  /dashboard/menu                 → Menu management
  /dashboard/settings             → Business settings

POS System (COMPLETELY SEPARATE):
  /pos                            → POS login page
  /pos/dashboard                  → Table grid (for employees)
  /pos/order/[tableId]            → OrderBuilder
  (No other pages accessible)
```

---

## 🔄 API Endpoints for POS

### Public (No Auth Required)
- `POST /api/pos/login` - Validate employee and get session

### Protected (Requires POS Session in localStorage)
- `GET /api/pos-session/current` - Get open session status
- `POST /api/pos-session/start` - Open session (manager only)
- `POST /api/pos-session/close` - Close session (manager only)
- `GET/POST /api/orders/*` - Order operations
- `GET /api/waiter/available-tables` - List tables

---

## 📝 Setup Instructions for Manager

1. **First Time Setup**
   - Manager logs into admin dashboard
   - Creates business with Name + Slug (REST-001, REST-002, etc.)
   - Creates staff members with Name + Employee Numbers (001, 002, 003, etc.)
   - Business slug becomes the Restaurant Code

2. **Daily Opening**
   - Manager goes to `/pos`
   - Enters Restaurant Code (e.g., REST-001)
   - Enters own Employee Number
   - Opens session with opening balance
   - Communicates code to staff via whatsapp/message

3. **Staff Login**
   - Staff goes to `/pos`
   - Enters Restaurant Code (from manager)
   - Enters their Employee Number
   - Works the shift
   - Can logout anytime with "Salir" button

4. **Daily Closing**
   - Manager opens `/pos/dashboard` again
   - Clicks "Cerrar caja"
   - Enters closing balance
   - Gets cut report with variance
   - Session is locked

---

## ✅ Implementation Checklist

- [x] Create `/pos` login page (public, no admin auth needed)
- [x] Create `/api/pos/login` endpoint
- [x] Create `/pos/dashboard` (table grid)
- [x] Create POS layout without sidebar
- [x] Add session check in POSPageWrapper
- [x] Add session check in OrderBuilder
- [x] Business model already has `slug` field
- [ ] Update seed to create proper business slugs
- [ ] Add logout button to POS interface
- [ ] Add session status display in POS
- [ ] Create order page at `/pos/order/[tableId]`
