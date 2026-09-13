# RestKit — Restaurant Management SaaS

**RestKit** is a comprehensive restaurant management system for the Mexican market, built with Next.js 16, MongoDB, TypeScript, and React 19. It started as a loyalty card system (Apple/Google Wallet) and has evolved into a full POS, analytics, and business management platform.

⚠️ **Every outward-facing URL comes from `appUrl()` in `lib/app-url.ts`** — the QR on a printed join poster, the barcode in a wallet pass, Apple's `webServiceURL`, Google's hero image, Stripe's return URLs, canonicals and the sitemap. It was `process.env.APP_URL || 'http://localhost:3000'` written out twelve times. Resolution order is `APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → localhost, so a missing env var lands on a real domain instead of printing `localhost:3000` onto a poster; the production domain beats the deployment URL because a pass outlives the preview build that issued it. A bare host or a trailing slash is normalised. **On Vercel an env var binds at build time — changing `APP_URL` does nothing until you redeploy**, and static output (sitemap, robots, `/lealtad/*` canonicals) bakes it in harder still.

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

## ⭐ Loyalty (POS-native) — read before touching stamps or cashback

The differentiator: **the stamp happens at cobro** — no scanner, no extra step, nothing for the cashier to remember. That is the reason to buy RestKit over a standalone loyalty app.

⚠️ **But it is not the only path, and must never be.** Earning at cobro only works for a business that moved its register to us. Making the loyalty programme depend on that made the product un-buyable for anyone who wants the cards and not the till — which is most of the market a standalone competitor sells to. **`/scan` is the fallback**, and the QR on the card is not decoration: it is how a business that kept its own register registers a visit at all. Any change that removes the QR, or that assumes an `Order` exists behind every accrual, breaks that whole segment.

### The ledger is the law
`models/Visit.ts` is an append-only ledger and the ONLY writer of `Customer.stats` is `services/loyalty.service.ts`. Never mutate `stats.currentVisits` or `stats.cashbackBalance` from a route or a page — go through the service so the history always explains the number.

### Domain rules live in one pure module
`lib/loyalty.ts` — no db, no Mongoose, just functions over values: `loyaltyConfig()`, `stampState()`, `accrualFor()`, `maxCashbackFor()`, `applyDelta()`. The service reads counters, asks this module what should happen, writes the result. Put new rules here, not in a route.

### Flow at the till
1. `components/pos/CustomerAttach.tsx` — 4+ digits of a phone hits `GET /api/pos/customers/lookup`, which returns **progress, not just a name** (the waiter mentioning "le falta 1 sello" is the point). 10 digits with no match offers inline enrolment.
2. `PaymentModal` sends `customerId` (+ optional `cashbackApplied` / `redeemReward`) with the PAID PATCH.
3. `PATCH /api/orders/[orderId]` redeems first, then accrues **after** the order is saved — a loyalty failure must never fail a payment that already went through.
4. The response carries `loyalty` including `cardUrl` + `qrDataUrl`; the QR prints on the ticket, which is how a walk-in enrolled at the register actually gets the pass.

### Invariants — do not break these
- **Counters floor at zero.** `applyDelta()` enforces it.
- **A delivered sellos reward is never clawed back.** `reverse()` refuses it.
- **Reversing a cashback redemption returns balance only** — never rewrites the order, its ticket, or that shift's cash-up.
- **A reversal is silent.** No `changeMessage` on a decrease: almost every reversal is an internal correction, and notifying raises a counter question nobody on shift can answer.
- **Cash is what reached the drawer.** See the POSSession note below.
- **Accrual is idempotent per order** via `uniq_accrual_per_order`; a retried PATCH is a no-op, not a second stamp.

### The card image
Apple has no stamps widget — a `storeCard` gets icon, logo and strip. `lib/strip-render.ts` renders `strip.png` per customer with sharp and re-issues on every update, which is what makes the card visibly fill up. Same renderer backs `GET /api/passes/preview`, so the dashboard preview is byte-identical to what ships. Icons come from `lib/stamp-icons.ts` (lucide paths, thickened for stamp size).

⚠️ **`sharp` is pinned to `0.34.4` — exact, not a caret range.** 0.35.x cannot resolve its `libvips` binary inside a Turbopack build on Vercel (`ERR_DLOPEN_FAILED: libvips-cpp.so`), and the failure is at **module load**, so it took down every route that imported the renderer before a line of their own ran: `/api/passes/preview` and `/api/passes/strip/[token]` answered 500, `/api/passes/apple/[customerId]` could not issue a pass, and `/api/passes/strip/<garbage>` returned 500 instead of 404 — which is how you tell this apart from a bad request. Locally everything worked, because the darwin binary loads fine. Do not float the range back up without deploying and re-checking those routes.

Two things make that class of failure legible next time. `renderStrip` **loads sharp on demand, never at module scope** (`loadSharp()`, throwing `ImageRenderUnavailableError`), so a broken binding can no longer take a route's auth and 404 handling with it. And both image routes catch it: they return **503 with an `X-Render-Error` header** instead of Next's HTML error page, which — served into an `<img>` — showed the owner a broken-image icon and nothing else. `tests/unit/loyalty.test.ts` now has one test that actually calls `renderStrip` and asserts PNG bytes; every other strip test reads the SVG string, so all 405 of them passed against a sharp that could not load.

⚠️ **A serverless runtime ships no fonts — not even a generic `sans-serif`.** With sharp fixed, the card came back with every word drawn as a `.notdef` box: the stamps were perfect (they're paths) and the copy was tofu. So **Geist Medium + Bold are vendored under `assets/fonts/`** (with their OFL licence), `fonts.conf` beside them points fontconfig at its own directory (`prefix="relative"`, cache in `/tmp` — the rest of the filesystem is read-only), and `configureCardFonts()` sets `FONTCONFIG_PATH` **before sharp is imported**, because libvips reads the environment once when it initialises. Nothing imports the font files, so `outputFileTracingIncludes` in `next.config.ts` is what puts them in the function bundle — verify with `grep assets/fonts .next/server/app/api/passes/*/route.js.nft.json` after a build.

⚠️ **librsvg has no font fallback chain: anything Geist does not map is a box.** `esc()` therefore strips emoji, dingbats and `★` from every string it draws — the reward description and unit names are owner-typed, and "🎉 Café gratis" would otherwise ship to every customer's wallet with a box in front of it. Geist covers all of Latin-1 plus the typographic marks (`— … « » º ª ™ →`), which is everything a Mexican business types; the caption lost its leading `★` for the same reason. Coverage was checked against the font's **cmap**, not by eye — **macOS renders both emoji and ★ perfectly via CoreText, so a developer machine cannot see this bug at all.** To check the real thing: `docker run --rm --platform linux/amd64 -v $PWD/assets/fonts:/fonts:ro node:22-slim` renders a fontless Linux box exactly like Vercel's.

⚠️ **The strip canvas is 375×144, not the 375×123 in Apple's table.** Measured off a real pass on a 1242×2688 iPhone: Wallet allotted the strip **145pt** on a 380pt card. The documented 123 is the box for a strip with `primaryFields` drawn over it, and this pass ships none on purpose. Wallet scales a strip to **fill**, so the old 3.05:1 image was blown up 17% inside a 2.60:1 hole and lost **29pt off each edge** — on a 10-stamp card the fifth column and the last word of the caption were gone on the customer's phone, while every preview on a desktop looked perfect. So `STRIP_H` is the canvas and **`STRIP_CONTENT_H` (123) is the band every element is laid out in**, centred, with only ground or photo in the margin. Never lay out against `STRIP_H`: the margin is bleed, and each client crops it differently — Wallet shows all 144, Apple's documented box crops to 123, Google's 1032×336 hero crops to ~122. A test asserts the margin is a single flat colour, which is what makes those crops safe.

⚠️ **The strip photo is fetched once per process, not once per render** (`fetchImage` in `lib/strip-render.ts`). In production an uploaded photo is a blob URL, so `readAsset` was pulling the whole file over the network on every render — every keystroke in the wallet form, and three more times for the @1x/@2x/@3x variants of a single pass. A fetch that failed returned `null`, and the strip then rendered **without the photo at HTTP 200**: no error, no broken image, the owner just watched their picture disappear while editing an unrelated field. The cache is safe because an asset URL is immutable (`putAsset` names files `<timestamp>-<random>.<ext>` and never rewrites one, so a replaced photo gets a NEW url); concurrent callers are collapsed onto one fetch, a failure is retried once, and a genuine miss still draws the card — a missing picture must never take the customer's stamps with it.

⚠️ **The photo an owner uploads is a phone photo — 3814×4767, 2.5 MB — and the strip it feeds is 1125×369 at @3x.** Nothing downscaled it, so every render re-fetched and re-decoded eighteen megapixels: ~900 ms on a Mac off local disk, seconds on Vercel across a blob fetch, on *every* edit in the wallet form and on every pass re-issue. `lib/image-normalize.ts` caps an upload at 1600px before it reaches storage (format preserved — a PNG logo keeps its alpha, an SVG is untouched, and the original is kept if the re-encode comes out bigger). The live preview also debounces (dragging the stamp slider queued one server render per step) and **`StripImage` in `PassPreview.tsx` dims and spins while the new strip is in flight** — a plain `<img>` keeps painting the previous strip, so moving off a placement Apple cannot show and back again looked like the photo never returned.

⚠️ **The geofence is not a notification, and that is why it cannot be dismissed.** `locations[]` produces a lock-screen pass **suggestion** — a live state iOS maintains while it believes the pass is useful where you are, cleared when you leave. Swiping does not end the condition that put it there, so an owner testing inside their own restaurant sees it permanently; that is correct behaviour, not a bug. Two things are ours: `relevantText` is plain text (Apple substitutes nothing into it, unlike `changeMessage`), so `{progreso}` is filled in by `fillTokens()` on our side — one token for the owner to learn, not two rules; and `maxDistance` is the only lever over how insistent it feels, since leaving it unset hands iOS a ~100m bubble, half a street for a café on a corner. `passLocations()` in `lib/apple-pass.ts` is extracted precisely so this is testable without signing certs, and ⚠️ **an absent radius is not `0`** — a `maxDistance` of zero is a geofence nothing can enter. Google's `locations[]` takes neither field.

**Three orthogonal design axes**, all on `settings.loyalty.card`:
- `ground`: `light` (white card) | `brand` (painted in the business colour) | `dark` (a deep version of that hue, never generic black). A `stripImage` photo overrides all three.
- `stampStyle`: `filled` (default — a solid badge with the icon **knocked out in the ground colour**; this is what reads across a counter) | `outline` (ring around the glyph) | `plain` (bare glyph, the original).
- `photoPlacement` for `stripImage`: `background` (behind the stamps) | `side` (beside them, sharing the band) | `footer` (a band of its own below the card).

⚠️ **`footer` does not exist on Apple.** A `storeCard` gets exactly one image slot — `strip.png`. `footer.png` is boardingPass-only and `background.png` is eventTicket-only, so there is no way to put a photo under the fields on an iPhone. `side` is how a photo and the stamps share an Apple card. Google renders `footer` as an `imageModulesData` band and the web card as a real band; the wallet form warns before an owner picks something one of their two platforms silently drops. The photo is **never shown twice**: under `background`/`side` it is already composited into the hero, so no image module is emitted.

**Every colour on the card is derived from one value.** `lib/card-colors.ts` holds that math with no rendering attached — `groundFor()` resolves the ground, `readableInk()` shifts the brand colour until it clears 3:1 against it. It is a separate module from the renderer **because the renderer imports sharp and cannot be bundled into a browser component**: the wallet form's style picker and `components/loyalty/LoyaltyCard.tsx` import the same functions, so the chip an owner clicks is the treatment they get. Never hardcode a card colour anywhere else — a ground picked for one reason and ink picked for another is how white stamps ended up on a white strip.

A low-saturation brand still falls back to outlined pending stamps under `plain` — grey on grey is no difference at all. Under `filled`/`outline` the disc already does that job.

### What the card SAYS — one model, two wallets
`lib/card-layout.ts` decides the card's content once; `lib/apple-pass.ts` and `lib/google-wallet.ts` only translate it. Writing the card twice is how the platforms silently drifted apart. The catalogue of available fields and their slot limits is in `lib/card-fields.ts` (import-free, so `loyalty.ts` and `card-layout.ts` can both use it without a cycle).

**Three platform constraints are encoded there, not in the builders:**
- ⚠️ **A `storeCard`'s `primaryFields` are drawn ON TOP of `strip.png`.** The pass used to ship both, so Wallet reprinted "3 de 10" across the customer's own stamps. `primary` is now empty whenever a strip is present, and a test holds that.
- **A stacked pass in Wallet shows only the logo and the header fields**, which makes the header the most valuable slot, not an afterthought.
- **The push message is owner-written** (`settings.loyalty.notifications`, edited in `/dashboard/settings/wallet`). Three of them, because the same `progress` field carries very different news: another stamp, a reward unlocked, a balance moved — and the pass is rebuilt on every update, so `resolveField` picks from the state the customer has just landed in. The owner types **`{progreso}`**, not `%@`: `changeMessageFrom()` in `lib/card-layout.ts` does the conversion, escapes a literal `%` (the string is a format string — `50% de` is a conversion specifier), keeps only the first placeholder (Apple fills one and prints the rest raw), caps at 120 chars, and ⚠️ **never returns empty** — a blank `changeMessage` updates the pass in total silence, which is indistinguishable from a broken push, so an owner clearing the box gets the default back. The form previews the substituted sentence, because nobody can judge "Llevas {progreso}" until they see "Llevas 3 de 10".
- **Apple notifies on push only when a field carrying `changeMessage` changes value.** So `progress` must exist somewhere on every card — `buildCardLayout` forces it back into the header if the owner empties every slot. Remove that and stamps land in silence.

The **strip caption never repeats the count** (both wallets print it in a field beside the strip); it names the distance to the reward instead — `Te faltan 6 visitas para tu premio`.

Owners pick slot contents in `/dashboard/settings/wallet`; `components/settings/PassPreview.tsx` renders an Apple and a Google panel from **the same `buildCardLayout`**, so what they arrange is what ships. Defaults follow the mechanic (`defaultCardFields`) — a cashback card spends its second slot on the threshold, because the strip already prints the rate.

### Google is where real layout control exists
Apple gives named slots on a fixed template; Google's `classTemplateInfo` lets us dictate rows outright, and `hexBackgroundColor` paints the card. Both are now set from the same resolved ground as the strip.

**`heroImage` carries the stamp card onto Android** via `GET /api/passes/strip/[token]` (public — the `publicToken` is the credential; Google's fetchers carry no session). Before this, Android got the text "4 / 10" and nothing else. **The URL is versioned by the counter** (`?v=<stamps>`): Google caches what it fetches, so a fixed URL would freeze the card at the count it had when saved. `updateGoogleWalletObject` re-sends the hero for the same reason.

⚠️ Google's QR used to carry the raw customer `ObjectId`. Apple and `/c/` were fixed for that; Google was not. It now carries the same `/c/<publicToken>` URL.

`components/loyalty/LoyaltyCard.tsx` draws the same card as HTML for `/c/[token]`, where a customer lands from the ticket QR. It deliberately is **not** the strip PNG (sized for Apple's 375×123 box; a blurry letterbox on a phone).

**It is ONE template with optional blocks, not a layout per mechanic**: brand band › title › figures (stamps **or** balance) › holder › code › photo. A competitor's cashback card looks unlike their stamp card only because the stamps block is absent and the name and code grow into the space — nothing about the frame changes. Two hard-coded layouts would drift apart the first time either changed.

Two rules keep every fact on the card exactly once, and both are tested:
- **The name is in the band OR the title, never both.** With a logo the band is a letterhead (the mark alone) and the title carries the name; without one the band carries it and the title is dropped. Competitors print it in both places an inch apart — a flaw to skip, not a detail to copy.
- **Cashback has no second column beside the holder.** "5% de cada compra" under "DEVUELVE 5%" is the same fact twice. Stamps carry no such figure, so the reward goes there instead.

The card carries a QR (`qrDataUrl`, generated by the page since the component is sync), encoding the same `/c/<publicToken>` the wallet pass has always had in its barcode. **It is load-bearing, not decorative** — see the scanning section: it is the only way a business that kept its own register can register a visit.

### Self-enrolment — the customer's own path
`/j/[slug]` is a **public, unauthenticated** page behind a QR the business prints for its tables (`components/loyalty/JoinPoster.tsx` on `/dashboard/loyalty` renders and prints it). Customer scans → types a phone → lands on `/c/<token>` with the wallet buttons. Before this, the programme only grew while somebody remembered to ask at the counter.

- ⚠️ **A PHONE NUMBER IS NOT A SECRET.** A phone that already has a card **cannot** be claimed here — `409 ALREADY_ENROLLED`, and the response carries no token, no name, no balance. Handing it back would give anyone who types a stranger's number their balance, their pending rewards, and a pass they could present at the counter. They ask at the till instead, where the ticket already prints their card's QR. **Lifting this needs an OTP, not a looser rule.**
- Rate limited per client IP (`lib/throttle.ts`) — public and unauthenticated, so without it one script fills the customer list with junk. Every attempt counts, not just failures: the cap is on cards minted, not guesses.
- **No welcome stamp.** The first one comes from a real purchase, so the counter never has to explain a stamp nobody earned. (`stats` start at zero; a welcome bonus would be a settings change, not a code change.)
- Behind the subscription gate (402), like the register and the scanner.
- The route issues `publicToken` **and** `externalIds.appleAuthToken` — without the latter the pass would be issued permanently un-updatable.

### Scanning — the no-POS path
`/scan` (`app/scan/page.tsx` + `components/loyalty/ScanClient.tsx`) reads the customer's card and registers loyalty with **no order behind it**. Deliberately **not** under `/pos`: a business on its own register must never open a till screen — or a cash session — to stamp a card. Any signed-in role can scan; that is what the person behind the counter is there to do.

- `GET/POST /api/loyalty/scan/[token]` — the token identifies the **customer**; `businessId` always comes from `getBusinessContext()`. A token belonging to another business **404s, never 403s** — confirming "this code is real but not yours" is a lookup service for anyone holding a stolen ticket.
- Decoding is client-side. `BarcodeDetector` where it exists, **jsQR everywhere else** — Safari on iOS has no `BarcodeDetector`, and without the fallback the scanner would work on Android and silently not on iPhone.
- ⚠️ **`SCAN_COOLDOWN_MS` (3 min) is what stops a double scan becoming a double stamp.** There is no `orderId`, so `uniq_accrual_per_order` does not apply and `sellos.maxPerDay` is off by default. Staff can override with `force: true` after a confirm.
- **Cashback scanning requires an amount** — a percentage of nothing is nothing, so the cashier types the ticket total. Returns `400 AMOUNT_REQUIRED` without it.
- Accruals go through `loyaltyService` with `manual: true`, so a scanned visit is an ordinary ledger entry and reverses exactly like one from the till.
- **Writing is gated by the subscription (402), reading is not.** Registering a visit is selling, so it sits behind the same money gate as opening the register — otherwise an expired business stamps cards forever. `GET` stays open: a cashier mid-transaction should see who they are serving and why it failed, not a blank screen.

`lib/customer-summary.ts` is the one shape the till lookup and the scanner both return — two ways of identifying the same person, and two shapes would drift the first time either grew a field.

### Key files
`lib/loyalty.ts`, `lib/card-colors.ts`, `lib/customer-summary.ts`, `lib/card-fields.ts`, `lib/card-layout.ts`, `lib/strip-render.ts`, `lib/stamp-icons.ts`, `components/loyalty/LoyaltyCard.tsx`, `components/settings/PassPreview.tsx`, `lib/session-totals.ts`, `lib/qr.ts`, `services/loyalty.service.ts`, `components/pos/CustomerAttach.tsx`, `components/settings/WalletForm.tsx`, `components/dashboard/CustomerHistory.tsx`, `components/loyalty/ScanClient.tsx`, `components/loyalty/VerticalSampleCard.tsx`, `components/landing/LoyaltyCardCarousel.tsx`.

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
- `name`, `slug`, `branding` (logo, primaryColor)
- **`settings.loyalty`** — the whole loyalty programme in one namespaced object: `mechanic` (`sellos` | `cashback`, exactly one active), `sellos` (`required`, `rewardDescription`, `unitSingular`, `unitPlural`, optional `minTicket`/`maxPerDay` guards — both off by default), `cashback` (`rate`, `threshold`, optional `expiryDays` — unset, balance never expires), `card` (`stampIcon`, `customIconUrl`, `stripImage`, `bgColor`), optional `location` (geofence). Read it through `loyaltyConfig()` in `lib/loyalty.ts`, never off the document directly.
- **ticket** (NEW): `fiscalName`, `rfc`, `phone`, `address`, `fiscalAddress`, `website`, `footerMessage`
- **subscription** (NEW): `plan` (lite/basic/pro), `billingPeriod` (monthly/annual), `status` (trialing/active/past_due/canceled), `trialEndsAt`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`. New businesses start `trialing` for 14 days with **no card** (set in `businessService`). Gate logic in `lib/subscription.ts` (`evaluateSubscription`) is conservative — a **missing** subscription is grandfathered (never gated), so legacy/seed businesses and tests aren't locked out. See Billing section.
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
- Sales rollups: `totalSales`, `totalOrders`, `cashSales`, `cardSales`, `transferSales`, `cashbackRedeemed`, `expectedCash`, `actualCash`, `variance`
- ⚠️ **`cashSales` is money that reached the drawer, not gross.** `lib/session-totals.ts` subtracts `Order.cashbackApplied`; counting the gross made every cashback redemption read as a shortfall at cash-up. Both `/current` and `/close` go through `sessionTotals()` so they can't drift.
- Opened/closed by a manager from `/pos/dashboard`. Sales computed from PAID orders since `startedAt`.

### **Customer**
Loyalty program member.
- `businessId`, `name`, `email`, `phone`
- `stats` (`totalVisits`, `currentVisits`, `cashbackBalance`). `currentVisits` may exceed the required count — `stampState()` derives pending rewards and displayed progress from that one number, so a customer who keeps buying before claiming never loses a stamp.
- `publicToken` — 20 random bytes, the key for `/c/[token]`. Kept separate from `appleAuthToken`, which is a PassKit credential and must never travel in a URL.
- `externalIds` (appleAuthToken, applePass, googlePass)
- ⚠️ The `{businessId, email}` / `{businessId, phone}` uniques are **partial** (`$type: 'string'`), not `sparse`: a compound sparse index indexes any document holding at least ONE of its fields, so every email-less customer landed on `(businessId, null)` and the second phone-only walk-in collided with the first.
- ⚠️⚠️ **Fixing that in the schema does NOT fix a database.** Mongoose cannot alter an existing index — it re-issues the create, Mongo answers `IndexOptionsConflict`, and the old `sparse` index stays for ever with nothing surfacing the failure. Production was in exactly that state long after the schema said otherwise: only the FIRST person could ever self-enrol at a business, and everyone after them was told *"ya tienes una tarjeta con este teléfono"* about a number nobody had used. Tests all passed, because a fresh test database gets the correct indexes. Run **`npm run fix:indexes`** (dry run; `-- --apply` to commit) against any database that predates this — it checks every declared unique, per index, and skips only the ones whose data would make the constraint unbuildable (it found `orders.uniq_active_order_per_table` missing too, with four tables already holding two live orders each) — and note that `POST /api/loyalty/join/[slug]` now checks WHICH index collided — only a `phone` duplicate is `ALREADY_ENROLLED`, anything else is `ENROLMENT_FAILED` (500).

### **Visit** — the loyalty ledger
Every change to `Customer.stats` is an entry here plus the counter it implies. **Nothing else writes those counters.**
- `customerId`, `businessId`, `employeeId`, `type`, `mechanic`, `delta`, `orderId`, `orderTotal`, `tableName`, `reversesVisitId`
- `type`: `ACCRUAL` (earned) | `REWARD_REDEMPTION` (spent) | `REVERSAL` (compensates an earlier entry)
- `delta` is signed — stamps for `sellos`, MXN for `cashback`
- `uniq_accrual_per_order`: unique partial on `{orderId, mechanic}` for ACCRUALs, so a retried `PATCH /api/orders/[id]` is a no-op instead of a second stamp
- **Entries are never deleted.** "Quitar una compra" writes a compensating REVERSAL beside the original.

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

### Loyalty — self-enrolment (public)
- `POST /api/loyalty/join/[slug]` — **no auth**. `{ phone, name? }` → `{ token }`. **409 `ALREADY_ENROLLED`** for a phone that already has a card (no token returned — see the note above), **400 `INVALID_PHONE`**, **402** for a lapsed subscription, **429** when the per-IP limit trips.

### Loyalty — scanning (no POS required)
- `GET /api/loyalty/scan/[token]` — resolve a scanned card to the customer + progress, scoped to the session's business. 404 for a token from another business.
- `POST /api/loyalty/scan/[token]` — `{ action: 'accrue' | 'redeemReward' | 'redeemCashback', amount?, force? }`. **409 `RECENTLY_STAMPED`** inside the cooldown; **400 `AMOUNT_REQUIRED`** for cashback with no amount.

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

### Billing — Stripe subscriptions (NEW)
- `POST /api/billing/checkout` (OWNER) — subscription Checkout session for `{ plan, period }`; reuses/creates the Stripe customer, returns `{ url }`.
- `POST /api/billing/portal` (OWNER) — Stripe Billing Portal session, returns `{ url }`.
- `POST /api/stripe/webhook` — raw-body, `STRIPE_WEBHOOK_SECRET`-verified; `billingService.applyStripeEvent` maps `customer.subscription.*` → `Business.subscription`.
- **Plan catalog** = single source of truth in `lib/plans.ts` (pure data, no Stripe/env — shared by client pricing UI + server). Three tiers differing mainly by **capacity**, not feature locks: **Lite** ($249 — full POS, 6 tables, 2 seats), **Básico** ($599 — unlimited tables, 10 seats), **Profesional** ($1299 — 50 seats + inventory, KDS, reports). ⚠️ **A plan card may only advertise something that ships.** Básico used to list *Facturación CFDI* and Profesional *Delivery integrado* — both sit in the dashboard sidebar's "Próximamente" section and neither exists, so the pricing page was selling two features the product cannot deliver, and "25+ reportes" against the three reports that exist. `tests/unit/plans.test.ts` now fails on a `features` bullet containing cfdi/factura/timbrado/sat/delivery/kiosco. ⚠️ **No plan says "usuarios ilimitados" any more either** — a seat is a POS login and an unbounded count is unbounded cost at a flat price, and it cannot be walked back once sold; Profesional is capped at 50 (`PLAN_LIMITS`), high enough that a single location never feels it. Since the top plan now has a ceiling, `requireCapacity` stops telling a Profesional customer to "mejora de plan" — there isn't one — and says to contact us instead (`TOP_PLAN`). `lib/stripe.ts` = guarded client (`requireStripe()`) + `priceIdFor(plan, period)` (reads `STRIPE_PRICE_*` env). `lib/subscription.ts` = `evaluateSubscription` gate (trial/access). `lib/plans.ts`'s `planAllows()` + `lib/feature-gate.ts`'s `requireFeature()` = feature gate; `PLAN_LIMITS` + `requireCapacity()` = capacity gate. **Both only bite a *purchased* plan, never the free trial.**
- ⚠️ **`STRIPE_PRICE_*` wants a PRICE id (`price_…`), never a product id (`prod_…`).** The dashboard shows the product id first and a product carries several prices — monthly and annual are two different `price_` ids on the same product, which is why there are six variables and not three. A `prod_` id is a non-empty string, so it used to pass the truthiness check and fail inside the Stripe SDK as an unhandled `No such price`: a blank failed checkout at the one moment the product has to work. `requirePriceId()` in `lib/stripe.ts` now throws `StripePriceMisconfiguredError` naming the variable, and the route returns it as the response body. **All three plans need a pair** — `lite` is as sellable as `pro`, and it is the tier the pricing page pushes hardest.
- ⚠️ **POS is NOT gated by tier.** It was, and that locked POS-native loyalty — the whole differentiator against loyalia.app — out of Lite, the only tier that competes on price. Every plan gets the register; Lite is bounded by 6 tables / 2 seats instead. Enforced at `POST /api/tables` and `POST /api/staff`, which return **403 `PLAN_LIMIT_REACHED`** with the ceiling and an upgrade route (the forms render that as an amber "Ver planes" prompt, not a red error).
- **Trial-without-card**: signup starts a 14-day `trialing`; trial expiry is time-based (no Stripe involvement until they pay). Gate: dashboard layout walls expired businesses (except `/dashboard/billing`) via the `x-pathname` header set in `proxy.ts`; `POST /api/pos-session/start` returns **402** when expired (can't open the register). The app is fully usable during the trial with **no Stripe config**; checkout just 500s with a clear "price not configured" until `STRIPE_PRICE_*` are set.

### Auth — sign-up & verification
- `POST /api/auth/register` — **the only way an account is created.** `{ name, email, password, businessName, plan?, period? }`. Creates the user via `auth.api.signUpEmail()`, creates its Business (trial-without-card), and better-auth mails the confirmation link. **409 `EMAIL_TAKEN`** for an address that already has an account, **400** for a bad field, **429 `RATE_LIMITED`** (5/hour/IP).
- `GET /api/auth/verify-email?token=…&callbackURL=…` — better-auth. Confirms the address, **creates a session** (`autoSignInAfterVerification`) and redirects to `/dashboard?correo=verificado`.
- `POST /api/auth/send-verification-email` — better-auth. Resends the link; wired to "envíalo de nuevo" on `/registro` and `/login`.
- ⚠️ **`POST /api/business` was DELETED.** It took `ownerId` from the request body with **no auth at all**, so anyone could mint a business for any user id. It had exactly one caller — the registration page — and that logic now lives server-side in `/api/auth/register`.

### Auth — password reset (public)
- `POST /api/auth/request-password-reset` — better-auth. `{ email, redirectTo: '/restablecer' }`. **Always 200**, whether or not the address has an account (see the Email section). Rate-limited by better-auth in production.
- `GET /api/auth/reset-password/:token?callbackURL=…` — validates the token and redirects to `/restablecer?token=…`, or `?error=INVALID_TOKEN`.
- `POST /api/auth/reset-password` — `{ newPassword, token }`. Single-use token, 1-hour TTL, `MIN_PASSWORD_LENGTH` enforced, **all sessions revoked on success**.

### Auth — change of email (session required)
- `POST /api/auth/change-email` — better-auth. `{ newEmail, callbackURL }`. **Always 200**, including for an address that already has an account (no mail is sent in that case — see the Email section). Nothing is written until confirmed.
- `GET /api/auth/verify-email?token=…&callbackURL=…` — applies the change, marks the address verified, refreshes the session cookie, and redirects to `callbackURL` (`/dashboard/settings?correo=confirmado`), or appends `&error=TOKEN_EXPIRED|INVALID_TOKEN|INVALID_USER|USER_NOT_FOUND`.

### Settings
- `GET /api/settings` — Fetch business settings
- `PATCH /api/settings` — Update business settings (OWNER/ADMIN)
  - Accepts full Business object: name, branding, settings, ticket

### Apple Wallet
- `GET /api/passes/apple/[customerId]` — Download .pkpass file
- `GET /api/passes/strip/[token]` — the customer's stamp card as a public PNG. Unauthenticated by design: Google fetches it for `heroImage` and carries no session; the `publicToken` is the credential.
- `POST /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` — Register device for push
- `GET /api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]` — Fetch updated pass (for pushes)
- `POST /api/wallet/apple/v1/log` — Log Apple errors

### Google Wallet
- `GET /api/passes/google/[customerId]` — Generate JWT → redirect to Google Wallet save URL

---

## Email & the forgotten-password flow

`lib/email.ts` is the only way anything leaves this app by mail. One function, two providers, picked by what is configured: **Resend** when `RESEND_API_KEY` is set (free tier: 3,000/month, 100/day — called over plain `fetch`, no SDK), and **the log** otherwise, which prints the whole message including the reset link so `npm run dev` can run the flow with no account, no domain and no key.

⚠️ **`sendEmail` never throws.** Every caller sits inside an auth flow. A raised error would turn a password reset into a 500 — and a 500 that only happens for addresses that *do* have an account is an enumeration oracle. Failures are logged and returned in the result; they are never raised. The corollary is that **a misconfigured provider is invisible from the browser**: `RESEND_API_KEY` missing in production logs an error naming the variable, because nothing on screen can say so.

⚠️ **The From address drops `www.`** — mail is authenticated (SPF/DKIM) against the registrable domain, so `no-reply@www.restaurantkit.app` is a different, unverified sender. Defaults to `no-reply@<appUrl() host>`; `EMAIL_FROM` overrides.

`lib/email-templates.ts` holds the messages as data, apart from the transport, so wording is testable without a key or a network — and so the html and text parts cannot drift into saying different things. House rules: inline styles and table layout (Gmail strips `<style>` and `<svg>`, Outlook ignores `flex`), **no external assets** (a blocked image is worse than a wordmark set in type), **never a token in a subject line** (subjects render on lock screens), and escape everything interpolated (`user.name` is typed by the user).

### The flow
`/recuperar` (ask) → email → `/api/auth/reset-password/:token` (better-auth checks the token) → `/restablecer?token=…` (choose) → `/login`.

That middle hop is kept deliberately rather than linking straight at our page: better-auth validates **before** anyone types, so an expired link lands on `?error=INVALID_TOKEN` and its own screen instead of failing after a password has been chosen and confirmed.

⚠️ **The link's origin is `appUrl()`, not better-auth's.** better-auth assembles it from the origin *and base path* it infers from the incoming request, and infers **neither** when there is no request — a server-side call produced a bare `/reset-password/<token>`, which is a dead link in an inbox. Where inference does work it would just as happily mint a link on a preview deployment that expires next week. So `lib/auth.ts` rebuilds the link from `appUrl()` + `AUTH_BASE_PATH`, carrying over only the `callbackURL`. `AUTH_BASE_PATH` is hardcoded (`/api/auth`, i.e. where `app/api/auth/[...all]/route.ts` sits), which asserting the *shape* of the URL cannot protect — so `tests/integration/password-reset.test.ts` **feeds the emailed link back through `auth.handler` and checks it redirects to `/restablecer` with a token.**

⚠️ **`/recuperar` renders one success state, always.** better-auth answers identically for an unknown address — it even burns the same time generating a throwaway token so the *duration* doesn't give it away. A screen that rendered "no encontramos esa cuenta" would undo that and hand anyone a free tool for testing which emails are RestKit customers. An error there means the **request** failed (offline, 429), never that the account doesn't exist.

⚠️ **`revokeSessionsOnPasswordReset` is ON, and that signs the POS terminal out.** Real cost — the terminal is signed in as the manager and may be mid-shift. Kept because "I need to reset my password" is exactly the moment the account may already be in someone else's hands, and a reset that leaves the attacker's session alive resets nothing. The email and the confirmation screen both warn before it happens.

### Opening an account
`/registro` → `POST /api/auth/register` → confirmation mail → `/api/auth/verify-email` → `/dashboard`.

⚠️ **Sign-in is refused until the address is confirmed** (`requireEmailVerification`), for the dashboard and the POS terminal alike — 403 `EMAIL_NOT_VERIFIED`, which `/login` renders as an amber "falta confirmar tu correo" with a resend button rather than a red "wrong password" for a password that was right.

⚠️ **Turning that flag on changed two things about sign-up that are not obvious from the flag.**
1. **It returns no session.** Anything that ran after sign-up assuming one is broken.
2. ⚠️ **A sign-up with an address that already exists returns 200 and a SYNTHETIC user** — a plausible object whose id is in no collection (`shouldReturnGenericDuplicateResponse` in better-auth's sign-up route) so that sign-up cannot be used to test which addresses are customers. **The old flow handed that id straight to the unauthenticated `POST /api/business`, so every repeat sign-up minted a business owned by nobody**, on a 14-day trial, counted in every total. Registration is therefore a server route that reads the user back out of the database and never trusts the returned id. `tests/integration/register-api.test.ts` holds exactly this: a `signUpEmail` that reports success for a row that does not exist must create no business.

**A duplicate address is answered plainly** ("ya existe una cuenta con ese correo"), the way every other product does it — which does confirm an address is registered. That is a deliberate split from `/recuperar` and `POST /api/loyalty/join/[slug]`, which refuse to: those can be pointed at a stranger's address, whereas a sign-up form has to tell the person in front of it why it will not proceed.

⚠️ **`npm run verify:backfill` must run against any database that predates this** (`-- --apply` to commit). Nothing verified an address before, so every existing account has `emailVerified: false` and would be locked out the moment the flag ships — the owner, the managers, and the terminal mid-shift. `e2e/seed.ts` seeds `emailVerified: true` for the same reason.

⚠️ **The confirmation link is a credential.** `/verify-email` creates a session, so opening the mail signs you in — which is what makes it work from a phone, and why the TTL is an hour and the copy says not to forward it. Only the FIRST open is given a session: a reused link still redirects, but hands out nothing. A test holds that, because "it starts erroring" is the obvious thing to assert and is not what happens.

### Changing the account's email
`/dashboard/settings` → `components/settings/EmailForm.tsx` → better-auth's `POST /change-email`. Enabled by `user.changeEmail.enabled` in `lib/auth.ts`; the mail is sent from **`emailVerification.sendVerificationEmail`**, not from a `sendChangeEmailVerification` hook — that name is in better-auth's published docs but **does not exist in the installed 1.6.14**, which routes both flows through the one generic hook. Check `node_modules`, not the docs site, before adding options here.

⚠️ **Nothing is written until the new address is confirmed.** `updateEmailWithoutVerification` is deliberately left OFF: turning it on would let anyone holding a stolen session move the account to an address they control in one request, with no proof they can read the address they are moving TO — session theft upgraded to account takeover. (Sign-up verification does not weaken this: reading the address the account was opened with says nothing about reading the next one.) With it off, better-auth mails the **new** address and only swaps the email when that link is opened. `tests/integration/change-email.test.ts` asserts the old address still signs in, and the new one does not, *before* the link is opened.

⚠️ **The confirmation link is a credential, not just a confirmation.** better-auth's `/verify-email` **creates a session** when the browser opening it has none — which is what makes the flow work from a phone, and what makes the mail worth protecting. Hence the 1-hour TTL and the warning in the copy.

⚠️ **An address that already has an account gets silence, not an error.** better-auth answers `{ status: true }` and sends nothing, so the form cannot be used to test which addresses are RestKit customers — the same reasoning that gives `/recuperar` one success screen. The form must therefore render one success state; a "ya está en uso" message would hand the oracle straight back.

⚠️ **The link's origin is `appUrl()`**, rebuilt exactly as `sendResetPassword` does and for the same reason. `sendVerificationEmail` is handed the user with the **new** address already substituted and never the old one, so `peekVerificationToken()` decodes the (unverified — we minted it microseconds ago) JWT to recover both for the copy: naming the outgoing address is what lets a reader tell a change they asked for from one somebody else started on their account.

The email is also the **POS terminal login**, so a confirmed change moves the terminal's sign-in too; the mail and the form both say so. Unlike a password reset this does **not** revoke sessions — the address moved, the credential did not.

`lib/password-policy.ts` holds `MIN_PASSWORD_LENGTH` alone and imports nothing — the better-auth config, the settings form and the public reset page all read it, and `lib/auth.ts` opens a MongoClient at module scope, so a client component importing the constant from there would drag the driver into the browser bundle.

`tests/integration/password-reset.test.ts` runs the whole thing against the **real** better-auth instance (it `vi.doUnmock`s the global session stub from `tests/setup.ts`): link opens, token is single-use, short passwords refused, unknown address sends nothing, live session dies.

---

## Marketing / SEO pages

`/lealtad` (hub) and `/lealtad/[vertical]` — one landing page per trade (restaurantes, cafeterías, barberías, spas, gimnasios…), the content in `lib/verticals.ts`.

- **`components/loyalty/VerticalSampleCard.tsx` is the one place a sample card is built**, and both the vertical hero and the home-page carousel render it. It lived inside the vertical page until the home page needed the same card; two copies of that config would have drifted the first time either changed.
- **The home page opens with a carousel of all thirteen cards** (`components/landing/LoyaltyCardCarousel.tsx`), directly under the hero — loyalty at the register is the reason to buy RestKit over a standalone loyalty app, and it used to be the fourth section down. The cards are rendered **on the server** and passed in as `ReactNode`, so a client component shows the real card without pulling the loyalty config, the colour maths and the icon catalogue into the browser bundle.
  - "Infinite" is a belt: the catalogue is laid down three times and the scroll offset is moved back exactly one copy whenever it leaves the middle one. Because the copies are identical the jump is invisible. ⚠️ It runs **only once scrolling has settled** — assigning `scrollLeft` mid-glide cancels the smooth scroll and shows up as a stutter every time the belt comes round.
  - Motion is native `scroll-snap`, not a transform, so touch and trackpad work for free. Autoplay pauses on hover, on focus, off-screen and on a hidden tab, **stops for good once the reader touches a control**, and never starts at all under `prefers-reduced-motion`. The visible pause button is WCAG 2.2.2, which a hover pause alone does not satisfy.
  - ⚠️ **Every sample card uses `photoPlacement: 'background'` or `'side'`, never `'footer'`.** The section is headed "Tarjetas de lealtad en Apple y Google Wallet" and `footer` is the one placement Apple cannot render. The same reasoning retired the caption "Así se ve en Apple Wallet y Google Wallet" from the vertical hero.
  - Card heights are equalised by letting `LoyaltyCard` **fill a fixed-height slot and distribute the slack internally** (root is `flex flex-col`, a spacer above the holder rule absorbs it). Stretching the outer box instead left a dead well of ground colour under the last line. Unconstrained — `/c/[token]`, the vertical hero — `grow` has nothing to distribute and the natural height is unchanged.
- **Photos are hotlinked from the Unsplash CDN** (`Vertical.card.photo`), one free non-Unsplash+ photo per trade, each checked to return a 200. A flat colour alone reads as a wireframe of the card rather than the card.
- ⚠️ **The failure mode of programmatic SEO is twelve pages whose only difference is the noun** — Google calls that thin content and it earns nothing. So `Vertical` has **no "insert trade here" slots**: the argument (`problem`), the reward ideas, the FAQ, the accent, and even **which mechanic the page leads with** are written per vertical (a gym is not a taquería). `tests/unit/verticals.test.ts` asserts that copy is not shared between entries; **a new vertical that reads like a copy of another one is not worth adding.**
- **Statically generated** (`generateStaticParams` + `dynamicParams = false`). They render the nav signed-out on purpose: reading the session opts the whole page into per-request rendering, and these exist to be crawled and served from the edge.
- The hero shows the **real `LoyaltyCard`** with that trade's settings, not a stock photo — a rendering of the actual product, and free.
- Each page sets its own `canonical` (twelve pages about one product is exactly the shape a crawler mistakes for duplicates) and emits `FAQPage` JSON-LD built from the same array the page renders, so the two cannot disagree.
- `components/landing/SiteNav.tsx` / `SiteFooter.tsx` are shared with the home page. The footer carries `VerticalLinks`, which is what links these pages to each other — a crawler finds all of them from anywhere on the site, not only from the sitemap.
- `app/sitemap.ts` lists only these; `app/robots.ts` disallows `/c/`, `/j/`, `/scan`, `/dashboard`, `/pos`, `/api/`. Those are public so a QR works, **not so they get indexed.**

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

### `/dashboard/billing` (NEW)
Subscription management (OWNER only). Current status (trial countdown / active / past_due / canceled), plan chooser with monthly/annual toggle → Stripe Checkout (`components/billing/BillingPlans`), and "Administrar facturación" → Billing Portal (`ManageBillingButton`). Always reachable even when the gate is active (the layout exempts it) so an expired business can pay. Trial businesses see a `TrialBanner` across the dashboard; expired ones see `UpgradeWall` instead of page content.

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
8. **Export/Reports**: CSV export exists for loyalty (`/api/reports/loyalty.csv`). Orders and inventory still have none; no PDF anywhere.
9. **`businessId` type debt (Fase 4, not done)**: string in `user` collection vs ObjectId in domain collections. Currently mitigated with `$in: [businessIdStr, businessId]` on `user` lookups; normalize at the root eventually.
10. **PIN throttle is in-memory** (per process) in `verify-pin` — move to Redis / a per-user lockout for multi-node.
11. **PaymentModal does not send the waiter token** — the payment is attributed to the terminal user, not the waiter (usually fine; cobro is done by cashier/manager).
12. **PINs need backfilling**: existing staff have no `pinHash` until set via staff create or `PATCH /api/staff/[id]`.
13. **Stamp farming is possible by design** — one stamp per paid order with no minimum ticket and no daily cap, so splitting one bill into four earns four stamps. `settings.loyalty.sellos.minTicket` / `maxPerDay` exist and are enforced; they're simply unset. Turning them on is a settings change, not a migration.
14. **Cashback never expires** — the liability only grows. `/dashboard/loyalty` surfaces "pasivo vivo" so it's at least visible, and `cashback.expiryDays` is in the schema unused if a policy is ever wanted.
15. **Reversing a cashback redemption doesn't touch the order or the shift** — the balance returns to the customer and the business absorbs the discount twice. Deliberate: rewriting a signed-off cash-up would hand a retroactive shortfall to a manager who did nothing wrong.
16. **Brand assets fall back to local disk without `BLOB_READ_WRITE_TOKEN`** — ⚠️ **development only.** On Vercel the filesystem is read-only apart from `/tmp`, and `/tmp` is per-instance and ephemeral, so `putAsset` throws `StorageNotConfiguredError` when `process.env.VERCEL` is set and no token is present; the upload route answers **503 `STORAGE_NOT_CONFIGURED`** instead of a generic 500 from a write that was never going to land. Note that Vercel marks the token **sensitive** — it reads as blank in the dashboard forever, which is expected and not a missing value. — `lib/storage.ts` writes to `./.uploads` and serves from `/api/uploads/[...path]`, so local dev needs no Vercel account. The wallet form warns when an asset landed locally: Google fetches the logo URL from its own servers and cannot reach localhost, so the token IS required before issuing real Google passes.
    - ⚠️ **A local asset URL is stored RELATIVE** (`/api/uploads/…`). It used to bake `APP_URL` in at upload time, which is why "the logo doesn't show in development": `APP_URL` in dev points at a tunnel so Apple can reach the box, so every uploaded logo was served from a host the owner's own browser could not load — and once the tunnel rotated, from nowhere at all. Three helpers in `lib/storage.ts` keep this straight: `assetSrc()` for the browser (strips the host, so legacy rows with a dead tunnel baked in still render), `absoluteAssetUrl()` for anything a third party must fetch (Google), and **`readAsset()` for our own server-side work** — it reads a local asset straight off disk rather than HTTP round-tripping to ourselves, which needed `APP_URL` to be reachable and risked a Next route awaiting its own server.
17. **The stamp icon catalogue has 65 icons**, not the 100 Loyalia advertises. Structure supports more; it's a matter of picking and thickening more lucide paths. ⚠️ Two of them — `padel` and `football` — are **drawn for RestKit, not lifted from lucide**, which ships no ball and no racket at the installed version. Same contract as the rest (one 24×24 `d`, stroke only, `fill="none"`), but the lesson that produced them is worth keeping: at `STAMP_STROKE` 2.6 **interior detail collapses**. A racket head with a 2×2 string grid filled in solid, and an upright head of any kind reads as a balloon or a magnifying glass — tilting the head and angling the handle is what makes the silhouette a racket before any detail resolves. Render a candidate at 24px against the filled badge before committing it, the way `tests/unit/loyalty.test.ts` renders a real strip.

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
- [x] ~~Real payment processor integration~~ — **done**: Stripe subscription billing (trial-without-card, plan-aware signup, checkout/portal/webhook, dashboard gate). See Billing section.

---

**Last updated**: 2026-09-12  
**Status**: MVP + POS v2. POS lives only under `/pos` with two-layer auth (terminal session + waiter PIN), per-waiter sales reporting, busy-table tracking, a Kitchen Display System, and recipe-linked inventory. Recent work: Fase 1 (POS auth hardening), Fase 2 (waiter PIN + attribution), Fase 3 (ventas por mesero), ADMIN-creation fix (`auth.api.signUpEmail`), POS removed from dashboard, busy-table filters, automated test suites (Vitest + Playwright, see `docs/FEATURES_AND_TESTING.md`), unique active-order-per-table index (race fix), `/dashboard/tables` (fresh businesses can now self-serve table setup — previously only possible via the demo seed routes), **Stripe subscription billing** (14-day trial-without-card, pricing→signup plan selection, checkout/portal/webhook, POS + dashboard subscription gate), and **POS-native loyalty** (Fases 1–2 + reporting: append-only ledger on `Visit`, phone attach at cobro, generated `strip.png` cards with a 58-icon catalogue and live preview, reward-ready state and redemption, purchase history with reversals, cashback with threshold redemption split correctly out of the cash-up, ROI panel and CSV export). Fixed along the way: "Premios entregados" always read zero, the stamp counter reset at the moment of earning, `/c/` was unauthenticated over enumerable ObjectIds, the Apple pass could be issued permanently un-updatable, and the customer email index was `sparse` where it needed to be partial.
