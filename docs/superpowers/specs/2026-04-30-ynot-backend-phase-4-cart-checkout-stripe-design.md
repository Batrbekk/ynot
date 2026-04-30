# YNOT London — Backend Phase 4 — Cart, Checkout, Stripe

**Date:** 2026-04-30
**Status:** Draft (pending user review)
**Scope:** Phase 4 of 6 in the YNOT backend roadmap. Migrates the cart from a client-only Zustand `persist` store to a server-of-record cart with optimistic client cache, wires real Stripe payments via `PaymentIntent` + custom-UI `<PaymentElement />`, introduces guest checkout via "ghost" user records with a post-purchase password-claim CTA, seeds a UK + International shipping zone setup with a pluggable rate provider (Mock for Phase 4, live DHL Express in Phase 5), implements promo codes, captures UTM/referrer attribution onto orders, and adds the Stripe webhook pipeline that finalises orders idempotently.

---

## 1. Context

Phase 1 (Foundation) defined every commerce table needed for this phase: `Cart`, `CartItem`, `CartEvent`, `Order`, `OrderItem`, `OrderStatusEvent`, `Payment`, `PromoCode`, `PromoRedemption`, `ShippingZone`, `ShippingMethod`, `PreorderBatch`. Phase 2 (Catalog & CMS reads) and Phase 3 (Auth & Customer) shipped real data behind catalog browsing and authentication; the cart and checkout pages still rely on client-only state.

The storefront ships every cart and checkout UI surface — `/cart`, `/checkout/shipping`, `/checkout/payment`, `/checkout/success/[id]` — styled and form-validated through Zod. They wire into two client-side Zustand stores:

- `useCartStore` (Zustand `persist` to `localStorage`) — drives the cart drawer and `/cart` page.
- `useCheckoutStore` — holds chosen shipping address + method + a `placeOrder()` stub that fakes an order id and routes to the success page.

This phase replaces both stubs with a real backend: server-side cart persisted in Postgres, real Stripe `PaymentIntent` creation, real `Order` records, and a Stripe webhook that finalises orders idempotently.

Subsequent phases (out of scope here):
- **Phase 5 — Orders & Fulfilment:** Royal Mail / DHL live API integration (rates, shipments, tracking), Resend transactional email templates (order receipt, shipped, delivered), refunds.
- **Phase 6 — Admin Panel:** admin RBAC, order management UI, manual refund/exchange flows, inventory management.

---

## 2. Goals

1. Migrate the cart from client-only `localStorage` Zustand to a **server-of-record** model: every mutation hits an API, the server is canonical, the client keeps an in-memory Zustand cache for optimistic rendering and reconciles on every response.
2. Support **guest checkout** via session-cookie-bound carts and "ghost" user records (User with `passwordHash = null`, `isGuest = true`); on signin, merge guest cart into the user's cart.
3. Stand up **Stripe `PaymentIntent` + `<PaymentElement />`** custom-UI payments. Cards, Apple Pay, Google Pay, 3DS handled by the Stripe SDK.
4. Implement the **`Order(PENDING_PAYMENT)` → `NEW`** state machine: order created and stock atomically locked at click-pay; webhook flips status on `payment_intent.succeeded` / `.payment_failed`.
5. **Idempotent webhook handler** that verifies signature, deduplicates by `event.id`, and is safe to replay.
6. Seed **UK + International shipping zones** with a pluggable `ShippingRateProvider` interface — `MockDhlProvider` for Phase 4, `DhlExpressProvider` for Phase 5. UK is always free; international uses static placeholder rates with **DDP** (duties prepaid by us) UX.
7. Apply **promo codes** at the cart level: validate at apply-time, re-validate at order-creation time, increment `usageCount` only on successful payment.
8. Capture **last-touch UTM attribution** + landing path + referrer in a cookie; persist onto `Order` at checkout.
9. **Post-purchase claim flow**: after a guest pays, the success page shows "Save your details — set a password to track this order"; a single password input upgrades the ghost user to a full account.
10. Real-Postgres tests covering: full cart lifecycle (guest → signin → merge), checkout end-to-end (mocked Stripe SDK), webhook signature + idempotency + state transitions, stock release on payment failure, promo redemption.
11. Storefront UI rendering stays byte-identical — only the data sources behind the existing pages change. Add a small post-purchase claim component on `/checkout/success/[id]`.

---

## 3. Non-goals

- ❌ **Inventory holds / TTL reservations.** Stock is checked transactionally at order creation only; no soft-holds. For a luxury brand at launch volume this is fine; if oversold races become real, Phase 5 can add a `StockReservation` table with a TTL.
- ❌ **Pre-order items** (`isPreorder=true`). Schema fields exist but Phase 4 ignores them — every cart item resolves against `ProductSize.stock`. Pre-order flow lands in Phase 5 alongside `PreorderBatch` admin.
- ❌ **Live DHL Express MyDHL API** (rates, shipments, label creation). Phase 4 ships `MockDhlProvider` only. Phase 5 swaps it in once DHL UK account manager grants `MyDHL API` + `Landed Cost API` access.
- ❌ **Real customs/duties calculation.** Mock provider uses a static destination → `(shipping, duties)` table. Phase 5 wires `Landed Cost API` for accurate per-product per-destination calculation.
- ❌ **Resend email delivery.** Phase 4 reuses the Phase 3 email abstraction; the Console implementation prints order receipts into the dev terminal. Phase 5 ships branded HTML templates and switches to Resend.
- ❌ **Refunds / partial refunds / exchanges.** No `charge.refunded` handling beyond logging. Phase 5.
- ❌ **Order status emails** (shipped, out for delivery, delivered). Phase 5 alongside DHL tracking.
- ❌ **Apple/Google Pay branded buttons in cart drawer.** PaymentElement renders them automatically at checkout once enabled in the Stripe dashboard, but no separate "Apple Pay express" button on `/cart`.
- ❌ **Klarna / Afterpay / BNPL** payment methods. Card + wallets only.
- ❌ **Saved payment methods.** Each checkout creates a fresh `PaymentIntent`; we do not call `Stripe.customers.create` or attach payment methods. Phase 6 admin can revisit.
- ❌ **Multi-currency.** GBP only. Schema has `Currency` enum but every record stays `GBP`.
- ❌ **Tax calculation for UK.** Prices on the storefront are VAT-inclusive; we do not display a separate VAT line. International uses placeholder DDP duties (combined with shipping into a single line on the order summary).
- ❌ **Admin order management UI.** Phase 6.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Payment provider | **Stripe** (`stripe` server SDK + `@stripe/stripe-js` + `@stripe/react-stripe-js`) | Industry standard, supports cards/Apple Pay/Google Pay/3DS out of the box, Test mode keys already provisioned, webhook-driven finalisation matches our Order(PENDING_PAYMENT) pattern. |
| Payment UI | **Custom UI + `<PaymentElement />`** | Keeps `/checkout/shipping` + `/checkout/payment` design intact. Stripe handles 3DS / SCA / wallets internally; we only render `<Elements>` + the inline element. |
| API version pin | `2025-02-24.acacia` | Matches the version Stripe CLI is forwarding from; pinned in `Stripe` constructor and webhook handler to keep test fixtures stable. |
| Cart cookie (guest) | `__Secure-ynot_cart` (HttpOnly, SameSite=Lax, Secure in prod, 30-day rolling TTL) | Server-set, not readable from JS; survives full-page reload, lost only on cookie clear. |
| Cart store (client) | **Zustand without `persist`** | In-memory cache only; server is source of truth. Initial state hydrated from `GET /api/cart` on first render. |
| Mutation pattern | **Optimistic update → server call → reconcile** | Local state changes instantly; on response, replace with server snapshot. Toast surfaced if a `409 Conflict` (stock changed mid-flight). |
| Stock locking | `prisma.$transaction` with `SELECT ... FOR UPDATE` on relevant `ProductSize` rows at order-creation time | Postgres row-level lock prevents race when two orders compete for the last unit. No reservation TTL. |
| Webhook idempotency | New `StripeEvent` table; `event.id` is `@id`. Insert-or-skip on every webhook delivery. | Stripe re-delivers on 5xx and on operator replay. Inserting a row makes processing exactly-once. |
| Shipping provider | **`MockDhlProvider`** (Phase 4) implementing `ShippingRateProvider` interface; `DhlExpressProvider` (Phase 5) | Pluggable selected by `SHIPPING_PROVIDER` env var. UK always uses `RoyalMailFreeProvider`. |
| Validation | **Zod 4** (already in repo) | Shared schemas between client form and server route — same pattern as Phase 3. |
| Environment | New required vars: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `ORDER_TOKEN_SECRET` (≥32 chars), `SHIPPING_PROVIDER` (default `mock`); reserved-for-Phase-5: `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER` | Env validator (Phase 1 `src/server/env.ts`) extended with required Stripe trio + order-token signing key. |

---

## 5. Architecture

### 5.1 Code layout

```
src/
├── lib/
│   ├── schemas/
│   │   ├── cart.ts                      ← NEW: Zod for cart mutations
│   │   ├── checkout.ts                  ← NEW: Zod for shipping address, quote req, create-order req
│   │   └── stripe.ts                    ← NEW: Zod for webhook payload narrowing
│   ├── stores/
│   │   ├── cart-store.ts                ← REWRITTEN: drop `persist`, server-driven cache
│   │   ├── checkout-store.ts            ← REWRITTEN: holds chosen address+method+rate quote, no `placeOrder` stub
│   │   └── auth-stub-store.ts           ← already DELETED in Phase 3
│   └── stripe-client.ts                 ← NEW: loadStripe(...) singleton for client side
└── server/
    ├── env.ts                           ← UPDATED: adds STRIPE_*, SHIPPING_PROVIDER, optional DHL_*
    ├── cart/
    │   ├── service.ts                   ← NEW: addItem, removeItem, setQuantity, applyPromo, removePromo, getOrCreate, snapshot
    │   ├── token.ts                     ← NEW: setCartCookie / readCartCookie / clearCartCookie helpers
    │   ├── merge.ts                     ← NEW: mergeGuestIntoUser called on signin event
    │   └── __tests__/
    │       ├── service.test.ts
    │       └── merge.test.ts
    ├── checkout/
    │   ├── service.ts                   ← NEW: createOrderAndPaymentIntent (single transaction)
    │   ├── stripe.ts                    ← NEW: Stripe SDK singleton + helpers (createPaymentIntent, retrievePaymentIntent)
    │   ├── webhook.ts                   ← NEW: verifySignature + dispatchEvent (idempotent)
    │   └── __tests__/
    │       ├── service.test.ts
    │       └── webhook.test.ts
    ├── shipping/
    │   ├── provider.ts                  ← NEW: ShippingRateProvider interface
    │   ├── mock-dhl.ts                  ← NEW: static destination → rate table
    │   ├── royal-mail.ts                ← NEW: always £0 for UK
    │   ├── zones.ts                     ← NEW: country code → zone resolution + provider selection
    │   └── __tests__/
    │       └── zones.test.ts
    ├── promo/
    │   ├── service.ts                   ← NEW: validate, applyToCart, redeemForOrder
    │   └── __tests__/
    │       └── service.test.ts
    ├── attribution/
    │   ├── cookie.ts                    ← NEW: capture/read UTM cookie
    │   └── __tests__/
    │       └── cookie.test.ts
    ├── repositories/
    │   ├── user.repo.ts                 ← UPDATED: passwordHash now optional, add createGuestUser
    │   ├── cart.repo.ts                 ← NEW
    │   ├── order.repo.ts                ← NEW (replaces Phase 2 read-only data façade for write paths)
    │   ├── payment.repo.ts              ← NEW
    │   └── stripe-event.repo.ts         ← NEW (idempotency log)
    └── data/
        └── orders.ts                    ← UPDATED: real read after Phase 4 (Phase 3 already made it user-aware)

src/app/
├── api/
│   ├── cart/
│   │   ├── route.ts                     ← NEW: GET (snapshot), DELETE (clear)
│   │   ├── items/
│   │   │   └── route.ts                 ← NEW: POST (add), with productId+size+qty
│   │   ├── items/[id]/
│   │   │   └── route.ts                 ← NEW: PATCH (setQuantity), DELETE (remove)
│   │   └── promo/
│   │       └── route.ts                 ← NEW: POST (apply), DELETE (remove)
│   ├── checkout/
│   │   ├── quote/
│   │   │   └── route.ts                 ← NEW: POST → shipping methods+rates for given address
│   │   └── create/
│   │       └── route.ts                 ← NEW: POST → create Order(PENDING_PAYMENT) + PaymentIntent → return clientSecret
│   ├── orders/[id]/
│   │   └── route.ts                     ← NEW: GET (auth-aware, ghost-token aware)
│   ├── account/claim/
│   │   └── route.ts                     ← NEW: POST → set password on ghost user, sign in
│   └── webhooks/stripe/
│       └── route.ts                     ← NEW: POST → verifySignature + dispatchEvent
├── cart/
│   └── page.tsx                         ← UPDATED: server cart, mutations call API
├── checkout/
│   ├── shipping/
│   │   └── page.tsx                     ← UPDATED: posts to /api/checkout/quote, fills checkout-store
│   ├── payment/
│   │   └── page.tsx                     ← UPDATED: creates PaymentIntent, mounts <Elements> + <PaymentElement />
│   └── success/
│       └── [id]/page.tsx                ← UPDATED: polls /api/orders/[id], shows claim CTA for ghost orders
└── components/checkout/
    ├── shipping-form.tsx                ← UPDATED: country select triggers quote refresh
    ├── payment-form.tsx                 ← UPDATED: Stripe Elements integration
    ├── order-summary-card.tsx           ← UPDATED: shows shipping line + duties placeholder
    └── claim-account-form.tsx           ← NEW: post-purchase set-password form

prisma/
└── migrations/
    └── 2026_04_30_phase4_payment_states/
        └── migration.sql                ← Adds OrderStatus enum values, StripeEvent table,
                                          User.passwordHash nullable + isGuest flag,
                                          Product weight/HS/origin (nullable, populated in seed)

tests/seeds/                             ← UPDATED: adds ShippingZones, ShippingMethods, sample PromoCode
```

### 5.2 High-level data flow

**Guest cart lifecycle:**

```
[Browser hits /products/coat-x for first time]
  → no __Secure-ynot_cart cookie
  → useCartStore initial state empty (server returns empty cart)
[User clicks "Add to bag"]
  → POST /api/cart/items { productId, size, qty }
  → server has no cookie → creates Cart(sessionToken=randomBytes(24), userId=null, expiresAt=now+30d)
  → server sets __Secure-ynot_cart cookie with sessionToken
  → returns full cart snapshot
[User refreshes page]
  → cookie persists → GET /api/cart → server resolves Cart by sessionToken → returns snapshot
  → Zustand hydrates with snapshot
[User signs in]
  → Auth.js JWT now has user.id
  → next mutation: server reads BOTH cookie (guest cart) AND user.id (user cart, may be null)
  → calls mergeGuestIntoUser(): items merged, guest cart deleted, cookie cleared, user cart returned
  → from now on every cart op binds to user.id only
```

**Checkout submit:**

```
[Click "Pay £X" on /checkout/payment]
  → client: stripe.confirmPayment({ clientSecret, return_url: /checkout/success/{orderId} })
[Stripe SDK]
  → if 3DS required: opens iframe modal, handles SCA challenge
  → POSTs to Stripe → confirms PaymentIntent
[Stripe sends webhook async]
  → POST /api/webhooks/stripe { type: 'payment_intent.succeeded', data: { object: { id, metadata: { orderId } } } }
  → server: verify signature → dedupe by event.id (StripeEvent insert) → flip Order to NEW
[Browser]
  → Stripe SDK redirects to return_url
[Success page]
  → polls GET /api/orders/{id} every 1.5s until status !== PENDING_PAYMENT (max 30s)
  → renders order details
  → if Order.userId belongs to a ghost user: show "Save your details" claim form
```

The success page does **not** depend on the webhook to render basic order info: the order already exists (in `PENDING_PAYMENT`) before Stripe is even called. Polling exists only to surface the final status.

---

## 6. Schema changes

### 6.1 Migration: `phase4_payment_states`

```prisma
// OrderStatus: prepend two new states for our pre-payment + failure states.
enum OrderStatus {
  PENDING_PAYMENT     // ← new: order created, awaiting Stripe confirmPayment outcome
  PAYMENT_FAILED      // ← new: payment_intent.payment_failed received; stock released
  NEW                 // ← previously the "fresh order" state; now means "paid, ready to fulfil"
  PROCESSING
  SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
}

// New: webhook idempotency log.
model StripeEvent {
  id        String   @id        // = stripe event.id (e.g. evt_1ABC...)
  type      String              // e.g. payment_intent.succeeded
  payload   Json                // full event JSON for forensics
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([type])
}

// Order: promo linkage at creation time (used for redemption on success, audit on failure).
model Order {
  // ↑ existing fields
  promoCodeId String?           // ← new: nullable; set when cart had a promo at order creation
  promoCode   PromoCode? @relation(fields: [promoCodeId], references: [id], onDelete: SetNull)
  // ↓ existing fields
}

// User: passwordHash nullable for ghost users.
model User {
  // ↑ existing fields
  passwordHash String?          // ← was: String — now nullable
  isGuest      Boolean @default(false)  // ← new: true for ghost users created at guest checkout
  // ↓ existing fields
}

// Product: physical attributes for shipping rate calc and customs (Phase 5 uses these live).
model Product {
  // ↑ existing fields
  weightGrams         Int?     // ← new
  hsCode              String?  // ← new (Harmonized System code, e.g. "6202.93" for synthetic women's coats)
  countryOfOriginCode String?  // ← new (ISO-3166 alpha-2, e.g. "GB", "TR", "CN")
  // ↓ existing fields
}
```

The migration also seeds initial `ShippingZone` + `ShippingMethod` rows (UK + International) and updates the seed script to populate `Product.weightGrams=1500`, `hsCode='6202.93'`, `countryOfOriginCode='GB'` on existing demo SKUs (placeholder values until admin Phase 6 lets the team edit per-SKU).

### 6.2 Why nullable `passwordHash` is safe

Phase 3's `authorize()` callback in `src/server/auth/config.ts:40` already guards:

```ts
if (!user || !user.passwordHash) return null;
```

A ghost user (passwordHash = null) attempting to sign in via the credentials provider returns `null` → Auth.js renders "Invalid credentials" → ghost cannot sign in until they claim the account by setting a password (which flips them to a full user).

`createUser` in `src/server/repositories/user.repo.ts` requires updating: input type changes from `passwordHash: string` to `passwordHash?: string`. Two new sibling helpers are added:

- `createGuestUser({ email })` — inserts a `User` row with `passwordHash: null, isGuest: true, emailVerified: null`. Throws on duplicate email (caller must check existence first).
- `getOrCreateGuestUser({ email }, tx?)` — find-by-email; if exists as ghost, return it; if exists as full user, throw `EmailTakenByFullAccountError` (the checkout endpoint translates to 409); otherwise create. Used by `createOrderAndPaymentIntent` to support same-email-multiple-guest-orders.

---

## 7. Cart subsystem

### 7.1 Identity resolution

Every cart-touching request goes through `resolveCart(req, user)`:

| user signed in? | cookie present? | guest cart in DB? | user cart in DB? | action |
|---|---|---|---|---|
| no  | no  | n/a | n/a | create new guest cart, set cookie, return |
| no  | yes | yes | n/a | return existing guest cart |
| no  | yes | no  | n/a | cookie stale (cart expired/deleted) → create new, rotate cookie |
| yes | n/a | n/a | yes | return user cart (cookie ignored if signed in) |
| yes | n/a | n/a | no  | create user cart, return |
| yes | yes | yes | yes | **merge** guest into user, delete guest, clear cookie, return user cart |
| yes | yes | yes | no  | **adopt** guest cart: set userId, clear sessionToken, clear cookie |

The merge handles the common "browse anonymously → sign in mid-checkout" flow.

### 7.2 Mutation API

All routes require body validation via `src/lib/schemas/cart.ts`. All routes return a full `CartSnapshot` (not just the changed item) so clients can blindly replace state.

```
GET    /api/cart                  → CartSnapshot
POST   /api/cart/items            { productId, size, colour, quantity, isPreorder=false }
PATCH  /api/cart/items/:itemId    { quantity }
DELETE /api/cart/items/:itemId
POST   /api/cart/promo            { code }
DELETE /api/cart/promo
DELETE /api/cart                  → empty cart (used post-checkout)
```

`CartSnapshot` shape (Zod-validated on client):

```ts
type CartSnapshot = {
  id: string;
  items: Array<{
    id: string;
    productId: string;
    productSlug: string;
    productName: string;
    productImage: string;
    colour: string;
    size: Size;
    quantity: number;
    unitPriceCents: number;
    currency: 'GBP';
    isPreorder: boolean;
    stockAvailable: number;       // computed; for "X left" UI
  }>;
  subtotalCents: number;
  discountCents: number;
  promo: { code: string; discountCents: number } | null;
  itemCount: number;
  expiresAt: string;              // ISO 8601
};
```

Snapshot is computed by `src/server/cart/service.ts#snapshot(cartId)` joining `Cart`, `CartItem`, `Product`, `ProductSize`, `PromoCode` in a single query.

### 7.3 Optimistic client store

```ts
// src/lib/stores/cart-store.ts (rewritten)

type CartState = {
  snapshot: CartSnapshot | null;
  isLoading: boolean;
  isOpen: boolean;
  // mutations
  hydrate: () => Promise<void>;
  addItem: (input: AddItemInput) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyPromo: (code: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  removePromo: () => Promise<void>;
  clear: () => Promise<void>;
  // drawer
  openDrawer: () => void;
  closeDrawer: () => void;
};
```

Each mutation:

1. Optimistic: compute predicted snapshot client-side, set state.
2. Fetch: `await fetch('/api/cart/items', { method: 'POST', headers: { 'x-csrf-token': … } })`.
3. On 2xx: replace state with server snapshot (server is canonical, even if it differs from prediction).
4. On 4xx: revert optimistic update, surface toast (e.g. "Only 1 left — quantity adjusted").
5. On 5xx: revert, generic error toast.

CSRF: same `x-csrf-token` header pattern as Phase 3 (`src/lib/auth-fetch.ts` is reused — extended into `src/lib/api-fetch.ts` for non-auth endpoints).

### 7.4 Stock validation

Two checkpoints:

1. **Soft check at cart op** — `addItem`/`setQuantity` compares `quantity` against `ProductSize.stock`; returns 409 with body `{ stockAvailable: number }` if exceeded. UX shows "Only N left" inline.
2. **Hard check at order creation** — inside `prisma.$transaction`, we run:

```sql
SELECT product_id, size, stock FROM product_sizes
WHERE (product_id, size) IN ($items) FOR UPDATE;
```

then per-item: `if (row.stock < item.quantity) abort with 409`; on success, `UPDATE product_sizes SET stock = stock - $qty WHERE product_id = $pid AND size = $size;` per item, all in the same tx as the Order/OrderItem inserts.

This is race-free: Postgres row locks serialise concurrent checkouts on the same SKU. The "loser" gets a 409 with the conflicted SKUs and the user is shown which items need adjusting before retry.

If the order is later marked `PAYMENT_FAILED` via webhook, the stock is **released** in the webhook handler (re-increment).

### 7.5 Cart expiry

`Cart.expiresAt` is set to `now + 30 days` on creation. Phase 4 does **not** ship a cleanup cron — it would be one-line `DELETE FROM carts WHERE expires_at < NOW() AND user_id IS NULL` and lives in Phase 5/6 ops. The field is still set so the cron has data to reason about. Cart expiry does not affect snapshot reads in Phase 4.

---

## 8. Checkout flow

Pages are reused with rewritten content:

### 8.1 `/cart`

- Renders `CartSnapshot.items` (no longer derives from `useCartStore.items`).
- Hooks: `useCartStore.hydrate()` runs once on mount.
- Edit / remove buttons call `setQuantity` / `removeItem` which trigger optimistic + API.
- Shows promo input + apply button → toast on validation failure.
- "Proceed to checkout" routes to `/checkout/shipping`.

### 8.2 `/checkout/shipping`

- Shipping form (existing component) extended:
  - For signed-in users with saved addresses: dropdown "Use saved address" populates fields.
  - For all users: country select drives a re-quote. On change, `POST /api/checkout/quote { address, items: cart.items }` returns `Array<{ methodId, name, baseRateCents, dutiesCents, totalCents, estimatedDaysMin, estimatedDaysMax }>`.
  - Method radio options render below the address form once a country is picked.
- On "Continue to payment": writes `address` + `methodId` + `quote` into `useCheckoutStore`; routes to `/checkout/payment`.

### 8.3 `/checkout/payment`

- On mount: reads `useCheckoutStore` (needs `address` + `methodId`); if missing, `router.push('/checkout/shipping')`.
- On mount: `POST /api/checkout/create { address, methodId, attribution }` → response `{ orderId, clientSecret }`.
  - Server side this creates `Order(PENDING_PAYMENT)` + items + `Payment(PENDING)` + Stripe `PaymentIntent` in a single transaction.
  - If 409 (stock conflict): redirect back to `/cart` with toast.
- Mounts `<Elements stripe={stripePromise} options={{ clientSecret }}><PaymentElement /></Elements>`.
- "Pay £X" button → `stripe.confirmPayment({ confirmParams: { return_url: window.origin + '/checkout/success/' + orderId } })`.
  - If immediate failure (e.g. validation error): inline error message, button re-enabled.
  - If 3DS required: Stripe SDK opens modal; on completion → returns to checkout, finalises.
  - If success: redirect to `return_url` automatically.

### 8.4 `/checkout/success/[id]`

- Server component: `getOrder(id, currentUser)` → throws if not authorised (ghost token below).
- Renders order summary (items + total + estimated delivery window).
- Client component embedded: poll loop. Every 1.5s `GET /api/orders/[id]` until `status !== 'PENDING_PAYMENT'` or 20 polls (30s) elapsed.
  - On `NEW` → "Payment received! We'll email you when it ships."
  - On `PAYMENT_FAILED` → "Payment didn't go through" + "Try again" button → `/cart`.
  - On 30s timeout → "We're confirming your payment — check your email" (manual reload prompt).
- If `Order.userId` belongs to a ghost user (`User.isGuest === true`) and the request was authenticated by an order-bound short-lived token (see §10.2): render `<ClaimAccountForm orderId={…} />` inline.

---

## 9. Stripe integration

### 9.1 SDK setup

```ts
// src/server/checkout/stripe.ts
import Stripe from 'stripe';
import { env } from '@/server/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});
```

```ts
// src/lib/stripe-client.ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}
```

### 9.2 PaymentIntent creation

`src/server/checkout/service.ts#createOrderAndPaymentIntent({ user, cart, address, methodId, attribution })`:

```ts
return prisma.$transaction(async (tx) => {
  // 1. Lock and decrement stock
  const productSizeKeys = cart.items.map((i) => ({ productId: i.productId, size: i.size }));
  const stocks = await tx.$queryRaw<...>`SELECT ... FOR UPDATE`;
  for (const item of cart.items) {
    const row = stocks.find(...);
    if (!row || row.stock < item.quantity) {
      throw new StockConflictError({ productId: item.productId, size: item.size });
    }
  }
  for (const item of cart.items) {
    await tx.productSize.update({
      where: { productId_size: { productId: item.productId, size: item.size } },
      data: { stock: { decrement: item.quantity } },
    });
  }

  // 2. Re-validate promo (race)
  if (cart.promoCodeId) {
    const promo = await tx.promoCode.findUnique({ where: { id: cart.promoCodeId } });
    if (!isPromoValid(promo, cart.subtotalCents)) {
      throw new PromoExpiredError(promo.code);
    }
  }

  // 3. Quote shipping (re-fetch, do not trust client)
  const quote = await shipping.quote({ address, items: cart.items });
  const method = quote.find((q) => q.methodId === methodId);
  if (!method) throw new InvalidMethodError(methodId);

  // 4. If guest: ensure ghost user exists.
  //    getOrCreateGuestUser throws EmailTakenByFullAccountError if the email
  //    belongs to a non-guest user — caller maps to 409 with prompt "sign in".
  let userId = user?.id;
  if (!userId) {
    const ghost = await getOrCreateGuestUser({ email: address.email }, tx);
    userId = ghost.id;
  }

  // 5. Create Order + items + Payment row
  const order = await tx.order.create({
    data: {
      orderNumber: generateOrderNumber(),  // YN-2026-04-30-XXXXX
      userId,
      status: 'PENDING_PAYMENT',
      subtotalCents: cart.subtotalCents,
      shippingCents: method.totalCents,    // includes duties for international
      discountCents: cart.discountCents,
      totalCents: cart.subtotalCents + method.totalCents - cart.discountCents,
      currency: 'GBP',
      carrier: method.carrier,
      shipFirstName: address.firstName,
      // ... full address snapshot
      utmSource: attribution.utmSource,
      // ... full attribution snapshot
      promoCodeId: cart.promoCodeId ?? null,  // ← preserved for redemption on payment success
      items: {
        create: cart.items.map((i) => ({
          productId: i.productId,
          productSlug: i.productSlug,
          productName: i.productName,
          productImage: i.productImage,
          colour: i.colour,
          size: i.size,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          isPreorder: false,
        })),
      },
      payment: {
        create: {
          status: 'PENDING',
          amountCents: cart.subtotalCents + method.totalCents - cart.discountCents,
          currency: 'GBP',
        },
      },
    },
    include: { payment: true },
  });

  // 6. Create Stripe PaymentIntent (outside tx is fine — Stripe is idempotent on retry,
  //    but we want our DB state set first; if Stripe call fails, the tx still committed,
  //    user retries from the success/failure surface).
  return order;
}).then(async (order) => {
  const intent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'gbp',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id },
    receipt_email: address.email,
  });
  await prisma.payment.update({
    where: { orderId: order.id },
    data: { stripePaymentIntentId: intent.id },
  });
  return { orderId: order.id, clientSecret: intent.client_secret };
});
```

Notes:
- Stripe call is **outside** the DB transaction — running it inside would pin a connection across an HTTP roundtrip. Running it after means: if the Stripe call fails, the order is still in DB (PENDING_PAYMENT, no PI). The user sees an error and either retries (we look up the existing pending order and create a fresh PI for it) or abandons (cron in Phase 5 cancels stale orders and releases stock).
- `automatic_payment_methods.enabled: true` lets PaymentElement decide which methods to render based on Stripe dashboard config.
- `metadata.orderId` is the link the webhook uses to find our order.

---

## 10. Webhook handler

### 10.1 Endpoint

`POST /api/webhooks/stripe` runs on the Node.js runtime (not Edge — the Stripe SDK needs Node crypto). Body is read raw via `await req.text()` for signature verification.

```ts
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency: insert event row; if it already exists, this is a replay → ack.
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return new Response(null, { status: 200 });  // already processed
    throw e;
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case 'charge.refunded':
      // Phase 5: log only
      break;
    default:
      // unhandled events still get a 200 — Stripe should not retry
      break;
  }
  return new Response(null, { status: 200 });
}
```

### 10.2 `handlePaymentSucceeded`

Single transaction:

1. Look up `Order` by `payment.stripePaymentIntentId = pi.id`. If status !== `PENDING_PAYMENT`, no-op (replay or manual operator action).
2. Update `Order.status = 'NEW'`, `Payment.status = 'CAPTURED'`, append `OrderStatusEvent(status: NEW, note: 'Payment received')`.
3. If `cart.promoCodeId` was used: `tx.promoCode.update({ usageCount: { increment: 1 } })` + `tx.promoRedemption.create(...)`.
4. Mark cart as `CHECKED_OUT` via `CartEvent` and delete the cart.
5. Mark guest user's email as verified (the receipt email is implicit confirmation that the address works — and gives us "Save your details" intent on the success page; full claim still requires password).

### 10.3 `handlePaymentFailed`

Single transaction:

1. Look up Order; if status !== `PENDING_PAYMENT`, no-op.
2. Update `Order.status = 'PAYMENT_FAILED'`, `Payment.status = 'FAILED'`, append `OrderStatusEvent`.
3. **Release stock** — re-increment `ProductSize.stock` for each `OrderItem`.

The cart is **not** restored — Stripe's PaymentIntent supports retries client-side (PaymentElement re-tries with a fresh confirm). If retries on the same intent fail, the user is sent back to `/cart` with a fresh empty cart in some flows; UX side surfaces a "Start over" link from the success page.

### 10.4 Ghost-order viewing

`/checkout/success/[id]` and `GET /api/orders/[id]` need to authorise three cases:

1. Signed-in user owns the order (`order.userId === session.user.id`).
2. Signed-in user is **not** the owner — 403.
3. **Anonymous request** — accept iff a short-lived `__ynot_order_token` cookie matches a HMAC-SHA256 of `orderId + Order.createdAt` signed with `ORDER_TOKEN_SECRET` (new required env var, generated via `openssl rand -base64 32`). The cookie is set by `/api/checkout/create` at order creation time. TTL 24h. This lets a guest who paid on this device view the success page without signing in. After 24h the receipt email link (Phase 5) is the only way back.

`POST /api/account/claim`:

- Reads order token cookie.
- Validates `password` (Zod min length 12, has digit, etc. — same rules as Phase 3 register).
- Updates the ghost user: `passwordHash = await hashPassword(password)`, `isGuest = false`, `emailVerified = now()`.
- Triggers Auth.js sign-in (creates session, sets session cookie) so the user is immediately logged in.
- Clears the order token cookie.
- Returns `{ ok: true }` → client refreshes the success page (now with `useSessionUser()` populated, claim form gone).

---

## 11. Shipping & DDP

### 11.1 Provider interface

```ts
// src/server/shipping/provider.ts
export interface ShippingRateQuote {
  methodId: string;             // ShippingMethod.id
  name: string;                 // "Royal Mail Tracked 48"
  carrier: 'ROYAL_MAIL' | 'DHL';
  baseRateCents: number;        // shipping only
  dutiesCents: number;          // duties + import VAT (DDP); 0 for UK
  totalCents: number;           // baseRateCents + dutiesCents (what the customer pays)
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface ShippingRateRequest {
  origin: { country: 'GB' };    // fixed for Phase 4
  destination: {
    countryCode: string;        // ISO-3166 alpha-2
    postcode?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    weightGrams: number;
    unitPriceCents: number;
    hsCode?: string;
    countryOfOriginCode?: string;
  }>;
  subtotalCents: number;
}

export interface ShippingRateProvider {
  quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]>;
}
```

### 11.2 UK provider (`royal-mail.ts`)

```ts
export class RoyalMailFreeProvider implements ShippingRateProvider {
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode !== 'GB') return [];
    // Look up ShippingMethod for Royal Mail Tracked 48 in UK zone
    const method = await prisma.shippingMethod.findFirstOrThrow({
      where: { carrier: 'ROYAL_MAIL', zone: { countries: { has: 'GB' } }, isActive: true },
    });
    return [{
      methodId: method.id,
      name: method.name,                  // "Royal Mail Tracked 48"
      carrier: 'ROYAL_MAIL',
      baseRateCents: 0,
      dutiesCents: 0,
      totalCents: 0,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
    }];
  }
}
```

### 11.3 International provider (`mock-dhl.ts`)

Static lookup table by region:

```ts
const TABLE: Record<string, { shippingCents: number; dutyRate: number }> = {
  // EU-27 + EFTA: 24.95 shipping, ~20% duties (median)
  'EU': { shippingCents: 2495, dutyRate: 0.20 },
  // North America
  'US': { shippingCents: 3495, dutyRate: 0.00 },  // no national VAT/sales tax handling
  'CA': { shippingCents: 3495, dutyRate: 0.13 },  // GST/HST median
  // APAC luxury markets
  'AU': { shippingCents: 4495, dutyRate: 0.10 },
  'JP': { shippingCents: 4495, dutyRate: 0.10 },
  // Rest of World
  'ROW': { shippingCents: 4995, dutyRate: 0.00 },  // DDU note shown
};
```

Country resolution:

```ts
const EU_27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const EFTA = ['NO','CH','IS','LI'];

function resolveRegion(cc: string): keyof typeof TABLE {
  if ([...EU_27, ...EFTA].includes(cc)) return 'EU';
  if (cc === 'US') return 'US';
  if (cc === 'CA') return 'CA';
  if (cc === 'AU') return 'AU';
  if (cc === 'JP') return 'JP';
  return 'ROW';
}
```

Then:

```ts
async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
  if (req.destination.countryCode === 'GB') return [];
  const row = TABLE[resolveRegion(req.destination.countryCode)];
  const dutiesCents = Math.round(req.subtotalCents * row.dutyRate);
  // Look up ShippingMethod for DHL in International zone
  const method = await prisma.shippingMethod.findFirstOrThrow({
    where: { carrier: 'DHL', zone: { countries: { has: '*' } }, isActive: true },
  });
  return [{
    methodId: method.id,
    name: 'DHL Express Worldwide (DDP)',
    carrier: 'DHL',
    baseRateCents: row.shippingCents,
    dutiesCents,
    totalCents: row.shippingCents + dutiesCents,
    estimatedDaysMin: method.estimatedDaysMin,
    estimatedDaysMax: method.estimatedDaysMax,
  }];
}
```

**UI display:** order summary card shows a single line `International shipping & duties: £XX.XX`. We do not split base/duties on screen because mock numbers are not quotable. Phase 5 will surface a tooltip "Includes import duties & VAT for {country}" and break out the line items when the live `Landed Cost API` returns them.

### 11.4 Provider selection

```ts
// src/server/shipping/zones.ts
export function getShippingProvider(): ShippingRateProvider {
  switch (env.SHIPPING_PROVIDER) {
    case 'mock': return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
    case 'dhl':  return new CompositeProvider([new RoyalMailFreeProvider(), new DhlExpressProvider()]);  // Phase 5
  }
}
```

The composite calls both providers and concatenates non-empty results, so a UK address gets only Royal Mail and an international address gets only DHL (each provider returns `[]` for ineligible destinations).

### 11.5 Seed data

```ts
// tests/seeds/shipping.ts
const ukZone = await prisma.shippingZone.create({
  data: { name: 'United Kingdom', countries: ['GB'], sortOrder: 0 },
});
const intlZone = await prisma.shippingZone.create({
  data: { name: 'International', countries: ['*'], sortOrder: 10 },
});

await prisma.shippingMethod.create({
  data: {
    zoneId: ukZone.id,
    carrier: 'ROYAL_MAIL',
    name: 'Royal Mail Tracked 48',
    baseRateCents: 0,
    freeShipThresholdCents: null,
    estimatedDaysMin: 2,
    estimatedDaysMax: 3,
  },
});

await prisma.shippingMethod.create({
  data: {
    zoneId: intlZone.id,
    carrier: 'DHL',
    name: 'DHL Express Worldwide (DDP)',
    baseRateCents: 2495,
    freeShipThresholdCents: null,
    estimatedDaysMin: 3,
    estimatedDaysMax: 5,
  },
});
```

The `MockDhlProvider` overrides `baseRateCents` from the table; the seed's `2495` is a placeholder for the simplest viewing in admin and is never the figure shown to a customer.

---

## 12. Promo codes

### 12.1 Apply flow

`POST /api/cart/promo { code }` → server:

1. `prisma.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } })`.
2. Validate: `isActive`, `deletedAt === null`, `expiresAt === null || > now`, `usageLimit === null || usageCount < usageLimit`, `subtotalCents >= minOrderCents`.
3. Compute discount: `FIXED → discountValue`; `PERCENT → Math.round(subtotalCents * discountValue / 100)`.
4. `cart.promoCodeId = promo.id` → return new snapshot.
5. On any failure, return a typed error code: `EXPIRED`, `LIMIT_REACHED`, `MIN_ORDER`, `NOT_FOUND`.

### 12.2 Redemption (only on payment success)

At order creation, `Order.promoCodeId` is set if the cart had a promo (added in §6.1 schema migration). The `Order.discountCents` is the locked discount value. `PromoCode.usageCount` is **not** incremented yet.

In `handlePaymentSucceeded` we know the order paid; **only then** do we increment `usageCount` and create `PromoRedemption(orderId, promoCodeId, discountCents)`. This guarantees that a promo with `usageLimit: 100` actually allows exactly 100 paying redemptions; carts that bounce during the funnel never burn one of the 100 slots.

On `payment_intent.payment_failed`, the `Order.promoCodeId` stays for audit (we can see "this customer was using WELCOME10 when their card declined") but no `PromoRedemption` row is ever created and `usageCount` is unchanged.

### 12.3 Race re-validation

Between cart-time apply and order-time redeem, a promo can: (a) be deactivated by admin, (b) hit usageLimit from another customer, (c) expire. `createOrderAndPaymentIntent` re-runs the validation inside its transaction; failure throws `PromoExpiredError`, the order/transaction abort, and the client (in the catch handler of `/api/checkout/create`) gets a 409 → toast "Your promo code is no longer valid" → redirects to `/cart`.

### 12.4 Seed

A single demo promo to exercise paths in tests + dev: `WELCOME10` (PERCENT 10, no min, no expiry, usageLimit 100).

---

## 13. UTM / referrer attribution

### 13.1 Capture

Edge middleware `src/middleware.ts` (or a small route-level helper for safety):

```ts
const url = new URL(req.url);
const params = url.searchParams;
const knownKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
if (knownKeys.some((k) => params.has(k))) {
  const payload = {
    utmSource: params.get('utm_source') ?? null,
    utmMedium: params.get('utm_medium') ?? null,
    utmCampaign: params.get('utm_campaign') ?? null,
    utmTerm: params.get('utm_term') ?? null,
    utmContent: params.get('utm_content') ?? null,
    referrer: req.headers.get('referer') ?? null,
    landingPath: url.pathname,
    capturedAt: new Date().toISOString(),
  };
  res.cookies.set('__ynot_attribution', JSON.stringify(payload), {
    httpOnly: false,            // we want the client store to read it for debug
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,  // 30 days
  });
}
```

**Last-touch wins** — every visit with UTM params overwrites. Empty visits do not clear the cookie.

### 13.2 Persist on order

`createOrderAndPaymentIntent` reads the cookie, parses, and writes `Order.utmSource/Medium/Campaign/Term/Content/referrer/landingPath` from it. Missing cookie → all null (organic visit).

### 13.3 Out of scope

No multi-touch attribution, no time-decay, no campaign attribution dashboard. Phase 6 admin can build a simple "orders by UTM source" report off this data.

---

## 14. Guest checkout & ghost users

### 14.1 Lifecycle

```
[Guest adds to cart] → cart cookie set → cart.userId = null
[Guest enters email + address at /checkout/shipping] → email NOT yet persisted
[Guest clicks Pay at /checkout/payment]
  → POST /api/checkout/create
    → server: no session → look up User by email
      → exists as full user (passwordHash !== null) → 409 "Sign in to continue with this email"
      → exists as ghost (passwordHash === null, isGuest === true) → reuse this user (multiple guest orders possible)
      → does not exist → create ghost user (passwordHash=null, isGuest=true, emailVerified=null)
    → continue Order creation tied to ghost.id
[Stripe payment_intent.succeeded webhook]
  → server: mark Order.status=NEW; emailVerified = now() (the address received the receipt)
[Guest lands on /checkout/success/[id]]
  → server sets order token cookie at order creation time → success page validates this
  → renders <ClaimAccountForm orderId={…} />
[Guest types password + submits]
  → POST /api/account/claim
    → set passwordHash, isGuest=false, emailVerified=now (already)
    → start Auth.js session
  → success page reloads with session — claim form gone
```

### 14.2 Why blocking signed users from "guesting" with their email

If `email@x.com` already exists as a full account, a guest checkout under that email would create two accounts with the same email (we have a unique constraint, so it'd actually fail with a 500). We surface a clean 409: *"This email already has a YNOT account — sign in to place your order."* This avoids account-linking complexity in MVP. Phase 6 admin can manually merge orders if needed.

### 14.3 Multiple ghost orders, single ghost user

A guest who orders twice with the same email reuses the same ghost user record. This means:
- Both orders are tied to the same `userId`.
- Setting a password (claim) on one order's success page upgrades the user → both orders show up in `/account/orders` after claim.
- The second order's success page also shows the claim form (since `User.isGuest` is still true between the two orders if they don't claim immediately).

---

## 15. Tests

### 15.1 Unit

- `src/server/cart/__tests__/service.test.ts`: addItem/removeItem/setQuantity, stock 409, promo apply error codes, snapshot pricing math.
- `src/server/cart/__tests__/merge.test.ts`: merge guest cart into user cart (dedupe, qty cap by stock, promo precedence).
- `src/server/checkout/__tests__/service.test.ts`: createOrderAndPaymentIntent (mocked Stripe SDK) — verifies Order row contents, OrderItem snapshot, Payment row, stock decrement, promo re-validation.
- `src/server/checkout/__tests__/webhook.test.ts`: signature verification, idempotent replay, payment_intent.succeeded → status flip + redemption insert, payment_intent.payment_failed → stock release, unhandled event types return 200.
- `src/server/shipping/__tests__/zones.test.ts`: country → region resolution, MockDhlProvider rate calc per region, RoyalMailFreeProvider returns 0.
- `src/server/promo/__tests__/service.test.ts`: validate, apply, redeem; race re-validation.
- `src/server/attribution/__tests__/cookie.test.ts`: capture + parse + last-touch precedence.

### 15.2 Integration (real Postgres + mocked Stripe SDK)

- `src/app/api/cart/__tests__/cart-flow.test.ts`: full lifecycle — guest add → guest mutate → signin event → merge → user mutate → checkout → payment → completion.
- `src/app/api/checkout/__tests__/checkout-flow.test.ts`: POST /create end-to-end → assert DB state → assert Stripe SDK called with correct args.
- `src/app/api/webhooks/stripe/__tests__/webhook-flow.test.ts`: webhook delivery happy path + replay + bad signature + payment failure → stock release.
- `src/app/api/account/claim/__tests__/claim.test.ts`: ghost → password set → sign-in → redirected.

### 15.3 E2E (Playwright, light suite under `e2e/checkout.spec.ts`)

- Guest checkout: card 4242 → success page renders → claim form appears.
- 3DS: card 4000 0025 0000 3155 → modal → success.
- Declined: card 4000 0000 0000 9995 → inline error → cart preserved.
- Promo apply: WELCOME10 → cart shows discount → checkout total reflects.
- International (US): country select → DHL DDP rate appears → total includes duties.

### 15.4 Test infrastructure

- Reuse Phase 3 `resetDb()` helper; extend to also flush carts and stripe events.
- New helper `mockStripe()` returns a `Stripe`-shaped fake whose `paymentIntents.create` returns a deterministic intent and whose `webhooks.constructEvent` accepts any signature in tests.
- Webhook tests build event payloads manually and pass them through the real `verifySignature` with the test secret `whsec_test_…`.

---

## 16. Operations / observability

- **Logging.** Every webhook event id, type, and outcome (created order id, status, error) logged at info; signature failures logged at warn with truncated body; unexpected errors at error with stack trace. Use `console.log/warn/error` in Phase 4 (structured logger comes in Phase 6).
- **Stripe CLI in dev.** `stripe listen --forward-to localhost:3000/api/webhooks/stripe` produces events in real time. Webhook secret rotates on each `stripe listen` restart — `.env.local` gets updated manually.
- **Failed-payment recovery.** Phase 4 has no automation for recovering `PAYMENT_FAILED` orders or for sending "complete your order" emails. Phase 5 ships a recovery cron + Resend template.
- **Cart cleanup.** `Cart.expiresAt` is set; cron in Phase 5/6 deletes expired guest carts. Phase 4 leaves them.
- **Admin visibility.** Phase 4 has no admin UI — orders are observable only via direct DB query. Phase 6 ships the admin dashboard.

---

## 17. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stripe webhook arrives before client polls success page | High | Medium | Polling loop tolerates either order. Order is already in DB when client lands. |
| Webhook never arrives (network issue) | Low | High | Stripe retries with exponential backoff for 3 days. `PAYMENT_FAILED` orders are visible in DB; manual operator can replay via `stripe events resend evt_…`. |
| Stock oversold by parallel checkouts | Low | Medium | `SELECT ... FOR UPDATE` serialises. Loser sees 409. |
| User pays twice (double-click) | Medium | High | Stripe SDK debounces `confirmPayment`; `idempotency_key` not needed because PaymentIntent itself is idempotent. Backend ignores second `payment_intent.succeeded` via StripeEvent dedupe. |
| Mock DHL rates undercollect on US heavy parcels | Medium | Low | Phase 4 launches in soft-mode; real rates land in Phase 5 before high-volume traffic. |
| Ghost user spams checkout with new orders without claiming | Low | Low | Each order is real money — no fraud incentive. Phase 5 may add bot-protection (Cloudflare Turnstile) on `/checkout/create`. |
| Promo code abuse (one user redeeming many times) | Medium | Low | `usageCount` is global. If a promo needs per-customer-once semantics, Phase 6 adds the constraint. |
| `passwordHash` nullable breaks Phase 3 sign-in | Low | High | Verified: `authorize()` already guards `if (!user.passwordHash) return null`. Repository input type updated. |
| Stripe API version drift | Low | Medium | API version pinned in SDK constructor; webhook handler narrows event types via discriminated union. |

---

## 18. Phase 5 follow-ups (recorded here so they don't get lost)

- Real DHL Express MyDHL API integration — `DhlExpressProvider`, replacing `MockDhlProvider`.
- Real DHL Landed Cost API for accurate DDP duty calculation.
- Resend HTML email templates: order receipt, shipped, delivered, payment failed (recovery).
- Cron: cleanup expired guest carts; cancel stuck `PENDING_PAYMENT` orders + release stock.
- Cron: send "your DHL tracking is now live" emails as shipments dispatch.
- Refund pipeline: `charge.refunded` webhook → `Payment.refundedAmountCents` + `Order.status` transitions.
- Pre-order item flow (`PreorderBatch`) — separate cart UX, separate fulfilment timing, no immediate stock decrement.
- Track Phase 4 known TODO: add `passwordChangedAt` on User and validate in JWT callback to enable "sign out everywhere" (originally noted at end of Phase 3).

---

## 19. Estimated effort

~5–7 working days, three sub-phases:

1. **Cart server + API + client migration** (1.5d) — schema migration, repos, routes, Zustand rewrite, full lifecycle tests.
2. **Shipping + promo + checkout flow rewrites** (1.5d) — providers, zones seed, `/checkout/shipping` rewrite, `/cart` rewrite, checkout-store rewrite.
3. **Stripe PaymentIntent + webhook + Order pipeline + claim CTA** (2d) — `createOrderAndPaymentIntent`, `<PaymentElement />` wiring, webhook handler with idempotency, `/checkout/success` rewrite, `<ClaimAccountForm>`, e2e card test passes against real Stripe Test mode.

Polish/buffer: ~0.5–1d for stock-conflict UX, attribution capture, polish.
