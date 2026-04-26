# YNOT Storefront — Phase 6: Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Ship the customer account surface — `/account` with shared layout, sticky tab nav (Orders / Pre-orders / Addresses / Profile / Sign Out), and 6 sub-routes (`/account`, `/account/orders`, `/account/orders/[id]`, `/account/pre-orders`, `/account/addresses`, `/account/profile`). Auth-gated client-side via `useAuthStubStore` — visiting any `/account/*` route while signed out redirects to `/sign-in?next=/account/...`. Sign-Out tab clears the auth stub and routes to `/`.

**Architecture:** A dedicated `src/app/account/layout.tsx` mounts `AccountLayout` (Welcome heading + tab nav reading the current pathname for active state). Each sub-route renders its own panel content (Orders list, Order detail, Pre-orders list, Address grid, Profile form). Orders & pre-orders read from `getOrdersForCurrentUser()` (Phase 1). Addresses get a new mock JSON + adapter that mirrors the cart-store pattern (in-memory + localStorage persistence). Profile reads from auth-stub store. No backend yet — all writes are stubbed (logged + toast).

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Zustand 5, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § Account Dashboard.

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-6-account` (NEW worktree).

**Prerequisites in main:** Phases 1-5 (124 tests).

---

## File structure

```
web/
├── src/
│   ├── lib/
│   │   ├── data/
│   │   │   ├── _mock/addresses.json         [created]
│   │   │   └── addresses.ts                  [created]
│   │   └── stores/
│   │       └── addresses-store.ts            [created — local mutable address book]
│   ├── components/
│   │   └── account/
│   │       ├── account-layout.tsx            [created]
│   │       ├── account-tabs.tsx              [created]
│   │       ├── order-status-badge.tsx        [created]
│   │       ├── order-list-item.tsx           [created]
│   │       ├── order-detail-layout.tsx       [created]
│   │       ├── address-card.tsx              [created]
│   │       ├── address-form-modal.tsx        [created]
│   │       └── profile-form.tsx              [created]
│   └── app/
│       └── account/
│           ├── layout.tsx                    [created — auth gate]
│           ├── page.tsx                      [created — redirects to /account/orders]
│           ├── orders/page.tsx               [created — list]
│           ├── orders/[id]/page.tsx          [created — detail]
│           ├── pre-orders/page.tsx           [created]
│           ├── addresses/page.tsx            [created]
│           └── profile/page.tsx              [created]
└── (no other changes)
```

---

# Section A — Worktree

### Task 1

- [ ] **Step 1:**
```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git worktree add .worktrees/phase-6-account -b feature/phase-6-account
```

- [ ] **Step 2:**
```bash
cd .worktrees/phase-6-account
pnpm install --frozen-lockfile
pnpm build
pnpm test
```
Expected: 124 tests pass, build green.

---

# Section B — Address store + mock

### Task 2: Address mock + adapter

**Files:**
- Create: `src/lib/data/_mock/addresses.json`
- Create: `src/lib/data/addresses.ts`
- Create: `src/lib/data/__tests__/addresses.test.ts`

- [ ] **Step 1:** Create `src/lib/data/_mock/addresses.json`:

```json
[
  {
    "id": "addr_001",
    "label": "Home",
    "isDefault": true,
    "address": {
      "firstName": "Jane",
      "lastName": "Doe",
      "line1": "42 King's Road",
      "line2": null,
      "city": "London",
      "postcode": "SW3 4ND",
      "country": "GB",
      "phone": "+44 7700 900123"
    }
  },
  {
    "id": "addr_002",
    "label": "Work",
    "isDefault": false,
    "address": {
      "firstName": "Jane",
      "lastName": "Doe",
      "line1": "15 Portobello Road",
      "line2": null,
      "city": "London",
      "postcode": "W11 3DA",
      "country": "GB",
      "phone": "+44 7700 900123"
    }
  }
]
```

- [ ] **Step 2:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { getSavedAddresses } from "../addresses";

describe("addresses adapter", () => {
  it("returns the seeded addresses with default first", async () => {
    const list = await getSavedAddresses();
    expect(list.length).toBe(2);
    expect(list[0].isDefault).toBe(true);
  });
});
```

- [ ] **Step 3:** Run, fail.

- [ ] **Step 4:** Implement `src/lib/data/addresses.ts`:

```ts
import { z } from "zod";
import { AddressSchema, type Address } from "../schemas";
import addressesJson from "./_mock/addresses.json";

export const SavedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean(),
  address: AddressSchema,
});

export type SavedAddress = z.infer<typeof SavedAddressSchema>;

let cache: SavedAddress[] | null = null;

function load(): SavedAddress[] {
  if (cache) return cache;
  cache = addressesJson.map((a) => SavedAddressSchema.parse(a));
  cache.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return cache;
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  return load();
}
```

- [ ] **Step 5:** Run, pass.

- [ ] **Step 6:** Commit:
```bash
git add src/lib/data/_mock/addresses.json src/lib/data/addresses.ts src/lib/data/__tests__/addresses.test.ts
git commit -m "feat(data): add addresses mock + adapter (2 seeded addresses)"
```

---

### Task 3: Addresses Zustand store (local CRUD)

**Files:**
- Create: `src/lib/stores/addresses-store.ts`
- Create: `src/lib/stores/__tests__/addresses-store.test.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAddressesStore } from "../addresses-store";
import type { Address } from "@/lib/schemas";

const baseAddress: Address = {
  firstName: "Jane",
  lastName: "Doe",
  line1: "42 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

beforeEach(() => {
  useAddressesStore.setState({ addresses: [] });
});

describe("addresses store", () => {
  it("starts empty until hydrate is called", () => {
    expect(useAddressesStore.getState().addresses).toEqual([]);
  });

  it("hydrate seeds the store but does not overwrite if already populated", () => {
    useAddressesStore.getState().hydrate([{ id: "x", label: "x", isDefault: true, address: baseAddress }]);
    expect(useAddressesStore.getState().addresses.length).toBe(1);
    useAddressesStore.getState().hydrate([{ id: "y", label: "y", isDefault: false, address: baseAddress }]);
    // Already populated -> hydrate is a no-op
    expect(useAddressesStore.getState().addresses[0].id).toBe("x");
  });

  it("addAddress appends with a generated id", () => {
    useAddressesStore.getState().addAddress({ label: "Mum", address: baseAddress });
    const list = useAddressesStore.getState().addresses;
    expect(list.length).toBe(1);
    expect(list[0].id).toMatch(/^addr_/);
    expect(list[0].label).toBe("Mum");
  });

  it("updateAddress mutates by id", () => {
    useAddressesStore.getState().addAddress({ label: "Home", address: baseAddress });
    const id = useAddressesStore.getState().addresses[0].id;
    useAddressesStore.getState().updateAddress(id, { label: "Home (renamed)" });
    expect(useAddressesStore.getState().addresses[0].label).toBe("Home (renamed)");
  });

  it("deleteAddress removes by id", () => {
    useAddressesStore.getState().addAddress({ label: "x", address: baseAddress });
    const id = useAddressesStore.getState().addresses[0].id;
    useAddressesStore.getState().deleteAddress(id);
    expect(useAddressesStore.getState().addresses.length).toBe(0);
  });

  it("setDefault flips the default flag exclusively", () => {
    useAddressesStore.getState().addAddress({ label: "A", address: baseAddress, isDefault: true });
    useAddressesStore.getState().addAddress({ label: "B", address: baseAddress });
    const idB = useAddressesStore.getState().addresses[1].id;
    useAddressesStore.getState().setDefault(idB);
    const list = useAddressesStore.getState().addresses;
    expect(list.find((a) => a.id === idB)?.isDefault).toBe(true);
    expect(list.filter((a) => a.isDefault).length).toBe(1);
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address } from "@/lib/schemas";
import type { SavedAddress } from "@/lib/data/addresses";

let nextSeq = 100;
function nextId(): string {
  nextSeq += 1;
  return `addr_${String(nextSeq).padStart(3, "0")}`;
}

interface AddressesState {
  addresses: SavedAddress[];
  hydrate: (initial: SavedAddress[]) => void;
  addAddress: (input: { label: string; address: Address; isDefault?: boolean }) => void;
  updateAddress: (id: string, patch: { label?: string; address?: Address }) => void;
  deleteAddress: (id: string) => void;
  setDefault: (id: string) => void;
}

export const useAddressesStore = create<AddressesState>()(
  persist(
    (set, get) => ({
      addresses: [],

      hydrate: (initial) => {
        if (get().addresses.length > 0) return;
        set({ addresses: initial });
      },

      addAddress: ({ label, address, isDefault = false }) =>
        set((state) => {
          const id = nextId();
          const incoming: SavedAddress = { id, label, isDefault, address };
          if (isDefault) {
            return {
              addresses: [
                incoming,
                ...state.addresses.map((a) => ({ ...a, isDefault: false })),
              ],
            };
          }
          return { addresses: [...state.addresses, incoming] };
        }),

      updateAddress: (id, patch) =>
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id
              ? {
                  ...a,
                  label: patch.label ?? a.label,
                  address: patch.address ?? a.address,
                }
              : a,
          ),
        })),

      deleteAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      setDefault: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        })),
    }),
    { name: "ynot-addresses" },
  ),
);
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/stores/addresses-store.ts src/lib/stores/__tests__/addresses-store.test.ts
git commit -m "feat(state): add addresses Zustand store (local CRUD with persist)"
```

---

# Section C — Account UI

### Task 4: OrderStatusBadge

**Files:**
- Create: `src/components/account/order-status-badge.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/schemas";

const palette: Record<OrderStatus, string> = {
  new: "bg-surface-secondary text-foreground-on-cream",
  processing: "bg-accent-warm/20 text-accent-warm",
  shipped: "bg-foreground-primary text-foreground-inverse",
  delivered: "bg-success/15 text-success",
  returned: "bg-error/15 text-error",
};

const labels: Record<OrderStatus, string> = {
  new: "New",
  processing: "Processing",
  shipped: "In transit",
  delivered: "Delivered",
  returned: "Returned",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
        palette[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/order-status-badge.tsx
git commit -m "feat(account): add OrderStatusBadge with colour palette per status"
```

---

### Task 5: OrderListItem

**Files:**
- Create: `src/components/account/order-list-item.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Link from "next/link";
import type { Order } from "@/lib/schemas";
import { formatPrice } from "@/lib/format";
import { OrderStatusBadge } from "./order-status-badge";

export function OrderListItem({ order }: { order: Order }) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <li className="border-b border-border-light py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
            Order #{order.id}
          </p>
          <p className="text-[14px] text-foreground-primary">
            {date} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <OrderStatusBadge status={order.status} />
          <p className="text-[14px] font-medium">{formatPrice(order.total, "GBP")}</p>
          <Link
            href={`/account/orders/${order.id}`}
            className="text-[12px] uppercase tracking-[0.15em] underline hover:no-underline"
          >
            View details
          </Link>
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/order-list-item.tsx
git commit -m "feat(account): add OrderListItem row with status + total + details link"
```

---

### Task 6: OrderDetailLayout

**Files:**
- Create: `src/components/account/order-detail-layout.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Order } from "@/lib/schemas";
import { formatPrice } from "@/lib/format";
import { OrderStatusBadge } from "./order-status-badge";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

const trackingUrl = (carrier: Order["carrier"], tracking: string | null) => {
  if (!tracking) return null;
  return carrier === "royal-mail"
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${tracking}`
    : `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
};

export function OrderDetailLayout({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const carrierLabel =
    order.carrier === "royal-mail"
      ? "Royal Mail — 2–3 business days"
      : "DHL — 8–10 business days";
  const tracking = trackingUrl(order.carrier, order.trackingNumber);
  const eligibleForReturn = order.status === "delivered";

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
            Order #{order.id}
          </p>
          <Display level="md" as="h1">{date}</Display>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
          Items
        </h2>
        <ul className="divide-y divide-border-light">
          {order.items.map((item) => (
            <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-5">
              <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="text-[14px] font-medium">{item.name}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {item.colour} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-[14px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-between border-t border-border-light pt-4 text-[14px] font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.total, "GBP")}</span>
        </div>
      </section>

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping address
          </h2>
          <p className="text-[13px] leading-relaxed">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
            {order.shippingAddress.line1}<br />
            {order.shippingAddress.line2 && (<>{order.shippingAddress.line2}<br /></>)}
            {order.shippingAddress.city}, {order.shippingAddress.postcode}<br />
            {order.shippingAddress.country}
          </p>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping method
          </h2>
          <p className="text-[13px]">{carrierLabel}</p>
          {tracking ? (
            <a
              href={tracking}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[12px] uppercase tracking-[0.15em] underline hover:no-underline"
            >
              Track shipment ({order.trackingNumber})
            </a>
          ) : (
            <p className="mt-3 text-[12px] text-foreground-secondary">
              Tracking number will appear here once the order ships.
            </p>
          )}
          <p className="mt-4 text-[12px] text-foreground-secondary">
            Estimated delivery: <span className="text-foreground-primary">{order.estimatedDeliveryDate}</span>
          </p>
        </section>
      </div>

      {eligibleForReturn && (
        <div className="border-t border-border-light pt-8 flex justify-end">
          <Link href="/initiate-return">
            <Button variant="outline">Initiate a return</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/order-detail-layout.tsx
git commit -m "feat(account): add OrderDetailLayout with tracking + return CTA"
```

---

### Task 7: AddressCard

**Files:**
- Create: `src/components/account/address-card.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import type { SavedAddress } from "@/lib/data/addresses";
import { Button } from "@/components/ui/button";

export interface AddressCardProps {
  saved: SavedAddress;
  onEdit: (saved: SavedAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function AddressCard({ saved, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  const a = saved.address;
  return (
    <article className="border border-border-light p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-primary">
          {saved.label}
        </h3>
        {saved.isDefault && (
          <span className="text-[11px] uppercase tracking-[0.15em] text-accent-warm">
            Default
          </span>
        )}
      </header>
      <p className="text-[13px] leading-relaxed text-foreground-primary">
        {a.firstName} {a.lastName}<br />
        {a.line1}<br />
        {a.line2 && (<>{a.line2}<br /></>)}
        {a.city}, {a.postcode}<br />
        {a.country}
      </p>
      <div className="flex flex-wrap gap-3 mt-auto">
        <Button variant="outline" size="sm" onClick={() => onEdit(saved)}>Edit</Button>
        {!saved.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => onSetDefault(saved.id)}>Set default</Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDelete(saved.id)}>Delete</Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/address-card.tsx
git commit -m "feat(account): add AddressCard with edit/delete/set-default actions"
```

---

### Task 8: AddressFormModal

**Files:**
- Create: `src/components/account/address-form-modal.tsx`

- [ ] **Step 1:** Implement (uses existing Modal primitive):

```tsx
"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import type { Address } from "@/lib/schemas";
import type { SavedAddress } from "@/lib/data/addresses";

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
];

export interface AddressFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string; address: Address }) => void;
  initial?: SavedAddress;
}

export function AddressFormModal({ open, onClose, onSubmit, initial }: AddressFormModalProps) {
  const [label, setLabel] = React.useState(initial?.label ?? "Home");
  const [firstName, setFirstName] = React.useState(initial?.address.firstName ?? "");
  const [lastName, setLastName] = React.useState(initial?.address.lastName ?? "");
  const [line1, setLine1] = React.useState(initial?.address.line1 ?? "");
  const [city, setCity] = React.useState(initial?.address.city ?? "");
  const [postcode, setPostcode] = React.useState(initial?.address.postcode ?? "");
  const [country, setCountry] = React.useState(initial?.address.country ?? "GB");
  const [phone, setPhone] = React.useState(initial?.address.phone ?? "");

  React.useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? "Home");
    setFirstName(initial?.address.firstName ?? "");
    setLastName(initial?.address.lastName ?? "");
    setLine1(initial?.address.line1 ?? "");
    setCity(initial?.address.city ?? "");
    setPostcode(initial?.address.postcode ?? "");
    setCountry(initial?.address.country ?? "GB");
    setPhone(initial?.address.phone ?? "");
  }, [open, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !firstName || !lastName || !line1 || !city || !postcode) return;
    onSubmit({
      label,
      address: { firstName, lastName, line1, line2: null, city, postcode, country, phone },
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit address" : "Add address"} width="min(560px, 95vw)">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input label="Label (Home, Work, etc.)" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input label="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} required />
        <div className="grid gap-5 md:grid-cols-3">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input label="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
          <Select label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
        </div>
        <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" size="md" type="button" onClick={onClose}>Cancel</Button>
          <Button size="md" type="submit">{initial ? "Save changes" : "Add address"}</Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/address-form-modal.tsx
git commit -m "feat(account): add AddressFormModal for create/edit"
```

---

### Task 9: ProfileForm

**Files:**
- Create: `src/components/account/profile-form.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export interface ProfileFormSubmit {
  firstName: string;
  email: string;
  newPassword: string;
}

export interface ProfileFormProps {
  defaults: { firstName: string; email: string };
  onSubmit: (data: ProfileFormSubmit) => void;
}

export function ProfileForm({ defaults, onSubmit }: ProfileFormProps) {
  const [firstName, setFirstName] = React.useState(defaults.firstName);
  const [email, setEmail] = React.useState(defaults.email);
  const [newPassword, setNewPassword] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !email) return;
    onSubmit({ firstName, email, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-[480px]">
      <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <PasswordInput label="New password (leave blank to keep current)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <Button type="submit" size="lg">Save changes</Button>
    </form>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/profile-form.tsx
git commit -m "feat(account): add ProfileForm (name + email + change password)"
```

---

### Task 10: AccountTabs

**Files:**
- Create: `src/components/account/account-tabs.tsx`

- [ ] **Step 1:** Implement (sticky tabs, active state from current pathname):

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

interface Tab {
  href: string;
  label: string;
  matchPrefix?: string;
}

const TABS: Tab[] = [
  { href: "/account/orders", label: "Order history", matchPrefix: "/account/orders" },
  { href: "/account/pre-orders", label: "Pre-orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

export function AccountTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useAuthStubStore((s) => s.signOut);

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border-light pb-2">
      {TABS.map((t) => {
        const active = t.matchPrefix
          ? pathname.startsWith(t.matchPrefix)
          : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "text-[12px] uppercase tracking-[0.2em] py-2 border-b-2 -mb-[10px] transition-colors",
              active
                ? "border-foreground-primary text-foreground-primary"
                : "border-transparent text-foreground-secondary hover:text-foreground-primary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleSignOut}
        className="ml-auto text-[12px] uppercase tracking-[0.2em] py-2 text-foreground-secondary hover:text-foreground-primary"
      >
        Sign out
      </button>
    </nav>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/account-tabs.tsx
git commit -m "feat(account): add AccountTabs (sticky nav, active by pathname, sign-out)"
```

---

### Task 11: AccountLayout

**Files:**
- Create: `src/components/account/account-layout.tsx`

- [ ] **Step 1:** Implement (Welcome heading + tabs + content slot):

```tsx
"use client";

import * as React from "react";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";
import { Display } from "@/components/ui/typography";
import { AccountTabs } from "./account-tabs";

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStubStore((s) => s.user);
  const greeting = user ? `Welcome, ${user.firstName}` : "Account";
  return (
    <div className="flex flex-col gap-10">
      <Display level="lg" as="h1">{greeting}</Display>
      <AccountTabs />
      <div className="min-h-[40vh]">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/account/account-layout.tsx
git commit -m "feat(account): add AccountLayout (Welcome + tabs + content slot)"
```

---

# Section D — Account routes

### Task 12: `src/app/account/layout.tsx` (auth gate + AccountLayout wrap)

**Files:**
- Create: `src/app/account/layout.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { AccountLayout } from "@/components/account/account-layout";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

export default function AccountLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStubStore((s) => s.isAuthenticated());

  React.useEffect(() => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.replace(`/sign-in?next=${next}`);
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="md">
          <Container size="wide">
            <AccountLayout>{children}</AccountLayout>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question about my account." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/layout.tsx
git commit -m "feat(account): add /account layout shell with auth gate"
```

---

### Task 13: `/account` (default → /account/orders)

**Files:**
- Create: `src/app/account/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
import { redirect } from "next/navigation";

export default function AccountIndexPage() {
  redirect("/account/orders");
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/page.tsx
git commit -m "feat(account): /account redirects to /account/orders"
```

---

### Task 14: `/account/orders` (list)

**Files:**
- Create: `src/app/account/orders/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { getOrdersForCurrentUser } from "@/lib/data/orders";
import { OrderListItem } from "@/components/account/order-list-item";

export default async function AccountOrdersPage() {
  const orders = await getOrdersForCurrentUser();
  if (orders.length === 0) {
    return (
      <p className="text-[14px] text-foreground-secondary py-12">
        You haven&rsquo;t placed any orders yet.
      </p>
    );
  }
  return (
    <ul className="border-t border-border-light">
      {orders.map((o) => (
        <OrderListItem key={o.id} order={o} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/orders/page.tsx
git commit -m "feat(account): /account/orders list page"
```

---

### Task 15: `/account/orders/[id]` (detail)

**Files:**
- Create: `src/app/account/orders/[id]/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders";
import { OrderDetailLayout } from "@/components/account/order-detail-layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  return <OrderDetailLayout order={order} />;
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/orders/[id]/page.tsx
git commit -m "feat(account): /account/orders/[id] detail page"
```

---

### Task 16: `/account/pre-orders`

**Files:**
- Create: `src/app/account/pre-orders/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { getOrdersForCurrentUser } from "@/lib/data/orders";
import { OrderListItem } from "@/components/account/order-list-item";

export default async function AccountPreOrdersPage() {
  const orders = await getOrdersForCurrentUser();
  const preOrders = orders.filter((o) => o.items.some((i) => i.preOrder));
  if (preOrders.length === 0) {
    return (
      <p className="text-[14px] text-foreground-secondary py-12">
        You don&rsquo;t have any active pre-orders. Pre-order items will appear here with their estimated ship date.
      </p>
    );
  }
  return (
    <ul className="border-t border-border-light">
      {preOrders.map((o) => (
        <OrderListItem key={o.id} order={o} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/pre-orders/page.tsx
git commit -m "feat(account): /account/pre-orders filtered list"
```

---

### Task 17: `/account/addresses`

**Files:**
- Create: `src/app/account/addresses/page.tsx`

- [ ] **Step 1:** Implement (client — uses addresses store + modal):

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AddressCard } from "@/components/account/address-card";
import { AddressFormModal } from "@/components/account/address-form-modal";
import { useAddressesStore } from "@/lib/stores/addresses-store";
import type { SavedAddress } from "@/lib/data/addresses";
import type { Address } from "@/lib/schemas";

const SEED: SavedAddress[] = [
  {
    id: "addr_001",
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
  },
  {
    id: "addr_002",
    label: "Work",
    isDefault: false,
    address: {
      firstName: "Jane",
      lastName: "Doe",
      line1: "15 Portobello Road",
      line2: null,
      city: "London",
      postcode: "W11 3DA",
      country: "GB",
      phone: "+44 7700 900123",
    },
  },
];

export default function AccountAddressesPage() {
  const addresses = useAddressesStore((s) => s.addresses);
  const hydrate = useAddressesStore((s) => s.hydrate);
  const addAddress = useAddressesStore((s) => s.addAddress);
  const updateAddress = useAddressesStore((s) => s.updateAddress);
  const deleteAddress = useAddressesStore((s) => s.deleteAddress);
  const setDefault = useAddressesStore((s) => s.setDefault);

  const [editing, setEditing] = React.useState<SavedAddress | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    hydrate(SEED);
  }, [hydrate]);

  const onSubmit = (data: { label: string; address: Address }) => {
    if (editing) {
      updateAddress(editing.id, data);
    } else {
      addAddress(data);
    }
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add address
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {addresses.map((a) => (
          <AddressCard
            key={a.id}
            saved={a}
            onEdit={(s) => {
              setEditing(s);
              setOpen(true);
            }}
            onDelete={deleteAddress}
            onSetDefault={setDefault}
          />
        ))}
      </div>

      <AddressFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSubmit={onSubmit}
        initial={editing ?? undefined}
      />
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/account/addresses/page.tsx
git commit -m "feat(account): /account/addresses with CRUD + default flag"
```

---

### Task 18: `/account/profile`

**Files:**
- Create: `src/app/account/profile/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { ProfileForm, type ProfileFormSubmit } from "@/components/account/profile-form";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

export default function AccountProfilePage() {
  const user = useAuthStubStore((s) => s.user);
  const signIn = useAuthStubStore((s) => s.signIn);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  if (!user) return null;

  const onSubmit = (data: ProfileFormSubmit) => {
    // Stub: real backend persists later. For now, refresh in-memory user.
    signIn({ email: data.email, firstName: data.firstName });
    setSavedAt(new Date());
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm defaults={{ firstName: user.firstName, email: user.email }} onSubmit={onSubmit} />
      {savedAt && (
        <p className="text-[12px] uppercase tracking-[0.2em] text-success">
          Saved at {savedAt.toLocaleTimeString("en-GB")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Smoke (start dev briefly, hit all 6 routes, kill dev). All should return 200 (auth gate redirects happen client-side — server returns the page).
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 4
for route in /account /account/orders "/account/orders/YNT-2847" /account/pre-orders /account/addresses /account/profile; do
  curl -s -o /dev/null -w "$route → HTTP %{http_code}\n" "http://localhost:3000$route"
done
pkill -f "next dev" 2>/dev/null || true
```
Expected: all 200 (or /account 307 → /account/orders).

- [ ] **Step 4:** Commit:
```bash
git add src/app/account/profile/page.tsx
git commit -m "feat(account): /account/profile with save-confirmation badge"
```

---

# Section E — Verification

### Task 19: Final gate + tag

- [ ] **Step 1:** `pnpm test` — expect 132 (124 baseline + 1 addresses adapter + 6 addresses store + 1 spec from ProfileForm if added — verify final number).
- [ ] **Step 2:** `pnpm build` — confirm all 6 account routes appear.
- [ ] **Step 3:** `pnpm lint` — 0 errors.
- [ ] **Step 4:** Tag:
```bash
git tag phase-6-account-complete
git log --oneline -1
```

---

## Self-Review

- ✅ All 6 account routes built
- ✅ Auth gate redirects unauth to /sign-in?next=...
- ✅ Orders list reads getOrdersForCurrentUser; pre-orders filtered subset
- ✅ Order detail page renders OrderDetailLayout with tracking link + return CTA (when delivered)
- ✅ Address book CRUD via Zustand + modal form (uses Modal primitive)
- ✅ Profile updates auth-stub store in-memory (real backend later)
- ✅ Sign-out tab clears stub store and navigates home

## Out-of-scope

- Real account API (deferred — backend phase)
- Email change verification flow
- Order tracking webhook integration

## Execution

Subagent-driven, section-batched (A worktree → B store + adapter → C UI primitives → D 7 routes → E verify).
