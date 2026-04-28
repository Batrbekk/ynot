# YNOT Backend Phase 2 — Catalog & CMS Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every mock-backed façade in `src/lib/data/*.ts` with a Prisma-backed implementation under `src/server/data/*.ts`, keeping every existing Zod return type and consumer behaviour identical so the storefront renders byte-identically after the swap.

**Architecture:** Three layers — thin Prisma repositories return relation-loaded Postgres rows, pure adapter functions transform those rows into the existing Zod-typed façade shapes, and façade functions in `src/server/data/*` orchestrate `repository → adapter` while exposing the same names and signatures the storefront already imports.

**Tech Stack:** Node.js 22, Next.js 16 App Router, TypeScript 5.9, Prisma 5, PostgreSQL 16, Zod 4, Vitest 4.

---

## File Structure

**New files:**

```
web/src/
├── lib/
│   └── schemas/
│       └── saved-address.ts                              ← extracted Zod type
├── server/
│   ├── repositories/
│   │   ├── order.repo.ts                                 ← listForUser, findById
│   │   └── address.repo.ts                               ← listForUser
│   └── data/
│       ├── adapters/
│       │   ├── product.ts                                ← toProduct
│       │   ├── category.ts                               ← toCategory
│       │   ├── content.ts                                ← toHero, toLookbook, toStaticPage
│       │   ├── order.ts                                  ← toOrder, toOrderItem
│       │   ├── address.ts                                ← toSavedAddress
│       │   └── __tests__/
│       │       ├── product.test.ts
│       │       ├── category.test.ts
│       │       ├── content.test.ts
│       │       ├── order.test.ts
│       │       └── address.test.ts
│       ├── products.ts                                   ← getAllProducts, getProductBySlug,
│       │                                                    getProductsByCategory, getNewArrivals,
│       │                                                    getRecommendations
│       ├── categories.ts                                 ← getAllCategories, getCategoryBySlug
│       ├── content.ts                                    ← getAnnouncementMessages, getHero,
│       │                                                    getLookbook, getStaticPage
│       ├── orders.ts                                     ← getOrdersForCurrentUser, getOrderById
│       ├── addresses.ts                                  ← getSavedAddresses
│       ├── search.ts                                     ← searchProducts (Prisma WHERE ILIKE)
│       └── __tests__/
│           ├── products.test.ts
│           ├── categories.test.ts
│           ├── content.test.ts
│           ├── orders.test.ts
│           ├── addresses.test.ts
│           └── search.test.ts
```

**Modified files:**

- `src/server/repositories/product.repo.ts` — add `listByCategory`, `listNewArrivals`, `listRecommendations`, `search`
- `src/lib/stores/addresses-store.ts` — `SavedAddress` import path updated
- 15 consumer files in `src/app/*` and `src/components/*` — `@/lib/data/*` → `@/server/data/*` (and `SavedAddress` → `@/lib/schemas/saved-address`)

**Deleted files (final task):**

- `src/lib/data/products.ts`
- `src/lib/data/categories.ts`
- `src/lib/data/content.ts`
- `src/lib/data/orders.ts`
- `src/lib/data/addresses.ts`
- `src/lib/data/search.ts`
- `src/lib/data/__tests__/*` (any tests there)

`src/lib/data/_mock/*.json` is **NOT** deleted — it remains the seed source.

---

## Task 1: Worktree + branch setup

**Files:** none (workspace setup)

- [ ] **Step 1: Create the worktree**

Run from `/Users/batyrbekkuandyk/Desktop/ynot/web`:

```bash
git worktree add .worktrees/backend-phase-2-catalog-cms-reads -b feature/backend-phase-2-catalog-cms-reads main
cd .worktrees/backend-phase-2-catalog-cms-reads
```

Expected: `Preparing worktree (new branch 'feature/backend-phase-2-catalog-cms-reads')`. From now on every step runs from `web/.worktrees/backend-phase-2-catalog-cms-reads/`.

- [ ] **Step 2: Bring up Postgres + Redis**

```bash
docker compose --profile dev up -d
sleep 3
docker compose ps | grep healthy
```

Expected: two lines, `ynot-postgres` and `ynot-redis` both `(healthy)`. If Postgres is masked by a native instance, run `brew services stop postgresql@16` first.

- [ ] **Step 3: Apply migrations and seed**

```bash
pnpm db:migrate:test                 # ensures ynot_test schema is current
pnpm db:migrate                      # ensures ynot_dev schema is current
pnpm db:seed                         # populates ynot_dev from _mock/*.json
```

Expected: each command exits 0; the seed prints six checkmark lines.

---

## Task 2: Move `SavedAddress` Zod type out of the data layer

**Files:**
- Create: `src/lib/schemas/saved-address.ts`
- Modify: `src/lib/schemas/index.ts`
- Modify: `src/lib/stores/addresses-store.ts`

- [ ] **Step 1: Write the new schema file**

Create `src/lib/schemas/saved-address.ts`:

```ts
import { z } from "zod";
import { AddressSchema } from "./address";

export const SavedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean(),
  address: AddressSchema,
});

export type SavedAddress = z.infer<typeof SavedAddressSchema>;
```

- [ ] **Step 2: Re-export from the schemas barrel**

Read `src/lib/schemas/index.ts`, then add the new export. After the change the file should look exactly like:

```ts
export * from "./product";
export * from "./category";
export * from "./cart";
export * from "./order";
export * from "./address";
export * from "./content";
export * from "./saved-address";
```

- [ ] **Step 3: Update the addresses store to import from schemas**

Open `src/lib/stores/addresses-store.ts`. Find the line:

```ts
import type { SavedAddress } from "@/lib/data/addresses";
```

Replace with:

```ts
import type { SavedAddress } from "@/lib/schemas/saved-address";
```

- [ ] **Step 4: Verify nothing else imports SavedAddress from data**

```bash
grep -rn 'from "@/lib/data/addresses"' src/
```

Expected output (only TYPE imports remain — they're fine for now and will be updated in Task 13):

```
src/app/account/addresses/page.tsx:8:import type { SavedAddress } from "@/lib/data/addresses";
src/components/account/address-form-modal.tsx:10:import type { SavedAddress } from "@/lib/data/addresses";
src/components/account/address-card.tsx:4:import type { SavedAddress } from "@/lib/data/addresses";
```

These three remaining imports are updated in Task 13 alongside the runtime imports.

- [ ] **Step 5: Run typecheck and client tests**

```bash
pnpm typecheck
pnpm test:client
```

Expected: typecheck green; client tests still 143 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/saved-address.ts src/lib/schemas/index.ts src/lib/stores/addresses-store.ts
git commit -m "refactor(schemas): relocate SavedAddress type from lib/data to lib/schemas"
```

---

## Task 3: Extend `product.repo.ts` with Phase 2 query methods

**Files:**
- Modify: `src/server/repositories/product.repo.ts`
- Modify: `src/server/__tests__/repositories/product.repo.test.ts`

- [ ] **Step 1: Replace the test file in full**

Open `src/server/__tests__/repositories/product.repo.test.ts` and replace its entire contents:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  findProductBySlug,
  listProducts,
  listProductsByCategory,
  listNewArrivals,
  listRecommendations,
  searchProducts,
} from "../../repositories/product.repo";
import { resetDb } from "../helpers/reset-db";

async function seedTwoProducts() {
  const jackets = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  const dresses = await prisma.category.create({
    data: { slug: "dresses", name: "Dresses", sortOrder: 1 },
  });
  const jacket = await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      categories: { create: [{ categoryId: jackets.id }] },
    },
  });
  const dress = await prisma.product.create({
    data: {
      slug: "silk-dress",
      name: "Silk Dress",
      description: "Cut on the bias.",
      priceCents: 50000,
      materials: "Silk",
      care: "Dry clean",
      sizing: "Runs small",
      categories: { create: [{ categoryId: dresses.id }] },
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
  return { jacket, dress };
}

describe("product.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("findProductBySlug returns an active product", async () => {
    await seedTwoProducts();
    const p = await findProductBySlug("leather-jacket");
    expect(p?.name).toBe("Leather Jacket");
  });

  it("findProductBySlug returns null for an unknown slug", async () => {
    await seedTwoProducts();
    expect(await findProductBySlug("does-not-exist")).toBeNull();
  });

  it("findProductBySlug returns null for a soft-deleted product", async () => {
    await seedTwoProducts();
    expect(await findProductBySlug("removed-coat")).toBeNull();
  });

  it("listProducts excludes soft-deleted rows", async () => {
    await seedTwoProducts();
    const all = await listProducts();
    expect(all.map((p) => p.slug).sort()).toEqual(["leather-jacket", "silk-dress"]);
  });

  it("listProductsByCategory returns products with that category slug", async () => {
    await seedTwoProducts();
    const inJackets = await listProductsByCategory("jackets");
    expect(inJackets.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("listProductsByCategory returns empty array for unknown slug", async () => {
    await seedTwoProducts();
    expect(await listProductsByCategory("nope")).toEqual([]);
  });

  it("listNewArrivals respects the limit", async () => {
    await seedTwoProducts();
    const top = await listNewArrivals(1);
    expect(top).toHaveLength(1);
  });

  it("listRecommendations excludes the named slug", async () => {
    await seedTwoProducts();
    const recs = await listRecommendations("leather-jacket", 4);
    expect(recs.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts matches name case-insensitively", async () => {
    await seedTwoProducts();
    const results = await searchProducts("LEATHER");
    expect(results.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("searchProducts matches description", async () => {
    await seedTwoProducts();
    const results = await searchProducts("bias");
    expect(results.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts matches category slug", async () => {
    await seedTwoProducts();
    const results = await searchProducts("dresses");
    expect(results.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts returns empty array for empty query", async () => {
    await seedTwoProducts();
    expect(await searchProducts("   ")).toEqual([]);
  });

  it("searchProducts excludes soft-deleted", async () => {
    await seedTwoProducts();
    const results = await searchProducts("Removed");
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
pnpm test:server -t product.repo
```

Expected: FAIL with import errors for `listProductsByCategory`, `listNewArrivals`, `listRecommendations`, `searchProducts`.

- [ ] **Step 3: Replace `src/server/repositories/product.repo.ts` in full**

```ts
import type { Product } from "@prisma/client";
import { prisma } from "../db/client";

export type ProductWithRelations = Product & {
  images: { url: string; alt: string; sortOrder: number }[];
  sizes: { size: string; stock: number }[];
  colours: { name: string; hex: string; sortOrder: number }[];
  categories: { category: { slug: string } }[];
};

const include = {
  images: { orderBy: { sortOrder: "asc" } },
  sizes: true,
  colours: { orderBy: { sortOrder: "asc" } },
  categories: { include: { category: true } },
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

export async function listProductsByCategory(
  categorySlug: string,
): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      categories: { some: { category: { slug: categorySlug } } },
    },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}

export async function listNewArrivals(limit: number): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    include,
  });
  return products as ProductWithRelations[];
}

export async function listRecommendations(
  excludeSlug: string,
  limit: number,
): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, slug: { not: excludeSlug } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include,
  });
  return products as ProductWithRelations[];
}

export async function searchProducts(query: string): Promise<ProductWithRelations[]> {
  const q = query.trim();
  if (!q) return [];
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { categories: { some: { category: { slug: { contains: q.toLowerCase() } } } } },
      ],
    },
    include,
    take: 20,
  });
  return products as ProductWithRelations[];
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
pnpm test:server -t product.repo
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/product.repo.ts src/server/__tests__/repositories/product.repo.test.ts
git commit -m "feat(backend): extend product.repo with byCategory/newArrivals/recommendations/search"
```

---

## Task 4: New `order.repo.ts` and `address.repo.ts` (TDD)

**Files:**
- Create: `src/server/repositories/order.repo.ts`
- Create: `src/server/repositories/address.repo.ts`
- Create: `src/server/__tests__/repositories/order.repo.test.ts`
- Create: `src/server/__tests__/repositories/address.repo.test.ts`
- Modify: `src/server/repositories/index.ts`

- [ ] **Step 1: Write the order repo test**

Create `src/server/__tests__/repositories/order.repo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { findOrderById, listOrdersForUser } from "../../repositories/order.repo";
import { resetDb } from "../helpers/reset-db";

async function seedUserAndOrders() {
  const user = await prisma.user.create({
    data: { email: "demo@ynot.london", name: "Demo" },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: "YN-2026-0001",
      userId: user.id,
      status: "DELIVERED",
      subtotalCents: 89500,
      shippingCents: 0,
      totalCents: 89500,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM12345678GB",
      shipFirstName: "Jane",
      shipLastName: "Doe",
      shipLine1: "42 King's Road",
      shipCity: "London",
      shipPostcode: "SW3 4ND",
      shipCountry: "GB",
      shipPhone: "+44 0000 000000",
      items: {
        create: {
          productSlug: "leather-jacket",
          productName: "Leather Jacket",
          productImage: "/products/jacket.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: 89500,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
  return { user, order };
}

describe("order.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("listOrdersForUser returns the user's orders newest-first", async () => {
    const { user } = await seedUserAndOrders();
    const orders = await listOrdersForUser(user.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber).toBe("YN-2026-0001");
    expect(orders[0].items).toHaveLength(1);
  });

  it("listOrdersForUser returns empty array for an unknown user", async () => {
    expect(await listOrdersForUser("nonexistent-id")).toEqual([]);
  });

  it("findOrderById accepts the orderNumber", async () => {
    await seedUserAndOrders();
    const o = await findOrderById("YN-2026-0001");
    expect(o?.orderNumber).toBe("YN-2026-0001");
  });

  it("findOrderById returns null for an unknown orderNumber", async () => {
    await seedUserAndOrders();
    expect(await findOrderById("YN-9999-XXXX")).toBeNull();
  });
});
```

- [ ] **Step 2: Write the address repo test**

Create `src/server/__tests__/repositories/address.repo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { listAddressesForUser } from "../../repositories/address.repo";
import { resetDb } from "../helpers/reset-db";

describe("address.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("listAddressesForUser returns the user's addresses, default first", async () => {
    const user = await prisma.user.create({ data: { email: "u@x.com" } });
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          label: "Work",
          isDefault: false,
          firstName: "J",
          lastName: "D",
          line1: "1",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
        {
          userId: user.id,
          label: "Home",
          isDefault: true,
          firstName: "J",
          lastName: "D",
          line1: "2",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
      ],
    });
    const addrs = await listAddressesForUser(user.id);
    expect(addrs.map((a) => a.label)).toEqual(["Home", "Work"]);
  });

  it("returns empty array when the user has no addresses", async () => {
    const user = await prisma.user.create({ data: { email: "u@x.com" } });
    expect(await listAddressesForUser(user.id)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run both test files to confirm they fail**

```bash
pnpm test:server -t order.repo
pnpm test:server -t address.repo
```

Expected: both FAIL because the modules don't exist yet.

- [ ] **Step 4: Implement `src/server/repositories/order.repo.ts`**

```ts
import type { Order, OrderItem } from "@prisma/client";
import { prisma } from "../db/client";

export type OrderWithItems = Order & { items: OrderItem[] };

const include = { items: true } as const;

export async function listOrdersForUser(userId: string): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include,
  });
}

export async function findOrderById(orderNumber: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({
    where: { orderNumber },
    include,
  });
}
```

- [ ] **Step 5: Implement `src/server/repositories/address.repo.ts`**

```ts
import type { Address } from "@prisma/client";
import { prisma } from "../db/client";

export async function listAddressesForUser(userId: string): Promise<Address[]> {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}
```

- [ ] **Step 6: Update the repositories barrel**

Read `src/server/repositories/index.ts` and replace with:

```ts
export * from "./product.repo";
export * from "./category.repo";
export * from "./cms.repo";
export * from "./order.repo";
export * from "./address.repo";
```

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
pnpm test:server -t order.repo
pnpm test:server -t address.repo
```

Expected: 4 + 2 = 6 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories
git commit -m "feat(backend): add order.repo + address.repo (listForUser, findById)"
```

---

## Task 5: Adapters — `product`, `category`, `content` (TDD)

**Files:**
- Create: `src/server/data/adapters/product.ts`
- Create: `src/server/data/adapters/category.ts`
- Create: `src/server/data/adapters/content.ts`
- Create: `src/server/data/adapters/__tests__/product.test.ts`
- Create: `src/server/data/adapters/__tests__/category.test.ts`
- Create: `src/server/data/adapters/__tests__/content.test.ts`

- [ ] **Step 1: Write the product adapter test**

Create `src/server/data/adapters/__tests__/product.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ProductSchema } from "@/lib/schemas";
import { toProduct } from "../product";

const fixture = {
  id: "p1",
  slug: "leather-jacket",
  name: "Leather Jacket",
  description: "Tailored.",
  priceCents: 89500,
  currency: "GBP" as const,
  preOrder: false,
  materials: "Lamb leather",
  care: "Wipe with damp cloth",
  sizing: "True to size",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  images: [
    { url: "/p1/a.jpg", alt: "front", sortOrder: 0 },
    { url: "/p1/b.jpg", alt: "back", sortOrder: 1 },
  ],
  sizes: [
    { size: "S", stock: 3 },
    { size: "M", stock: 5 },
  ],
  colours: [
    { name: "Black", hex: "#000000", sortOrder: 0 },
    { name: "Tan", hex: "#C8A87C", sortOrder: 1 },
  ],
  categories: [
    { category: { slug: "jackets" } },
    { category: { slug: "outerwear" } },
  ],
};

describe("toProduct", () => {
  it("maps every required field and parses through the Zod schema", () => {
    const result = toProduct(fixture);
    expect(() => ProductSchema.parse(result)).not.toThrow();
  });

  it("renames priceCents to price", () => {
    expect(toProduct(fixture).price).toBe(89500);
  });

  it("nests details from flat columns", () => {
    expect(toProduct(fixture).details).toEqual({
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
    });
  });

  it("flattens images to URL strings", () => {
    expect(toProduct(fixture).images).toEqual(["/p1/a.jpg", "/p1/b.jpg"]);
  });

  it("converts sizes array to a stock map", () => {
    expect(toProduct(fixture).stock).toEqual({ S: 3, M: 5 });
  });

  it("exposes colour swatches and picks the first as default colour", () => {
    const r = toProduct(fixture);
    expect(r.colour).toBe("Black");
    expect(r.colourOptions).toEqual([
      { name: "Black", hex: "#000000" },
      { name: "Tan", hex: "#C8A87C" },
    ]);
  });

  it("omits colourOptions when no colours are present", () => {
    const r = toProduct({ ...fixture, colours: [] });
    expect(r.colourOptions).toBeUndefined();
    expect(r.colour).toBeUndefined();
  });

  it("flattens category junctions to slug strings", () => {
    expect(toProduct(fixture).categorySlugs).toEqual(["jackets", "outerwear"]);
  });
});
```

- [ ] **Step 2: Write the category adapter test**

Create `src/server/data/adapters/__tests__/category.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CategorySchema } from "@/lib/schemas";
import { toCategory } from "../category";

const fixture = {
  id: "c1",
  slug: "jackets",
  name: "Jackets",
  description: "Outerwear staples.",
  bannerImage: "/cms/jackets.jpg",
  sortOrder: 0,
  metaTitle: "Jackets · YNOT",
  metaDescription: "Premium jackets.",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("toCategory", () => {
  it("nests meta fields and parses through the Zod schema", () => {
    const result = toCategory(fixture);
    expect(result.meta).toEqual({
      title: "Jackets · YNOT",
      description: "Premium jackets.",
    });
    expect(() => CategorySchema.parse(result)).not.toThrow();
  });

  it("preserves nullable bannerImage", () => {
    expect(toCategory({ ...fixture, bannerImage: null }).bannerImage).toBeNull();
  });
});
```

- [ ] **Step 3: Write the content adapters test**

Create `src/server/data/adapters/__tests__/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  HeroBlockSchema,
  LookbookSchema,
  StaticPageSchema,
} from "@/lib/schemas";
import { toHero, toLookbook, toStaticPage } from "../content";

describe("toHero", () => {
  const baseRow = {
    id: "h1",
    kind: "IMAGE" as const,
    imageUrl: "/cms/hero.jpg",
    videoUrl: null as string | null,
    eyebrow: "Welcome",
    ctaLabel: "Shop",
    ctaHref: "/collection/jackets",
    isActive: true,
    scheduledFor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renames imageUrl to image and lowercases kind for an image hero", () => {
    const r = toHero(baseRow);
    expect(r.kind).toBe("image");
    expect(r.image).toBe("/cms/hero.jpg");
    expect(r.videoUrl).toBeNull();
    expect(() => HeroBlockSchema.parse(r)).not.toThrow();
  });

  it("lowercases kind for a video hero and preserves videoUrl", () => {
    const r = toHero({
      ...baseRow,
      kind: "VIDEO",
      videoUrl: "https://cdn.example.com/h.mp4",
    });
    expect(r.kind).toBe("video");
    expect(r.videoUrl).toBe("https://cdn.example.com/h.mp4");
    expect(() => HeroBlockSchema.parse(r)).not.toThrow();
  });
});

describe("toLookbook", () => {
  it("wraps an array of rows in { images } and sorts by sortOrder", () => {
    const rows = [
      {
        id: "l2",
        src: "/lb/2.jpg",
        alt: "two",
        productSlug: "silk-dress",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "l1",
        src: "/lb/1.jpg",
        alt: "one",
        productSlug: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const r = toLookbook(rows);
    expect(r.images.map((i) => i.src)).toEqual(["/lb/1.jpg", "/lb/2.jpg"]);
    expect(() => LookbookSchema.parse(r)).not.toThrow();
  });
});

describe("toStaticPage", () => {
  it("nests meta fields and parses through the Zod schema", () => {
    const r = toStaticPage({
      id: "s1",
      slug: "our-story",
      title: "Our Story",
      bodyMarkdown: "# Our Story",
      metaTitle: "Our Story · YNOT",
      metaDescription: "About us.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r.meta).toEqual({
      title: "Our Story · YNOT",
      description: "About us.",
    });
    expect(() => StaticPageSchema.parse(r)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
pnpm test:server -t "toProduct"
pnpm test:server -t "toCategory"
pnpm test:server -t "toHero"
```

Expected: FAIL — adapter modules don't exist yet.

- [ ] **Step 5: Implement `src/server/data/adapters/product.ts`**

```ts
import type { Product as ZodProduct, Size } from "@/lib/schemas";
import type { ProductWithRelations } from "@/server/repositories/product.repo";

export function toProduct(row: ProductWithRelations): ZodProduct {
  const colourOptions = row.colours.length
    ? row.colours.map((c) => ({ name: c.name, hex: c.hex }))
    : undefined;
  const stock = Object.fromEntries(
    row.sizes.map((s) => [s.size as Size, s.stock]),
  ) as Partial<Record<Size, number>>;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.priceCents,
    currency: "GBP",
    description: row.description,
    images: row.images.map((i) => i.url),
    colour: colourOptions?.[0]?.name,
    colourOptions,
    sizes: row.sizes.map((s) => s.size as Size),
    categorySlugs: row.categories.map((c) => c.category.slug),
    stock,
    preOrder: row.preOrder,
    details: {
      materials: row.materials,
      care: row.care,
      sizing: row.sizing,
    },
  };
}
```

- [ ] **Step 6: Implement `src/server/data/adapters/category.ts`**

```ts
import type { Category as ZodCategory } from "@/lib/schemas";
import type { Category as PrismaCategory } from "@prisma/client";

export function toCategory(row: PrismaCategory): ZodCategory {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerImage: row.bannerImage,
    sortOrder: row.sortOrder,
    meta: {
      title: row.metaTitle,
      description: row.metaDescription,
    },
  };
}
```

- [ ] **Step 7: Implement `src/server/data/adapters/content.ts`**

```ts
import type {
  HeroBlock as ZodHero,
  Lookbook as ZodLookbook,
  StaticPage as ZodStaticPage,
} from "@/lib/schemas";
import type {
  HeroBlock as PrismaHero,
  LookbookImage as PrismaLookbookImage,
  StaticPage as PrismaStaticPage,
} from "@prisma/client";

export function toHero(row: PrismaHero): ZodHero {
  return {
    kind: row.kind === "VIDEO" ? "video" : "image",
    image: row.imageUrl,
    videoUrl: row.videoUrl,
    eyebrow: row.eyebrow,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
  };
}

export function toLookbook(rows: PrismaLookbookImage[]): ZodLookbook {
  return {
    images: [...rows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({ src: r.src, alt: r.alt, productSlug: r.productSlug })),
  };
}

export function toStaticPage(row: PrismaStaticPage): ZodStaticPage {
  return {
    slug: row.slug,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    meta: {
      title: row.metaTitle,
      description: row.metaDescription,
    },
  };
}
```

- [ ] **Step 8: Run tests to confirm all three pass**

```bash
pnpm test:server -t "toProduct"
pnpm test:server -t "toCategory"
pnpm test:server -t "toHero"
pnpm test:server -t "toLookbook"
pnpm test:server -t "toStaticPage"
```

Expected: each PASSes.

- [ ] **Step 9: Commit**

```bash
git add src/server/data/adapters/product.ts src/server/data/adapters/category.ts src/server/data/adapters/content.ts src/server/data/adapters/__tests__
git commit -m "feat(backend): product/category/content adapters (Prisma row → Zod façade type)"
```

---

## Task 6: Adapters — `order` and `address` (TDD)

**Files:**
- Create: `src/server/data/adapters/order.ts`
- Create: `src/server/data/adapters/address.ts`
- Create: `src/server/data/adapters/__tests__/order.test.ts`
- Create: `src/server/data/adapters/__tests__/address.test.ts`

- [ ] **Step 1: Write the order adapter test**

Create `src/server/data/adapters/__tests__/order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OrderSchema } from "@/lib/schemas";
import { toOrder } from "../order";

const baseRow = {
  id: "internal-cuid",
  orderNumber: "YN-2026-0001",
  userId: "u1",
  status: "DELIVERED" as const,
  subtotalCents: 89500,
  shippingCents: 0,
  discountCents: 0,
  totalCents: 89500,
  currency: "GBP" as const,
  carrier: "ROYAL_MAIL" as const,
  trackingNumber: "RM12345678GB" as string | null,
  estimatedDeliveryDate: new Date("2026-04-01T00:00:00Z") as Date | null,
  shipFirstName: "Jane",
  shipLastName: "Doe",
  shipLine1: "42 King's Road",
  shipLine2: null as string | null,
  shipCity: "London",
  shipPostcode: "SW3 4ND",
  shipCountry: "GB",
  shipPhone: "+44 7700 900123",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  referrer: null,
  landingPath: null,
  createdAt: new Date("2026-03-28T11:23:00Z"),
  updatedAt: new Date("2026-03-28T11:23:00Z"),
  items: [
    {
      id: "i1",
      orderId: "internal-cuid",
      productId: "p1",
      preorderBatchId: null,
      productSlug: "leather-jacket",
      productName: "Leather Jacket",
      productImage: "/p/a.jpg",
      colour: "Black",
      size: "M" as const,
      unitPriceCents: 89500,
      currency: "GBP" as const,
      quantity: 1,
      isPreorder: false,
    },
  ],
};

describe("toOrder", () => {
  it("uses orderNumber as the public id and parses through the Zod schema", () => {
    const r = toOrder(baseRow);
    expect(r.id).toBe("YN-2026-0001");
    expect(() => OrderSchema.parse(r)).not.toThrow();
  });

  it("lowercases status and hyphenates carrier", () => {
    const r = toOrder(baseRow);
    expect(r.status).toBe("delivered");
    expect(r.carrier).toBe("royal-mail");
  });

  it("renames money fields and snapshots line items", () => {
    const r = toOrder(baseRow);
    expect(r.subtotal).toBe(89500);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(89500);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      productId: "p1",
      slug: "leather-jacket",
      name: "Leather Jacket",
      image: "/p/a.jpg",
      colour: "Black",
      size: "M",
      unitPrice: 89500,
      quantity: 1,
      preOrder: false,
    });
  });

  it("constructs the nested shippingAddress from flat ship* columns", () => {
    const r = toOrder(baseRow);
    expect(r.shippingAddress).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      line1: "42 King's Road",
      line2: null,
      city: "London",
      postcode: "SW3 4ND",
      country: "GB",
      phone: "+44 7700 900123",
    });
  });

  it("formats createdAt as ISO string", () => {
    expect(toOrder(baseRow).createdAt).toBe("2026-03-28T11:23:00.000Z");
  });

  it("formats estimatedDeliveryDate as YYYY-MM-DD", () => {
    expect(toOrder(baseRow).estimatedDeliveryDate).toBe("2026-04-01");
  });

  it("returns empty string when estimatedDeliveryDate is null", () => {
    const r = toOrder({ ...baseRow, estimatedDeliveryDate: null });
    expect(r.estimatedDeliveryDate).toBe("");
  });

  it("converts DHL carrier to dhl", () => {
    expect(toOrder({ ...baseRow, carrier: "DHL" }).carrier).toBe("dhl");
  });
});
```

- [ ] **Step 2: Write the address adapter test**

Create `src/server/data/adapters/__tests__/address.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SavedAddressSchema } from "@/lib/schemas/saved-address";
import { toSavedAddress } from "../address";

describe("toSavedAddress", () => {
  it("wraps a Prisma address row in the SavedAddress envelope and parses", () => {
    const r = toSavedAddress({
      id: "a1",
      userId: "u1",
      label: "Home",
      isDefault: true,
      firstName: "Jane",
      lastName: "Doe",
      line1: "42 King's Road",
      line2: null,
      city: "London",
      postcode: "SW3 4ND",
      country: "GB",
      phone: "+44 7700 900123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r).toEqual({
      id: "a1",
      label: "Home",
      isDefault: true,
      address: {
        firstName: "Jane",
        lastName: "Doe",
        line1: "42 King's Road",
        line2: null,
        city: "London",
        postcode: "SW3 4ND",
        country: "GB",
        phone: "+44 7700 900123",
      },
    });
    expect(() => SavedAddressSchema.parse(r)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm test:server -t "toOrder"
pnpm test:server -t "toSavedAddress"
```

Expected: FAIL — adapter modules don't exist yet.

- [ ] **Step 4: Implement `src/server/data/adapters/order.ts`**

```ts
import type { Order as ZodOrder, CartItem as ZodCartItem } from "@/lib/schemas";
import type { OrderWithItems } from "@/server/repositories/order.repo";
import type { OrderItem as PrismaOrderItem } from "@prisma/client";

function carrierToHyphenated(c: "ROYAL_MAIL" | "DHL"): "royal-mail" | "dhl" {
  return c === "ROYAL_MAIL" ? "royal-mail" : "dhl";
}

function toOrderItem(row: PrismaOrderItem): ZodCartItem {
  return {
    productId: row.productId ?? "",
    slug: row.productSlug,
    name: row.productName,
    image: row.productImage,
    colour: row.colour,
    size: row.size,
    unitPrice: row.unitPriceCents,
    quantity: row.quantity,
    preOrder: row.isPreorder,
  };
}

export function toOrder(row: OrderWithItems): ZodOrder {
  return {
    id: row.orderNumber,
    createdAt: row.createdAt.toISOString(),
    status: row.status.toLowerCase() as ZodOrder["status"],
    items: row.items.map(toOrderItem),
    subtotal: row.subtotalCents,
    shipping: row.shippingCents,
    total: row.totalCents,
    currency: "GBP",
    carrier: carrierToHyphenated(row.carrier),
    trackingNumber: row.trackingNumber,
    shippingAddress: {
      firstName: row.shipFirstName,
      lastName: row.shipLastName,
      line1: row.shipLine1,
      line2: row.shipLine2,
      city: row.shipCity,
      postcode: row.shipPostcode,
      country: row.shipCountry,
      phone: row.shipPhone,
    },
    estimatedDeliveryDate: row.estimatedDeliveryDate
      ? row.estimatedDeliveryDate.toISOString().slice(0, 10)
      : "",
  };
}
```

- [ ] **Step 5: Implement `src/server/data/adapters/address.ts`**

```ts
import type { SavedAddress } from "@/lib/schemas/saved-address";
import type { Address as PrismaAddress } from "@prisma/client";

export function toSavedAddress(row: PrismaAddress): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    isDefault: row.isDefault,
    address: {
      firstName: row.firstName,
      lastName: row.lastName,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      postcode: row.postcode,
      country: row.country,
      phone: row.phone,
    },
  };
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pnpm test:server -t "toOrder"
pnpm test:server -t "toSavedAddress"
```

Expected: 8 + 1 = 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/data/adapters/order.ts src/server/data/adapters/address.ts src/server/data/adapters/__tests__/order.test.ts src/server/data/adapters/__tests__/address.test.ts
git commit -m "feat(backend): order + address adapters (Prisma row → Zod façade type)"
```

---

## Task 7: Façade — `server/data/products.ts` (TDD)

**Files:**
- Create: `src/server/data/products.ts`
- Create: `src/server/data/__tests__/products.test.ts`

- [ ] **Step 1: Write the integration test**

Create `src/server/data/__tests__/products.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  getNewArrivals,
  getRecommendations,
} from "@/server/data/products";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

async function seedTwo() {
  const cat = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      sizes: { create: [{ size: "M", stock: 5 }] },
      colours: { create: [{ name: "Black", hex: "#000000", sortOrder: 0 }] },
      categories: { create: [{ categoryId: cat.id }] },
      images: { create: [{ url: "/p/a.jpg", sortOrder: 0 }] },
    },
  });
  await prisma.product.create({
    data: {
      slug: "silk-dress",
      name: "Silk Dress",
      description: "Cut on the bias.",
      priceCents: 50000,
      materials: "Silk",
      care: "Dry clean",
      sizing: "Runs small",
    },
  });
}

describe("server/data/products", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("getAllProducts returns adapted Product shapes", async () => {
    await seedTwo();
    const all = await getAllProducts();
    expect(all).toHaveLength(2);
    const jacket = all.find((p) => p.slug === "leather-jacket")!;
    expect(jacket.price).toBe(89500);
    expect(jacket.details.materials).toBe("Lamb leather");
    expect(jacket.images).toEqual(["/p/a.jpg"]);
    expect(jacket.colourOptions).toEqual([{ name: "Black", hex: "#000000" }]);
    expect(jacket.stock).toEqual({ M: 5 });
  });

  it("getProductBySlug returns null when missing", async () => {
    expect(await getProductBySlug("nope")).toBeNull();
  });

  it("getProductsByCategory filters by slug", async () => {
    await seedTwo();
    const result = await getProductsByCategory("jackets");
    expect(result.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("getNewArrivals respects the default limit of 4", async () => {
    await seedTwo();
    const result = await getNewArrivals();
    expect(result).toHaveLength(2);
  });

  it("getRecommendations excludes the named slug", async () => {
    await seedTwo();
    const result = await getRecommendations("leather-jacket");
    expect(result.map((p) => p.slug)).toEqual(["silk-dress"]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/products"
```

Expected: FAIL — `@/server/data/products` not found.

- [ ] **Step 3: Implement `src/server/data/products.ts`**

```ts
import type { Product } from "@/lib/schemas";
import {
  findProductBySlug,
  listProducts,
  listProductsByCategory,
  listNewArrivals,
  listRecommendations,
} from "@/server/repositories/product.repo";
import { toProduct } from "./adapters/product";

export async function getAllProducts(): Promise<Product[]> {
  const rows = await listProducts();
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const row = await findProductBySlug(slug);
  return row ? toProduct(row) : null;
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<Product[]> {
  const rows = await listProductsByCategory(categorySlug);
  return rows.map(toProduct);
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const rows = await listNewArrivals(limit);
  return rows.map(toProduct);
}

export async function getRecommendations(
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> {
  const rows = await listRecommendations(excludeSlug, limit);
  return rows.map(toProduct);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/products"
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/products.ts src/server/data/__tests__/products.test.ts
git commit -m "feat(backend): server/data/products façade (5 functions, Prisma-backed)"
```

---

## Task 8: Façade — `server/data/categories.ts` (TDD)

**Files:**
- Create: `src/server/data/categories.ts`
- Create: `src/server/data/__tests__/categories.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getAllCategories, getCategoryBySlug } from "@/server/data/categories";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/categories", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.category.createMany({
      data: [
        {
          slug: "knitwear",
          name: "Knitwear",
          sortOrder: 2,
          metaTitle: "Knitwear",
          metaDescription: "k",
        },
        {
          slug: "jackets",
          name: "Jackets",
          sortOrder: 0,
          metaTitle: "Jackets",
          metaDescription: "j",
        },
      ],
    });
  });

  it("getAllCategories returns rows in sortOrder ascending and nests meta", async () => {
    const cats = await getAllCategories();
    expect(cats.map((c) => c.slug)).toEqual(["jackets", "knitwear"]);
    expect(cats[0].meta).toEqual({ title: "Jackets", description: "j" });
  });

  it("getCategoryBySlug returns the matching row", async () => {
    expect((await getCategoryBySlug("jackets"))?.name).toBe("Jackets");
  });

  it("getCategoryBySlug returns null when missing", async () => {
    expect(await getCategoryBySlug("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/categories"
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/data/categories.ts`**

```ts
import type { Category } from "@/lib/schemas";
import {
  findCategoryBySlug,
  listCategories,
} from "@/server/repositories/category.repo";
import { toCategory } from "./adapters/category";

export async function getAllCategories(): Promise<Category[]> {
  const rows = await listCategories();
  return rows.map(toCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await findCategoryBySlug(slug);
  return row ? toCategory(row) : null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/categories"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/categories.ts src/server/data/__tests__/categories.test.ts
git commit -m "feat(backend): server/data/categories façade"
```

---

## Task 9: Façade — `server/data/content.ts` (TDD)

**Files:**
- Create: `src/server/data/content.ts`
- Create: `src/server/data/__tests__/content.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  getAnnouncementMessages,
  getHero,
  getLookbook,
  getStaticPage,
} from "@/server/data/content";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/content", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("getAnnouncementMessages returns active rows in sortOrder as strings", async () => {
    await prisma.announcementMessage.createMany({
      data: [
        { text: "Free UK delivery", sortOrder: 0, isActive: true },
        { text: "Worldwide shipping", sortOrder: 1, isActive: true },
        { text: "Hidden", sortOrder: 99, isActive: false },
      ],
    });
    expect(await getAnnouncementMessages()).toEqual([
      "Free UK delivery",
      "Worldwide shipping",
    ]);
  });

  it("getHero returns the active hero adapted to Zod shape", async () => {
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
    const h = await getHero();
    expect(h).toMatchObject({
      kind: "image",
      image: "/cms/hero.jpg",
      eyebrow: "Welcome",
    });
  });

  it("getHero throws when no active hero exists", async () => {
    await expect(getHero()).rejects.toThrow();
  });

  it("getLookbook wraps rows in { images } sorted by sortOrder", async () => {
    await prisma.lookbookImage.createMany({
      data: [
        { src: "/lb/2.jpg", alt: "two", sortOrder: 1 },
        { src: "/lb/1.jpg", alt: "one", sortOrder: 0 },
      ],
    });
    const lb = await getLookbook();
    expect(lb.images.map((i) => i.src)).toEqual(["/lb/1.jpg", "/lb/2.jpg"]);
  });

  it("getStaticPage returns the page nested with meta, or null", async () => {
    await prisma.staticPage.create({
      data: {
        slug: "our-story",
        title: "Our Story",
        bodyMarkdown: "# Our Story",
        metaTitle: "Our Story",
        metaDescription: "About us.",
      },
    });
    const p = await getStaticPage("our-story");
    expect(p?.title).toBe("Our Story");
    expect(p?.meta).toEqual({ title: "Our Story", description: "About us." });
    expect(await getStaticPage("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/content"
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/data/content.ts`**

```ts
import type { HeroBlock, Lookbook, StaticPage } from "@/lib/schemas";
import {
  getActiveHero,
  getAnnouncementMessages as getAnnouncementMessagesRepo,
  getStaticPageBySlug,
  listLookbook,
} from "@/server/repositories/cms.repo";
import { toHero, toLookbook, toStaticPage } from "./adapters/content";

export async function getAnnouncementMessages(): Promise<string[]> {
  const rows = await getAnnouncementMessagesRepo();
  return rows.map((r) => r.text);
}

export async function getHero(): Promise<HeroBlock> {
  const row = await getActiveHero();
  if (!row) throw new Error("No active hero block configured");
  return toHero(row);
}

export async function getLookbook(): Promise<Lookbook> {
  const rows = await listLookbook();
  return toLookbook(rows);
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const row = await getStaticPageBySlug(slug);
  return row ? toStaticPage(row) : null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/content"
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/content.ts src/server/data/__tests__/content.test.ts
git commit -m "feat(backend): server/data/content façade (announcements/hero/lookbook/static page)"
```

---

## Task 10: Façade — `server/data/orders.ts` with Phase 3 stub (TDD)

**Files:**
- Create: `src/server/data/orders.ts`
- Create: `src/server/data/__tests__/orders.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getOrderById, getOrdersForCurrentUser } from "@/server/data/orders";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

async function seedDemoCustomerOrder() {
  const user = await prisma.user.create({
    data: { email: "demo@ynot.london", name: "Demo" },
  });
  await prisma.order.create({
    data: {
      orderNumber: "YN-2026-0001",
      userId: user.id,
      status: "DELIVERED",
      subtotalCents: 89500,
      shippingCents: 0,
      totalCents: 89500,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM12345678GB",
      estimatedDeliveryDate: new Date("2026-04-01T00:00:00Z"),
      shipFirstName: "Jane",
      shipLastName: "Doe",
      shipLine1: "42 King's Road",
      shipCity: "London",
      shipPostcode: "SW3 4ND",
      shipCountry: "GB",
      shipPhone: "+44 7700 900123",
      items: {
        create: {
          productSlug: "leather-jacket",
          productName: "Leather Jacket",
          productImage: "/p/a.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: 89500,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
}

describe("server/data/orders", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("getOrdersForCurrentUser returns the demo customer's orders", async () => {
    await seedDemoCustomerOrder();
    const orders = await getOrdersForCurrentUser();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("YN-2026-0001");
    expect(orders[0].status).toBe("delivered");
    expect(orders[0].carrier).toBe("royal-mail");
    expect(orders[0].shippingAddress.city).toBe("London");
  });

  it("getOrdersForCurrentUser returns empty array when demo customer is missing", async () => {
    expect(await getOrdersForCurrentUser()).toEqual([]);
  });

  it("getOrderById accepts an orderNumber and returns the order", async () => {
    await seedDemoCustomerOrder();
    const o = await getOrderById("YN-2026-0001");
    expect(o?.id).toBe("YN-2026-0001");
    expect(o?.estimatedDeliveryDate).toBe("2026-04-01");
  });

  it("getOrderById returns null when not found", async () => {
    expect(await getOrderById("YN-9999-XXXX")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/orders"
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/data/orders.ts`**

```ts
import type { Order } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import {
  findOrderById,
  listOrdersForUser,
} from "@/server/repositories/order.repo";
import { toOrder } from "./adapters/order";

// PHASE 3: replace with await getSessionUser() once NextAuth is wired up.
const STUB_USER_EMAIL = "demo@ynot.london";

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const user = await prisma.user.findUnique({
    where: { email: STUB_USER_EMAIL },
  });
  if (!user) return [];
  const rows = await listOrdersForUser(user.id);
  return rows.map(toOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await findOrderById(id);
  return row ? toOrder(row) : null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/orders"
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/orders.ts src/server/data/__tests__/orders.test.ts
git commit -m "feat(backend): server/data/orders façade with PHASE 3 auth stub"
```

---

## Task 11: Façade — `server/data/addresses.ts` with Phase 3 stub (TDD)

**Files:**
- Create: `src/server/data/addresses.ts`
- Create: `src/server/data/__tests__/addresses.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getSavedAddresses } from "@/server/data/addresses";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/addresses", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns the demo customer's addresses, default first", async () => {
    const user = await prisma.user.create({
      data: { email: "demo@ynot.london", name: "Demo" },
    });
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          label: "Work",
          isDefault: false,
          firstName: "J",
          lastName: "D",
          line1: "1 Office",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
        {
          userId: user.id,
          label: "Home",
          isDefault: true,
          firstName: "J",
          lastName: "D",
          line1: "2 Home",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
      ],
    });
    const addrs = await getSavedAddresses();
    expect(addrs.map((a) => a.label)).toEqual(["Home", "Work"]);
    expect(addrs[0].address.line1).toBe("2 Home");
  });

  it("returns empty array when the demo customer is missing", async () => {
    expect(await getSavedAddresses()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/addresses"
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/data/addresses.ts`**

```ts
import type { SavedAddress } from "@/lib/schemas/saved-address";
import { prisma } from "@/server/db/client";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { toSavedAddress } from "./adapters/address";

// PHASE 3: replace with await getSessionUser() once NextAuth is wired up.
const STUB_USER_EMAIL = "demo@ynot.london";

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await prisma.user.findUnique({
    where: { email: STUB_USER_EMAIL },
  });
  if (!user) return [];
  const rows = await listAddressesForUser(user.id);
  return rows.map(toSavedAddress);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/addresses"
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/addresses.ts src/server/data/__tests__/addresses.test.ts
git commit -m "feat(backend): server/data/addresses façade with PHASE 3 auth stub"
```

---

## Task 12: Façade — `server/data/search.ts` (TDD)

**Files:**
- Create: `src/server/data/search.ts`
- Create: `src/server/data/__tests__/search.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { searchProducts } from "@/server/data/search";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

async function seed() {
  const cat = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      categories: { create: [{ categoryId: cat.id }] },
    },
  });
}

describe("server/data/search", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns matching products as adapted Product shapes", async () => {
    await seed();
    const results = await searchProducts("LEATHER");
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("leather-jacket");
    expect(results[0].price).toBe(89500);
  });

  it("returns empty array for empty/whitespace query", async () => {
    expect(await searchProducts("")).toEqual([]);
    expect(await searchProducts("   ")).toEqual([]);
  });

  it("returns empty array when nothing matches", async () => {
    await seed();
    expect(await searchProducts("xylophone")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "server/data/search"
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/server/data/search.ts`**

```ts
import type { Product } from "@/lib/schemas";
import { searchProducts as searchProductsRepo } from "@/server/repositories/product.repo";
import { toProduct } from "./adapters/product";

export async function searchProducts(query: string): Promise<Product[]> {
  const rows = await searchProductsRepo(query);
  return rows.map(toProduct);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "server/data/search"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/search.ts src/server/data/__tests__/search.test.ts
git commit -m "feat(backend): server/data/search façade (Prisma-backed)"
```

---

## Task 13: Update consumer imports + delete `src/lib/data/*.ts`

**Files (15 consumers + 6 deletions):**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/collection/[slug]/page.tsx`
- Modify: `src/app/products/[slug]/page.tsx`
- Modify: `src/app/initiate-return/page.tsx`
- Modify: `src/app/account/orders/page.tsx`
- Modify: `src/app/account/orders/[id]/page.tsx`
- Modify: `src/app/account/pre-orders/page.tsx`
- Modify: `src/app/account/addresses/page.tsx`
- Modify: `src/app/search/page.tsx`
- Modify: `src/components/search-overlay.tsx`
- Modify: `src/components/account/address-form-modal.tsx`
- Modify: `src/components/account/address-card.tsx`
- Delete: `src/lib/data/products.ts`
- Delete: `src/lib/data/categories.ts`
- Delete: `src/lib/data/content.ts`
- Delete: `src/lib/data/orders.ts`
- Delete: `src/lib/data/addresses.ts`
- Delete: `src/lib/data/search.ts`

- [ ] **Step 1: Apply the bulk import rewrite**

Run a single sed pass that updates every consumer at once:

```bash
grep -rl '"@/lib/data/products"' src/ | xargs sed -i '' 's|"@/lib/data/products"|"@/server/data/products"|g'
grep -rl '"@/lib/data/categories"' src/ | xargs sed -i '' 's|"@/lib/data/categories"|"@/server/data/categories"|g'
grep -rl '"@/lib/data/content"' src/ | xargs sed -i '' 's|"@/lib/data/content"|"@/server/data/content"|g'
grep -rl '"@/lib/data/orders"' src/ | xargs sed -i '' 's|"@/lib/data/orders"|"@/server/data/orders"|g'
grep -rl '"@/lib/data/search"' src/ | xargs sed -i '' 's|"@/lib/data/search"|"@/server/data/search"|g'
grep -rl '"@/lib/data/addresses"' src/ | xargs sed -i '' 's|"@/lib/data/addresses"|"@/lib/schemas/saved-address"|g'
```

(The `addresses` rewrite points at `lib/schemas/saved-address` because every remaining `@/lib/data/addresses` import in client code is for the `SavedAddress` type, not the `getSavedAddresses` runtime function. The runtime function is server-only and is referenced separately in `src/app/account/addresses/page.tsx` — Step 2 handles that.)

- [ ] **Step 2: Fix the addresses page runtime import**

`src/app/account/addresses/page.tsx` imports BOTH the `SavedAddress` type AND the `getSavedAddresses` runtime function from the same module. Step 1 sent both to `@/lib/schemas/saved-address`, but the runtime function lives at `@/server/data/addresses`. Open the file and split the import:

```bash
grep -n "saved-address" src/app/account/addresses/page.tsx
```

If you see `import { type SavedAddress, getSavedAddresses }` (or similar) on a single line pointing at `@/lib/schemas/saved-address`, replace with two imports:

```ts
import { getSavedAddresses } from "@/server/data/addresses";
import type { SavedAddress } from "@/lib/schemas/saved-address";
```

If the file already used a separate `import type` for `SavedAddress` (most likely — line 8 in the original was `import type { SavedAddress } from "@/lib/data/addresses"`), only the runtime import needs fixing — change the line that calls `getSavedAddresses` to import from `@/server/data/addresses`:

```bash
grep -n "getSavedAddresses\|SavedAddress" src/app/account/addresses/page.tsx
```

After this step, `src/app/account/addresses/page.tsx` should have both:
- `import { getSavedAddresses } from "@/server/data/addresses";`
- `import type { SavedAddress } from "@/lib/schemas/saved-address";`

- [ ] **Step 3: Verify no `@/lib/data/*` references remain**

```bash
grep -rn '"@/lib/data/' src/ | grep -v "_mock"
```

Expected: empty output. Any hit is a missed import; fix it manually before proceeding.

- [ ] **Step 4: Delete the old façade files**

```bash
rm -f src/lib/data/products.ts \
      src/lib/data/categories.ts \
      src/lib/data/content.ts \
      src/lib/data/orders.ts \
      src/lib/data/addresses.ts \
      src/lib/data/search.ts
```

If `src/lib/data/__tests__/` exists, also remove it:

```bash
rm -rf src/lib/data/__tests__
```

`src/lib/data/_mock/` MUST remain — `prisma/seed.ts` reads from it.

```bash
ls src/lib/data/
```

Expected: a single entry, `_mock`.

- [ ] **Step 5: Run the four quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all four exit 0. The test count should be ~23 server tests (existing 19 + 4 new façade tests not yet counted — actually higher; just verify no failures) and 143 client tests.

If `pnpm build` fails because a client component now imports from `@/server/data/*`, that is the lint rule firing correctly. Find the offending file with `pnpm lint` output, then move that file's data fetch into its parent server component (the App Router `page.tsx` is a Server Component by default; `'use client'` files must receive data as props from a server component above them).

- [ ] **Step 6: Smoke-test the storefront live**

```bash
pnpm dev > /tmp/dev.log 2>&1 &
sleep 8
for path in / /collection/jackets /our-story /shipping-returns /sustainability /product-care /privacy /terms /search?q=jacket /sitemap.xml /api/health; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "$status  $path"
done
kill %1
```

Expected: every path returns `200`.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "refactor(data): swap lib/data/* façades for server/data/* (Prisma-backed)"
```

---

## Task 14: Final validation, push, PR

**Files:** none (verification only)

- [ ] **Step 1: Re-run the four quality gates from a clean shell**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green, exit 0.

- [ ] **Step 2: Re-confirm storefront URLs**

```bash
pnpm dev > /tmp/dev.log 2>&1 &
sleep 8
for path in / /collection/jackets /our-story /shipping-returns /search?q=jacket /sitemap.xml /api/health; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "$status  $path"
done
kill %1
```

Expected: every path `200`.

- [ ] **Step 3: Verify the 12 success criteria from the spec**

Walk through `web/docs/superpowers/specs/2026-04-28-ynot-backend-phase-2-catalog-cms-reads-design.md` §9 and tick each one off. They are:

1. `src/lib/data/*.ts` is empty (only `_mock/` remains) — `ls src/lib/data/`.
2. The 12 façade functions live in `src/server/data/*.ts` — `grep -rE "^export (async )?function" src/server/data/*.ts | wc -l` should be ≥ 12.
3. All 15 consumer imports point to `@/server/data/*` or `@/lib/schemas/saved-address` — `grep -rn '"@/lib/data/' src/ | grep -v _mock` returns empty.
4. `SavedAddress` is in `src/lib/schemas/saved-address.ts`.
5. Each adapter has at least one unit test.
6. Each façade has at least one integration test.
7. Server test count ≥ 19 (Phase 1) + 11 (Phase 2) = 30; client test count = 143.
8. Quality gates green (already done above).
9. Storefront URLs return 200 (already done above).
10. ESLint rule still fires — `cat > src/lib/_violation.ts <<'EOF'` then a server import; `pnpm lint` fails; remove the file.
11. `_mock/*.json` unchanged — `git diff main src/lib/data/_mock/` empty.
12. `// PHASE 3:` comments present — `grep -n "PHASE 3:" src/server/data/*.ts` shows 2 lines (orders, addresses).

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feature/backend-phase-2-catalog-cms-reads
```

Expected: branch pushed; GitHub returns the PR-creation URL.

- [ ] **Step 5: Create the PR**

If `gh` CLI is installed:

```bash
gh pr create --title "feat(backend): Phase 2 — Catalog & CMS reads from Postgres" --body "$(cat <<'EOF'
## Summary
- Replaces every src/lib/data/* mock-backed façade with a Prisma-backed implementation under src/server/data/*.
- New repositories: order.repo, address.repo. product.repo gains listByCategory / listNewArrivals / listRecommendations / search.
- Five pure Prisma → Zod adapters with unit tests (no DB).
- Six façades with integration tests against a real test database.
- 15 consumer import paths swapped to @/server/data/*.
- SavedAddress Zod type relocated from lib/data/ to lib/schemas/.
- Stubs for getOrdersForCurrentUser / getSavedAddresses point at the seeded demo customer with `// PHASE 3:` comments.
- src/lib/data/{products,categories,content,orders,addresses,search}.ts deleted.

## Out of scope (future phases)
- NextAuth wiring — Phase 3 (replaces the demo-customer stub)
- Mutations / admin CRUD — Phase 6
- Stripe — Phase 4
- Royal Mail / DHL / Resend — Phase 5
- Postgres FTS / pagination / Redis caching — later perf passes

## Test plan
- [ ] `docker compose --profile dev up -d` brings stack up healthy
- [ ] `pnpm db:migrate && pnpm db:seed` succeed
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- [ ] `pnpm dev` then visit /, /collection/jackets, /products/<slug>, /our-story, /search?q=jacket — all 200, content unchanged from main
- [ ] `curl localhost:3000/api/health` returns `{"db":"ok","redis":"ok"}`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `gh` is not installed, open the URL printed by Step 4 in a browser, paste the title and body manually, then click **Create pull request**.

- [ ] **Step 6: Merge after review and clean up locally**

After the PR is approved (or self-approved by clicking "Squash and merge" → "Confirm"):

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git checkout main
git fetch origin
git reset --hard origin/main
git worktree remove .worktrees/backend-phase-2-catalog-cms-reads
git branch -D feature/backend-phase-2-catalog-cms-reads 2>/dev/null || true
```

Expected: main is at the merged squash commit; the worktree directory is gone; the local branch is deleted.

---

## Self-review

**1. Spec coverage.** Each success criterion from spec §9 maps to at least one task: §9.1 (lib/data emptied) → T13; §9.2 (12 functions in server/data) → T7–T12; §9.3 (consumers updated) → T13; §9.4 (SavedAddress relocated) → T2; §9.5 (adapter unit tests) → T5–T6; §9.6 (façade integration tests) → T7–T12; §9.7 (test counts) → T14; §9.8 (quality gates) → T13–T14; §9.9 (storefront URLs) → T13–T14; §9.10 (ESLint rule fires) → T14; §9.11 (`_mock/*.json` unchanged) — implicit, no task touches `_mock` files; §9.12 (`// PHASE 3:` comments) → T10, T11. All design-decision sections (adapter table §5, auth stub §6, search §7) covered by T5–T6 and T10–T12. Risk §10 about Zod-validation in adapter tests handled — every adapter test ends with `expect(() => XSchema.parse(result)).not.toThrow()`. Risk about `estimatedDeliveryDate` formatter handled by an explicit test case in T6 Step 1.

**2. Placeholder scan.** No "TBD", "TODO", "implement later", or "Add appropriate error handling" instructions. Every code step has the full code; every command step has the exact command and expected output. The `// PHASE 3:` comments inside Task 10 and 11 are deliberate scope markers, not plan placeholders.

**3. Type consistency.** Repository method names used identically between definition (T3, T4) and tests (T3, T4) and façade callers (T7–T12): `findProductBySlug`, `listProducts`, `listProductsByCategory`, `listNewArrivals`, `listRecommendations`, `searchProducts` (repo) and the matching `getX` façades. Adapter names consistent across definition and façade callers: `toProduct`, `toCategory`, `toHero`, `toLookbook`, `toStaticPage`, `toOrder`, `toSavedAddress`. The repository `searchProducts` and the façade `searchProducts` happen to share a name; the façade re-exports the repo via an alias (`searchProductsRepo`) inside `src/server/data/search.ts` to avoid the circular-name issue (Task 12 Step 3).

---

**Plan complete and saved to `web/docs/superpowers/plans/2026-04-28-ynot-backend-phase-2-catalog-cms-reads.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session, batch with checkpoints.

Which approach?
