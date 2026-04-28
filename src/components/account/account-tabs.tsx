"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { authFetch } from "@/lib/auth-fetch";

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

  const handleSignOut = async () => {
    await authFetch("/api/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
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
