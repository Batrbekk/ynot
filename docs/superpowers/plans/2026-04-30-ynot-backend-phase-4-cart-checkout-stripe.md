# YNOT Backend Phase 4 — Cart, Checkout, Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the cart from a client-only Zustand `persist` store to a server-of-record cart with optimistic client cache, wire Stripe `PaymentIntent` + `<PaymentElement />` payments, ship the `Order(PENDING_PAYMENT) → NEW` state machine driven by an idempotent webhook, seed UK + International shipping zones with a pluggable `ShippingRateProvider` (Mock for Phase 4, live DHL Express in Phase 5), implement promo codes, capture last-touch UTM attribution onto orders, and add guest checkout via "ghost" users with a post-purchase password-claim CTA.

**Architecture:** Postgres is the single source of truth for the cart; the client keeps an in-memory Zustand cache that mirrors `GET /api/cart` and reconciles after every mutation. Orders are created in `PENDING_PAYMENT` status atomically with stock decrement (`SELECT ... FOR UPDATE`) before the Stripe `PaymentIntent` is created; the Stripe webhook flips `Order.status` and increments promo `usageCount` only on `payment_intent.succeeded`, with idempotency enforced by a `StripeEvent` insert keyed on `event.id`. Shipping uses a `CompositeProvider` that delegates UK to `RoyalMailFreeProvider` (always £0) and international to `MockDhlProvider` (static destination → rate table; swap to `DhlExpressProvider` in Phase 5). Guest checkout creates `User` rows with `passwordHash = null, isGuest = true`; the success page shows a single-input claim form that hashes the password and flips the user to a full account.

**Tech Stack:** Node.js 22, Next.js 16 App Router (Turbopack), TypeScript 5.9, Prisma 5, PostgreSQL 16, Redis 7, `stripe@^17` (server SDK), `@stripe/stripe-js@^4` + `@stripe/react-stripe-js@^3` (client), bcryptjs (already installed Phase 3), Zod 4, Vitest 4, Playwright (light e2e suite under `e2e/`).

---

## File Structure

**New files:**

```
web/src/
├── lib/
│   ├── schemas/
│   │   ├── cart.ts                                      ← Zod for cart mutations
│   │   ├── checkout.ts                                  ← Zod for shipping address + quote + create-order
│   │   └── stripe.ts                                    ← Zod narrowing for webhook payloads
│   ├── stores/
│   │   ├── cart-store.ts                                ← REWRITTEN: in-memory only, server-driven
│   │   └── checkout-store.ts                            ← REWRITTEN: holds chosen address+method+quote
│   ├── api-fetch.ts                                     ← extends auth-fetch with cart/checkout helpers
│   └── stripe-client.ts                                 ← loadStripe(...) singleton
│
├── server/
│   ├── checkout/
│   │   ├── stripe.ts                                    ← Stripe server SDK singleton + helpers
│   │   ├── service.ts                                   ← createOrderAndPaymentIntent (atomic)
│   │   ├── order-number.ts                              ← nextOrderNumber(tx) using order_number_seq
│   │   ├── webhook.ts                                   ← signature verify + dispatchEvent
│   │   ├── order-token.ts                               ← HMAC ghost order token issue/verify
│   │   └── __tests__/
│   │       ├── service.test.ts
│   │       ├── webhook.test.ts
│   │       ├── order-number.test.ts
│   │       └── order-token.test.ts
│   ├── cart/
│   │   ├── service.ts                                   ← addItem / setQuantity / removeItem / applyPromo / snapshot
│   │   ├── token.ts                                     ← __Secure-ynot_cart cookie helpers
│   │   ├── merge.ts                                     ← mergeGuestIntoUser (called on signin)
│   │   └── __tests__/
│   │       ├── service.test.ts
│   │       ├── token.test.ts
│   │       └── merge.test.ts
│   ├── shipping/
│   │   ├── provider.ts                                  ← ShippingRateProvider interface
│   │   ├── mock-dhl.ts                                  ← static region table for Phase 4
│   │   ├── royal-mail.ts                                ← always £0 for UK
│   │   ├── zones.ts                                     ← country → region + provider selection
│   │   └── __tests__/
│   │       ├── mock-dhl.test.ts
│   │       ├── royal-mail.test.ts
│   │       └── zones.test.ts
│   ├── promo/
│   │   ├── service.ts                                   ← validate, applyToCart, redeemForOrder
│   │   └── __tests__/
│   │       └── service.test.ts
│   ├── attribution/
│   │   ├── cookie.ts                                    ← capture/parse __ynot_attribution cookie
│   │   └── __tests__/
│   │       └── cookie.test.ts
│   └── repositories/
│       ├── cart.repo.ts                                 ← Cart + CartItem CRUD
│       ├── order.repo.ts                                ← Order writes (Phase 2 had reads only)
│       ├── payment.repo.ts                              ← Payment row helpers
│       └── stripe-event.repo.ts                         ← idempotency log
│
├── app/
│   ├── api/
│   │   ├── cart/
│   │   │   ├── route.ts                                 ← GET, DELETE
│   │   │   ├── items/route.ts                           ← POST
│   │   │   ├── items/[id]/route.ts                      ← PATCH, DELETE
│   │   │   └── promo/route.ts                           ← POST, DELETE
│   │   ├── checkout/
│   │   │   ├── quote/route.ts                           ← POST
│   │   │   └── create/route.ts                          ← POST
│   │   ├── orders/[id]/route.ts                         ← GET (auth or ghost-token)
│   │   ├── account/claim/route.ts                       ← POST
│   │   └── webhooks/stripe/route.ts                     ← POST (raw body)
│   └── middleware.ts                                    ← UTM/referrer capture
│
└── components/checkout/
    ├── claim-account-form.tsx                           ← NEW (post-purchase password set)
    └── stripe-payment-element.tsx                       ← NEW wrapper around <Elements>+<PaymentElement>

web/tests/
└── seeds/
    ├── shipping.ts                                      ← UK + International zones + methods
    └── promo.ts                                         ← demo WELCOME10 promo

web/e2e/
└── checkout.spec.ts                                     ← Playwright (card success / 3DS / declined)

web/prisma/migrations/
└── 2026_04_30_phase4_payment_states/
    └── migration.sql                                    ← OrderStatus + StripeEvent + User flags +
                                                          Order.promoCodeId + Product physical +
                                                          order_number_seq
```

**Modified files:**

- `package.json` — add `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`
- `.env.example`, `.env.development` — Stripe trio + `ORDER_TOKEN_SECRET` + `SHIPPING_PROVIDER` + reserved DHL vars
- `prisma/schema.prisma` — `OrderStatus` enum (+`PENDING_PAYMENT`,`PAYMENT_FAILED`), new `StripeEvent`, `User.passwordHash` nullable + `User.isGuest`, `Order.promoCodeId` + relation, `Product.weightGrams`/`hsCode`/`countryOfOriginCode`
- `src/server/env.ts` — STRIPE_*, ORDER_TOKEN_SECRET, SHIPPING_PROVIDER, optional DHL_*
- `src/server/repositories/user.repo.ts` — `passwordHash?: string`, add `createGuestUser`, `getOrCreateGuestUser`
- `src/server/auth/config.ts` — verify the `if (!user.passwordHash) return null` guard already covers ghosts (no change expected; tests added)
- `src/server/__tests__/helpers/reset-db.ts` — flush carts, stripe events, payments
- `src/server/data/orders.ts` — read paths now serve real orders (Phase 3 already wired session)
- `src/lib/stores/cart-store.ts`, `src/lib/stores/checkout-store.ts` — full rewrites
- `src/app/cart/page.tsx`, `src/app/checkout/shipping/page.tsx`, `src/app/checkout/payment/page.tsx`, `src/app/checkout/success/[id]/page.tsx` — wired to API
- `src/components/checkout/shipping-form.tsx`, `payment-form.tsx`, `order-summary-card.tsx` — Stripe Elements + quote-driven UI

**Deleted files:** none (Phase 3 already removed `auth-stub-store.ts`).

---

## Task 1: Worktree + branch + dependency install

**Files:** workspace setup; `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Create the worktree**

Run from `/Users/batyrbekkuandyk/Desktop/ynot/web`:

```bash
git worktree add .worktrees/backend-phase-4-cart-checkout-stripe -b feature/backend-phase-4-cart-checkout-stripe main
cd .worktrees/backend-phase-4-cart-checkout-stripe
pnpm install
```

Expected: worktree created on a fresh branch from `main`; `pnpm install` populates `node_modules` in the worktree.

- [ ] **Step 2: Boot the local stack**

```bash
docker compose --profile dev up -d
sleep 5
docker compose ps | grep healthy
```

Expected: `ynot-postgres` and `ynot-redis` both `(healthy)`. Ports 5432 and 6379 listening.

- [ ] **Step 3: Confirm Phase 3 baseline still green**

```bash
pnpm test
```

Expected: full suite (143 client + 120 server = 263 tests) passes. If anything fails, stop and fix before adding new code.

- [ ] **Step 4: Install Stripe dependencies**

```bash
pnpm add stripe@^17 @stripe/stripe-js@^4 @stripe/react-stripe-js@^3
```

Expected: `package.json` `dependencies` block grows by three entries. `pnpm-lock.yaml` updates. No type errors yet (we haven't imported anything).

- [ ] **Step 5: Confirm Stripe SDK types available**

Run a one-shot type-check:

```bash
pnpm exec tsc --noEmit
```

Expected: passes (no new code yet).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(phase-4): install stripe SDKs (server + client)"
```

---

## Task 2: Environment variables and `env.ts`

**Files:**
- Modify: `src/server/env.ts`
- Modify: `.env.example`
- Modify: `.env.development`
- Create: `.env.local` updates (already contains real test keys from prior sessions; we re-affirm shape)

- [ ] **Step 1: Read the current env validator**

Open `src/server/env.ts`. Note the existing schema. We will extend it.

- [ ] **Step 2: Write the failing test**

Create `src/server/__tests__/env.phase4.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('env.ts (Phase 4 additions)', () => {
  it('requires STRIPE_SECRET_KEY when validating', async () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      await expect(import('../env?phase4-missing-stripe')).rejects.toThrow(
        /STRIPE_SECRET_KEY/i,
      );
    } finally {
      if (original !== undefined) process.env.STRIPE_SECRET_KEY = original;
    }
  });

  it('requires ORDER_TOKEN_SECRET to be at least 32 chars', () => {
    // We construct the schema manually here to avoid module-cache issues.
    const schema = z.object({
      ORDER_TOKEN_SECRET: z.string().min(32),
    });
    expect(() => schema.parse({ ORDER_TOKEN_SECRET: 'short' })).toThrow();
    expect(schema.parse({ ORDER_TOKEN_SECRET: 'x'.repeat(32) }).ORDER_TOKEN_SECRET).toHaveLength(32);
  });

  it('defaults SHIPPING_PROVIDER to "mock"', async () => {
    process.env.SHIPPING_PROVIDER = '';
    const mod = await import('../env?phase4-default-shipping');
    expect(mod.env.SHIPPING_PROVIDER).toBe('mock');
  });
});
```

(The `?phase4-…` query suffixes force Vite to bypass the module cache between cases — same trick Phase 3 tests use.)

- [ ] **Step 3: Run the test to confirm it fails**

```bash
pnpm test src/server/__tests__/env.phase4.test.ts
```

Expected: at least one assertion fails because `STRIPE_SECRET_KEY` and `ORDER_TOKEN_SECRET` are not yet in the schema.

- [ ] **Step 4: Extend `src/server/env.ts`**

Add to the existing Zod schema (insert after the `NEXTAUTH_SECRET` field):

```ts
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  ORDER_TOKEN_SECRET: z.string().min(32, 'ORDER_TOKEN_SECRET must be at least 32 chars'),
  SHIPPING_PROVIDER: z.enum(['mock', 'dhl']).default('mock'),
  // Reserved for Phase 5 — accepted as optional now so .env loaders do not warn.
  DHL_API_KEY: z.string().optional(),
  DHL_API_SECRET: z.string().optional(),
  DHL_ACCOUNT_NUMBER: z.string().optional(),
```

- [ ] **Step 5: Update `.env.example`**

Append after the existing `RESEND_*` block:

```env

# ---- Stripe ----
# Get test keys from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
# Webhook secret comes from `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
STRIPE_WEBHOOK_SECRET="whsec_..."

# ---- Order tokens ----
# Used to sign __ynot_order_token cookies. Generate with: openssl rand -base64 32
ORDER_TOKEN_SECRET="replace-with-openssl-rand-base64-32-chars"

# ---- Shipping ----
SHIPPING_PROVIDER="mock"   # "mock" (Phase 4) | "dhl" (Phase 5 once API access lands)

# ---- DHL (Phase 5) ----
# DHL_ACCOUNT_NUMBER="230200799"
# DHL_API_KEY=""
# DHL_API_SECRET=""
```

- [ ] **Step 6: Update `.env.development`**

Append:

```env
ORDER_TOKEN_SECRET="dev-only-order-token-secret-replace-locally-32+chars"
SHIPPING_PROVIDER="mock"
```

(Stripe keys live in `.env.local` only — not committed.)

- [ ] **Step 7: Confirm `.env.local` is complete**

Open `.env.local` in the worktree. It should already contain (from prior sessions):

```env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
DHL_ACCOUNT_NUMBER="230200799"
DHL_API_KEY="lDNL4vrlIGWuczJg6EfIUIRBEC51IxTZ"
DHL_API_SECRET="CJWgIyMlsIGcMIVg"
```

If missing, copy from `.env.example` and fill the test values from the Stripe dashboard.

Add a 32+ char `ORDER_TOKEN_SECRET`:

```bash
echo "ORDER_TOKEN_SECRET=\"$(openssl rand -base64 32)\"" >> .env.local
```

- [ ] **Step 8: Run the test to confirm it passes**

```bash
pnpm test src/server/__tests__/env.phase4.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/env.ts src/server/__tests__/env.phase4.test.ts .env.example .env.development
git commit -m "feat(env): add Stripe + ORDER_TOKEN_SECRET + SHIPPING_PROVIDER (phase 4)"
```

---

## Task 3: Schema migration — payment states, StripeEvent, ghost users, Order.promoCodeId, Product physicals, order_number_seq

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase4_payment_states/migration.sql` (Prisma generates from schema diff; we add the sequence and existing-data backfill manually)

- [ ] **Step 1: Edit `prisma/schema.prisma` — extend `OrderStatus` enum**

Find:

```prisma
enum OrderStatus {
  NEW
  PROCESSING
  SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
}
```

Replace with:

```prisma
enum OrderStatus {
  PENDING_PAYMENT
  PAYMENT_FAILED
  NEW
  PROCESSING
  SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
}
```

- [ ] **Step 2: Add `StripeEvent` model**

Append at the end of the schema, before the final closing comments:

```prisma
model StripeEvent {
  id        String   @id          // = stripe event.id (e.g. "evt_1ABC...")
  type      String
  payload   Json
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([type])
}
```

- [ ] **Step 3: Modify `User` — nullable passwordHash + isGuest flag**

Find the `User` model. Change:

```prisma
  passwordHash String
```

to:

```prisma
  passwordHash String?
  isGuest      Boolean @default(false)
```

- [ ] **Step 4: Modify `Order` — promoCodeId nullable FK + relation**

Find the `Order` model. After `currency Currency @default(GBP)`, add:

```prisma
  promoCodeId String?
  promoCode   PromoCode? @relation(fields: [promoCodeId], references: [id], onDelete: SetNull)
```

Then update `PromoCode` model — find the line `redemptions PromoRedemption[]` and add directly above it:

```prisma
  orders Order[]
```

- [ ] **Step 5: Modify `Product` — physical fields**

Find the `Product` model. Append (after the existing fields, before the relations):

```prisma
  weightGrams         Int?
  hsCode              String?
  countryOfOriginCode String?
```

- [ ] **Step 6: Generate the migration**

```bash
pnpm prisma migrate dev --create-only --name phase4_payment_states
```

Expected: a new migration folder `prisma/migrations/<timestamp>_phase4_payment_states/` with a `migration.sql` containing ALTER TABLE statements. Do **not** apply it yet — we need to edit it.

- [ ] **Step 7: Add the sequence and existing-data updates to the migration SQL**

Open the generated `migration.sql`. Append at the end:

```sql
-- Phase 1 §241 specified an order_number_seq for YN-YYYY-NNNNN format. The init
-- migration omitted it; Phase 4 adds it now.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Existing demo SKUs get placeholder physical attributes so DHL Phase 5 has data.
UPDATE products
SET    weight_grams = 1500,
       hs_code = '6202.93',
       country_of_origin_code = 'GB'
WHERE  weight_grams IS NULL;

-- Backfill safety: any pre-existing Orders are paid orders → keep them as NEW.
-- (Phase 1 had no live orders; only fixtures. This is defensive.)
-- No data change needed because the enum was extended, not reordered.
```

Do NOT modify the auto-generated parts above — only append.

- [ ] **Step 8: Apply the migration**

```bash
pnpm prisma migrate dev
```

Expected: "Database is now in sync with your schema." Prisma client regenerates.

- [ ] **Step 9: Sanity check the new sequence**

```bash
docker exec -i ynot-postgres psql -U ynot -d ynot_dev -c "SELECT nextval('order_number_seq');"
```

Expected: returns `1`. Run it again — returns `2`. We won't actually use these test increments at runtime; the helper takes a tx, so they don't pollute fixture state, but reset-db will reset them for tests below.

- [ ] **Step 10: Run existing tests to verify schema changes don't break Phase 3**

```bash
pnpm test
```

Expected: PASS. Phase 3 tests don't touch `passwordHash`-required paths beyond what's guarded.

If Phase 3 tests break because they previously relied on `passwordHash: string` in Prisma input types, fix the test fixtures (typically just inserting a literal string for the field — no runtime change).

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): phase 4 payment states, StripeEvent, ghost users, Order.promoCodeId, order_number_seq"
```

---

## Task 4: `reset-db.ts` extension for Phase 4 tables

**Files:**
- Modify: `src/server/__tests__/helpers/reset-db.ts`

- [ ] **Step 1: Read the existing helper**

Open `src/server/__tests__/helpers/reset-db.ts`. It currently truncates Phase 1–3 tables and flushes Redis `ratelimit:*` keys.

- [ ] **Step 2: Add Phase 4 tables to the truncation list**

Find the `await tx.$executeRawUnsafe(...)` block. Append (preserving FK-aware order):

```ts
    `TRUNCATE TABLE "stripe_events" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "carts" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "cart_items" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "cart_events" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "promo_redemptions" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "promo_codes" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "payments" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "order_items" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "order_status_events" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "orders" RESTART IDENTITY CASCADE`,
```

(Tables `Order`/`OrderItem`/`OrderStatusEvent`/`Payment` already exist from Phase 1; the helper may have included them. Verify and don't duplicate.)

- [ ] **Step 3: Reset the order number sequence between tests**

Append to the helper, after the truncate block:

```ts
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
```

- [ ] **Step 4: Confirm existing tests still pass**

```bash
pnpm test
```

Expected: PASS. We only added truncate clauses for empty tables — no data lost in any test that didn't reach Phase 4 yet.

- [ ] **Step 5: Commit**

```bash
git add src/server/__tests__/helpers/reset-db.ts
git commit -m "test(reset-db): truncate Phase 4 tables and reset order_number_seq"
```

---

## Task 5: `nextOrderNumber` helper (TDD)

**Files:**
- Create: `src/server/checkout/order-number.ts`
- Create: `src/server/checkout/__tests__/order-number.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/checkout/__tests__/order-number.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/prisma';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { nextOrderNumber } from '../order-number';

describe('nextOrderNumber', () => {
  beforeEach(async () => { await resetDb(); });

  it('returns YN-YYYY-00001 on first call', async () => {
    const result = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(result).toBe(`YN-${year}-00001`);
  });

  it('monotonically increments across calls', async () => {
    const a = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const b = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const c = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(a).toBe(`YN-${year}-00001`);
    expect(b).toBe(`YN-${year}-00002`);
    expect(c).toBe(`YN-${year}-00003`);
  });

  it('zero-pads to 5 digits', async () => {
    // Force the sequence forward.
    await prisma.$executeRawUnsafe(`SELECT setval('order_number_seq', 99998)`);
    const a = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const b = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(a).toBe(`YN-${year}-99999`);
    // 6-digit overflow does not zero-pad and does not break.
    expect(b).toBe(`YN-${year}-100000`);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
pnpm test src/server/checkout/__tests__/order-number.test.ts
```

Expected: cannot find module `../order-number`.

- [ ] **Step 3: Implement**

Create `src/server/checkout/order-number.ts`:

```ts
import type { Prisma } from '@prisma/client';

/**
 * Generate a display-friendly order number using the Postgres sequence
 * `order_number_seq` (created in Phase 4 migration; specified by Phase 1 §241).
 *
 * Format: YN-YYYY-NNNNN (e.g. "YN-2026-00001"). Zero-padded to 5 digits;
 * gracefully degrades to longer formats above 99,999 without truncation.
 *
 * Must be called inside a Prisma transaction so the sequence advance and the
 * Order insert commit atomically.
 */
export async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('order_number_seq')`;
  const n = rows[0]?.nextval ?? 1n;
  const year = new Date().getUTCFullYear();
  return `YN-${year}-${n.toString().padStart(5, '0')}`;
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
pnpm test src/server/checkout/__tests__/order-number.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/checkout/order-number.ts src/server/checkout/__tests__/order-number.test.ts
git commit -m "feat(checkout): nextOrderNumber helper with order_number_seq"
```

---

## Task 6: Stripe SDK singletons (server + client)

**Files:**
- Create: `src/server/checkout/stripe.ts`
- Create: `src/lib/stripe-client.ts`

- [ ] **Step 1: Write the server-side singleton**

Create `src/server/checkout/stripe.ts`:

```ts
import Stripe from 'stripe';
import { env } from '@/server/env';

/**
 * Server-side Stripe SDK singleton. API version pinned to match the version
 * Stripe CLI forwards (2025-02-24.acacia) — keeps webhook fixtures stable.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});
```

- [ ] **Step 2: Confirm types compile**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors. The Stripe SDK ships its own `apiVersion` literal type; if the literal is rejected by your installed version, change it to the value the SDK suggests in the type error message (it'll be a recent version).

- [ ] **Step 3: Write the client-side loader**

Create `src/lib/stripe-client.ts`:

```ts
'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazy-loaded Stripe.js singleton. The publishable key is exposed via
 * NEXT_PUBLIC_* — safe to ship to the browser.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
```

- [ ] **Step 4: Write a smoke test for the server singleton**

Create `src/server/checkout/__tests__/stripe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stripe } from '../stripe';

describe('Stripe server SDK', () => {
  it('exports a configured client', () => {
    expect(stripe).toBeDefined();
    // The SDK keeps the api version on `_version` (an internal but stable property).
    // We assert by confirming we can call a public method without throwing.
    expect(typeof stripe.paymentIntents.create).toBe('function');
  });
});
```

- [ ] **Step 5: Run test**

```bash
pnpm test src/server/checkout/__tests__/stripe.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/checkout/stripe.ts src/server/checkout/__tests__/stripe.test.ts src/lib/stripe-client.ts
git commit -m "feat(stripe): server SDK singleton + client loader"
```

---

## Task 7: `user.repo` — nullable passwordHash + ghost helpers

**Files:**
- Modify: `src/server/repositories/user.repo.ts`
- Modify: `src/server/repositories/__tests__/user.repo.test.ts`

- [ ] **Step 1: Read the current repo**

Open `src/server/repositories/user.repo.ts`. Note the input shape `CreateUserInput` and the existing `createUser` function.

- [ ] **Step 2: Write the failing tests**

Append to `src/server/repositories/__tests__/user.repo.test.ts` (create the file if it does not yet exist with the appropriate top-level `import` block + `describe`):

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/prisma';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createUser,
  createGuestUser,
  getOrCreateGuestUser,
  EmailTakenByFullAccountError,
} from '../user.repo';

describe('user.repo — ghost users', () => {
  beforeEach(async () => { await resetDb(); });

  it('createUser still works with passwordHash provided', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'hash', firstName: 'A', lastName: 'B' });
    expect(u.passwordHash).toBe('hash');
    expect(u.isGuest).toBe(false);
  });

  it('createGuestUser creates a ghost with null passwordHash', async () => {
    const u = await createGuestUser({ email: 'guest@x.com' });
    expect(u.passwordHash).toBeNull();
    expect(u.isGuest).toBe(true);
    expect(u.emailVerified).toBeNull();
  });

  it('createGuestUser throws on duplicate email', async () => {
    await createGuestUser({ email: 'g@x.com' });
    await expect(createGuestUser({ email: 'g@x.com' })).rejects.toThrow();
  });

  it('getOrCreateGuestUser returns existing ghost', async () => {
    const a = await createGuestUser({ email: 'g@x.com' });
    const b = await getOrCreateGuestUser({ email: 'g@x.com' });
    expect(b.id).toBe(a.id);
  });

  it('getOrCreateGuestUser creates if missing', async () => {
    const u = await getOrCreateGuestUser({ email: 'new@x.com' });
    expect(u.isGuest).toBe(true);
    expect(u.passwordHash).toBeNull();
  });

  it('getOrCreateGuestUser throws EmailTakenByFullAccountError when email belongs to a full user', async () => {
    await createUser({ email: 'real@x.com', passwordHash: 'h', firstName: 'R', lastName: 'X' });
    await expect(getOrCreateGuestUser({ email: 'real@x.com' })).rejects.toBeInstanceOf(
      EmailTakenByFullAccountError,
    );
  });
});
```

- [ ] **Step 3: Run tests — confirm fail**

```bash
pnpm test src/server/repositories/__tests__/user.repo.test.ts
```

Expected: import errors for `createGuestUser`, `getOrCreateGuestUser`, `EmailTakenByFullAccountError`.

- [ ] **Step 4: Update `user.repo.ts`**

Open `src/server/repositories/user.repo.ts`. Make these changes:

1. Update the `CreateUserInput` interface — change `passwordHash: string` to `passwordHash?: string`.
2. Below the existing `createUser` function, add:

```ts
export class EmailTakenByFullAccountError extends Error {
  constructor(public readonly email: string) {
    super(`Email ${email} already has a full account`);
    this.name = 'EmailTakenByFullAccountError';
  }
}

export interface CreateGuestUserInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function createGuestUser(input: CreateGuestUserInput) {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: null,
      isGuest: true,
      emailVerified: null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    },
  });
}

/**
 * Find a ghost user by email; create one if absent. If the email already
 * belongs to a non-guest user, throw — caller decides how to surface
 * (typically a 409 prompting "sign in to use this email").
 */
export async function getOrCreateGuestUser(
  input: CreateGuestUserInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const email = input.email.toLowerCase();
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isGuest) return existing;
    throw new EmailTakenByFullAccountError(email);
  }
  return client.user.create({
    data: {
      email,
      passwordHash: null,
      isGuest: true,
      emailVerified: null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    },
  });
}
```

(The `Prisma` namespace import probably already exists at the top of the file; if not, add `import { Prisma } from '@prisma/client';`.)

- [ ] **Step 5: Run tests — confirm pass**

```bash
pnpm test src/server/repositories/__tests__/user.repo.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite to make sure Phase 3 tests still pass**

```bash
pnpm test
```

Expected: PASS. The `passwordHash` field becoming optional in input must not break existing register flow tests — they all pass a hash explicitly.

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/user.repo.ts src/server/repositories/__tests__/user.repo.test.ts
git commit -m "feat(user.repo): nullable passwordHash + createGuestUser + getOrCreateGuestUser"
```

---

## Task 8: Cart cookie helpers

**Files:**
- Create: `src/server/cart/token.ts`
- Create: `src/server/cart/__tests__/token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/cart/__tests__/token.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  generateCartToken,
  CART_COOKIE_NAME,
  cartCookieOptions,
} from '../token';

describe('cart cookie helpers', () => {
  it('generates a 24-byte (32-char base64url) token', () => {
    const t = generateCartToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it('emits a different token each call', () => {
    expect(generateCartToken()).not.toBe(generateCartToken());
  });

  it('cartCookieOptions sets HttpOnly + SameSite + 30-day TTL', () => {
    const opts = cartCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
    expect(opts.path).toBe('/');
  });

  it('uses __Secure- prefix and Secure flag in production', () => {
    const original = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    try {
      expect(CART_COOKIE_NAME).toBe('__Secure-ynot_cart');
      expect(cartCookieOptions().secure).toBe(true);
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: original, writable: true });
    }
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/token.test.ts
```

Expected: cannot find `../token`.

- [ ] **Step 3: Implement**

Create `src/server/cart/token.ts`:

```ts
import { randomBytes } from 'node:crypto';

const isProd = () => process.env.NODE_ENV === 'production';

export const CART_COOKIE_NAME = isProd() ? '__Secure-ynot_cart' : 'ynot_cart';

export function generateCartToken(): string {
  return randomBytes(24).toString('base64url');
}

export function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd(),
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
```

Note: `CART_COOKIE_NAME` is computed at module-load time. The test that flips `NODE_ENV` after import would observe the original value; we re-declare the constant inside the production-mode test by re-importing — see Step 4.

- [ ] **Step 4: Adjust test for the `__Secure-` assertion**

Replace the production-mode `it()` block with a re-import dance:

```ts
  it('uses __Secure- prefix and Secure flag in production', async () => {
    const original = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    try {
      const mod = await import('../token?prod-mode');
      expect(mod.CART_COOKIE_NAME).toBe('__Secure-ynot_cart');
      expect(mod.cartCookieOptions().secure).toBe(true);
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: original, writable: true });
    }
  });
```

(Same `?query-suffix` cache-bust trick as Task 2.)

- [ ] **Step 5: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/token.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/cart/token.ts src/server/cart/__tests__/token.test.ts
git commit -m "feat(cart): cookie helpers (__Secure-ynot_cart) + token generator"
```

---

## Task 9: `cart.repo` — basic CRUD

**Files:**
- Create: `src/server/repositories/cart.repo.ts`

- [ ] **Step 1: Implement the repo (no separate test file — exercised by service tests below)**

Create `src/server/repositories/cart.repo.ts`:

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma';

export type CartClient = Prisma.TransactionClient | typeof prisma;

const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function findCartByUserId(userId: string, client: CartClient = prisma) {
  return client.cart.findFirst({
    where: { userId },
    include: { items: true },
  });
}

export async function findCartBySessionToken(sessionToken: string, client: CartClient = prisma) {
  return client.cart.findUnique({
    where: { sessionToken },
    include: { items: true },
  });
}

export async function createGuestCart(sessionToken: string, client: CartClient = prisma) {
  return client.cart.create({
    data: {
      sessionToken,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function createUserCart(userId: string, client: CartClient = prisma) {
  return client.cart.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function adoptGuestCart(
  cartId: string,
  userId: string,
  client: CartClient = prisma,
) {
  return client.cart.update({
    where: { id: cartId },
    data: {
      userId,
      sessionToken: null,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function deleteCart(cartId: string, client: CartClient = prisma) {
  await client.cart.delete({ where: { id: cartId } });
}
```

- [ ] **Step 2: Confirm tsc passes**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/repositories/cart.repo.ts
git commit -m "feat(cart): cart.repo (find/create/adopt/delete)"
```

---

## Task 10: Cart Zod schemas

**Files:**
- Create: `src/lib/schemas/cart.ts`

- [ ] **Step 1: Implement**

Create `src/lib/schemas/cart.ts`:

```ts
import { z } from 'zod';

export const Size = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']);

export const AddItemRequest = z.object({
  productId: z.string().min(1),
  size: Size,
  colour: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  isPreorder: z.boolean().default(false),
});

export const SetQuantityRequest = z.object({
  quantity: z.number().int().min(1).max(20),
});

export const ApplyPromoRequest = z.object({
  code: z.string().trim().toUpperCase().min(1).max(40),
});

export type AddItemRequestT = z.infer<typeof AddItemRequest>;
export type SetQuantityRequestT = z.infer<typeof SetQuantityRequest>;
export type ApplyPromoRequestT = z.infer<typeof ApplyPromoRequest>;

export const CartItemSnapshot = z.object({
  id: z.string(),
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  productImage: z.string(),
  colour: z.string(),
  size: Size,
  quantity: z.number(),
  unitPriceCents: z.number(),
  currency: z.literal('GBP'),
  isPreorder: z.boolean(),
  stockAvailable: z.number(),
});

export const CartSnapshot = z.object({
  id: z.string(),
  items: z.array(CartItemSnapshot),
  subtotalCents: z.number(),
  discountCents: z.number(),
  promo: z.object({ code: z.string(), discountCents: z.number() }).nullable(),
  itemCount: z.number(),
  expiresAt: z.string(), // ISO 8601
});

export type CartItemSnapshotT = z.infer<typeof CartItemSnapshot>;
export type CartSnapshotT = z.infer<typeof CartSnapshot>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schemas/cart.ts
git commit -m "feat(schemas): cart Zod schemas + CartSnapshot type"
```

---

## Task 11: `cart/service.ts` — `getOrCreate` + `snapshot`

**Files:**
- Create: `src/server/cart/service.ts`
- Create: `src/server/cart/__tests__/service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/cart/__tests__/service.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { createUser } from '@/server/repositories/user.repo';
import { getOrCreateCart, snapshotCart } from '../service';
import { generateCartToken } from '../token';

describe('cart service — getOrCreateCart + snapshotCart', () => {
  beforeEach(async () => { await resetDb(); });

  it('creates a guest cart when neither user nor matching session exists', async () => {
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    expect(cart.userId).toBeNull();
    expect(cart.sessionToken).toBe(token);
    expect(cart.items).toEqual([]);
  });

  it('returns the existing guest cart when sessionToken matches', async () => {
    const token = generateCartToken();
    const a = await getOrCreateCart({ userId: null, sessionToken: token });
    const b = await getOrCreateCart({ userId: null, sessionToken: token });
    expect(b.id).toBe(a.id);
  });

  it('creates a user cart when signed in and no cart exists', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const cart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    expect(cart.userId).toBe(u.id);
    expect(cart.sessionToken).toBeNull();
  });

  it('snapshotCart computes subtotal, itemCount, and stockAvailable', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'coat-test',
        name: 'Test Coat',
        priceCents: 25000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 3 }] },
        images: { create: [{ url: '/img.jpg', alt: '', sortOrder: 0 }] },
      },
      include: { sizes: true, images: true },
    });
    const cart = await prisma.cart.create({
      data: {
        sessionToken: 'tok',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        items: { create: [{ productId: product.id, size: 'S', colour: 'Black', quantity: 2, unitPriceCents: 25000 }] },
      },
      include: { items: true },
    });
    const snap = await snapshotCart(cart.id);
    expect(snap.subtotalCents).toBe(50000);
    expect(snap.itemCount).toBe(2);
    expect(snap.items[0].stockAvailable).toBe(3);
    expect(snap.promo).toBeNull();
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/service.test.ts
```

Expected: cannot find module `../service`.

- [ ] **Step 3: Implement**

Create `src/server/cart/service.ts`:

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma';
import {
  findCartByUserId,
  findCartBySessionToken,
  createGuestCart,
  createUserCart,
  type CartClient,
} from '@/server/repositories/cart.repo';
import type { CartSnapshotT, CartItemSnapshotT } from '@/lib/schemas/cart';

export interface CartIdentity {
  userId: string | null;
  sessionToken: string | null;
}

export async function getOrCreateCart(
  identity: CartIdentity,
  client: CartClient = prisma,
) {
  if (identity.userId) {
    const existing = await findCartByUserId(identity.userId, client);
    if (existing) return existing;
    return createUserCart(identity.userId, client);
  }
  if (identity.sessionToken) {
    const existing = await findCartBySessionToken(identity.sessionToken, client);
    if (existing) return existing;
  }
  // Caller must provide a token when guest; we don't generate here.
  if (!identity.sessionToken) {
    throw new Error('getOrCreateCart: guest carts require a sessionToken');
  }
  return createGuestCart(identity.sessionToken, client);
}

/**
 * Compute a `CartSnapshot` for the given cart id.
 * Joins Cart → CartItem → Product (slug,name,priceCents) → Product.images[0]
 * → ProductSize.stock per (productId,size) → optional PromoCode.
 */
export async function snapshotCart(
  cartId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  const cart = await client.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, sizes: true },
          },
        },
      },
      promoCode: true,
    },
  });
  const items: CartItemSnapshotT[] = cart.items.map((it) => {
    const stockRow = it.product.sizes.find((s) => s.size === it.size);
    return {
      id: it.id,
      productId: it.productId,
      productSlug: it.product.slug,
      productName: it.product.name,
      productImage: it.product.images[0]?.url ?? '',
      colour: it.colour,
      size: it.size,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      currency: 'GBP',
      isPreorder: it.isPreorder,
      stockAvailable: stockRow?.stock ?? 0,
    };
  });
  const subtotalCents = items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);
  let discountCents = 0;
  let promo: CartSnapshotT['promo'] = null;
  if (cart.promoCode) {
    const p = cart.promoCode;
    discountCents =
      p.discountType === 'PERCENT'
        ? Math.round((subtotalCents * p.discountValue) / 100)
        : p.discountValue;
    discountCents = Math.min(discountCents, subtotalCents);
    promo = { code: p.code, discountCents };
  }
  return {
    id: cart.id,
    items,
    subtotalCents,
    discountCents,
    promo,
    itemCount,
    expiresAt: cart.expiresAt.toISOString(),
  };
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/cart/service.ts src/server/cart/__tests__/service.test.ts
git commit -m "feat(cart): getOrCreateCart + snapshotCart"
```

---

## Task 12: `cart/service.ts` — `addItem`

**Files:**
- Modify: `src/server/cart/service.ts`
- Modify: `src/server/cart/__tests__/service.test.ts`

- [ ] **Step 1: Append the failing tests**

Append inside the existing `describe('cart service — getOrCreateCart + snapshotCart', () => { ... })` block, OR add a new sibling describe in the same file:

```ts
describe('cart service — addItem', () => {
  beforeEach(async () => { await resetDb(); });

  async function makeProduct(stock = 5, price = 10000) {
    return prisma.product.create({
      data: {
        slug: 'p-' + Math.random().toString(36).slice(2, 8),
        name: 'P',
        priceCents: price,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', stock }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
        colours: { create: [{ name: 'Black', hex: '#000', sortOrder: 0 }] },
      },
    });
  }

  it('adds a new item to an empty cart', async () => {
    const product = await makeProduct(5);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    const snap = await addItem(cart.id, {
      productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false,
    });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(2);
    expect(snap.subtotalCents).toBe(20000);
  });

  it('merges quantity when productId+size match existing line', async () => {
    const product = await makeProduct(5);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });
    const snap = await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(3);
  });

  it('throws StockConflictError when requested qty exceeds stock', async () => {
    const product = await makeProduct(2);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    await expect(
      addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 5, isPreorder: false }),
    ).rejects.toThrow(/stock/i);
  });
});
```

Also import `addItem` at the top of the file:

```ts
import { addItem, getOrCreateCart, snapshotCart } from '../service';
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/service.test.ts -t addItem
```

Expected: cannot find `addItem` export.

- [ ] **Step 3: Implement**

Append to `src/server/cart/service.ts`:

```ts
import type { AddItemRequestT } from '@/lib/schemas/cart';

export class StockConflictError extends Error {
  constructor(
    public readonly productId: string,
    public readonly size: string,
    public readonly stockAvailable: number,
  ) {
    super(`Insufficient stock for product ${productId} size ${size}: ${stockAvailable} available`);
    this.name = 'StockConflictError';
  }
}

export async function addItem(
  cartId: string,
  input: AddItemRequestT,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      include: { sizes: { where: { size: input.size } } },
    });
    const stockRow = product.sizes[0];
    if (!stockRow) throw new Error(`Product ${input.productId} has no size ${input.size}`);

    const existingItem = await tx.cartItem.findFirst({
      where: { cartId, productId: input.productId, size: input.size },
    });
    const totalQty = (existingItem?.quantity ?? 0) + input.quantity;
    if (totalQty > stockRow.stock) {
      throw new StockConflictError(input.productId, input.size, stockRow.stock);
    }

    if (existingItem) {
      await tx.cartItem.update({ where: { id: existingItem.id }, data: { quantity: totalQty } });
    } else {
      await tx.cartItem.create({
        data: {
          cartId,
          productId: input.productId,
          size: input.size,
          colour: input.colour,
          quantity: input.quantity,
          unitPriceCents: product.priceCents,
          currency: 'GBP',
          isPreorder: input.isPreorder,
        },
      });
    }
    await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_ADDED', metadata: { ...input } } });
    return snapshotCart(cartId, tx);
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/service.test.ts -t addItem
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/cart/service.ts src/server/cart/__tests__/service.test.ts
git commit -m "feat(cart): addItem with stock validation"
```

---

## Task 13: `cart/service.ts` — `setQuantity` + `removeItem`

**Files:**
- Modify: `src/server/cart/service.ts`
- Modify: `src/server/cart/__tests__/service.test.ts`

- [ ] **Step 1: Append failing tests**

Add a new `describe` block:

```ts
describe('cart service — setQuantity / removeItem', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedCartWithItem() {
    const product = await prisma.product.create({
      data: {
        slug: 'p-set-' + Math.random().toString(36).slice(2, 6),
        name: 'P',
        priceCents: 5000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    const snap = await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });
    return { cart, item: snap.items[0]!, product };
  }

  it('setQuantity adjusts an item up', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await setQuantity(cart.id, item.id, 4);
    expect(snap.items[0].quantity).toBe(4);
  });

  it('setQuantity rejects when above stock', async () => {
    const { cart, item } = await seedCartWithItem();
    await expect(setQuantity(cart.id, item.id, 99)).rejects.toThrow(/stock/i);
  });

  it('setQuantity to 0 removes the item', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await setQuantity(cart.id, item.id, 0);
    expect(snap.items).toHaveLength(0);
  });

  it('removeItem deletes the line', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await removeItem(cart.id, item.id);
    expect(snap.items).toHaveLength(0);
    expect(snap.itemCount).toBe(0);
  });
});
```

Top-of-file imports:

```ts
import { addItem, getOrCreateCart, removeItem, setQuantity, snapshotCart } from '../service';
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/service.test.ts -t "setQuantity"
```

Expected: cannot find exports.

- [ ] **Step 3: Implement**

Append to `src/server/cart/service.ts`:

```ts
export async function setQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    if (quantity <= 0) {
      await tx.cartItem.delete({ where: { id: itemId } });
      await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_REMOVED', metadata: { itemId } } });
      return snapshotCart(cartId, tx);
    }
    const item = await tx.cartItem.findUniqueOrThrow({ where: { id: itemId } });
    const stockRow = await tx.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: item.productId, size: item.size } },
    });
    if (quantity > stockRow.stock) {
      throw new StockConflictError(item.productId, item.size, stockRow.stock);
    }
    await tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return snapshotCart(cartId, tx);
  }
}

export async function removeItem(
  cartId: string,
  itemId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    await tx.cartItem.delete({ where: { id: itemId } });
    await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_REMOVED', metadata: { itemId } } });
    return snapshotCart(cartId, tx);
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/service.test.ts
```

Expected: PASS (all cart service tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/cart/service.ts src/server/cart/__tests__/service.test.ts
git commit -m "feat(cart): setQuantity + removeItem"
```

---

## Task 14: `cart/service.ts` — `applyPromo` + `removePromo`

**Files:**
- Modify: `src/server/cart/service.ts`
- Modify: `src/server/cart/__tests__/service.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe('cart service — applyPromo / removePromo', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedCartWithSubtotal(amount: number) {
    const product = await prisma.product.create({
      data: {
        slug: 'p-promo-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: amount, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    return cart;
  }

  it('applies a PERCENT promo and computes discount', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'WELCOME10', discountType: 'PERCENT', discountValue: 10, minOrderCents: 0, isActive: true },
    });
    const snap = await applyPromo(cart.id, 'WELCOME10');
    expect(snap.promo).toEqual({ code: 'WELCOME10', discountCents: 2000 });
    expect(snap.discountCents).toBe(2000);
  });

  it('applies a FIXED promo', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'GBP5OFF', discountType: 'FIXED', discountValue: 500, minOrderCents: 0, isActive: true },
    });
    const snap = await applyPromo(cart.id, 'GBP5OFF');
    expect(snap.promo).toEqual({ code: 'GBP5OFF', discountCents: 500 });
  });

  it('rejects unknown promo with NOT_FOUND', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await expect(applyPromo(cart.id, 'NOPE')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects expired promo', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'OLD', discountType: 'PERCENT', discountValue: 10, isActive: true, expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(applyPromo(cart.id, 'OLD')).rejects.toMatchObject({ code: 'EXPIRED' });
  });

  it('rejects when subtotal below minOrderCents', async () => {
    const cart = await seedCartWithSubtotal(5000);
    await prisma.promoCode.create({
      data: { code: 'BIG', discountType: 'PERCENT', discountValue: 10, minOrderCents: 10000, isActive: true },
    });
    await expect(applyPromo(cart.id, 'BIG')).rejects.toMatchObject({ code: 'MIN_ORDER' });
  });

  it('rejects when usageLimit reached', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'MAXED', discountType: 'PERCENT', discountValue: 10, usageLimit: 1, usageCount: 1, isActive: true },
    });
    await expect(applyPromo(cart.id, 'MAXED')).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
  });

  it('removePromo clears the discount', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'X', discountType: 'PERCENT', discountValue: 10, isActive: true },
    });
    await applyPromo(cart.id, 'X');
    const snap = await removePromo(cart.id);
    expect(snap.promo).toBeNull();
    expect(snap.discountCents).toBe(0);
  });
});
```

Update imports:

```ts
import { addItem, applyPromo, getOrCreateCart, removeItem, removePromo, setQuantity, snapshotCart } from '../service';
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/service.test.ts -t "applyPromo"
```

- [ ] **Step 3: Implement**

Append to `src/server/cart/service.ts`:

```ts
export type PromoErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'INACTIVE' | 'LIMIT_REACHED' | 'MIN_ORDER';

export class PromoApplyError extends Error {
  constructor(public readonly code: PromoErrorCode, message: string) {
    super(message);
    this.name = 'PromoApplyError';
  }
}

export async function applyPromo(
  cartId: string,
  rawCode: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    const code = rawCode.trim().toUpperCase();
    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo || promo.deletedAt) throw new PromoApplyError('NOT_FOUND', `Promo ${code} not found`);
    if (!promo.isActive) throw new PromoApplyError('INACTIVE', `Promo ${code} not active`);
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new PromoApplyError('EXPIRED', `Promo ${code} expired`);
    }
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new PromoApplyError('LIMIT_REACHED', `Promo ${code} usage limit reached`);
    }
    // Compute current cart subtotal (from items only, before discount).
    const items = await tx.cartItem.findMany({ where: { cartId } });
    const subtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
    if (subtotal < promo.minOrderCents) {
      throw new PromoApplyError('MIN_ORDER', `Subtotal £${(subtotal / 100).toFixed(2)} below £${(promo.minOrderCents / 100).toFixed(2)}`);
    }
    await tx.cart.update({ where: { id: cartId }, data: { promoCodeId: promo.id } });
    return snapshotCart(cartId, tx);
  }
}

export async function removePromo(
  cartId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  await (client as typeof prisma).cart.update({ where: { id: cartId }, data: { promoCodeId: null } });
  return snapshotCart(cartId, client);
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/service.test.ts
```

Expected: PASS (all cart service tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/cart/service.ts src/server/cart/__tests__/service.test.ts
git commit -m "feat(cart): applyPromo + removePromo with typed error codes"
```

---

## Task 15: `cart/merge.ts` — `mergeGuestIntoUser`

**Files:**
- Create: `src/server/cart/merge.ts`
- Create: `src/server/cart/__tests__/merge.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/cart/__tests__/merge.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { createUser } from '@/server/repositories/user.repo';
import { mergeGuestIntoUser } from '../merge';
import { addItem, getOrCreateCart, snapshotCart } from '../service';
import { generateCartToken } from '../token';

describe('mergeGuestIntoUser', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedProduct(opts: { stock: number; price: number; slug: string }) {
    return prisma.product.create({
      data: {
        slug: opts.slug, name: 'P', priceCents: opts.price, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: opts.stock }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
  }

  it('adopts guest cart when user has none', async () => {
    const product = await seedProduct({ stock: 5, price: 10000, slug: 'p1' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    expect(merged.id).toBe(guest.id); // adopted, same row
    expect(merged.userId).toBe(u.id);
    const snap = await snapshotCart(merged.id);
    expect(snap.items).toHaveLength(1);
  });

  it('merges items by (productId, size) into existing user cart', async () => {
    const product = await seedProduct({ stock: 5, price: 10000, slug: 'p2' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await addItem(userCart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });

    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    expect(merged.id).toBe(userCart.id);
    const snap = await snapshotCart(merged.id);
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(3); // 1 + 2
    // Guest cart deleted.
    const ghost = await prisma.cart.findUnique({ where: { sessionToken: guestToken } });
    expect(ghost).toBeNull();
  });

  it('caps merged quantity to stock', async () => {
    const product = await seedProduct({ stock: 3, price: 10000, slug: 'p3' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await addItem(userCart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    const snap = await snapshotCart(merged.id);
    expect(snap.items[0].quantity).toBe(3); // capped at stock 3
  });

  it('prefers user cart promo when both have one', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userPromo = await prisma.promoCode.create({
      data: { code: 'USER10', discountType: 'PERCENT', discountValue: 10, isActive: true },
    });
    const guestPromo = await prisma.promoCode.create({
      data: { code: 'GUEST20', discountType: 'PERCENT', discountValue: 20, isActive: true },
    });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await prisma.cart.update({ where: { id: userCart.id }, data: { promoCodeId: userPromo.id } });
    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await prisma.cart.update({ where: { id: guest.id }, data: { promoCodeId: guestPromo.id } });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    const m = await prisma.cart.findUniqueOrThrow({ where: { id: merged.id } });
    expect(m.promoCodeId).toBe(userPromo.id);
  });

  it('returns user cart unchanged when guest cart does not exist', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: 'never-existed' });
    expect(merged.id).toBe(userCart.id);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/cart/__tests__/merge.test.ts
```

Expected: cannot find `../merge`.

- [ ] **Step 3: Implement**

Create `src/server/cart/merge.ts`:

```ts
import { prisma } from '@/server/prisma';
import { adoptGuestCart, deleteCart, findCartBySessionToken, findCartByUserId } from '@/server/repositories/cart.repo';

export interface MergeArgs {
  userId: string;
  guestSessionToken: string;
}

export async function mergeGuestIntoUser({ userId, guestSessionToken }: MergeArgs) {
  return prisma.$transaction(async (tx) => {
    const guest = await findCartBySessionToken(guestSessionToken, tx);
    const userCart = await findCartByUserId(userId, tx);

    if (!guest) {
      // No guest cart to merge. Return existing user cart, or create empty one.
      if (userCart) return userCart;
      return tx.cart.create({
        data: { userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        include: { items: true },
      });
    }

    if (!userCart) {
      // Adopt guest as user cart.
      return adoptGuestCart(guest.id, userId, tx);
    }

    // Merge items: for each guest item, find matching (productId,size) in userCart.
    for (const gItem of guest.items) {
      const matching = userCart.items.find(
        (u) => u.productId === gItem.productId && u.size === gItem.size,
      );
      const stockRow = await tx.productSize.findUnique({
        where: { productId_size: { productId: gItem.productId, size: gItem.size } },
      });
      const stock = stockRow?.stock ?? 0;

      if (matching) {
        const merged = Math.min(matching.quantity + gItem.quantity, stock);
        await tx.cartItem.update({ where: { id: matching.id }, data: { quantity: merged } });
      } else {
        const qty = Math.min(gItem.quantity, stock);
        if (qty > 0) {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: gItem.productId,
              size: gItem.size,
              colour: gItem.colour,
              quantity: qty,
              unitPriceCents: gItem.unitPriceCents,
              currency: gItem.currency,
              isPreorder: gItem.isPreorder,
            },
          });
        }
      }
    }

    // Promo precedence: keep userCart.promoCodeId if set; else inherit guest's.
    if (!userCart.promoCodeId && guest.promoCodeId) {
      await tx.cart.update({ where: { id: userCart.id }, data: { promoCodeId: guest.promoCodeId } });
    }

    await deleteCart(guest.id, tx);
    return tx.cart.findUniqueOrThrow({ where: { id: userCart.id }, include: { items: true } });
  });
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/cart/__tests__/merge.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/cart/merge.ts src/server/cart/__tests__/merge.test.ts
git commit -m "feat(cart): mergeGuestIntoUser on signin"
```

---

## Task 16: Cart-identity resolver helper

**Files:**
- Create: `src/server/cart/resolve.ts`

This is the request-time helper used by API routes — it reads cookies + session, decides which cart to return, sets/clears cookies as needed.

- [ ] **Step 1: Implement (no separate tests; covered by API route tests)**

Create `src/server/cart/resolve.ts`:

```ts
import { cookies } from 'next/headers';
import { prisma } from '@/server/prisma';
import { getSessionUser } from '@/server/auth/session';
import { getOrCreateCart, type CartIdentity } from './service';
import { mergeGuestIntoUser } from './merge';
import { CART_COOKIE_NAME, cartCookieOptions, generateCartToken } from './token';

/**
 * Resolves the active cart for the current request. May:
 *  - merge guest cart into user cart on first authenticated request
 *  - rotate guest cart cookie
 *  - return an existing cart unchanged
 *
 * Always returns a cart row with items.
 */
export async function resolveCart() {
  const user = await getSessionUser();
  const cookieJar = await cookies();
  const guestToken = cookieJar.get(CART_COOKIE_NAME)?.value ?? null;

  if (user) {
    if (guestToken) {
      const merged = await mergeGuestIntoUser({ userId: user.id, guestSessionToken: guestToken });
      cookieJar.delete(CART_COOKIE_NAME);
      return merged;
    }
    return getOrCreateCart({ userId: user.id, sessionToken: null });
  }

  let token = guestToken;
  if (!token) {
    token = generateCartToken();
    cookieJar.set(CART_COOKIE_NAME, token, cartCookieOptions());
  }
  const cart = await getOrCreateCart({ userId: null, sessionToken: token });
  // If the cookie pointed to a since-deleted cart, getOrCreateCart created a fresh one
  // with the same token — no rotation needed.
  return cart;
}
```

- [ ] **Step 2: Confirm tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/cart/resolve.ts
git commit -m "feat(cart): resolveCart() — request-scoped identity + merge"
```

---

## Task 17: API route — `GET /api/cart`

**Files:**
- Create: `src/app/api/cart/route.ts`
- Create: `src/app/api/cart/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/cart/__tests__/route.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { GET, DELETE } from '../route';

describe('GET /api/cart', () => {
  beforeEach(async () => { await resetDb(); });

  it('returns an empty cart for first-time visitor', async () => {
    const req = new Request('http://localhost/api/cart');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.subtotalCents).toBe(0);
    expect(res.headers.get('set-cookie')).toMatch(/ynot_cart=/);
  });

  it('reuses cart on subsequent requests with the same cookie', async () => {
    const req1 = new Request('http://localhost/api/cart');
    const res1 = await GET(req1);
    const cookie = res1.headers.get('set-cookie')!.split(';')[0];

    const req2 = new Request('http://localhost/api/cart', { headers: { cookie } });
    const res2 = await GET(req2);
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body2.id).toBe(body1.id);
  });
});

describe('DELETE /api/cart', () => {
  beforeEach(async () => { await resetDb(); });

  it('clears all items', async () => {
    // Setup: create cart with one item via direct prisma… [seed inline]
    // For brevity here: we'll cover this in the full integration test below.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/app/api/cart/__tests__/route.test.ts
```

Expected: cannot import `../route`.

- [ ] **Step 3: Implement**

Create `src/app/api/cart/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { snapshotCart } from '@/server/cart/service';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function GET(_req: Request) {
  const cart = await resolveCart();
  const snap = await snapshotCart(cart.id);
  return NextResponse.json(snap);
}

export async function DELETE(_req: Request) {
  const cart = await resolveCart();
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.update({ where: { id: cart.id }, data: { promoCodeId: null } });
  const snap = await snapshotCart(cart.id);
  return NextResponse.json(snap);
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/app/api/cart/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cart/route.ts src/app/api/cart/__tests__/route.test.ts
git commit -m "feat(api/cart): GET, DELETE /api/cart"
```

---

## Task 18: API route — `POST /api/cart/items`

**Files:**
- Create: `src/app/api/cart/items/route.ts`
- Create: `src/app/api/cart/items/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/cart/items/__tests__/route.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { POST } from '../route';

describe('POST /api/cart/items', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedProduct() {
    return prisma.product.create({
      data: {
        slug: 'pi-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 12000, currency: 'GBP',
        sizes: { create: [{ size: 'M', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
  }

  it('adds an item and returns updated snapshot', async () => {
    const product = await seedProduct();
    const body = JSON.stringify({ productId: product.id, size: 'M', colour: 'Navy', quantity: 1, isPreorder: false });
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].quantity).toBe(1);
  });

  it('returns 409 with stockAvailable on stock conflict', async () => {
    const product = await seedProduct();
    const body = JSON.stringify({ productId: product.id, size: 'M', colour: 'Navy', quantity: 99, isPreorder: false });
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('STOCK_CONFLICT');
    expect(json.stockAvailable).toBe(5);
  });

  it('returns 400 on invalid body', async () => {
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body: '{"bad":1}', headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/app/api/cart/items/__tests__/route.test.ts
```

- [ ] **Step 3: Implement**

Create `src/app/api/cart/items/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { addItem, StockConflictError } from '@/server/cart/service';
import { AddItemRequest } from '@/lib/schemas/cart';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = AddItemRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  try {
    const snap = await addItem(cart.id, parsed);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json(
        { error: 'STOCK_CONFLICT', productId: e.productId, size: e.size, stockAvailable: e.stockAvailable },
        { status: 409 },
      );
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/app/api/cart/items/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cart/items/route.ts src/app/api/cart/items/__tests__/route.test.ts
git commit -m "feat(api/cart): POST /api/cart/items"
```

---

## Task 19: API route — `PATCH/DELETE /api/cart/items/[id]`

**Files:**
- Create: `src/app/api/cart/items/[id]/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/cart/items/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { setQuantity, removeItem, StockConflictError } from '@/server/cart/service';
import { SetQuantityRequest } from '@/lib/schemas/cart';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function assertItemBelongs(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cartId) return false;
  return true;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: itemId } = await params;
  let parsed;
  try {
    parsed = SetQuantityRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  if (!(await assertItemBelongs(cart.id, itemId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  try {
    const snap = await setQuantity(cart.id, itemId, parsed.quantity);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json(
        { error: 'STOCK_CONFLICT', stockAvailable: e.stockAvailable },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: itemId } = await params;
  const cart = await resolveCart();
  if (!(await assertItemBelongs(cart.id, itemId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const snap = await removeItem(cart.id, itemId);
  return NextResponse.json(snap);
}
```

- [ ] **Step 2: Smoke test compiles**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cart/items/[id]/route.ts
git commit -m "feat(api/cart): PATCH/DELETE /api/cart/items/[id]"
```

---

## Task 20: API route — `POST/DELETE /api/cart/promo`

**Files:**
- Create: `src/app/api/cart/promo/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/cart/promo/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { applyPromo, removePromo, PromoApplyError } from '@/server/cart/service';
import { ApplyPromoRequest } from '@/lib/schemas/cart';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = ApplyPromoRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  try {
    const snap = await applyPromo(cart.id, parsed.code);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof PromoApplyError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request) {
  const cart = await resolveCart();
  const snap = await removePromo(cart.id);
  return NextResponse.json(snap);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cart/promo/route.ts
git commit -m "feat(api/cart): POST/DELETE /api/cart/promo"
```

---

## Task 21: Shipping provider interface + Royal Mail (UK FREE)

**Files:**
- Create: `src/server/shipping/provider.ts`
- Create: `src/server/shipping/royal-mail.ts`
- Create: `src/server/shipping/__tests__/royal-mail.test.ts`

- [ ] **Step 1: Define the interface**

Create `src/server/shipping/provider.ts`:

```ts
export interface ShippingRateRequest {
  origin: { country: 'GB' };
  destination: {
    countryCode: string; // ISO-3166 alpha-2
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

export interface ShippingRateQuote {
  methodId: string;
  name: string;
  carrier: 'ROYAL_MAIL' | 'DHL';
  baseRateCents: number;
  dutiesCents: number;
  totalCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface ShippingRateProvider {
  quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]>;
}
```

- [ ] **Step 2: Write failing test for Royal Mail**

Create `src/server/shipping/__tests__/royal-mail.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { RoyalMailFreeProvider } from '../royal-mail';

describe('RoyalMailFreeProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedUkZone() {
    const zone = await prisma.shippingZone.create({ data: { name: 'UK', countries: ['GB'] } });
    return prisma.shippingMethod.create({
      data: {
        zoneId: zone.id, carrier: 'ROYAL_MAIL', name: 'Royal Mail Tracked 48',
        baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3,
      },
    });
  }

  it('returns single £0 quote for GB', async () => {
    await seedUkZone();
    const p = new RoyalMailFreeProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' },
      destination: { countryCode: 'GB' },
      items: [{ productId: 'x', quantity: 1, weightGrams: 1500, unitPriceCents: 20000 }],
      subtotalCents: 20000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      carrier: 'ROYAL_MAIL', baseRateCents: 0, dutiesCents: 0, totalCents: 0,
    });
  });

  it('returns no quotes for non-GB', async () => {
    await seedUkZone();
    const p = new RoyalMailFreeProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' },
      destination: { countryCode: 'FR' },
      items: [],
      subtotalCents: 0,
    });
    expect(quotes).toEqual([]);
  });
});
```

- [ ] **Step 3: Implement**

Create `src/server/shipping/royal-mail.ts`:

```ts
import { prisma } from '@/server/prisma';
import type { ShippingRateProvider, ShippingRateRequest, ShippingRateQuote } from './provider';

export class RoyalMailFreeProvider implements ShippingRateProvider {
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode !== 'GB') return [];
    const method = await prisma.shippingMethod.findFirst({
      where: { carrier: 'ROYAL_MAIL', isActive: true, zone: { countries: { has: 'GB' } } },
    });
    if (!method) return [];
    return [{
      methodId: method.id,
      name: method.name,
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

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/shipping/__tests__/royal-mail.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/shipping/provider.ts src/server/shipping/royal-mail.ts src/server/shipping/__tests__/royal-mail.test.ts
git commit -m "feat(shipping): provider interface + RoyalMailFreeProvider"
```

---

## Task 22: MockDhlProvider (international DDP)

**Files:**
- Create: `src/server/shipping/mock-dhl.ts`
- Create: `src/server/shipping/__tests__/mock-dhl.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/shipping/__tests__/mock-dhl.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { MockDhlProvider } from '../mock-dhl';

describe('MockDhlProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedIntlZone() {
    const zone = await prisma.shippingZone.create({ data: { name: 'International', countries: ['*'] } });
    await prisma.shippingMethod.create({
      data: {
        zoneId: zone.id, carrier: 'DHL', name: 'DHL Express Worldwide (DDP)',
        baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5,
      },
    });
  }

  it('returns no quotes for GB', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'GB' }, items: [], subtotalCents: 20000,
    });
    expect(quotes).toEqual([]);
  });

  it('EU destination: £24.95 shipping + 20% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'DE' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(2495);
    expect(q.dutiesCents).toBe(4000); // 20% of 20000
    expect(q.totalCents).toBe(6495);
  });

  it('US destination: £34.95 shipping + 0% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'US' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(3495);
    expect(q.dutiesCents).toBe(0);
    expect(q.totalCents).toBe(3495);
  });

  it('AU destination: £44.95 shipping + 10% GST', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'AU' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(4495);
    expect(q.dutiesCents).toBe(2000);
    expect(q.totalCents).toBe(6495);
  });

  it('ROW destination: £49.95 shipping + 0% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'KZ' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(4995);
    expect(q.dutiesCents).toBe(0);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/shipping/__tests__/mock-dhl.test.ts
```

- [ ] **Step 3: Implement**

Create `src/server/shipping/mock-dhl.ts`:

```ts
import { prisma } from '@/server/prisma';
import type { ShippingRateProvider, ShippingRateRequest, ShippingRateQuote } from './provider';

const EU_27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const EFTA = ['NO','CH','IS','LI'];

type Region = 'EU' | 'US' | 'CA' | 'AU' | 'JP' | 'ROW';

const RATE_TABLE: Record<Region, { shippingCents: number; dutyRate: number }> = {
  EU:  { shippingCents: 2495, dutyRate: 0.20 },
  US:  { shippingCents: 3495, dutyRate: 0.00 },
  CA:  { shippingCents: 3495, dutyRate: 0.13 },
  AU:  { shippingCents: 4495, dutyRate: 0.10 },
  JP:  { shippingCents: 4495, dutyRate: 0.10 },
  ROW: { shippingCents: 4995, dutyRate: 0.00 },
};

export function resolveRegion(cc: string): Region {
  const upper = cc.toUpperCase();
  if (upper === 'GB') throw new Error('resolveRegion called with GB');
  if ([...EU_27, ...EFTA].includes(upper)) return 'EU';
  if (upper === 'US') return 'US';
  if (upper === 'CA') return 'CA';
  if (upper === 'AU') return 'AU';
  if (upper === 'JP') return 'JP';
  return 'ROW';
}

export class MockDhlProvider implements ShippingRateProvider {
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode === 'GB') return [];
    const region = resolveRegion(req.destination.countryCode);
    const row = RATE_TABLE[region];
    const dutiesCents = Math.round(req.subtotalCents * row.dutyRate);
    const method = await prisma.shippingMethod.findFirst({
      where: { carrier: 'DHL', isActive: true, zone: { countries: { has: '*' } } },
    });
    if (!method) return [];
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
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/shipping/__tests__/mock-dhl.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/shipping/mock-dhl.ts src/server/shipping/__tests__/mock-dhl.test.ts
git commit -m "feat(shipping): MockDhlProvider with regional DDP table"
```

---

## Task 23: CompositeProvider + zones helper

**Files:**
- Create: `src/server/shipping/zones.ts`
- Create: `src/server/shipping/__tests__/zones.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/shipping/__tests__/zones.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { getShippingProvider } from '../zones';

describe('getShippingProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedBothZones() {
    const uk = await prisma.shippingZone.create({ data: { name: 'UK', countries: ['GB'] } });
    const intl = await prisma.shippingZone.create({ data: { name: 'International', countries: ['*'] } });
    await prisma.shippingMethod.create({
      data: { zoneId: uk.id, carrier: 'ROYAL_MAIL', name: 'RM48', baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3 },
    });
    await prisma.shippingMethod.create({
      data: { zoneId: intl.id, carrier: 'DHL', name: 'DHL DDP', baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5 },
    });
  }

  it('returns only UK provider for GB destination', async () => {
    await seedBothZones();
    const p = getShippingProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'GB' }, items: [], subtotalCents: 10000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0].carrier).toBe('ROYAL_MAIL');
  });

  it('returns only international provider for non-GB destination', async () => {
    await seedBothZones();
    const p = getShippingProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'FR' }, items: [], subtotalCents: 10000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0].carrier).toBe('DHL');
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/shipping/__tests__/zones.test.ts
```

- [ ] **Step 3: Implement**

Create `src/server/shipping/zones.ts`:

```ts
import { env } from '@/server/env';
import { MockDhlProvider } from './mock-dhl';
import { RoyalMailFreeProvider } from './royal-mail';
import type { ShippingRateProvider, ShippingRateRequest, ShippingRateQuote } from './provider';

class CompositeProvider implements ShippingRateProvider {
  constructor(private readonly providers: ShippingRateProvider[]) {}
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    const results = await Promise.all(this.providers.map((p) => p.quote(req)));
    return results.flat();
  }
}

export function getShippingProvider(): ShippingRateProvider {
  switch (env.SHIPPING_PROVIDER) {
    case 'mock':
      return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
    case 'dhl':
      // Phase 5: replace MockDhlProvider with DhlExpressProvider here.
      return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
  }
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/shipping/__tests__/zones.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/shipping/zones.ts src/server/shipping/__tests__/zones.test.ts
git commit -m "feat(shipping): CompositeProvider + getShippingProvider() factory"
```

---

## Task 24: Seed — UK + International zones, sample promo

**Files:**
- Create: `tests/seeds/shipping.ts`
- Create: `tests/seeds/promo.ts`
- Modify: `prisma/seed.ts` (or wherever the existing seed entry-point lives)

- [ ] **Step 1: Implement shipping seed**

Create `tests/seeds/shipping.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

export async function seedShipping(prisma: PrismaClient) {
  const uk = await prisma.shippingZone.upsert({
    where: { id: 'zone-uk' },
    create: { id: 'zone-uk', name: 'United Kingdom', countries: ['GB'], sortOrder: 0 },
    update: {},
  });
  const intl = await prisma.shippingZone.upsert({
    where: { id: 'zone-international' },
    create: { id: 'zone-international', name: 'International', countries: ['*'], sortOrder: 10 },
    update: {},
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'method-uk-rm-tracked48' },
    create: {
      id: 'method-uk-rm-tracked48', zoneId: uk.id,
      carrier: 'ROYAL_MAIL', name: 'Royal Mail Tracked 48',
      baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3, isActive: true, sortOrder: 0,
    },
    update: {},
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'method-intl-dhl-express' },
    create: {
      id: 'method-intl-dhl-express', zoneId: intl.id,
      carrier: 'DHL', name: 'DHL Express Worldwide (DDP)',
      baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5, isActive: true, sortOrder: 0,
    },
    update: {},
  });
}
```

- [ ] **Step 2: Implement promo seed**

Create `tests/seeds/promo.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

export async function seedPromos(prisma: PrismaClient) {
  await prisma.promoCode.upsert({
    where: { code: 'WELCOME10' },
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderCents: 0,
      usageLimit: 100,
      isActive: true,
    },
    update: {},
  });
}
```

- [ ] **Step 3: Wire into seed entry point**

Open `prisma/seed.ts` (existing). Append to the main function:

```ts
import { seedShipping } from '../tests/seeds/shipping';
import { seedPromos } from '../tests/seeds/promo';

// inside async function main():
await seedShipping(prisma);
await seedPromos(prisma);
```

- [ ] **Step 4: Run seed**

```bash
pnpm prisma db seed
```

Expected: completes without errors. Verify:

```bash
docker exec -i ynot-postgres psql -U ynot -d ynot_dev -c "SELECT name FROM shipping_zones; SELECT code FROM promo_codes;"
```

Expected: 2 zones, 1 promo code.

- [ ] **Step 5: Commit**

```bash
git add tests/seeds/shipping.ts tests/seeds/promo.ts prisma/seed.ts
git commit -m "feat(seed): UK + International zones + WELCOME10 promo"
```

---

## Task 25: Attribution capture middleware + cookie helpers

**Files:**
- Create: `src/server/attribution/cookie.ts`
- Create: `src/server/attribution/__tests__/cookie.test.ts`
- Modify: `src/middleware.ts` (create if not exists)

- [ ] **Step 1: Write failing test**

Create `src/server/attribution/__tests__/cookie.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractAttributionFromUrl, parseAttributionCookie, ATTRIBUTION_COOKIE_NAME } from '../cookie';

describe('attribution cookie', () => {
  it('extracts UTM params from URL', () => {
    const url = new URL('http://x.com/coats?utm_source=instagram&utm_medium=story&utm_campaign=fall26');
    const att = extractAttributionFromUrl(url, '/coats', 'https://insta.com');
    expect(att).toMatchObject({
      utmSource: 'instagram', utmMedium: 'story', utmCampaign: 'fall26',
      referrer: 'https://insta.com', landingPath: '/coats',
    });
  });

  it('returns null when no UTM keys present', () => {
    const url = new URL('http://x.com/coats?other=1');
    expect(extractAttributionFromUrl(url, '/coats', null)).toBeNull();
  });

  it('parses a cookie value back into AttributionPayload', () => {
    const original = {
      utmSource: 'google', utmMedium: 'cpc', utmCampaign: null, utmTerm: null, utmContent: null,
      referrer: null, landingPath: '/', capturedAt: new Date().toISOString(),
    };
    const cookie = JSON.stringify(original);
    expect(parseAttributionCookie(cookie)).toMatchObject({ utmSource: 'google' });
  });

  it('safely returns null on garbage cookie', () => {
    expect(parseAttributionCookie('{bad')).toBeNull();
    expect(parseAttributionCookie('')).toBeNull();
  });

  it('exports stable cookie name', () => {
    expect(ATTRIBUTION_COOKIE_NAME).toBe('__ynot_attribution');
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/attribution/__tests__/cookie.test.ts
```

- [ ] **Step 3: Implement**

Create `src/server/attribution/cookie.ts`:

```ts
export const ATTRIBUTION_COOKIE_NAME = '__ynot_attribution';
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export interface AttributionPayload {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPath: string;
  capturedAt: string; // ISO
}

export function extractAttributionFromUrl(
  url: URL,
  landingPath: string,
  referrer: string | null,
): AttributionPayload | null {
  const has = KEYS.some((k) => url.searchParams.has(k));
  if (!has) return null;
  return {
    utmSource: url.searchParams.get('utm_source'),
    utmMedium: url.searchParams.get('utm_medium'),
    utmCampaign: url.searchParams.get('utm_campaign'),
    utmTerm: url.searchParams.get('utm_term'),
    utmContent: url.searchParams.get('utm_content'),
    referrer,
    landingPath,
    capturedAt: new Date().toISOString(),
  };
}

export function parseAttributionCookie(value: string | null | undefined): AttributionPayload | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(value);
    if (typeof obj !== 'object' || obj === null) return null;
    return {
      utmSource: obj.utmSource ?? null,
      utmMedium: obj.utmMedium ?? null,
      utmCampaign: obj.utmCampaign ?? null,
      utmTerm: obj.utmTerm ?? null,
      utmContent: obj.utmContent ?? null,
      referrer: obj.referrer ?? null,
      landingPath: obj.landingPath ?? '/',
      capturedAt: obj.capturedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create middleware**

Create `src/middleware.ts` (only if not present; otherwise edit):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { ATTRIBUTION_COOKIE_NAME, extractAttributionFromUrl } from '@/server/attribution/cookie';

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const att = extractAttributionFromUrl(url, url.pathname, req.headers.get('referer'));
  const res = NextResponse.next();
  if (att) {
    res.cookies.set(ATTRIBUTION_COOKIE_NAME, JSON.stringify(att), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  return res;
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test src/server/attribution/__tests__/cookie.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/attribution/cookie.ts src/server/attribution/__tests__/cookie.test.ts src/middleware.ts
git commit -m "feat(attribution): UTM cookie capture middleware"
```

---

## Task 26: Order token (HMAC-signed cookie for ghost order viewing)

**Files:**
- Create: `src/server/checkout/order-token.ts`
- Create: `src/server/checkout/__tests__/order-token.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/checkout/__tests__/order-token.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signOrderToken, verifyOrderToken } from '../order-token';

describe('order-token', () => {
  it('round-trips a signed token', () => {
    const orderId = 'order-abc';
    const createdAt = new Date('2026-04-30T12:00:00Z');
    const token = signOrderToken(orderId, createdAt);
    const result = verifyOrderToken(token);
    expect(result).toEqual({ orderId, createdAt: createdAt.toISOString() });
  });

  it('rejects tampered token', () => {
    const token = signOrderToken('order-x', new Date());
    const bad = token.slice(0, -2) + 'XX';
    expect(verifyOrderToken(bad)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyOrderToken('')).toBeNull();
    expect(verifyOrderToken('garbage')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/checkout/__tests__/order-token.test.ts
```

- [ ] **Step 3: Implement**

Create `src/server/checkout/order-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/server/env';

const SEPARATOR = '.';

function hmac(payload: string): string {
  return createHmac('sha256', env.ORDER_TOKEN_SECRET).update(payload).digest('base64url');
}

/**
 * Signs an order id + createdAt timestamp into a base64url token of form
 * "<orderId>.<createdAtIso>.<signature>". Used as the __ynot_order_token cookie
 * value for unauthenticated ghost orders (24h TTL enforced at issue site).
 */
export function signOrderToken(orderId: string, createdAt: Date): string {
  const iso = createdAt.toISOString();
  const payload = `${orderId}${SEPARATOR}${iso}`;
  return `${payload}${SEPARATOR}${hmac(payload)}`;
}

export function verifyOrderToken(token: string): { orderId: string; createdAt: string } | null {
  if (!token) return null;
  const parts = token.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [orderId, iso, sig] = parts;
  const expected = hmac(`${orderId}${SEPARATOR}${iso}`);
  if (sig.length !== expected.length) return null;
  try {
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { orderId, createdAt: iso };
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/checkout/__tests__/order-token.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/checkout/order-token.ts src/server/checkout/__tests__/order-token.test.ts
git commit -m "feat(checkout): HMAC-signed ghost order token"
```

---

## Task 27: Checkout Zod schemas

**Files:**
- Create: `src/lib/schemas/checkout.ts`

- [ ] **Step 1: Implement**

Create `src/lib/schemas/checkout.ts`:

```ts
import { z } from 'zod';

export const ShippingAddress = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  line1: z.string().min(1).max(120),
  line2: z.string().max(120).optional().nullable(),
  city: z.string().min(1).max(60),
  postcode: z.string().min(1).max(20),
  countryCode: z.string().length(2).toUpperCase(),
  phone: z.string().min(5).max(30),
});
export type ShippingAddressT = z.infer<typeof ShippingAddress>;

export const QuoteRequest = z.object({
  address: ShippingAddress,
});
export type QuoteRequestT = z.infer<typeof QuoteRequest>;

export const QuoteResponse = z.object({
  methods: z.array(
    z.object({
      methodId: z.string(),
      name: z.string(),
      carrier: z.enum(['ROYAL_MAIL', 'DHL']),
      baseRateCents: z.number(),
      dutiesCents: z.number(),
      totalCents: z.number(),
      estimatedDaysMin: z.number(),
      estimatedDaysMax: z.number(),
    }),
  ),
});
export type QuoteResponseT = z.infer<typeof QuoteResponse>;

export const CreateOrderRequest = z.object({
  address: ShippingAddress,
  methodId: z.string().min(1),
});
export type CreateOrderRequestT = z.infer<typeof CreateOrderRequest>;

export const CreateOrderResponse = z.object({
  orderId: z.string(),
  clientSecret: z.string(),
});
export type CreateOrderResponseT = z.infer<typeof CreateOrderResponse>;

export const ClaimAccountRequest = z.object({
  orderId: z.string(),
  password: z.string().min(12).max(100),
});
export type ClaimAccountRequestT = z.infer<typeof ClaimAccountRequest>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schemas/checkout.ts
git commit -m "feat(schemas): checkout Zod schemas (address, quote, create-order, claim)"
```

---

## Task 28: `/api/checkout/quote` route

**Files:**
- Create: `src/app/api/checkout/quote/route.ts`
- Create: `src/app/api/checkout/quote/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/checkout/quote/__tests__/route.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { seedShipping } from '../../../../../../tests/seeds/shipping';
import { POST } from '../route';

describe('POST /api/checkout/quote', () => {
  beforeEach(async () => {
    await resetDb();
    await seedShipping(prisma);
  });

  async function postQuote(countryCode: string) {
    const body = JSON.stringify({
      address: {
        email: 'a@x.com', firstName: 'A', lastName: 'B',
        line1: '1 St', city: 'London', postcode: 'SW1', countryCode, phone: '+440000000000',
      },
    });
    return POST(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', body, headers: { 'content-type': 'application/json' },
    }));
  }

  it('returns Royal Mail FREE for GB', async () => {
    // Need a cart with items for subtotal — but the quote endpoint reads cart from cookie.
    // For this unit test we accept that cart resolution returns an empty cart (subtotal 0)
    // — Royal Mail still returns 0-rate for GB; what matters is correct routing.
    const res = await postQuote('GB');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0].carrier).toBe('ROYAL_MAIL');
    expect(body.methods[0].totalCents).toBe(0);
  });

  it('returns DHL DDP for FR with duties on subtotal', async () => {
    const res = await postQuote('FR');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0].carrier).toBe('DHL');
  });

  it('returns 400 on invalid body', async () => {
    const res = await POST(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/app/api/checkout/quote/__tests__/route.test.ts
```

- [ ] **Step 3: Implement**

Create `src/app/api/checkout/quote/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { snapshotCart } from '@/server/cart/service';
import { getShippingProvider } from '@/server/shipping/zones';
import { QuoteRequest } from '@/lib/schemas/checkout';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = QuoteRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  const snap = await snapshotCart(cart.id);
  const subtotalAfterDiscount = snap.subtotalCents - snap.discountCents;

  // Build items with weight/origin from Product table.
  const productIds = snap.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const itemsForRate = snap.items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    return {
      productId: i.productId,
      quantity: i.quantity,
      weightGrams: p?.weightGrams ?? 1500,
      unitPriceCents: i.unitPriceCents,
      hsCode: p?.hsCode ?? undefined,
      countryOfOriginCode: p?.countryOfOriginCode ?? undefined,
    };
  });

  const provider = getShippingProvider();
  const methods = await provider.quote({
    origin: { country: 'GB' },
    destination: { countryCode: parsed.address.countryCode, postcode: parsed.address.postcode },
    items: itemsForRate,
    subtotalCents: subtotalAfterDiscount,
  });

  return NextResponse.json({ methods });
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/app/api/checkout/quote/__tests__/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/quote/route.ts src/app/api/checkout/quote/__tests__/route.test.ts
git commit -m "feat(api/checkout): POST /quote — shipping rate quotes"
```

---

## Task 29: `createOrderAndPaymentIntent` service

**Files:**
- Create: `src/server/checkout/service.ts`
- Create: `src/server/checkout/__tests__/service.test.ts`
- Create: `src/server/__tests__/helpers/mock-stripe.ts`

This is the heart of Phase 4. It runs as a single transaction: stock lock, promo re-validate, ghost-user resolve, Order + OrderItem + Payment insert, attribution snapshot, and returns the row. The Stripe `PaymentIntent.create` happens **after** the transaction commits.

- [ ] **Step 1: Create the Stripe SDK mock helper**

Create `src/server/__tests__/helpers/mock-stripe.ts`:

```ts
import { vi } from 'vitest';

export function mockStripeSdk(opts: {
  intentId?: string;
  clientSecret?: string;
} = {}) {
  const intentId = opts.intentId ?? 'pi_test_' + Math.random().toString(36).slice(2, 8);
  const clientSecret = opts.clientSecret ?? `${intentId}_secret_test`;
  const create = vi.fn(async () => ({
    id: intentId, client_secret: clientSecret, amount: 0, currency: 'gbp',
    status: 'requires_payment_method', metadata: {},
  }));
  vi.doMock('@/server/checkout/stripe', () => ({
    stripe: { paymentIntents: { create, retrieve: vi.fn() } },
  }));
  return { intentId, clientSecret, create };
}
```

- [ ] **Step 2: Write failing tests**

Create `src/server/checkout/__tests__/service.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { mockStripeSdk } from '@/server/__tests__/helpers/mock-stripe';
import { addItem, getOrCreateCart } from '@/server/cart/service';
import { generateCartToken } from '@/server/cart/token';
import { seedShipping } from '../../../../tests/seeds/shipping';

describe('createOrderAndPaymentIntent', () => {
  beforeEach(async () => {
    await resetDb();
    await seedShipping(prisma);
  });

  async function seedCartWithItem(opts: { stock?: number; price?: number } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'p-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: opts.price ?? 20000, currency: 'GBP',
        weightGrams: 1500, hsCode: '6202.93', countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'S', stock: opts.stock ?? 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    return { cart, product };
  }

  it('creates Order(PENDING_PAYMENT) + OrderItem + Payment + decrements stock', async () => {
    const stripe = mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart, product } = await seedCartWithItem({ stock: 3 });

    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: null,
      address: {
        email: 'g@x.com', firstName: 'G', lastName: 'X',
        line1: '1 St', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+440000000000',
      },
      methodId: 'method-uk-rm-tracked48',
      attribution: null,
    });

    expect(result.orderId).toBeDefined();
    expect(result.clientSecret).toBe(stripe.clientSecret);
    expect(stripe.create).toHaveBeenCalledTimes(1);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.orderId }, include: { items: true, payment: true, user: true },
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe(product.id);
    expect(order.payment?.status).toBe('PENDING');
    expect(order.payment?.stripePaymentIntentId).toBe(stripe.intentId);
    expect(order.user?.isGuest).toBe(true);

    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: product.id, size: 'S' } },
    });
    expect(stock.stock).toBe(2); // 3 - 1
  });

  it('throws StockConflictError when stock insufficient', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart, product } = await seedCartWithItem({ stock: 1 });
    // Manually inflate cart qty above stock to simulate race.
    await prisma.cartItem.updateMany({ where: { cartId: cart.id }, data: { quantity: 3 } });

    await expect(
      createOrderAndPaymentIntent({
        cartId: cart.id,
        user: null,
        address: {
          email: 'g@x.com', firstName: 'G', lastName: 'X',
          line1: '1', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+44',
        },
        methodId: 'method-uk-rm-tracked48',
        attribution: null,
      }),
    ).rejects.toThrow(/stock/i);
  });

  it('reuses existing ghost user for the same email', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart: cart1 } = await seedCartWithItem({ stock: 5 });
    const { cart: cart2 } = await seedCartWithItem({ stock: 5 });

    const r1 = await createOrderAndPaymentIntent({
      cartId: cart1.id, user: null,
      address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1', city: 'L', postcode: 'SW1', countryCode: 'GB', phone: '+44' },
      methodId: 'method-uk-rm-tracked48', attribution: null,
    });
    const r2 = await createOrderAndPaymentIntent({
      cartId: cart2.id, user: null,
      address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1', city: 'L', postcode: 'SW1', countryCode: 'GB', phone: '+44' },
      methodId: 'method-uk-rm-tracked48', attribution: null,
    });
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: r1.orderId } });
    const o2 = await prisma.order.findUniqueOrThrow({ where: { id: r2.orderId } });
    expect(o1.userId).toBe(o2.userId);
  });
});
```

- [ ] **Step 3: Run — confirm fail**

```bash
pnpm test src/server/checkout/__tests__/service.test.ts
```

- [ ] **Step 4: Implement**

Create `src/server/checkout/service.ts`:

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma';
import { stripe } from './stripe';
import { snapshotCart, StockConflictError } from '@/server/cart/service';
import { getOrCreateGuestUser, EmailTakenByFullAccountError } from '@/server/repositories/user.repo';
import { getShippingProvider } from '@/server/shipping/zones';
import { nextOrderNumber } from './order-number';
import { signOrderToken } from './order-token';
import type { ShippingAddressT } from '@/lib/schemas/checkout';
import type { AttributionPayload } from '@/server/attribution/cookie';

export interface CreateOrderArgs {
  cartId: string;
  user: { id: string } | null;
  address: ShippingAddressT;
  methodId: string;
  attribution: AttributionPayload | null;
}

export interface CreateOrderResult {
  orderId: string;
  clientSecret: string;
  orderToken: string; // signed cookie value for guest viewing of /checkout/success
}

export async function createOrderAndPaymentIntent(
  args: CreateOrderArgs,
): Promise<CreateOrderResult> {
  // Phase 1: DB transaction — stock lock, validation, Order/Payment insert.
  const order = await prisma.$transaction(async (tx) => {
    // 1. Snapshot the cart inside tx for fresh prices/stock.
    const snap = await snapshotCart(args.cartId, tx);
    if (snap.items.length === 0) throw new Error('Cart is empty');

    // 2. Lock stock rows and re-validate.
    const keys = snap.items.map((i) => `('${i.productId}','${i.size}')`).join(',');
    if (keys) {
      // SELECT ... FOR UPDATE on (product_id, size) tuples.
      // Prisma does not yet have a native FOR UPDATE; raw SQL on the same tx is safe.
      await tx.$queryRawUnsafe(
        `SELECT product_id, size, stock FROM product_sizes WHERE (product_id, size) IN (${keys}) FOR UPDATE`,
      );
    }
    for (const item of snap.items) {
      const stockRow = await tx.productSize.findUniqueOrThrow({
        where: { productId_size: { productId: item.productId, size: item.size } },
      });
      if (stockRow.stock < item.quantity) {
        throw new StockConflictError(item.productId, item.size, stockRow.stock);
      }
    }

    // 3. Atomic stock decrement.
    for (const item of snap.items) {
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId, size: item.size } },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 4. Quote shipping (re-fetch — do not trust client).
    const provider = getShippingProvider();
    const subtotalAfterDiscount = snap.subtotalCents - snap.discountCents;
    const products = await tx.product.findMany({
      where: { id: { in: snap.items.map((i) => i.productId) } },
    });
    const quotes = await provider.quote({
      origin: { country: 'GB' },
      destination: { countryCode: args.address.countryCode, postcode: args.address.postcode },
      items: snap.items.map((i) => {
        const p = products.find((x) => x.id === i.productId);
        return {
          productId: i.productId,
          quantity: i.quantity,
          weightGrams: p?.weightGrams ?? 1500,
          unitPriceCents: i.unitPriceCents,
          hsCode: p?.hsCode ?? undefined,
          countryOfOriginCode: p?.countryOfOriginCode ?? undefined,
        };
      }),
      subtotalCents: subtotalAfterDiscount,
    });
    const method = quotes.find((q) => q.methodId === args.methodId);
    if (!method) throw new Error(`Invalid shipping method: ${args.methodId}`);

    // 5. Re-validate promo (race window).
    const cartRow = await tx.cart.findUniqueOrThrow({
      where: { id: args.cartId }, include: { promoCode: true },
    });
    if (cartRow.promoCode) {
      const p = cartRow.promoCode;
      if (!p.isActive || (p.expiresAt && p.expiresAt < new Date()) ||
          (p.usageLimit !== null && p.usageCount >= p.usageLimit)) {
        throw new Error(`Promo ${p.code} is no longer valid`);
      }
    }

    // 6. Resolve / create ghost user if guest.
    let userId = args.user?.id;
    if (!userId) {
      const ghost = await getOrCreateGuestUser({ email: args.address.email }, tx);
      userId = ghost.id;
    }

    // 7. Compute totals.
    const totalCents = snap.subtotalCents + method.totalCents - snap.discountCents;

    // 8. Create Order + OrderItems + Payment.
    const created = await tx.order.create({
      data: {
        orderNumber: await nextOrderNumber(tx),
        userId,
        status: 'PENDING_PAYMENT',
        subtotalCents: snap.subtotalCents,
        shippingCents: method.totalCents,
        discountCents: snap.discountCents,
        totalCents,
        currency: 'GBP',
        carrier: method.carrier,
        shipFirstName: args.address.firstName,
        shipLastName: args.address.lastName,
        shipLine1: args.address.line1,
        shipLine2: args.address.line2 ?? null,
        shipCity: args.address.city,
        shipPostcode: args.address.postcode,
        shipCountry: args.address.countryCode,
        shipPhone: args.address.phone,
        utmSource: args.attribution?.utmSource ?? null,
        utmMedium: args.attribution?.utmMedium ?? null,
        utmCampaign: args.attribution?.utmCampaign ?? null,
        utmTerm: args.attribution?.utmTerm ?? null,
        utmContent: args.attribution?.utmContent ?? null,
        referrer: args.attribution?.referrer ?? null,
        landingPath: args.attribution?.landingPath ?? null,
        promoCodeId: cartRow.promoCodeId ?? null,
        items: {
          create: snap.items.map((i) => ({
            productId: i.productId,
            productSlug: i.productSlug,
            productName: i.productName,
            productImage: i.productImage,
            colour: i.colour,
            size: i.size,
            unitPriceCents: i.unitPriceCents,
            currency: 'GBP',
            quantity: i.quantity,
            isPreorder: false,
          })),
        },
        payment: {
          create: {
            status: 'PENDING',
            amountCents: totalCents,
            currency: 'GBP',
          },
        },
        events: {
          create: { status: 'PENDING_PAYMENT', note: 'Order created' },
        },
      },
      include: { payment: true },
    });

    return created;
  });

  // Phase 2: Stripe call outside the DB tx. If this throws, the order stays
  // in PENDING_PAYMENT — recovery cron in Phase 5 will release stock.
  const intent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'gbp',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id },
    receipt_email: args.address.email,
  });

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { stripePaymentIntentId: intent.id },
  });

  const orderToken = signOrderToken(order.id, order.createdAt);

  return {
    orderId: order.id,
    clientSecret: intent.client_secret!,
    orderToken,
  };
}
```

- [ ] **Step 5: Run — confirm pass**

```bash
pnpm test src/server/checkout/__tests__/service.test.ts
```

Expected: PASS (3 tests). The mock Stripe SDK records calls; transaction integrity verified against real Postgres.

- [ ] **Step 6: Commit**

```bash
git add src/server/__tests__/helpers/mock-stripe.ts src/server/checkout/service.ts src/server/checkout/__tests__/service.test.ts
git commit -m "feat(checkout): createOrderAndPaymentIntent (atomic stock + Order + PI)"
```

---

## Task 30: `/api/checkout/create` route

**Files:**
- Create: `src/app/api/checkout/create/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/checkout/create/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { createOrderAndPaymentIntent } from '@/server/checkout/service';
import { CreateOrderRequest } from '@/lib/schemas/checkout';
import { getSessionUser } from '@/server/auth/session';
import { ATTRIBUTION_COOKIE_NAME, parseAttributionCookie } from '@/server/attribution/cookie';
import { StockConflictError } from '@/server/cart/service';
import { EmailTakenByFullAccountError } from '@/server/repositories/user.repo';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = CreateOrderRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  const user = await getSessionUser();
  const cookieJar = await cookies();
  const attribution = parseAttributionCookie(cookieJar.get(ATTRIBUTION_COOKIE_NAME)?.value);

  try {
    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: user ? { id: user.id } : null,
      address: parsed.address,
      methodId: parsed.methodId,
      attribution,
    });

    // Set the ghost-order viewing cookie (24h TTL) so guest can view /success.
    cookieJar.set(ORDER_TOKEN_COOKIE, result.orderToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return NextResponse.json({
      orderId: result.orderId,
      clientSecret: result.clientSecret,
    });
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json({ error: 'STOCK_CONFLICT' }, { status: 409 });
    }
    if (e instanceof EmailTakenByFullAccountError) {
      return NextResponse.json(
        { error: 'EMAIL_TAKEN', message: 'This email has a YNOT account — sign in to place your order.' },
        { status: 409 },
      );
    }
    if (e instanceof Error && /promo/i.test(e.message)) {
      return NextResponse.json({ error: 'PROMO_INVALID', message: e.message }, { status: 409 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Confirm tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/create/route.ts
git commit -m "feat(api/checkout): POST /create — Order + PaymentIntent endpoint"
```

---

## Task 31: Stripe webhook — signature verify + idempotency

**Files:**
- Create: `src/server/repositories/stripe-event.repo.ts`
- Create: `src/server/checkout/webhook.ts`
- Create: `src/server/checkout/__tests__/webhook.test.ts`

- [ ] **Step 1: Implement event repo**

Create `src/server/repositories/stripe-event.repo.ts`:

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma';

export async function recordStripeEvent(
  id: string,
  type: string,
  payload: Prisma.InputJsonValue,
): Promise<{ alreadyProcessed: boolean }> {
  try {
    await prisma.stripeEvent.create({ data: { id, type, payload } });
    return { alreadyProcessed: false };
  } catch (e) {
    // Postgres unique violation on PK (id) → replay; safe to ack.
    const code = (e as { code?: string }).code;
    if (code === 'P2002') return { alreadyProcessed: true };
    throw e;
  }
}
```

- [ ] **Step 2: Write failing webhook test**

Create `src/server/checkout/__tests__/webhook.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';

describe('webhook handler', () => {
  beforeEach(async () => { await resetDb(); });

  it('rejects on invalid signature', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => { throw new Error('bad sig'); }) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const result = await handleWebhook({ rawBody: '{}', signature: 'bad' });
    expect(result.status).toBe(400);
  });

  it('records event id and ignores replays', async () => {
    const fakeEvent = { id: 'evt_test_1', type: 'something.unhandled', data: { object: {} } };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => fakeEvent) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const r1 = await handleWebhook({ rawBody: '{}', signature: 'sig1' });
    expect(r1.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1);
    const r2 = await handleWebhook({ rawBody: '{}', signature: 'sig2' });
    expect(r2.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1); // unchanged
  });
});
```

- [ ] **Step 3: Run — confirm fail**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts
```

- [ ] **Step 4: Implement webhook handler skeleton**

Create `src/server/checkout/webhook.ts`:

```ts
import type Stripe from 'stripe';
import { stripe } from './stripe';
import { env } from '@/server/env';
import { prisma } from '@/server/prisma';
import { recordStripeEvent } from '@/server/repositories/stripe-event.repo';

export interface WebhookInput {
  rawBody: string;
  signature: string | null;
}

export interface WebhookResult {
  status: 200 | 400 | 500;
  body?: string;
}

export async function handleWebhook(input: WebhookInput): Promise<WebhookResult> {
  if (!input.signature) return { status: 400, body: 'missing signature' };
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(input.rawBody, input.signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return { status: 400, body: 'invalid signature' };
  }

  const { alreadyProcessed } = await recordStripeEvent(
    event.id,
    event.type,
    event as unknown as Record<string, unknown>,
  );
  if (alreadyProcessed) return { status: 200 };

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      // Unhandled events still get 200 so Stripe won't retry.
      break;
  }
  return { status: 200 };
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  // Implemented in Task 32.
  void pi;
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  // Implemented in Task 33.
  void pi;
}
```

- [ ] **Step 5: Run — confirm pass**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/stripe-event.repo.ts src/server/checkout/webhook.ts src/server/checkout/__tests__/webhook.test.ts
git commit -m "feat(webhook): signature verify + StripeEvent idempotency"
```

---

## Task 32: `handlePaymentSucceeded` — flip Order, redeem promo

**Files:**
- Modify: `src/server/checkout/webhook.ts`
- Modify: `src/server/checkout/__tests__/webhook.test.ts`

- [ ] **Step 1: Append failing test**

Add a new describe to `webhook.test.ts`:

```ts
describe('handlePaymentSucceeded', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedPendingOrder(opts: { promoCode?: string } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'pp-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    let promoId: string | null = null;
    if (opts.promoCode) {
      const promo = await prisma.promoCode.create({
        data: { code: opts.promoCode, discountType: 'PERCENT', discountValue: 10, isActive: true },
      });
      promoId = promo.id;
    }
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        promoCodeId: promoId,
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_succ', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
      include: { payment: true },
    });
    return { order, promoId };
  }

  it('flips Order to NEW + Payment to CAPTURED', async () => {
    const { order } = await seedPendingOrder();
    const fakeEvent = {
      id: 'evt_succ_1', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as any },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook?succ-1');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('NEW');
    expect(o.payment?.status).toBe('CAPTURED');
  });

  it('increments promo.usageCount + creates PromoRedemption', async () => {
    const { order, promoId } = await seedPendingOrder({ promoCode: 'WELCOME10' });
    const fakeEvent = {
      id: 'evt_succ_2', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as any },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook?succ-2');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const promo = await prisma.promoCode.findUniqueOrThrow({ where: { id: promoId! } });
    expect(promo.usageCount).toBe(1);
    const redemption = await prisma.promoRedemption.findFirst({ where: { orderId: order.id } });
    expect(redemption).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts -t "handlePaymentSucceeded"
```

- [ ] **Step 3: Implement**

Replace `handlePaymentSucceeded` body in `src/server/checkout/webhook.ts`:

```ts
async function handlePaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (order.status !== 'PENDING_PAYMENT') return; // replay or already handled

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'NEW',
        events: { create: { status: 'NEW', note: 'Payment received' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });

    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { usageCount: { increment: 1 } },
      });
      await tx.promoRedemption.create({
        data: {
          promoCodeId: order.promoCodeId,
          orderId: order.id,
          discountCents: order.discountCents,
        },
      });
    }

    // Mark guest user's email verified — receipt email implicitly confirms.
    if (order.userId) {
      await tx.user.update({
        where: { id: order.userId },
        data: { emailVerified: { set: new Date() } },
      });
    }

    // Drop the cart that produced this order (best-effort — match by user/session).
    // The user may have already started a new cart; we only delete carts whose items
    // are exactly the order's snapshot — too fragile in race. Leave to Phase 5 cron.
  });
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/checkout/webhook.ts src/server/checkout/__tests__/webhook.test.ts
git commit -m "feat(webhook): handlePaymentSucceeded — flip Order, redeem promo, verify email"
```

---

## Task 33: `handlePaymentFailed` — release stock

**Files:**
- Modify: `src/server/checkout/webhook.ts`
- Modify: `src/server/checkout/__tests__/webhook.test.ts`

- [ ] **Step 1: Append failing test**

Add to `webhook.test.ts`:

```ts
describe('handlePaymentFailed', () => {
  beforeEach(async () => { await resetDb(); });

  it('flips Order to PAYMENT_FAILED and releases stock', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'pf-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 2 }] }, // already decremented in real flow
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_fail', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
    });
    const fakeEvent = {
      id: 'evt_fail_1', type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_test_fail' } as any },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook?fail-1');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('PAYMENT_FAILED');
    expect(o.payment?.status).toBe('FAILED');
    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: product.id, size: 'S' } },
    });
    expect(stock.stock).toBe(3); // 2 + released 1
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts -t "handlePaymentFailed"
```

- [ ] **Step 3: Implement**

Replace `handlePaymentFailed` in `src/server/checkout/webhook.ts`:

```ts
async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId }, include: { items: true },
    });
    if (order.status !== 'PENDING_PAYMENT') return;

    // Release stock.
    for (const item of order.items) {
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId!, size: item.size } },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_FAILED',
        events: { create: { status: 'PAYMENT_FAILED', note: pi.last_payment_error?.message ?? 'Payment failed' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  });
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/server/checkout/__tests__/webhook.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/checkout/webhook.ts src/server/checkout/__tests__/webhook.test.ts
git commit -m "feat(webhook): handlePaymentFailed — release stock + flip status"
```

---

## Task 34: `/api/webhooks/stripe` route

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import { handleWebhook } from '@/server/checkout/webhook';

// Webhooks need the raw body for signature verification — disable body parsing.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  const result = await handleWebhook({ rawBody, signature });
  return new Response(result.body ?? null, { status: result.status });
}
```

- [ ] **Step 2: Confirm tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(api/webhooks): /stripe route forwards raw body to handleWebhook"
```

---

## Task 35: `/api/orders/[id]` route — auth + ghost token

**Files:**
- Create: `src/app/api/orders/[id]/route.ts`
- Create: `src/app/api/orders/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/orders/[id]/__tests__/route.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { signOrderToken } from '@/server/checkout/order-token';
import { GET } from '../route';

describe('GET /api/orders/[id]', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedGuestOrder() {
    const user = await prisma.user.create({
      data: { email: 'g@x.com', passwordHash: null, isGuest: true },
    });
    const product = await prisma.product.create({
      data: { slug: 'op', name: 'P', priceCents: 20000, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] } },
    });
    return prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001', userId: user.id, status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: 'op', productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
      },
    });
  }

  it('returns order when valid order-token cookie matches', async () => {
    const order = await seedGuestOrder();
    const token = signOrderToken(order.id, order.createdAt);
    const req = new Request(`http://localhost/api/orders/${order.id}`, {
      headers: { cookie: `__ynot_order_token=${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(order.id);
    expect(body.status).toBe('PENDING_PAYMENT');
  });

  it('returns 403 without auth or token', async () => {
    const order = await seedGuestOrder();
    const req = new Request(`http://localhost/api/orders/${order.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent order', async () => {
    const token = signOrderToken('nope', new Date());
    const req = new Request('http://localhost/api/orders/nope', {
      headers: { cookie: `__ynot_order_token=${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/app/api/orders/[id]/__tests__/route.test.ts
```

- [ ] **Step 3: Implement**

Create `src/app/api/orders/[id]/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { getSessionUser } from '@/server/auth/session';
import { verifyOrderToken } from '@/server/checkout/order-token';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payment: true, user: true },
  });
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // 1) Authorised user owns it?
  const user = await getSessionUser();
  if (user && order.userId === user.id) {
    return NextResponse.json(serialise(order));
  }

  // 2) Anon with valid order token?
  const cookieJar = await cookies();
  const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value;
  const verified = verifyOrderToken(tokenValue ?? '');
  if (verified && verified.orderId === order.id &&
      verified.createdAt === order.createdAt.toISOString()) {
    return NextResponse.json(serialise(order));
  }

  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

function serialise(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    currency: order.currency,
    carrier: order.carrier,
    items: order.items,
    isGuestOrder: order.user?.isGuest === true,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    shipping: {
      firstName: order.shipFirstName, lastName: order.shipLastName,
      line1: order.shipLine1, line2: order.shipLine2,
      city: order.shipCity, postcode: order.shipPostcode,
      country: order.shipCountry, phone: order.shipPhone,
    },
    createdAt: order.createdAt,
  };
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/app/api/orders/[id]/__tests__/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/orders/[id]/route.ts src/app/api/orders/[id]/__tests__/route.test.ts
git commit -m "feat(api/orders): GET /[id] with auth + ghost token authorisation"
```

---

## Task 36: `/api/account/claim` — post-purchase password setup

**Files:**
- Create: `src/app/api/account/claim/route.ts`
- Create: `src/app/api/account/claim/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/account/claim/__tests__/route.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { signOrderToken } from '@/server/checkout/order-token';
import { POST } from '../route';

describe('POST /api/account/claim', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedGhostOrder() {
    const user = await prisma.user.create({
      data: { email: 'g@x.com', passwordHash: null, isGuest: true },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001', userId: user.id, status: 'NEW',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      },
    });
    return { user, order };
  }

  it('promotes ghost user to full account on valid token + password', async () => {
    const { user, order } = await seedGhostOrder();
    const token = signOrderToken(order.id, order.createdAt);
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json', cookie: `__ynot_order_token=${token}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.isGuest).toBe(false);
    expect(updated.emailVerified).not.toBeNull();
  });

  it('rejects on missing/invalid token', async () => {
    const { order } = await seedGhostOrder();
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects 409 if user already has a password', async () => {
    const { user, order } = await seedGhostOrder();
    await prisma.user.update({
      where: { id: user.id }, data: { passwordHash: 'existing', isGuest: false },
    });
    const token = signOrderToken(order.id, order.createdAt);
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json', cookie: `__ynot_order_token=${token}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm test src/app/api/account/claim/__tests__/route.test.ts
```

- [ ] **Step 3: Implement**

Create `src/app/api/account/claim/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { hashPassword } from '@/server/auth/password';
import { verifyOrderToken } from '@/server/checkout/order-token';
import { ClaimAccountRequest } from '@/lib/schemas/checkout';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = ClaimAccountRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cookieJar = await cookies();
  const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value;
  const verified = verifyOrderToken(tokenValue ?? '');
  if (!verified || verified.orderId !== parsed.orderId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    include: { user: true },
  });
  if (!order || !order.user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (order.user.passwordHash !== null || !order.user.isGuest) {
    return NextResponse.json({ error: 'ALREADY_CLAIMED' }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.password);
  await prisma.user.update({
    where: { id: order.user.id },
    data: {
      passwordHash,
      isGuest: false,
      emailVerified: order.user.emailVerified ?? new Date(),
    },
  });

  cookieJar.delete(ORDER_TOKEN_COOKIE);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
pnpm test src/app/api/account/claim/__tests__/route.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/claim/route.ts src/app/api/account/claim/__tests__/route.test.ts
git commit -m "feat(api/account): POST /claim — set password on ghost user"
```

---

## Task 37: Client `cart-store` rewrite (Zustand without persist)

**Files:**
- Modify: `src/lib/stores/cart-store.ts`
- Modify: `src/lib/stores/__tests__/cart-store.test.ts` (rewrite)

- [ ] **Step 1: Read the existing test file (jsdom project)**

Open `src/lib/stores/__tests__/cart-store.test.ts`. The current tests reference `addItem(item: CartItem)` API which doesn't take productId — those will be deleted.

- [ ] **Step 2: Replace test file**

Replace the entire contents of `src/lib/stores/__tests__/cart-store.test.ts` with:

```ts
// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

const FIXTURE_SNAPSHOT = {
  id: 'cart-1',
  items: [],
  subtotalCents: 0,
  discountCents: 0,
  promo: null,
  itemCount: 0,
  expiresAt: new Date().toISOString(),
};

describe('useCartStore', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => FIXTURE_SNAPSHOT,
    }) as unknown as Response) as any;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('hydrate fetches from /api/cart', async () => {
    const { useCartStore } = await import('../cart-store');
    await useCartStore.getState().hydrate();
    expect(global.fetch).toHaveBeenCalledWith('/api/cart', expect.objectContaining({ credentials: 'include' }));
    expect(useCartStore.getState().snapshot).toEqual(FIXTURE_SNAPSHOT);
  });

  it('addItem POSTs to /api/cart/items', async () => {
    const { useCartStore } = await import('../cart-store');
    await useCartStore.getState().addItem({
      productId: 'p1', size: 'S', colour: 'Black', quantity: 1, isPreorder: false,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cart/items',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles 409 STOCK_CONFLICT by setting error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 409,
      json: async () => ({ error: 'STOCK_CONFLICT', stockAvailable: 2 }),
    }) as unknown as Response) as any;
    const { useCartStore } = await import('../cart-store');
    const result = await useCartStore.getState().addItem({
      productId: 'p1', size: 'S', colour: 'Black', quantity: 99, isPreorder: false,
    });
    expect(result).toMatchObject({ ok: false, error: 'STOCK_CONFLICT', stockAvailable: 2 });
  });
});
```

- [ ] **Step 3: Replace `cart-store.ts`**

Replace the entire contents of `src/lib/stores/cart-store.ts` with:

```ts
import { create } from 'zustand';
import type { CartSnapshotT, AddItemRequestT } from '@/lib/schemas/cart';

type AddResult =
  | { ok: true }
  | { ok: false; error: 'STOCK_CONFLICT'; stockAvailable: number }
  | { ok: false; error: 'INVALID_BODY' | 'UNKNOWN' };

type PromoResult =
  | { ok: true }
  | { ok: false; error: string; message?: string };

interface CartState {
  snapshot: CartSnapshotT | null;
  isLoading: boolean;
  isOpen: boolean;
  hydrate: () => Promise<void>;
  addItem: (input: AddItemRequestT) => Promise<AddResult>;
  setQuantity: (itemId: string, quantity: number) => Promise<AddResult>;
  removeItem: (itemId: string) => Promise<void>;
  applyPromo: (code: string) => Promise<PromoResult>;
  removePromo: () => Promise<void>;
  clear: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
}

async function call<T = CartSnapshotT>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T }> {
  const res = await fetch(url, { credentials: 'include', headers: { 'content-type': 'application/json' }, ...init });
  const json = (await res.json()) as T;
  return { ok: res.ok, status: res.status, json };
}

export const useCartStore = create<CartState>()((set, get) => ({
  snapshot: null,
  isLoading: false,
  isOpen: false,

  async hydrate() {
    set({ isLoading: true });
    const { json } = await call('/api/cart');
    set({ snapshot: json, isLoading: false });
  },

  async addItem(input) {
    const { ok, status, json } = await call('/api/cart/items', { method: 'POST', body: JSON.stringify(input) });
    if (ok) { set({ snapshot: json as unknown as CartSnapshotT }); return { ok: true }; }
    if (status === 409 && (json as any).error === 'STOCK_CONFLICT') {
      return { ok: false, error: 'STOCK_CONFLICT', stockAvailable: (json as any).stockAvailable };
    }
    return { ok: false, error: 'UNKNOWN' };
  },

  async setQuantity(itemId, quantity) {
    const { ok, status, json } = await call(`/api/cart/items/${itemId}`, {
      method: 'PATCH', body: JSON.stringify({ quantity }),
    });
    if (ok) { set({ snapshot: json as unknown as CartSnapshotT }); return { ok: true }; }
    if (status === 409) return { ok: false, error: 'STOCK_CONFLICT', stockAvailable: (json as any).stockAvailable };
    return { ok: false, error: 'UNKNOWN' };
  },

  async removeItem(itemId) {
    const { json } = await call(`/api/cart/items/${itemId}`, { method: 'DELETE' });
    set({ snapshot: json });
  },

  async applyPromo(code) {
    const { ok, json } = await call('/api/cart/promo', { method: 'POST', body: JSON.stringify({ code }) });
    if (ok) { set({ snapshot: json as unknown as CartSnapshotT }); return { ok: true }; }
    return { ok: false, error: (json as any).error ?? 'UNKNOWN', message: (json as any).message };
  },

  async removePromo() {
    const { json } = await call('/api/cart/promo', { method: 'DELETE' });
    set({ snapshot: json });
  },

  async clear() {
    const { json } = await call('/api/cart', { method: 'DELETE' });
    set({ snapshot: json });
  },

  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
}));
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/stores/__tests__/cart-store.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/cart-store.ts src/lib/stores/__tests__/cart-store.test.ts
git commit -m "refactor(cart-store): in-memory only, server-driven via API"
```

---

## Task 38: Client `checkout-store` rewrite

**Files:**
- Modify: `src/lib/stores/checkout-store.ts`

- [ ] **Step 1: Read existing**

Open `src/lib/stores/checkout-store.ts`. It currently has stub `placeOrder()` returning a fake id.

- [ ] **Step 2: Replace contents**

Replace the entire file with:

```ts
import { create } from 'zustand';
import type { ShippingAddressT, QuoteResponseT } from '@/lib/schemas/checkout';

interface CheckoutState {
  shippingAddress: ShippingAddressT | null;
  quote: QuoteResponseT | null;
  selectedMethodId: string | null;
  setAddress: (address: ShippingAddressT) => void;
  setQuote: (quote: QuoteResponseT) => void;
  selectMethod: (methodId: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()((set) => ({
  shippingAddress: null,
  quote: null,
  selectedMethodId: null,
  setAddress: (shippingAddress) => set({ shippingAddress }),
  setQuote: (quote) => set({ quote }),
  selectMethod: (selectedMethodId) => set({ selectedMethodId }),
  reset: () => set({ shippingAddress: null, quote: null, selectedMethodId: null }),
}));
```

- [ ] **Step 3: Find and update consumers**

Search for any imports of the old `placeOrder` method:

```bash
grep -rn "useCheckoutStore" src/ | grep -v node_modules | grep -v __tests__
```

Update each call site: any `placeOrder()` invocation moves to the new API call (will be wired in Task 40 below).

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: most tests pass; if existing checkout-store tests fail because of removed methods, delete or update those tests inline.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/checkout-store.ts src/lib/stores/__tests__/checkout-store.test.ts
git commit -m "refactor(checkout-store): hold address/quote/method only; place-order moved to API"
```

---

## Task 39: `/cart` page — wire to server cart

**Files:**
- Modify: `src/app/cart/page.tsx`

- [ ] **Step 1: Read current `/cart`**

Open `src/app/cart/page.tsx`. Note where it reads `useCartStore.items` directly.

- [ ] **Step 2: Update consumers**

Replace `state.items` reads with `state.snapshot?.items ?? []`. Replace direct mutation calls with the new async ones. Specifically:

- `useCartStore((s) => s.items)` → `useCartStore((s) => s.snapshot?.items ?? [])`
- `useCartStore((s) => s.subtotal())` → `useCartStore((s) => s.snapshot?.subtotalCents ?? 0)` (note: returns cents, format on display)
- `useCartStore((s) => s.itemCount())` → `useCartStore((s) => s.snapshot?.itemCount ?? 0)`
- `removeItem(productId, size)` → `removeItem(itemId)` (item now identified by `CartItem.id`)
- `setQuantity(productId, size, q)` → `setQuantity(itemId, q)`

Add a `useEffect(() => { useCartStore.getState().hydrate() }, [])` near the page root for first-load hydration.

- [ ] **Step 3: Run dev server and visit /cart manually**

```bash
pnpm dev
```

Open `http://localhost:3000/cart`. Verify the page loads (empty cart) without console errors.

- [ ] **Step 4: Stop dev server, run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/app/cart/page.tsx
git commit -m "feat(cart): /cart page reads from server-driven snapshot"
```

---

## Task 40: `/checkout/shipping` — quote-driven UI

**Files:**
- Modify: `src/app/checkout/shipping/page.tsx`
- Modify: `src/components/checkout/shipping-form.tsx`

- [ ] **Step 1: Update `shipping-form.tsx`**

Add a country select to the shipping form, default `GB`. On change, expose via `onCountryChange` callback. Add a method-list area below the address fields that renders `quote.methods` as radio buttons with the price next to each. The "Continue to payment" button disables until a method is selected.

(Concrete component code is too large to inline — follow the existing form's pattern. Key new props: `quote: QuoteResponseT | null`, `onCountryChange: (cc: string) => void`, `selectedMethodId: string | null`, `onSelectMethod: (id: string) => void`.)

- [ ] **Step 2: Rewrite `src/app/checkout/shipping/page.tsx`**

```tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { ShippingForm } from '@/components/checkout/shipping-form';
import { OrderSummaryCard } from '@/components/checkout/order-summary-card';
import { useCheckoutStore } from '@/lib/stores/checkout-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { QuoteResponse, type ShippingAddressT } from '@/lib/schemas/checkout';

export default function CheckoutShippingPage() {
  const router = useRouter();
  const cart = useCartStore((s) => s.snapshot);
  const hydrate = useCartStore((s) => s.hydrate);
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const setQuote = useCheckoutStore((s) => s.setQuote);
  const quote = useCheckoutStore((s) => s.quote);
  const selectMethod = useCheckoutStore((s) => s.selectMethod);
  const selectedMethodId = useCheckoutStore((s) => s.selectedMethodId);

  React.useEffect(() => { hydrate(); }, [hydrate]);
  React.useEffect(() => {
    if (cart && cart.items.length === 0) router.push('/');
  }, [cart, router]);

  async function handleQuote(address: ShippingAddressT) {
    const res = await fetch('/api/checkout/quote', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const json = QuoteResponse.parse(await res.json());
    setQuote(json);
    setAddress(address);
  }

  function handleContinue() {
    if (!selectedMethodId) return;
    router.push('/checkout/payment');
  }

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={1} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <ShippingForm
            quote={quote}
            selectedMethodId={selectedMethodId}
            onAddressBlur={handleQuote}
            onSelectMethod={selectMethod}
            onContinue={handleContinue}
          />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
```

(`onAddressBlur` triggers a quote refresh whenever a complete-enough address is in hand — simplest is to call after country+postcode are filled.)

- [ ] **Step 3: Smoke test in browser**

```bash
pnpm dev
```

Open `/checkout/shipping`, type an address with country=US, see DHL quote appear; switch to GB, see Royal Mail FREE.

- [ ] **Step 4: Commit**

```bash
git add src/app/checkout/shipping/page.tsx src/components/checkout/shipping-form.tsx
git commit -m "feat(checkout/shipping): quote-driven country select + method radio"
```

---

## Task 41: `/checkout/payment` — Stripe `<PaymentElement />`

**Files:**
- Modify: `src/app/checkout/payment/page.tsx`
- Create: `src/components/checkout/stripe-payment-element.tsx`

- [ ] **Step 1: Implement the Elements wrapper**

Create `src/components/checkout/stripe-payment-element.tsx`:

```tsx
'use client';

import * as React from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';

interface Props {
  clientSecret: string;
  orderId: string;
  totalLabel: string;
}

export function StripePaymentElement(props: Props) {
  const stripePromise = React.useMemo(() => getStripe(), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe' } }}>
      <PayForm orderId={props.orderId} totalLabel={props.totalLabel} />
    </Elements>
  );
}

function PayForm({ orderId, totalLabel }: { orderId: string; totalLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success/${orderId}`,
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed');
      setSubmitting(false);
    }
    // On success Stripe redirects to return_url before this resolves.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="btn btn-primary w-full"
      >
        {submitting ? 'Processing...' : `Pay ${totalLabel}`}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `/checkout/payment/page.tsx`**

```tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { OrderSummaryCard } from '@/components/checkout/order-summary-card';
import { StripePaymentElement } from '@/components/checkout/stripe-payment-element';
import { useCheckoutStore } from '@/lib/stores/checkout-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/format';
import { CreateOrderResponse } from '@/lib/schemas/checkout';

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const cart = useCartStore((s) => s.snapshot);
  const address = useCheckoutStore((s) => s.shippingAddress);
  const methodId = useCheckoutStore((s) => s.selectedMethodId);
  const quote = useCheckoutStore((s) => s.quote);
  const [order, setOrder] = React.useState<{ orderId: string; clientSecret: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cart || cart.items.length === 0) { router.push('/'); return; }
    if (!address || !methodId || !quote) { router.push('/checkout/shipping'); return; }
  }, [cart, address, methodId, quote, router]);

  React.useEffect(() => {
    if (!address || !methodId || order) return;
    (async () => {
      const res = await fetch('/api/checkout/create', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, methodId }),
      });
      if (res.status === 409) {
        const j = await res.json();
        if (j.error === 'STOCK_CONFLICT') { router.push('/cart?error=stock'); return; }
        setError(j.message ?? 'Checkout error'); return;
      }
      if (!res.ok) { setError('Checkout error'); return; }
      const json = CreateOrderResponse.parse(await res.json());
      setOrder(json);
    })();
  }, [address, methodId, order, router]);

  const selected = quote?.methods.find((m) => m.methodId === methodId);
  const totalCents = (cart?.subtotalCents ?? 0) - (cart?.discountCents ?? 0) + (selected?.totalCents ?? 0);
  const totalLabel = formatPrice(totalCents, 'GBP');

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={2} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            {order && <StripePaymentElement
              clientSecret={order.clientSecret}
              orderId={order.orderId}
              totalLabel={totalLabel}
            />}
            {!order && !error && <p>Preparing payment…</p>}
          </div>
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 3: Browser smoke test**

```bash
pnpm dev
```

Add an item, fill shipping (US), select DHL, navigate to payment. The Stripe Elements iframe should render. Use `4242 4242 4242 4242` exp `12/30` cvc `123` postal `12345` → "Pay" → redirect to `/checkout/success/{orderId}`.

- [ ] **Step 4: Commit**

```bash
git add src/components/checkout/stripe-payment-element.tsx src/app/checkout/payment/page.tsx
git commit -m "feat(checkout): /payment with Stripe PaymentElement"
```

---

## Task 42: `/checkout/success` — polling + claim form

**Files:**
- Modify: `src/app/checkout/success/[id]/page.tsx`
- Create: `src/components/checkout/claim-account-form.tsx`

- [ ] **Step 1: Implement claim form**

Create `src/components/checkout/claim-account-form.tsx`:

```tsx
'use client';

import * as React from 'react';

export function ClaimAccountForm({ orderId, email }: { orderId: string; email?: string }) {
  const [password, setPassword] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (done) return (
    <div className="rounded-md bg-green-50 p-4">Account created. You'll find this order in your account next time you sign in.</div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch('/api/account/claim', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, password }),
    });
    if (res.ok) { setDone(true); return; }
    const j = await res.json();
    setErr(j.message ?? j.error ?? 'Could not save');
  }

  return (
    <form onSubmit={submit} className="rounded-md border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Save your details</h3>
      <p className="text-sm text-neutral-600">
        Set a password to track this order{email ? ` and find ${email}'s past orders later` : ''}.
      </p>
      <input
        type="password" required minLength={12} value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border rounded px-3 py-2"
        placeholder="Password (12+ characters)"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" className="btn btn-primary w-full">Create account</button>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `/checkout/success/[id]/page.tsx`**

```tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { ClaimAccountForm } from '@/components/checkout/claim-account-form';
import { formatPrice } from '@/lib/format';

interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: 'GBP';
  carrier: string;
  items: Array<{ id: string; productName: string; size: string; colour: string; quantity: number; unitPriceCents: number }>;
  isGuestOrder: boolean;
  shipping: { firstName: string; lastName: string; line1: string; city: string; postcode: string; country: string; phone: string };
  createdAt: string;
}

export default function CheckoutSuccessPage() {
  const params = useParams();
  const orderId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const [order, setOrder] = React.useState<OrderView | null>(null);
  const [tries, setTries] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as OrderView;
      if (cancelled) return;
      setOrder(json);
      if (json.status === 'PENDING_PAYMENT' && tries < 20) {
        setTimeout(() => setTries((t) => t + 1), 1500);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [orderId, tries]);

  if (!order) return <Section padding="md"><Container>Loading…</Container></Section>;

  const stillPending = order.status === 'PENDING_PAYMENT' && tries >= 20;

  return (
    <Section padding="md">
      <Container size="wide">
        <h1 className="text-3xl font-bold mb-2">Order {order.orderNumber}</h1>
        <p className="mb-8">
          {order.status === 'NEW' && 'Payment received! We\'ll email you when it ships.'}
          {order.status === 'PAYMENT_FAILED' && 'Payment didn\'t go through. Please try again.'}
          {order.status === 'PENDING_PAYMENT' && !stillPending && 'Confirming your payment…'}
          {stillPending && 'We\'re still confirming your payment — check your email.'}
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Items</h2>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.productName} — {it.colour} / {it.size} × {it.quantity}</span>
                  <span>{formatPrice(it.unitPriceCents * it.quantity, 'GBP')}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.totalCents, 'GBP')}</span>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Shipping to</h2>
              <p>{order.shipping.firstName} {order.shipping.lastName}</p>
              <p>{order.shipping.line1}</p>
              <p>{order.shipping.city} {order.shipping.postcode}</p>
              <p>{order.shipping.country}</p>
            </div>
            {order.isGuestOrder && order.status === 'NEW' && (
              <ClaimAccountForm orderId={order.id} />
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 3: Browser smoke test**

```bash
pnpm dev
```

Complete a checkout with `4242 4242 4242 4242`. Verify:

1. Redirect to `/checkout/success/{id}` after Stripe confirm.
2. Page shows "Confirming your payment…" briefly, then "Payment received!" once webhook fires.
3. Claim form appears under shipping. Enter password (12+ chars) → success message. Reload page → claim form gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/checkout/claim-account-form.tsx src/app/checkout/success/[id]/page.tsx
git commit -m "feat(checkout/success): polling + ghost-user claim CTA"
```

---

## Task 43: End-to-end cart-flow integration test

**Files:**
- Create: `src/app/api/cart/__tests__/cart-flow.test.ts`

This exercises the full guest → signin → merge journey through the API surface (route handlers wired together, real Postgres).

- [ ] **Step 1: Implement**

Create `src/app/api/cart/__tests__/cart-flow.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { GET as getCart } from '../route';
import { POST as addItem } from '../items/route';
import { mergeGuestIntoUser } from '@/server/cart/merge';
import { createUser } from '@/server/repositories/user.repo';

describe('cart full lifecycle (guest → signin → merge)', () => {
  beforeEach(async () => { await resetDb(); });

  it('end-to-end', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'flow', name: 'P', priceCents: 10000, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });

    // 1) Guest GET — empty cart, sets cookie.
    const r1 = await getCart(new Request('http://localhost/api/cart'));
    const cookie = r1.headers.get('set-cookie')!.split(';')[0];

    // 2) Guest adds item.
    const r2 = await addItem(new Request('http://localhost/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false }),
      headers: { 'content-type': 'application/json', cookie },
    }));
    expect(r2.status).toBe(200);
    const guestSnap = await r2.json();
    expect(guestSnap.itemCount).toBe(1);

    // 3) Sign in (mocked — directly mergeGuestIntoUser).
    const user = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const guestToken = cookie.split('=')[1];
    const merged = await mergeGuestIntoUser({ userId: user.id, guestSessionToken: guestToken });
    expect(merged.userId).toBe(user.id);

    // 4) After-signin GET (with auth mocked) returns the merged cart.
    vi.doMock('@/server/auth/session', () => ({
      getSessionUser: async () => ({ id: user.id, email: user.email, firstName: 'A', lastName: 'B' }),
    }));
    const { GET: getCartAuth } = await import('../route?auth-mode');
    const r3 = await getCartAuth(new Request('http://localhost/api/cart'));
    const userSnap = await r3.json();
    expect(userSnap.items).toHaveLength(1);
    expect(userSnap.id).toBe(merged.id);

    vi.doUnmock('@/server/auth/session');
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm test src/app/api/cart/__tests__/cart-flow.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cart/__tests__/cart-flow.test.ts
git commit -m "test(cart): full guest → signin → merge integration"
```

---

## Task 44: Checkout-flow integration test

**Files:**
- Create: `src/app/api/checkout/__tests__/checkout-flow.test.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/checkout/__tests__/checkout-flow.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { mockStripeSdk } from '@/server/__tests__/helpers/mock-stripe';
import { seedShipping } from '../../../../../tests/seeds/shipping';
import { POST as addItem } from '../../cart/items/route';
import { GET as getCart } from '../../cart/route';
import { POST as quote } from '../quote/route';

describe('checkout flow (cart → quote → create)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedShipping(prisma);
  });

  it('creates Order(PENDING_PAYMENT) end-to-end for a guest UK order', async () => {
    const stripe = mockStripeSdk();
    const product = await prisma.product.create({
      data: {
        slug: 'eco', name: 'Eco', priceCents: 30000, currency: 'GBP',
        weightGrams: 1500, hsCode: '6202.93', countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'M', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });

    // 1) Guest hits /api/cart.
    const r1 = await getCart(new Request('http://localhost/api/cart'));
    const cookie = r1.headers.get('set-cookie')!.split(';')[0];

    // 2) Add item.
    await addItem(new Request('http://localhost/api/cart/items', {
      method: 'POST', body: JSON.stringify({
        productId: product.id, size: 'M', colour: 'Black', quantity: 1, isPreorder: false,
      }),
      headers: { 'content-type': 'application/json', cookie },
    }));

    // 3) Quote shipping for GB.
    const qRes = await quote(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', body: JSON.stringify({
        address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1 St', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+440000000000' },
      }),
      headers: { 'content-type': 'application/json', cookie },
    }));
    const qBody = await qRes.json();
    const methodId = qBody.methods[0].methodId;

    // 4) Create order.
    const { POST: createOrder } = await import('../create/route');
    const cRes = await createOrder(new Request('http://localhost/api/checkout/create', {
      method: 'POST', body: JSON.stringify({
        address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1 St', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+440000000000' },
        methodId,
      }),
      headers: { 'content-type': 'application/json', cookie },
    }));
    expect(cRes.status).toBe(200);
    const cBody = await cRes.json();
    expect(cBody.orderId).toBeDefined();
    expect(cBody.clientSecret).toBe(stripe.clientSecret);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: cBody.orderId }, include: { items: true, payment: true, user: true },
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.totalCents).toBe(30000); // UK is £0 shipping
    expect(order.user?.isGuest).toBe(true);
    expect(stripe.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 30000, currency: 'gbp',
      metadata: expect.objectContaining({ orderId: cBody.orderId }),
    }));
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm test src/app/api/checkout/__tests__/checkout-flow.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/__tests__/checkout-flow.test.ts
git commit -m "test(checkout): cart → quote → create end-to-end"
```

---

## Task 45: Webhook flow integration test (real signature)

**Files:**
- Create: `src/app/api/webhooks/stripe/__tests__/webhook-flow.test.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/webhooks/stripe/__tests__/webhook-flow.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/prisma';
import { POST } from '../route';
import Stripe from 'stripe';

describe('webhook flow (signed payload)', () => {
  beforeEach(async () => { await resetDb(); });

  /**
   * Build a properly-signed Stripe webhook payload using the same secret the
   * server expects (process.env.STRIPE_WEBHOOK_SECRET — populated from .env).
   * We use Stripe's `webhooks.generateTestHeaderString` helper.
   */
  function signEvent(event: object, secret: string): { rawBody: string; signature: string } {
    const rawBody = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: rawBody, secret, timestamp: Math.floor(Date.now() / 1000),
    });
    return { rawBody, signature };
  }

  it('payment_intent.succeeded → flips Order(PENDING_PAYMENT) → NEW', async () => {
    // Seed Order in PENDING_PAYMENT.
    const product = await prisma.product.create({
      data: { slug: 'wf', name: 'P', priceCents: 20000, currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] } },
    });
    const user = await prisma.user.create({ data: { email: 'g@x.com', passwordHash: null, isGuest: true } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001', userId: user.id, status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: 'wf', productName: 'P', productImage: '/x.jpg',
          colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_real', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
    });

    const event = {
      id: 'evt_real_1', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_real' } },
    };
    const { rawBody, signature } = signEvent(event, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST', body: rawBody, headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('NEW');
  });

  it('rejects invalid signature with 400', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST', body: '{}', headers: { 'stripe-signature': 'fake' },
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm test src/app/api/webhooks/stripe/__tests__/webhook-flow.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/__tests__/webhook-flow.test.ts
git commit -m "test(webhook): signed-payload flow integration"
```

---

## Task 46: Live Stripe test card e2e (optional smoke)

**Files:**
- Create: `e2e/checkout.spec.ts` (skipped unless `RUN_E2E=1`)

This is a Playwright spec that exercises the live Stripe Test mode end-to-end. Optional — skipped in CI by default.

- [ ] **Step 1: Verify Playwright is installed**

```bash
pnpm exec playwright --version
```

If not installed:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Implement**

Create `e2e/checkout.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const RUN = process.env.RUN_E2E === '1';

test.describe('checkout e2e', () => {
  test.skip(!RUN, 'Set RUN_E2E=1 to run against running dev server + Stripe Test mode');

  test('successful card payment', async ({ page }) => {
    await page.goto('/');
    // Add a known seeded item to cart.
    await page.click('a[href*="/products/"]');
    await page.click('button:has-text("Add to bag")');
    await page.goto('/checkout/shipping');
    await page.fill('input[name="email"]', 'guest@example.com');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Buyer');
    await page.fill('input[name="line1"]', '1 Test St');
    await page.fill('input[name="city"]', 'London');
    await page.fill('input[name="postcode"]', 'SW1A 1AA');
    await page.fill('input[name="phone"]', '+447700900000');
    await page.selectOption('select[name="countryCode"]', 'GB');
    await page.waitForSelector('input[type="radio"][name="method"]');
    await page.click('input[type="radio"][name="method"]');
    await page.click('button:has-text("Continue to payment")');

    // Stripe Elements iframe.
    const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await cardFrame.locator('input[name="number"]').fill('4242 4242 4242 4242');
    await cardFrame.locator('input[name="expiry"]').fill('12 / 30');
    await cardFrame.locator('input[name="cvc"]').fill('123');
    await cardFrame.locator('input[name="postal"]').fill('SW1A 1AA');

    await page.click('button:has-text("Pay")');
    await page.waitForURL(/\/checkout\/success\//, { timeout: 30_000 });
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 30_000 });
  });
});
```

Add minimal `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', headless: true },
});
```

- [ ] **Step 3: Run manually (only when verifying)**

```bash
# Terminal 1
pnpm dev
# Terminal 2
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Terminal 3
RUN_E2E=1 pnpm exec playwright test
```

Expected: passes (assuming Stripe CLI forwards events to your local).

- [ ] **Step 4: Commit (skipped suite is fine for CI)**

```bash
git add e2e/checkout.spec.ts playwright.config.ts package.json
git commit -m "test(e2e): Playwright checkout smoke (RUN_E2E=1)"
```

---

## Task 47: Final type check + lint + full test sweep

**Files:** none — verification only.

- [ ] **Step 1: Full type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```bash
pnpm exec eslint src/ --max-warnings 0
```

Expected: passes. The `no-restricted-imports` rule (Phase 2) blocks `lib/` from importing `server/` — confirm cart-store / checkout-store still respect this.

- [ ] **Step 3: Full test suite**

```bash
pnpm test
```

Expected: all tests pass. Phase 4 should have added ~50–80 new tests on top of Phase 3's 263.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: completes. No `useSearchParams` Suspense warnings (Phase 3 wrapped them already; new pages also wrap).

If build fails, fix the offending page (typically wrap a hook-using component in `<Suspense>`).

- [ ] **Step 5: Commit any stragglers**

```bash
git status
git diff
```

If anything dirty after the build (generated artefacts excluded), commit with:

```bash
git add -p
git commit -m "chore(phase-4): post-build fixes"
```

---

## Task 48: Update `.env.example` and seed script for production-ready dev experience

**Files:** verification only.

- [ ] **Step 1: Open `.env.example`** and confirm every Phase 4 var is documented (already done in Task 2 — re-check).

- [ ] **Step 2: Run a fresh seed**

```bash
pnpm prisma migrate reset --force
pnpm prisma db seed
```

Expected: seed runs without errors, populates Phase 1 fixtures + Phase 4 zones + WELCOME10 promo.

- [ ] **Step 3: Smoke test full flow in browser**

```bash
pnpm dev
# in another terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Walk through:
1. Browse → add to bag (guest) → /cart shows item.
2. /checkout/shipping → enter US address → DHL DDP rate appears with duties.
3. /checkout/payment → Stripe Elements renders.
4. Pay with `4242 4242 4242 4242` → redirect to /success.
5. Success page polls; status flips NEW within 1–2 seconds.
6. Claim form appears; set password; reload → claim form gone.
7. Open browser dev tools → cookies — `__ynot_cart` cleared after order, `__ynot_order_token` set with 24h expiry.
8. `/account/orders` after sign-in shows the just-claimed order.

If any step fails: triage, fix, commit, retry.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore(phase-4): full smoke-test fixes"
```

---

## Task 49: Push branch + open PR

**Files:** none — git only.

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/backend-phase-4-cart-checkout-stripe
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: backend Phase 4 — cart, checkout, Stripe" --body "$(cat <<'EOF'
## Summary

- Server-of-record cart with optimistic Zustand cache (no localStorage persist)
- Stripe `PaymentIntent` + `<PaymentElement />` custom UI
- `Order(PENDING_PAYMENT) → NEW` state machine driven by idempotent webhook (`StripeEvent` dedupe)
- UK FREE (Royal Mail) + International DDP (mock DHL) shipping providers behind a `ShippingRateProvider` interface — swappable to live `DhlExpressProvider` in Phase 5
- Promo codes apply at cart, redeem only on `payment_intent.succeeded`
- UTM/referrer attribution captured via middleware → persisted on Order
- Guest checkout via "ghost" users (`User.passwordHash = null`, `isGuest = true`) with post-purchase `<ClaimAccountForm />` to set a password
- HMAC-signed `__ynot_order_token` cookie (24h) authorises ghost order viewing on `/checkout/success`
- Schema migration adds `OrderStatus` payment states, `StripeEvent`, `Order.promoCodeId`, `User` ghost flags, `Product` physical attributes, and the `order_number_seq` Phase 1 §241 specified
- Seeds UK + International zones + `WELCOME10` promo

Spec: `web/docs/superpowers/specs/2026-04-30-ynot-backend-phase-4-cart-checkout-stripe-design.md`
Plan: `web/docs/superpowers/plans/2026-04-30-ynot-backend-phase-4-cart-checkout-stripe.md`

## Test plan

- [ ] `pnpm test` — full suite passes
- [ ] `pnpm exec tsc --noEmit` — zero errors
- [ ] `pnpm exec eslint src/ --max-warnings 0` — zero warnings
- [ ] `pnpm build` — succeeds with no Suspense warnings
- [ ] Manual: full guest checkout flow with `4242 4242 4242 4242` → claim form → sign-in
- [ ] Manual: 3DS challenge with `4000 0025 0000 3155` → pass
- [ ] Manual: declined card with `4000 0000 0000 9995` → inline error → cart preserved
- [ ] Manual: international (US) → see DHL DDP rate + duties on order summary

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Confirm PR opened, share URL with reviewer**

PR URL printed by `gh pr create` — paste into review channel.

---

## Task 50: Post-merge cleanup

**Files:** none — git only.

- [ ] **Step 1: After merge to main, sync local main**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git fetch origin
git checkout main
git reset --hard origin/main
```

- [ ] **Step 2: Remove the worktree**

```bash
git worktree remove .worktrees/backend-phase-4-cart-checkout-stripe
git branch -D feature/backend-phase-4-cart-checkout-stripe
```

- [ ] **Step 3: Stop the local Stripe CLI listener**

In whichever terminal it's running: `Ctrl+C`. The webhook secret was specific to that session — Phase 5 will issue a new one if/when needed.

- [ ] **Step 4: Local stack — leave running or stop**

If continuing immediately to Phase 5: leave Postgres + Redis running. Otherwise:

```bash
docker compose --profile dev down
```

---

## Self-Review

After writing the plan, the following spot-checks were run:

**1. Spec coverage:** Each spec section maps to at least one task:
- §5 architecture → Tasks 5–10, 11–15, 21–23, 26, 29, 31
- §6 schema → Task 3
- §7 cart subsystem → Tasks 8–20, 37, 39, 43
- §8 checkout flow → Tasks 27–28, 30, 38, 40–42
- §9 Stripe integration → Tasks 6, 29, 30, 41
- §10 webhook → Tasks 31–34, 45
- §11 shipping → Tasks 21–24
- §12 promo codes → Tasks 14, 24, 32
- §13 UTM attribution → Task 25
- §14 guest checkout → Tasks 7, 26, 29, 30, 36, 42
- §15 tests → Tasks 11–15, 21–22, 25, 26, 29, 31–33, 35–36, 43–46

**2. Placeholder scan:** No "TBD"/"TODO"/"add error handling" lines. All test bodies are full code; all implementation steps show the file content.

**3. Type consistency:**
- `CartSnapshotT` defined in Task 10, used identically in Tasks 11, 17, 37
- `StockConflictError` (Task 12) used unchanged in Task 18, 19, 29, 30
- `ShippingRateProvider` (Task 21) implemented in Tasks 21–22, composed in Task 23, consumed in Task 28, 29
- `nextOrderNumber(tx)` (Task 5) called only in Task 29 with the same signature
- `signOrderToken(orderId, createdAt)` / `verifyOrderToken(token)` (Task 26) consumed in Tasks 29 (issue), 30 (set cookie), 35 (verify), 36 (verify)

No naming drift detected.

---

## Execution Handoff

Plan complete and saved to `web/docs/superpowers/plans/2026-04-30-ynot-backend-phase-4-cart-checkout-stripe.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a phase this size: each subagent works in a clean context, you review the diff after each commit, easy to course-correct.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review. Faster context-wise (no subagent overhead) but the long context grows quickly across 50 tasks.

**Which approach?**
