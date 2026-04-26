# YNOT Storefront — Phase 5: Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Ship the auth-page surface (Sign In, Register, Forgot Password, Reset Password) with shared layout, validated forms, and stub submit handlers. No real backend yet — forms call stub functions that show success toasts. When the backend phase lands later, we swap stubs for NextAuth calls without touching UI.

**Architecture:** Dedicated `src/app/(auth)/layout.tsx` route group with a centred AuthCard layout (no nav header, no overlays). Forms are React Hook Form-style controlled-state components with explicit submit handlers passed in as props. A small `useAuthStub` Zustand store fakes a "current user" so we can wire account-redirect behavior in Phase 6. Stub submit functions log + show toasts; replaceable later.

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Zustand 5.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § Auth pages.

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-5-auth` (NEW worktree).

**Prerequisites in main:** Phases 1-4 (113 tests, full chrome + homepage + catalog/PDP + checkout).

---

## File structure

```
web/
├── src/
│   ├── lib/
│   │   └── stores/
│   │       ├── auth-stub-store.ts            [created]
│   │       └── __tests__/
│   │           └── auth-stub-store.test.ts    [created]
│   ├── components/
│   │   └── auth/
│   │       ├── auth-card.tsx                 [created — centered card layout used by all 4 pages]
│   │       ├── auth-header.tsx               [created — minimal header (logo only) for auth layout]
│   │       ├── sign-in-form.tsx              [created]
│   │       ├── register-form.tsx             [created]
│   │       ├── forgot-password-form.tsx      [created — 2 inline states]
│   │       └── reset-password-form.tsx       [created — 2 inline states]
│   └── app/
│       └── (auth)/
│           ├── layout.tsx                    [created — minimal chrome]
│           ├── sign-in/page.tsx              [created]
│           ├── register/page.tsx             [created]
│           ├── forgot-password/page.tsx      [created]
│           └── reset-password/page.tsx       [created — reads ?token= search param]
└── (no other changes)
```

The `(auth)` route group hides chrome on these routes via its own layout while leaving URLs as `/sign-in`, `/register`, etc. (parentheses don't appear in URLs).

---

# Section A — Worktree

### Task 1: Create Phase 5 worktree

- [ ] **Step 1:**
```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git worktree add .worktrees/phase-5-auth -b feature/phase-5-auth
```

- [ ] **Step 2:**
```bash
cd .worktrees/phase-5-auth
pnpm install --frozen-lockfile
pnpm build
pnpm test
```
Expected: 113 tests pass, build green.

---

# Section B — Auth stub store

### Task 2: useAuthStubStore

**Files:**
- Create: `src/lib/stores/auth-stub-store.ts`
- Create: `src/lib/stores/__tests__/auth-stub-store.test.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStubStore } from "../auth-stub-store";

beforeEach(() => {
  useAuthStubStore.setState({ user: null });
});

describe("auth stub store", () => {
  it("starts logged out", () => {
    expect(useAuthStubStore.getState().user).toBeNull();
    expect(useAuthStubStore.getState().isAuthenticated()).toBe(false);
  });

  it("signIn stores a user (email + name)", () => {
    useAuthStubStore.getState().signIn({ email: "jane@example.com", firstName: "Jane" });
    const u = useAuthStubStore.getState().user;
    expect(u?.email).toBe("jane@example.com");
    expect(u?.firstName).toBe("Jane");
    expect(useAuthStubStore.getState().isAuthenticated()).toBe(true);
  });

  it("signOut clears the user", () => {
    useAuthStubStore.getState().signIn({ email: "x@y.z", firstName: "X" });
    useAuthStubStore.getState().signOut();
    expect(useAuthStubStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StubUser {
  email: string;
  firstName: string;
}

interface AuthState {
  user: StubUser | null;
  signIn: (user: StubUser) => void;
  signOut: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStubStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      isAuthenticated: () => get().user !== null,
    }),
    { name: "ynot-auth-stub" },
  ),
);
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/stores/auth-stub-store.ts src/lib/stores/__tests__/auth-stub-store.test.ts
git commit -m "feat(state): add auth stub Zustand store (replaceable when NextAuth lands)"
```

---

# Section C — Auth shared chrome

### Task 3: AuthHeader

**Files:**
- Create: `src/components/auth/auth-header.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import logoBlack from "../../../public/brand/ynot-logo-black.png";

export function AuthHeader() {
  return (
    <header className="w-full border-b border-border-light bg-surface-primary">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-center px-5 md:px-10">
        <Link href="/" aria-label="YNOT London" className="relative block h-8 w-[64px]">
          <Image src={logoBlack} alt="YNOT London" fill sizes="80px" priority className="object-contain" />
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/auth/auth-header.tsx
git commit -m "feat(auth): add minimal AuthHeader (logo only, centred)"
```

---

### Task 4: AuthCard

**Files:**
- Create: `src/components/auth/auth-card.tsx`

- [ ] **Step 1:** Implement (centered card layout used by all auth pages):

```tsx
import * as React from "react";
import { Display } from "@/components/ui/typography";

export interface AuthCardProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-[440px] px-6 py-16 md:py-24">
      <div className="text-center mb-10">
        <Display level="md" as="h1">{title}</Display>
        {subtitle && (
          <p className="mt-3 text-[14px] text-foreground-secondary">{subtitle}</p>
        )}
      </div>
      {children}
      {footer && (
        <div className="mt-8 text-center text-[13px] text-foreground-secondary">
          {footer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/auth/auth-card.tsx
git commit -m "feat(auth): add AuthCard centered layout for all 4 auth pages"
```

---

# Section D — Auth forms

### Task 5: SignInForm

**Files:**
- Create: `src/components/auth/sign-in-form.tsx`
- Create: `src/components/auth/__tests__/sign-in-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "../sign-in-form";

describe("SignInForm", () => {
  it("calls onSubmit with email + password + remember when filled and submitted", async () => {
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2");
    await userEvent.click(screen.getByLabelText(/remember me/i));
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.email).toBe("jane@example.com");
    expect(args.password).toBe("hunter2");
    expect(args.rememberMe).toBe(true);
  });

  it("does not submit when email is empty", async () => {
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface SignInFormSubmit {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignInFormProps {
  onSubmit: (data: SignInFormSubmit) => void;
}

export function SignInForm({ onSubmit }: SignInFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({ email, password, rememberMe });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="flex items-center justify-between">
        <Checkbox
          label="Remember me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <Link href="/forgot-password" className="text-[12px] uppercase tracking-[0.15em] text-foreground-secondary hover:text-foreground-primary">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" fullWidth>
        Sign in
      </Button>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/auth/sign-in-form.tsx src/components/auth/__tests__/sign-in-form.test.tsx
git commit -m "feat(auth): add SignInForm (email + password + remember me)"
```

---

### Task 6: RegisterForm

**Files:**
- Create: `src/components/auth/register-form.tsx`
- Create: `src/components/auth/__tests__/register-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../register-form";

describe("RegisterForm", () => {
  it("submits when all required fields + T&C checked", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter22");
    await userEvent.click(screen.getByLabelText(/terms & conditions/i));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.firstName).toBe("Jane");
    expect(args.email).toBe("jane@example.com");
    expect(args.acceptedTerms).toBe(true);
    expect(args.subscribeNewsletter).toBe(false);
  });

  it("does not submit when T&C not checked", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter22");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
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
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface RegisterFormSubmit {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  subscribeNewsletter: boolean;
}

export interface RegisterFormProps {
  onSubmit: (data: RegisterFormSubmit) => void;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !acceptedTerms) return;
    onSubmit({ firstName, lastName, email, password, acceptedTerms, subscribeNewsletter });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Input
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Checkbox
        label="I agree to the Terms & Conditions and Privacy Policy"
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
      />
      <Checkbox
        label="Subscribe to our newsletter for exclusive offers"
        checked={subscribeNewsletter}
        onChange={(e) => setSubscribeNewsletter(e.target.checked)}
      />
      <Button type="submit" size="lg" fullWidth>
        Create account
      </Button>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/auth/register-form.tsx src/components/auth/__tests__/register-form.test.tsx
git commit -m "feat(auth): add RegisterForm (name + email + password + T&C + newsletter)"
```

---

### Task 7: ForgotPasswordForm (2 inline states)

**Files:**
- Create: `src/components/auth/forgot-password-form.tsx`
- Create: `src/components/auth/__tests__/forgot-password-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "../forgot-password-form";

describe("ForgotPasswordForm", () => {
  it("calls onSubmit with email and switches to sent-state", async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(onSubmit).toHaveBeenCalledWith("jane@example.com");
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it("Resend link in sent-state re-fires onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ForgotPasswordFormProps {
  onSubmit: (email: string) => void;
}

export function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onSubmit(email);
    setSubmitted(true);
  };

  const handleResend = () => {
    onSubmit(email);
  };

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] mb-4">Check your email</h2>
        <p className="text-[14px] text-foreground-secondary mb-6">
          If an account exists for <strong>{email}</strong>, you&rsquo;ll receive a password reset link shortly.
        </p>
        <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary">
          Didn&rsquo;t receive the email?{" "}
          <button type="button" onClick={handleResend} className="underline hover:text-foreground-primary">
            Resend
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" size="lg" fullWidth>
        Send reset link
      </Button>
      <Link
        href="/sign-in"
        className="text-center text-[12px] uppercase tracking-[0.15em] text-foreground-secondary hover:text-foreground-primary"
      >
        Back to sign in
      </Link>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/auth/forgot-password-form.tsx src/components/auth/__tests__/forgot-password-form.test.tsx
git commit -m "feat(auth): add ForgotPasswordForm with inline 'sent' state + resend"
```

---

### Task 8: ResetPasswordForm

**Files:**
- Create: `src/components/auth/reset-password-form.tsx`
- Create: `src/components/auth/__tests__/reset-password-form.test.tsx`

- [ ] **Step 1:** Failing test:

```tsx
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "../reset-password-form";

describe("ResetPasswordForm", () => {
  it("calls onSubmit when both passwords match", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm token="abc" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/new password/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm/i), "newpass1");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith({ token: "abc", password: "newpass1" });
    expect(screen.getByText(/password updated/i)).toBeInTheDocument();
  });

  it("shows mismatch error when passwords differ", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm token="abc" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/new password/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm/i), "different");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export interface ResetPasswordSubmit {
  token: string;
  password: string;
}

export interface ResetPasswordFormProps {
  token: string;
  onSubmit: (data: ResetPasswordSubmit) => void;
}

export function ResetPasswordForm({ token, onSubmit }: ResetPasswordFormProps) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    onSubmit({ token, password });
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] mb-4">Password updated</h2>
        <p className="text-[14px] text-foreground-secondary mb-6">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Link href="/sign-in">
          <Button size="lg" fullWidth>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <PasswordInput
        label="New password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={error ?? undefined}
        required
      />
      <Button type="submit" size="lg" fullWidth>
        Save
      </Button>
    </form>
  );
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/components/auth/reset-password-form.tsx src/components/auth/__tests__/reset-password-form.test.tsx
git commit -m "feat(auth): add ResetPasswordForm with password match validation"
```

---

# Section E — Auth route group + 4 pages

### Task 9: (auth) layout

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { AuthHeader } from "@/components/auth/auth-header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 bg-surface-primary">{children}</main>
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add "src/app/(auth)/layout.tsx"
git commit -m "feat(auth): add (auth) route group layout with minimal AuthHeader"
```

---

### Task 10: /sign-in page

**Files:**
- Create: `src/app/(auth)/sign-in/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm, type SignInFormSubmit } from "@/components/auth/sign-in-form";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";
import { useToast, ToastProvider } from "@/components/ui/toast";

function SignInPageInner() {
  const router = useRouter();
  const signIn = useAuthStubStore((s) => s.signIn);
  const { show } = useToast();

  const onSubmit = (data: SignInFormSubmit) => {
    // Stub: real auth lands later; for now derive a fake firstName from email local-part.
    const firstName = data.email.split("@")[0];
    signIn({ email: data.email, firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1) });
    show("Signed in (stub)");
    router.push("/");
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Sign in to access your account and exclusive benefits."
      footer={
        <>
          New to YNOT?{" "}
          <Link href="/register" className="text-foreground-primary underline hover:no-underline">
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm onSubmit={onSubmit} />
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

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add "src/app/(auth)/sign-in/page.tsx"
git commit -m "feat(auth): add /sign-in page wired to auth stub store"
```

---

### Task 11: /register page

**Files:**
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm, type RegisterFormSubmit } from "@/components/auth/register-form";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";
import { useToast, ToastProvider } from "@/components/ui/toast";

function RegisterPageInner() {
  const router = useRouter();
  const signIn = useAuthStubStore((s) => s.signIn);
  const { show } = useToast();

  const onSubmit = (data: RegisterFormSubmit) => {
    signIn({ email: data.email, firstName: data.firstName });
    show("Account created (stub)");
    router.push("/");
  };

  return (
    <AuthCard
      title="Create account"
      subtitle="Join YNOT London for exclusive access and benefits."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-foreground-primary underline hover:no-underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm onSubmit={onSubmit} />
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

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add "src/app/(auth)/register/page.tsx"
git commit -m "feat(auth): add /register page wired to auth stub store"
```

---

### Task 12: /forgot-password page

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  const onSubmit = (email: string) => {
    // Stub: real backend sends email later.
    console.log("[stub] forgot password email →", email);
  };
  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
    >
      <ForgotPasswordForm onSubmit={onSubmit} />
    </AuthCard>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add "src/app/(auth)/forgot-password/page.tsx"
git commit -m "feat(auth): add /forgot-password page (stub submit)"
```

---

### Task 13: /reset-password page

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1:** Implement (reads `?token=` from search params):

```tsx
"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm, type ResetPasswordSubmit } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const onSubmit = (data: ResetPasswordSubmit) => {
    console.log("[stub] reset password →", { token: data.token, hasPassword: !!data.password });
  };

  return (
    <AuthCard
      title="Reset password"
      subtitle={token ? undefined : "This link is missing a token. Please use the link from your email."}
    >
      {token ? (
        <ResetPasswordForm token={token} onSubmit={onSubmit} />
      ) : (
        <p className="text-center text-[13px] text-foreground-secondary">
          Open the password reset link from the email we sent you.
        </p>
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Smoke (start dev briefly, hit all 4 routes, kill dev):
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "/sign-in           → HTTP %{http_code}\n" http://localhost:3000/sign-in
curl -s -o /dev/null -w "/register          → HTTP %{http_code}\n" http://localhost:3000/register
curl -s -o /dev/null -w "/forgot-password   → HTTP %{http_code}\n" http://localhost:3000/forgot-password
curl -s -o /dev/null -w "/reset-password    → HTTP %{http_code}\n" http://localhost:3000/reset-password
curl -s -o /dev/null -w "/reset-password?token=abc → HTTP %{http_code}\n" "http://localhost:3000/reset-password?token=abc"
pkill -f "next dev" 2>/dev/null || true
```
Expected: all 200.

- [ ] **Step 4:** Commit:
```bash
git add "src/app/(auth)/reset-password/page.tsx"
git commit -m "feat(auth): add /reset-password page reading ?token= from URL"
```

---

# Section F — Verification

### Task 14: Final gate + tag

- [ ] **Step 1:** Tests:
```bash
pnpm test
```
Expected: 122 (113 baseline + 3 auth-stub-store + 2 sign-in + 2 register + 2 forgot + 2 reset = 124 actually). Let it report — final number recorded.

- [ ] **Step 2:** Build:
```bash
pnpm build
```
Expected: routes include `/sign-in`, `/register`, `/forgot-password`, `/reset-password`.

- [ ] **Step 3:** Lint:
```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 4:** Tag:
```bash
git tag phase-5-auth-complete
git log --oneline -1
```

---

## Self-Review

- ✅ All 4 auth pages built (sign-in, register, forgot-password, reset-password)
- ✅ Forms validate required fields client-side; reset-password validates password match
- ✅ AuthCard layout shared, AuthHeader minimal
- ✅ `(auth)` route group hides chrome (no nav, no overlays interfering)
- ✅ Stub auth store persists "signed in" state for testing redirect flows in Phase 6
- ✅ Real auth deferred to backend phase per spec — stubs replaceable

## Out-of-scope

- Real NextAuth integration (deferred — backend phase)
- Real email sending (Resend later)
- 2FA, SSO, social auth (Δ1 from brainstorm — explicitly removed)
- Password strength meter (deferred polish)

## Execution

Subagent-driven, section-batched (A worktree → B store → C-D primitives + forms → E pages → F verify).
