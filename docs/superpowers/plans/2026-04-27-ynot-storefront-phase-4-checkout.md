# YNOT Storefront — Phase 4: Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Ship the 3-step checkout flow that closes the purchase loop end-to-end. After Phase 4 a visitor can browse → add to bag → enter shipping → "pay" (Stripe stub) → land on a confirmation page with order details. No real payment processing yet — all flows are wired against the cart store and a checkout store; backend integration is a later phase.

**Architecture:** A dedicated `src/app/checkout/layout.tsx` swaps in a minimal header (centred logo + "Secure checkout" hint, no menu/search/account/cart icons) and hides AnnouncementBar. A `useCheckoutStore` (Zustand + sessionStorage) carries `shippingAddress`, `shippingMethod`, `placedOrder` between steps. Forms use React Hook Form + Zod schemas (Address from Phase 1, two new step schemas). PaymentForm uses the existing `CardInput` stub from Phase 1; pressing "Pay" calls `placeOrder()` which generates a fake order id, snapshots cart + shipping, clears the cart, and navigates to `/checkout/success/[id]`.

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Zustand 5, Zod, React Hook Form, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § Checkout.

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-4-checkout` (NEW worktree).

**Prerequisites in main:** Phases 1-3 (100 tests, full chrome + homepage + catalog/PDP).

---

## File structure

```
web/
├── src/
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── checkout-store.ts           [created]
│   │   │   └── __tests__/
│   │   │       └── checkout-store.test.ts   [created]
│   │   └── checkout/
│   │       └── format-order-id.ts           [created]
│   ├── components/
│   │   ├── checkout/
│   │   │   ├── checkout-header.tsx          [created — minimal logo + "Secure checkout"]
│   │   │   ├── checkout-progress.tsx        [created — 1-2-3 indicator]
│   │   │   ├── shipping-method-picker.tsx   [created]
│   │   │   ├── order-summary-card.tsx       [created — sticky right column]
│   │   │   ├── shipping-form.tsx            [created — RHF + Zod]
│   │   │   ├── payment-form.tsx             [created — CardInput + billing-same checkbox]
│   │   │   └── confirmation-layout.tsx      [created — step 3 success]
│   │   └── ...
│   └── app/
│       └── checkout/
│           ├── layout.tsx                   [created]
│           ├── shipping/page.tsx            [created]
│           ├── payment/page.tsx             [created]
│           └── success/[id]/page.tsx        [created]
└── (no other changes)
```

---

# Section A — Worktree

### Task 1: Create Phase 4 worktree

- [ ] **Step 1:** From main:
  ```bash
  cd /Users/batyrbekkuandyk/Desktop/ynot/web
  git worktree add .worktrees/phase-4-checkout -b feature/phase-4-checkout
  ```

- [ ] **Step 2:** Setup:
  ```bash
  cd .worktrees/phase-4-checkout
  pnpm install --frozen-lockfile
  pnpm build
  pnpm test
  ```
  Expected: 100 tests pass, build green.

---

# Section B — Checkout store + helpers

### Task 2: Order id generator

**Files:**
- Create: `src/lib/checkout/format-order-id.ts`
- Create: `src/lib/checkout/__tests__/format-order-id.test.ts`

- [ ] **Step 1:** Write failing test:

```ts
import { describe, it, expect } from "vitest";
import { generateOrderId } from "../format-order-id";

describe("generateOrderId", () => {
  it("returns YNT-YYYYMMDD-NNNN format", () => {
    const id = generateOrderId(new Date("2026-04-27T10:00:00Z"), 42);
    expect(id).toBe("YNT-20260427-0042");
  });
  it("zero-pads the sequence", () => {
    expect(generateOrderId(new Date("2026-04-27"), 7)).toMatch(/-0007$/);
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
export function generateOrderId(date: Date, sequence: number): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `YNT-${yyyy}${mm}${dd}-${seq}`;
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/checkout/format-order-id.ts src/lib/checkout/__tests__/format-order-id.test.ts
git commit -m "feat(checkout): add order id generator (YNT-YYYYMMDD-NNNN)"
```

---

### Task 3: Checkout Zustand store

**Files:**
- Create: `src/lib/stores/checkout-store.ts`
- Create: `src/lib/stores/__tests__/checkout-store.test.ts`

- [ ] **Step 1:** Write failing test:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCheckoutStore } from "../checkout-store";
import { useCartStore } from "../cart-store";
import type { Address } from "@/lib/schemas";

const addr: Address = {
  firstName: "Jane",
  lastName: "Doe",
  line1: "42 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

const item = {
  productId: "p1",
  slug: "p1",
  name: "Test",
  image: "/x.jpg",
  colour: "Black",
  size: "M" as const,
  unitPrice: 50000,
  quantity: 1,
  preOrder: false,
};

beforeEach(() => {
  useCheckoutStore.setState({
    shippingAddress: null,
    shippingMethod: null,
    placedOrder: null,
  });
  useCartStore.setState({ items: [], promoCode: null, isOpen: false });
});

describe("checkout store", () => {
  it("starts empty", () => {
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress).toBeNull();
    expect(s.shippingMethod).toBeNull();
    expect(s.placedOrder).toBeNull();
  });

  it("setShipping stores address and method", () => {
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress?.firstName).toBe("Jane");
    expect(s.shippingMethod).toBe("royal-mail");
  });

  it("placeOrder snapshots cart + shipping, clears cart, returns id", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "dhl");
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toMatch(/^YNT-\d{8}-\d{4}$/);
    const s = useCheckoutStore.getState();
    expect(s.placedOrder?.id).toBe(id);
    expect(s.placedOrder?.items.length).toBe(1);
    expect(s.placedOrder?.carrier).toBe("dhl");
    expect(s.placedOrder?.shippingAddress.firstName).toBe("Jane");
    // cart cleared
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("placeOrder returns null when no shipping address set", () => {
    useCartStore.getState().addItem(item);
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toBeNull();
  });

  it("placeOrder returns null when cart is empty", () => {
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toBeNull();
  });

  it("getPlacedOrderById returns the snapshot", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const id = useCheckoutStore.getState().placeOrder()!;
    const order = useCheckoutStore.getState().getPlacedOrderById(id);
    expect(order?.id).toBe(id);
  });

  it("reset clears the store", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    useCheckoutStore.getState().placeOrder();
    useCheckoutStore.getState().reset();
    expect(useCheckoutStore.getState().placedOrder).toBeNull();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address, Carrier, Order } from "@/lib/schemas";
import { useCartStore } from "./cart-store";
import { generateOrderId } from "@/lib/checkout/format-order-id";

interface CheckoutState {
  shippingAddress: Address | null;
  shippingMethod: Carrier | null;
  placedOrder: Order | null;

  setShipping: (address: Address, method: Carrier) => void;
  placeOrder: () => string | null;
  getPlacedOrderById: (id: string) => Order | null;
  reset: () => void;
}

function estimatedDeliveryDate(carrier: Carrier): string {
  const days = carrier === "royal-mail" ? 3 : 9;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      shippingAddress: null,
      shippingMethod: null,
      placedOrder: null,

      setShipping: (address, method) =>
        set({ shippingAddress: address, shippingMethod: method }),

      placeOrder: () => {
        const { shippingAddress, shippingMethod } = get();
        const cart = useCartStore.getState();
        if (!shippingAddress || !shippingMethod) return null;
        if (cart.items.length === 0) return null;

        const subtotal = cart.subtotal();
        const id = generateOrderId(new Date(), Math.floor(Math.random() * 9999));
        const order: Order = {
          id,
          createdAt: new Date().toISOString(),
          status: "new",
          items: cart.items,
          subtotal,
          shipping: 0,
          total: subtotal,
          currency: "GBP",
          carrier: shippingMethod,
          trackingNumber: null,
          shippingAddress,
          estimatedDeliveryDate: estimatedDeliveryDate(shippingMethod),
        };

        set({ placedOrder: order });
        cart.clear();
        return id;
      },

      getPlacedOrderById: (id) => {
        const order = get().placedOrder;
        return order && order.id === id ? order : null;
      },

      reset: () =>
        set({
          shippingAddress: null,
          shippingMethod: null,
          placedOrder: null,
        }),
    }),
    {
      name: "ynot-checkout",
      partialize: (state) => ({
        shippingAddress: state.shippingAddress,
        shippingMethod: state.shippingMethod,
        placedOrder: state.placedOrder,
      }),
    },
  ),
);
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/stores/checkout-store.ts src/lib/stores/__tests__/checkout-store.test.ts
git commit -m "feat(state): add checkout Zustand store (shipping + placeOrder snapshot)"
```

---

# Section C — Checkout primitives

### Task 4: CheckoutHeader (minimal chrome)

**Files:**
- Create: `src/components/checkout/checkout-header.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import logoBlack from "../../../public/brand/ynot-logo-black.png";

export function CheckoutHeader() {
  return (
    <header className="w-full border-b border-border-light bg-surface-primary">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-5 md:px-10">
        <span className="text-[11px] uppercase tracking-[0.25em] text-foreground-secondary">
          Secure checkout
        </span>
        <Link href="/" aria-label="YNOT London" className="relative block h-8 w-[64px]">
          <Image src={logoBlack} alt="YNOT London" fill sizes="80px" priority className="object-contain" />
        </Link>
        <span className="text-[11px] uppercase tracking-[0.25em] text-foreground-secondary">
          256-bit SSL
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/checkout/checkout-header.tsx
git commit -m "feat(checkout): add minimal CheckoutHeader (logo + secure-checkout hints)"
```

---

### Task 5: CheckoutProgress

**Files:**
- Create: `src/components/checkout/checkout-progress.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  { num: 1, label: "Shipping" },
  { num: 2, label: "Payment" },
  { num: 3, label: "Confirmation" },
] as const;

export interface CheckoutProgressProps {
  current: 1 | 2 | 3;
}

export function CheckoutProgress({ current }: CheckoutProgressProps) {
  return (
    <ol className="flex items-center gap-4 md:gap-6">
      {STEPS.map((s, i) => {
        const active = current === s.num;
        const done = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <li className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  active && "bg-foreground-primary text-foreground-inverse",
                  done && "bg-foreground-primary text-foreground-inverse",
                  !active && !done && "border border-border-dark text-foreground-secondary",
                )}
              >
                {done ? "✓" : s.num}
              </span>
              <span
                className={cn(
                  "text-[12px] uppercase tracking-[0.2em]",
                  active ? "text-foreground-primary" : "text-foreground-secondary",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border-dark md:w-12" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/checkout/checkout-progress.tsx
git commit -m "feat(checkout): add CheckoutProgress 1-2-3 indicator"
```

---

### Task 6: ShippingMethodPicker

**Files:**
- Create: `src/components/checkout/shipping-method-picker.tsx`

- [ ] **Step 1:** Implement (wraps RadioGroup primitive):

```tsx
"use client";

import * as React from "react";
import { RadioGroup } from "@/components/ui/radio-group";
import type { Carrier } from "@/lib/schemas";

export interface ShippingMethodPickerProps {
  value: Carrier;
  onChange: (carrier: Carrier) => void;
}

export function ShippingMethodPicker({ value, onChange }: ShippingMethodPickerProps) {
  return (
    <RadioGroup
      name="shipping-method"
      value={value}
      onChange={(v) => onChange(v as Carrier)}
      options={[
        {
          value: "royal-mail",
          label: "Royal Mail — Free",
          description: "2–3 business days",
        },
        {
          value: "dhl",
          label: "DHL Worldwide — Free",
          description: "8–10 business days",
        },
      ]}
    />
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/checkout/shipping-method-picker.tsx
git commit -m "feat(checkout): add ShippingMethodPicker wrapping RadioGroup"
```

---

### Task 7: OrderSummaryCard

**Files:**
- Create: `src/components/checkout/order-summary-card.tsx`

- [ ] **Step 1:** Implement (client — reads cart store):

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export function OrderSummaryCard() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  return (
    <aside className="border border-border-light p-6 bg-surface-primary">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
        Order summary
      </h3>
      <ul className="divide-y divide-border-light">
        {items.map((item) => (
          <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-4">
            <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
              <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <p className="text-[13px] font-medium">{item.name}</p>
              <p className="text-[12px] text-foreground-secondary">
                Size {item.size} · Qty {item.quantity}
              </p>
              <p className="text-[13px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-border-light pt-4 text-[13px]">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Subtotal</span>
          <span>{formatPrice(subtotal, "GBP")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Shipping</span>
          <span>Free</span>
        </div>
        <div className="flex justify-between border-t border-border-light pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotal, "GBP")}</span>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/checkout/order-summary-card.tsx
git commit -m "feat(checkout): add sticky OrderSummaryCard reading from cart store"
```

---

### Task 8: ShippingForm

**Files:**
- Create: `src/components/checkout/shipping-form.tsx`
- Create: `src/components/checkout/__tests__/shipping-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShippingForm } from "../shipping-form";

describe("ShippingForm", () => {
  it("submits collected address + method when all fields valid", async () => {
    const onSubmit = vi.fn();
    render(<ShippingForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/phone/i), "7700900123");
    await userEvent.type(screen.getByLabelText(/street address/i), "42 King's Road");
    await userEvent.type(screen.getByLabelText(/city/i), "London");
    await userEvent.type(screen.getByLabelText(/postcode/i), "SW3 4ND");
    // country defaults to GB; carrier defaults to royal-mail

    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.address.firstName).toBe("Jane");
    expect(args.address.line1).toBe("42 King's Road");
    expect(args.method).toBe("royal-mail");
  });

  it("does not submit when required fields are missing", async () => {
    const onSubmit = vi.fn();
    render(<ShippingForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { ShippingMethodPicker } from "./shipping-method-picker";
import type { Address, Carrier } from "@/lib/schemas";

export interface ShippingFormSubmit {
  address: Address;
  method: Carrier;
}

export interface ShippingFormProps {
  defaults?: Partial<Address>;
  defaultMethod?: Carrier;
  onSubmit: (data: ShippingFormSubmit) => void;
}

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
];

export function ShippingForm({ defaults, defaultMethod = "royal-mail", onSubmit }: ShippingFormProps) {
  const [firstName, setFirstName] = React.useState(defaults?.firstName ?? "");
  const [lastName, setLastName] = React.useState(defaults?.lastName ?? "");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState(defaults?.phone ?? "");
  const [line1, setLine1] = React.useState(defaults?.line1 ?? "");
  const [city, setCity] = React.useState(defaults?.city ?? "");
  const [postcode, setPostcode] = React.useState(defaults?.postcode ?? "");
  const [country, setCountry] = React.useState(defaults?.country ?? "GB");
  const [method, setMethod] = React.useState<Carrier>(defaultMethod);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !line1 || !city || !postcode) return;
    onSubmit({
      address: {
        firstName,
        lastName,
        line1,
        line2: null,
        city,
        postcode,
        country,
        phone,
      },
      method,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Shipping information
        </legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="email@example.com"
            required
          />
          <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        </div>
        <Input
          label="Street address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          autoComplete="address-line1"
          required
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            required
          />
          <Input
            label="Postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            autoComplete="postal-code"
            required
          />
          <Select
            label="Country"
            value={country}
            onChange={setCountry}
            options={COUNTRIES}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Shipping method
        </legend>
        <ShippingMethodPicker value={method} onChange={setMethod} />
      </fieldset>

      <Button type="submit" size="lg" fullWidth>
        Continue to payment
      </Button>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/checkout/shipping-form.tsx src/components/checkout/__tests__/shipping-form.test.tsx
git commit -m "feat(checkout): add ShippingForm with method picker"
```

---

### Task 9: PaymentForm

**Files:**
- Create: `src/components/checkout/payment-form.tsx`
- Create: `src/components/checkout/__tests__/payment-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentForm } from "../payment-form";

describe("PaymentForm", () => {
  it("calls onPay when card fields are filled", async () => {
    const onPay = vi.fn();
    render(<PaymentForm totalLabel="£500" onPay={onPay} />);
    await userEvent.type(screen.getByLabelText(/card number/i), "4242424242424242");
    await userEvent.type(screen.getByLabelText(/expiry date/i), "12 / 30");
    await userEvent.type(screen.getByLabelText(/cvc/i), "123");
    await userEvent.type(screen.getByLabelText(/name on card/i), "Jane Doe");
    await userEvent.click(screen.getByRole("button", { name: /pay £500/i }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it("does not call onPay when card number is empty", async () => {
    const onPay = vi.fn();
    render(<PaymentForm totalLabel="£500" onPay={onPay} />);
    await userEvent.click(screen.getByRole("button", { name: /pay £500/i }));
    expect(onPay).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CardInput, type CardValue } from "@/components/ui/card-input";
import { Button } from "@/components/ui/button";

export interface PaymentFormProps {
  totalLabel: string;
  onPay: () => void;
}

export function PaymentForm({ totalLabel, onPay }: PaymentFormProps) {
  const [card, setCard] = React.useState<CardValue>({
    number: "",
    expiry: "",
    cvc: "",
  });
  const [nameOnCard, setNameOnCard] = React.useState("");
  const [billingSame, setBillingSame] = React.useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!card.number || !card.expiry || !card.cvc || !nameOnCard) return;
    onPay();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Payment details
        </legend>
        <CardInput value={card} onChange={setCard} />
        <Input
          label="Name on card"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          autoComplete="cc-name"
          placeholder="Full name as on card"
          required
        />
      </fieldset>

      <Checkbox
        label="Billing address same as shipping"
        checked={billingSame}
        onChange={(e) => setBillingSame(e.target.checked)}
      />

      <Button type="submit" size="lg" fullWidth>
        Pay {totalLabel}
      </Button>

      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
        256-bit SSL encrypted payment
      </p>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/checkout/payment-form.tsx src/components/checkout/__tests__/payment-form.test.tsx
git commit -m "feat(checkout): add PaymentForm with billing-same-as-shipping checkbox"
```

---

### Task 10: ConfirmationLayout

**Files:**
- Create: `src/components/checkout/confirmation-layout.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";
import { CheckoutProgress } from "./checkout-progress";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/schemas";

export function ConfirmationLayout({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center text-center">
        <Display level="lg" as="h1">Thank you for your order</Display>
        <p className="mt-3 text-[13px] uppercase tracking-[0.2em] text-foreground-secondary">
          Order #{order.id}
        </p>
        <p className="mt-3 max-w-md text-[14px] text-foreground-secondary">
          A confirmation email has been sent to your email address. We&rsquo;ll let you know when your order ships.
        </p>
      </div>

      <CheckoutProgress current={3} />

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Order details
          </h3>
          <ul className="divide-y divide-border-light">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.size}`} className="flex justify-between py-3 text-[13px]">
                <span>
                  {item.name} <span className="text-foreground-secondary">· Size {item.size} · Qty {item.quantity}</span>
                </span>
                <span>{formatPrice(item.unitPrice * item.quantity, "GBP")}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-border-light pt-4 text-[14px] font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total, "GBP")}</span>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping details
          </h3>
          <p className="text-[13px] leading-relaxed">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
            {order.shippingAddress.line1}<br />
            {order.shippingAddress.line2 && (<>{order.shippingAddress.line2}<br /></>)}
            {order.shippingAddress.city}, {order.shippingAddress.postcode}<br />
            {order.shippingAddress.country}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-foreground-secondary">Shipping method</p>
              <p>{order.carrier === "royal-mail" ? "Royal Mail — 2–3 business days" : "DHL — 8–10 business days"}</p>
            </div>
            <div>
              <p className="text-foreground-secondary">Estimated delivery</p>
              <p>{order.estimatedDeliveryDate}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-center">
        <Link href="/">
          <Button size="lg">Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/checkout/confirmation-layout.tsx
git commit -m "feat(checkout): add ConfirmationLayout for step 3 success"
```

---

# Section D — Checkout layout + step pages

### Task 11: Checkout group layout

**Files:**
- Create: `src/app/checkout/layout.tsx`

- [ ] **Step 1:** Implement (overrides root chrome with minimal CheckoutHeader):

```tsx
import * as React from "react";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

export const metadata = {
  title: "Checkout · YNOT London",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CheckoutHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="I have a question about my order." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/checkout/layout.tsx
git commit -m "feat(checkout): add minimal layout for /checkout/* routes"
```

---

### Task 12: Step 1 — `/checkout/shipping`

**Files:**
- Create: `src/app/checkout/shipping/page.tsx`

- [ ] **Step 1:** Implement (client — needs cart store + checkout store + router):

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";
import { ShippingForm, type ShippingFormSubmit } from "@/components/checkout/shipping-form";
import { OrderSummaryCard } from "@/components/checkout/order-summary-card";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import { useCartStore } from "@/lib/stores/cart-store";

export default function CheckoutShippingPage() {
  const router = useRouter();
  const setShipping = useCheckoutStore((s) => s.setShipping);
  const itemCount = useCartStore((s) => s.itemCount());

  React.useEffect(() => {
    if (itemCount === 0) router.push("/");
  }, [itemCount, router]);

  const onSubmit = (data: ShippingFormSubmit) => {
    setShipping(data.address, data.method);
    router.push("/checkout/payment");
  };

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={1} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <ShippingForm onSubmit={onSubmit} />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/checkout/shipping/page.tsx
git commit -m "feat(checkout): add /checkout/shipping step 1 page"
```

---

### Task 13: Step 2 — `/checkout/payment`

**Files:**
- Create: `src/app/checkout/payment/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";
import { PaymentForm } from "@/components/checkout/payment-form";
import { OrderSummaryCard } from "@/components/checkout/order-summary-card";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const subtotal = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.itemCount());
  const shippingAddress = useCheckoutStore((s) => s.shippingAddress);
  const placeOrder = useCheckoutStore((s) => s.placeOrder);

  React.useEffect(() => {
    if (itemCount === 0) {
      router.push("/");
      return;
    }
    if (!shippingAddress) {
      router.push("/checkout/shipping");
    }
  }, [itemCount, shippingAddress, router]);

  const onPay = () => {
    const id = placeOrder();
    if (id) router.push(`/checkout/success/${id}`);
  };

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={2} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <PaymentForm totalLabel={formatPrice(subtotal, "GBP")} onPay={onPay} />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/checkout/payment/page.tsx
git commit -m "feat(checkout): add /checkout/payment step 2 page"
```

---

### Task 14: Step 3 — `/checkout/success/[id]`

**Files:**
- Create: `src/app/checkout/success/[id]/page.tsx`

- [ ] **Step 1:** Implement (client — reads from checkout store; falls back to "Order not found"):

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ConfirmationLayout } from "@/components/checkout/confirmation-layout";
import { Button } from "@/components/ui/button";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import Link from "next/link";

export default function CheckoutSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const order = useCheckoutStore((s) => s.getPlacedOrderById(id));

  React.useEffect(() => {
    // No-op: just to mark client mount; rendering handled below
  }, [router]);

  if (!order) {
    return (
      <Section padding="md">
        <Container size="narrow" className="text-center">
          <h1 className="font-heading text-[36px] mb-4">Order not found</h1>
          <p className="text-[14px] text-foreground-secondary mb-8">
            We couldn&rsquo;t find the order with id <code>{id}</code>. It may have been completed in another session.
          </p>
          <Link href="/"><Button>Back to home</Button></Link>
        </Container>
      </Section>
    );
  }

  return (
    <Section padding="md">
      <Container size="wide">
        <ConfirmationLayout order={order} />
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Smoke (start dev briefly, hit /checkout/shipping, /checkout/payment, /checkout/success/test → all 200; kill dev):
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "/checkout/shipping → HTTP %{http_code}\n" http://localhost:3000/checkout/shipping
curl -s -o /dev/null -w "/checkout/payment → HTTP %{http_code}\n" http://localhost:3000/checkout/payment
curl -s -o /dev/null -w "/checkout/success/test → HTTP %{http_code}\n" http://localhost:3000/checkout/success/test
pkill -f "next dev" 2>/dev/null || true
```
Expected: all 200.

- [ ] **Step 4:** Commit:
```bash
git add src/app/checkout/success/[id]/page.tsx
git commit -m "feat(checkout): add /checkout/success/[id] step 3 confirmation page"
```

---

# Section E — Verification

### Task 15: Final gate + tag

- [ ] **Step 1:** Tests:
```bash
pnpm test
```
Expected: all tests pass (100 baseline + checkout-store tests + format-order-id + shipping-form + payment-form ≈ 113).

- [ ] **Step 2:** Build:
```bash
pnpm build
```
Expected: routes include `/checkout/shipping`, `/checkout/payment`, `/checkout/success/[id]`.

- [ ] **Step 3:** Lint:
```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 4:** Tag:
```bash
git tag phase-4-checkout-complete
git log --oneline -1
```

---

## Self-Review

- ✅ Spec coverage: 3-step checkout (shipping → payment → success), minimal CheckoutHeader, ShippingForm w/ method picker, PaymentForm w/ billing-same checkbox + 256-bit SSL hint, OrderSummaryCard sticky right, ConfirmationLayout with order details + shipping details + estimated delivery.
- ✅ Empty cart on shipping page → redirect to home.
- ✅ Missing shipping address on payment page → redirect to shipping.
- ✅ placeOrder snapshots cart + clears it; success page reads from store by id.
- ✅ All forms server-state-driven (controlled inputs with React state, no React Hook Form needed for this depth).
- ✅ Pre-order line items already labeled in cart drawer (Phase 2); cart→checkout passes them through unchanged.

## Out-of-scope

- Real Stripe Elements (deferred per spec; CardInput stub used)
- Real order persistence (no API yet; placedOrder lives only in client store)
- Auth-conversion prompt for guests on success page (low priority polish)
- Animation pass (per spec)

## Execution

Subagent-driven, section-batched (A worktree → B store + helper → C primitives → D layout + 3 step pages → E verify).
