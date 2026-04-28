# YNOT London — Backend Phase 3 — Auth & Customer

**Date:** 2026-04-29
**Status:** Draft (pending user review)
**Scope:** Phase 3 of 6 in the YNOT backend roadmap. Wires real authentication (Auth.js v5 + Prisma adapter), code-based email verification and password reset, server-side session gating, and address-book CRUD on top of the Phase 1 schema. Removes the `useAuthStubStore` Zustand store and replaces both Phase 2 `// PHASE 3:` stubs with `getSessionUser()`.

---

## 1. Context

Phase 1 (Foundation) defined the auth tables: `User`, `Account`, `Session`, `VerificationToken`, `Address`. Phase 2 (Catalog & CMS reads) shipped two `// PHASE 3:` stubs that hard-code the demo customer:

- `getOrdersForCurrentUser()` in `src/server/data/orders.ts`
- `getSavedAddresses()` in `src/server/data/addresses.ts`

The storefront ships every auth UI surface (sign-in, register, forgot-password, reset-password, account dashboard, profile) styled and form-validated through Zod. They wire into a client-side Zustand stub (`useAuthStubStore`) that fakes auth state in localStorage. Every account page also relies on a `useEffect` redirect in `src/app/account/layout.tsx`.

This phase replaces the stub with real authentication and turns each form into a real API call.

Subsequent phases (out of scope here):
- **Phase 4 — Cart, Checkout, Stripe:** server-side cart, payment intents, webhook.
- **Phase 5 — Orders & Fulfilment:** Royal Mail/DHL, transactional email templates layered on top of the email service introduced here.
- **Phase 6 — Admin Panel:** admin role check + RBAC.

---

## 2. Goals

1. Stand up Auth.js v5 with the Prisma adapter and database sessions backed by the existing `Session` table.
2. Implement code-based email verification (6-digit OTP) — required before first sign-in.
3. Implement code-based password reset (6-digit OTP).
4. Replace `useAuthStubStore` everywhere; gate `/account/*` server-side.
5. Replace both `// PHASE 3:` stubs with `getSessionUser()`.
6. Provide an email service abstraction with two implementations: **Resend** (production) and **Console** (dev fallback while waiting for Resend credentials).
7. Address-book CRUD: profile name change, password change, soft-delete account.
8. Rate-limit the abuse-prone routes via Redis.
9. Real-Postgres tests that drive every flow end-to-end (register → verify → sign-in → reset → re-sign-in).
10. Storefront UI rendering stays byte-identical — only the data sources behind the existing forms change.

## 3. Non-goals

- ❌ OAuth providers (Google, Apple, etc.) — only email + password in this phase.
- ❌ Magic-link sign-in (codes are simpler UX for the same problem; magic-link can be added later if requested).
- ❌ Bearer-token auth — confirmed no mobile/external API consumer in scope, so session cookies cover every consumer.
- ❌ "Remember me" toggle / extended sessions — single fixed 30-day rolling TTL.
- ❌ 2FA / TOTP — future phase.
- ❌ Admin role enforcement / RBAC — Phase 6.
- ❌ Stripe / cart / orders mutations — Phase 4.
- ❌ Real Resend HTML email templates with branded design — Phase 5 ships the styled templates; Phase 3 sends plain-text body containing the code.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Auth library | **Auth.js v5** (`@auth/core` + `@auth/prisma-adapter` + `next-auth@beta`) | Native Next.js 16 App Router support, official Prisma adapter targets the exact tables Phase 1 created (`User` / `Account` / `Session` / `VerificationToken`), credentials provider supports custom flow, server-side `auth()` helper integrates with Server Components and Route Handlers. |
| Session strategy | **Database sessions** via `Session` table | Revocable on password change, "sign out everywhere" works, no JWT secret rotation pain, aligns with the schema we already migrated. |
| Cookie | `ynot.session-token` HttpOnly Secure SameSite=Lax | Standard Auth.js cookie, locked down. |
| Password hashing | **bcryptjs** (already installed Phase 1) cost factor 10 | ~100ms per hash on dev laptop, acceptable for human-facing login speed and brute-force resistance. |
| Verification codes | 6 random digits via `crypto.randomInt(0, 1_000_000)` then zero-padded; TTL 15 min; single-use | Easier UX than magic-link, works on any email client, no deep linking needed. |
| Code storage | Existing `VerificationToken` table | Already in schema; `identifier` field becomes `verify:<email>` or `reset:<email>` to namespace token types. |
| Rate limiting | Redis sliding-window via `ioredis` (already installed Phase 1) | Phase 1 verified Redis works; brings cost to abuse-prone routes (`sign-in`, `forgot-password`, `verify-email`, `register`). |
| Email service | **Resend** (`resend` SDK) for prod; Console logger for dev | Resend free tier (3k/mo) plus excellent TS SDK. Console fallback prints the code into `pnpm dev` terminal so flows can be exercised without an API key. |
| Validation | **Zod 4** (already in repo) | Shared schemas between client form and server route. |

---

## 5. Architecture

### 5.1 Code layout

```
src/
├── lib/
│   ├── schemas/
│   │   └── auth.ts                           ← NEW: Zod schemas for sign-in / register /
│   │                                            verify / forgot / reset request bodies
│   └── stores/
│       └── auth-stub-store.ts                ← DELETED at end of phase
│
└── server/
    ├── auth/
    │   ├── config.ts                         ← Auth.js NextAuthConfig (providers, adapter,
    │   │                                       callbacks, cookies, pages)
    │   ├── nextauth.ts                       ← export { auth, signIn, signOut, handlers }
    │   ├── session.ts                        ← getSessionUser(), requireSessionUser()
    │   ├── codes.ts                          ← generateCode, hashCode (so DB does not store
    │   │                                       plaintext OTPs), issueVerificationToken,
    │   │                                       consumeVerificationToken
    │   ├── password.ts                       ← hashPassword, verifyPassword (bcrypt wrapper)
    │   ├── rate-limit.ts                     ← Redis sliding-window helper
    │   └── __tests__/
    │       ├── codes.test.ts
    │       ├── password.test.ts
    │       ├── rate-limit.test.ts
    │       └── session.test.ts
    │
    ├── email/
    │   ├── types.ts                          ← interface EmailService
    │   ├── console.ts                        ← ConsoleEmailService (dev fallback)
    │   ├── resend.ts                         ← ResendEmailService (prod)
    │   ├── index.ts                          ← factory: picks impl from env
    │   └── __tests__/
    │       ├── console.test.ts
    │       ├── resend.test.ts
    │       └── factory.test.ts
    │
    ├── repositories/
    │   └── user.repo.ts                      ← NEW: createUser, findByEmail, updatePassword,
    │                                            markEmailVerified, softDelete
    │
    └── data/
        ├── orders.ts                         ← MODIFIED: drop `// PHASE 3:`, call getSessionUser
        └── addresses.ts                      ← MODIFIED: drop `// PHASE 3:`, call getSessionUser

src/app/
├── api/
│   └── auth/
│       ├── [...nextauth]/route.ts            ← NEW: Auth.js catch-all (signIn / signOut / callback /
│       │                                       session — handled by Auth.js internally)
│       ├── register/route.ts                 ← NEW: POST register, send verify code
│       ├── verify-email/route.ts             ← NEW: POST verify code, mark verified
│       ├── verify-email/resend/route.ts      ← NEW: POST resend verify code (rate-limited)
│       ├── forgot-password/route.ts          ← NEW: POST forgot, send reset code
│       ├── reset-password/route.ts           ← NEW: POST reset password
│       └── account/
│           ├── profile/route.ts              ← NEW: PATCH name, GET profile
│           ├── password/route.ts             ← NEW: PATCH change password (invalidates other sessions)
│           ├── delete/route.ts               ← NEW: DELETE soft-delete account
│           └── addresses/
│               ├── route.ts                  ← NEW: GET / POST address book
│               └── [id]/route.ts             ← NEW: PATCH / DELETE individual address
│
├── (auth)/
│   ├── sign-in/page.tsx                      ← MODIFIED: form → POST /api/auth/...; drop stub
│   ├── register/page.tsx                     ← MODIFIED: form → POST /api/auth/register
│   ├── forgot-password/page.tsx              ← MODIFIED: form → POST /api/auth/forgot-password
│   ├── reset-password/page.tsx               ← MODIFIED: form → POST /api/auth/reset-password
│   └── verify-email/page.tsx                 ← NEW: form to enter the 6-digit code
│
└── account/
    ├── layout.tsx                            ← REWRITTEN: server component, redirects via
    │                                            getSessionUser instead of client useEffect
    ├── page.tsx                              ← MODIFIED: hydrate from session
    ├── profile/page.tsx                      ← MODIFIED: form → PATCH /api/auth/account/profile
    ├── orders/*                              ← NO CHANGE (uses getOrdersForCurrentUser façade,
    │                                            façade itself swaps stub → getSessionUser)
    ├── addresses/page.tsx                    ← MODIFIED: replace SEED + Zustand store with
    │                                            calls to /api/auth/account/addresses
    └── pre-orders/*                          ← NO CHANGE
```

### 5.2 Module boundaries

The Phase 1 `lib/` ↔ `server/` ESLint boundary still holds. Forms in `(auth)/*/page.tsx` are client components; they `fetch()` Route Handlers under `/api/auth/*` rather than importing from `@/server/*`. The same pattern Phase 2 used for the search overlay.

### 5.3 Auth.js configuration outline

```ts
// src/server/auth/config.ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/client";
import { verifyPassword } from "./password";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-email",
    error: "/sign-in",
  },
  cookies: {
    sessionToken: {
      name: "ynot.session-token",
      options: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = SignInRequestSchema.safeParse(input);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerifiedAt) {
          // Surface a specific error so the client can route to /verify-email
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      session.user.id = user.id;
      return session;
    },
  },
};
```

### 5.4 Verification code lifecycle

1. **Issue** (`issueVerificationToken`):
   - Generate 6-digit code with `crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")`.
   - Hash with bcrypt **cost-factor 8** — deliberately lower than the password cost (10). Rationale: a code lives ≤ 15 min and only six digits long. The password cost protects against an offline-brute-force-of-stolen-hash attack across years; the code cost only needs to keep up with rate-limited online guessing. Documented at the call site so a future contributor does not "harmonise" the two.
   - Insert row: `{ identifier: 'verify:<email>', token: <hash>, expires: now + 15 min }`.
   - Return the **plain code** to the caller so it can be emailed; never log to DB plaintext.
2. **Consume** (`consumeVerificationToken`):
   - Find rows for `identifier`, ordered by `expires` desc.
   - For each, bcrypt.compare against the supplied code; on first match: delete row, return the row.
   - On no match: return null. (The caller decides how to message that to the user.)
3. **Cleanup**: a Phase "Deploy & Ops" cron will purge expired tokens nightly. Foundation does not include the cron yet; expired tokens are simply unmatchable.

### 5.5 Email service abstraction

```ts
// src/server/email/types.ts
export interface EmailService {
  sendVerificationCode(email: string, code: string): Promise<void>;
  sendPasswordResetCode(email: string, code: string): Promise<void>;
}
```

**Console implementation** (dev fallback): writes a clearly-formatted block to stderr.

```
══════════════════════════════════════════════
 [ynot dev email] Verification code
 To:    user@example.com
 Code:  483019
 (Expires in 15 minutes)
══════════════════════════════════════════════
```

**Resend implementation** (prod): plain-text body, subject `"Your YNOT verification code"` / `"Reset your YNOT password"`, from `auth@ynot.london` (or whatever the user provides). Body intentionally minimal; styled HTML templates are Phase 5.

**Factory** (`index.ts`): chooses Resend if `RESEND_API_KEY` and `RESEND_FROM` are set; otherwise Console. A startup log line announces which one is active so the developer is never confused.

### 5.6 Server-side session gating

```ts
// src/app/account/layout.tsx (new shape)
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function AccountLayout({ children, ...rest }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account");
  return <ServerShell user={user}>{children}</ServerShell>;
}
```

No more `useEffect` flash, no more Zustand store. Account child pages receive the user via React Context provided by the layout (a thin `<SessionProvider value={user}>` wrapper) so client components inside `account/*` can read it without a re-fetch.

### 5.7 Stub replacement

```ts
// src/server/data/orders.ts (after Phase 3)
import { getSessionUser } from "@/server/auth/session";
// ... no PHASE 3 stub, no STUB_USER_EMAIL

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listOrdersForUser(user.id);
  return rows.map(toOrder);
}
```

Identical change in `addresses.ts`. The `// PHASE 3:` markers are removed.

### 5.8 Rate limiting

Redis sliding-window keyed by `<route>:<ip>` (and additionally `<route>:<email>` for sign-in / forgot-password to prevent enumeration). Limits:

| Route | Window | Max attempts |
|---|---|---|
| `POST /api/auth/sign-in` | 15 min | 5 per IP, 5 per email |
| `POST /api/auth/register` | 1 hour | 3 per IP |
| `POST /api/auth/verify-email` | 15 min | 5 per email |
| `POST /api/auth/verify-email/resend` | 5 min | 1 per email |
| `POST /api/auth/forgot-password` | 1 hour | 3 per email |
| `POST /api/auth/reset-password` | 15 min | 5 per email |

Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header and a generic message ("Too many attempts. Try again later.") — never reveals which dimension was tripped.

### 5.9 CSRF protection on custom routes

Auth.js handles CSRF for the catch-all `[...nextauth]` automatically. Every other state-changing custom route (`/api/auth/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account/*`) requires an explicit `x-csrf-token` header that matches the value Auth.js sets in the `__Host-authjs.csrf-token` cookie. Implementation:

```ts
// src/lib/auth-fetch.ts (client-side helper)
export async function authFetch(url: string, init?: RequestInit) {
  const csrfToken = await fetch("/api/auth/csrf").then((r) => r.json()).then((j) => j.csrfToken);
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-csrf-token": csrfToken, "content-type": "application/json" },
  });
}
```

Every form in `(auth)/*/page.tsx` and `account/*` calls `authFetch` instead of raw `fetch`. Server-side, a small middleware validates the header against the cookie and rejects with `403 INVALID_CSRF` on mismatch.

### 5.10 Address book mutations

`/api/auth/account/addresses` POST creates a new address tied to the session user. PATCH/DELETE on `[id]` first verifies `address.userId === session.user.id` to prevent IDOR. Setting `isDefault: true` runs inside `withTransaction` to clear the previous default in one statement.

`useAddressesStore` (the existing Zustand client store) becomes a thin client cache hydrated from `GET /api/auth/account/addresses`. Mutations call the API and refetch.

---

## 6. API surface (request/response contracts)

| Method + Path | Request body (Zod) | Success | Error codes |
|---|---|---|---|
| `POST /api/auth/register` | `{ email, password, name }` | `201 { ok: true }` (sets pending verification) | `409 EMAIL_TAKEN`, `429`, `422` |
| `POST /api/auth/verify-email` | `{ email, code }` | `200 { ok: true }` (creates session, sets cookie) | `401 INVALID_CODE`, `410 EXPIRED`, `429` |
| `POST /api/auth/verify-email/resend` | `{ email }` | `200 { ok: true }` (issues new code, expires old) | `429`, `404 NO_PENDING_VERIFICATION` |
| `POST /api/auth/sign-in` | `{ email, password }` | `200 { ok: true }` (sets cookie) | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED`, `429` |
| `POST /api/auth/sign-out` | `{}` | `200 { ok: true }` (clears cookie + Session row) | — |
| `POST /api/auth/forgot-password` | `{ email }` | `200 { ok: true }` (always 200 for non-enumeration) | `429` |
| `POST /api/auth/reset-password` | `{ email, code, newPassword }` | `200 { ok: true }` (clears all sessions, sets new password) | `401 INVALID_CODE`, `410 EXPIRED`, `429`, `422` |
| `GET /api/auth/account/profile` | — | `200 { id, email, name, emailVerifiedAt }` | `401` |
| `PATCH /api/auth/account/profile` | `{ name }` | `200 { ok: true }` | `401`, `422` |
| `PATCH /api/auth/account/password` | `{ currentPassword, newPassword }` | `200 { ok: true }` (clears other sessions) | `401`, `422`, `429` |
| `DELETE /api/auth/account/delete` | `{ confirmEmail }` | `200 { ok: true }` (sets `User.deletedAt`, clears sessions) | `401`, `422 EMAIL_MISMATCH` |
| `GET /api/auth/account/addresses` | — | `200 { addresses: SavedAddress[] }` | `401` |
| `POST /api/auth/account/addresses` | full `Address` body | `201 { address: SavedAddress }` | `401`, `422` |
| `PATCH /api/auth/account/addresses/[id]` | partial `Address` | `200 { address: SavedAddress }` | `401`, `404`, `422` |
| `DELETE /api/auth/account/addresses/[id]` | — | `200 { ok: true }` | `401`, `404` |

Every route is `force-dynamic`. CSRF protection is on for state-changing routes (Auth.js handles it for the `[...nextauth]` catch-all; for our custom routes the `same-origin` cookie + a `x-csrf-token` header check via `next/headers`).

---

## 7. ENV additions

| Key | Required | Example | Loaded at |
|---|---|---|---|
| `NEXTAUTH_SECRET` | yes | `openssl rand -base64 32` output | every env file |
| `RESEND_API_KEY` | optional | `re_xxxxxxxxxxxx` | `.env.local` (dev) / Docker secret (prod) |
| `RESEND_FROM` | optional | `auth@ynot.london` | committed default in `.env.production`, override per env |

`env.ts` schema picks up the new fields. `RESEND_API_KEY`/`RESEND_FROM` are optional — when absent, the email factory falls back to console. `NEXTAUTH_SECRET` is required (Auth.js refuses to start without it). `.env.example` documents all three.

---

## 8. Testing strategy

### 8.1 Unit tests (no DB)

- `password.test.ts` — hash/verify roundtrip, wrong-password rejection.
- `codes.test.ts` — generated codes are 6 digits, padded; hash/compare roundtrip.
- `email/console.test.ts` — captures stderr output, asserts code appears.
- `email/resend.test.ts` — mocks Resend SDK, asserts the right `to` / `subject` / body.
- `email/factory.test.ts` — env-based selection logic.

### 8.2 Integration tests (real Postgres)

- `register → verify → sign-in` end-to-end: POST register, capture code from console, POST verify, POST sign-in, assert session cookie present, assert `getOrdersForCurrentUser()` returns the user's orders.
- `forgot → reset → sign-in` end-to-end: same pattern.
- `unverified user cannot sign in`: registers, attempts sign-in without verifying, expects `403 EMAIL_NOT_VERIFIED`.
- `password change invalidates other sessions`: sign in twice (two cookies), change password from session A, assert session B's cookie is rejected.
- `IDOR check on address PATCH`: user A creates address, user B tries `PATCH /api/auth/account/addresses/<A's id>` → `404`.
- `rate limit`: hammer `/sign-in` 6 times, sixth returns `429`.
- `getOrdersForCurrentUser` and `getSavedAddresses` return `[]` when no session, return the seeded user's data when signed in.

### 8.3 Storefront regression

After Phase 3 lands, every previously-passing client test still passes. The auth UI flows are exercised by manually walking through:

1. `/sign-in` form submits, redirects to `/account` (or `/verify-email` if not verified).
2. `/register` form submits, redirects to `/verify-email?email=<email>`.
3. `/verify-email` form accepts the dev console code, redirects to `/account`.
4. `/forgot-password` → `/reset-password` flow round-trips.
5. `/account/orders` lists the seeded demo customer's order when signed in as `demo@ynot.london` (or empty when signed in as a fresh user).

### 8.4 Quality gates

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest run — both projects
pnpm build       # next build
```

All four must be green to merge.

---

## 9. Success criteria

Phase 3 is complete when **all 14** are demonstrably true on `main`:

1. `useAuthStubStore` is removed; no file in `src/` imports it.
2. `src/app/account/layout.tsx` is a Server Component using `getSessionUser()`; no `useEffect` redirect; no `'use client'`.
3. `src/server/auth/` directory contains `config.ts`, `nextauth.ts`, `session.ts`, `codes.ts`, `password.ts`, `rate-limit.ts` and their tests.
4. `src/server/email/` directory contains `types.ts`, `console.ts`, `resend.ts`, `index.ts` and their tests; factory selects Console when `RESEND_API_KEY` is unset.
5. The auth Route Handlers under `src/app/api/auth/*` (11 files, 14 endpoints — see §6) exist with the request/response contracts in §6 and pass integration tests.
6. `src/server/repositories/user.repo.ts` exposes `createUser`, `findByEmail`, `updatePassword`, `markEmailVerified`, `softDelete` and is unit-tested.
7. Both `// PHASE 3:` markers are gone from `src/server/data/orders.ts` and `src/server/data/addresses.ts`; both functions call `getSessionUser()`.
8. The full register → verify → sign-in flow works end-to-end against the dev environment using the Console email service (developer copies the code from terminal output).
9. The full forgot → reset → sign-in flow works end-to-end the same way.
10. Password change invalidates all other sessions for that user.
11. Rate-limit test: 6 sign-in attempts to a fixed email return `429` on attempt 6.
12. Storefront client test count remains 143; server test count grows by ≥ 25 (new auth/email/repo tests).
13. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.
14. `/account/orders` rendered while signed in as `demo@ynot.london` shows the seeded demo order; `/account/addresses` shows the seeded demo address; both empty when signed in as a fresh user.

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Auth.js v5 still in beta — APIs may shift | Future breaking changes between releases | Pin to a specific minor (`5.0.0-beta.X`) in `package.json`; upgrade deliberately. |
| User pastes a 6-digit code with leading zeros that gets truncated to a number | Verification fails for legitimate code | Treat the code as a string everywhere; the Zod schema requires exactly 6 ASCII digits. |
| Console email implementation accidentally ships to prod | Codes printed to prod logs | The factory log line states which implementation is active; if Console runs in `NODE_ENV=production` it logs an additional `WARN` line every time it sends so it cannot go unnoticed. The deploy runbook (Phase "Deploy & Ops") includes "verify Resend is active" as a smoke test. |
| Demo customer's stale demo order surfaces under a fresh sign-in | Confusing UX | `getOrdersForCurrentUser` filters by session user id, not by email. The seeded demo customer is its own row, so a freshly-registered user sees an empty list — verified by integration test. |
| Auth.js cookie name conflicts with another app on the same domain | Login lost on every deploy | Custom cookie name `ynot.session-token` (not the default `next-auth.session-token`). |
| Password change does not actually invalidate other sessions due to caching | Session leak after compromise | Database session strategy means the row is the source of truth; cookie validates against the row each request, so deleting other rows immediately revokes them. Integration test in §8.2 verifies this. |
| User loses their email and cannot reset password | Locked out forever | Out of scope for Phase 3 MVP. Recovery flow (admin-assisted reset) is an admin-panel feature for Phase 6. |
| Resend goes down — emails fail silently | Users cannot register/reset | The factory wraps every `send*` call in a try/catch and logs a structured error; Phase 5 will add Sentry alerting. For now: a failed send returns `500 EMAIL_FAILED` and the user sees "We couldn't send the code, please try again." |
| Bcrypt cost factor 10 is too slow on the small VPS, blocking the event loop | Slow login under load | Cost factor 10 is well within the budget for the expected ≤30 logins/min in the launch year; revisit if `/api/auth/sign-in` p95 exceeds 300ms in prod monitoring (Phase "Deploy & Ops"). |

---

## 11. Open questions for Phase 4 / 5 / 6

(Not blockers for Phase 3.)

1. **Phase 4 (cart):** the cart store currently lives in client Zustand with `sessionToken` (guest) or merge-on-login. Needs `mergeGuestCartWithUserCart()` server action. Phase 4 will design.
2. **Phase 5 (email):** the Phase 3 email bodies are plain text. Phase 5 should replace them with branded HTML templates (probably React Email components) and add: order-confirmation, shipped, delivered, refund, return-confirmation.
3. **Phase 6 (admin):** admin needs `role >= ADMIN`. The `User.role` enum is in the Phase 1 schema. Phase 6 adds middleware that checks `session.user.role` and redirects non-admins.

---

## 12. Out-of-band setup (manual, Phase 3 time)

These steps require human action; they are not automated by code:

1. Generate `NEXTAUTH_SECRET` once: `openssl rand -base64 32` → paste into `.env.local`.
2. (Later) Sign up for Resend (resend.com), create an API key, add `RESEND_API_KEY` and `RESEND_FROM` (must be a verified sender address) to `.env.local` for dev / Docker `env_file` for prod.
3. (Later) Verify the sending domain (`ynot.london`) inside Resend by adding the SPF + DKIM TXT records to the DNS — handled when Cloudflare DNS is configured in Phase "Deploy & Ops".

Until step 2 is done, Phase 3 runs entirely on the Console fallback — every auth flow works, codes are printed in the dev terminal.

---

**Status:** Spec authored. Pending self-review and user review before transition to writing-plans.
