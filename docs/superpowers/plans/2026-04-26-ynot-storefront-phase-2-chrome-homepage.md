# YNOT Storefront — Phase 2: Chrome wiring + Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the SiteHeader buttons to working overlays (Cart drawer with live cart, Menu sidebar with CMS categories, Search overlay with live results) and ship the full Homepage composed of CMS-driven blocks (Hero, Brand statement, New Arrivals, Timeless, Lookbook).

**Architecture:** A small Zustand UI store coordinates open/close state for menu and search overlays (cart already has its own store). SiteHeader becomes a Client Component that reads cart count and dispatches store actions. The drawers/overlays mount once in the root layout. Homepage is a Server Component that calls data adapters (already built in Phase 1) and renders presentational block components.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), TypeScript 5.9, Tailwind v4, React 19, Zustand 5, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md`

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-2-chrome-homepage` (NEW worktree on branch `feature/phase-2-chrome-homepage`, created off main which now contains all Phase 1 work).

**Prerequisites already in place from Phase 1:**
- All primitives (Button, Input, Drawer, Modal, Toast, Tabs, Accordion, IconButton, etc.)
- Cart Zustand store at `src/lib/stores/cart-store.ts` with `items`, `isOpen`, `openDrawer()`, `closeDrawer()`, `addItem()`, `removeItem()`, `setQuantity()`, `subtotal()`, `itemCount()`
- Data adapters: `getAllCategories()`, `getAnnouncementMessages()`, `getHero()`, `getLookbook()`, `getStaticPage()`, `getAllProducts()`, `getProductBySlug()`, `getNewArrivals()`, `searchProducts()`, `getOrderById()`
- `formatPrice()` formatter
- Mock JSON for everything

---

## File Structure (created/modified by this plan)

```
web/
├── src/
│   ├── lib/
│   │   └── stores/
│   │       ├── ui-store.ts                  [created]
│   │       └── __tests__/
│   │           └── ui-store.test.ts          [created]
│   ├── components/
│   │   ├── site-header.tsx                  [modified — wire triggers + cart count]
│   │   ├── menu-sidebar.tsx                 [created]
│   │   ├── cart-drawer.tsx                  [created]
│   │   ├── search-overlay.tsx               [created]
│   │   ├── site-overlays.tsx                [created — bundles all 3 overlays for layout]
│   │   ├── __tests__/
│   │   │   ├── menu-sidebar.test.tsx        [created]
│   │   │   ├── cart-drawer.test.tsx         [created]
│   │   │   └── search-overlay.test.tsx      [created]
│   │   └── blocks/
│   │       ├── hero-section.tsx             [created]
│   │       ├── brand-statement.tsx          [created]
│   │       ├── products-row.tsx             [created]
│   │       ├── editorial-block.tsx          [created]
│   │       └── lookbook-carousel.tsx        [created]
│   └── app/
│       ├── layout.tsx                       [modified — fetch categories + mount overlays]
│       ├── page.tsx                         [modified — full homepage composition]
│       └── search/
│           └── page.tsx                     [created — search results page]
```

---

# Section A — Worktree setup

### Task 1: Create Phase 2 worktree

**Files:** none modified in source.

- [ ] **Step 1: From main worktree, create the new worktree**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git worktree add .worktrees/phase-2-chrome-homepage -b feature/phase-2-chrome-homepage
```

Expected: worktree created, new branch starts at the current main HEAD (which contains all Phase 1 work).

- [ ] **Step 2: Move into the worktree, install deps, regen next-env**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-2-chrome-homepage
pnpm install --frozen-lockfile
pnpm build
```

Expected: install succeeds; build succeeds (regenerates `next-env.d.ts`).

- [ ] **Step 3: Baseline verification**

```bash
pnpm test
pnpm exec tsc --noEmit
```

Expected: 75 tests pass, tsc exits 0.

(No commit yet — worktree creation isn't a commit.)

---

# Section B — UI store + chrome wiring

### Task 2: UI store

**Files:**
- Create: `src/lib/stores/ui-store.ts`
- Create: `src/lib/stores/__tests__/ui-store.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/stores/__tests__/ui-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

beforeEach(() => {
  useUIStore.setState({ isMenuOpen: false, isSearchOpen: false });
});

describe("ui store", () => {
  it("starts with menu and search closed", () => {
    expect(useUIStore.getState().isMenuOpen).toBe(false);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });

  it("openMenu sets isMenuOpen true and closes search", () => {
    useUIStore.setState({ isSearchOpen: true });
    useUIStore.getState().openMenu();
    expect(useUIStore.getState().isMenuOpen).toBe(true);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });

  it("openSearch sets isSearchOpen true and closes menu", () => {
    useUIStore.setState({ isMenuOpen: true });
    useUIStore.getState().openSearch();
    expect(useUIStore.getState().isSearchOpen).toBe(true);
    expect(useUIStore.getState().isMenuOpen).toBe(false);
  });

  it("closeAll closes everything", () => {
    useUIStore.setState({ isMenuOpen: true, isSearchOpen: true });
    useUIStore.getState().closeAll();
    expect(useUIStore.getState().isMenuOpen).toBe(false);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/lib/stores/__tests__/ui-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/stores/ui-store.ts`:

```ts
import { create } from "zustand";

type UIState = {
  isMenuOpen: boolean;
  isSearchOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  closeAll: () => void;
};

export const useUIStore = create<UIState>()((set) => ({
  isMenuOpen: false,
  isSearchOpen: false,
  openMenu: () => set({ isMenuOpen: true, isSearchOpen: false }),
  closeMenu: () => set({ isMenuOpen: false }),
  openSearch: () => set({ isSearchOpen: true, isMenuOpen: false }),
  closeSearch: () => set({ isSearchOpen: false }),
  closeAll: () => set({ isMenuOpen: false, isSearchOpen: false }),
}));
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/lib/stores/__tests__/ui-store.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/ui-store.ts src/lib/stores/__tests__/ui-store.test.ts
git commit -m "feat(state): add UI store for menu/search overlay coordination"
```

---

### Task 3: Wire SiteHeader to stores (cart count + click handlers)

**Files:**
- Modify: `src/components/site-header.tsx`

- [ ] **Step 1: Read current SiteHeader to understand its structure**

```bash
cat src/components/site-header.tsx
```

Expected: confirms it currently exports `SiteHeader` with `overHero` and `cartCount` props, has 3 button slots in a 3-col grid.

- [ ] **Step 2: Replace SiteHeader implementation**

Replace the entire contents of `src/components/site-header.tsx` with:

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useCartStore } from "@/lib/stores/cart-store";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  AccountIcon,
  BagIcon,
  MenuIcon,
  SearchIcon,
} from "./icons";

import logoBlack from "../../public/brand/ynot-logo-black.png";
import logoWhite from "../../public/brand/ynot-logo-white.png";

export interface SiteHeaderProps {
  /**
   * When true, header starts transparent over a hero image and becomes solid
   * after the user scrolls past the hero.
   */
  overHero?: boolean;
}

export function SiteHeader({ overHero = false }: SiteHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const itemCount = useCartStore((s) => s.itemCount());
  const openCart = useCartStore((s) => s.openDrawer);
  const openMenu = useUIStore((s) => s.openMenu);
  const openSearch = useUIStore((s) => s.openSearch);

  React.useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  const isTransparent = overHero && !scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors duration-300",
        isTransparent
          ? "bg-transparent text-foreground-inverse"
          : "bg-surface-primary text-foreground-primary border-b border-border-light",
      )}
    >
      <div className="grid h-12 grid-cols-3 items-center px-5 md:h-14 md:px-8">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMenu}
            className="-ml-2 flex h-10 w-10 items-center justify-center"
          >
            <MenuIcon />
          </button>
        </div>

        <div className="flex items-center justify-center">
          <Link
            href="/"
            aria-label="YNOT London"
            className="relative block h-8 w-[56px] md:h-9 md:w-[64px]"
          >
            <Image
              src={logoWhite}
              alt=""
              priority
              fill
              sizes="100px"
              className={cn(
                "object-contain transition-opacity duration-300",
                isTransparent ? "opacity-100" : "opacity-0",
              )}
            />
            <Image
              src={logoBlack}
              alt="YNOT London"
              priority
              fill
              sizes="100px"
              className={cn(
                "object-contain transition-opacity duration-300",
                isTransparent ? "opacity-0" : "opacity-100",
              )}
            />
          </Link>
        </div>

        <div className="flex items-center justify-end gap-1 md:gap-2">
          <button
            type="button"
            aria-label="Search"
            onClick={openSearch}
            className="hidden h-10 w-10 items-center justify-center md:flex"
          >
            <SearchIcon />
          </button>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden h-10 w-10 items-center justify-center md:flex"
          >
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${itemCount} items`}
            onClick={openCart}
            className="relative -mr-2 flex h-10 w-10 items-center justify-center"
          >
            <BagIcon />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground-primary px-1 text-[10px] font-semibold text-foreground-inverse">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Build verify**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat(chrome): wire SiteHeader buttons to cart and UI stores"
```

---

# Section C — Menu sidebar

### Task 4: MenuSidebar component

**Files:**
- Create: `src/components/menu-sidebar.tsx`
- Create: `src/components/__tests__/menu-sidebar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/__tests__/menu-sidebar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuSidebar } from "../menu-sidebar";
import { useUIStore } from "@/lib/stores/ui-store";

const categories = [
  { slug: "jackets", name: "Jackets" },
  { slug: "coats", name: "Coats" },
];

beforeEach(() => {
  useUIStore.setState({ isMenuOpen: true, isSearchOpen: false });
});

describe("MenuSidebar", () => {
  it("renders categories when open", () => {
    render(<MenuSidebar categories={categories} />);
    expect(screen.getByRole("link", { name: "Jackets" })).toHaveAttribute(
      "href",
      "/collection/jackets",
    );
    expect(screen.getByRole("link", { name: "Coats" })).toHaveAttribute(
      "href",
      "/collection/coats",
    );
  });

  it("closes when category link clicked", async () => {
    render(<MenuSidebar categories={categories} />);
    await userEvent.click(screen.getByRole("link", { name: "Jackets" }));
    expect(useUIStore.getState().isMenuOpen).toBe(false);
  });

  it("does not render when closed", () => {
    useUIStore.setState({ isMenuOpen: false });
    render(<MenuSidebar categories={categories} />);
    expect(screen.queryByRole("link", { name: "Jackets" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/__tests__/menu-sidebar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/menu-sidebar.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { useUIStore } from "@/lib/stores/ui-store";

interface MenuCategory {
  slug: string;
  name: string;
}

export interface MenuSidebarProps {
  categories: MenuCategory[];
}

export function MenuSidebar({ categories }: MenuSidebarProps) {
  const isOpen = useUIStore((s) => s.isMenuOpen);
  const close = useUIStore((s) => s.closeMenu);

  return (
    <Drawer open={isOpen} onClose={close} side="left" title="Menu">
      <nav className="flex flex-col p-6">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/collection/${c.slug}`}
            onClick={close}
            className="py-3 font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary transition-colors"
          >
            {c.name}
          </Link>
        ))}
      </nav>
    </Drawer>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/__tests__/menu-sidebar.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu-sidebar.tsx src/components/__tests__/menu-sidebar.test.tsx
git commit -m "feat(chrome): add MenuSidebar with CMS categories"
```

---

# Section D — Cart drawer

### Task 5: CartDrawer component

**Files:**
- Create: `src/components/cart-drawer.tsx`
- Create: `src/components/__tests__/cart-drawer.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/__tests__/cart-drawer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartDrawer } from "../cart-drawer";
import { useCartStore } from "@/lib/stores/cart-store";

const sampleItem = {
  productId: "prod_001",
  slug: "belted-suede-field-jacket",
  name: "Belted Suede Field Jacket",
  image: "/sample/jacket-1.svg",
  colour: "Chocolate Brown",
  size: "M" as const,
  unitPrice: 89500,
  quantity: 1,
  preOrder: false,
};

beforeEach(() => {
  useCartStore.setState({ items: [], promoCode: null, isOpen: true });
});

describe("CartDrawer", () => {
  it("renders empty state when no items", () => {
    render(<CartDrawer />);
    expect(screen.getByText(/your bag is empty/i)).toBeInTheDocument();
  });

  it("renders cart items and subtotal", () => {
    useCartStore.setState({ items: [sampleItem] });
    render(<CartDrawer />);
    expect(screen.getByText("Belted Suede Field Jacket")).toBeInTheDocument();
    expect(screen.getByText("£895")).toBeInTheDocument();
  });

  it("removes item when Remove clicked", async () => {
    useCartStore.setState({ items: [sampleItem] });
    render(<CartDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("does not render when closed", () => {
    useCartStore.setState({ isOpen: false });
    render(<CartDrawer />);
    expect(screen.queryByText(/your bag/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/__tests__/cart-drawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/cart-drawer.tsx`:

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.closeDrawer);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const removeItem = useCartStore((s) => s.removeItem);
  const setQuantity = useCartStore((s) => s.setQuantity);

  return (
    <Drawer open={isOpen} onClose={close} side="right" title="Your Bag">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <p className="text-[14px] text-foreground-secondary">
            Your bag is empty
          </p>
          <Link href="/collection/jackets" onClick={close}>
            <Button variant="outline" size="md">
              Continue shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-border-light overflow-y-auto">
            {items.map((item) => (
              <li
                key={`${item.productId}-${item.size}`}
                className="flex gap-4 p-5"
              >
                <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground-primary">
                      {item.name}
                    </p>
                    <p className="text-[12px] text-foreground-secondary">
                      {item.colour} · Size {item.size}
                    </p>
                    {item.preOrder && (
                      <p className="text-[11px] uppercase tracking-[0.15em] text-accent-warm mt-1">
                        Pre-order · 3 weeks
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(q) => setQuantity(item.productId, item.size, q)}
                      min={1}
                      max={10}
                    />
                    <p className="text-[13px] font-medium">
                      {formatPrice(item.unitPrice * item.quantity, "GBP")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId, item.size)}
                    className="self-start text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-light p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal, "GBP")}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Shipping</span>
              <span className="font-medium">Free</span>
            </div>
            <Link href="/checkout/shipping" onClick={close} className="block">
              <Button fullWidth size="lg">
                Checkout
              </Button>
            </Link>
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
              Secure checkout
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/__tests__/cart-drawer.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/cart-drawer.tsx src/components/__tests__/cart-drawer.test.tsx
git commit -m "feat(chrome): add CartDrawer with items, qty stepper, subtotal, checkout CTA"
```

---

# Section E — Search overlay + page

### Task 6: SearchOverlay component

**Files:**
- Create: `src/components/search-overlay.tsx`
- Create: `src/components/__tests__/search-overlay.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/__tests__/search-overlay.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchOverlay } from "../search-overlay";
import { useUIStore } from "@/lib/stores/ui-store";

beforeEach(() => {
  useUIStore.setState({ isSearchOpen: true, isMenuOpen: false });
});

describe("SearchOverlay", () => {
  it("does not render when closed", () => {
    useUIStore.setState({ isSearchOpen: false });
    render(<SearchOverlay />);
    expect(screen.queryByPlaceholderText(/search products/i)).toBeNull();
  });

  it("shows results matching query", async () => {
    render(<SearchOverlay />);
    await userEvent.type(
      screen.getByPlaceholderText(/search products/i),
      "trench",
    );
    await waitFor(() =>
      expect(screen.getByText("Wool Trench Coat")).toBeInTheDocument(),
    );
  });

  it("closes when Escape pressed", async () => {
    render(<SearchOverlay />);
    await userEvent.keyboard("{Escape}");
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test src/components/__tests__/search-overlay.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/search-overlay.tsx`:

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/stores/ui-store";
import { searchProducts } from "@/lib/data/search";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/schemas";
import { CloseIcon, SearchIcon } from "./icons";

export function SearchOverlay() {
  const open = useUIStore((s) => s.isSearchOpen);
  const close = useUIStore((s) => s.closeSearch);
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Product[]>([]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  React.useEffect(() => {
    let active = true;
    searchProducts(query).then((rs) => {
      if (active) setResults(rs);
    });
    return () => {
      active = false;
    };
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      close();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary text-foreground-primary overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] px-5 md:px-10 pt-10 pb-20">
        <div className="flex items-center justify-between mb-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
            Search
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="h-10 w-10 flex items-center justify-center hover:bg-surface-secondary"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={submit} className="relative">
          <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
          <input
            type="search"
            autoFocus
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-b border-foreground-primary bg-transparent pl-9 pr-3 py-4 font-heading text-[28px] focus:outline-none placeholder:text-foreground-tertiary"
          />
        </form>

        {results.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-8">
            {results.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.slug}`}
                  onClick={close}
                  className="group block"
                >
                  <div className="relative aspect-[3/4] w-full bg-surface-secondary overflow-hidden">
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      sizes="(min-width: 768px) 33vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 text-[13px] font-medium">{p.name}</p>
                  <p className="text-[13px] text-foreground-secondary">
                    {formatPrice(p.price, "GBP")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query && results.length === 0 && (
          <p className="mt-10 text-[14px] text-foreground-secondary">
            No products match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test src/components/__tests__/search-overlay.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/search-overlay.tsx src/components/__tests__/search-overlay.test.tsx
git commit -m "feat(chrome): add SearchOverlay with live results"
```

---

### Task 7: /search results page

**Files:**
- Create: `src/app/search/page.tsx`

- [ ] **Step 1: Implement**

Create `src/app/search/page.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { searchProducts } from "@/lib/data/search";
import { formatPrice } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Display, Eyebrow } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return {
    title: q ? `Search: "${q}" · YNOT London` : "Search · YNOT London",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const results = await searchProducts(q);

  return (
    <Container size="wide" className="py-16">
      <Eyebrow>Search results</Eyebrow>
      <Display level="md" as="h1" className="mt-3">
        {q ? `“${q}”` : "Type something to search"}
      </Display>
      <p className="mt-2 text-[14px] text-foreground-secondary">
        {q
          ? `${results.length} ${results.length === 1 ? "result" : "results"}`
          : ""}
      </p>

      {results.length > 0 && (
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {results.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="group block">
              <div className="relative aspect-[3/4] w-full bg-surface-secondary overflow-hidden">
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-3 text-[13px] font-medium">{p.name}</p>
              <p className="text-[13px] text-foreground-secondary">
                {formatPrice(p.price, "GBP")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {q && results.length === 0 && (
        <p className="mt-10 text-[14px] text-foreground-secondary">
          Nothing matched. Try a different search term.
        </p>
      )}
    </Container>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat(catalog): add /search results page"
```

---

# Section F — Mount overlays in root layout

### Task 8: SiteOverlays bundle + root layout integration

**Files:**
- Create: `src/components/site-overlays.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the bundle component**

Create `src/components/site-overlays.tsx`:

```tsx
"use client";

import { CartDrawer } from "./cart-drawer";
import { MenuSidebar } from "./menu-sidebar";
import { SearchOverlay } from "./search-overlay";

interface MenuCategory {
  slug: string;
  name: string;
}

export function SiteOverlays({ categories }: { categories: MenuCategory[] }) {
  return (
    <>
      <MenuSidebar categories={categories} />
      <CartDrawer />
      <SearchOverlay />
    </>
  );
}
```

- [ ] **Step 2: Read current root layout**

```bash
cat src/app/layout.tsx
```

Expected: confirms it currently exports a sync function with html/body shell.

- [ ] **Step 3: Convert root layout to async + mount overlays**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteOverlays } from "@/components/site-overlays";
import { getAllCategories } from "@/lib/data/categories";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YNOT London",
  description:
    "Urban outerwear, built to endure. Designed to be relied on. Premium women's outerwear from London.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getAllCategories();
  const menuCategories = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-primary text-foreground-primary font-body">
        {children}
        <SiteOverlays categories={menuCategories} />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-overlays.tsx src/app/layout.tsx
git commit -m "feat(chrome): mount cart/menu/search overlays in root layout"
```

---

# Section G — Homepage blocks

### Task 9: HeroSection

**Files:**
- Create: `src/components/blocks/hero-section.tsx`

- [ ] **Step 1: Implement**

Create `src/components/blocks/hero-section.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { HeroBlock } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export function HeroSection({ hero }: { hero: HeroBlock }) {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-surface-dark">
      {hero.kind === "image" ? (
        <Image
          src={hero.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <video
          src={hero.videoUrl ?? undefined}
          poster={hero.image}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
        <p className="font-heading text-[80px] tracking-[0.05em] md:text-[120px]">
          YNOT
        </p>
        <p className="mt-4 text-[12px] uppercase tracking-[0.4em]">
          {hero.eyebrow}
        </p>
        <Link href={hero.ctaHref} className="mt-10">
          <Button size="lg" variant="outline" className="bg-transparent text-foreground-inverse border-foreground-inverse hover:bg-foreground-inverse hover:text-foreground-primary">
            {hero.ctaLabel}
          </Button>
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/hero-section.tsx
git commit -m "feat(homepage): add HeroSection block (full-viewport image/video)"
```

---

### Task 10: BrandStatement

**Files:**
- Create: `src/components/blocks/brand-statement.tsx`

- [ ] **Step 1: Implement**

Create `src/components/blocks/brand-statement.tsx`:

```tsx
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";

export interface BrandStatementProps {
  primary: string;
  secondary: string;
}

export function BrandStatement({ primary, secondary }: BrandStatementProps) {
  return (
    <Section background="cream" padding="lg">
      <div className="mx-auto max-w-3xl text-center px-6">
        <Display level="md" as="p" className="text-foreground-on-cream">
          {primary}
        </Display>
        <p className="mt-6 text-[12px] uppercase tracking-[0.3em] text-foreground-on-cream">
          {secondary}
        </p>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/brand-statement.tsx
git commit -m "feat(homepage): add BrandStatement block"
```

---

### Task 11: ProductsRow

**Files:**
- Create: `src/components/blocks/products-row.tsx`

- [ ] **Step 1: Implement**

Create `src/components/blocks/products-row.tsx`:

```tsx
import Link from "next/link";
import type { Product } from "@/lib/schemas";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export interface ProductsRowProps {
  title: string;
  products: Product[];
  ctaHref: string;
  ctaLabel?: string;
}

export function ProductsRow({
  title,
  products,
  ctaHref,
  ctaLabel = "See more",
}: ProductsRowProps) {
  return (
    <Section padding="lg">
      <Container size="wide">
        <div className="mb-12 flex items-end justify-between gap-6">
          <Display level="md" as="h2">
            {title}
          </Display>
          <Link href={ctaHref} className="hidden md:inline-block">
            <Button variant="link">{ctaLabel}</Button>
          </Link>
        </div>

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

        <div className="mt-10 flex justify-center md:hidden">
          <Link href={ctaHref}>
            <Button variant="outline">{ctaLabel}</Button>
          </Link>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/products-row.tsx
git commit -m "feat(homepage): add ProductsRow block (4-card grid + CTA)"
```

---

### Task 12: EditorialBlock

**Files:**
- Create: `src/components/blocks/editorial-block.tsx`

- [ ] **Step 1: Implement**

Create `src/components/blocks/editorial-block.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export interface EditorialBlockProps {
  title: string;
  body: string;
  image: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Image side; defaults to left on desktop. */
  imageSide?: "left" | "right";
}

export function EditorialBlock({
  title,
  body,
  image,
  ctaHref,
  ctaLabel,
  imageSide = "left",
}: EditorialBlockProps) {
  return (
    <Section padding="lg">
      <Container size="wide">
        <div
          className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
            imageSide === "right" ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="relative aspect-[4/5] w-full bg-surface-secondary overflow-hidden">
            <Image
              src={image}
              alt={title}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="max-w-md">
            <Display level="md" as="h2">
              {title}
            </Display>
            <p className="mt-6 text-[15px] leading-relaxed text-foreground-secondary">
              {body}
            </p>
            {ctaHref && ctaLabel && (
              <Link href={ctaHref} className="mt-8 inline-block">
                <Button variant="outline">{ctaLabel}</Button>
              </Link>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/editorial-block.tsx
git commit -m "feat(homepage): add EditorialBlock (image + text, swappable side)"
```

---

### Task 13: LookbookCarousel

**Files:**
- Create: `src/components/blocks/lookbook-carousel.tsx`

- [ ] **Step 1: Implement**

Create `src/components/blocks/lookbook-carousel.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Lookbook } from "@/lib/schemas";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";

export interface LookbookCarouselProps {
  lookbook: Lookbook;
  title?: string;
}

export function LookbookCarousel({
  lookbook,
  title = "Lookbook",
}: LookbookCarouselProps) {
  return (
    <Section padding="lg">
      <Container size="wide" className="mb-10">
        <Display level="md" as="h2">
          {title}
        </Display>
      </Container>
      <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory">
        <ul className="flex gap-4 px-5 md:gap-6 md:px-10">
          {lookbook.images.map((img, i) => {
            const inner = (
              <div className="relative h-[60vh] w-[80vw] max-w-[480px] flex-shrink-0 snap-start bg-surface-secondary overflow-hidden">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 480px, 80vw"
                  className="object-cover"
                />
              </div>
            );
            return (
              <li key={i} className="flex-shrink-0">
                {img.productSlug ? (
                  <Link href={`/products/${img.productSlug}`}>{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/lookbook-carousel.tsx
git commit -m "feat(homepage): add LookbookCarousel (horizontal scroll, snap-x)"
```

---

# Section H — Wire homepage

### Task 14: Replace homepage with composed blocks

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace homepage**

Replace `src/app/page.tsx` entirely with:

```tsx
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { HeroSection } from "@/components/blocks/hero-section";
import { BrandStatement } from "@/components/blocks/brand-statement";
import { ProductsRow } from "@/components/blocks/products-row";
import { EditorialBlock } from "@/components/blocks/editorial-block";
import { LookbookCarousel } from "@/components/blocks/lookbook-carousel";
import { getHero, getLookbook } from "@/lib/data/content";
import { getNewArrivals, getAllProducts } from "@/lib/data/products";

export default async function Home() {
  const [hero, lookbook, newArrivals, allProducts] = await Promise.all([
    getHero(),
    getLookbook(),
    getNewArrivals(4),
    getAllProducts(),
  ]);

  // Pick a "Timeless" hero product for the editorial block
  const timeless = allProducts.find((p) => p.slug === "the-chelsea-jacket") ?? allProducts[0];

  return (
    <>
      <AnnouncementBar />
      <SiteHeader overHero />

      <main className="flex-1">
        <HeroSection hero={hero} />
        <BrandStatement
          primary="Urban outerwear, built to endure. Designed to be relied on."
          secondary="Why not is not a question. It’s how she lives."
        />
        <ProductsRow
          title="New Arrivals"
          products={newArrivals}
          ctaHref="/collection/jackets"
        />
        <EditorialBlock
          title="Timeless Collection"
          body="Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear."
          image={timeless.images[0]}
          ctaHref="/collection/jackets"
          ctaLabel="Explore"
        />
        <LookbookCarousel lookbook={lookbook} />
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2: Build verify**

Run: `pnpm build`
Expected: succeeds. Static prerender for `/` may be replaced with Dynamic since it pulls async data — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(homepage): assemble homepage from chrome + 5 CMS-driven blocks"
```

---

# Section I — Verification gate

### Task 15: Run all tests + build + lint, tag

**Files:** none modified.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all tests pass (75 from Phase 1 + 14 new from Phase 2 = 89).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succeeds, no TS errors, no warnings of substance.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Tag**

```bash
git tag phase-2-chrome-homepage-complete
git log --oneline -1
```

---

## Self-Review (executor: do this before claiming the plan complete)

1. **Spec coverage:**
   - Cart drawer auto-opens on Add to Bag ✓ (handled by cart store openDrawer in addItem flow — Phase 3 task; for now CartDrawer renders correctly when isOpen=true)
   - Menu sidebar lists categories from CMS ✓ (Task 4)
   - Search overlay full-screen with live results, Enter → /search ✓ (Task 6 + Task 7)
   - Cart badge shows live count ✓ (Task 3 SiteHeader subscribes to itemCount())
   - WhatsApp widget on every page ✓ (in homepage, will need to add to other pages in their respective phases)
   - Homepage 5 blocks (Hero, BrandStatement, NewArrivals, Timeless, Lookbook) ✓ (Tasks 9-14)
   - Hero "wordmark + New Collection + SHOP CTA" ✓
   - Brand statement primary + secondary text ✓
   - Lookbook horizontal scroll ✓ (CSS scroll-snap, no JS animation per spec deferral)
   - All static animations deferred per spec ✓

2. **Out-of-scope carry-over:** Header `/account` link goes to /account which doesn't exist yet (Phase 5). Click leaves to a 404. Acceptable in Phase 2 — wire account page in its phase. Same for `/checkout/shipping` (Phase 4), `/products/[slug]` (Phase 3), `/collection/[slug]` (Phase 3) — links are correct but pages return 404 until those phases complete.

3. **Type consistency:** UI store has `isMenuOpen`, `isSearchOpen` — referenced consistently in MenuSidebar, SearchOverlay, SiteHeader. Cart store `isOpen`, `openDrawer`, `closeDrawer`, `itemCount()`, `subtotal()` — referenced consistently in SiteHeader and CartDrawer. CategoryName type used in MenuSidebar via `MenuCategory { slug, name }` derived from full Category in layout.

4. **Files contributed:** 1 new store (UI), 4 new client components (MenuSidebar, CartDrawer, SearchOverlay, SiteOverlays), 5 homepage blocks, 1 new page (/search), 2 modified files (SiteHeader, root layout, homepage). Total ~14 commits + tag.

---

## Execution Handoff

**Plan complete and saved to `web/docs/superpowers/plans/2026-04-26-ynot-storefront-phase-2-chrome-homepage.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — Section-batched dispatch (same pattern as Phase 1 worked well; ~5-6 subagents instead of 30+).
2. **Inline Execution** — Run tasks directly in this session.

**Which approach?**
