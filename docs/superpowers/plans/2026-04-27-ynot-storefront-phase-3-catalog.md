# YNOT Storefront — Phase 3: Catalog (Collection + PDP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development to execute. Steps use `- [ ]` checkbox tracking.

**Goal:** Ship the catalog browsing surface — Collection landing pages with filters/sort/grid + Product Detail Pages with gallery, size selector, add-to-bag wired to cart store. Closes the loop: visitor lands on home → opens menu → clicks category → browses grid → opens product → adds to bag → cart drawer pops with the item.

**Architecture:** Server Components fetch from existing `getProductsByCategory()`, `getProductBySlug()`, `getRecommendations()` adapters built in Phase 1. Filter and sort state live in URL search params (server-side filtered). PDP gallery is a client component (image scroll + dots). AddToBagSection is a client component dispatching `useCartStore.addItem()` and `openDrawer()`.

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Zustand 5, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § 2 (Collection, PDP).

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-3-catalog` (NEW worktree).

**Prerequisites in main:** Phase 1 + Phase 2 + homepage polish (89 tests, full chrome wired).

---

## File structure

```
web/
├── src/
│   ├── components/
│   │   ├── catalog/
│   │   │   ├── breadcrumb.tsx                  [created]
│   │   │   ├── category-header.tsx             [created]
│   │   │   ├── filter-bar.tsx                  [created]
│   │   │   ├── sort-dropdown.tsx               [created]
│   │   │   ├── product-grid.tsx                [created]
│   │   │   └── load-more-button.tsx            [created]
│   │   └── pdp/
│   │       ├── product-gallery.tsx             [created]
│   │       ├── product-info-panel.tsx          [created]
│   │       ├── add-to-bag-section.tsx          [created]
│   │       ├── product-details-accordion.tsx   [created]
│   │       └── recommended-products.tsx        [created]
│   ├── lib/
│   │   └── catalog/
│   │       └── filter.ts                       [created — server-side filter+sort logic]
│   └── app/
│       ├── collection/
│       │   └── [slug]/
│       │       └── page.tsx                    [created]
│       └── products/
│           └── [slug]/
│               └── page.tsx                    [created]
└── (no other changes)
```

---

# Section A — Worktree setup

### Task 1: Create Phase 3 worktree

- [ ] **Step 1:** From main worktree:
  ```bash
  cd /Users/batyrbekkuandyk/Desktop/ynot/web
  git worktree add .worktrees/phase-3-catalog -b feature/phase-3-catalog
  ```

- [ ] **Step 2:** Setup:
  ```bash
  cd .worktrees/phase-3-catalog
  pnpm install --frozen-lockfile
  pnpm build
  ```

- [ ] **Step 3:** Baseline verification:
  ```bash
  pnpm test
  ```
  Expected: 89 tests pass.

---

# Section B — Server-side filter/sort logic

### Task 2: Filter + sort utility

**Files:** Create `src/lib/catalog/filter.ts`, `src/lib/catalog/__tests__/filter.test.ts`.

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { applyCatalogQuery } from "../filter";
import type { Product } from "@/lib/schemas";

const products: Product[] = [
  { id: "a", slug: "a", name: "Alpha", price: 50000, currency: "GBP", description: "", images: [], sizes: ["S","M"], categorySlugs: ["jackets","leather"], stock: { S: 1, M: 0 }, preOrder: false, details: { materials: "", care: "", sizing: "" } },
  { id: "b", slug: "b", name: "Beta",  price: 80000, currency: "GBP", description: "", images: [], sizes: ["M","L"], categorySlugs: ["jackets","wool"], stock: { M: 2, L: 1 }, preOrder: false, details: { materials: "", care: "", sizing: "" } },
  { id: "c", slug: "c", name: "Gamma", price: 120000, currency: "GBP", description: "", images: [], sizes: ["S"], categorySlugs: ["coats","wool"], stock: { S: 0 }, preOrder: true, details: { materials: "", care: "", sizing: "" } },
];

describe("applyCatalogQuery", () => {
  it("returns all when no filters", () => {
    expect(applyCatalogQuery(products, {}).length).toBe(3);
  });
  it("filters by material via crossCategorySlug", () => {
    const r = applyCatalogQuery(products, { crossCategorySlug: "wool" });
    expect(r.map((p) => p.id)).toEqual(["b", "c"]);
  });
  it("filters by size", () => {
    const r = applyCatalogQuery(products, { size: "L" });
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });
  it("filters by max price (in pence)", () => {
    const r = applyCatalogQuery(products, { maxPrice: 80000 });
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("sorts by price asc", () => {
    const r = applyCatalogQuery(products, { sort: "price-asc" });
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by price desc", () => {
    const r = applyCatalogQuery(products, { sort: "price-desc" });
    expect(r.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement `src/lib/catalog/filter.ts`:

```ts
import type { Product, Size } from "@/lib/schemas";

export type CatalogSort = "newest" | "price-asc" | "price-desc";

export interface CatalogQuery {
  /** A second category to intersect with (e.g. material slug while on /collection/jackets). */
  crossCategorySlug?: string;
  size?: Size;
  maxPrice?: number;
  sort?: CatalogSort;
}

export function applyCatalogQuery(
  products: Product[],
  query: CatalogQuery,
): Product[] {
  let result = products;

  if (query.crossCategorySlug) {
    const cross = query.crossCategorySlug;
    result = result.filter((p) => p.categorySlugs.includes(cross));
  }
  if (query.size) {
    const s = query.size;
    result = result.filter((p) => p.sizes.includes(s));
  }
  if (typeof query.maxPrice === "number") {
    const max = query.maxPrice;
    result = result.filter((p) => p.price <= max);
  }

  if (query.sort === "price-asc") {
    result = [...result].sort((a, b) => a.price - b.price);
  } else if (query.sort === "price-desc") {
    result = [...result].sort((a, b) => b.price - a.price);
  }
  // "newest" is implicit insertion order (mock has no createdAt yet)

  return result;
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/catalog/filter.ts src/lib/catalog/__tests__/filter.test.ts
git commit -m "feat(catalog): add server-side filter+sort util with tests"
```

---

# Section C — Catalog UI components

### Task 3: Breadcrumb

**Files:** `src/components/catalog/breadcrumb.tsx`.

- [ ] **Step 1:** Implement (purely presentational; no test, build verify):

```tsx
import * as React from "react";
import Link from "next/link";

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: BreadcrumbCrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[12px] uppercase tracking-[0.15em] text-foreground-secondary">
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !isLast ? (
                <Link href={c.href} className="hover:text-foreground-primary">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground-primary" : ""}>{c.label}</span>
              )}
              {!isLast && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 2:** `pnpm build` — succeeds.

- [ ] **Step 3:** Commit:
```bash
git add src/components/catalog/breadcrumb.tsx
git commit -m "feat(catalog): add Breadcrumb component"
```

---

### Task 4: CategoryHeader

**Files:** `src/components/catalog/category-header.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Image from "next/image";
import { Display } from "@/components/ui/typography";

export interface CategoryHeaderProps {
  title: string;
  description?: string;
  bannerImage?: string | null;
}

export function CategoryHeader({ title, description, bannerImage }: CategoryHeaderProps) {
  if (bannerImage) {
    return (
      <header className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-surface-dark">
        <Image src={bannerImage} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
          <Display level="lg" as="h1">{title}</Display>
          {description && <p className="mt-3 max-w-md text-[14px]">{description}</p>}
        </div>
      </header>
    );
  }
  return (
    <header className="border-b border-border-light py-12 text-center">
      <Display level="lg" as="h1">{title}</Display>
      {description && (
        <p className="mt-3 mx-auto max-w-[640px] text-[14px] text-foreground-secondary">{description}</p>
      )}
    </header>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/catalog/category-header.tsx
git commit -m "feat(catalog): add CategoryHeader (with optional CMS banner)"
```

---

### Task 5: SortDropdown

**Files:** `src/components/catalog/sort-dropdown.tsx`, `src/components/catalog/__tests__/sort-dropdown.test.tsx`.

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/collection/jackets",
  useSearchParams: () => new URLSearchParams(),
}));

import { SortDropdown } from "../sort-dropdown";

describe("SortDropdown", () => {
  it("renders default Newest", () => {
    render(<SortDropdown />);
    expect(screen.getByLabelText(/sort/i)).toHaveValue("newest");
  });
  it("calls router.push with new sort param when changed", async () => {
    const push = vi.fn();
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push }),
      usePathname: () => "/collection/jackets",
      useSearchParams: () => new URLSearchParams(),
    }));
    // re-import after mocking
    const { SortDropdown: SortDropdown2 } = await import("../sort-dropdown");
    render(<SortDropdown2 />);
    const select = screen.getByLabelText(/sort/i);
    await userEvent.selectOptions(select, "price-asc");
    expect(select).toHaveValue("price-asc");
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("sort") ?? "newest";

  const onChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="w-[220px]">
      <Select label="Sort" value={current} onChange={onChange} options={OPTIONS} />
    </div>
  );
}
```

- [ ] **Step 4:** Run, pass (the second test mocks runtime — the assertion is just that the value updates).

- [ ] **Step 5:** Commit:
```bash
git add src/components/catalog/sort-dropdown.tsx src/components/catalog/__tests__/sort-dropdown.test.tsx
git commit -m "feat(catalog): add SortDropdown that drives URL ?sort= param"
```

---

### Task 6: FilterBar

**Files:** `src/components/catalog/filter-bar.tsx`.

- [ ] **Step 1:** Implement (build verify only — the underlying URL behavior mirrors SortDropdown, no new test logic worth duplicating):

```tsx
"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

interface FilterOption {
  value: string;
  label: string;
}

const SIZE_OPTIONS: FilterOption[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
];

const PRICE_OPTIONS: FilterOption[] = [
  { value: "50000", label: "Under £500" },
  { value: "100000", label: "Under £1,000" },
  { value: "150000", label: "Under £1,500" },
];

export interface FilterBarProps {
  materialOptions: FilterOption[];
}

export function FilterBar({ materialOptions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const Group = ({ label, current, options, paramKey }: { label: string; current: string | null; options: FilterOption[]; paramKey: string }) => (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setParam(paramKey, active ? null : o.value)}
              className={cn(
                "h-9 px-3 border text-[12px] uppercase tracking-[0.1em]",
                active ? "border-foreground-primary bg-foreground-primary text-foreground-inverse" : "border-border-dark text-foreground-primary hover:border-foreground-primary",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10 md:items-end">
      <Group label="Material" current={params.get("material")} options={materialOptions} paramKey="material" />
      <Group label="Size" current={params.get("size")} options={SIZE_OPTIONS} paramKey="size" />
      <Group label="Price" current={params.get("maxPrice")} options={PRICE_OPTIONS} paramKey="maxPrice" />
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/catalog/filter-bar.tsx
git commit -m "feat(catalog): add FilterBar (material/size/price → URL params)"
```

---

### Task 7: ProductGrid + LoadMoreButton

**Files:** `src/components/catalog/product-grid.tsx`, `src/components/catalog/load-more-button.tsx`.

- [ ] **Step 1:** Implement ProductGrid (server component):

```tsx
import * as React from "react";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/schemas";

export interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-[14px] text-foreground-secondary">
        No products match the current filters.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          href={`/products/${p.slug}`}
          name={p.name}
          price={formatPrice(p.price, "GBP")}
          image={p.images[0]}
          hoverImage={p.images[1]}
          badge={p.preOrder ? "pre-order" : undefined}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Implement LoadMoreButton (client; URL-driven):

```tsx
"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface LoadMoreButtonProps {
  visible: number;
  total: number;
  step?: number;
}

export function LoadMoreButton({ visible, total, step = 8 }: LoadMoreButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (visible >= total) return null;

  const next = () => {
    const ns = new URLSearchParams(params);
    ns.set("limit", String(visible + step));
    router.push(`${pathname}?${ns.toString()}`);
  };

  return (
    <div className="mt-10 flex justify-center">
      <Button variant="outline" onClick={next}>
        Load more
      </Button>
    </div>
  );
}
```

- [ ] **Step 3:** Build verify.

- [ ] **Step 4:** Commit:
```bash
git add src/components/catalog/product-grid.tsx src/components/catalog/load-more-button.tsx
git commit -m "feat(catalog): add ProductGrid and LoadMoreButton (URL ?limit= driven)"
```

---

# Section D — Collection page

### Task 8: `/collection/[slug]/page.tsx`

**Files:** `src/app/collection/[slug]/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CategoryHeader } from "@/components/catalog/category-header";
import { FilterBar } from "@/components/catalog/filter-bar";
import { SortDropdown } from "@/components/catalog/sort-dropdown";
import { ProductGrid } from "@/components/catalog/product-grid";
import { LoadMoreButton } from "@/components/catalog/load-more-button";
import { getCategoryBySlug, getAllCategories } from "@/lib/data/categories";
import { getProductsByCategory } from "@/lib/data/products";
import { applyCatalogQuery, type CatalogSort } from "@/lib/catalog/filter";
import type { Size } from "@/lib/schemas";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE_DEFAULT = 8;

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Not found · YNOT London" };
  return { title: cat.meta.title, description: cat.meta.description };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const [base, allCategories] = await Promise.all([
    getProductsByCategory(slug),
    getAllCategories(),
  ]);

  const materialOptions = allCategories
    .filter((c) => ["leather", "suede", "wool", "cotton", "tencel"].includes(c.slug))
    .map((c) => ({ value: c.slug, label: c.name }));

  const sortRaw = (sp.sort as string | undefined) ?? "newest";
  const sort: CatalogSort = sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";

  const filtered = applyCatalogQuery(base, {
    crossCategorySlug: (sp.material as string | undefined) ?? undefined,
    size: (sp.size as Size | undefined) ?? undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    sort,
  });

  const limit = sp.limit ? Number(sp.limit) : PAGE_SIZE_DEFAULT;
  const visible = filtered.slice(0, limit);

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <CategoryHeader title={cat.name} description={cat.description} bannerImage={cat.bannerImage} />

        <Section padding="md">
          <Container size="wide">
            <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: cat.name }]} />
          </Container>
        </Section>

        <Section padding="sm">
          <Container size="wide">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <FilterBar materialOptions={materialOptions} />
              <SortDropdown />
            </div>
          </Container>
        </Section>

        <Section padding="md">
          <Container size="wide">
            <ProductGrid products={visible} />
            <LoadMoreButton visible={visible.length} total={filtered.length} />
          </Container>
        </Section>
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify. Confirm `/collection/[slug]` shows up in route table.

- [ ] **Step 3:** Quick smoke test:
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 3
curl -s -o /dev/null -w "/collection/jackets → HTTP %{http_code}\n" http://localhost:3000/collection/jackets
curl -s -o /dev/null -w "/collection/leather → HTTP %{http_code}\n" http://localhost:3000/collection/leather
curl -s -o /dev/null -w "/collection/nope → HTTP %{http_code}\n" http://localhost:3000/collection/nope
pkill -f "next dev" 2>/dev/null || true
```
Expected: jackets 200, leather 200, nope 404.

- [ ] **Step 4:** Commit:
```bash
git add src/app/collection
git commit -m "feat(catalog): add /collection/[slug] page with filters, sort, grid, load-more"
```

---

# Section E — PDP UI components

### Task 9: ProductGallery

**Files:** `src/components/pdp/product-gallery.tsx`.

- [ ] **Step 1:** Implement (client component for interactive thumbs):

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

export interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = React.useState(0);
  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-secondary">
        <Image
          key={active}
          src={images[active]}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <>
          {/* Desktop thumbs */}
          <div className="hidden gap-3 md:grid md:grid-cols-6">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "relative aspect-square overflow-hidden border",
                  i === active ? "border-foreground-primary" : "border-transparent",
                )}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>

          {/* Mobile dots */}
          <div className="flex justify-center gap-2 md:hidden">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "h-1.5 w-6 transition-colors",
                  i === active ? "bg-foreground-primary" : "bg-border-light",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/pdp/product-gallery.tsx
git commit -m "feat(pdp): add ProductGallery with thumbs (desktop) and dots (mobile)"
```

---

### Task 10: ProductInfoPanel

**Files:** `src/components/pdp/product-info-panel.tsx`.

- [ ] **Step 1:** Implement (server-renderable wrapper, content props):

```tsx
import * as React from "react";
import { Display } from "@/components/ui/typography";
import { formatPrice } from "@/lib/format";

export interface ProductInfoPanelProps {
  name: string;
  price: number;
  colour?: string;
  children?: React.ReactNode;
}

export function ProductInfoPanel({ name, price, colour, children }: ProductInfoPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Display level="md" as="h1">{name}</Display>
        <p className="mt-3 text-[18px] text-foreground-primary">{formatPrice(price, "GBP")}</p>
      </div>
      {colour && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">Colour</p>
          <p className="mt-2 text-[14px] text-foreground-primary">{colour}</p>
        </div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/pdp/product-info-panel.tsx
git commit -m "feat(pdp): add ProductInfoPanel (name + price + colour slot)"
```

---

### Task 11: AddToBagSection (with cart store integration + drawer pop)

**Files:** `src/components/pdp/add-to-bag-section.tsx`, `src/components/pdp/__tests__/add-to-bag-section.test.tsx`.

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToBagSection } from "../add-to-bag-section";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/schemas";

const product: Product = {
  id: "p1",
  slug: "leather-biker-jacket",
  name: "Leather Biker Jacket",
  price: 89500,
  currency: "GBP",
  description: "",
  images: ["/cms/products/03.jpg"],
  colour: "Black",
  sizes: ["S", "M", "L"],
  categorySlugs: ["jackets", "leather"],
  stock: { S: 0, M: 3, L: 1 },
  preOrder: false,
  details: { materials: "", care: "", sizing: "" },
};

beforeEach(() => {
  useCartStore.setState({ items: [], promoCode: null, isOpen: false });
});

describe("AddToBagSection", () => {
  it("disables Add to bag until a size is selected", () => {
    render(<AddToBagSection product={product} />);
    expect(screen.getByRole("button", { name: /add to bag/i })).toBeDisabled();
  });

  it("adds an item to the cart and opens the drawer when a size is picked + Add clicked", async () => {
    render(<AddToBagSection product={product} />);
    await userEvent.click(screen.getByRole("button", { name: /size m/i }));
    await userEvent.click(screen.getByRole("button", { name: /add to bag/i }));
    const state = useCartStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].productId).toBe("p1");
    expect(state.items[0].size).toBe("M");
    expect(state.isOpen).toBe(true);
  });

  it("shows PRE-ORDER label when product.preOrder is true", () => {
    render(<AddToBagSection product={{ ...product, preOrder: true, stock: { S: 0, M: 0, L: 0 } }} />);
    expect(screen.getByRole("button", { name: /pre-order/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SizeSelector } from "@/components/ui/size-selector";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product, Size } from "@/lib/schemas";

export interface AddToBagSectionProps {
  product: Product;
}

export function AddToBagSection({ product }: AddToBagSectionProps) {
  const [size, setSize] = React.useState<Size | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const onAdd = () => {
    if (!size) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? "",
      colour: product.colour ?? "",
      size,
      unitPrice: product.price,
      quantity: 1,
      preOrder: product.preOrder,
    });
    openDrawer();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-3">Size</p>
        <SizeSelector
          sizes={product.sizes}
          value={size}
          onChange={(s) => setSize(s)}
          stock={product.stock}
          allowSoldOut={product.preOrder}
        />
      </div>

      <Button size="lg" fullWidth onClick={onAdd} disabled={!size}>
        {product.preOrder ? "Pre-order (3 weeks)" : "Add to bag"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/pdp/add-to-bag-section.tsx src/components/pdp/__tests__/add-to-bag-section.test.tsx
git commit -m "feat(pdp): add AddToBagSection wired to cart store + drawer pop"
```

---

### Task 12: ProductDetailsAccordion

**Files:** `src/components/pdp/product-details-accordion.tsx`.

- [ ] **Step 1:** Implement (uses Accordion primitive from Phase 1):

```tsx
import * as React from "react";
import { Accordion } from "@/components/ui/accordion";
import type { Product } from "@/lib/schemas";

export function ProductDetailsAccordion({ product }: { product: Product }) {
  return (
    <Accordion
      multiple
      items={[
        { value: "description", title: "Description", content: <p>{product.description}</p> },
        { value: "materials", title: "Materials", content: <p>{product.details.materials}</p> },
        { value: "care", title: "Care", content: <p>{product.details.care}</p> },
        { value: "sizing", title: "Sizing", content: <p>{product.details.sizing}</p> },
      ]}
    />
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/pdp/product-details-accordion.tsx
git commit -m "feat(pdp): add ProductDetailsAccordion wrapping Accordion primitive"
```

---

### Task 13: RecommendedProducts

**Files:** `src/components/pdp/recommended-products.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import type { Product } from "@/lib/schemas";

export function RecommendedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <Section padding="lg">
      <Container size="wide">
        <Display level="md" as="h2" className="mb-12 text-center">
          We think you might like
        </Display>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              href={`/products/${p.slug}`}
              name={p.name}
              price={formatPrice(p.price, "GBP")}
              image={p.images[0]}
              hoverImage={p.images[1]}
              badge={p.preOrder ? "pre-order" : undefined}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/pdp/recommended-products.tsx
git commit -m "feat(pdp): add RecommendedProducts row"
```

---

# Section F — PDP page

### Task 14: `/products/[slug]/page.tsx`

**Files:** `src/app/products/[slug]/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { ProductGallery } from "@/components/pdp/product-gallery";
import { ProductInfoPanel } from "@/components/pdp/product-info-panel";
import { AddToBagSection } from "@/components/pdp/add-to-bag-section";
import { ProductDetailsAccordion } from "@/components/pdp/product-details-accordion";
import { RecommendedProducts } from "@/components/pdp/recommended-products";
import { getProductBySlug, getRecommendations } from "@/lib/data/products";
import { getCategoryBySlug } from "@/lib/data/categories";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found · YNOT London" };
  return {
    title: `${p.name} · YNOT London`,
    description: p.description,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const recommendations = await getRecommendations(product.slug, 4);
  const primaryCategorySlug = product.categorySlugs[0];
  const primaryCategory = primaryCategorySlug
    ? await getCategoryBySlug(primaryCategorySlug)
    : null;

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Section padding="sm">
          <Container size="wide">
            <Breadcrumb
              crumbs={[
                { label: "Home", href: "/" },
                primaryCategory
                  ? { label: primaryCategory.name, href: `/collection/${primaryCategory.slug}` }
                  : { label: "Shop", href: "/" },
                { label: product.name },
              ]}
            />
          </Container>
        </Section>

        <Section padding="md">
          <Container size="wide">
            <div className="grid gap-10 md:grid-cols-2 md:gap-16">
              <ProductGallery images={product.images} alt={product.name} />
              <div className="flex flex-col gap-10">
                <ProductInfoPanel
                  name={product.name}
                  price={product.price}
                  colour={product.colour}
                >
                  <AddToBagSection product={product} />
                </ProductInfoPanel>
                <ProductDetailsAccordion product={product} />
              </div>
            </div>
          </Container>
        </Section>

        <RecommendedProducts products={recommendations} />
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify. Confirm `/products/[slug]` shows up.

- [ ] **Step 3:** Smoke test:
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 3
curl -s -o /dev/null -w "/products/leather-biker-jacket → HTTP %{http_code}\n" http://localhost:3000/products/leather-biker-jacket
curl -s -o /dev/null -w "/products/quilted-field-vest → HTTP %{http_code}\n" http://localhost:3000/products/quilted-field-vest
curl -s -o /dev/null -w "/products/nope → HTTP %{http_code}\n" http://localhost:3000/products/nope
pkill -f "next dev" 2>/dev/null || true
```
Expected: 200 / 200 / 404.

- [ ] **Step 4:** Commit:
```bash
git add src/app/products
git commit -m "feat(catalog): add /products/[slug] PDP composing gallery + info + cart + recommendations"
```

---

# Section G — Verification

### Task 15: Final gate + tag

- [ ] **Step 1:** Full test suite:
```bash
pnpm test
```
Expected: all tests pass (89 baseline + 6 new from filter (1 file × 6 tests) + 2 new from sort-dropdown + 3 new from add-to-bag-section = 100).

- [ ] **Step 2:** Build:
```bash
pnpm build
```
Expected: routes include `/collection/[slug]` and `/products/[slug]`.

- [ ] **Step 3:** Lint:
```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 4:** Tag:
```bash
git tag phase-3-catalog-complete
git log --oneline -1
```

---

## Self-Review

- ✅ Spec coverage: Collection (breadcrumb, header, filter, sort, grid, load-more) + PDP (gallery, info, add-to-bag with cart wire, accordion, recommendations) all built. URL-driven filter state. Pre-order CTA branch.
- ✅ All routes 404 on bad slug.
- ✅ `addItem` + `openDrawer()` triggered together on Add to bag — closes the loop with cart drawer that pops up showing the item.
- ✅ All new tests align with existing testing patterns (controlled-input harness for forms, vi.mock for next/navigation).

---

## Execution

Subagent-driven, section batches (A worktree → B-C catalog primitives → D collection page → E PDP primitives → F PDP page → G verification). Same workflow as Phase 2.
