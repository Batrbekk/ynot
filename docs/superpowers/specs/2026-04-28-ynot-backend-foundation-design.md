# YNOT London — Backend Foundation Design

**Date:** 2026-04-28
**Status:** Draft (pending user review)
**Scope:** Phase 0 of 6 in the YNOT backend roadmap. Pure infrastructure; storefront continues reading mock data until Phase 2.

---

## 1. Context

The YNOT London storefront frontend is feature-complete (9 phases merged to `main`). All consumer-facing pages render from `web/src/lib/data/_mock/*.json` via async façades (`getAllProducts`, `getProductBySlug`, `getHero`, `getOrderById`, etc.). Zod schemas in `web/src/lib/schemas/` define the shape of every domain object.

This Foundation spec stands up the persistent backend layer (Postgres, Redis, Prisma, server-only code namespace) **without** touching the storefront's read paths. After Foundation merges, `pnpm dev` renders the site identically to today; the database exists alongside the mocks, populated via seed.

Subsequent phases (not in scope here):
1. **Foundation** ← this spec
2. **Catalog & CMS read replacement** — swap `getAllProducts/...` to Prisma reads
3. **Auth & Customer** — NextAuth, sessions, profile, addresses
4. **Cart, Checkout, Stripe** — server-side cart, payment intents, webhook
5. **Orders & Fulfilment** — lifecycle, returns, Royal Mail/DHL, Resend transactional email
6. **Admin Panel** — separate sub-project (`web/src/app/(admin)/*`), 20 modules

---

## 2. Goals

1. Provide a reproducible, containerised local dev environment (`docker compose up`) that any new contributor can run in under 10 minutes.
2. Define the **complete domain schema** (including future entities like `Order`, `Payment`, `PromoCode`) so subsequent phases never have to retrofit columns or rename tables in production.
3. Seed the database from the existing `_mock/*.json` files so dev environments are deterministic and identical to today's frontend behaviour.
4. Establish a strict `lib/` ↔ `server/` boundary that prevents client-side code from importing the database client.
5. Set up a real-Postgres test harness (Vitest) so future server logic is tested against actual SQL semantics, not mocks.
6. Lock in the validated-ENV pattern so missing/invalid configuration fails at startup, not at request time.

## 3. Non-goals (deferred to later phases)

- ❌ Replacing the existing storefront read paths (`getAllProducts`, `getHero`, `getOrderById`, …) with Prisma — Phase 2.
- ❌ NextAuth wiring, sign-in/register UI, password reset, sessions — Phase 3.
- ❌ Mutations, admin CRUD routes, Server Actions for editing products/categories/CMS — Phase 6.
- ❌ Stripe SDK, checkout, payment intents, webhook — Phase 4.
- ❌ Royal Mail / DHL clients, label generation, tracking sync — Phase 5.
- ❌ Resend (transactional email) — Phase 5.
- ❌ Admin panel UI — separate sub-project.
- ❌ Cloudflare R2 client + admin upload handler — Phase 6 (only the `MediaAsset` table is in this spec).
- ❌ Cloudflare DNS / proxy / Web Analytics setup — Phase "Deploy & Ops".
- ❌ TLS certificates / Let's Encrypt — Phase "Deploy & Ops".
- ❌ CI/CD (GitHub Actions, automated deploys) — Phase "Deploy & Ops".
- ❌ Backup automation (`pg_dump → R2` cron) — Phase "Deploy & Ops".
- ❌ Sentry / observability tooling — Phase "Deploy & Ops".

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Single language across FE+BE. Reuses existing Zod schemas as runtime validators with zero duplication. |
| Runtime | Node.js 22 LTS | Matches Next.js 16 requirements; LTS through 2027. |
| Framework | Next.js 16 Route Handlers + Server Actions (Foundation only stubs `/api/health`) | Same repo as frontend, no separate service to deploy, server-side rendering for admin panel comes for free in Phase 6. |
| ORM | Prisma 5 | Type-safe client, mature migrations, excellent dev-loop, official PostgreSQL adapter. |
| Database | PostgreSQL 16 | Battle-tested, JSON support for snapshots, partial indexes for unique-when-active patterns. |
| Cache | Redis 7 | Used Phase 2+ for catalog cache and rate-limit; Foundation only verifies connectivity in `/api/health`. |
| Validation | Zod 4 (already in repo) | Single source of truth for ENV, request bodies, repository return types. |
| Test runner | Vitest 4 (already in repo) | Same harness as frontend; supports real-Postgres integration tests via single-fork pool. |
| Container runtime | Docker + Docker Compose v2 | Local dev parity with prod VPS. Single `docker compose up` brings up Postgres + Redis for dev; full stack profile for prod. |

### Why not Go / Python

A premium boutique handles ~100–1000 orders/month at launch, scaling to ~30 000/month over 2–3 years. The latency floor is set by Stripe (300–600 ms per `PaymentIntent`) and carrier APIs (200–500 ms), not by request-handler runtime. Switching to Go saves ≈50 ms on a request that already takes ≈800 ms — invisible to users. Meanwhile, splitting into a separate Go/Python service forfeits Zod-schema reuse, NextAuth, Server Actions, and adds an entire deploy/CORS/auth-bridge layer for no measurable user benefit.

### Hosting

- **VPS:** GoDaddy 2 vCPU / 4 GB / 100 GB NVMe SSD ($17.99/month). Configurable, in-place upgrades to 4 vCPU / 8 GB possible without migration when traffic warrants it.
- **CDN / DNS / WAF:** Cloudflare Free (configured in Phase "Deploy & Ops"). Absorbs 70–90 % of requests, provides TLS, hides origin IP, free DDoS protection.
- **Object storage:** Cloudflare R2 (configured in Phase 6 for admin uploads). 10 GB free tier; egress is free when consumed via Cloudflare.
- **Domain registrar:** GoDaddy (registration only; nameservers will point to Cloudflare in Phase "Deploy & Ops").

---

## 5. Topology

```
┌────────────────────────── GoDaddy VPS ──────────────────────────┐
│                                                                 │
│  ┌──────── nginx (80/443, Let's Encrypt) ───────┐               │
│  │   ynot.london           → Next.js (3000)     │               │
│  │   admin.ynot.london     → Next.js (3000)     │               │
│  └───────────────────┬───────────────────────────┘               │
│                      │                                          │
│  ┌──── Next.js (Docker, standalone, port 3000) ────────┐        │
│  │  • Storefront SSR/RSC                               │        │
│  │  • /api/* Route Handlers                            │        │
│  │  • Server Actions (admin)                           │        │
│  │  • Stripe webhook /api/webhooks/stripe              │        │
│  └────────┬──────────────┬──────────────┬──────────────┘        │
│           │              │              │                       │
│      ┌────▼────┐    ┌────▼────┐    ┌────▼─────┐                 │
│      │Postgres │    │ Redis   │    │ /var/    │                 │
│      │ Docker  │    │ Docker  │    │ ynot/    │                 │
│      │ :5432   │    │ :6379   │    │ uploads/ │                 │
│      └────┬────┘    └─────────┘    └──────────┘                 │
│           │                                                     │
│      pg_dump nightly → off-VPS (Cloudflare R2)                  │
└─────────────────────────────────────────────────────────────────┘
```

Foundation delivers the Postgres and Redis containers and a `docker-compose.yml` skeleton with `dev` and `prod` profiles. nginx, TLS, certbot, and the production `app` container's deployment workflow are out of scope (Phase "Deploy & Ops").

---

## 6. Folder structure

```
web/src/
├── app/                          ← Next.js (frontend + future /api routes)
├── lib/                          ← CLIENT-side code (components, stores, schemas)
│   ├── schemas/                  ← Zod schemas (existing, unchanged)
│   ├── stores/                   ← Zustand (unchanged)
│   └── data/                     ← async façades (still on mocks until Phase 2)
│
└── server/                       ← NEW — server-only code, lib/* must NOT import from here
    ├── db/
    │   ├── client.ts             ← singleton PrismaClient (with dev hot-reload guard)
    │   ├── transaction.ts        ← thin $transaction helper
    │   └── README.md             ← migration naming + workflow
    │
    ├── repositories/             ← thin read/write layer over Prisma
    │   ├── product.repo.ts
    │   ├── category.repo.ts
    │   ├── cms.repo.ts           ← hero / lookbook / staticPage / announcement
    │   ├── order.repo.ts
    │   ├── user.repo.ts
    │   └── address.repo.ts
    │
    ├── services/                 ← business logic (Phase 2+; empty in Foundation)
    │   └── .gitkeep
    │
    ├── env.ts                    ← Zod-validated process.env (server-only)
    ├── redis.ts                  ← ioredis singleton (initialise + ping; used Phase 2+)
    └── index.ts                  ← public exports

web/prisma/
├── schema.prisma                 ← single source of truth for DB shape
├── migrations/                   ← timestamped SQL migrations (committed)
└── seed.ts                       ← idempotent seeder consuming _mock/*.json
```

**Boundary enforcement (eslint `no-restricted-imports`):**

| Layer | May import | May NOT import |
|---|---|---|
| `app/` | `lib/*`, `server/*` | — |
| `lib/` | `lib/*` | `server/*` (build fail if violated) |
| `server/repositories/` | `server/db/*`, `lib/schemas/*` | `lib/stores/*`, `app/*` |
| `server/services/` | `server/repositories/*`, `lib/schemas/*` | `app/*` |

The eslint rule prevents accidental shipping of the Prisma client to the browser bundle.

---

## 7. Domain model

The Prisma schema includes **all** entities the storefront and admin will eventually need, even when no Phase-0 code touches them. Adding tables to a populated production database is significantly more painful than declaring an empty table on day one.

### 7.1 Storefront / catalog (already consumed by frontend mocks)

| Model | Purpose |
|---|---|
| `Product` | core catalogue entry; matches `ProductSchema` from `lib/schemas/product.ts` |
| `ProductImage` | gallery rows; replaces inline `images[]` |
| `ProductSize` | composite-key stock per (productId, size); replaces inline `stock` map |
| `ColourOption` | swatch rows; replaces inline `colourOptions[]` |
| `Category` | with optional `parentId` (self-relation) for future sub-categories |
| `ProductCategory` | M:N junction |
| `StaticPage` | Our Story, Shipping, Privacy, Terms, Returns, FAQ — markdown body |
| `HeroBlock` | homepage hero (image or video); `isActive` partial-unique to enforce one live row |
| `AnnouncementMessage` | rotating top-bar text |
| `LookbookImage` | homepage carousel |
| `SitePolicy` | misc editable settings (currency, default carrier, free-ship threshold) |

### 7.2 Customer / auth (Phase 3 logic; tables in Foundation)

| Model | Purpose |
|---|---|
| `User` | both customers (`role: CUSTOMER`) and staff (`ADMIN` / `EDITOR` / `OWNER`) |
| `Account` | NextAuth: external OAuth providers (Google, etc., if added later) |
| `Session` | NextAuth session storage |
| `VerificationToken` | NextAuth: email verification, password reset tokens |
| `Address` | saved addresses per user |

### 7.3 Commerce (Phase 4–5 logic; tables in Foundation)

| Model | Purpose |
|---|---|
| `Cart` | persisted cart, supports both logged-in (`userId`) and guest (`sessionToken`); TTL via `expiresAt` |
| `CartItem` | rows of an active cart |
| `Order` | finalised order with `currency` column (locked to `GBP` at Foundation, but the column exists so multi-currency support in a future phase is purely additive — no schema migration of historic orders required), plus snapshot UTM attribution columns |
| `OrderItem` | line items with frozen `productSnapshot` fields, optional `preorderBatchId` link |
| `OrderStatusEvent` | status-change history (`NEW → PROCESSING → SHIPPED → ...`) for audit + tracking |
| `Payment` | Stripe `payment_intent_id`, status, refund history |
| `PromoCode` | promo codes (admin-spec #3) |
| `PromoRedemption` | per-order usage record (admin-spec ROI tracking) |
| `ShippingZone` | named groups of countries |
| `ShippingMethod` | carrier × zone × rate × free-ship threshold × estimated days |
| `PreorderBatch` | named cohort of pre-orders sharing an estimated dispatch window (admin-spec #19); admin can set `estimatedShipFrom/estimatedShipTo`, status (`PENDING / IN_PRODUCTION / SHIPPING / COMPLETED`), and link to a `productId`. Filled from Phase 6 admin UI. |

### 7.4 Admin / CMS / marketing (Phase 6 logic; tables in Foundation)

| Model | Purpose |
|---|---|
| `MediaAsset` | every R2 upload: `key`, `url`, `mimeType`, `sizeBytes`, dimensions, uploader |
| `NewsletterSubscriber` | email-popup signups (admin-spec #6 / #14) |
| `CartEvent` | `created` / `item-added` / `abandoned` / `recovered` (filled from Phase 4) |
| `AuditLog` | every admin mutation: actor, action, before/after JSON, IP, user-agent |
| `Review` | customer reviews on PDP (admin-spec #10): `userId`, `productId`, rating 1–5, title, body, status (`PENDING / APPROVED / REJECTED`), `createdAt`. Table exists in Foundation; submission UI + moderation are a later phase. |
| `ReviewImage` | optional photo attachments per review, FK to `MediaAsset` |

### 7.5 Attribution columns (analytics requirement)

For the admin dashboard's "campaign X drove £Y revenue" view we need UTM data persisted at order time:

- `User.firstTouchUtm{Source,Medium,Campaign,Term,Content}`, `User.firstTouchReferrer`, `User.firstSessionAt` — first-touch capture (more durable for long-term ROI than last-touch).
- `Order.utm{Source,Medium,Campaign,Term,Content}`, `Order.referrer`, `Order.landingPath` — last-touch snapshot frozen at checkout.

Fill logic lives in Phase 4 (read from cookies populated by frontend Phase 2 enhancement).

### 7.6 Out of schema (out of Foundation)

- `EmailCampaign` rows (admin-spec #14) — Klaviyo/Mailchimp will own this; we don't dual-write.
- Multi-currency rate tables / `ExchangeRate` history (admin-spec #15) — `Order.currency` column exists for future-proofing but Foundation locks every row to `GBP`. A future "multi-currency" phase will add `ExchangeRate` and conversion logic without retro-fitting historic orders.

---

## 8. Schema design decisions

### 8.1 IDs

`cuid2` (`@default(cuid())` in Prisma) for every primary key. URL-safe, ~24 chars, monotonic. No autoincrement integers (publicly leaks order volume).

### 8.2 Order numbers

`Order.id` is cuid; `Order.orderNumber` is a separate display-friendly string of form `YN-YYYY-NNNNN`, generated via Postgres sequence + format string. Unique constraint at DB level.

### 8.3 Money

`Int` minor units (pence) — `89500` = £895.00. Never `Decimal` or `Float`. Conversion to `£X.XX` happens only at the UI layer.

`Order.currency` and `Product.currency` are stored as ISO-4217 strings (`'GBP'` everywhere in Foundation) so a multi-currency phase can layer on without retro-fitting historic data. Money columns are always paired with their currency — no orphan amounts.

### 8.4 Soft delete

Soft delete (`deletedAt: DateTime?`) on `Product`, `Category`, `MediaAsset`, `User`, `PromoCode`. Everything else is hard delete. Reasoning: historical orders must render even if the linked product was removed; soft delete + `productSnapshot` columns on `OrderItem` give two layers of protection.

### 8.5 Snapshot columns on OrderItem

```prisma
model OrderItem {
  id              String   @id @default(cuid())
  orderId         String
  productId       String?  // nullable; SetNull on product delete
  // SNAPSHOT — frozen at purchase time
  productSlug     String
  productName     String
  productImage    String
  colour          String
  size            Size
  unitPriceCents  Int
  quantity        Int
  isPreorder      Boolean
  // ...
}
```

A 5-year-old order line still renders correctly even if the product, colour, or size SKU was deleted.

### 8.6 Stock model

Table `ProductSize` keyed `(productId, size)` with a single `stock` integer column. Reservations during checkout: row-level `SELECT ... FOR UPDATE` on Stripe webhook confirm (Phase 4). No separate reservation table — overkill for our volume.

Pre-order: `Product.preOrder: Boolean`. When true, stock is ignored at checkout (negative inventory permitted). Auto-flipping `preOrder` to true when all sizes hit zero is admin business logic (Phase 6).

Pre-order batch tracking (admin-spec #19) lives in `PreorderBatch` (see §7.3) with `OrderItem.preorderBatchId` linking each pre-ordered line to its cohort. Admin can list active batches, set `estimatedShipFrom/estimatedShipTo`, and trigger "ready to ship" notifications when the batch completes — all wired up in Phase 6.

### 8.7 Categories

Optional `parentId` self-reference (adjacency list). Default flat usage; allows future `Outerwear → Coats / Jackets` without migration.

### 8.8 CMS modeling

Per-type tables (`HeroBlock`, `AnnouncementMessage`, `LookbookImage`, `StaticPage`). A generic `ContentBlock` would lose Zod type safety and complicate admin forms.

### 8.9 Hero — "one active at a time"

```prisma
model HeroBlock {
  id           String    @id @default(cuid())
  isActive     Boolean   @default(false)
  scheduledFor DateTime?
  // ...
}
```

Prisma's `@@unique` does not support partial-index `WHERE` clauses, so the "exactly one active" constraint is enforced via a raw-SQL migration:

```sql
CREATE UNIQUE INDEX hero_block_one_active
  ON "HeroBlock" ("isActive")
  WHERE "isActive" = true;
```

The migration is committed alongside the Prisma migration that creates the table. Drafts coexist as `isActive=false` rows; Phase 6 admin UI atomically flips the active row inside a `$transaction`.

### 8.10 Static pages — markdown

`StaticPage.bodyMarkdown: String` rendered through the existing markdown component. Phase 6 admin UI uses TipTap with markdown serialisation (WYSIWYG for the editor, markdown in the database).

### 8.11 Shipping rules — table-driven

`ShippingZone` (countries: `String[]`) + `ShippingMethod` (zoneId, carrier, name, baseRateCents, freeShipThresholdCents, estimatedDays). Editable through a normal admin UI — never raw JSON.

### 8.12 Audit log — single table

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  actorId     String
  actor       User     @relation(...)
  action      String   // e.g. "product.create", "order.refund"
  entityType  String
  entityId    String
  before      Json?
  after       Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([actorId, createdAt])
  @@index([entityType, entityId])
}
```

Foundation creates the table; admin middleware (Phase 6) populates it.

### 8.13 MediaAsset (R2)

```prisma
model MediaAsset {
  id           String   @id @default(cuid())
  key          String   @unique  // R2 object key
  url          String                // public CDN URL
  kind         AssetKind             // IMAGE | VIDEO
  mimeType     String
  sizeBytes    Int
  width        Int?
  height       Int?
  durationMs   Int?
  uploadedById String
  uploadedBy   User     @relation(...)
  createdAt    DateTime @default(now())
  deletedAt    DateTime?
}
```

Foundation table only; Phase 6 implements upload + R2 sync. Phase "Deploy & Ops" runs an orphan-asset cleanup cron.

### 8.14 Cart — guest + user

```prisma
model Cart {
  id           String   @id @default(cuid())
  userId       String?  // populated when user is logged in
  sessionToken String?  @unique  // populated for guests via cookie
  expiresAt    DateTime  // 30-day TTL; cleaned by cron
  // ...
}
```

Phase 4 implements merge-on-login.

### 8.15 Timestamps

`createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`) on every table. Status changes captured separately via `OrderStatusEvent` history rows.

---

## 9. Migrations & seeding

### Migrations

- `pnpm prisma migrate dev --name <topic>` for development.
- `pnpm prisma migrate deploy` for production (will be run automatically as the `app` container's pre-start command in Phase "Deploy & Ops").
- Migrations are committed to git and reviewed.
- All migrations are **additive**. Renames go through `add new column → backfill → drop old column` in separate migrations once production data exists.
- Naming convention: imperative verb + noun, e.g. `add_product_table`, `backfill_order_utm_fields`, `drop_legacy_stock_json`.

### Seed (`web/prisma/seed.ts`)

1. **Idempotent** — runnable repeatedly without error (uses `upsert` keyed by `slug` / `email`).
2. Reads existing `web/src/lib/data/_mock/*.json` files.
3. Populates:
   - 3–5 categories with the slugs currently used in `Product.categorySlugs`.
   - 8 products from `_mock/products.json` (1:1).
   - `ProductImage` rows from `images[]`.
   - `ProductSize` rows from the `stock` map.
   - `ColourOption` rows from `colourOptions[]`.
   - 1 active `HeroBlock` from `_mock/content.json.hero`.
   - 3–5 `AnnouncementMessage` rows from `_mock/content.json.announcement.messages`.
   - 6 `LookbookImage` rows from `_mock/lookbook.json`.
   - 6 `StaticPage` rows from `_mock/content.json.staticPages` (Our Story, Shipping, Privacy, Terms, Returns, FAQ).
   - 2–3 `ShippingZone` + `ShippingMethod` rows (UK / EU / Worldwide × Royal Mail / DHL).
   - 1 `User` with `role: OWNER` (email/password from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` env).
   - 1 demo customer `User` with one saved `Address` from `_mock/addresses.json`.
   - 1 demo `Order` linked to the demo customer to validate order-history rendering in later phases.
4. **Does NOT** seed `Cart`, `CartItem`, `AuditLog`, `MediaAsset`, `PromoCode`, `CartEvent` — these are runtime-only data.

Run: `pnpm db:seed` (which proxies to `prisma db seed`).

---

## 10. Testing strategy

### Stack

- **Vitest 4** (already in repo).
- **Real Postgres** for server-layer tests — no Prisma mocking. Tests validate actual SQL semantics, foreign-key cascades, and partial-unique constraints.

### Layout

```
web/src/server/__tests__/
├── repositories/
│   ├── product.repo.test.ts
│   ├── category.repo.test.ts
│   ├── cms.repo.test.ts
│   └── ...
└── db/
    ├── client.test.ts        ← health-check, transaction helper
    └── env.test.ts           ← ENV Zod validation
```

### Test database lifecycle

1. Separate database `ynot_test` on the same Postgres container.
2. `vitest.setup.ts` runs `prisma migrate deploy` against `ynot_test` once at startup.
3. Each `describe` block runs a `TRUNCATE ... CASCADE` over all tables before its tests (faster than `migrate reset`).
4. Server tests run **single-fork serial** (`vitest --pool=forks --poolOptions.forks.singleFork=true` for the `server/__tests__/**` glob) to avoid cross-test contention on the shared test database. Frontend tests remain parallel.

### Quality gates

Foundation merges to `main` only when all four are green:

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint, including the no-restricted-imports rule
pnpm test        # vitest run
pnpm build       # next build (verifies Prisma client generation + SSR)
```

Foundation includes at least 5 server tests as smoke coverage:

1. `db.client.test.ts` — Prisma client connects, executes simple query.
2. `env.test.ts` — Zod validation rejects bad envs, accepts good ones.
3. `product.repo.test.ts` — `findBySlug` happy path, missing-slug returns null, soft-deleted excluded.
4. `category.repo.test.ts` — `list()` returns seeded categories sorted by `sortOrder`.
5. `health.route.test.ts` — `/api/health` returns `{ db: "ok", redis: "ok" }`.

### CI

Out of scope. Phase "Deploy & Ops" adds a GitHub Actions workflow that brings up a Postgres service container, runs `pnpm db:migrate:test`, and executes the gate suite.

---

## 11. ENV / secrets

### File layout

```
web/
├── .env                    ← optional local override (gitignored)
├── .env.development        ← committed dev defaults, NO secrets
├── .env.test               ← committed test defaults
├── .env.production         ← committed prod defaults, NO secrets
├── .env.local              ← gitignored secrets (developer-specific)
└── .env.example            ← committed template with every key + comment
```

### Foundation-phase variables

| Key | Required in | Example | Source |
|---|---|---|---|
| `DATABASE_URL` | dev / test / prod | `postgresql://ynot:secret@localhost:5432/ynot_dev` | `.env.local` (dev), Docker secret (prod) |
| `REDIS_URL` | dev / test / prod | `redis://localhost:6379` | same |
| `NODE_ENV` | always | `development` / `test` / `production` | runtime |
| `NEXT_PUBLIC_SITE_URL` | always | `http://localhost:3000` / `https://ynot.london` | committed defaults |
| `SEED_OWNER_EMAIL` | dev only | `owner@ynot.london` | `.env.local` |
| `SEED_OWNER_PASSWORD` | dev only | `dev-only-not-for-prod` | `.env.local` |

Phase 3+ will introduce `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `RESEND_API_KEY`, `ROYAL_MAIL_*`, `DHL_*` — none of these belong in Foundation.

### Validation: `web/src/server/env.ts`

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
});

export const env = EnvSchema.parse(process.env);
```

A missing or malformed env variable fails at module-load time, before any request is served. `.env.example` mirrors every key with a placeholder + comment so onboarding contributors copy-and-fill.

### Secrets handling

`.gitignore` already excludes `.env*.local`. The spec mandates: secrets **never** committed; `.env.example` always complete; production secrets injected via Docker Compose `env_file` from a non-versioned location on the VPS (`/etc/ynot/secrets.env`) — wired up in Phase "Deploy & Ops".

---

## 12. Health check

`web/src/app/api/health/route.ts` is the only API route Foundation ships:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { redis } from '@/server/redis';

export async function GET() {
  const [db, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);
  return NextResponse.json({
    db: db.status === 'fulfilled' ? 'ok' : 'fail',
    redis: cache.status === 'fulfilled' ? 'ok' : 'fail',
  }, {
    status: db.status === 'fulfilled' && cache.status === 'fulfilled' ? 200 : 503,
  });
}
```

Used as:
- Manual smoke-test after `docker compose up`.
- nginx upstream health probe (Phase "Deploy & Ops").
- Future monitoring (`/api/health` polled by Better Stack or similar).

---

## 13. Success criteria

Foundation is complete when **all 12** are demonstrably true on `main`:

1. `docker compose --profile dev up postgres redis` brings up Postgres 16 and Redis 7 locally.
2. `pnpm prisma migrate dev` applies migrations cleanly.
3. `pnpm db:seed` runs idempotently — three consecutive runs leave the database in the same state without errors.
4. `pnpm prisma studio` shows 8 products, 4 categories, 1 active hero, 6 lookbook images, 6 static pages, 2–3 shipping zones, 1 owner user, 1 customer user, 1 demo order. (Empty tables are OK for `Review`, `PreorderBatch`, `MediaAsset`, `AuditLog`, etc. — they exist but Foundation does not seed runtime data into them.)
5. `web/src/server/db/client.ts` exports a singleton `PrismaClient` (with the standard dev hot-reload guard).
6. `web/src/server/env.ts` validates `process.env` through Zod, failing fast on bad config.
7. `GET /api/health` returns `{ db: "ok", redis: "ok" }` when both services are up; `503` with the failing component identified when one is down.
8. The eslint `no-restricted-imports` rule blocks any `lib/**` file from importing `server/**`.
9. `pnpm test` is green with at minimum 5 server tests covering: db client, env validation, product repo (3 cases), category repo (1 case), health route.
10. `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
11. The existing storefront is **unchanged** — `pnpm dev` renders the homepage, catalog, PDP, cart, checkout, account, static pages, and 404 exactly as on the previous commit (still reading from `_mock/*.json`).
12. `web/docker-compose.yml` exposes two profiles: `dev` (postgres + redis only, for local development) and `prod` (full stack skeleton — TLS + CI/CD added in Phase "Deploy & Ops").

---

## 14. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Prisma schema drifts from the existing Zod schemas, breaking Phase 2 read replacement | Medium | Phase 2 spec authors must reconcile | A spec subsection in Phase 2 mandates a side-by-side schema-diff review before any `getX()` swap. |
| Seed file diverges from `_mock/*.json` over time | Low | Dev environment differs from current frontend behaviour | Seed reads `_mock/*.json` directly via `import` — drift is impossible by construction. |
| Real-Postgres tests slow down the suite | Medium | Slower local TDD loop | Single-fork serial mode for `server/__tests__/**` only; frontend tests remain parallel. |
| Future contributor adds `import { prisma } from '@/server/...'` to a `'use client'` component | High at scale | Prisma client leaks into browser bundle | eslint `no-restricted-imports` rule fails build. |
| Migrations applied locally but not production at deploy time | Medium | Schema drift between dev and prod | Phase "Deploy & Ops" sets `prisma migrate deploy` as the `app` container's pre-start command, blocking startup until migrations succeed. |

---

## 15. Open questions for Phase 2

(Not blockers for Foundation; flagged so Phase 2 spec authors can resolve.)

1. Do we keep the existing `web/src/lib/data/*.ts` async façades and just swap their internals to Prisma calls, or do we move them into `server/repositories/` and have `app/` import from there directly? (Recommendation: move; the façade abstraction was a mock-era artefact.)
2. Where does the `revalidateTag` invalidation live when admin (Phase 6) edits content — in repositories or services?
3. How do we expose the `Order` mock (currently no `orders.ts` façade is consumed by user-facing pages) once real orders exist? Account-history page depends on it.

---

## 16. Out-of-band setup (manual, Foundation-time)

These steps are documented in `web/docs/superpowers/plans/<phase-1-foundation>.md` and require human action; they are not automated by code:

1. Install Docker Desktop locally (developer machine).
2. Copy `.env.example` to `.env.local`; fill in `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`.
3. Run `docker compose --profile dev up -d`.
4. Run `pnpm prisma migrate dev` (applies schema).
5. Run `pnpm db:seed` (populates from mocks).
6. Run `pnpm dev` (verify storefront still renders).
7. Open `http://localhost:3000/api/health` → expect `{ db: "ok", redis: "ok" }`.

GoDaddy VPS provisioning, Cloudflare DNS configuration, R2 bucket creation, and TLS certificates are all in the **Deploy & Ops** phase, not here.

---

**Status:** Spec authored. Pending self-review and user review before transition to writing-plans skill.
