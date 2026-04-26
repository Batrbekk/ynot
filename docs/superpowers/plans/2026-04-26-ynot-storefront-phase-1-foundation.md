# YNOT Storefront — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the testing harness, data layer (schemas + mock JSON + adapters + cart store), every primitive component (forms, layout, overlays), and update `/ui-kit` to showcase them all. After Phase 1, every other phase can compose these primitives instead of inventing them.

**Architecture:** TDD throughout. Vitest + @testing-library/react for component tests; jsdom env. All data flows through typed adapters in `web/src/lib/data/` reading from `_mock/*.json` (same shape as future API). Zod schemas in `web/src/lib/schemas/` are the single source of truth — adapters parse with them, forms validate with them. Cart state lives in a Zustand store persisted to `localStorage`. Components are pure presentational where possible; containers wire data.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript 5.9, Tailwind v4, React 19, Zustand 5, Zod 3, React Hook Form 7, Vitest 2, @testing-library/react 16.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md`

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web` — all paths in this plan are relative to this directory unless prefixed.

---

## File Structure (created by this plan)

```
web/
├── vitest.config.ts                     [created]
├── vitest.setup.ts                      [created]
├── package.json                         [modified — scripts + deps]
├── src/
│   ├── lib/
│   │   ├── cn.ts                        [exists]
│   │   ├── schemas/
│   │   │   ├── product.ts               [created]
│   │   │   ├── category.ts              [created]
│   │   │   ├── cart.ts                  [created]
│   │   │   ├── order.ts                 [created]
│   │   │   ├── content.ts               [created]
│   │   │   ├── address.ts               [created]
│   │   │   └── index.ts                 [created — barrel]
│   │   ├── data/
│   │   │   ├── _mock/
│   │   │   │   ├── products.json        [created]
│   │   │   │   ├── categories.json      [created]
│   │   │   │   ├── content.json         [created]
│   │   │   │   ├── lookbook.json        [created]
│   │   │   │   └── orders.json          [created]
│   │   │   ├── products.ts              [created]
│   │   │   ├── categories.ts            [created]
│   │   │   ├── content.ts               [created]
│   │   │   ├── search.ts                [created]
│   │   │   └── orders.ts                [created]
│   │   └── stores/
│   │       └── cart-store.ts            [created]
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx               [exists]
│   │   │   ├── input.tsx                [exists]
│   │   │   ├── container.tsx            [exists]
│   │   │   ├── typography.tsx           [exists]
│   │   │   ├── checkbox.tsx             [created]
│   │   │   ├── radio-group.tsx          [created]
│   │   │   ├── select.tsx               [created]
│   │   │   ├── textarea.tsx             [created]
│   │   │   ├── password-input.tsx       [created]
│   │   │   ├── phone-input.tsx          [created]
│   │   │   ├── quantity-stepper.tsx     [created]
│   │   │   ├── size-selector.tsx        [created]
│   │   │   ├── colour-swatch.tsx        [created]
│   │   │   ├── icon-button.tsx          [created]
│   │   │   ├── skeleton.tsx             [created]
│   │   │   ├── card-input.tsx           [created — Stripe stub]
│   │   │   ├── prose.tsx                [created]
│   │   │   ├── section.tsx              [created]
│   │   │   ├── grid.tsx                 [created]
│   │   │   ├── drawer.tsx               [created — base overlay]
│   │   │   ├── modal.tsx                [created]
│   │   │   ├── toast.tsx                [created]
│   │   │   ├── tabs.tsx                 [created]
│   │   │   └── accordion.tsx            [created]
│   │   ├── page-shell.tsx               [created]
│   │   ├── whatsapp-widget.tsx          [created]
│   │   ├── icons.tsx                    [exists — extended]
│   │   └── (existing chrome unchanged)
│   └── app/
│       ├── ui-kit/
│       │   └── page.tsx                 [modified — add new sections]
│       └── (rest unchanged)
└── tests/
    └── (component tests co-located in src/components/ui/__tests__/)
```

Tests live alongside components in `__tests__` folders to match Next.js conventions and keep components + tests in same directory.

---

# Section A — Test harness setup

### Task 1: Install Vitest + testing libraries

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run install**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

Expected: dependencies added without errors.

- [ ] **Step 2: Verify install**

Run: `pnpm list vitest @testing-library/react`
Expected: shows installed versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install vitest and testing-library for component tests"
```

---

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (scripts)
- Modify: `tsconfig.json` (types)

- [ ] **Step 1: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Create setup file**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Add scripts to package.json**

In `package.json`, add to the `scripts` block:

```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 4: Add Vitest types to tsconfig**

In `tsconfig.json`, ensure `compilerOptions.types` includes `"vitest/globals"`:

```json
"types": ["vitest/globals"]
```

If `types` doesn't exist, add it inside `compilerOptions`. If it exists, append `"vitest/globals"` to the array.

- [ ] **Step 5: Smoke test**

Create `src/lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `pnpm test`
Expected: 1 test passes, exits 0.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json tsconfig.json src/lib/__tests__/smoke.test.ts
git commit -m "chore: configure vitest with testing-library and jsdom"
```

---

# Section B — Data layer (schemas + mock JSON + adapters + cart store)

### Task 3: Install Zod + Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
pnpm add zod zustand
```

- [ ] **Step 2: Verify**

Run: `pnpm list zod zustand`
Expected: shows installed versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add zod and zustand dependencies"
```

---

### Task 4: Product schema

**Files:**
- Create: `src/lib/schemas/product.ts`
- Create: `src/lib/schemas/__tests__/product.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schemas/__tests__/product.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ProductSchema, type Product } from "../product";

describe("ProductSchema", () => {
  it("accepts a complete valid product", () => {
    const valid: Product = {
      id: "prod_001",
      slug: "belted-suede-field-jacket",
      name: "Belted Suede Field Jacket",
      price: 89500,
      currency: "GBP",
      description: "A timeless field jacket.",
      images: ["/images/products/belted/1.webp"],
      colour: "Chocolate Brown",
      sizes: ["XS", "S", "M", "L", "XL"],
      categorySlugs: ["jackets", "suede"],
      stock: { XS: 0, S: 5, M: 3, L: 0, XL: 2 },
      preOrder: false,
      details: {
        materials: "100% suede",
        care: "Dry clean only",
        sizing: "Fits true to size",
      },
    };
    expect(() => ProductSchema.parse(valid)).not.toThrow();
  });

  it("rejects negative price", () => {
    expect(() =>
      ProductSchema.parse({
        id: "p",
        slug: "p",
        name: "n",
        price: -1,
        currency: "GBP",
        description: "d",
        images: [],
        sizes: [],
        categorySlugs: [],
        stock: {},
        preOrder: false,
        details: { materials: "", care: "", sizing: "" },
      }),
    ).toThrow();
  });

  it("rejects empty slug", () => {
    expect(() =>
      ProductSchema.parse({
        id: "p",
        slug: "",
        name: "n",
        price: 100,
        currency: "GBP",
        description: "d",
        images: [],
        sizes: [],
        categorySlugs: [],
        stock: {},
        preOrder: false,
        details: { materials: "", care: "", sizing: "" },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/schemas/__tests__/product.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema**

Create `src/lib/schemas/product.ts`:

```ts
import { z } from "zod";

export const SizeSchema = z.enum(["XS", "S", "M", "L", "XL"]);
export type Size = z.infer<typeof SizeSchema>;

export const ProductDetailsSchema = z.object({
  materials: z.string(),
  care: z.string(),
  sizing: z.string(),
});

export const ProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Price in minor units (pence for GBP). 89500 = £895.00 */
  price: z.number().int().nonnegative(),
  currency: z.literal("GBP"),
  description: z.string(),
  images: z.array(z.string()),
  colour: z.string().optional(),
  sizes: z.array(SizeSchema),
  categorySlugs: z.array(z.string()),
  stock: z.record(SizeSchema, z.number().int().nonnegative()),
  preOrder: z.boolean(),
  details: ProductDetailsSchema,
});

export type Product = z.infer<typeof ProductSchema>;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/schemas/__tests__/product.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/product.ts src/lib/schemas/__tests__/product.test.ts
git commit -m "feat(data): add Product Zod schema with validation tests"
```

---

### Task 5: Category schema

**Files:**
- Create: `src/lib/schemas/category.ts`
- Create: `src/lib/schemas/__tests__/category.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schemas/__tests__/category.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CategorySchema, type Category } from "../category";

describe("CategorySchema", () => {
  it("accepts a valid category", () => {
    const c: Category = {
      slug: "jackets",
      name: "Jackets",
      description: "Outerwear staples.",
      bannerImage: null,
      sortOrder: 1,
      meta: { title: "Jackets · YNOT London", description: "Shop jackets." },
    };
    expect(() => CategorySchema.parse(c)).not.toThrow();
  });

  it("requires slug and name", () => {
    expect(() =>
      CategorySchema.parse({ slug: "", name: "", description: "", bannerImage: null, sortOrder: 0, meta: { title: "", description: "" } }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/schemas/__tests__/category.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/schemas/category.ts`:

```ts
import { z } from "zod";

export const SeoMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const CategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  bannerImage: z.string().nullable(),
  sortOrder: z.number().int(),
  meta: SeoMetaSchema,
});

export type Category = z.infer<typeof CategorySchema>;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/schemas/__tests__/category.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/category.ts src/lib/schemas/__tests__/category.test.ts
git commit -m "feat(data): add Category Zod schema"
```

---

### Task 6: Cart schema

**Files:**
- Create: `src/lib/schemas/cart.ts`
- Create: `src/lib/schemas/__tests__/cart.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/schemas/__tests__/cart.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CartItemSchema, CartSchema, type Cart } from "../cart";

describe("CartItemSchema", () => {
  it("accepts a valid cart item", () => {
    expect(() =>
      CartItemSchema.parse({
        productId: "prod_001",
        slug: "belted-suede-field-jacket",
        name: "Belted Suede Field Jacket",
        image: "/images/products/belted/1.webp",
        colour: "Chocolate Brown",
        size: "M",
        unitPrice: 89500,
        quantity: 1,
        preOrder: false,
      }),
    ).not.toThrow();
  });

  it("rejects quantity 0", () => {
    expect(() =>
      CartItemSchema.parse({
        productId: "p",
        slug: "p",
        name: "n",
        image: "/i",
        colour: "c",
        size: "M",
        unitPrice: 1,
        quantity: 0,
        preOrder: false,
      }),
    ).toThrow();
  });
});

describe("CartSchema", () => {
  it("accepts an empty cart", () => {
    const cart: Cart = { items: [], promoCode: null, currency: "GBP" };
    expect(() => CartSchema.parse(cart)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/schemas/__tests__/cart.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/schemas/cart.ts`:

```ts
import { z } from "zod";
import { SizeSchema } from "./product";

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  image: z.string(),
  colour: z.string(),
  size: SizeSchema,
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  preOrder: z.boolean(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  items: z.array(CartItemSchema),
  promoCode: z.string().nullable(),
  currency: z.literal("GBP"),
});

export type Cart = z.infer<typeof CartSchema>;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/schemas/__tests__/cart.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/cart.ts src/lib/schemas/__tests__/cart.test.ts
git commit -m "feat(data): add Cart and CartItem schemas"
```

---

### Task 7: Address + Order schemas

**Files:**
- Create: `src/lib/schemas/address.ts`
- Create: `src/lib/schemas/order.ts`
- Create: `src/lib/schemas/__tests__/order.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/schemas/__tests__/order.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { OrderSchema, OrderStatusSchema } from "../order";
import { AddressSchema } from "../address";

describe("AddressSchema", () => {
  it("accepts a UK address", () => {
    expect(() =>
      AddressSchema.parse({
        firstName: "Jane",
        lastName: "Doe",
        line1: "42 King's Road",
        line2: null,
        city: "London",
        postcode: "SW3 4ND",
        country: "GB",
        phone: "+44 7700 900123",
      }),
    ).not.toThrow();
  });
});

describe("OrderStatusSchema", () => {
  it("accepts known statuses", () => {
    for (const s of ["new", "processing", "shipped", "delivered", "returned"]) {
      expect(() => OrderStatusSchema.parse(s)).not.toThrow();
    }
  });
  it("rejects unknown status", () => {
    expect(() => OrderStatusSchema.parse("invented")).toThrow();
  });
});

describe("OrderSchema", () => {
  it("accepts a full order", () => {
    expect(() =>
      OrderSchema.parse({
        id: "YNT-20260414-0029",
        createdAt: "2026-04-14T10:00:00Z",
        status: "shipped",
        items: [
          {
            productId: "p",
            slug: "p",
            name: "n",
            image: "/i",
            colour: "c",
            size: "M",
            unitPrice: 100,
            quantity: 1,
            preOrder: false,
          },
        ],
        subtotal: 100,
        shipping: 0,
        total: 100,
        currency: "GBP",
        carrier: "royal-mail",
        trackingNumber: null,
        shippingAddress: {
          firstName: "Jane",
          lastName: "Doe",
          line1: "42 King's Road",
          line2: null,
          city: "London",
          postcode: "SW3 4ND",
          country: "GB",
          phone: "+44 7700 900123",
        },
        estimatedDeliveryDate: "2026-04-17",
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/schemas/__tests__/order.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Address**

Create `src/lib/schemas/address.ts`:

```ts
import { z } from "zod";

export const AddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  postcode: z.string().min(1),
  /** ISO 3166-1 alpha-2 country code */
  country: z.string().length(2),
  phone: z.string(),
});

export type Address = z.infer<typeof AddressSchema>;
```

- [ ] **Step 4: Implement Order**

Create `src/lib/schemas/order.ts`:

```ts
import { z } from "zod";
import { CartItemSchema } from "./cart";
import { AddressSchema } from "./address";

export const OrderStatusSchema = z.enum([
  "new",
  "processing",
  "shipped",
  "delivered",
  "returned",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CarrierSchema = z.enum(["royal-mail", "dhl"]);
export type Carrier = z.infer<typeof CarrierSchema>;

export const OrderSchema = z.object({
  id: z.string().min(1),
  /** ISO 8601 timestamp */
  createdAt: z.string(),
  status: OrderStatusSchema,
  items: z.array(CartItemSchema),
  subtotal: z.number().int().nonnegative(),
  shipping: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  currency: z.literal("GBP"),
  carrier: CarrierSchema,
  trackingNumber: z.string().nullable(),
  shippingAddress: AddressSchema,
  /** YYYY-MM-DD */
  estimatedDeliveryDate: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm test src/lib/schemas/__tests__/order.test.ts`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/address.ts src/lib/schemas/order.ts src/lib/schemas/__tests__/order.test.ts
git commit -m "feat(data): add Address and Order schemas with status enum"
```

---

### Task 8: Content schema (CMS-driven blocks)

**Files:**
- Create: `src/lib/schemas/content.ts`
- Create: `src/lib/schemas/__tests__/content.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/schemas/__tests__/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  HeroBlockSchema,
  AnnouncementBlockSchema,
  StaticPageSchema,
} from "../content";

describe("HeroBlockSchema", () => {
  it("accepts an image hero", () => {
    expect(() =>
      HeroBlockSchema.parse({
        kind: "image",
        image: "/images/hero/1.webp",
        videoUrl: null,
        eyebrow: "New Collection",
        ctaLabel: "SHOP",
        ctaHref: "/collection/jackets",
      }),
    ).not.toThrow();
  });
});

describe("AnnouncementBlockSchema", () => {
  it("accepts a list of messages", () => {
    expect(() =>
      AnnouncementBlockSchema.parse({
        messages: ["Sign in and get 10% off", "Free UK shipping"],
      }),
    ).not.toThrow();
  });
});

describe("StaticPageSchema", () => {
  it("accepts a markdown body", () => {
    expect(() =>
      StaticPageSchema.parse({
        slug: "our-story",
        title: "Our Story",
        bodyMarkdown: "# Why Not?\n\nWe build outerwear...",
        meta: { title: "Our Story · YNOT", description: "About YNOT London" },
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/schemas/__tests__/content.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/schemas/content.ts`:

```ts
import { z } from "zod";
import { SeoMetaSchema } from "./category";

export const HeroBlockSchema = z.object({
  kind: z.enum(["image", "video"]),
  image: z.string(),
  videoUrl: z.string().nullable(),
  eyebrow: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
});
export type HeroBlock = z.infer<typeof HeroBlockSchema>;

export const AnnouncementBlockSchema = z.object({
  messages: z.array(z.string().min(1)).min(1),
});
export type AnnouncementBlock = z.infer<typeof AnnouncementBlockSchema>;

export const LookbookImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  /** Optional product link */
  productSlug: z.string().nullable(),
});
export type LookbookImage = z.infer<typeof LookbookImageSchema>;

export const LookbookSchema = z.object({
  images: z.array(LookbookImageSchema),
});
export type Lookbook = z.infer<typeof LookbookSchema>;

export const StaticPageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  bodyMarkdown: z.string(),
  meta: SeoMetaSchema,
});
export type StaticPage = z.infer<typeof StaticPageSchema>;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/schemas/__tests__/content.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/content.ts src/lib/schemas/__tests__/content.test.ts
git commit -m "feat(data): add Content schemas (Hero, Announcement, Lookbook, StaticPage)"
```

---

### Task 9: Schemas barrel + price formatter

**Files:**
- Create: `src/lib/schemas/index.ts`
- Create: `src/lib/format.ts`
- Create: `src/lib/__tests__/format.test.ts`

- [ ] **Step 1: Write failing test for formatter**

Create `src/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatPrice } from "../format";

describe("formatPrice", () => {
  it("formats GBP minor units to £xx", () => {
    expect(formatPrice(89500, "GBP")).toBe("£895");
  });
  it("includes pence when non-zero", () => {
    expect(formatPrice(89550, "GBP")).toBe("£895.50");
  });
  it("handles zero", () => {
    expect(formatPrice(0, "GBP")).toBe("£0");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/__tests__/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter**

Create `src/lib/format.ts`:

```ts
export function formatPrice(minorUnits: number, currency: "GBP"): string {
  const major = minorUnits / 100;
  const symbol = currency === "GBP" ? "£" : "";
  if (Number.isInteger(major)) return `${symbol}${major.toLocaleString("en-GB")}`;
  return `${symbol}${major.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/__tests__/format.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Create schemas barrel**

Create `src/lib/schemas/index.ts`:

```ts
export * from "./product";
export * from "./category";
export * from "./cart";
export * from "./order";
export * from "./address";
export * from "./content";
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts src/lib/schemas/index.ts
git commit -m "feat(data): add price formatter and schemas barrel export"
```

---

### Task 10: Mock JSON — products

**Files:**
- Create: `src/lib/data/_mock/products.json`

- [ ] **Step 1: Create file**

Create `src/lib/data/_mock/products.json`:

```json
[
  {
    "id": "prod_001",
    "slug": "belted-suede-field-jacket",
    "name": "Belted Suede Field Jacket",
    "price": 89500,
    "currency": "GBP",
    "description": "A timeless field jacket cut from supple Italian suede with a belted waist for a sculpted silhouette.",
    "images": ["/sample/jacket-1.svg", "/sample/jacket-2.svg"],
    "colour": "Chocolate Brown",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["jackets", "suede"],
    "stock": { "XS": 3, "S": 5, "M": 0, "L": 2, "XL": 1 },
    "preOrder": false,
    "details": {
      "materials": "100% Italian suede. Cotton lining.",
      "care": "Dry clean only. Store on a padded hanger.",
      "sizing": "Fits true to size. Model wears size S."
    }
  },
  {
    "id": "prod_002",
    "slug": "wool-trench-coat",
    "name": "Wool Trench Coat",
    "price": 129500,
    "currency": "GBP",
    "description": "A double-breasted trench in pure virgin wool, tailored for movement and warmth.",
    "images": ["/sample/jacket-3.svg"],
    "colour": "Charcoal",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["coats", "wool"],
    "stock": { "XS": 0, "S": 4, "M": 6, "L": 3, "XL": 0 },
    "preOrder": false,
    "details": {
      "materials": "100% virgin wool. Viscose lining.",
      "care": "Dry clean only.",
      "sizing": "Roomy through the body. Size down for a closer fit."
    }
  },
  {
    "id": "prod_003",
    "slug": "leather-biker-jacket",
    "name": "Leather Biker Jacket",
    "price": 99500,
    "currency": "GBP",
    "description": "An asymmetric leather biker jacket with a matte finish and signature YNOT hardware.",
    "images": ["/sample/jacket-4.svg"],
    "colour": "Black",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["jackets", "leather"],
    "stock": { "XS": 2, "S": 3, "M": 4, "L": 2, "XL": 1 },
    "preOrder": false,
    "details": {
      "materials": "100% lamb leather. LWG-certified tannery.",
      "care": "Wipe with a soft damp cloth. Condition every 6 months.",
      "sizing": "Slim cut. Consider sizing up if between sizes."
    }
  },
  {
    "id": "prod_004",
    "slug": "quilted-field-vest",
    "name": "Quilted Field Vest",
    "price": 59500,
    "currency": "GBP",
    "description": "A lightweight quilted vest for layering through transitional seasons.",
    "images": ["/sample/jacket-1.svg"],
    "colour": "Olive",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["jackets", "cotton"],
    "stock": { "XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0 },
    "preOrder": true,
    "details": {
      "materials": "Cotton shell, recycled polyester fill.",
      "care": "Machine wash cold.",
      "sizing": "Designed to layer over knitwear."
    }
  },
  {
    "id": "prod_005",
    "slug": "cropped-shearling-coat",
    "name": "Cropped Shearling Coat",
    "price": 149500,
    "currency": "GBP",
    "description": "A cropped shearling coat with reversed wool collar and turned cuffs.",
    "images": ["/sample/jacket-2.svg"],
    "colour": "Cream",
    "sizes": ["S", "M", "L"],
    "categorySlugs": ["coats", "leather"],
    "stock": { "S": 1, "M": 2, "L": 1 },
    "preOrder": false,
    "details": {
      "materials": "Lamb shearling. Wool lining.",
      "care": "Specialist clean only.",
      "sizing": "Cropped at the hip. True to size."
    }
  },
  {
    "id": "prod_006",
    "slug": "the-chelsea-jacket",
    "name": "The Chelsea Jacket",
    "price": 69500,
    "currency": "GBP",
    "description": "Our signature mid-length jacket — refined tailoring with everyday wearability.",
    "images": ["/sample/jacket-3.svg"],
    "colour": "Navy",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["jackets", "wool"],
    "stock": { "XS": 4, "S": 6, "M": 5, "L": 4, "XL": 2 },
    "preOrder": false,
    "details": {
      "materials": "Wool blend.",
      "care": "Dry clean.",
      "sizing": "Tailored fit."
    }
  },
  {
    "id": "prod_007",
    "slug": "the-belgravia-blazer",
    "name": "The Belgravia Blazer",
    "price": 54500,
    "currency": "GBP",
    "description": "A clean-line blazer cut for dressed-up or pared-back wear.",
    "images": ["/sample/jacket-4.svg"],
    "colour": "Black",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["blazers", "wool"],
    "stock": { "XS": 2, "S": 3, "M": 4, "L": 3, "XL": 1 },
    "preOrder": false,
    "details": {
      "materials": "Wool / silk blend.",
      "care": "Dry clean.",
      "sizing": "Slim fit through the shoulder."
    }
  },
  {
    "id": "prod_008",
    "slug": "the-notting-hill-bomber",
    "name": "The Notting Hill Bomber",
    "price": 72500,
    "currency": "GBP",
    "description": "An elevated take on the bomber — leather body, ribbed knit cuffs and hem.",
    "images": ["/sample/jacket-1.svg"],
    "colour": "Cognac",
    "sizes": ["XS", "S", "M", "L", "XL"],
    "categorySlugs": ["bombers", "leather"],
    "stock": { "XS": 1, "S": 2, "M": 3, "L": 2, "XL": 0 },
    "preOrder": false,
    "details": {
      "materials": "Lamb leather, ribbed knit trims.",
      "care": "Wipe with damp cloth. Condition every 6 months.",
      "sizing": "Relaxed through the body."
    }
  }
]
```

- [ ] **Step 2: Verify it parses against the schema**

Add to `src/lib/schemas/__tests__/product.test.ts` at the bottom (inside an outer scope or new describe):

```ts
import productsFixture from "../../data/_mock/products.json";

describe("ProductSchema mock data", () => {
  it("validates every product in the mock JSON", () => {
    for (const p of productsFixture) {
      expect(() => ProductSchema.parse(p)).not.toThrow();
    }
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm test src/lib/schemas/__tests__/product.test.ts`
Expected: All tests pass including the new mock data assertion.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/_mock/products.json src/lib/schemas/__tests__/product.test.ts
git commit -m "feat(data): add 8 mock products covering all category combinations"
```

---

### Task 11: Mock JSON — categories

**Files:**
- Create: `src/lib/data/_mock/categories.json`

- [ ] **Step 1: Create file**

Create `src/lib/data/_mock/categories.json`:

```json
[
  { "slug": "jackets",  "name": "Jackets",  "description": "Outerwear staples — engineered for everyday wear.", "bannerImage": null, "sortOrder": 1, "meta": { "title": "Jackets · YNOT London", "description": "Shop premium jackets from YNOT London." } },
  { "slug": "blazers",  "name": "Blazers",  "description": "Tailored blazers for refined dressing.",            "bannerImage": null, "sortOrder": 2, "meta": { "title": "Blazers · YNOT London", "description": "Shop tailored blazers." } },
  { "slug": "bombers",  "name": "Bombers",  "description": "Elevated bombers in leather and technical fabrics.","bannerImage": null, "sortOrder": 3, "meta": { "title": "Bombers · YNOT London", "description": "Shop elevated bomber jackets." } },
  { "slug": "coats",    "name": "Coats",    "description": "Long-line coats for the colder months.",             "bannerImage": null, "sortOrder": 4, "meta": { "title": "Coats · YNOT London", "description": "Shop wool, shearling, and cashmere coats." } },
  { "slug": "leather",  "name": "Leather",  "description": "LWG-certified leather pieces.",                       "bannerImage": null, "sortOrder": 5, "meta": { "title": "Leather · YNOT London", "description": "Premium leather outerwear." } },
  { "slug": "suede",    "name": "Suede",    "description": "Soft, supple suede outerwear.",                        "bannerImage": null, "sortOrder": 6, "meta": { "title": "Suede · YNOT London", "description": "Italian suede jackets and coats." } },
  { "slug": "wool",     "name": "Wool",     "description": "Pure virgin wool tailoring.",                          "bannerImage": null, "sortOrder": 7, "meta": { "title": "Wool · YNOT London", "description": "Wool coats and tailoring." } },
  { "slug": "cotton",   "name": "Cotton",   "description": "Cotton-blend layering pieces.",                        "bannerImage": null, "sortOrder": 8, "meta": { "title": "Cotton · YNOT London", "description": "Lightweight cotton outerwear." } },
  { "slug": "tencel",   "name": "Tencel",   "description": "Sustainable Tencel-based fabrics.",                    "bannerImage": null, "sortOrder": 9, "meta": { "title": "Tencel · YNOT London", "description": "Sustainable Tencel outerwear." } }
]
```

- [ ] **Step 2: Add fixture validation test**

Append to `src/lib/schemas/__tests__/category.test.ts`:

```ts
import categoriesFixture from "../../data/_mock/categories.json";

describe("CategorySchema mock data", () => {
  it("validates every category", () => {
    for (const c of categoriesFixture) {
      expect(() => CategorySchema.parse(c)).not.toThrow();
    }
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm test src/lib/schemas/__tests__/category.test.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/_mock/categories.json src/lib/schemas/__tests__/category.test.ts
git commit -m "feat(data): add 9 categories matching brief sidebar list"
```

---

### Task 12: Mock JSON — content (hero, announcement, lookbook, static pages)

**Files:**
- Create: `src/lib/data/_mock/content.json`
- Create: `src/lib/data/_mock/lookbook.json`

- [ ] **Step 1: Create content.json**

Create `src/lib/data/_mock/content.json`:

```json
{
  "announcement": {
    "messages": [
      "Sign in and get 10% off your first order",
      "Free UK shipping"
    ]
  },
  "hero": {
    "kind": "image",
    "image": "/sample/jacket-1.svg",
    "videoUrl": null,
    "eyebrow": "New Collection",
    "ctaLabel": "SHOP",
    "ctaHref": "/collection/jackets"
  },
  "staticPages": [
    {
      "slug": "our-story",
      "title": "Our Story",
      "bodyMarkdown": "# Why Not?\n\nYNOT London was born from a simple belief: that outerwear should be as resilient as the women who wear it. Our name carries a quiet philosophy — why not live boldly, dress intentionally, and choose pieces that endure.\n\n## What we stand for\n\n- Timeless design — pieces that transcend seasons\n- Premium materials — leather, suede, wool, cotton, Tencel\n- Sustainability — 0% leather waste, responsible sourcing\n- London & Istanbul — designed in London, made between London and Istanbul\n",
      "meta": { "title": "Our Story · YNOT London", "description": "The YNOT London story." }
    },
    {
      "slug": "product-care",
      "title": "Product Care",
      "bodyMarkdown": "# Product Care\n\nKeep your YNOT pieces looking their best with these care instructions.\n\nSelect a material to view detailed guidance.\n",
      "meta": { "title": "Product Care · YNOT London", "description": "Care instructions for leather, suede, wool, shearling, and cotton." }
    },
    {
      "slug": "sustainability",
      "title": "Sustainability & Animal Welfare",
      "bodyMarkdown": "# Sustainability\n\nAt YNOT London, sustainability isn't a trend — it's a responsibility.\n",
      "meta": { "title": "Sustainability · YNOT London", "description": "Our approach to sustainability and animal welfare." }
    },
    {
      "slug": "shipping-returns",
      "title": "Shipping & Returns",
      "bodyMarkdown": "# Shipping & Returns\n\nDelivery is free worldwide.\n",
      "meta": { "title": "Shipping & Returns · YNOT London", "description": "Shipping and returns policy." }
    },
    {
      "slug": "privacy",
      "title": "Privacy Policy",
      "bodyMarkdown": "# Privacy Policy\n\nThis policy describes how YNOT London handles your personal data.\n",
      "meta": { "title": "Privacy Policy · YNOT London", "description": "How we handle your data." }
    },
    {
      "slug": "contact",
      "title": "Contact",
      "bodyMarkdown": "# Contact\n\nReach us at hello@ynotlondon.com\n",
      "meta": { "title": "Contact · YNOT London", "description": "Get in touch with YNOT London." }
    }
  ]
}
```

- [ ] **Step 2: Create lookbook.json**

Create `src/lib/data/_mock/lookbook.json`:

```json
{
  "images": [
    { "src": "/sample/jacket-1.svg", "alt": "Lookbook image — leather jacket", "productSlug": "leather-biker-jacket" },
    { "src": "/sample/jacket-2.svg", "alt": "Lookbook image — suede field jacket", "productSlug": "belted-suede-field-jacket" },
    { "src": "/sample/jacket-3.svg", "alt": "Lookbook image — wool trench", "productSlug": "wool-trench-coat" },
    { "src": "/sample/jacket-4.svg", "alt": "Lookbook image — cotton parka", "productSlug": null }
  ]
}
```

- [ ] **Step 3: Add fixture validation tests**

Append to `src/lib/schemas/__tests__/content.test.ts`:

```ts
import contentFixture from "../../data/_mock/content.json";
import lookbookFixture from "../../data/_mock/lookbook.json";

describe("Mock content fixtures", () => {
  it("announcement parses", () => {
    expect(() => AnnouncementBlockSchema.parse(contentFixture.announcement)).not.toThrow();
  });
  it("hero parses", () => {
    expect(() => HeroBlockSchema.parse(contentFixture.hero)).not.toThrow();
  });
  it("every static page parses", () => {
    for (const page of contentFixture.staticPages) {
      expect(() => StaticPageSchema.parse(page)).not.toThrow();
    }
  });
});

import { LookbookSchema } from "../content";
describe("Lookbook fixture", () => {
  it("parses", () => {
    expect(() => LookbookSchema.parse(lookbookFixture)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run**

Run: `pnpm test src/lib/schemas/__tests__/content.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/_mock/content.json src/lib/data/_mock/lookbook.json src/lib/schemas/__tests__/content.test.ts
git commit -m "feat(data): add CMS content fixtures (announcement, hero, lookbook, static pages)"
```

---

### Task 13: Mock JSON — orders

**Files:**
- Create: `src/lib/data/_mock/orders.json`

- [ ] **Step 1: Create file**

Create `src/lib/data/_mock/orders.json`:

```json
[
  {
    "id": "YNT-2847",
    "createdAt": "2026-03-28T11:23:00Z",
    "status": "delivered",
    "items": [
      { "productId": "prod_001", "slug": "belted-suede-field-jacket", "name": "Belted Suede Field Jacket", "image": "/sample/jacket-1.svg", "colour": "Chocolate Brown", "size": "M", "unitPrice": 89500, "quantity": 1, "preOrder": false }
    ],
    "subtotal": 89500,
    "shipping": 0,
    "total": 89500,
    "currency": "GBP",
    "carrier": "royal-mail",
    "trackingNumber": "RM12345678GB",
    "shippingAddress": { "firstName": "Jane", "lastName": "Doe", "line1": "42 King's Road", "line2": null, "city": "London", "postcode": "SW3 4ND", "country": "GB", "phone": "+44 7700 900123" },
    "estimatedDeliveryDate": "2026-04-01"
  },
  {
    "id": "YNT-2831",
    "createdAt": "2026-03-15T14:50:00Z",
    "status": "shipped",
    "items": [
      { "productId": "prod_006", "slug": "the-chelsea-jacket", "name": "The Chelsea Jacket", "image": "/sample/jacket-3.svg", "colour": "Navy", "size": "S", "unitPrice": 69500, "quantity": 1, "preOrder": false }
    ],
    "subtotal": 69500,
    "shipping": 0,
    "total": 69500,
    "currency": "GBP",
    "carrier": "royal-mail",
    "trackingNumber": "RM98765432GB",
    "shippingAddress": { "firstName": "Jane", "lastName": "Doe", "line1": "42 King's Road", "line2": null, "city": "London", "postcode": "SW3 4ND", "country": "GB", "phone": "+44 7700 900123" },
    "estimatedDeliveryDate": "2026-03-19"
  }
]
```

- [ ] **Step 2: Add fixture test**

Append to `src/lib/schemas/__tests__/order.test.ts`:

```ts
import ordersFixture from "../../data/_mock/orders.json";

describe("Orders mock data", () => {
  it("validates every order", () => {
    for (const o of ordersFixture) {
      expect(() => OrderSchema.parse(o)).not.toThrow();
    }
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm test src/lib/schemas/__tests__/order.test.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/_mock/orders.json src/lib/schemas/__tests__/order.test.ts
git commit -m "feat(data): add mock orders fixture"
```

---

### Task 14: Products adapter

**Files:**
- Create: `src/lib/data/products.ts`
- Create: `src/lib/data/__tests__/products.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/data/__tests__/products.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAllProducts, getProductBySlug, getProductsByCategory } from "../products";

describe("products adapter", () => {
  it("getAllProducts returns parsed list", async () => {
    const all = await getAllProducts();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].slug).toBeTruthy();
  });

  it("getProductBySlug returns product or null", async () => {
    const p = await getProductBySlug("belted-suede-field-jacket");
    expect(p?.name).toBe("Belted Suede Field Jacket");
    const n = await getProductBySlug("does-not-exist");
    expect(n).toBeNull();
  });

  it("getProductsByCategory filters by category slug", async () => {
    const jackets = await getProductsByCategory("jackets");
    expect(jackets.every((p) => p.categorySlugs.includes("jackets"))).toBe(true);
    expect(jackets.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/data/__tests__/products.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/data/products.ts`:

```ts
import { ProductSchema, type Product } from "../schemas";
import productsJson from "./_mock/products.json";

let cache: Product[] | null = null;

function load(): Product[] {
  if (cache) return cache;
  cache = productsJson.map((p) => ProductSchema.parse(p));
  return cache;
}

export async function getAllProducts(): Promise<Product[]> {
  return load();
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return load().find((p) => p.slug === slug) ?? null;
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<Product[]> {
  return load().filter((p) => p.categorySlugs.includes(categorySlug));
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  return load().slice(0, limit);
}

export async function getRecommendations(
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> {
  return load()
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/data/__tests__/products.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/products.ts src/lib/data/__tests__/products.test.ts
git commit -m "feat(data): add products adapter (getAll, getBySlug, getByCategory, recommendations)"
```

---

### Task 15: Categories adapter

**Files:**
- Create: `src/lib/data/categories.ts`
- Create: `src/lib/data/__tests__/categories.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/data/__tests__/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAllCategories, getCategoryBySlug } from "../categories";

describe("categories adapter", () => {
  it("returns all sorted by sortOrder", async () => {
    const all = await getAllCategories();
    expect(all.length).toBe(9);
    expect(all[0].slug).toBe("jackets");
  });
  it("getCategoryBySlug returns or null", async () => {
    expect((await getCategoryBySlug("jackets"))?.name).toBe("Jackets");
    expect(await getCategoryBySlug("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/data/__tests__/categories.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/data/categories.ts`:

```ts
import { CategorySchema, type Category } from "../schemas";
import categoriesJson from "./_mock/categories.json";

let cache: Category[] | null = null;

function load(): Category[] {
  if (cache) return cache;
  cache = categoriesJson
    .map((c) => CategorySchema.parse(c))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return cache;
}

export async function getAllCategories(): Promise<Category[]> {
  return load();
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return load().find((c) => c.slug === slug) ?? null;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/data/__tests__/categories.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/categories.ts src/lib/data/__tests__/categories.test.ts
git commit -m "feat(data): add categories adapter sorted by sortOrder"
```

---

### Task 16: Content adapter

**Files:**
- Create: `src/lib/data/content.ts`
- Create: `src/lib/data/__tests__/content.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/data/__tests__/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getAnnouncementMessages,
  getHero,
  getLookbook,
  getStaticPage,
} from "../content";

describe("content adapter", () => {
  it("returns announcement messages", async () => {
    const m = await getAnnouncementMessages();
    expect(m.length).toBeGreaterThan(0);
  });
  it("returns hero", async () => {
    const h = await getHero();
    expect(h.eyebrow).toBe("New Collection");
  });
  it("returns lookbook images", async () => {
    const l = await getLookbook();
    expect(l.images.length).toBeGreaterThan(0);
  });
  it("returns static page by slug", async () => {
    expect((await getStaticPage("our-story"))?.title).toBe("Our Story");
    expect(await getStaticPage("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/data/__tests__/content.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/data/content.ts`:

```ts
import {
  AnnouncementBlockSchema,
  HeroBlockSchema,
  LookbookSchema,
  StaticPageSchema,
  type HeroBlock,
  type Lookbook,
  type StaticPage,
} from "../schemas";
import contentJson from "./_mock/content.json";
import lookbookJson from "./_mock/lookbook.json";

export async function getAnnouncementMessages(): Promise<string[]> {
  return AnnouncementBlockSchema.parse(contentJson.announcement).messages;
}

export async function getHero(): Promise<HeroBlock> {
  return HeroBlockSchema.parse(contentJson.hero);
}

export async function getLookbook(): Promise<Lookbook> {
  return LookbookSchema.parse(lookbookJson);
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const found = contentJson.staticPages.find((p) => p.slug === slug);
  return found ? StaticPageSchema.parse(found) : null;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/data/__tests__/content.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/content.ts src/lib/data/__tests__/content.test.ts
git commit -m "feat(data): add CMS content adapter (announcement, hero, lookbook, staticPages)"
```

---

### Task 17: Search adapter

**Files:**
- Create: `src/lib/data/search.ts`
- Create: `src/lib/data/__tests__/search.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/data/__tests__/search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { searchProducts } from "../search";

describe("search adapter", () => {
  it("matches by name (case insensitive)", async () => {
    const r = await searchProducts("trench");
    expect(r.length).toBe(1);
    expect(r[0].slug).toBe("wool-trench-coat");
  });
  it("matches by category", async () => {
    const r = await searchProducts("leather");
    expect(r.some((p) => p.categorySlugs.includes("leather"))).toBe(true);
  });
  it("returns empty for no match", async () => {
    expect(await searchProducts("xyzzy")).toEqual([]);
  });
  it("returns empty for empty query", async () => {
    expect(await searchProducts("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/data/__tests__/search.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/data/search.ts`:

```ts
import type { Product } from "../schemas";
import { getAllProducts } from "./products";

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await getAllProducts();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.colour?.toLowerCase().includes(q) ||
      p.categorySlugs.some((c) => c.includes(q)) ||
      p.description.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/data/__tests__/search.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/search.ts src/lib/data/__tests__/search.test.ts
git commit -m "feat(data): add in-memory product search adapter"
```

---

### Task 18: Orders adapter

**Files:**
- Create: `src/lib/data/orders.ts`
- Create: `src/lib/data/__tests__/orders.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/data/__tests__/orders.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getOrdersForCurrentUser, getOrderById } from "../orders";

describe("orders adapter", () => {
  it("returns the mock orders", async () => {
    const list = await getOrdersForCurrentUser();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe("YNT-2847");
  });
  it("getOrderById finds a known order", async () => {
    expect((await getOrderById("YNT-2847"))?.status).toBe("delivered");
    expect(await getOrderById("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/data/__tests__/orders.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/data/orders.ts`:

```ts
import { OrderSchema, type Order } from "../schemas";
import ordersJson from "./_mock/orders.json";

let cache: Order[] | null = null;

function load(): Order[] {
  if (cache) return cache;
  cache = ordersJson.map((o) => OrderSchema.parse(o));
  return cache;
}

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  return load();
}

export async function getOrderById(id: string): Promise<Order | null> {
  return load().find((o) => o.id === id) ?? null;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/data/__tests__/orders.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/orders.ts src/lib/data/__tests__/orders.test.ts
git commit -m "feat(data): add orders adapter (list + by id)"
```

---

### Task 19: Cart Zustand store

**Files:**
- Create: `src/lib/stores/cart-store.ts`
- Create: `src/lib/stores/__tests__/cart-store.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/stores/__tests__/cart-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart-store";

const item = (overrides: Partial<{ size: "S" | "M"; quantity: number }> = {}) => ({
  productId: "prod_001",
  slug: "belted-suede-field-jacket",
  name: "Belted Suede Field Jacket",
  image: "/sample/jacket-1.svg",
  colour: "Chocolate Brown",
  size: overrides.size ?? "M",
  unitPrice: 89500,
  quantity: overrides.quantity ?? 1,
  preOrder: false,
} as const);

beforeEach(() => {
  useCartStore.setState({ items: [], promoCode: null, isOpen: false });
});

describe("cart store", () => {
  it("addItem adds new item", () => {
    useCartStore.getState().addItem(item());
    expect(useCartStore.getState().items.length).toBe(1);
  });

  it("addItem increments quantity if same productId+size", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 1 }));
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(3);
  });

  it("addItem with different size creates separate line", () => {
    useCartStore.getState().addItem(item({ size: "S" }));
    useCartStore.getState().addItem(item({ size: "M" }));
    expect(useCartStore.getState().items.length).toBe(2);
  });

  it("removeItem removes by productId+size", () => {
    useCartStore.getState().addItem(item({ size: "S" }));
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().removeItem("prod_001", "S");
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].size).toBe("M");
  });

  it("setQuantity updates an existing line", () => {
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().setQuantity("prod_001", "M", 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("setQuantity to 0 removes the line", () => {
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().setQuantity("prod_001", "M", 0);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("clear empties the cart", () => {
    useCartStore.getState().addItem(item());
    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("subtotal sums unitPrice * quantity", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    useCartStore.getState().addItem(item({ size: "S", quantity: 1 }));
    expect(useCartStore.getState().subtotal()).toBe(89500 * 3);
  });

  it("itemCount sums quantities", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    useCartStore.getState().addItem(item({ size: "S", quantity: 3 }));
    expect(useCartStore.getState().itemCount()).toBe(5);
  });

  it("openDrawer + closeDrawer toggle isOpen", () => {
    useCartStore.getState().openDrawer();
    expect(useCartStore.getState().isOpen).toBe(true);
    useCartStore.getState().closeDrawer();
    expect(useCartStore.getState().isOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/stores/__tests__/cart-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/stores/cart-store.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Size } from "../schemas";

type CartState = {
  items: CartItem[];
  promoCode: string | null;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: Size) => void;
  setQuantity: (productId: string, size: Size, quantity: number) => void;
  setPromoCode: (code: string | null) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      isOpen: false,

      addItem: (incoming) =>
        set((state) => {
          const idx = state.items.findIndex(
            (i) => i.productId === incoming.productId && i.size === incoming.size,
          );
          if (idx >= 0) {
            const next = [...state.items];
            next[idx] = {
              ...next[idx],
              quantity: next[idx].quantity + incoming.quantity,
            };
            return { items: next };
          }
          return { items: [...state.items, incoming] };
        }),

      removeItem: (productId, size) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.size === size),
          ),
        })),

      setQuantity: (productId, size, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (i) => !(i.productId === productId && i.size === size),
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId && i.size === size
                ? { ...i, quantity }
                : i,
            ),
          };
        }),

      setPromoCode: (code) => set({ promoCode: code }),

      clear: () => set({ items: [], promoCode: null }),

      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "ynot-cart",
      partialize: (state) => ({
        items: state.items,
        promoCode: state.promoCode,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/stores/__tests__/cart-store.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/cart-store.ts src/lib/stores/__tests__/cart-store.test.ts
git commit -m "feat(state): add cart Zustand store with localStorage persistence"
```

---

# Section C — Form primitives

For each component below, the standard sequence is:
1. Write a small test (renders + key behaviour),
2. Run it failing,
3. Implement the component,
4. Run, verify pass,
5. Commit.

Tests focus on **behaviour that matters** (form value, callback fires, disabled state, accessible name) — not pixel layout, which we verify visually in `/ui-kit`.

### Task 20: Checkbox

**Files:**
- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/__tests__/checkbox.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/checkbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  it("renders with label and toggles on click", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Accept terms" onChange={onChange} />);
    const cb = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(cb).not.toBeChecked();
    await userEvent.click(cb);
    expect(onChange).toHaveBeenCalled();
  });
  it("respects disabled", async () => {
    render(<Checkbox label="x" disabled />);
    expect(screen.getByRole("checkbox", { name: "x" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/checkbox.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/checkbox.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, error, className, id, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className={cn(
            "flex items-start gap-3 cursor-pointer select-none",
            "text-[13px] leading-snug text-foreground-primary",
            props.disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className={cn(
              "mt-0.5 h-4 w-4 appearance-none border border-border-dark",
              "rounded-none bg-surface-primary",
              "checked:bg-foreground-primary checked:border-foreground-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
              "relative",
              "before:content-[''] before:absolute before:inset-0",
              "checked:before:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M4 8l3 3 5-6%22 stroke=%22white%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] checked:before:bg-no-repeat checked:before:bg-center",
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
          <span>{label}</span>
        </label>
        {error && <p className="text-[12px] text-error pl-7">{error}</p>}
      </div>
    );
  },
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/checkbox.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/checkbox.tsx src/components/ui/__tests__/checkbox.test.tsx
git commit -m "feat(ui): add Checkbox component with label and error states"
```

---

### Task 21: RadioGroup

**Files:**
- Create: `src/components/ui/radio-group.tsx`
- Create: `src/components/ui/__tests__/radio-group.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/radio-group.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup } from "../radio-group";

describe("RadioGroup", () => {
  it("calls onChange with selected value", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="ship"
        value="rm"
        onChange={onChange}
        options={[
          { value: "rm", label: "Royal Mail" },
          { value: "dhl", label: "DHL" },
        ]}
      />,
    );
    await userEvent.click(screen.getByLabelText("DHL"));
    expect(onChange).toHaveBeenCalledWith("dhl");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/radio-group.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/radio-group.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  className,
}: RadioGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="radiogroup">
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "flex items-start gap-3 cursor-pointer p-4 border",
              checked
                ? "border-foreground-primary bg-surface-secondary"
                : "border-border-light bg-surface-primary",
              "transition-colors",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className={cn(
                "mt-0.5 h-4 w-4 appearance-none rounded-full border border-border-dark",
                "checked:bg-foreground-primary checked:border-foreground-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
                "relative",
                "checked:after:content-[''] checked:after:absolute checked:after:inset-1 checked:after:bg-surface-primary checked:after:rounded-full",
              )}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-foreground-primary">
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-[12px] text-foreground-secondary">
                  {opt.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/radio-group.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/radio-group.tsx src/components/ui/__tests__/radio-group.test.tsx
git commit -m "feat(ui): add RadioGroup with optional description per option"
```

---

### Task 22: Select

**Files:**
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/__tests__/select.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/select.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../select";

describe("Select", () => {
  it("renders options and fires onChange", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Country"
        value="GB"
        onChange={onChange}
        options={[
          { value: "GB", label: "United Kingdom" },
          { value: "US", label: "United States" },
        ]}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Country"),
      "US",
    );
    expect(onChange).toHaveBeenCalledWith("US");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/select.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/select.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, value, onChange, options, error, className, id, ...props },
    ref,
  ) {
    const reactId = React.useId();
    const selectId = id ?? reactId;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-[48px] w-full bg-transparent border-b border-border-light px-0 py-3",
            "text-[14px] text-foreground-primary",
            "appearance-none cursor-pointer",
            "focus:outline-none focus:border-foreground-primary",
            "rounded-none",
            error && "border-error focus:border-error",
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/select.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/__tests__/select.test.tsx
git commit -m "feat(ui): add Select component with label and error states"
```

---

### Task 23: Textarea

**Files:**
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/__tests__/textarea.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/textarea.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders with label and accepts input", async () => {
    const onChange = vi.fn();
    render(<Textarea label="Reason" onChange={onChange} />);
    const ta = screen.getByLabelText("Reason");
    await userEvent.type(ta, "Hello");
    expect(onChange).toHaveBeenCalled();
    expect((ta as HTMLTextAreaElement).value).toBe("Hello");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/textarea.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/textarea.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className, id, rows = 4, ...props }, ref) {
    const reactId = React.useId();
    const taId = id ?? reactId;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={taId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full bg-transparent border border-border-light p-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "focus:outline-none focus:border-foreground-primary",
            "rounded-none resize-y",
            error && "border-error focus:border-error",
            className,
          )}
          {...props}
        />
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/textarea.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/textarea.tsx src/components/ui/__tests__/textarea.test.tsx
git commit -m "feat(ui): add Textarea component"
```

---

### Task 24: PasswordInput (with show/hide)

**Files:**
- Create: `src/components/ui/password-input.tsx`
- Create: `src/components/ui/__tests__/password-input.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/password-input.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "../password-input";

describe("PasswordInput", () => {
  it("toggles visibility on button click", async () => {
    render(<PasswordInput label="Password" defaultValue="hunter2" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input.type).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input.type).toBe("password");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/password-input.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/password-input.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, className, id, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-[48px] w-full bg-transparent border-b border-border-light px-0 pr-12 py-3",
              "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
              "focus:outline-none focus:border-foreground-primary rounded-none",
              error && "border-error focus:border-error",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-0 top-1/2 -translate-y-1/2 px-2 text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/password-input.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/password-input.tsx src/components/ui/__tests__/password-input.test.tsx
git commit -m "feat(ui): add PasswordInput with show/hide toggle"
```

---

### Task 25: PhoneInput (with country prefix)

**Files:**
- Create: `src/components/ui/phone-input.tsx`
- Create: `src/components/ui/__tests__/phone-input.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/phone-input.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "../phone-input";

describe("PhoneInput", () => {
  it("emits value with prefix included", async () => {
    const onChange = vi.fn();
    render(<PhoneInput label="Phone" prefix="+44" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Phone");
    await userEvent.type(input, "7700900123");
    // Final call carries the full digit string
    expect(onChange).toHaveBeenLastCalledWith("+44 7700900123");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/phone-input.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/phone-input.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface PhoneInputProps {
  label?: string;
  prefix?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  id?: string;
  className?: string;
}

export function PhoneInput({
  label,
  prefix = "+44",
  value,
  onChange,
  placeholder,
  error,
  id,
  className,
}: PhoneInputProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  // Strip prefix from incoming value to display only the local part
  const local = value.startsWith(prefix)
    ? value.slice(prefix.length).trimStart()
    : value;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center border-b border-border-light",
          "focus-within:border-foreground-primary",
          error && "border-error focus-within:border-error",
        )}
      >
        <span className="pr-3 text-[14px] text-foreground-secondary">
          {prefix}
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={local}
          onChange={(e) =>
            onChange(`${prefix} ${e.target.value.replace(/^\s+/, "")}`)
          }
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-[48px] flex-1 bg-transparent py-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "focus:outline-none rounded-none",
            className,
          )}
        />
      </div>
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/phone-input.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/phone-input.tsx src/components/ui/__tests__/phone-input.test.tsx
git commit -m "feat(ui): add PhoneInput with country prefix"
```

---

### Task 26: QuantityStepper

**Files:**
- Create: `src/components/ui/quantity-stepper.tsx`
- Create: `src/components/ui/__tests__/quantity-stepper.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/quantity-stepper.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityStepper } from "../quantity-stepper";

describe("QuantityStepper", () => {
  it("renders value and increments / decrements", async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} min={1} max={5} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("disables decrease at min", () => {
    render(<QuantityStepper value={1} onChange={() => {}} min={1} max={5} />);
    expect(screen.getByRole("button", { name: /decrease/i })).toBeDisabled();
  });

  it("disables increase at max", () => {
    render(<QuantityStepper value={5} onChange={() => {}} min={1} max={5} />);
    expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/quantity-stepper.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/quantity-stepper.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantityStepperProps) {
  const dec = () => value > min && onChange(value - 1);
  const inc = () => value < max && onChange(value + 1);
  return (
    <div
      className={cn(
        "inline-flex items-center border border-border-light",
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="h-9 w-9 flex items-center justify-center text-foreground-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      <span className="min-w-[36px] text-center text-[13px] tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="h-9 w-9 flex items-center justify-center text-foreground-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/quantity-stepper.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/quantity-stepper.tsx src/components/ui/__tests__/quantity-stepper.test.tsx
git commit -m "feat(ui): add QuantityStepper with min/max bounds"
```

---

### Task 27: SizeSelector

**Files:**
- Create: `src/components/ui/size-selector.tsx`
- Create: `src/components/ui/__tests__/size-selector.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/size-selector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SizeSelector } from "../size-selector";

describe("SizeSelector", () => {
  it("highlights selected and fires onChange", async () => {
    const onChange = vi.fn();
    render(
      <SizeSelector
        sizes={["S", "M", "L"]}
        value="M"
        onChange={onChange}
        stock={{ S: 0, M: 3, L: 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /size m, selected/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /size l/i }));
    expect(onChange).toHaveBeenCalledWith("L");
  });

  it("disables out-of-stock when allowSoldOut is false", () => {
    render(
      <SizeSelector
        sizes={["S", "M", "L"]}
        value="M"
        onChange={() => {}}
        stock={{ S: 0, M: 3, L: 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /size s/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/size-selector.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/size-selector.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";
import type { Size } from "@/lib/schemas";

export interface SizeSelectorProps {
  sizes: Size[];
  value: Size | null;
  onChange: (size: Size) => void;
  stock: Partial<Record<Size, number>>;
  /** When true, sold-out sizes are still selectable (used for pre-order) */
  allowSoldOut?: boolean;
  className?: string;
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  stock,
  allowSoldOut = false,
  className,
}: SizeSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sizes.map((s) => {
        const inStock = (stock[s] ?? 0) > 0;
        const disabled = !inStock && !allowSoldOut;
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={disabled}
            aria-label={`Size ${s}${selected ? ", selected" : ""}${
              !inStock ? ", out of stock" : ""
            }`}
            aria-pressed={selected}
            className={cn(
              "h-11 min-w-11 px-3 border text-[13px] font-medium",
              "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
              selected
                ? "border-foreground-primary bg-foreground-primary text-foreground-inverse"
                : "border-border-dark bg-surface-primary text-foreground-primary hover:border-foreground-primary",
              disabled && "opacity-30 line-through cursor-not-allowed hover:border-border-dark",
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/size-selector.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/size-selector.tsx src/components/ui/__tests__/size-selector.test.tsx
git commit -m "feat(ui): add SizeSelector with stock and sold-out states"
```

---

### Task 28: ColourSwatch

**Files:**
- Create: `src/components/ui/colour-swatch.tsx`
- Create: `src/components/ui/__tests__/colour-swatch.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/colour-swatch.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColourSwatch } from "../colour-swatch";

describe("ColourSwatch", () => {
  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<ColourSwatch name="Chocolate Brown" hex="#3D3428" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /chocolate brown/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/colour-swatch.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/colour-swatch.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface ColourSwatchProps {
  name: string;
  hex: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ColourSwatch({
  name,
  hex,
  selected,
  onClick,
  className,
}: ColourSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}${selected ? ", selected" : ""}`}
      aria-pressed={selected}
      className={cn(
        "h-9 w-9 rounded-full border-2",
        selected ? "border-foreground-primary" : "border-border-light",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
        className,
      )}
      style={{ backgroundColor: hex }}
    />
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/colour-swatch.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/colour-swatch.tsx src/components/ui/__tests__/colour-swatch.test.tsx
git commit -m "feat(ui): add ColourSwatch component"
```

---

### Task 29: IconButton

**Files:**
- Create: `src/components/ui/icon-button.tsx`
- Create: `src/components/ui/__tests__/icon-button.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/icon-button.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "../icon-button";

describe("IconButton", () => {
  it("renders with accessible name and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Open menu" onClick={onClick}>
        <span aria-hidden>≡</span>
      </IconButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/icon-button.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/icon-button.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — there's no visible label */
  "aria-label": string;
  size?: "sm" | "md";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, size = "md", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-none",
          "transition-colors hover:bg-surface-secondary",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
          size === "md" ? "h-10 w-10" : "h-8 w-8",
          className,
        )}
        {...props}
      />
    );
  },
);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/icon-button.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/icon-button.tsx src/components/ui/__tests__/icon-button.test.tsx
git commit -m "feat(ui): add IconButton primitive"
```

---

### Task 30: Skeleton

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/__tests__/skeleton.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders a div with role=status by default", () => {
    const { container } = render(<Skeleton className="h-4 w-12" />);
    expect(container.firstChild).toHaveAttribute("role", "status");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/skeleton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/skeleton.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "bg-border-light/60 animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/skeleton.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/ui/__tests__/skeleton.test.tsx
git commit -m "feat(ui): add Skeleton placeholder"
```

---

### Task 31: CardInput (Stripe stub)

**Files:**
- Create: `src/components/ui/card-input.tsx`
- Create: `src/components/ui/__tests__/card-input.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/card-input.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardInput } from "../card-input";

describe("CardInput (stub)", () => {
  it("emits structured value on change", async () => {
    const onChange = vi.fn();
    render(<CardInput value={{ number: "", expiry: "", cvc: "" }} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/card number/i), "4242424242424242");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.number).toBe("4242424242424242");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/card-input.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/card-input.tsx`:

```tsx
"use client";

import * as React from "react";
import { Input } from "./input";

export interface CardValue {
  number: string;
  expiry: string;
  cvc: string;
}

export interface CardInputProps {
  value: CardValue;
  onChange: (value: CardValue) => void;
}

export function CardInput({ value, onChange }: CardInputProps) {
  const set = <K extends keyof CardValue>(key: K, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="col-span-2">
        <Input
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={value.number}
          onChange={(e) => set("number", e.target.value)}
        />
      </div>
      <Input
        label="Expiry date"
        autoComplete="cc-exp"
        placeholder="MM / YY"
        value={value.expiry}
        onChange={(e) => set("expiry", e.target.value)}
      />
      <Input
        label="CVC"
        inputMode="numeric"
        autoComplete="cc-csc"
        placeholder="123"
        value={value.cvc}
        onChange={(e) => set("cvc", e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/card-input.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/card-input.tsx src/components/ui/__tests__/card-input.test.tsx
git commit -m "feat(ui): add CardInput stub for checkout (replaces with Stripe Elements later)"
```

---

# Section D — Layout primitives

### Task 32: Prose

**Files:**
- Create: `src/components/ui/prose.tsx`

- [ ] **Step 1: Implement (no behavior to test — purely presentational typographic wrapper; visual verification in /ui-kit)**

Create `src/components/ui/prose.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface ProseProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Prose({ className, ...props }: ProseProps) {
  return (
    <div
      className={cn(
        "max-w-prose text-[15px] leading-relaxed text-foreground-primary",
        "[&_h1]:font-heading [&_h1]:text-[36px] [&_h1]:mt-12 [&_h1]:mb-4",
        "[&_h2]:font-heading [&_h2]:text-[28px] [&_h2]:mt-10 [&_h2]:mb-3",
        "[&_h3]:font-heading [&_h3]:text-[20px] [&_h3]:mt-8 [&_h3]:mb-2",
        "[&_p]:mb-4",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4",
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4",
        "[&_li]:mb-1",
        "[&_a]:underline hover:[&_a]:text-foreground-secondary",
        "[&_strong]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/prose.tsx
git commit -m "feat(ui): add Prose typographic wrapper for static page content"
```

---

### Task 33: Section

**Files:**
- Create: `src/components/ui/section.tsx`

- [ ] **Step 1: Implement**

Create `src/components/ui/section.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type SectionPadding = "none" | "sm" | "md" | "lg";
type SectionBackground = "white" | "cream" | "dark";

const padding: Record<SectionPadding, string> = {
  none: "py-0",
  sm: "py-12",
  md: "py-16 md:py-20",
  lg: "py-24 md:py-32",
};

const background: Record<SectionBackground, string> = {
  white: "bg-surface-primary text-foreground-primary",
  cream: "bg-surface-secondary text-foreground-on-cream",
  dark: "bg-surface-dark text-foreground-inverse",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  padding?: SectionPadding;
  background?: SectionBackground;
}

export function Section({
  className,
  padding: p = "md",
  background: b = "white",
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(padding[p], background[b], className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/section.tsx
git commit -m "feat(ui): add Section wrapper with padding and background variants"
```

---

### Task 34: Grid

**Files:**
- Create: `src/components/ui/grid.tsx`

- [ ] **Step 1: Implement**

Create `src/components/ui/grid.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
  /** Mobile cols override (default 1 for cols 2-4, 1 for cols 1) */
  mobileCols?: 1 | 2;
  gap?: "sm" | "md" | "lg";
}

const colMap = {
  1: "grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const mobileMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};

const gapMap = {
  sm: "gap-3",
  md: "gap-6",
  lg: "gap-8 md:gap-10",
};

export function Grid({
  cols = 4,
  mobileCols = 2,
  gap = "md",
  className,
  ...props
}: GridProps) {
  return (
    <div
      className={cn("grid", mobileMap[mobileCols], colMap[cols], gapMap[gap], className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/grid.tsx
git commit -m "feat(ui): add Grid layout primitive (responsive cols + gap)"
```

---

### Task 35: PageShell

**Files:**
- Create: `src/components/page-shell.tsx`

- [ ] **Step 1: Implement**

Create `src/components/page-shell.tsx`:

```tsx
import * as React from "react";
import { AnnouncementBar } from "./announcement-bar";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export interface PageShellProps {
  children: React.ReactNode;
  /** When true, header starts transparent over a hero. */
  overHero?: boolean;
  /** Hides AnnouncementBar (e.g. checkout flow). */
  hideAnnouncement?: boolean;
  /** Hides SiteFooter (rare). */
  hideFooter?: boolean;
  /** Hides full SiteHeader and replaces with a minimal one (passed in). */
  header?: React.ReactNode;
}

export function PageShell({
  children,
  overHero,
  hideAnnouncement,
  hideFooter,
  header,
}: PageShellProps) {
  return (
    <>
      {!hideAnnouncement && <AnnouncementBar />}
      {header ?? <SiteHeader overHero={overHero} />}
      <main className="flex-1">{children}</main>
      {!hideFooter && <SiteFooter />}
    </>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/page-shell.tsx
git commit -m "feat(layout): add PageShell wrapper for chrome composition"
```

---

# Section E — Overlay primitives

### Task 36: Drawer base

**Files:**
- Create: `src/components/ui/drawer.tsx`
- Create: `src/components/ui/__tests__/drawer.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Drawer } from "../drawer";

describe("Drawer", () => {
  it("renders content when open and not when closed", () => {
    const { rerender } = render(
      <Drawer open={false} onClose={() => {}} side="right" title="Cart">
        <p>Items here</p>
      </Drawer>,
    );
    expect(screen.queryByText("Items here")).toBeNull();

    rerender(
      <Drawer open onClose={() => {}} side="right" title="Cart">
        <p>Items here</p>
      </Drawer>,
    );
    expect(screen.getByText("Items here")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop clicked", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/drawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/drawer.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "../icons";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  /** Hides the visible title heading but keeps it for screen readers. */
  hideTitle?: boolean;
  width?: string;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  side,
  title,
  hideTitle,
  width = "min(420px, 100vw)",
  children,
}: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        data-testid="drawer-backdrop"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute top-0 bottom-0 bg-surface-primary text-foreground-primary",
          "flex flex-col",
          side === "left" ? "left-0" : "right-0",
        )}
        style={{ width }}
      >
        <header className="flex items-center justify-between p-5 border-b border-border-light">
          <h2
            className={cn(
              "text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-primary",
              hideTitle && "sr-only",
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 -mr-2 flex items-center justify-center hover:bg-surface-secondary"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/drawer.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/drawer.tsx src/components/ui/__tests__/drawer.test.tsx
git commit -m "feat(ui): add Drawer primitive (backdrop, escape, scroll lock)"
```

---

### Task 37: Modal/Dialog

**Files:**
- Create: `src/components/ui/modal.tsx`
- Create: `src/components/ui/__tests__/modal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../modal";

describe("Modal", () => {
  it("shows when open and dismisses on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/modal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/modal.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "../icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "min(440px, 90vw)",
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative bg-surface-primary text-foreground-primary p-6",
          "border border-border-light",
        )}
        style={{ width }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-9 w-9 flex items-center justify-center hover:bg-surface-secondary"
        >
          <CloseIcon />
        </button>
        <h2 className="text-[16px] font-semibold uppercase tracking-[0.15em] mb-4 pr-10">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/modal.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/modal.tsx src/components/ui/__tests__/modal.test.tsx
git commit -m "feat(ui): add Modal/Dialog primitive"
```

---

### Task 38: Toast (with provider)

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/__tests__/toast.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/toast.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../toast";

function Trigger() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show("Saved!")}>
      Save
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast when show() is called", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved!")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/toast.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/toast.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface ToastEntry {
  id: number;
  text: string;
}

interface ToastContextValue {
  show: (text: string, durationMs?: number) => void;
}

const Ctx = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const show = React.useCallback((text: string, durationMs = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "bg-foreground-primary text-foreground-inverse px-4 py-3",
              "text-[13px] tracking-wide",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/toast.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/__tests__/toast.test.tsx
git commit -m "feat(ui): add Toast provider with auto-dismiss"
```

---

### Task 39: Tabs

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/__tests__/tabs.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/tabs.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "../tabs";

describe("Tabs", () => {
  it("renders the active tab content and switches on click", async () => {
    render(
      <Tabs
        defaultValue="a"
        items={[
          { value: "a", label: "First", content: <p>panel A</p> },
          { value: "b", label: "Second", content: <p>panel B</p> },
        ]}
      />,
    );
    expect(screen.getByText("panel A")).toBeInTheDocument();
    expect(screen.queryByText("panel B")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Second" }));
    expect(screen.getByText("panel B")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/tabs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/tabs.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
}: TabsProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(
    defaultValue ?? items[0]?.value,
  );
  const active = isControlled ? value! : internal;

  const setActive = (v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-6 border-b border-border-light">
        {items.map((it) => {
          const selected = it.value === active;
          return (
            <button
              key={it.value}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setActive(it.value)}
              className={cn(
                "py-3 text-[12px] font-semibold uppercase tracking-[0.2em]",
                "border-b-2 -mb-px transition-colors",
                selected
                  ? "border-foreground-primary text-foreground-primary"
                  : "border-transparent text-foreground-secondary hover:text-foreground-primary",
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6">
        {items.find((it) => it.value === active)?.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/tabs.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/tabs.tsx src/components/ui/__tests__/tabs.test.tsx
git commit -m "feat(ui): add Tabs component (controlled + uncontrolled)"
```

---

### Task 40: Accordion

**Files:**
- Create: `src/components/ui/accordion.tsx`
- Create: `src/components/ui/__tests__/accordion.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/__tests__/accordion.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "../accordion";

describe("Accordion", () => {
  it("expands and collapses on click", async () => {
    render(
      <Accordion
        items={[
          { value: "a", title: "Description", content: <p>desc body</p> },
          { value: "b", title: "Materials", content: <p>mat body</p> },
        ]}
      />,
    );
    expect(screen.queryByText("desc body")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Description" }));
    expect(screen.getByText("desc body")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Description" }));
    expect(screen.queryByText("desc body")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/ui/__tests__/accordion.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/ui/accordion.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface AccordionItem {
  value: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** When true, multiple items can be open at once. Default false. */
  multiple?: boolean;
  className?: string;
}

export function Accordion({
  items,
  multiple = false,
  className,
}: AccordionProps) {
  const [open, setOpen] = React.useState<string[]>([]);

  const toggle = (value: string) => {
    setOpen((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (multiple) return [...prev, value];
      return [value];
    });
  };

  return (
    <div className={cn("border-t border-border-light", className)}>
      {items.map((it) => {
        const isOpen = open.includes(it.value);
        return (
          <div key={it.value} className="border-b border-border-light">
            <button
              type="button"
              onClick={() => toggle(it.value)}
              aria-expanded={isOpen}
              className={cn(
                "w-full flex items-center justify-between py-5",
                "text-left text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-primary",
              )}
            >
              <span>{it.title}</span>
              <span aria-hidden className="text-[18px] font-light">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen && (
              <div className="pb-5 text-[14px] leading-relaxed text-foreground-secondary">
                {it.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/ui/__tests__/accordion.test.tsx`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/accordion.tsx src/components/ui/__tests__/accordion.test.tsx
git commit -m "feat(ui): add Accordion (single/multi expand)"
```

---

### Task 41: WhatsAppWidget

**Files:**
- Create: `src/components/whatsapp-widget.tsx`

- [ ] **Step 1: Implement (purely presentational link)**

Create `src/components/whatsapp-widget.tsx`:

```tsx
import * as React from "react";
import { WhatsAppIcon } from "./icons";
import { cn } from "@/lib/cn";

export interface WhatsAppWidgetProps {
  phone: string;
  message?: string;
  className?: string;
}

export function WhatsAppWidget({
  phone,
  message,
  className,
}: WhatsAppWidgetProps) {
  const href = `https://wa.me/${phone.replace(/[^0-9]/g, "")}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "h-14 w-14 rounded-full bg-[#25D366] text-white",
        "flex items-center justify-center shadow-lg",
        "hover:scale-105 transition-transform",
        className,
      )}
    >
      <WhatsAppIcon />
    </a>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-widget.tsx
git commit -m "feat(layout): add WhatsAppWidget floating contact button"
```

---

# Section F — `/ui-kit` showcase update

### Task 42: Update /ui-kit with all new primitives

**Files:**
- Modify: `src/app/ui-kit/page.tsx`

- [ ] **Step 1: Read current showcase**

Run: `cat src/app/ui-kit/page.tsx | head -40`
Expected: confirms current structure.

- [ ] **Step 2: Add a new "Form primitives" section**

In `src/app/ui-kit/page.tsx`, add the following imports near the top:

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { SizeSelector } from "@/components/ui/size-selector";
import { ColourSwatch } from "@/components/ui/colour-swatch";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardInput } from "@/components/ui/card-input";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { Grid } from "@/components/ui/grid";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { MenuIcon, BagIcon } from "@/components/icons";
```

- [ ] **Step 3: Convert to client component for stateful demos**

Mark the file `"use client"` at the top (it currently has `metadata` which is server-only). Move the `metadata` export into a sibling `layout.tsx` file. Specifically:

Create `src/app/ui-kit/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI Kit · YNOT London",
};

export default function UIKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Then in `src/app/ui-kit/page.tsx`:
- Add `"use client";` as the first line
- Remove the existing `export const metadata = { ... };` block (now lives in layout)

- [ ] **Step 4: Add stateful demo wrappers**

In `src/app/ui-kit/page.tsx`, add these helper components inside the file (after imports, before the main `UIKitPage` function):

```tsx
import * as React from "react";

function CheckboxDemo() {
  const [v, setV] = React.useState(false);
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Checkbox label="I agree to the Terms & Conditions" checked={v} onChange={(e) => setV(e.target.checked)} />
      <Checkbox label="Subscribe to newsletter" defaultChecked />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="With error" error="This field is required" />
    </div>
  );
}

function RadioDemo() {
  const [v, setV] = React.useState("rm");
  return (
    <div className="max-w-md">
      <RadioGroup
        name="ship"
        value={v}
        onChange={setV}
        options={[
          { value: "rm", label: "Royal Mail — Free", description: "2–3 business days" },
          { value: "dhl", label: "DHL Worldwide — Free", description: "8–10 business days" },
        ]}
      />
    </div>
  );
}

function SelectDemo() {
  const [v, setV] = React.useState("GB");
  return (
    <div className="max-w-sm">
      <Select
        label="Country"
        value={v}
        onChange={setV}
        options={[
          { value: "GB", label: "United Kingdom" },
          { value: "US", label: "United States" },
          { value: "FR", label: "France" },
          { value: "DE", label: "Germany" },
        ]}
      />
    </div>
  );
}

function PhoneDemo() {
  const [v, setV] = React.useState("");
  return (
    <div className="max-w-sm">
      <PhoneInput label="Phone" value={v} onChange={setV} placeholder="7700 900123" />
    </div>
  );
}

function QtyDemo() {
  const [v, setV] = React.useState(1);
  return <QuantityStepper value={v} onChange={setV} max={10} />;
}

function SizeDemo() {
  const [v, setV] = React.useState<"S" | "M" | "L">("M");
  return (
    <SizeSelector
      sizes={["S", "M", "L"]}
      value={v}
      onChange={(s) => setV(s as "S" | "M" | "L")}
      stock={{ S: 0, M: 3, L: 1 }}
    />
  );
}

function CardDemo() {
  const [v, setV] = React.useState({ number: "", expiry: "", cvc: "" });
  return (
    <div className="max-w-md">
      <CardInput value={v} onChange={setV} />
    </div>
  );
}

function DrawerDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open right drawer
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} side="right" title="Cart">
        <div className="p-5">Drawer content goes here.</div>
      </Drawer>
    </>
  );
}

function ModalDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
        <p className="text-[14px] text-foreground-secondary">Are you sure you want to delete this address?</p>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} size="md">Cancel</Button>
          <Button onClick={() => setOpen(false)} size="md">Confirm</Button>
        </div>
      </Modal>
    </>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <Button variant="outline" onClick={() => show("Promo code applied")}>
      Show toast
    </Button>
  );
}
```

- [ ] **Step 5: Add showcase sections**

Inside the `UIKitPage` return JSX, add these new `<Section>` blocks after the existing "Brand block" section:

```tsx
<Section title="New form primitives" caption="Form inputs added in Phase 1.">
  <div className="grid gap-12 md:grid-cols-2">
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Checkbox</h4>
      <CheckboxDemo />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">RadioGroup</h4>
      <RadioDemo />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Select</h4>
      <SelectDemo />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Textarea</h4>
      <Textarea label="Reason for return" placeholder="Tell us why" />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">PasswordInput</h4>
      <PasswordInput label="Password" placeholder="••••••••" />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">PhoneInput</h4>
      <PhoneDemo />
    </div>
  </div>
</Section>

<Section title="Commerce primitives" caption="QuantityStepper, SizeSelector, ColourSwatch, CardInput.">
  <div className="grid gap-12 md:grid-cols-2">
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">QuantityStepper</h4>
      <QtyDemo />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">SizeSelector</h4>
      <SizeDemo />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">ColourSwatch</h4>
      <div className="flex gap-3">
        <ColourSwatch name="Chocolate Brown" hex="#3D3428" selected />
        <ColourSwatch name="Cream" hex="#F5F0EB" />
        <ColourSwatch name="Black" hex="#1A1A1A" />
      </div>
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">CardInput (stub)</h4>
      <CardDemo />
    </div>
  </div>
</Section>

<Section title="Layout primitives" caption="Section, Grid, Skeleton, IconButton, WhatsAppWidget, Prose.">
  <div className="space-y-12">
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">IconButton</h4>
      <div className="flex gap-2">
        <IconButton aria-label="Open menu"><MenuIcon /></IconButton>
        <IconButton aria-label="Open bag"><BagIcon /></IconButton>
      </div>
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Skeleton</h4>
      <div className="space-y-2 max-w-sm">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Grid (4-col / 2-col mobile)</h4>
      <Grid cols={4} mobileCols={2}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="aspect-square bg-surface-secondary flex items-center justify-center">
            {n}
          </div>
        ))}
      </Grid>
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Prose</h4>
      <Prose>
        <h2>Heading two</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse euismod, leo nec consectetur ornare.</p>
        <ul>
          <li>List item one</li>
          <li>List item two</li>
        </ul>
      </Prose>
    </div>
  </div>
</Section>

<Section title="Overlays" caption="Drawer, Modal, Toast — try them out.">
  <div className="flex flex-wrap gap-4">
    <DrawerDemo />
    <ModalDemo />
    <ToastDemo />
  </div>
</Section>

<Section title="Tabs and Accordion">
  <div className="grid gap-12 md:grid-cols-2">
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Tabs</h4>
      <Tabs
        items={[
          { value: "delivery", label: "Delivery", content: <p className="text-[14px]">UK 2–3 days · Worldwide 8–10 days. All free.</p> },
          { value: "returns", label: "Returns", content: <p className="text-[14px]">14 days unworn, free returns.</p> },
        ]}
      />
    </div>
    <div>
      <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">Accordion</h4>
      <Accordion
        items={[
          { value: "desc", title: "Description", content: "A timeless field jacket." },
          { value: "mat", title: "Materials", content: "100% Italian suede." },
          { value: "care", title: "Care", content: "Dry clean only." },
        ]}
      />
    </div>
  </div>
</Section>
```

- [ ] **Step 6: Wrap UIKitPage in ToastProvider**

In `src/app/ui-kit/page.tsx`, change the default export to wrap the entire page in `<ToastProvider>`:

```tsx
export default function UIKitPageWrapper() {
  return (
    <ToastProvider>
      <UIKitPage />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </ToastProvider>
  );
}
```

(Rename the original `UIKitPage` accordingly if it was `default export function UIKitPage()`.)

- [ ] **Step 7: Build and run dev server**

```bash
pnpm build
```
Expected: build succeeds.

```bash
pnpm dev
```
(Run in background; verify in browser at `http://localhost:3000/ui-kit`.)

- [ ] **Step 8: Visual verification checklist**

Open `http://localhost:3000/ui-kit` and confirm:
- [ ] Existing sections (typography, colours, buttons, form fields, product cards, brand block) still render
- [ ] New "Form primitives" section: Checkbox toggles; Radio shows two cards; Select dropdown; Textarea types; Password show/hide works; Phone shows +44 prefix
- [ ] "Commerce primitives": Stepper +/- works; SizeSelector S is sold-out (line-through, disabled); Colours; CardInput
- [ ] "Layout primitives": IconButtons render; Skeleton bars pulse; Grid shows 4 squares (2 on mobile); Prose renders headings/lists
- [ ] "Overlays": Drawer slides in (instant — no animation per spec); Modal opens with overlay; Toast appears bottom-center for 3s
- [ ] "Tabs and Accordion": Tab switches; Accordion expands/collapses
- [ ] WhatsApp green button is fixed bottom-right

- [ ] **Step 9: Commit**

```bash
git add src/app/ui-kit/page.tsx src/app/ui-kit/layout.tsx
git commit -m "feat(ui-kit): showcase all Phase 1 primitives (forms, layout, overlays)"
```

---

# Section G — Verification gate

### Task 43: Run all tests + build + lint

**Files:** none modified.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: build succeeds, no TS errors, no warnings.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no errors. (Warnings allowed but should be reviewed.)

- [ ] **Step 4: Tag the commit**

```bash
git tag phase-1-foundation-complete
git log --oneline -1
```
Expected: shows the tag was created.

---

## Self-Review (executor: do this before claiming the plan complete)

1. **Spec coverage** — does Phase 1 cover everything claimed?
   - ✅ Vitest + testing setup (Tasks 1-2)
   - ✅ Zod schemas for all entities (Tasks 4-9)
   - ✅ Mock JSON fixtures with validation (Tasks 10-13)
   - ✅ Data adapters: products, categories, content, search, orders (Tasks 14-18)
   - ✅ Cart Zustand store with persistence (Task 19)
   - ✅ Form primitives: Checkbox, RadioGroup, Select, Textarea, PasswordInput, PhoneInput, QuantityStepper, SizeSelector, ColourSwatch, IconButton, Skeleton, CardInput (Tasks 20-31)
   - ✅ Layout primitives: Prose, Section, Grid, PageShell (Tasks 32-35)
   - ✅ Overlay primitives: Drawer, Modal, Toast, Tabs, Accordion, WhatsAppWidget (Tasks 36-41)
   - ✅ /ui-kit showcase update (Task 42)
   - ✅ Verification gate (Task 43)

2. **Out of scope reminders**: this plan does NOT include — chrome wiring (header buttons triggering drawers), homepage blocks, catalog pages, commerce pages, account pages, static pages, returns flow, animations. All deferred to Phase 2+.

3. **Type consistency**: schemas exported from `@/lib/schemas` barrel, used in adapters, store and components. `Size` enum used consistently in product/cart/store/SizeSelector. `Cart` shape matches store state shape (items + promoCode + currency).

4. **Plan size**: 43 tasks, ~5 steps each = ~215 steps. Big but each step is mechanical and 2-5 minutes. Total estimated time: 8-12 hours of focused execution.

---

## Execution Handoff

**Plan complete and saved to `web/docs/superpowers/plans/2026-04-26-ynot-storefront-phase-1-foundation.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task; you can review between tasks; faster iteration; better isolation per task.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`; batch execution with checkpoints for review; lower overhead.

**Which approach?**
