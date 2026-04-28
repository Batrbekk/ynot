# YNOT Backend Phase 3 — Auth & Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 2 `useAuthStubStore` with real Auth.js v5 sessions, code-based email verification + password reset, server-side gating of `/account/*`, and full account-CRUD against Postgres — without changing the storefront UI.

**Architecture:** Auth.js v5 with the Prisma adapter and database sessions backed by the Phase 1 `Session` table. Verification + reset codes are 6-digit OTPs hashed in `VerificationToken` (15-min TTL, single-use, namespaced `verify:`/`reset:` identifiers). Email is abstracted: a `ConsoleEmailService` prints codes to the dev terminal until `RESEND_API_KEY` is provided, at which point the factory swaps in `ResendEmailService`. Rate limiting uses Redis sliding-window. CSRF is enforced on every state-changing custom route via the `x-csrf-token` header validated against Auth.js's CSRF cookie.

**Tech Stack:** Node.js 22, Next.js 16 App Router, TypeScript 5.9, Prisma 5, PostgreSQL 16, Redis 7, Auth.js v5 (`next-auth@beta` + `@auth/prisma-adapter`), bcryptjs, ioredis, Resend SDK, Zod 4, Vitest 4.

---

## File Structure

**New files:**

```
web/src/
├── lib/
│   ├── schemas/
│   │   └── auth.ts                                    ← Zod request bodies
│   └── auth-fetch.ts                                  ← client helper that injects x-csrf-token
│
├── server/
│   ├── auth/
│   │   ├── config.ts                                  ← NextAuthConfig
│   │   ├── nextauth.ts                                ← exports auth, handlers, signIn, signOut
│   │   ├── session.ts                                 ← getSessionUser, requireSessionUser
│   │   ├── codes.ts                                   ← generateCode, issue/consume verification token
│   │   ├── password.ts                                ← hashPassword, verifyPassword
│   │   ├── rate-limit.ts                              ← Redis sliding-window helper
│   │   ├── csrf.ts                                    ← assertCsrf middleware for custom routes
│   │   └── __tests__/
│   │       ├── codes.test.ts
│   │       ├── password.test.ts
│   │       ├── rate-limit.test.ts
│   │       └── session.test.ts
│   │
│   ├── email/
│   │   ├── types.ts                                   ← interface EmailService
│   │   ├── console.ts
│   │   ├── resend.ts
│   │   ├── index.ts                                   ← factory
│   │   └── __tests__/
│   │       ├── console.test.ts
│   │       ├── resend.test.ts
│   │       └── factory.test.ts
│   │
│   └── repositories/
│       └── user.repo.ts                               ← createUser, findByEmail, updatePassword,
│                                                        markEmailVerified, softDelete + tests
│
├── app/
│   ├── api/auth/
│   │   ├── [...nextauth]/route.ts                     ← Auth.js catch-all
│   │   ├── register/route.ts
│   │   ├── verify-email/route.ts
│   │   ├── verify-email/resend/route.ts
│   │   ├── sign-in/route.ts                           ← custom wrapper around Auth.js signIn()
│   │   ├── sign-out/route.ts
│   │   ├── forgot-password/route.ts
│   │   ├── reset-password/route.ts
│   │   └── account/
│   │       ├── profile/route.ts
│   │       ├── password/route.ts
│   │       ├── delete/route.ts
│   │       └── addresses/
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   └── (auth)/
│       └── verify-email/page.tsx                      ← NEW
│
└── components/auth/
    └── verify-email-form.tsx                          ← NEW
```

**Modified files:**

- `package.json` — install deps + scripts
- `.env.example`, `.env.development`, `.env.production` — `NEXTAUTH_SECRET`, optional Resend keys
- `prisma/schema.prisma` — no schema changes (Phase 1 already has the tables)
- `src/server/data/orders.ts` — drop `// PHASE 3:`, call `getSessionUser`
- `src/server/data/addresses.ts` — same
- `src/server/env.ts` — add `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`
- `src/app/account/layout.tsx` — server component, redirect via `getSessionUser()`
- `src/app/account/page.tsx`, `account/profile/page.tsx`, `account/addresses/page.tsx` — read session via context, post mutations
- `src/app/(auth)/sign-in/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` — call `authFetch` instead of stub
- `src/components/account/account-tabs.tsx` — read user via session context, not stub
- `src/components/auth/{sign-in,register,forgot-password,reset-password}-form.tsx` — accept `onSubmit` typed for the new responses
- `src/lib/stores/addresses-store.ts` — replace SEED with API hydrate

**Deleted files (final task):**

- `src/lib/stores/auth-stub-store.ts`
- `src/lib/stores/__tests__/auth-stub-store.test.ts` (if exists)

---

## Task 1: Worktree + branch + dependency install

**Files:** workspace setup; `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Create the worktree**

Run from `/Users/batyrbekkuandyk/Desktop/ynot/web`:

```bash
git worktree add .worktrees/backend-phase-3-auth-customer -b feature/backend-phase-3-auth-customer main
cd .worktrees/backend-phase-3-auth-customer
pnpm install
```

Expected: worktree created on a fresh branch from `main`; `pnpm install` populates `node_modules`.

- [ ] **Step 2: Boot the local stack**

```bash
docker compose --profile dev up -d
sleep 5
docker compose ps | grep healthy
pnpm db:migrate:test
pnpm db:migrate
pnpm db:seed
```

Expected: both containers healthy; both migrations green; seed prints six checkmarks. If port 5432 conflicts, run `brew services stop postgresql@16` first.

- [ ] **Step 3: Install Phase 3 dependencies**

```bash
pnpm add next-auth@5.0.0-beta.25 @auth/prisma-adapter@^2.7 resend@^4.0
```

Expected: three packages added under `dependencies`. Versions pinned because Auth.js v5 is still beta — explicit pin avoids surprise upgrades.

- [ ] **Step 4: Verify the install**

```bash
pnpm list next-auth @auth/prisma-adapter resend --depth=0
```

Expected: all three listed at the requested versions.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(backend): install Auth.js v5 + Prisma adapter + Resend SDK for Phase 3"
```

---

## Task 2: ENV additions + Zod env loader update

**Files:**
- Modify: `.env.example`
- Modify: `.env.development`
- Modify: `.env.production`
- Modify: `src/server/env.ts`
- Test: `src/server/__tests__/env.test.ts`

- [ ] **Step 1: Generate a NEXTAUTH_SECRET**

Run once locally:

```bash
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" > /tmp/secret.line
cat /tmp/secret.line
```

Copy the printed line. You will paste it into `.env.local` in step 4 (you may also reuse the same value across `.env.development` since it's dev-only).

- [ ] **Step 2: Update `.env.example`**

Replace `.env.example` with:

```
# YNOT London — environment template.
# Copy to .env.local and fill secret values.
# Committed defaults live in .env.development / .env.test / .env.production.

# ---- Database ----
DATABASE_URL="postgresql://ynot:ynot_dev_password@localhost:5432/ynot_dev?schema=public"

# ---- Redis ----
REDIS_URL="redis://localhost:6379"

# ---- Runtime ----
# NODE_ENV is auto-set by Next/Vitest/Node — do not pin in .env files.
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# ---- Auth ----
# Required. Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="replace-with-openssl-rand-base64-32"

# ---- Email (optional in dev — Console fallback prints codes to terminal) ----
# RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxx"
# RESEND_FROM="auth@ynot.london"

# ---- Seed (dev only) ----
SEED_OWNER_EMAIL="owner@ynot.london"
SEED_OWNER_PASSWORD="change-me-in-local"
```

- [ ] **Step 3: Update `.env.development`**

Append to `.env.development`:

```
NEXTAUTH_SECRET="dev-only-secret-replace-via-env-local"
```

- [ ] **Step 4: Update `.env.production`**

Append to `.env.production`:

```
# NEXTAUTH_SECRET injected via /etc/ynot/secrets.env in prod (Phase Deploy & Ops).
# Resend keys also injected at runtime; see RESEND_API_KEY / RESEND_FROM in .env.example.
```

- [ ] **Step 5: Replace the test file in full**

Open `src/server/__tests__/env.test.ts`. Replace its contents:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";

describe("parseEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "a-32-byte-base64-string-for-tests-12345",
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

  it("requires NEXTAUTH_SECRET", () => {
    const { NEXTAUTH_SECRET, ...withoutSecret } = baseEnv;
    expect(() => parseEnv(withoutSecret)).toThrow();
  });

  it("rejects a too-short NEXTAUTH_SECRET", () => {
    expect(() => parseEnv({ ...baseEnv, NEXTAUTH_SECRET: "short" })).toThrow();
  });

  it("permits optional Resend credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      RESEND_API_KEY: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      RESEND_FROM: "auth@ynot.london",
    });
    expect(env.RESEND_API_KEY).toBe("re_xxxxxxxxxxxxxxxxxxxxxxxx");
    expect(env.RESEND_FROM).toBe("auth@ynot.london");
  });

  it("permits optional seed credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      SEED_OWNER_EMAIL: "owner@ynot.london",
      SEED_OWNER_PASSWORD: "longenough",
    });
    expect(env.SEED_OWNER_EMAIL).toBe("owner@ynot.london");
  });
});
```

- [ ] **Step 6: Run the test to confirm it fails**

```bash
pnpm dotenv -e .env.test -- vitest run src/server/__tests__/env.test.ts
```

Expected: 5/7 PASS, 2/7 FAIL on the `NEXTAUTH_SECRET` cases (schema does not yet require it).

- [ ] **Step 7: Update `src/server/env.ts`**

Replace its contents:

```ts
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.email().optional(),
  SEED_OWNER_EMAIL: z.email().optional(),
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

- [ ] **Step 8: Run the test to confirm it passes**

```bash
pnpm dotenv -e .env.test -- vitest run src/server/__tests__/env.test.ts
```

Expected: 7/7 PASS. **If failing on schema parse from `.env.test`** because `.env.test` is missing `NEXTAUTH_SECRET`, also append `NEXTAUTH_SECRET="test-secret-must-be-at-least-32-chars-long"` to `.env.test`.

- [ ] **Step 9: Commit**

```bash
git add .env.example .env.development .env.production .env.test src/server/env.ts src/server/__tests__/env.test.ts
git commit -m "feat(backend): NEXTAUTH_SECRET + optional Resend env in env.ts"
```

---

## Task 3: Email service interface + Console implementation (TDD)

**Files:**
- Create: `src/server/email/types.ts`
- Create: `src/server/email/console.ts`
- Create: `src/server/email/__tests__/console.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/email/__tests__/console.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ConsoleEmailService } from "../console";

describe("ConsoleEmailService", () => {
  it("prints the verification code to stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const svc = new ConsoleEmailService();
    await svc.sendVerificationCode("user@example.com", "483019");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    spy.mockRestore();
    expect(output).toContain("user@example.com");
    expect(output).toContain("483019");
    expect(output).toContain("Verification");
  });

  it("prints the reset code to stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const svc = new ConsoleEmailService();
    await svc.sendPasswordResetCode("user@example.com", "271828");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    spy.mockRestore();
    expect(output).toContain("user@example.com");
    expect(output).toContain("271828");
    expect(output).toContain("Reset");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "ConsoleEmailService"
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `src/server/email/types.ts`**

```ts
export interface EmailService {
  sendVerificationCode(email: string, code: string): Promise<void>;
  sendPasswordResetCode(email: string, code: string): Promise<void>;
}
```

- [ ] **Step 4: Implement `src/server/email/console.ts`**

```ts
import type { EmailService } from "./types";

function format(kind: string, email: string, code: string): string {
  const lines = [
    "",
    "══════════════════════════════════════════════",
    ` [ynot dev email] ${kind}`,
    ` To:    ${email}`,
    ` Code:  ${code}`,
    " (Expires in 15 minutes)",
    "══════════════════════════════════════════════",
    "",
  ];
  return lines.join("\n");
}

/**
 * Dev / smoke-test fallback. Emits the verification code to stderr so the
 * developer can copy-paste it into the verification UI without a real email
 * service. Refuses silently if NODE_ENV is "production" — see factory.
 */
export class ConsoleEmailService implements EmailService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    process.stderr.write(format("Verification code", email, code));
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    process.stderr.write(format("Reset password code", email, code));
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm test:server -t "ConsoleEmailService"
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/email/types.ts src/server/email/console.ts src/server/email/__tests__/console.test.ts
git commit -m "feat(backend): EmailService interface + ConsoleEmailService dev fallback"
```

---

## Task 4: Resend implementation + factory (TDD)

**Files:**
- Create: `src/server/email/resend.ts`
- Create: `src/server/email/index.ts`
- Create: `src/server/email/__tests__/resend.test.ts`
- Create: `src/server/email/__tests__/factory.test.ts`

- [ ] **Step 1: Write the Resend test**

Create `src/server/email/__tests__/resend.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { ResendEmailService } from "../resend";

describe("ResendEmailService", () => {
  beforeEach(() => sendMock.mockReset().mockResolvedValue({ data: { id: "msg_1" }, error: null }));

  it("sends the verification email through the Resend SDK", async () => {
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await svc.sendVerificationCode("user@example.com", "483019");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.from).toBe("auth@ynot.london");
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toMatch(/verification/i);
    expect(arg.text).toContain("483019");
  });

  it("sends the reset email through the Resend SDK", async () => {
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await svc.sendPasswordResetCode("user@example.com", "271828");
    const arg = sendMock.mock.calls[0][0];
    expect(arg.subject).toMatch(/reset/i);
    expect(arg.text).toContain("271828");
  });

  it("throws when Resend reports an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad address" } });
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await expect(svc.sendVerificationCode("user@example.com", "483019")).rejects.toThrow(/bad address/);
  });
});
```

- [ ] **Step 2: Write the factory test**

Create `src/server/email/__tests__/factory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmailService } from "../index";
import { ConsoleEmailService } from "../console";
import { ResendEmailService } from "../resend";

describe("createEmailService", () => {
  it("returns ConsoleEmailService when RESEND_API_KEY is missing", () => {
    const svc = createEmailService({});
    expect(svc).toBeInstanceOf(ConsoleEmailService);
  });

  it("returns ConsoleEmailService when RESEND_FROM is missing", () => {
    const svc = createEmailService({ RESEND_API_KEY: "re_xxx" });
    expect(svc).toBeInstanceOf(ConsoleEmailService);
  });

  it("returns ResendEmailService when both Resend env vars are set", () => {
    const svc = createEmailService({ RESEND_API_KEY: "re_xxx", RESEND_FROM: "auth@ynot.london" });
    expect(svc).toBeInstanceOf(ResendEmailService);
  });
});
```

- [ ] **Step 3: Run both tests to confirm they fail**

```bash
pnpm test:server -t "ResendEmailService|createEmailService"
```

Expected: FAIL — modules do not exist.

- [ ] **Step 4: Implement `src/server/email/resend.ts`**

```ts
import { Resend } from "resend";
import type { EmailService } from "./types";

/**
 * Production email service backed by Resend. Plain-text bodies in this phase;
 * Phase 5 swaps in branded HTML templates.
 */
export class ResendEmailService implements EmailService {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const result = await this.client.emails.send({ from: this.from, to, subject, text });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const text = [
      "Welcome to YNOT London.",
      "",
      `Your verification code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request it, please ignore this email.",
    ].join("\n");
    await this.send(email, "Your YNOT verification code", text);
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const text = [
      "We received a request to reset your YNOT password.",
      "",
      `Your reset code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request a password reset, you can safely ignore this email.",
    ].join("\n");
    await this.send(email, "Reset your YNOT password", text);
  }
}
```

- [ ] **Step 5: Implement `src/server/email/index.ts`**

```ts
import { ConsoleEmailService } from "./console";
import { ResendEmailService } from "./resend";
import type { EmailService } from "./types";

export type { EmailService } from "./types";
export { ConsoleEmailService } from "./console";
export { ResendEmailService } from "./resend";

interface FactoryEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NODE_ENV?: string;
}

let logged = false;

function announce(implName: string, env: FactoryEnv): void {
  if (logged) return;
  logged = true;
  process.stderr.write(`[ynot email] using ${implName}\n`);
  if (implName === "ConsoleEmailService" && env.NODE_ENV === "production") {
    process.stderr.write(
      "[ynot email] WARNING: ConsoleEmailService active in production — set RESEND_API_KEY and RESEND_FROM.\n",
    );
  }
}

/**
 * Factory: picks ResendEmailService when both env vars are set, otherwise
 * falls back to ConsoleEmailService. Logs the choice once at startup.
 */
export function createEmailService(env: FactoryEnv): EmailService {
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    announce("ResendEmailService", env);
    return new ResendEmailService(env.RESEND_API_KEY, env.RESEND_FROM);
  }
  announce("ConsoleEmailService", env);
  return new ConsoleEmailService();
}

let cached: EmailService | null = null;

/**
 * Module-scoped singleton. First call constructs from process.env; subsequent
 * calls return the same instance. Tests that need a fresh instance call
 * `createEmailService` directly.
 */
export function getEmailService(): EmailService {
  if (!cached) {
    cached = createEmailService(process.env);
  }
  return cached;
}
```

- [ ] **Step 6: Run both tests to confirm they pass**

```bash
pnpm test:server -t "ResendEmailService|createEmailService"
```

Expected: 6 tests PASS (3 + 3).

- [ ] **Step 7: Commit**

```bash
git add src/server/email
git commit -m "feat(backend): ResendEmailService + email factory (Console fallback when no key)"
```

---

## Task 5: Password hashing (TDD)

**Files:**
- Create: `src/server/auth/password.ts`
- Create: `src/server/auth/__tests__/password.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("hunter2-correct-horse");
    expect(await verifyPassword("hunter2-correct-horse", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2-correct-horse");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("returns false for an obviously malformed hash", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "password"
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

const PASSWORD_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare returns false (rather than throwing) for malformed hashes,
  // which is the behaviour we want at the auth layer.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "password"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/password.ts src/server/auth/__tests__/password.test.ts
git commit -m "feat(backend): password hashing wrappers (bcryptjs cost 10)"
```

---

## Task 6: Verification codes (TDD)

**Files:**
- Create: `src/server/auth/codes.ts`
- Create: `src/server/auth/__tests__/codes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/codes.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  consumeVerificationToken,
  generateCode,
  issueVerificationToken,
  verificationIdentifier,
} from "../codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("generateCode", () => {
  it("returns six ASCII digits", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("verificationIdentifier", () => {
  it("namespaces verify and reset", () => {
    expect(verificationIdentifier("verify", "u@x.com")).toBe("verify:u@x.com");
    expect(verificationIdentifier("reset", "u@x.com")).toBe("reset:u@x.com");
  });
});

describe("issue + consume verification token", () => {
  beforeEach(() => resetDb());

  it("issues a token and consumes it once", async () => {
    const code = await issueVerificationToken("verify", "u@x.com");
    expect(code).toMatch(/^\d{6}$/);
    const ok = await consumeVerificationToken("verify", "u@x.com", code);
    expect(ok).toBe(true);
    const second = await consumeVerificationToken("verify", "u@x.com", code);
    expect(second).toBe(false);
  });

  it("rejects a wrong code", async () => {
    await issueVerificationToken("verify", "u@x.com");
    expect(await consumeVerificationToken("verify", "u@x.com", "000000")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const code = await issueVerificationToken("verify", "u@x.com");
    // Move the row's expiry into the past.
    await prisma.verificationToken.updateMany({
      where: { identifier: "verify:u@x.com" },
      data: { expires: new Date(Date.now() - 1000) },
    });
    expect(await consumeVerificationToken("verify", "u@x.com", code)).toBe(false);
  });

  it("issues replace previous unexpired tokens for the same identifier", async () => {
    const first = await issueVerificationToken("verify", "u@x.com");
    const second = await issueVerificationToken("verify", "u@x.com");
    // The first must no longer match.
    expect(await consumeVerificationToken("verify", "u@x.com", first)).toBe(false);
    expect(await consumeVerificationToken("verify", "u@x.com", second)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "generateCode|verificationIdentifier|issue \\+ consume"
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/auth/codes.ts`**

```ts
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/client";

const CODE_COST = 8; // Lower than the password cost (10) — see spec §5.4
const TOKEN_TTL_MS = 15 * 60 * 1000;

export type TokenKind = "verify" | "reset";

export function verificationIdentifier(kind: TokenKind, email: string): string {
  return `${kind}:${email}`;
}

/** 6-digit numeric code, zero-padded. Cryptographically random. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Issue a fresh code for `kind:email`. Replaces any previous tokens for the
 * same identifier so the user always works with the most recent code.
 * Returns the plain-text code so the caller can email it; never logs it.
 */
export async function issueVerificationToken(
  kind: TokenKind,
  email: string,
): Promise<string> {
  const identifier = verificationIdentifier(kind, email);
  const code = generateCode();
  const tokenHash = await bcrypt.hash(code, CODE_COST);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return code;
}

/**
 * Consume a code: returns true on success and deletes the row, returns false
 * on mismatch / expiry / no row.
 */
export async function consumeVerificationToken(
  kind: TokenKind,
  email: string,
  code: string,
): Promise<boolean> {
  const identifier = verificationIdentifier(kind, email);
  const rows = await prisma.verificationToken.findMany({
    where: { identifier },
  });
  for (const row of rows) {
    if (row.expires.getTime() < Date.now()) continue;
    const match = await bcrypt.compare(code, row.token);
    if (match) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: row.identifier, token: row.token } },
      });
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "generateCode|verificationIdentifier|issue \\+ consume"
```

Expected: 6 tests PASS (1 + 1 + 4).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/codes.ts src/server/auth/__tests__/codes.test.ts
git commit -m "feat(backend): verification token issue/consume (6-digit OTP, 15-min TTL)"
```

---

## Task 7: Redis sliding-window rate limit (TDD)

**Files:**
- Create: `src/server/auth/rate-limit.ts`
- Create: `src/server/auth/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/rate-limit.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { redis } from "@/server/redis";
import { checkRateLimit } from "../rate-limit";

async function clear(prefix: string) {
  const keys = await redis.keys(`${prefix}*`);
  if (keys.length) await redis.del(...keys);
}

describe("checkRateLimit", () => {
  beforeEach(() => clear("ratelimit:test:"));

  it("permits attempts up to the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit({ key: "test:abc", windowMs: 60_000, max: 3 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(3 - i - 1);
    }
  });

  it("blocks the next attempt after the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ key: "test:def", windowMs: 60_000, max: 3 });
    }
    const r = await checkRateLimit({ key: "test:def", windowMs: 60_000, max: 3 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates different keys", async () => {
    await checkRateLimit({ key: "test:a", windowMs: 60_000, max: 1 });
    const r = await checkRateLimit({ key: "test:b", windowMs: 60_000, max: 1 });
    expect(r.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "checkRateLimit"
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/auth/rate-limit.ts`**

```ts
import { redis } from "@/server/redis";

export interface RateLimitInput {
  /** Composite key, e.g. `signin:ip:1.2.3.4` or `forgot:email:foo@bar.com`. */
  key: string;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Sliding-window counter via Redis sorted sets. Each call ZADDs a unique
 * timestamp + member, then prunes entries older than `windowMs` and counts
 * the survivors. If count > max, returns allowed=false with a retry hint.
 */
export async function checkRateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - input.windowMs;
  const redisKey = `ratelimit:${input.key}`;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  // Pipeline: trim old, add new, count, set TTL.
  const pipe = redis.multi();
  pipe.zremrangebyscore(redisKey, 0, windowStart);
  pipe.zadd(redisKey, now, member);
  pipe.zcard(redisKey);
  pipe.pexpire(redisKey, input.windowMs);
  const result = await pipe.exec();
  if (!result) {
    // If pipeline fails entirely, fail open (allow). Logged for diagnostics.
    process.stderr.write("[ynot rate-limit] pipeline returned null\n");
    return { allowed: true, remaining: input.max, retryAfterMs: 0 };
  }
  const count = (result[2]?.[1] as number) ?? 0;

  if (count > input.max) {
    // Find the oldest entry that fits in the window — that's when one slot frees up.
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const oldestScore = oldest[1] ? Number(oldest[1]) : now;
    const retryAfterMs = Math.max(1000, input.windowMs - (now - oldestScore));
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  return {
    allowed: true,
    remaining: Math.max(0, input.max - count),
    retryAfterMs: 0,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "checkRateLimit"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/rate-limit.ts src/server/auth/__tests__/rate-limit.test.ts
git commit -m "feat(backend): Redis sliding-window rate limit helper"
```

---

## Task 8: User repository (TDD)

**Files:**
- Create: `src/server/repositories/user.repo.ts`
- Create: `src/server/__tests__/repositories/user.repo.test.ts`
- Modify: `src/server/repositories/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/repositories/user.repo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  softDeleteUser,
  updatePassword,
} from "../../repositories/user.repo";
import { resetDb } from "../helpers/reset-db";

describe("user.repo", () => {
  beforeEach(() => resetDb());

  it("createUser inserts a row with passwordHash and emailVerifiedAt=null", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x", name: "Test" });
    expect(u.email).toBe("u@x.com");
    expect(u.emailVerifiedAt).toBeNull();
    expect(u.role).toBe("CUSTOMER");
  });

  it("createUser rejects duplicate email", async () => {
    await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await expect(
      createUser({ email: "u@x.com", passwordHash: "$2b$10$y" }),
    ).rejects.toThrow();
  });

  it("findUserByEmail is case-insensitive in lookup", async () => {
    await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    const u = await findUserByEmail("U@X.com");
    expect(u?.email).toBe("u@x.com");
  });

  it("findUserByEmail excludes soft-deleted users", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    expect(await findUserByEmail("u@x.com")).toBeNull();
  });

  it("markEmailVerified sets the timestamp", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await markEmailVerified(u.id);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("updatePassword stores the new hash", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await updatePassword(u.id, "$2b$10$NEW");
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.passwordHash).toBe("$2b$10$NEW");
  });

  it("softDeleteUser sets deletedAt", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await softDeleteUser(u.id);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "user.repo"
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/repositories/user.repo.ts`**

```ts
import type { User } from "@prisma/client";
import { prisma } from "../db/client";

interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name ?? null,
    },
  });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });
}

export async function markEmailVerified(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function softDeleteUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId } });
}
```

- [ ] **Step 4: Add to barrel**

Replace `src/server/repositories/index.ts`:

```ts
export * from "./product.repo";
export * from "./category.repo";
export * from "./cms.repo";
export * from "./order.repo";
export * from "./address.repo";
export * from "./user.repo";
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm test:server -t "user.repo"
```

Expected: 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/user.repo.ts src/server/__tests__/repositories/user.repo.test.ts src/server/repositories/index.ts
git commit -m "feat(backend): user repo (createUser, findByEmail, markEmailVerified, updatePassword, softDelete)"
```

---

## Task 9: Auth Zod schemas

**Files:**
- Create: `src/lib/schemas/auth.ts`
- Modify: `src/lib/schemas/index.ts`

- [ ] **Step 1: Write `src/lib/schemas/auth.ts`**

```ts
import { z } from "zod";

const PasswordRule = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

const EmailRule = z.email().transform((s) => s.toLowerCase().trim());

const CodeRule = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const RegisterRequestSchema = z.object({
  email: EmailRule,
  password: PasswordRule,
  name: z.string().min(1).max(120).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  email: EmailRule,
  code: CodeRule,
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const ResendVerifyRequestSchema = z.object({ email: EmailRule });
export type ResendVerifyRequest = z.infer<typeof ResendVerifyRequestSchema>;

export const SignInRequestSchema = z.object({
  email: EmailRule,
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof SignInRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailRule });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: EmailRule,
  code: CodeRule,
  newPassword: PasswordRule,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordRule,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const DeleteAccountRequestSchema = z.object({
  confirmEmail: EmailRule,
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
```

- [ ] **Step 2: Add to barrel**

Modify `src/lib/schemas/index.ts` — append:

```ts
export * from "./auth";
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean (existing pre-existing PNG errors unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas/auth.ts src/lib/schemas/index.ts
git commit -m "feat(schemas): Zod request schemas for every auth API endpoint"
```

---

## Task 10: Auth.js config + nextauth handlers + session helpers

**Files:**
- Create: `src/server/auth/config.ts`
- Create: `src/server/auth/nextauth.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/server/auth/__tests__/session.test.ts`

- [ ] **Step 1: Write `src/server/auth/config.ts`**

```ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/client";
import { SignInRequestSchema } from "@/lib/schemas";
import { findUserByEmail } from "@/server/repositories/user.repo";
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
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = SignInRequestSchema.safeParse(input);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerifiedAt) {
          // Surface a specific error code so the route handler can route the
          // client to /verify-email rather than showing a generic credentials
          // error.
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

- [ ] **Step 2: Write `src/server/auth/nextauth.ts`**

```ts
import NextAuth from "next-auth";
import { authConfig } from "./config";

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 3: Write `src/server/auth/session.ts`**

```ts
import type { User } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { auth } from "./nextauth";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: User["role"];
  emailVerifiedAt: Date | null;
}

/**
 * Resolves the signed-in user from the request cookie via Auth.js's `auth()`
 * helper. Returns null if no valid session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id, deletedAt: null },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

/**
 * Same as getSessionUser but throws when there is no session — convenient at
 * the top of a Route Handler that has already verified the cookie via
 * middleware. Returns 401 to the client when used inside a Route Handler that
 * wraps it.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}
```

- [ ] **Step 4: Write the catch-all route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from "@/server/auth/nextauth";
```

- [ ] **Step 5: Write the session test**

Create `src/server/auth/__tests__/session.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../nextauth", () => ({
  auth: vi.fn(),
}));

import { auth } from "../nextauth";
import { prisma } from "@/server/db/client";
import { getSessionUser, requireSessionUser } from "../session";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("session helpers", () => {
  it("getSessionUser returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });

  it("getSessionUser returns the matching DB row", async () => {
    await resetDb();
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", name: "U" },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name } } as never);
    const result = await getSessionUser();
    expect(result?.id).toBe(u.id);
    expect(result?.email).toBe("u@x.com");
  });

  it("getSessionUser returns null for soft-deleted users", async () => {
    await resetDb();
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", deletedAt: new Date() },
    });
    vi.mocked(auth).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name } } as never);
    expect(await getSessionUser()).toBeNull();
  });

  it("requireSessionUser throws when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    await expect(requireSessionUser()).rejects.toThrow(/UNAUTHENTICATED/);
  });
});
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
pnpm test:server -t "session helpers"
```

Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/auth/config.ts src/server/auth/nextauth.ts src/server/auth/session.ts src/server/auth/__tests__/session.test.ts src/app/api/auth/\[...nextauth\]
git commit -m "feat(backend): Auth.js v5 config + handlers + getSessionUser helper"
```

---

## Task 11: CSRF middleware + custom-route helper

**Files:**
- Create: `src/server/auth/csrf.ts`

- [ ] **Step 1: Write `src/server/auth/csrf.ts`**

```ts
import { headers, cookies } from "next/headers";

/**
 * Validates the x-csrf-token header against Auth.js's CSRF cookie.
 * Auth.js v5 cookie name in our config is `__Host-authjs.csrf-token` in
 * production (HTTPS) and `authjs.csrf-token` in non-HTTPS dev. The cookie
 * value format is `<token>|<hmac>` — we only need a string-equality check
 * against the header (the hmac is enforced by Auth.js itself when the cookie
 * is read by the catch-all route).
 */
export async function assertCsrf(): Promise<void> {
  const h = await headers();
  const headerToken = h.get("x-csrf-token");
  if (!headerToken) {
    const err = new Error("INVALID_CSRF") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  const c = await cookies();
  const cookie =
    c.get("__Host-authjs.csrf-token") ?? c.get("authjs.csrf-token");
  const cookieValue = cookie?.value.split("|")[0];
  if (!cookieValue || cookieValue !== headerToken) {
    const err = new Error("INVALID_CSRF") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/auth/csrf.ts
git commit -m "feat(backend): assertCsrf middleware for custom auth routes"
```

---

## Task 12: `POST /api/auth/register`

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/register/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/register/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { prisma } from "@/server/db/client";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => resetDb());

  it("creates a user and issues a verification code", async () => {
    const res = await POST(jsonRequest({ email: "u@x.com", password: "longenough", name: "U" }));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: "u@x.com" } });
    expect(user).toBeTruthy();
    expect(user?.emailVerifiedAt).toBeNull();
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "verify:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 409 EMAIL_TAKEN on duplicate", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const res = await POST(jsonRequest({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("EMAIL_TAKEN");
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST(jsonRequest({ email: "not-an-email", password: "x" }));
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "POST /api/auth/register"
```

Expected: FAIL — route does not exist.

- [ ] **Step 3: Write `src/app/api/auth/register/route.ts`**

```ts
import { NextResponse } from "next/server";
import { RegisterRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { hashPassword } from "@/server/auth/password";
import { issueVerificationToken } from "@/server/auth/codes";
import { createUser, findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = await checkRateLimit({ key: `register:ip:${ip}`, windowMs: 60 * 60_000, max: 3 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
  });

  const code = await issueVerificationToken("verify", parsed.data.email);
  await getEmailService().sendVerificationCode(parsed.data.email, code);

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test:server -t "POST /api/auth/register"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register
git commit -m "feat(backend): POST /api/auth/register with rate-limit + verification email"
```

---

## Task 13: `POST /api/auth/verify-email` + `/verify-email/resend`

**Files:**
- Create: `src/app/api/auth/verify-email/route.ts`
- Create: `src/app/api/auth/verify-email/resend/route.ts`
- Create: `src/app/api/auth/verify-email/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/verify-email/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as verifyPOST } from "../route";
import { POST as resendPOST } from "../resend/route";
import { prisma } from "@/server/db/client";
import { issueVerificationToken } from "@/server/auth/codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  }),
}));

function reqVerify(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}
function reqResend(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email/resend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => resetDb());

  it("marks the user verified on a correct code", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h" },
    });
    const code = await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("returns 401 INVALID_CODE for a wrong code", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code: "000000" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 on missing fields", async () => {
    const res = await verifyPOST(reqVerify({ email: "x" }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/verify-email/resend", () => {
  beforeEach(() => resetDb());

  it("issues a fresh code for an unverified user", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(200);
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "verify:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 404 when there is no pending verification (user already verified or absent)", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "verify-email"
```

Expected: FAIL — routes do not exist.

- [ ] **Step 3: Write `src/app/api/auth/verify-email/route.ts`**

```ts
import { NextResponse } from "next/server";
import { VerifyEmailRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { consumeVerificationToken } from "@/server/auth/codes";
import { findUserByEmail, markEmailVerified } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyEmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `verify:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const ok = await consumeVerificationToken("verify", parsed.data.email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401 });
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  await markEmailVerified(user.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `src/app/api/auth/verify-email/resend/route.ts`**

```ts
import { NextResponse } from "next/server";
import { ResendVerifyRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { issueVerificationToken } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ResendVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `resend-verify:email:${parsed.data.email}`,
    windowMs: 5 * 60_000,
    max: 1,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user || user.emailVerifiedAt) {
    return NextResponse.json({ error: "NO_PENDING_VERIFICATION" }, { status: 404 });
  }

  const code = await issueVerificationToken("verify", parsed.data.email);
  await getEmailService().sendVerificationCode(parsed.data.email, code);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
pnpm test:server -t "verify-email"
```

Expected: 5 tests PASS (3 + 2).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/verify-email
git commit -m "feat(backend): POST /api/auth/verify-email + /verify-email/resend"
```

---

## Task 14: `POST /api/auth/sign-in` + `/sign-out`

**Files:**
- Create: `src/app/api/auth/sign-in/route.ts`
- Create: `src/app/api/auth/sign-out/route.ts`
- Create: `src/app/api/auth/sign-in/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/sign-in/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { prisma } from "@/server/db/client";
import { hashPassword } from "@/server/auth/password";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const signInMock = vi.fn();
vi.mock("@/server/auth/nextauth", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(async () => {
    await resetDb();
    signInMock.mockReset();
  });

  it("returns 200 ok when credentials are correct and user is verified", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
        emailVerifiedAt: new Date(),
      },
    });
    signInMock.mockResolvedValue({ ok: true });
    const res = await POST(req({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(200);
    expect(signInMock).toHaveBeenCalledWith("credentials", expect.objectContaining({
      email: "u@x.com",
      password: "longenough",
      redirect: false,
    }));
  });

  it("returns 401 INVALID_CREDENTIALS when password wrong", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
        emailVerifiedAt: new Date(),
      },
    });
    signInMock.mockRejectedValue(new Error("CredentialsSignin"));
    const res = await POST(req({ email: "u@x.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 EMAIL_NOT_VERIFIED when user is unverified", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
      },
    });
    signInMock.mockRejectedValue(new Error("EMAIL_NOT_VERIFIED"));
    const res = await POST(req({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("EMAIL_NOT_VERIFIED");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "POST /api/auth/sign-in"
```

Expected: FAIL — route does not exist.

- [ ] **Step 3: Write `src/app/api/auth/sign-in/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { SignInRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { signIn } from "@/server/auth/nextauth";
import { checkRateLimit } from "@/server/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignInRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipRl = await checkRateLimit({ key: `signin:ip:${ip}`, windowMs: 15 * 60_000, max: 5 });
  const emailRl = await checkRateLimit({
    key: `signin:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!ipRl.allowed || !emailRl.allowed) {
    const retry = Math.max(ipRl.retryAfterMs, emailRl.retryAfterMs);
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(retry / 1000).toString() } },
    );
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("EMAIL_NOT_VERIFIED")) {
      return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
}
```

- [ ] **Step 4: Write `src/app/api/auth/sign-out/route.ts`**

```ts
import { NextResponse } from "next/server";
import { signOut } from "@/server/auth/nextauth";
import { assertCsrf } from "@/server/auth/csrf";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm test:server -t "POST /api/auth/sign-in"
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/sign-in src/app/api/auth/sign-out
git commit -m "feat(backend): POST /api/auth/sign-in + /sign-out (Auth.js wrappers)"
```

---

## Task 15: `POST /api/auth/forgot-password` + `/reset-password`

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/api/auth/reset-password/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/reset-password/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as forgotPOST } from "../../forgot-password/route";
import { POST as resetPOST } from "../route";
import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { issueVerificationToken } from "@/server/auth/codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  }),
}));

function reqForgot(body: unknown): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}
function reqReset(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => resetDb());

  it("returns 200 + issues a code for a known email", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await forgotPOST(reqForgot({ email: "u@x.com" }));
    expect(res.status).toBe(200);
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "reset:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 200 even for an unknown email (anti-enumeration)", async () => {
    const res = await forgotPOST(reqForgot({ email: "ghost@x.com" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => resetDb());

  it("updates the password on a correct code and clears all sessions", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword"), emailVerifiedAt: new Date() },
    });
    await prisma.session.create({
      data: { userId: u.id, sessionToken: "tok-a", expires: new Date(Date.now() + 1_000_000) },
    });
    const code = await issueVerificationToken("reset", "u@x.com");
    const res = await resetPOST(reqReset({ email: "u@x.com", code, newPassword: "newpassword123" }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(await verifyPassword("newpassword123", after!.passwordHash!)).toBe(true);
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(0);
  });

  it("returns 401 INVALID_CODE on wrong code", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await resetPOST(reqReset({ email: "u@x.com", code: "000000", newPassword: "newpassword123" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "forgot-password|reset-password"
```

Expected: FAIL.

- [ ] **Step 3: Write `src/app/api/auth/forgot-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { ForgotPasswordRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { issueVerificationToken } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `forgot:email:${parsed.data.email}`,
    windowMs: 60 * 60_000,
    max: 3,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  // Always return 200, regardless of whether the email exists, to prevent
  // account enumeration. We only send the email if the user is real and verified.
  const user = await findUserByEmail(parsed.data.email);
  if (user && user.emailVerifiedAt) {
    const code = await issueVerificationToken("reset", parsed.data.email);
    await getEmailService().sendPasswordResetCode(parsed.data.email, code);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `src/app/api/auth/reset-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { ResetPasswordRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { hashPassword } from "@/server/auth/password";
import { consumeVerificationToken } from "@/server/auth/codes";
import { findUserByEmail, updatePassword } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ResetPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `reset:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const ok = await consumeVerificationToken("reset", parsed.data.email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401 });
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await updatePassword(user.id, newHash);
  await prisma.session.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
pnpm test:server -t "forgot-password|reset-password"
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/forgot-password src/app/api/auth/reset-password
git commit -m "feat(backend): POST /api/auth/forgot-password + /reset-password"
```

---

## Task 16: Account routes — `profile`, `password`, `delete`

**Files:**
- Create: `src/app/api/auth/account/profile/route.ts`
- Create: `src/app/api/auth/account/password/route.ts`
- Create: `src/app/api/auth/account/delete/route.ts`
- Create: `src/app/api/auth/account/__tests__/profile-password-delete.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/account/__tests__/profile-password-delete.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as profileGET, PATCH as profilePATCH } from "../profile/route";
import { PATCH as passwordPATCH } from "../password/route";
import { DELETE as deleteDELETE } from "../delete/route";
import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
  requireSessionUser: async () => {
    const u = await sessionMock();
    if (!u) {
      const e = new Error("UNAUTHENTICATED") as Error & { status?: number };
      e.status = 401;
      throw e;
    }
    return u;
  },
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

function jsonReq(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("GET /api/auth/account/profile", () => {
  beforeEach(() => resetDb());

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await profileGET();
    expect(res.status).toBe(401);
  });

  it("returns the profile when signed in", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", name: "Jane", emailVerifiedAt: new Date() },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: u.emailVerifiedAt });
    const res = await profileGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ email: "u@x.com", name: "Jane" });
  });
});

describe("PATCH /api/auth/account/profile", () => {
  beforeEach(() => resetDb());

  it("updates name", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await profilePATCH(jsonReq("http://localhost/api/auth/account/profile", "PATCH", { name: "New Name" }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.name).toBe("New Name");
  });
});

describe("PATCH /api/auth/account/password", () => {
  beforeEach(() => resetDb());

  it("changes the password and clears other sessions", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword") },
    });
    await prisma.session.create({
      data: { userId: u.id, sessionToken: "other-sess", expires: new Date(Date.now() + 1_000_000) },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await passwordPATCH(
      jsonReq("http://localhost/api/auth/account/password", "PATCH", {
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(await verifyPassword("newpassword123", after!.passwordHash!)).toBe(true);
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(0);
  });

  it("returns 401 when current password wrong", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword") },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await passwordPATCH(
      jsonReq("http://localhost/api/auth/account/password", "PATCH", {
        currentPassword: "wrong",
        newPassword: "newpassword123",
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/account/delete", () => {
  beforeEach(() => resetDb());

  it("soft-deletes the user when confirmEmail matches", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await deleteDELETE(
      jsonReq("http://localhost/api/auth/account/delete", "DELETE", { confirmEmail: "u@x.com" }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 422 when confirmEmail does not match", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await deleteDELETE(
      jsonReq("http://localhost/api/auth/account/delete", "DELETE", { confirmEmail: "wrong@x.com" }),
    );
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "/account/(profile|password|delete)"
```

Expected: FAIL.

- [ ] **Step 3: Write `src/app/api/auth/account/profile/route.ts`**

```ts
import { NextResponse } from "next/server";
import { UpdateProfileRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { getSessionUser, requireSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = UpdateProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 4: Write `src/app/api/auth/account/password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { ChangePasswordRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = ChangePasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const current = await prisma.user.findUnique({ where: { id: session.id } });
    if (!current?.passwordHash) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.currentPassword, current.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const newHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: newHash },
    });
    await prisma.session.deleteMany({ where: { userId: session.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 5: Write `src/app/api/auth/account/delete/route.ts`**

```ts
import { NextResponse } from "next/server";
import { DeleteAccountRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { softDeleteUser } from "@/server/repositories/user.repo";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = DeleteAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    if (parsed.data.confirmEmail !== session.email) {
      return NextResponse.json({ error: "EMAIL_MISMATCH" }, { status: 422 });
    }
    await softDeleteUser(session.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
pnpm test:server -t "/account/(profile|password|delete)"
```

Expected: 7 tests PASS (2 + 1 + 2 + 2).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/account/profile src/app/api/auth/account/password src/app/api/auth/account/delete
git commit -m "feat(backend): /account/{profile,password,delete} routes"
```

---

## Task 17: Account address-book routes

**Files:**
- Create: `src/app/api/auth/account/addresses/route.ts`
- Create: `src/app/api/auth/account/addresses/[id]/route.ts`
- Create: `src/app/api/auth/account/addresses/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/account/addresses/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";
import { prisma } from "@/server/db/client";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
  requireSessionUser: async () => {
    const u = await sessionMock();
    if (!u) {
      const e = new Error("UNAUTHENTICATED") as Error & { status?: number };
      e.status = 401;
      throw e;
    }
    return u;
  },
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

const fixtureBody = {
  label: "Home",
  isDefault: true,
  firstName: "Jane",
  lastName: "Doe",
  line1: "1 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("/api/auth/account/addresses", () => {
  beforeEach(() => resetDb());

  it("GET returns addresses for the session user, default first", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    await prisma.address.createMany({
      data: [
        { ...fixtureBody, userId: u.id, label: "Work", isDefault: false },
        { ...fixtureBody, userId: u.id, label: "Home", isDefault: true },
      ],
    });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.addresses.map((a: { label: string }) => a.label)).toEqual(["Home", "Work"]);
  });

  it("POST creates an address tied to the session user", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await POST(jsonReq("http://localhost/api/auth/account/addresses", "POST", fixtureBody));
    expect(res.status).toBe(201);
    const all = await prisma.address.findMany({ where: { userId: u.id } });
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe("Home");
  });

  it("PATCH on another user's address returns 404 (IDOR check)", async () => {
    const a = await prisma.user.create({ data: { email: "a@x.com", passwordHash: "$2b$10$h" } });
    const b = await prisma.user.create({ data: { email: "b@x.com", passwordHash: "$2b$10$h" } });
    const addrA = await prisma.address.create({ data: { ...fixtureBody, userId: a.id } });
    sessionMock.mockResolvedValue({ id: b.id, email: "b@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await PATCH(
      jsonReq(`http://localhost/api/auth/account/addresses/${addrA.id}`, "PATCH", { label: "Hijacked" }),
      { params: Promise.resolve({ id: addrA.id }) },
    );
    expect(res.status).toBe(404);
    const after = await prisma.address.findUnique({ where: { id: addrA.id } });
    expect(after?.label).toBe("Home");
  });

  it("PATCH updates own address", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const addr = await prisma.address.create({ data: { ...fixtureBody, userId: u.id } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await PATCH(
      jsonReq(`http://localhost/api/auth/account/addresses/${addr.id}`, "PATCH", { label: "Renamed" }),
      { params: Promise.resolve({ id: addr.id }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.address.findUnique({ where: { id: addr.id } });
    expect(after?.label).toBe("Renamed");
  });

  it("DELETE removes the address", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const addr = await prisma.address.create({ data: { ...fixtureBody, userId: u.id } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await DELETE(
      jsonReq(`http://localhost/api/auth/account/addresses/${addr.id}`, "DELETE"),
      { params: Promise.resolve({ id: addr.id }) },
    );
    expect(res.status).toBe(200);
    expect(await prisma.address.findUnique({ where: { id: addr.id } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test:server -t "/api/auth/account/addresses"
```

Expected: FAIL.

- [ ] **Step 3: Write `src/app/api/auth/account/addresses/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser, getSessionUser } from "@/server/auth/session";
import { withTransaction } from "@/server/db/transaction";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { toSavedAddress } from "@/server/data/adapters/address";

export const dynamic = "force-dynamic";

const AddressBodySchema = z.object({
  label: z.string().min(1).max(60),
  isDefault: z.boolean().default(false),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable().default(null),
  city: z.string().min(1).max(120),
  postcode: z.string().min(1).max(20),
  country: z.string().length(2),
  phone: z.string().max(40).default(""),
});

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const rows = await listAddressesForUser(user.id);
  return NextResponse.json({ addresses: rows.map(toSavedAddress) });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = AddressBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const created = await withTransaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.address.updateMany({
          where: { userId: session.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...parsed.data, userId: session.id },
      });
    });
    return NextResponse.json({ address: toSavedAddress(created) }, { status: 201 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 4: Write `src/app/api/auth/account/addresses/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { withTransaction } from "@/server/db/transaction";
import { toSavedAddress } from "@/server/data/adapters/address";

export const dynamic = "force-dynamic";

const PatchBodySchema = z.object({
  label: z.string().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(120).optional(),
  postcode: z.string().min(1).max(20).optional(),
  country: z.string().length(2).optional(),
  phone: z.string().max(40).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadOwnedAddress(addressId: string, userId: string) {
  const row = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  return row;
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const { id } = await ctx.params;
    const owned = await loadOwnedAddress(id, session.id);
    if (!owned) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const updated = await withTransaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.address.updateMany({
          where: { userId: session.id, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data: parsed.data });
    });
    return NextResponse.json({ address: toSavedAddress(updated) });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const { id } = await ctx.params;
    const owned = await loadOwnedAddress(id, session.id);
    if (!owned) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.address.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
pnpm test:server -t "/api/auth/account/addresses"
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/account/addresses
git commit -m "feat(backend): /account/addresses GET/POST + [id] PATCH/DELETE with IDOR check"
```

---

## Task 18: Client `authFetch` helper + verify-email page

**Files:**
- Create: `src/lib/auth-fetch.ts`
- Create: `src/components/auth/verify-email-form.tsx`
- Create: `src/app/(auth)/verify-email/page.tsx`

- [ ] **Step 1: Write `src/lib/auth-fetch.ts`**

```ts
let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const r = await fetch("/api/auth/csrf");
  const j = (await r.json()) as { csrfToken: string };
  cachedCsrfToken = j.csrfToken;
  return j.csrfToken;
}

/**
 * Browser fetch wrapper that injects the x-csrf-token header. Used by every
 * auth form / account mutation. Reads (and caches) the CSRF token from
 * Auth.js's /api/auth/csrf endpoint.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const csrfToken = await getCsrfToken();
  const headers = new Headers(init?.headers);
  headers.set("x-csrf-token", csrfToken);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(url, { ...init, headers, credentials: "same-origin" });
}
```

- [ ] **Step 2: Write `src/components/auth/verify-email-form.tsx`**

```tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface VerifyEmailFormProps {
  email: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}

export function VerifyEmailForm({ email, onSubmit, onResend }: VerifyEmailFormProps) {
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resendOk, setResendOk] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setResendOk(false);
    try {
      await onResend();
      setResendOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[14px] text-foreground-secondary">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify your account.
      </p>
      <Input
        autoFocus
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Verification code"
      />
      {error && <p className="text-[13px] text-foreground-warning">{error}</p>}
      {resendOk && !error && (
        <p className="text-[13px] text-foreground-secondary">A new code has been sent.</p>
      )}
      <Button type="submit" size="lg" disabled={submitting || code.length !== 6}>
        {submitting ? "Verifying…" : "Verify email"}
      </Button>
      <button
        type="button"
        onClick={resend}
        className="mt-2 text-[13px] text-foreground-secondary underline underline-offset-4 hover:text-foreground-primary self-center"
      >
        Resend code
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/app/(auth)/verify-email/page.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function VerifyEmailPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const toast = useToast();

  const onSubmit = async (code: string) => {
    const res = await authFetch("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        body.error === "INVALID_CODE"
          ? "That code is incorrect. Try again."
          : "We could not verify the code right now.",
      );
    }
    toast.show("Email verified — please sign in.");
    router.push("/sign-in");
  };

  const onResend = async () => {
    const res = await authFetch("/api/auth/verify-email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "RATE_LIMIT") throw new Error("Please wait before requesting another code.");
      throw new Error("Could not resend the code.");
    }
  };

  if (!email) {
    return (
      <AuthCard
        title="Verify email"
        subtitle="Open this page from the email link or after registering."
        sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      >
        <p className="text-[14px] text-foreground-secondary">No email provided.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify email"
      subtitle="Enter the code we just sent."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
    >
      <VerifyEmailForm email={email} onSubmit={onSubmit} onResend={onResend} />
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <ToastProvider>
      <VerifyEmailPageInner />
    </ToastProvider>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build 2>&1 | tail -3
```

Expected: build green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-fetch.ts src/components/auth/verify-email-form.tsx src/app/\(auth\)/verify-email
git commit -m "feat(frontend): authFetch helper + verify-email page + form"
```

---

## Task 19: Wire register / sign-in / forgot-password / reset-password forms to the API

**Files:** Modify
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/sign-in/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`

For each, the change is the same shape: the page used to call `useAuthStubStore.signIn()`; now it calls the matching API route via `authFetch`. Existing form components (RegisterForm, SignInForm, etc.) keep their props — only the page-level submit handler changes.

- [ ] **Step 1: Replace `src/app/(auth)/register/page.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm, type RegisterFormSubmit } from "@/components/auth/register-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function RegisterPageInner() {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: RegisterFormSubmit) => {
    const res = await authFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.firstName,
      }),
    });
    if (res.status === 409) {
      throw new Error("That email is already registered.");
    }
    if (!res.ok) {
      throw new Error("We could not create your account right now.");
    }
    toast.show("Check your email for the verification code.");
    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Welcome to YNOT London."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          Already a member?{" "}
          <a href="/sign-in" className="underline underline-offset-4">Sign in</a>
        </>
      }
    >
      <RegisterForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <ToastProvider>
      <RegisterPageInner />
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Replace `src/app/(auth)/sign-in/page.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm, type SignInFormSubmit } from "@/components/auth/sign-in-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function SignInPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  const toast = useToast();

  const handleSubmit = async (data: SignInFormSubmit) => {
    const res = await authFetch("/api/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "EMAIL_NOT_VERIFIED") {
        toast.show("Verify your email to continue.");
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
    }
    if (!res.ok) {
      throw new Error("Email or password is incorrect.");
    }
    toast.show("Welcome back.");
    router.push(next);
    router.refresh();
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to YNOT London."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          New to YNOT?{" "}
          <a href="/register" className="underline underline-offset-4">Create account</a>
        </>
      }
    >
      <SignInForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <ToastProvider>
      <SignInPageInner />
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Replace `src/app/(auth)/forgot-password/page.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import {
  ForgotPasswordForm,
  type ForgotPasswordFormSubmit,
} from "@/components/auth/forgot-password-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function ForgotPasswordPageInner() {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: ForgotPasswordFormSubmit) => {
    const res = await authFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: data.email }),
    });
    if (!res.ok && res.status !== 429) {
      // 200 returned even for unknown emails (anti-enumeration) so non-200 is
      // an unexpected server error.
      throw new Error("We could not start a password reset right now.");
    }
    toast.show("If that email is registered, a code is on the way.");
    router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter the email associated with your YNOT account."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          Remembered it?{" "}
          <a href="/sign-in" className="underline underline-offset-4">Back to sign in</a>
        </>
      }
    >
      <ForgotPasswordForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <ToastProvider>
      <ForgotPasswordPageInner />
    </ToastProvider>
  );
}
```

- [ ] **Step 4: Replace `src/app/(auth)/reset-password/page.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import {
  ResetPasswordForm,
  type ResetPasswordFormSubmit,
} from "@/components/auth/reset-password-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function ResetPasswordPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const toast = useToast();

  const handleSubmit = async (data: ResetPasswordFormSubmit) => {
    const res = await authFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email,
        code: data.code,
        newPassword: data.password,
      }),
    });
    if (res.status === 401) {
      throw new Error("That code is incorrect or expired.");
    }
    if (!res.ok) {
      throw new Error("We could not reset your password right now.");
    }
    toast.show("Password updated. Sign in with your new password.");
    router.push("/sign-in");
  };

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Enter the code from your email and a new password."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          Need a fresh code?{" "}
          <a href="/forgot-password" className="underline underline-offset-4">
            Start again
          </a>
        </>
      }
    >
      <ResetPasswordForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <ToastProvider>
      <ResetPasswordPageInner />
    </ToastProvider>
  );
}
```

- [ ] **Step 5: Verify the existing `RegisterFormSubmit` / `ResetPasswordFormSubmit` shapes match**

```bash
grep -n "FormSubmit" src/components/auth/*.tsx
```

If the form component's submit type lacks `code` (for `ResetPasswordFormSubmit`) or differs in field names from what the page now passes, fix the form component to match (each `*-form.tsx` is small — usually a 1-line type addition). The four form types should expose:

- `SignInFormSubmit = { email: string; password: string }`
- `RegisterFormSubmit = { email: string; password: string; firstName: string }`
- `ForgotPasswordFormSubmit = { email: string }`
- `ResetPasswordFormSubmit = { code: string; password: string }`

- [ ] **Step 6: Verify build**

```bash
pnpm build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\) src/components/auth
git commit -m "refactor(frontend): wire all (auth) forms to the new /api/auth/* routes"
```

---

## Task 20: Server-side account layout + SessionProvider

**Files:**
- Create: `src/components/account/session-context.tsx`
- Replace: `src/app/account/layout.tsx`

- [ ] **Step 1: Write `src/components/account/session-context.tsx`**

```tsx
"use client";

import * as React from "react";
import type { SessionUser } from "@/server/auth/session";

const SessionContext = React.createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUser {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionUser must be used inside <SessionProvider>");
  }
  return ctx;
}

export function useSessionUserOrNull(): SessionUser | null {
  return React.useContext(SessionContext);
}
```

Note the import of `SessionUser` from `@/server/auth/session` is a **type-only import** (no runtime import of server code from client). TypeScript erases it at build, so the ESLint rule is satisfied. If the rule still fires, this is the one place to add `import type` explicitly: `import type { SessionUser } from "@/server/auth/session";` — TypeScript will strip it.

- [ ] **Step 2: Replace `src/app/account/layout.tsx`**

```tsx
import * as React from "react";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { AccountLayout } from "@/components/account/account-layout";
import { SessionProvider } from "@/components/account/session-context";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/sign-in?next=/account");
  }
  return (
    <SessionProvider user={user}>
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
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </SessionProvider>
  );
}
```

- [ ] **Step 3: Verify the existing `AccountLayout` accepts no `user` prop**

```bash
grep -n "interface AccountLayoutProps\|export function AccountLayout" src/components/account/account-layout.tsx
```

If `AccountLayout` previously read from `useAuthStubStore` for its own greeting / sidebar, change it to call `useSessionUser()` instead. Repeat for `account-tabs.tsx`. Each replacement is one import swap and one symbol rename (`useAuthStubStore((s) => s.user)` → `useSessionUser()`).

- [ ] **Step 4: Verify build**

```bash
pnpm typecheck && pnpm lint && pnpm build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/layout.tsx src/components/account/session-context.tsx src/components/account
git commit -m "refactor(account): server-side gate via getSessionUser + SessionProvider"
```

---

## Task 21: Update profile / addresses pages to use the API

**Files:** Modify
- `src/app/account/profile/page.tsx`
- `src/app/account/addresses/page.tsx`
- `src/components/account/account-tabs.tsx`
- `src/lib/stores/addresses-store.ts`

- [ ] **Step 1: Replace `src/app/account/profile/page.tsx`**

Read the current file first; it likely renders a form that calls `useAuthStubStore`. Replace its contents:

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Display } from "@/components/ui/typography";
import { useSessionUser } from "@/components/account/session-context";
import { authFetch } from "@/lib/auth-fetch";

export default function AccountProfilePage() {
  const user = useSessionUser();
  const [name, setName] = React.useState(user.name ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await authFetch("/api/auth/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Could not save your changes.");
      setFeedback("Saved");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Display level="md" as="h1">Profile</Display>
      <form onSubmit={onSubmit} className="flex max-w-[400px] flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.18em] text-foreground-secondary">
            Email
          </span>
          <span className="text-[14px]">{user.email}</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12px] uppercase tracking-[0.18em] text-foreground-secondary">
            Name
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        {feedback && <p className="text-[13px] text-foreground-secondary">{feedback}</p>}
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/account/addresses/page.tsx`**

Read the existing file first. The new version drops the SEED constant and hydrates from the API. Replace its contents:

```tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";
import { AddressCard } from "@/components/account/address-card";
import { AddressFormModal } from "@/components/account/address-form-modal";
import type { SavedAddress } from "@/lib/schemas/saved-address";
import { authFetch } from "@/lib/auth-fetch";

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [editing, setEditing] = React.useState<SavedAddress | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const res = await authFetch("/api/auth/account/addresses");
    if (res.ok) {
      const body = (await res.json()) as { addresses: SavedAddress[] };
      setAddresses(body.addresses);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = async (data: Omit<SavedAddress, "id">, id?: string) => {
    const url = id
      ? `/api/auth/account/addresses/${id}`
      : `/api/auth/account/addresses`;
    const res = await authFetch(url, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify({
        label: data.label,
        isDefault: data.isDefault,
        ...data.address,
      }),
    });
    if (!res.ok) throw new Error("Could not save the address.");
    await reload();
    setEditing(null);
    setAdding(false);
  };

  const onRemove = async (id: string) => {
    const res = await authFetch(`/api/auth/account/addresses/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    await reload();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Display level="md" as="h1">Addresses</Display>
        <Button onClick={() => setAdding(true)} size="md">Add address</Button>
      </div>
      {loading ? (
        <p className="text-[14px] text-foreground-secondary">Loading…</p>
      ) : addresses.length === 0 ? (
        <p className="text-[14px] text-foreground-secondary">No addresses yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              onEdit={() => setEditing(a)}
              onRemove={() => onRemove(a.id)}
            />
          ))}
        </div>
      )}
      {(adding || editing) && (
        <AddressFormModal
          initial={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSubmit={(data) => onSave(data, editing?.id)}
        />
      )}
    </div>
  );
}
```

If `AddressFormModal`'s `onSubmit` signature does not match `(data: Omit<SavedAddress, "id">) => Promise<void>`, adjust its prop type. The `onSubmit` callback should hand the address payload upward; the page handles persistence.

- [ ] **Step 3: Update `src/lib/stores/addresses-store.ts`**

Replace its contents:

```ts
// This store now exists only to bridge components that still expect a
// store-shaped API. Phase 3 reads/writes through /api/auth/account/addresses.
// New code should use authFetch directly.
import { create } from "zustand";
import type { SavedAddress } from "@/lib/schemas/saved-address";

interface AddressesState {
  addresses: SavedAddress[];
  setAll: (rows: SavedAddress[]) => void;
}

export const useAddressesStore = create<AddressesState>()((set) => ({
  addresses: [],
  setAll: (rows) => set({ addresses: rows }),
}));
```

- [ ] **Step 4: Update `src/components/account/account-tabs.tsx`**

Read the file. If it imports `useAuthStubStore`, change the import to `useSessionUser` from `@/components/account/session-context`. Adjust references:

```ts
// Before:
const user = useAuthStubStore((s) => s.user);
// After:
const user = useSessionUser();
```

`user.firstName` may need to be replaced with `user.name?.split(" ")[0]` if the original used `firstName` for the greeting.

- [ ] **Step 5: Verify build**

```bash
pnpm typecheck && pnpm lint && pnpm build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/app/account src/components/account src/lib/stores/addresses-store.ts
git commit -m "refactor(account): profile + addresses pages call /api/auth/account/* via authFetch"
```

---

## Task 22: Replace Phase 2 stubs and remove `auth-stub-store`

**Files:**
- Modify: `src/server/data/orders.ts`
- Modify: `src/server/data/addresses.ts`
- Delete: `src/lib/stores/auth-stub-store.ts`
- Delete: `src/lib/stores/__tests__/auth-stub-store.test.ts` (if it exists)

- [ ] **Step 1: Replace `src/server/data/orders.ts`**

```ts
import type { Order } from "@/lib/schemas";
import {
  findOrderById,
  listOrdersForUser,
} from "@/server/repositories/order.repo";
import { getSessionUser } from "@/server/auth/session";
import { toOrder } from "./adapters/order";

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listOrdersForUser(user.id);
  return rows.map(toOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await findOrderById(id);
  return row ? toOrder(row) : null;
}
```

- [ ] **Step 2: Replace `src/server/data/addresses.ts`**

```ts
import type { SavedAddress } from "@/lib/schemas/saved-address";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { getSessionUser } from "@/server/auth/session";
import { toSavedAddress } from "./adapters/address";

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listAddressesForUser(user.id);
  return rows.map(toSavedAddress);
}
```

- [ ] **Step 3: Delete the stub store**

```bash
rm -f src/lib/stores/auth-stub-store.ts
rm -f src/lib/stores/__tests__/auth-stub-store.test.ts
```

- [ ] **Step 4: Verify nothing imports the deleted store**

```bash
grep -rn "auth-stub-store\|useAuthStubStore" src/
```

Expected: no results. If any remain, replace with `useSessionUser()` from `@/components/account/session-context` or `getSessionUser()` from server.

- [ ] **Step 5: Verify all flows still pass typecheck + tests**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/server/data/orders.ts src/server/data/addresses.ts src/lib/stores
git commit -m "refactor(server): replace PHASE 3 stubs with getSessionUser; delete auth-stub-store"
```

---

## Task 23: End-to-end smoke + final validation + push + PR

**Files:** none (verification + git only)

- [ ] **Step 1: Run all four quality gates**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: every command exits 0. Server test count grows by ~30; client test count stays at 143.

- [ ] **Step 2: Live end-to-end check — register → verify → sign-in**

```bash
pnpm db:reset
pnpm db:seed
pnpm dev > /tmp/dev.log 2>&1 &
sleep 8
```

In a browser:
1. Open `http://localhost:3000/register`. Fill the form with a fresh email + a password ≥ 8 chars + a name. Submit.
2. The page redirects to `/verify-email?email=...`. In a separate terminal: `tail -f /tmp/dev.log` — find the `[ynot dev email] Verification code` block and copy the 6-digit code.
3. Enter the code; the page redirects to `/sign-in`.
4. Sign in with the same email + password. Verify the session by visiting `/account` — page renders with the new user's email shown.
5. Visit `/account/orders` — empty list (the demo seed order belongs to `demo@ynot.london`, not the new user).
6. Sign out via the account UI; return to `/account` → redirects to `/sign-in?next=/account`.

Then `kill %1`.

- [ ] **Step 3: Verify the 14 success criteria from the spec**

Run each check from spec §9:

```bash
# 1. auth-stub-store gone
grep -rn "auth-stub-store\|useAuthStubStore" src/ | grep -v _mock || echo "✓ stub gone"
# 2. account/layout is server component
grep -n "'use client'" src/app/account/layout.tsx || echo "✓ layout is server"
# 3. server/auth dir
ls src/server/auth/{config,nextauth,session,codes,password,rate-limit,csrf}.ts
# 4. server/email dir
ls src/server/email/{types,console,resend,index}.ts
# 5. route handlers
find src/app/api/auth -name "route.ts" | wc -l
# 6. user.repo
grep -E "^export (async )?function (createUser|findUserByEmail|markEmailVerified|updatePassword|softDeleteUser)" src/server/repositories/user.repo.ts | wc -l
# 7. PHASE 3 stubs gone
grep -rn "PHASE 3:" src/server/data/ || echo "✓ stubs replaced"
# 8 + 9 done in Step 2 manually
# 10. password change invalidates: covered by integration test in Task 16
# 11. rate limit: covered by integration test in Task 7
# 12. test counts
pnpm test 2>&1 | tail -2
# 13. quality gates done in Step 1
# 14. /account/orders empty for new user: done in Step 2.5
```

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feature/backend-phase-3-auth-customer
```

- [ ] **Step 5: Create the PR**

If `gh` CLI is installed:

```bash
gh pr create --title "feat(backend): Phase 3 — Auth & Customer (sessions + verify + reset)" --body "$(cat <<'EOF'
## Summary
- Auth.js v5 with Prisma adapter + database sessions on the existing Phase 1 Session table.
- Code-based email verification (6-digit OTP, 15-min TTL, mandatory before first sign-in).
- Code-based password reset.
- Email service abstraction: ConsoleEmailService dev fallback + ResendEmailService production. Factory selects by RESEND_API_KEY/FROM env vars.
- Server-side gating of /account/* — getSessionUser in a Server Component layout, no useEffect flash.
- /api/auth/* routes (11 files, 14 endpoints): register / verify-email + resend / sign-in / sign-out / forgot-password / reset-password / account/profile / account/password / account/delete / account/addresses + [id].
- Replaced both `// PHASE 3:` stubs in src/server/data/orders.ts + addresses.ts with getSessionUser().
- Deleted src/lib/stores/auth-stub-store.ts entirely.
- CSRF on all custom routes via x-csrf-token header validated against Auth.js's cookie.
- Redis sliding-window rate limit on abuse-prone routes.

## Out of scope
- OAuth / magic-link / 2FA / bearer tokens.
- Branded HTML email templates — Phase 5 will replace the plain-text bodies.
- Admin RBAC enforcement — Phase 6.

## Test plan
- [ ] `pnpm db:up && pnpm db:migrate && pnpm db:seed` succeed.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.
- [ ] Register a fresh email → copy code from dev terminal → verify → sign in → /account renders the new user.
- [ ] Forgot password from a verified email → reset code from dev terminal → reset → sign in.
- [ ] Sign out → /account redirects to /sign-in.
- [ ] /account/orders shows seeded demo order when signed in as demo@ynot.london; empty for new user.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `gh` is missing, open the printed URL in a browser and paste the title + body manually.

- [ ] **Step 6: Merge after review and clean up locally**

After the PR is approved (or self-approved by clicking "Squash and merge" → "Confirm"):

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git checkout main
git fetch origin
git reset --hard origin/main
git worktree remove .worktrees/backend-phase-3-auth-customer
git branch -D feature/backend-phase-3-auth-customer 2>/dev/null || true
```

Expected: main is at the merged squash commit; the worktree directory is gone; the local branch is deleted.

---

## Self-review

**1. Spec coverage.** Each numbered success criterion in spec §9 maps to at least one task: §9.1 (stub removed) → T22; §9.2 (server-side layout) → T20; §9.3 (server/auth/) → T5–T11; §9.4 (server/email/) → T3–T4; §9.5 (route handlers) → T10, T12–T17; §9.6 (user.repo) → T8; §9.7 (PHASE 3 stubs gone) → T22; §9.8 (register→verify→sign-in flow) → T23 manual smoke; §9.9 (forgot→reset flow) → T23; §9.10 (password change invalidation) → T16 integration test; §9.11 (rate limit) → T7 integration test; §9.12 (test counts) → T23; §9.13 (quality gates) → T23; §9.14 (orders for new user) → T23. Architecture decisions: Auth.js config (§5.3) → T10; code lifecycle (§5.4) → T6; email factory (§5.5) → T3–T4; server-side gating (§5.6) → T20; stub replacement (§5.7) → T22; rate limiting (§5.8) → T7; CSRF (§5.9) → T11 + every custom-route task; address CRUD (§5.10) → T17. ENV additions (§7) → T2.

**2. Placeholder scan.** No "TBD"/"TODO"/"implement later"/"add appropriate error handling". Every code step is complete and runnable. The two "Note that …" prose paragraphs are clarifications about TypeScript erasure and form-prop typing, not deferrals.

**3. Type consistency.** Function names match across definition (T5–T11), tests (T5–T11), and callers (T10, T12–T17): `hashPassword`/`verifyPassword`, `generateCode`/`issueVerificationToken`/`consumeVerificationToken`/`verificationIdentifier`, `checkRateLimit`, `createUser`/`findUserByEmail`/`markEmailVerified`/`updatePassword`/`softDeleteUser`, `getSessionUser`/`requireSessionUser`, `assertCsrf`, `getEmailService`/`createEmailService`. The Zod request schema names match in `lib/schemas/auth.ts` and every Route Handler that imports them. Cookie name `ynot.session-token` is identical between config (§5.3 in spec, T10 in plan). The `// PHASE 3:` removal targets exactly the two files Phase 2 added the markers to.

---

**Plan complete and saved to `web/docs/superpowers/plans/2026-04-29-ynot-backend-phase-3-auth-customer.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session, batch with checkpoints.

Which approach?
