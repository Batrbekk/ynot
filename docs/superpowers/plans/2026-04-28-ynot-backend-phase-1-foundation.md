# YNOT Backend Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Postgres + Redis + Prisma in Docker for local dev and a server-only code namespace at `web/src/server/*`, with the complete domain schema migrated, the existing `_mock/*.json` data seeded into the database, a real-Postgres Vitest harness, and a `/api/health` route. The storefront continues to render from mocks; nothing in `web/src/lib/data/*.ts` is rewired in this phase.

**Architecture:** The phase is purely additive — every existing file outside `web/eslint.config.mjs`, `web/vitest.config.ts`, `web/package.json`, `.gitignore`, and `web/docker-compose.yml` stays untouched. New code lives under `web/src/server/*` and `web/prisma/*` and is invisible to the existing storefront. ESLint enforces the boundary so client code can never import the database client.

**Tech Stack:** Node.js 22, Next.js 16, TypeScript 5.9, Prisma 5, PostgreSQL 16, Redis 7, ioredis, bcryptjs, Zod 4, Vitest 4, Docker Compose v2.

---

## File Structure

**New files:**

```
web/
├── docker-compose.yml                            ← Postgres + Redis services, dev + prod profiles
├── .env.example                                  ← committed template, every key documented
├── .env.development                              ← dev defaults (no secrets)
├── .env.test                                     ← test defaults
├── .env.production                               ← prod defaults (no secrets)
├── prisma/
│   ├── schema.prisma                             ← single source of truth for DB
│   ├── migrations/
│   │   └── <ts>_init/
│   │       ├── migration.sql                     ← auto-generated
│   │       └── partial_unique_hero_active.sql    ← hand-crafted partial index
│   └── seed.ts                                   ← idempotent seeder reading _mock/*.json
├── src/server/
│   ├── env.ts                                    ← Zod-validated process.env
│   ├── db/
│   │   ├── client.ts                             ← PrismaClient singleton with HMR guard
│   │   ├── transaction.ts                        ← $transaction helper
│   │   └── README.md                             ← migration workflow
│   ├── redis.ts                                  ← ioredis singleton
│   ├── repositories/
│   │   ├── product.repo.ts
│   │   ├── category.repo.ts
│   │   ├── cms.repo.ts
│   │   └── index.ts
│   ├── index.ts                                  ← public exports
│   └── __tests__/
│       ├── env.test.ts
│       ├── db/
│       │   └── client.test.ts
│       ├── redis.test.ts
│       ├── repositories/
│       │   ├── product.repo.test.ts
│       │   └── category.repo.test.ts
│       └── helpers/
│           └── reset-db.ts                       ← TRUNCATE helper
├── src/app/api/health/route.ts                   ← /api/health GET handler
├── src/app/api/health/__tests__/
│   └── route.test.ts
└── vitest.server.setup.ts                        ← migrate deploy + per-test reset
```

**Modified files:**

- `web/package.json` — add deps and `db:*` / `test:*` scripts
- `web/eslint.config.mjs` — `no-restricted-imports` rule blocking `lib/**` → `server/**`
- `web/vitest.config.ts` — split into two projects (`client` jsdom, `server` node + single-fork)
- `web/.gitignore` — already excludes `.env*.local`; verify

---

## Task 1: Worktree + branch + dependency install

**Files:**
- Create: `.worktrees/backend-phase-1-foundation/` (git worktree)
- Modify: `package.json` (root of new worktree)

- [ ] **Step 1: Create the worktree**

Run from `/Users/batyrbekkuandyk/Desktop/ynot/web`:

```bash
git worktree add .worktrees/backend-phase-1-foundation -b feature/backend-phase-1-foundation main
cd .worktrees/backend-phase-1-foundation
```

Expected: `Preparing worktree (new branch 'feature/backend-phase-1-foundation')`. From now on, every step runs from `web/.worktrees/backend-phase-1-foundation/`.

- [ ] **Step 2: Install dependencies**

```bash
pnpm add prisma@^5.22 @prisma/client@^5.22 ioredis@^5.4 bcryptjs@^2.4
pnpm add -D @types/bcryptjs@^2.4 @types/node@^22 dotenv-cli@^7.4 tsx@^4.19
```

Expected: each package downloads, `pnpm-lock.yaml` updates.

- [ ] **Step 3: Verify install**

```bash
pnpm list prisma @prisma/client ioredis bcryptjs --depth=0
```

Expected: every package listed with the version from step 2.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(backend): install Prisma, ioredis, bcryptjs for Foundation phase"
```

---

## Task 2: Add db / test scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the `scripts` block**

Open `package.json`. Replace the entire `"scripts"` object with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:client": "vitest run --project client",
  "test:server": "vitest run --project server",
  "typecheck": "tsc --noEmit",
  "db:up": "docker compose --profile dev up -d postgres redis",
  "db:down": "docker compose --profile dev down",
  "db:logs": "docker compose --profile dev logs -f postgres redis",
  "db:migrate": "dotenv -e .env.development -- prisma migrate dev",
  "db:migrate:test": "dotenv -e .env.test -- prisma migrate deploy",
  "db:migrate:deploy": "dotenv -e .env.production -- prisma migrate deploy",
  "db:seed": "dotenv -e .env.development -- prisma db seed",
  "db:studio": "dotenv -e .env.development -- prisma studio",
  "db:reset": "dotenv -e .env.development -- prisma migrate reset --force"
}
```

- [ ] **Step 2: Add the `prisma.seed` directive**

In the same `package.json`, add this top-level key (after the `"scripts"` block):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck 2>&1 | head -5
```

Expected: typecheck output (will currently show no errors related to our additions; existing storefront types are fine).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(backend): add db/test scripts and Prisma seed config"
```

---

## Task 3: Create `.env.example`, `.env.development`, `.env.test`, `.env.production`

**Files:**
- Create: `.env.example`, `.env.development`, `.env.test`, `.env.production`
- Modify: `.gitignore` (verify only)

- [ ] **Step 1: Verify .gitignore already excludes .env*.local**

```bash
grep -E '^\.env' .gitignore
```

Expected: line `.env*` (matches `.env.local`, `.env.production.local`, etc.).

- [ ] **Step 2: Adjust .gitignore so committed defaults are tracked**

The current `.env*` rule is too broad — it would block `.env.development` from being committed. Replace the rule:

In `.gitignore`, find the line `.env*` and replace with:

```gitignore
# Local secrets — never commit
.env
.env.local
.env.*.local
```

- [ ] **Step 3: Write `.env.example`**

```bash
cat > .env.example <<'EOF'
# YNOT London — environment template.
# Copy to .env.local and fill secret values.
# Committed defaults live in .env.development / .env.test / .env.production.

# ---- Database ----
DATABASE_URL="postgresql://ynot:ynot_dev_password@localhost:5432/ynot_dev?schema=public"

# ---- Redis ----
REDIS_URL="redis://localhost:6379"

# ---- Runtime ----
NODE_ENV="development"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# ---- Seed (dev only) ----
SEED_OWNER_EMAIL="owner@ynot.london"
SEED_OWNER_PASSWORD="change-me-in-local"
EOF
```

- [ ] **Step 4: Write `.env.development`**

```bash
cat > .env.development <<'EOF'
DATABASE_URL="postgresql://ynot:ynot_dev_password@localhost:5432/ynot_dev?schema=public"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SEED_OWNER_EMAIL="owner@ynot.london"
SEED_OWNER_PASSWORD="dev-only-change-me"
EOF
```

- [ ] **Step 5: Write `.env.test`**

```bash
cat > .env.test <<'EOF'
DATABASE_URL="postgresql://ynot:ynot_dev_password@localhost:5432/ynot_test?schema=public"
REDIS_URL="redis://localhost:6379/1"
NODE_ENV="test"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
EOF
```

- [ ] **Step 6: Write `.env.production`**

```bash
cat > .env.production <<'EOF'
# Production defaults. Real DATABASE_URL / REDIS_URL come from /etc/ynot/secrets.env via Docker env_file.
NODE_ENV="production"
NEXT_PUBLIC_SITE_URL="https://ynot.london"
EOF
```

- [ ] **Step 7: Commit**

```bash
git add .env.example .env.development .env.test .env.production .gitignore
git commit -m "chore(backend): add committed env defaults and tighten .gitignore"
```

---

## Task 4: Implement `web/src/server/env.ts` (TDD)

**Files:**
- Create: `src/server/env.ts`
- Test: `src/server/__tests__/env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";

describe("parseEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  };

  it("accepts a complete dev environment", () => {
    const env = parseEnv(baseEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/db");
  });

  it("rejects an invalid DATABASE_URL", () => {
    expect(() => parseEnv({ ...baseEnv, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: "staging" })).toThrow();
  });

  it("permits optional seed credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      SEED_OWNER_EMAIL: "owner@ynot.london",
      SEED_OWNER_PASSWORD: "longenough",
    });
    expect(env.SEED_OWNER_EMAIL).toBe("owner@ynot.london");
  });

  it("rejects a too-short SEED_OWNER_PASSWORD", () => {
    expect(() =>
      parseEnv({ ...baseEnv, SEED_OWNER_EMAIL: "x@y.com", SEED_OWNER_PASSWORD: "short" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run src/server/__tests__/env.test.ts
```

Expected: FAIL with `Failed to load url ../env` (file doesn't exist yet).

- [ ] **Step 3: Implement `src/server/env.ts`**

```ts
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parse an arbitrary record (used by tests) — throws on invalid input. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  return EnvSchema.parse(input);
}

/**
 * Validated process.env. Importing this module fails fast on bad config.
 * Server-only — never import from `lib/` or any client component.
 */
export const env: Env = parseEnv(process.env);
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm vitest run src/server/__tests__/env.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/env.ts src/server/__tests__/env.test.ts
git commit -m "feat(backend): Zod-validated env loader (server/env.ts)"
```

---

## Task 5: Author `docker-compose.yml` (dev profile)

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
# YNOT London — local + production container stack.
# Profiles:
#   dev   — postgres + redis only (the Next.js app runs on the host with `pnpm dev`)
#   prod  — full stack (nginx + app + postgres + redis) — nginx and app stubs added in Phase "Deploy & Ops"

name: ynot

services:
  postgres:
    image: postgres:16-alpine
    profiles: ["dev", "prod"]
    container_name: ynot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ynot
      POSTGRES_PASSWORD: ynot_dev_password
      POSTGRES_DB: ynot_dev
    ports:
      - "5432:5432"
    volumes:
      - ynot_postgres_data:/var/lib/postgresql/data
      - ./prisma/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ynot -d ynot_dev"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    profiles: ["dev", "prod"]
    container_name: ynot-redis
    restart: unless-stopped
    command:
      - redis-server
      - --maxmemory
      - 256mb
      - --maxmemory-policy
      - allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - ynot_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  ynot_postgres_data:
  ynot_redis_data:
```

- [ ] **Step 2: Create the postgres init script that creates the test database**

```bash
mkdir -p prisma/init
cat > prisma/init/01_create_test_db.sql <<'EOF'
-- Run once on first container boot. Creates the test database alongside ynot_dev.
SELECT 'CREATE DATABASE ynot_test OWNER ynot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ynot_test')\gexec
EOF
```

- [ ] **Step 3: Verify the stack boots**

```bash
docker compose --profile dev up -d
sleep 5
docker compose ps
```

Expected: `ynot-postgres` and `ynot-redis` listed as `Up (healthy)`.

- [ ] **Step 4: Verify the test database exists**

```bash
docker exec ynot-postgres psql -U ynot -d postgres -c '\l ynot_test'
```

Expected: a row showing `ynot_test | ynot | UTF8 | ...`.

- [ ] **Step 5: Verify Redis responds**

```bash
docker exec ynot-redis redis-cli ping
```

Expected: `PONG`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml prisma/init/01_create_test_db.sql
git commit -m "feat(backend): docker-compose with Postgres 16 + Redis 7 (dev profile)"
```

---

## Task 6: Author the complete `prisma/schema.prisma`

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

```prisma
// YNOT London — domain schema.
// Money columns are integers in minor units (pence). Currencies are ISO-4217 strings.
// Soft-deleted entities use a nullable `deletedAt`; queries must filter manually.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================================================================
// Enums
// =====================================================================

enum Size {
  XS
  S
  M
  L
  XL
}

enum Currency {
  GBP
}

enum UserRole {
  CUSTOMER
  EDITOR
  ADMIN
  OWNER
}

enum Carrier {
  ROYAL_MAIL
  DHL
}

enum OrderStatus {
  NEW
  PROCESSING
  SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  AUTHORISED
  CAPTURED
  REFUNDED
  FAILED
}

enum PromoDiscountType {
  FIXED
  PERCENT
}

enum PreorderBatchStatus {
  PENDING
  IN_PRODUCTION
  SHIPPING
  COMPLETED
}

enum AssetKind {
  IMAGE
  VIDEO
}

enum HeroKind {
  IMAGE
  VIDEO
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CartEventKind {
  CREATED
  ITEM_ADDED
  ITEM_REMOVED
  ABANDONED
  RECOVERED
  CHECKED_OUT
}

// =====================================================================
// Catalog
// =====================================================================

model Product {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  description  String
  priceCents   Int
  currency     Currency @default(GBP)
  preOrder     Boolean  @default(false)
  materials    String
  care         String
  sizing       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  images       ProductImage[]
  sizes        ProductSize[]
  colours      ColourOption[]
  categories   ProductCategory[]
  orderItems   OrderItem[]
  cartItems    CartItem[]
  reviews      Review[]
  preorderBatches PreorderBatch[]

  @@index([deletedAt])
  @@index([createdAt])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String  @default("")
  sortOrder Int     @default(0)

  @@index([productId, sortOrder])
}

model ProductSize {
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  size      Size
  stock     Int     @default(0)

  @@id([productId, size])
}

model ColourOption {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  name      String
  hex       String  // "#RRGGBB"
  sortOrder Int     @default(0)

  @@unique([productId, name])
}

model Category {
  id           String     @id @default(cuid())
  slug         String     @unique
  name         String
  description  String     @default("")
  bannerImage  String?
  sortOrder    Int        @default(0)
  metaTitle    String     @default("")
  metaDescription String  @default("")
  parentId     String?
  parent       Category?  @relation("Subcategories", fields: [parentId], references: [id], onDelete: SetNull)
  children     Category[] @relation("Subcategories")
  products     ProductCategory[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?

  @@index([parentId])
  @@index([deletedAt])
}

model ProductCategory {
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([productId, categoryId])
}

// =====================================================================
// CMS
// =====================================================================

model HeroBlock {
  id           String    @id @default(cuid())
  kind         HeroKind  @default(IMAGE)
  imageUrl     String
  videoUrl     String?
  eyebrow      String
  ctaLabel     String
  ctaHref      String
  isActive     Boolean   @default(false)
  scheduledFor DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  // partial unique index "only one active row" added via raw SQL migration
}

model AnnouncementMessage {
  id        String   @id @default(cuid())
  text      String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LookbookImage {
  id          String  @id @default(cuid())
  src         String
  alt         String  @default("")
  productSlug String?
  sortOrder   Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model StaticPage {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  bodyMarkdown    String
  metaTitle       String   @default("")
  metaDescription String   @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model SitePolicy {
  id                       String   @id @default("singleton")
  defaultCurrency          Currency @default(GBP)
  defaultCarrier           Carrier  @default(ROYAL_MAIL)
  freeShipThresholdCents   Int      @default(20000)
  contactEmail             String   @default("hello@ynot.london")
  whatsappNumber           String   @default("")
  updatedAt                DateTime @updatedAt
}

// =====================================================================
// Auth / customers
// =====================================================================

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String?
  name            String?
  role            UserRole @default(CUSTOMER)
  emailVerifiedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  // First-touch attribution
  firstTouchUtmSource   String?
  firstTouchUtmMedium   String?
  firstTouchUtmCampaign String?
  firstTouchUtmTerm     String?
  firstTouchUtmContent  String?
  firstTouchReferrer    String?
  firstSessionAt        DateTime?

  accounts        Account[]
  sessions        Session[]
  addresses       Address[]
  orders          Order[]
  carts           Cart[]
  reviews         Review[]
  uploadedAssets  MediaAsset[]
  auditEvents     AuditLog[]

  @@index([deletedAt])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider          String
  providerAccountId String
  accessToken       String?
  refreshToken      String?
  expiresAt         Int?
  tokenType         String?
  scope             String?
  idToken           String?

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionToken String   @unique
  expires      DateTime

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@id([identifier, token])
}

model Address {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  label     String  @default("Address")
  isDefault Boolean @default(false)
  firstName String
  lastName  String
  line1     String
  line2     String?
  city      String
  postcode  String
  country   String  // ISO-3166 alpha-2
  phone     String  @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

// =====================================================================
// Commerce
// =====================================================================

model Cart {
  id           String   @id @default(cuid())
  userId       String?
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  sessionToken String?  @unique
  promoCodeId  String?
  promoCode    PromoCode? @relation(fields: [promoCodeId], references: [id], onDelete: SetNull)
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  items  CartItem[]
  events CartEvent[]

  @@index([userId])
  @@index([expiresAt])
}

model CartItem {
  id         String  @id @default(cuid())
  cartId     String
  cart       Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId  String
  product    Product @relation(fields: [productId], references: [id])
  size       Size
  colour     String
  quantity   Int     @default(1)
  unitPriceCents Int
  currency   Currency @default(GBP)
  isPreorder Boolean @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([cartId])
}

model CartEvent {
  id        String        @id @default(cuid())
  cartId    String
  cart      Cart          @relation(fields: [cartId], references: [id], onDelete: Cascade)
  kind      CartEventKind
  metadata  Json?
  createdAt DateTime      @default(now())

  @@index([cartId, createdAt])
}

model Order {
  id                    String      @id @default(cuid())
  orderNumber           String      @unique
  userId                String?
  user                  User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  status                OrderStatus @default(NEW)
  subtotalCents         Int
  shippingCents         Int
  discountCents         Int         @default(0)
  totalCents            Int
  currency              Currency    @default(GBP)
  carrier               Carrier
  trackingNumber        String?
  estimatedDeliveryDate DateTime?
  // Shipping address is denormalised onto the order (snapshot at purchase).
  shipFirstName         String
  shipLastName          String
  shipLine1             String
  shipLine2             String?
  shipCity              String
  shipPostcode          String
  shipCountry           String
  shipPhone             String
  // Last-touch attribution
  utmSource             String?
  utmMedium             String?
  utmCampaign           String?
  utmTerm               String?
  utmContent            String?
  referrer              String?
  landingPath           String?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  items     OrderItem[]
  events    OrderStatusEvent[]
  payment   Payment?
  redemptions PromoRedemption[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
}

model OrderItem {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId       String?
  product         Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  preorderBatchId String?
  preorderBatch   PreorderBatch? @relation(fields: [preorderBatchId], references: [id], onDelete: SetNull)
  // Snapshot
  productSlug     String
  productName     String
  productImage    String
  colour          String
  size            Size
  unitPriceCents  Int
  currency        Currency @default(GBP)
  quantity        Int
  isPreorder      Boolean  @default(false)

  @@index([orderId])
  @@index([productId])
}

model OrderStatusEvent {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status    OrderStatus
  note      String?
  createdAt DateTime    @default(now())

  @@index([orderId, createdAt])
}

model Payment {
  id              String        @id @default(cuid())
  orderId         String        @unique
  order           Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  stripePaymentIntentId String?  @unique
  status          PaymentStatus @default(PENDING)
  amountCents     Int
  currency        Currency      @default(GBP)
  refundedAmountCents Int       @default(0)
  rawResponse     Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model PromoCode {
  id              String   @id @default(cuid())
  code            String   @unique
  discountType    PromoDiscountType
  discountValue   Int      // for FIXED: pence; for PERCENT: 1..100
  minOrderCents   Int      @default(0)
  usageLimit      Int?
  usageCount      Int      @default(0)
  expiresAt       DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  carts        Cart[]
  redemptions  PromoRedemption[]

  @@index([deletedAt])
}

model PromoRedemption {
  id           String   @id @default(cuid())
  promoCodeId  String
  promoCode    PromoCode @relation(fields: [promoCodeId], references: [id])
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  discountCents Int
  createdAt    DateTime @default(now())

  @@unique([promoCodeId, orderId])
  @@index([orderId])
}

model ShippingZone {
  id        String   @id @default(cuid())
  name      String
  countries String[] // ISO-3166 alpha-2 codes
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  methods ShippingMethod[]
}

model ShippingMethod {
  id                     String   @id @default(cuid())
  zoneId                 String
  zone                   ShippingZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  carrier                Carrier
  name                   String
  baseRateCents          Int
  freeShipThresholdCents Int?
  estimatedDaysMin       Int
  estimatedDaysMax       Int
  isActive               Boolean  @default(true)
  sortOrder              Int      @default(0)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([zoneId])
}

model PreorderBatch {
  id                 String              @id @default(cuid())
  name               String
  productId          String?
  product            Product?            @relation(fields: [productId], references: [id], onDelete: SetNull)
  estimatedShipFrom  DateTime
  estimatedShipTo    DateTime
  status             PreorderBatchStatus @default(PENDING)
  notes              String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  orderItems OrderItem[]

  @@index([productId])
  @@index([status])
}

// =====================================================================
// Admin / CMS / marketing
// =====================================================================

model MediaAsset {
  id           String    @id @default(cuid())
  key          String    @unique
  url          String
  kind         AssetKind
  mimeType     String
  sizeBytes    Int
  width        Int?
  height       Int?
  durationMs   Int?
  uploadedById String?
  uploadedBy   User?     @relation(fields: [uploadedById], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
  deletedAt    DateTime?

  reviewImages ReviewImage[]

  @@index([uploadedById])
  @@index([deletedAt])
}

model NewsletterSubscriber {
  id          String   @id @default(cuid())
  email       String   @unique
  source      String   @default("popup")
  isActive    Boolean  @default(true)
  subscribedAt DateTime @default(now())
  unsubscribedAt DateTime?
  metadata    Json?
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id])
  action     String
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([entityType, entityId])
}

model Review {
  id        String       @id @default(cuid())
  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId String
  product   Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  rating    Int
  title     String
  body      String
  status    ReviewStatus @default(PENDING)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  images ReviewImage[]

  @@index([productId, status])
  @@index([userId])
}

model ReviewImage {
  id        String     @id @default(cuid())
  reviewId  String
  review    Review     @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  assetId   String
  asset     MediaAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  sortOrder Int        @default(0)

  @@index([reviewId])
}
```

- [ ] **Step 2: Validate the schema**

```bash
pnpm prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 3: Format the schema in place**

```bash
pnpm prisma format
```

Expected: file is rewritten with consistent indentation; no errors.

- [ ] **Step 4: Generate the client**

```bash
pnpm prisma generate
```

Expected: `Generated Prisma Client (vX.Y.Z) to ./node_modules/@prisma/client in N ms`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(backend): complete Prisma domain schema (28 models)"
```

---

## Task 7: Initial migration + raw-SQL partial unique index

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql` (auto-generated)
- Create: `prisma/migrations/<timestamp>_hero_one_active_partial_index/migration.sql` (hand-crafted)

- [ ] **Step 1: Generate the initial migration**

```bash
pnpm db:migrate
```

When prompted for a migration name, enter `init`. Expected: directory `prisma/migrations/<ts>_init/` created with auto-generated `migration.sql`.

- [ ] **Step 2: Generate an empty migration for the partial unique index**

```bash
pnpm prisma migrate dev --create-only --name hero_one_active_partial_index
```

Expected: directory `prisma/migrations/<ts>_hero_one_active_partial_index/` created with empty `migration.sql`.

- [ ] **Step 3: Populate the partial-index migration**

Open the new migration file (`prisma/migrations/<latest>_hero_one_active_partial_index/migration.sql`) and replace its contents with:

```sql
-- HeroBlock.isActive partial unique — Prisma's @@unique cannot express WHERE clauses.
-- This index guarantees at most one row with isActive = true at a time.
CREATE UNIQUE INDEX "hero_block_one_active"
  ON "HeroBlock" ("isActive")
  WHERE "isActive" = true;
```

- [ ] **Step 4: Apply the new migration**

```bash
pnpm db:migrate
```

When prompted, accept (no rename needed). Expected: migration `hero_one_active_partial_index` applied.

- [ ] **Step 5: Verify the index exists**

```bash
docker exec ynot-postgres psql -U ynot -d ynot_dev -c "\d \"HeroBlock\"" | grep hero_block_one_active
```

Expected: a line referencing `"hero_block_one_active" UNIQUE, btree (\"isActive\") WHERE \"isActive\" = true`.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations
git commit -m "feat(backend): initial migration + Hero one-active partial unique index"
```

---

## Task 8: Prisma client singleton + transaction helper (TDD)

**Files:**
- Create: `src/server/db/client.ts`
- Create: `src/server/db/transaction.ts`
- Create: `src/server/db/README.md`
- Test: `src/server/__tests__/db/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/db/client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../../db/client";

describe("prisma singleton", () => {
  it("executes a trivial query", async () => {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });

  it("returns the same instance on repeated import", async () => {
    const { prisma: again } = await import("../../db/client");
    expect(again).toBe(prisma);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm vitest run src/server/__tests__/db/client.test.ts
```

Expected: FAIL — file not found.

- [ ] **Step 3: Write `src/server/db/client.ts`**

```ts
import { PrismaClient } from "@prisma/client";

declare global {
   
  var __prisma__: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient. Reuses an instance across hot reloads in dev to avoid
 * exhausting Postgres connections.
 */
export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
```

- [ ] **Step 4: Write `src/server/db/transaction.ts`**

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type Tx = Prisma.TransactionClient;

/**
 * Run `fn` inside a Prisma transaction. Rolls back on throw, commits otherwise.
 * Use this whenever a multi-row write must be atomic (e.g. order creation).
 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
```

- [ ] **Step 5: Write `src/server/db/README.md`**

```markdown
# Server DB layer

`client.ts` exports the singleton `PrismaClient`. Every server module that
talks to Postgres imports `prisma` from here — never construct a new client.

`transaction.ts` exports `withTransaction(fn)` for multi-row atomic writes.

## Migration workflow

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate` — Prisma diffs against the dev DB and creates a migration.
3. Name the migration with an imperative phrase (e.g. `add_review_table`,
   `backfill_order_utm`).
4. Commit `prisma/schema.prisma` AND every file under `prisma/migrations/`.
5. For partial indexes, generated columns, or anything Prisma cannot express,
   use `pnpm prisma migrate dev --create-only --name <topic>`, edit the empty
   `migration.sql` by hand, then run `pnpm db:migrate` to apply.

Production deploys run `pnpm db:migrate:deploy` (no schema diff, just applies
pending migrations) — wired up in Phase "Deploy & Ops".
```

- [ ] **Step 6: Run the test to confirm it passes**

The test needs `DATABASE_URL` in scope; the test runner must load the env file. We'll wire that up properly in Task 12 — for now, verify with explicit env:

```bash
dotenv -e .env.test -- pnpm vitest run src/server/__tests__/db/client.test.ts
```

Expected: PASS, 2 tests. (If you see "Database does not exist", run `pnpm db:migrate:test` first.)

- [ ] **Step 7: Commit**

```bash
git add src/server/db src/server/__tests__/db
git commit -m "feat(backend): Prisma client singleton + transaction helper"
```

---

## Task 9: Redis client singleton (TDD)

**Files:**
- Create: `src/server/redis.ts`
- Test: `src/server/__tests__/redis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/redis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redis } from "../redis";

describe("redis singleton", () => {
  it("responds to PING", async () => {
    const reply = await redis.ping();
    expect(reply).toBe("PONG");
  });

  it("can SET and GET a key", async () => {
    await redis.set("test:hello", "world", "EX", 10);
    const value = await redis.get("test:hello");
    expect(value).toBe("world");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
dotenv -e .env.test -- pnpm vitest run src/server/__tests__/redis.test.ts
```

Expected: FAIL — file not found.

- [ ] **Step 3: Implement `src/server/redis.ts`**

```ts
import Redis from "ioredis";

declare global {
   
  var __redis__: Redis | undefined;
}

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("REDIS_URL is not set — refusing to construct Redis client");
}

export const redis: Redis =
  globalThis.__redis__ ?? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis__ = redis;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
dotenv -e .env.test -- pnpm vitest run src/server/__tests__/redis.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/redis.ts src/server/__tests__/redis.test.ts
git commit -m "feat(backend): ioredis singleton with HMR guard"
```

---

## Task 10: Seed `prisma/seed.ts`

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
/**
 * Idempotent seeder. Reads existing _mock/*.json files and upserts rows into
 * Postgres so a fresh `pnpm db:seed` produces the exact dataset the storefront
 * currently renders from mocks.
 */
import { PrismaClient, Carrier, HeroKind, Size, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const ROOT = join(__dirname, "..", "src", "lib", "data", "_mock");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), "utf-8")) as T;
}

interface MockProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  description: string;
  images: string[];
  colour?: string;
  colourOptions?: { name: string; hex: string }[];
  sizes: Size[];
  categorySlugs: string[];
  stock: Partial<Record<Size, number>>;
  preOrder: boolean;
  details: { materials: string; care: string; sizing: string };
}

interface MockCategory {
  slug: string;
  name: string;
  description: string;
  bannerImage: string | null;
  sortOrder: number;
  meta: { title: string; description: string };
}

interface MockContent {
  announcement: { messages: string[] };
  hero: {
    kind: "image" | "video";
    image: string;
    videoUrl: string | null;
    eyebrow: string;
    ctaLabel: string;
    ctaHref: string;
  };
  staticPages: Array<{
    slug: string;
    title: string;
    bodyMarkdown: string;
    meta: { title: string; description: string };
  }>;
}

interface MockLookbook {
  images: Array<{ src: string; alt: string; productSlug: string | null }>;
}

interface MockSavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  address: {
    firstName: string;
    lastName: string;
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
    country: string;
    phone: string;
  };
}

async function seedCategories(): Promise<void> {
  const data = readJson<MockCategory[]>("categories.json");
  for (const c of data) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        bannerImage: c.bannerImage,
        sortOrder: c.sortOrder,
        metaTitle: c.meta.title,
        metaDescription: c.meta.description,
      },
      update: {
        name: c.name,
        description: c.description,
        bannerImage: c.bannerImage,
        sortOrder: c.sortOrder,
        metaTitle: c.meta.title,
        metaDescription: c.meta.description,
      },
    });
  }
}

async function seedProducts(): Promise<void> {
  const data = readJson<MockProduct[]>("products.json");
  for (const p of data) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.price,
        materials: p.details.materials,
        care: p.details.care,
        sizing: p.details.sizing,
        preOrder: p.preOrder,
      },
      update: {
        name: p.name,
        description: p.description,
        priceCents: p.price,
        materials: p.details.materials,
        care: p.details.care,
        sizing: p.details.sizing,
        preOrder: p.preOrder,
      },
    });

    // Replace images
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    for (const [i, url] of p.images.entries()) {
      await prisma.productImage.create({
        data: { productId: product.id, url, sortOrder: i, alt: p.name },
      });
    }

    // Replace sizes / stock
    await prisma.productSize.deleteMany({ where: { productId: product.id } });
    for (const size of p.sizes) {
      await prisma.productSize.create({
        data: {
          productId: product.id,
          size,
          stock: p.stock[size] ?? 0,
        },
      });
    }

    // Replace colours
    await prisma.colourOption.deleteMany({ where: { productId: product.id } });
    if (p.colourOptions?.length) {
      for (const [i, c] of p.colourOptions.entries()) {
        await prisma.colourOption.create({
          data: { productId: product.id, name: c.name, hex: c.hex, sortOrder: i },
        });
      }
    } else if (p.colour) {
      await prisma.colourOption.create({
        data: { productId: product.id, name: p.colour, hex: "#000000", sortOrder: 0 },
      });
    }

    // Replace category links
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    for (const slug of p.categorySlugs) {
      const cat = await prisma.category.findUnique({ where: { slug } });
      if (cat) {
        await prisma.productCategory.create({
          data: { productId: product.id, categoryId: cat.id },
        });
      }
    }
  }
}

async function seedCms(): Promise<void> {
  const content = readJson<MockContent>("content.json");
  const lookbook = readJson<MockLookbook>("lookbook.json");

  // Hero — single active row
  await prisma.heroBlock.deleteMany();
  await prisma.heroBlock.create({
    data: {
      kind: content.hero.kind === "video" ? HeroKind.VIDEO : HeroKind.IMAGE,
      imageUrl: content.hero.image,
      videoUrl: content.hero.videoUrl,
      eyebrow: content.hero.eyebrow,
      ctaLabel: content.hero.ctaLabel,
      ctaHref: content.hero.ctaHref,
      isActive: true,
    },
  });

  // Announcements
  await prisma.announcementMessage.deleteMany();
  for (const [i, text] of content.announcement.messages.entries()) {
    await prisma.announcementMessage.create({
      data: { text, sortOrder: i, isActive: true },
    });
  }

  // Lookbook
  await prisma.lookbookImage.deleteMany();
  for (const [i, img] of lookbook.images.entries()) {
    await prisma.lookbookImage.create({
      data: { src: img.src, alt: img.alt, productSlug: img.productSlug, sortOrder: i },
    });
  }

  // Static pages
  for (const page of content.staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        bodyMarkdown: page.bodyMarkdown,
        metaTitle: page.meta.title,
        metaDescription: page.meta.description,
      },
      update: {
        title: page.title,
        bodyMarkdown: page.bodyMarkdown,
        metaTitle: page.meta.title,
        metaDescription: page.meta.description,
      },
    });
  }

  // SitePolicy singleton
  await prisma.sitePolicy.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

async function seedShipping(): Promise<void> {
  const zones = [
    {
      name: "United Kingdom",
      countries: ["GB"],
      methods: [
        {
          carrier: Carrier.ROYAL_MAIL,
          name: "Royal Mail Tracked 48",
          baseRateCents: 595,
          freeShipThresholdCents: 20000,
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
        },
        {
          carrier: Carrier.DHL,
          name: "DHL Express UK",
          baseRateCents: 1295,
          freeShipThresholdCents: null,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
        },
      ],
    },
    {
      name: "European Union",
      countries: ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "IE", "PT", "DK", "SE", "FI"],
      methods: [
        {
          carrier: Carrier.DHL,
          name: "DHL Express EU",
          baseRateCents: 1995,
          freeShipThresholdCents: 30000,
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
        },
      ],
    },
    {
      name: "Worldwide",
      countries: ["US", "CA", "AU", "AE", "SG", "JP", "HK"],
      methods: [
        {
          carrier: Carrier.DHL,
          name: "DHL Express Worldwide",
          baseRateCents: 2995,
          freeShipThresholdCents: null,
          estimatedDaysMin: 3,
          estimatedDaysMax: 6,
        },
      ],
    },
  ];

  // Idempotent: reset zones (and their methods cascade) then recreate
  await prisma.shippingMethod.deleteMany();
  await prisma.shippingZone.deleteMany();

  for (const [i, z] of zones.entries()) {
    const zone = await prisma.shippingZone.create({
      data: { name: z.name, countries: z.countries, sortOrder: i },
    });
    for (const [j, m] of z.methods.entries()) {
      await prisma.shippingMethod.create({
        data: {
          zoneId: zone.id,
          carrier: m.carrier,
          name: m.name,
          baseRateCents: m.baseRateCents,
          freeShipThresholdCents: m.freeShipThresholdCents,
          estimatedDaysMin: m.estimatedDaysMin,
          estimatedDaysMax: m.estimatedDaysMax,
          sortOrder: j,
        },
      });
    }
  }
}

async function seedUsers(): Promise<void> {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set when running the seeder",
    );
  }

  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      passwordHash: ownerHash,
      name: "YNOT Owner",
      role: UserRole.OWNER,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash: ownerHash, role: UserRole.OWNER },
  });

  const customerEmail = "demo@ynot.london";
  const customerHash = await bcrypt.hash("demo-password-123", 10);
  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    create: {
      email: customerEmail,
      passwordHash: customerHash,
      name: "Demo Customer",
      role: UserRole.CUSTOMER,
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  // Demo address
  const addresses = readJson<MockSavedAddress[]>("addresses.json");
  if (addresses.length > 0) {
    const a = addresses[0];
    await prisma.address.deleteMany({ where: { userId: customer.id } });
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: a.label,
        isDefault: a.isDefault,
        firstName: a.address.firstName,
        lastName: a.address.lastName,
        line1: a.address.line1,
        line2: a.address.line2,
        city: a.address.city,
        postcode: a.address.postcode,
        country: a.address.country,
        phone: a.address.phone,
      },
    });
  }
}

async function seedDemoOrder(): Promise<void> {
  const customer = await prisma.user.findUnique({ where: { email: "demo@ynot.london" } });
  if (!customer) return;
  const product = await prisma.product.findFirst({ where: { deletedAt: null } });
  if (!product) return;

  const orderNumber = "YN-2026-DEMO1";
  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (existing) return;

  await prisma.order.create({
    data: {
      orderNumber,
      userId: customer.id,
      status: "DELIVERED",
      subtotalCents: product.priceCents,
      shippingCents: 595,
      totalCents: product.priceCents + 595,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM123456789GB",
      estimatedDeliveryDate: new Date(),
      shipFirstName: "Demo",
      shipLastName: "Customer",
      shipLine1: "1 Sample Street",
      shipCity: "London",
      shipPostcode: "E1 6AN",
      shipCountry: "GB",
      shipPhone: "+44 0000 000000",
      items: {
        create: {
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          productImage: "/products/placeholder.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: product.priceCents,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
}

async function main() {
  console.log("Seeding YNOT London…");
  await seedCategories();
  console.log("  categories ✓");
  await seedProducts();
  console.log("  products + images + sizes + colours ✓");
  await seedCms();
  console.log("  CMS (hero, announcements, lookbook, static pages, sitePolicy) ✓");
  await seedShipping();
  console.log("  shipping zones + methods ✓");
  await seedUsers();
  console.log("  owner + demo customer + saved address ✓");
  await seedDemoOrder();
  console.log("  demo order ✓");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Make sure `categories.json` mock exists; create if missing**

```bash
ls src/lib/data/_mock/categories.json
```

If the file does not exist, create it with the slugs the existing `Product.categorySlugs` references:

```bash
test -f src/lib/data/_mock/categories.json || cat > src/lib/data/_mock/categories.json <<'EOF'
[
  {
    "slug": "jackets",
    "name": "Jackets",
    "description": "Outerwear engineered for daily wear.",
    "bannerImage": null,
    "sortOrder": 0,
    "meta": { "title": "Jackets — YNOT London", "description": "Premium outerwear." }
  },
  {
    "slug": "dresses",
    "name": "Dresses",
    "description": "Refined silhouettes for any occasion.",
    "bannerImage": null,
    "sortOrder": 1,
    "meta": { "title": "Dresses — YNOT London", "description": "Premium dresses." }
  },
  {
    "slug": "knitwear",
    "name": "Knitwear",
    "description": "Honest fabrics, considered cuts.",
    "bannerImage": null,
    "sortOrder": 2,
    "meta": { "title": "Knitwear — YNOT London", "description": "Premium knitwear." }
  },
  {
    "slug": "accessories",
    "name": "Accessories",
    "description": "Closing details for the daily wardrobe.",
    "bannerImage": null,
    "sortOrder": 3,
    "meta": { "title": "Accessories — YNOT London", "description": "Premium accessories." }
  }
]
EOF
```

(If the file did exist, leave it alone.)

- [ ] **Step 3: Run the seed**

```bash
pnpm db:seed
```

Expected output:

```
Seeding YNOT London…
  categories ✓
  products + images + sizes + colours ✓
  CMS (hero, announcements, lookbook, static pages, sitePolicy) ✓
  shipping zones + methods ✓
  owner + demo customer + saved address ✓
  demo order ✓
```

- [ ] **Step 4: Verify idempotency — run the seed three times**

```bash
pnpm db:seed && pnpm db:seed && pnpm db:seed
```

Expected: each run succeeds with the same output, no duplicate-key errors.

- [ ] **Step 5: Spot-check via Prisma Studio**

```bash
pnpm db:studio &
sleep 3
echo "Open http://localhost:5555 — expect 8 products, 4 categories, 1 hero, 6 lookbook images, 6 static pages, 3 shipping zones with 4 methods total, 2 users, 1 address, 1 order."
```

After verifying, kill the Studio process: `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts src/lib/data/_mock/categories.json
git commit -m "feat(backend): idempotent seeder for catalog/CMS/shipping/users/demo order"
```

---

## Task 11: Vitest projects (split client / server)

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.server.setup.ts`
- Create: `src/server/__tests__/helpers/reset-db.ts`

- [ ] **Step 1: Replace `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/server/**", "src/app/api/**/*.test.ts"],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          globals: true,
          setupFiles: ["./vitest.server.setup.ts"],
          include: ["src/server/**/*.{test,spec}.ts", "src/app/api/**/*.test.ts"],
          pool: "forks",
          poolOptions: {
            forks: { singleFork: true },
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 2: Write `vitest.server.setup.ts`**

```ts
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll } from "vitest";

// Load .env.test before any test code (and before server modules import process.env).
config({ path: resolve(__dirname, ".env.test"), override: true });

beforeAll(() => {
  // Apply pending migrations to the test database. Idempotent.
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
});
```

- [ ] **Step 3: Write `src/server/__tests__/helpers/reset-db.ts`**

```ts
import { prisma } from "../../db/client";

/**
 * Truncate every table except Prisma's _prisma_migrations.
 * Cheaper than `prisma migrate reset` and faster than per-table deletes.
 *
 * Usage:
 *   beforeEach(() => resetDb());
 */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 4: Verify both projects run**

```bash
pnpm db:migrate:test  # apply migrations to ynot_test
pnpm test:client
pnpm test:server
```

Expected: client tests pass (existing storefront tests), server tests pass (env, db.client, redis from earlier tasks).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts vitest.server.setup.ts src/server/__tests__/helpers
git commit -m "test(backend): split client/server vitest projects + DB reset helper"
```

---

## Task 12: ProductRepository (TDD)

**Files:**
- Create: `src/server/repositories/product.repo.ts`
- Test: `src/server/__tests__/repositories/product.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { findProductBySlug, listProducts } from "../../repositories/product.repo";
import { resetDb } from "../helpers/reset-db";

describe("product.repo", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.product.create({
      data: {
        slug: "leather-jacket",
        name: "Leather Jacket",
        description: "Tailored.",
        priceCents: 89500,
        materials: "Lamb leather",
        care: "Wipe with damp cloth",
        sizing: "True to size",
      },
    });
    await prisma.product.create({
      data: {
        slug: "removed-coat",
        name: "Removed Coat",
        description: "Discontinued.",
        priceCents: 50000,
        materials: "Wool",
        care: "Dry clean",
        sizing: "True to size",
        deletedAt: new Date(),
      },
    });
  });

  it("findProductBySlug returns an active product", async () => {
    const p = await findProductBySlug("leather-jacket");
    expect(p?.name).toBe("Leather Jacket");
  });

  it("findProductBySlug returns null for an unknown slug", async () => {
    const p = await findProductBySlug("does-not-exist");
    expect(p).toBeNull();
  });

  it("findProductBySlug returns null for a soft-deleted product", async () => {
    const p = await findProductBySlug("removed-coat");
    expect(p).toBeNull();
  });

  it("listProducts excludes soft-deleted rows", async () => {
    const all = await listProducts();
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe("leather-jacket");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t product.repo
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/repositories/product.repo.ts`**

```ts
import type { Product } from "@prisma/client";
import { prisma } from "../db/client";

export type ProductWithRelations = Product & {
  images: { url: string; alt: string; sortOrder: number }[];
  sizes: { size: string; stock: number }[];
  colours: { name: string; hex: string; sortOrder: number }[];
};

const include = {
  images: { orderBy: { sortOrder: "asc" } },
  sizes: true,
  colours: { orderBy: { sortOrder: "asc" } },
} as const;

export async function findProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
    include,
  });
  return product as ProductWithRelations | null;
}

export async function listProducts(): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t product.repo
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/product.repo.ts src/server/__tests__/repositories/product.repo.test.ts
git commit -m "feat(backend): product repository (findBySlug, list) excludes soft-deleted"
```

---

## Task 13: CategoryRepository (TDD)

**Files:**
- Create: `src/server/repositories/category.repo.ts`
- Test: `src/server/__tests__/repositories/category.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { listCategories } from "../../repositories/category.repo";
import { resetDb } from "../helpers/reset-db";

describe("category.repo", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.category.createMany({
      data: [
        { slug: "knitwear", name: "Knitwear", sortOrder: 2 },
        { slug: "jackets", name: "Jackets", sortOrder: 0 },
        { slug: "dresses", name: "Dresses", sortOrder: 1 },
      ],
    });
  });

  it("listCategories returns rows ordered by sortOrder ascending", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toEqual(["jackets", "dresses", "knitwear"]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t category.repo
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/repositories/category.repo.ts`**

```ts
import type { Category } from "@prisma/client";
import { prisma } from "../db/client";

export async function listCategories(): Promise<Category[]> {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  return prisma.category.findFirst({ where: { slug, deletedAt: null } });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t category.repo
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/category.repo.ts src/server/__tests__/repositories/category.repo.test.ts
git commit -m "feat(backend): category repository (listCategories sorted by sortOrder)"
```

---

## Task 14: CMS repository (TDD)

**Files:**
- Create: `src/server/repositories/cms.repo.ts`
- Test: `src/server/__tests__/repositories/cms.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  getActiveHero,
  getAnnouncementMessages,
  getStaticPageBySlug,
} from "../../repositories/cms.repo";
import { resetDb } from "../helpers/reset-db";

describe("cms.repo", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.heroBlock.create({
      data: {
        kind: "IMAGE",
        imageUrl: "/cms/hero.jpg",
        eyebrow: "Welcome",
        ctaLabel: "Shop",
        ctaHref: "/collection/jackets",
        isActive: true,
      },
    });
    await prisma.announcementMessage.createMany({
      data: [
        { text: "Free UK delivery", sortOrder: 0 },
        { text: "Worldwide shipping", sortOrder: 1 },
      ],
    });
    await prisma.staticPage.create({
      data: { slug: "our-story", title: "Our Story", bodyMarkdown: "# Our Story" },
    });
  });

  it("getActiveHero returns the row with isActive=true", async () => {
    const hero = await getActiveHero();
    expect(hero?.eyebrow).toBe("Welcome");
  });

  it("getAnnouncementMessages returns active rows in sortOrder", async () => {
    const msgs = await getAnnouncementMessages();
    expect(msgs.map((m) => m.text)).toEqual(["Free UK delivery", "Worldwide shipping"]);
  });

  it("getStaticPageBySlug returns the matching page", async () => {
    const page = await getStaticPageBySlug("our-story");
    expect(page?.title).toBe("Our Story");
  });

  it("getStaticPageBySlug returns null for unknown slugs", async () => {
    expect(await getStaticPageBySlug("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t cms.repo
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/repositories/cms.repo.ts`**

```ts
import type { AnnouncementMessage, HeroBlock, LookbookImage, StaticPage } from "@prisma/client";
import { prisma } from "../db/client";

export function getActiveHero(): Promise<HeroBlock | null> {
  return prisma.heroBlock.findFirst({ where: { isActive: true } });
}

export function getAnnouncementMessages(): Promise<AnnouncementMessage[]> {
  return prisma.announcementMessage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listLookbook(): Promise<LookbookImage[]> {
  return prisma.lookbookImage.findMany({ orderBy: { sortOrder: "asc" } });
}

export function getStaticPageBySlug(slug: string): Promise<StaticPage | null> {
  return prisma.staticPage.findUnique({ where: { slug } });
}
```

- [ ] **Step 4: Add a barrel export**

Create `src/server/repositories/index.ts`:

```ts
export * from "./product.repo";
export * from "./category.repo";
export * from "./cms.repo";
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm test:server -t cms.repo
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories
git commit -m "feat(backend): CMS repository (hero, announcements, lookbook, static page)"
```

---

## Task 15: `/api/health` route (TDD)

**Files:**
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns 200 with db=ok and redis=ok when both services are up", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ db: "ok", redis: "ok" });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "GET /api/health"
```

Expected: FAIL — `../route` not found.

- [ ] **Step 3: Implement `src/app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const [db, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);
  const status = db.status === "fulfilled" && cache.status === "fulfilled" ? 200 : 503;
  return NextResponse.json(
    {
      db: db.status === "fulfilled" ? "ok" : "fail",
      redis: cache.status === "fulfilled" ? "ok" : "fail",
    },
    { status },
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "GET /api/health"
```

Expected: PASS, 1 test.

- [ ] **Step 5: Smoke-test against the real dev server**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000/api/health | tee /tmp/health.json
echo
```

Expected output: `{"db":"ok","redis":"ok"}`. Then `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/health
git commit -m "feat(backend): /api/health route + integration test"
```

---

## Task 16: ESLint boundary rule (`lib/**` cannot import `server/**`)

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Replace `eslint.config.mjs`**

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".worktrees/**",
  ]),
  // Prevent client/lib code from importing server-only modules.
  // The Prisma client must never be bundled to the browser.
  {
    files: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/**", "**/src/server/**"],
              message:
                "Do not import server-only modules from client code. Move logic into a Server Component, Route Handler, or Server Action.",
            },
            {
              group: ["@prisma/client", "ioredis"],
              message:
                "Database/cache clients are server-only. Use src/server/repositories/* via a Server Component or Route Handler.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

- [ ] **Step 2: Verify the rule fires**

Create a temporary file that violates the rule:

```bash
cat > src/lib/_violation.ts <<'EOF'
import { prisma } from "@/server/db/client";
export const _ = prisma;
EOF
pnpm lint 2>&1 | grep -E "_violation\.ts|no-restricted-imports" | head -5
```

Expected: an error referencing the file and the `no-restricted-imports` rule.

- [ ] **Step 3: Delete the violation file**

```bash
rm src/lib/_violation.ts
```

- [ ] **Step 4: Verify lint is clean**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore(backend): block lib/components from importing server-only modules"
```

---

## Task 17: docker-compose `prod` profile skeleton

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Append `app` and `nginx` services to `docker-compose.yml`**

Open `docker-compose.yml` and add the following services *before* the `volumes:` block. The `app` and `nginx` services are skeleton-only — Phase "Deploy & Ops" will replace the placeholder image/build context with a real Dockerfile, env_file, and certbot mount.

```yaml
  app:
    image: node:22-alpine
    profiles: ["prod"]
    container_name: ynot-app
    restart: unless-stopped
    working_dir: /app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ynot:ynot_dev_password@postgres:5432/ynot_prod?schema=public
      REDIS_URL: redis://redis:6379
      NEXT_PUBLIC_SITE_URL: https://ynot.london
    command:
      - sh
      - -c
      - |
        echo "Phase 'Deploy & Ops' will replace this stub with a real build (Dockerfile + standalone Next.js output)."
        sleep infinity
    ports:
      - "3000:3000"

  nginx:
    image: nginx:1.27-alpine
    profiles: ["prod"]
    container_name: ynot-nginx
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    command:
      - sh
      - -c
      - |
        echo "Phase 'Deploy & Ops' will mount the real nginx.conf, certbot, and Let's Encrypt volumes."
        sleep infinity
```

- [ ] **Step 2: Validate the compose file**

```bash
docker compose --profile prod config > /dev/null && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(backend): skeleton prod profile (app + nginx stubs for Deploy phase)"
```

---

## Task 18: Final validation + PR

**Files:** none (verification only)

- [ ] **Step 1: Verify all four quality gates**

Run all checks from a clean shell (DB still up):

```bash
pnpm db:migrate          # apply any pending dev migrations
pnpm db:migrate:test     # apply to ynot_test
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 2: Verify the 12 success criteria from the spec**

Walk through each criterion from spec section 13 and tick it off:

```bash
# 1. docker compose --profile dev up brings up postgres+redis
docker compose ps | grep -E "ynot-(postgres|redis)" | grep healthy
# 2. prisma migrate dev works (already proven above)
# 3. db:seed idempotent
pnpm db:seed && pnpm db:seed
# 4. prisma studio shows expected counts
pnpm prisma studio &
echo "Verify counts in browser, then kill"
sleep 3 && kill %1 || true
# 5. server/db/client.ts exports singleton (covered by tests)
# 6. server/env.ts validates (covered by tests)
# 7. /api/health works
pnpm dev &
sleep 5
curl -sf http://localhost:3000/api/health || echo FAIL
kill %1 || true
# 8. ESLint rule blocks lib -> server (covered above)
# 9. >= 5 server tests pass (covered above)
# 10. typecheck/lint/build/test all green (covered above)
# 11. storefront unchanged
pnpm dev &
sleep 5
curl -sf http://localhost:3000 -o /dev/null && echo "homepage OK" || echo FAIL
curl -sf http://localhost:3000/our-story -o /dev/null && echo "our-story OK" || echo FAIL
kill %1 || true
# 12. compose has dev + prod profiles
grep 'profiles:' docker-compose.yml | sort -u
```

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feature/backend-phase-1-foundation
gh pr create --title "feat(backend): Phase 1 — Foundation (Postgres + Prisma + Redis + Docker)" --body "$(cat <<'EOF'
## Summary
- Postgres 16 + Redis 7 in Docker Compose (dev + prod profiles)
- Complete Prisma schema (28 models) covering catalog, CMS, auth, commerce, admin, marketing
- Idempotent seed populating from existing _mock/*.json so storefront keeps rendering identically
- Server-only namespace at src/server/* with ESLint-enforced boundary
- /api/health route + Vitest project split (client jsdom + server node single-fork)
- Repositories for product / category / CMS as smoke coverage

## Out of scope (future phases)
- Replacing storefront read paths with Prisma — Phase 2
- NextAuth wiring, mutations, Stripe, Royal Mail/DHL, Resend — Phases 3–5
- Admin UI — separate sub-project
- TLS, Cloudflare, R2, CI/CD, backups — Phase "Deploy & Ops"

## Test plan
- [ ] `pnpm db:up` brings up postgres + redis healthy
- [ ] `pnpm db:migrate` succeeds
- [ ] `pnpm db:seed` succeeds three times in a row (idempotency)
- [ ] `pnpm prisma studio` shows 8 products, 4 categories, 1 hero, 6 lookbook images, 6 static pages, 3 shipping zones, 4 shipping methods, 2 users, 1 address, 1 order
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- [ ] `pnpm dev` renders homepage, /collection/jackets, a PDP, /our-story unchanged
- [ ] `curl localhost:3000/api/health` returns `{"db":"ok","redis":"ok"}`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 4: Merge after review**

When approved:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git worktree remove .worktrees/backend-phase-1-foundation
git branch -d feature/backend-phase-1-foundation 2>/dev/null || true
```

---

## Self-review

- ✅ **Spec coverage** — every success-criterion (spec §13.1–12) maps to a task: docker (T5), migrate dev (T7), idempotent seed (T10), studio counts (T18), client.ts (T8), env.ts (T4), /api/health (T15), ESLint boundary (T16), 5+ server tests (T4/T8/T9/T12/T13/T14/T15 = 14 tests), quality gates (T18), storefront unchanged (T18), compose profiles (T5+T17). Schema decisions (spec §8.1–15): cuid2 IDs (T6), order numbers (T6, `Order.orderNumber`), money in pence + currency column (T6), soft-delete (T6 `deletedAt`), OrderItem snapshot (T6), stock model (T6 ProductSize composite), categories self-reference (T6), per-type CMS tables (T6), Hero partial unique via raw SQL (T7), markdown static pages (T6 `bodyMarkdown`), table-driven shipping (T6 ShippingZone+Method), audit log (T6), MediaAsset (T6), guest-or-user cart (T6), timestamps (T6 every model). Out-of-scope items (spec §3) all explicitly skipped. PreorderBatch (spec §7.3) and Review/ReviewImage (spec §7.4) included in T6 schema.
- ✅ **Placeholder scan** — no TBDs, no "implement later", every code block is complete and runnable.
- ✅ **Type consistency** — repository signatures (`findProductBySlug`, `listProducts`, `listCategories`, `getActiveHero`, `getAnnouncementMessages`, `getStaticPageBySlug`) used identically in their tests and barrel export. Schema field names (`priceCents`, `imageUrl`, `bodyMarkdown`, `deletedAt`, `orderNumber`) used identically across schema, seed, and repos. Enum values (`HeroKind.IMAGE`, `Carrier.ROYAL_MAIL`, `UserRole.OWNER`) match between schema and seed.

---

**Plan complete and saved to `web/docs/superpowers/plans/2026-04-28-ynot-backend-phase-1-foundation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
