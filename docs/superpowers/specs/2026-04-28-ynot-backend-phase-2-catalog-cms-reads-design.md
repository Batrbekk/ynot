# YNOT London — Backend Phase 2 — Catalog & CMS Read Replacement

**Date:** 2026-04-28
**Status:** Draft (pending user review)
**Scope:** Phase 2 of 6 in the YNOT backend roadmap. Read-only swap of the existing `src/lib/data/*.ts` mock-backed façades to Prisma-backed reads under `src/server/data/*.ts`. Frontend rendering is byte-identical after this phase; only import paths and façade internals change.

---

## 1. Context

Phase 1 (Foundation) merged 2026-04-28. The database, Prisma schema, repositories (product/category/cms), seed, and `/api/health` route are live on `main`. The storefront still reads from `src/lib/data/_mock/*.json` via 12 async façade functions in 6 files; those mocks are duplicated into Postgres at seed time, so the data is identical.

Phase 2 cuts the mock JSON out of the read path. Every façade is replaced with a Prisma-backed implementation that returns the same Zod-typed shape the storefront already consumes. After Phase 2 merges, `src/lib/data/*.ts` is gone and `_mock/*.json` is read only by `prisma/seed.ts`.

Subsequent phases (out of scope here):
- **Phase 3 — Auth & Customer:** NextAuth, sessions, profile. Replaces the auth stubs introduced in this phase.
- **Phase 4 — Cart, Checkout, Stripe:** server-side cart, payment intents, webhook.
- **Phase 5 — Orders & Fulfilment:** lifecycle, returns, Royal Mail/DHL, Resend.
- **Phase 6 — Admin Panel:** mutations, CMS editor, full CRUD.

---

## 2. Goals

1. Swap every `src/lib/data/*.ts` façade to read from Postgres via Prisma.
2. Keep the existing Zod types in `src/lib/schemas/*` as the public contract, so the storefront and its 51 client tests continue to work without modification.
3. Honour the Phase 1 ESLint boundary (`lib/**` cannot import `server/**`) by relocating the façades to `src/server/data/*` and updating the 15 consumer import statements.
4. Keep repositories in `src/server/repositories/*` thin (Prisma rows + relations only) and put all Prisma → Zod adaptation in a dedicated `src/server/data/adapters/*` layer.
5. Use the real database in tests — no mocked Prisma client.
6. Stay strictly read-only: no mutations, no `revalidateTag`, no admin code.

## 3. Non-goals

- ❌ NextAuth or any real session handling — `getOrdersForCurrentUser` and `getSavedAddresses` are stubbed to return data for the seeded demo customer with explicit `// PHASE 3:` comments.
- ❌ Mutations (create/update/delete products, categories, CMS, orders, etc.) — Phase 6.
- ❌ `revalidateTag` invalidation hooks — added when admin mutations land (Phase 6).
- ❌ Postgres full-text search — basic `ILIKE` covers the eight-product catalogue. FTS / Meilisearch is a future improvement, not part of Phase 2.
- ❌ Pagination — the eight-product catalogue does not need it; deferred until traffic warrants it.
- ❌ Redis caching of catalog reads — added in a later perf-focused pass, not Phase 2.
- ❌ Removal of `src/lib/data/_mock/*.json` files themselves — they remain because `prisma/seed.ts` reads them.

---

## 4. Architecture

### 4.1 Three-layer read path

```
              consumer (page/component)
                       │
                       ▼
            src/server/data/<entity>.ts            ← façade (Zod-typed return)
                       │
              ┌────────┴────────┐
              ▼                 ▼
    src/server/repositories/    src/server/data/adapters/
    <entity>.repo.ts            <entity>.ts
        │                       (pure Prisma → Zod)
        ▼
    Prisma → Postgres
```

- **Repositories** (`server/repositories/*`): thin Prisma queries. Return `Product & { images, sizes, colours, ... }` shapes — Prisma rows with relations included. No Zod, no business rules.
- **Adapters** (`server/data/adapters/*`): pure functions taking a repository's row shape and returning the corresponding Zod-validated client type (`Product`, `Category`, `Order`, …). No I/O.
- **Façades** (`server/data/*`): orchestrate `repository → adapter`. Same function signatures and return types as the deleted `lib/data/*.ts` files. This is what page components import.

### 4.2 ESLint boundary remains intact

The Phase 1 rule still blocks `lib/**` and `components/**` from importing `@/server/**`, `@prisma/client`, or `ioredis`. Phase 2 moves the façades into `server/`, so the rule keeps protecting the bundle while consumers pick up the new imports.

`Server Components` (Next.js App Router pages) are allowed to import from `@/server/*` — they execute on the server and never ship to the client bundle. All 15 current consumers are server components, so no extra changes are needed beyond updating the import path.

### 4.3 Folder shape

```
src/
├── lib/
│   ├── data/                     ← DELETED at end of phase
│   │   └── _mock/                ← stays (used only by prisma/seed.ts)
│   ├── schemas/                  ← UNCHANGED — Zod types remain the public contract
│   │   ├── (existing files)
│   │   └── saved-address.ts      ← NEW: relocates SavedAddress (was inside lib/data/addresses.ts)
│   └── stores/
│       └── addresses-store.ts    ← MODIFIED: import path for SavedAddress
│
└── server/
    ├── data/                     ← NEW
    │   ├── products.ts           ← getAllProducts, getProductBySlug, getProductsByCategory,
    │   │                            getNewArrivals, getRecommendations
    │   ├── categories.ts         ← getAllCategories, getCategoryBySlug
    │   ├── content.ts            ← getAnnouncementMessages, getHero, getLookbook, getStaticPage
    │   ├── orders.ts             ← getOrdersForCurrentUser, getOrderById
    │   ├── addresses.ts          ← getSavedAddresses
    │   ├── search.ts             ← searchProducts (Prisma WHERE ILIKE)
    │   ├── adapters/
    │   │   ├── product.ts        ← toProduct(prismaRow) → Product
    │   │   ├── category.ts       ← toCategory
    │   │   ├── order.ts          ← toOrder
    │   │   ├── content.ts        ← toHero / toLookbook / toStaticPage
    │   │   ├── address.ts        ← toSavedAddress
    │   │   └── __tests__/        ← unit tests, no DB
    │   │       ├── product.test.ts
    │   │       ├── category.test.ts
    │   │       ├── order.test.ts
    │   │       ├── content.test.ts
    │   │       └── address.test.ts
    │   └── __tests__/             ← façade integration tests, real Postgres
    │       ├── products.test.ts
    │       ├── categories.test.ts
    │       ├── content.test.ts
    │       ├── orders.test.ts
    │       ├── addresses.test.ts
    │       └── search.test.ts
    └── repositories/
        ├── product.repo.ts       ← MODIFIED: + listByCategory, listNewArrivals,
        │                            listRecommendations, search
        ├── category.repo.ts      ← unchanged
        ├── cms.repo.ts           ← unchanged
        ├── order.repo.ts         ← NEW: listForUser, findById
        └── address.repo.ts       ← NEW: listForUser
```

---

## 5. Type reconciliation

The Prisma schema and the existing Zod schemas use deliberately different shapes — Prisma optimises for storage normalisation; Zod optimises for the storefront's render-time API. Adapters bridge the two:

| Domain object | Prisma row shape (after `include`) | Zod façade shape | Adapter notes |
|---|---|---|---|
| `Product` | `priceCents`, `materials`, `care`, `sizing`, `images: ProductImage[]`, `sizes: ProductSize[]`, `colours: ColourOption[]`, `categories: ProductCategory[].include(category)`, `preOrder` | `price`, `details: { materials, care, sizing }`, `images: string[]`, `sizes: Size[]`, `stock: Record<Size, number>`, `colour?`, `colourOptions?[]`, `categorySlugs: string[]`, `preOrder` | `priceCents → price`; flatten details; map images to URL strings; `ProductSize[] → stock object`; `ColourOption[]` → `colourOptions` and pick first as `colour` for backwards-compat |
| `Category` | `metaTitle`, `metaDescription` | `meta: { title, description }` | nest meta fields |
| `HeroBlock` | `imageUrl`, `videoUrl?`, `kind: 'IMAGE'\|'VIDEO'` | `image: string`, `videoUrl: string\|null`, `kind: 'image'\|'video'` | rename `imageUrl→image`; lowercase `kind` |
| `LookbookImage` | `LookbookImage[]` | `Lookbook = { images: LookbookImage[] }` | wrap in `{ images }` |
| `StaticPage` | `metaTitle`, `metaDescription` | `meta: { title, description }` | nest meta fields |
| `Order` | flat `ship*` columns + `OrderItem[]` (with snapshot fields), `subtotalCents`, `shippingCents`, `totalCents`, `carrier: 'ROYAL_MAIL'\|'DHL'`, `estimatedDeliveryDate?`, `currency`, `trackingNumber?` | `shippingAddress: Address` (nested), `items: CartItem[]`, `subtotal`, `shipping`, `total`, `carrier: 'royal-mail'\|'dhl'`, `estimatedDeliveryDate: 'YYYY-MM-DD'`, `currency: 'GBP'`, `trackingNumber: string\|null` | construct nested address from `ship*` fields; lowercase + hyphenate carrier; format date as `YYYY-MM-DD` (Zod schema is a string, not a Date); map snapshot fields to CartItem |
| `SavedAddress` | `Address` Prisma row | `{ id, label, isDefault, address: Address }` | wrap address in envelope |

Each adapter is a pure function with no I/O. They live in `src/server/data/adapters/*` and have unit tests that pass fixture Prisma rows and assert on the resulting Zod shape.

---

## 6. Auth stub

Phase 3 owns NextAuth and real sessions. Phase 2 ships two functions that nominally need a "current user":

- `getOrdersForCurrentUser()` — currently returns all mock orders.
- `getSavedAddresses()` — currently returns all mock addresses.

**Stub:** both resolve the user via `prisma.user.findUnique({ where: { email: 'demo@ynot.london' } })`, the seeded demo customer. If no user is found (e.g. fresh install without seed), they return an empty array.

Both functions carry a comment:

```ts
// PHASE 3: replace with await getSessionUser() once NextAuth is wired up.
```

This makes the stub self-documenting and trivially greppable when Phase 3 lands.

---

## 7. Search

`searchProducts(query)` is currently an in-memory filter over `getAllProducts()`. We swap it to a Prisma query so it scales beyond the current eight products without rewriting later:

```ts
prisma.product.findMany({
  where: {
    deletedAt: null,
    OR: [
      { name:        { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { categories:  { some: { category: { slug: { contains: q.toLowerCase() } } } } },
    ],
  },
  include: { images: true, sizes: true, colours: true, categories: { include: { category: true } } },
  take: 20,
});
```

Behaviour matches the current in-memory filter (case-insensitive substring on name/description and exact substring on category slug). Empty/whitespace query returns `[]` immediately. A `take: 20` cap protects against unbounded result sets.

---

## 8. Testing

### 8.1 Adapter unit tests

Each adapter is tested with at least one fixture Prisma row and asserts the resulting Zod-typed object. No database is touched. These tests live in `src/server/data/adapters/__tests__/*.test.ts` and run in the `server` Vitest project (node environment) but have no DB dependency, so they are fast.

### 8.2 Façade integration tests

For each façade we seed a small fixture into the test database, call the façade, and assert the returned shape matches expectations. These tests live in `src/server/data/__tests__/*.test.ts`. The existing `resetDb()` helper from Phase 1 truncates between tests; the existing single-fork serial vitest config keeps the shared test DB safe.

### 8.3 Storefront regression check (manual)

After the migration, `pnpm dev` must render every page that previously consumed a façade with byte-identical content. The runbook checks:

- `/` (home) — hero, announcement bar, lookbook, new arrivals
- `/collection/jackets` — category + product grid
- `/products/<seeded-slug>` — PDP (gallery + sizes + colours + details)
- `/our-story`, `/shipping-returns`, `/sustainability`, `/product-care`, `/privacy`, `/terms` — static pages
- `/account/orders` — orders list (stubbed to demo customer)
- `/account/orders/<demo-order-id>` — order detail
- `/account/addresses` — addresses list (stubbed)
- `/initiate-return` — pulls order via `getOrderById`
- `/search?q=jacket` — search results
- Sitemap: `/sitemap.xml` — uses `getAllProducts` + `getAllCategories`

### 8.4 Quality gates

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint, including the lib→server boundary rule
pnpm test        # vitest run — both client (jsdom) and server (node) projects
pnpm build       # next build
```

All four must be green to merge.

---

## 9. Success criteria

Phase 2 is complete when **all 12** are demonstrably true on `main`:

1. `src/lib/data/*.ts` is empty (the directory is removed).
2. The 12 façade functions live in `src/server/data/*.ts` with the same names and signatures they had in `lib/data/*.ts`.
3. All 15 consumer imports across `src/app/*`, `src/components/*`, and `src/lib/stores/*` point to `@/server/data/*` (or, for the `SavedAddress` type, to `@/lib/schemas/saved-address`).
4. `SavedAddress` Zod type lives in `src/lib/schemas/saved-address.ts`; `lib/stores/addresses-store.ts` imports from there.
5. Each adapter has at least one unit test in `src/server/data/adapters/__tests__/`.
6. Each façade has at least one integration test in `src/server/data/__tests__/`.
7. `pnpm test` is green — server count grows by ≥ 11 tests (5 façades × 1 + 5 adapters × 1 + 1 search test); client count stays at 143.
8. `pnpm typecheck && pnpm lint && pnpm build` are all green.
9. The 11 storefront URLs listed in §8.3 render with byte-identical content to the pre-Phase-2 main commit (manually verified against a screenshot or a `curl --compressed` diff for static parts).
10. The Phase 1 ESLint rule still blocks `lib/** → server/**`; a deliberate violation file fails lint.
11. `src/lib/data/_mock/*.json` files are unchanged; `prisma/seed.ts` is the only consumer.
12. Stub comments (`// PHASE 3: replace with await getSessionUser()`) are present in `getOrdersForCurrentUser` and `getSavedAddresses`.

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Adapter outputs differ subtly from the Zod schemas (e.g. wrong field name, wrong nullability), causing client crash at render time | Storefront breaks in ways tests miss | Adapter unit tests must `.parse()` the result through the matching Zod schema, not just deep-equal it. Failed Zod parsing fails the test. |
| `Order.estimatedDeliveryDate` is a Prisma `DateTime?` but the Zod schema expects a `'YYYY-MM-DD'` string | Type-mismatch at the consumer | Adapter formats the date with `.toISOString().slice(0, 10)`; null stays null; covered by an explicit unit test. **Caveat:** `toISOString()` is always UTC. A UK evening order (e.g. 23:30 BST) may render with the next-UTC-day's date. Acceptable for the MVP because YNOT operates in UTC anyway; **Phase 5** must revisit this when transactional emails ("your order ships on …") get authored — switch to a TZ-aware formatter (`date-fns-tz` formatInTimeZone with `Europe/London`). |
| `getOrdersForCurrentUser` stub returns demo customer's orders to anyone in dev — could mask logic errors that surface only after Phase 3 | Phase 3 surprise bugs | Comment is `// PHASE 3:` not `// TODO:` so it is grep-friendly; Phase 3's own success criteria include "every PHASE 3: comment in the codebase has been resolved or removed." |
| ESLint catches a forgotten `@/lib/data/*` import after the deletion | Build fails late | Delete `lib/data/*.ts` files at the END of the phase, after every consumer is updated, in a single commit so a missed import shows up as a typecheck error in the same PR. |
| Prisma `findMany` order non-deterministic in tests | Flaky tests | Every list-style integration test asserts on a sorted projection (e.g. `cats.map(c => c.slug).sort()`) or seeds with explicit `sortOrder`. |
| The `searchProducts` Prisma query interprets the user input as a literal string but a malicious / accidental SQL fragment could be passed | Prisma's `contains` parameteriser handles SQL safely; no risk. | None — Prisma always parameterises. |

---

## 11. Open questions for Phase 3

(Not blockers for Phase 2; flagged for the Phase 3 spec author.)

1. When NextAuth lands, where does the `getSessionUser()` helper live — `src/server/auth/session.ts`, or part of `server/repositories/user.repo.ts`?
2. Should the stubbed-to-demo behaviour in dev be preserved as a "fallback when no session" mode, or strictly removed (and unauthenticated requests return 401)?
3. The `Product.colour` Zod field is the FIRST colour from the relation, used by old cart-store entries that predate `colourOptions`. Phase 4 (cart) should decide whether to drop `colour` entirely from the schema or keep both.

---

**Status:** Spec authored. Pending self-review and user review before transition to writing-plans.
