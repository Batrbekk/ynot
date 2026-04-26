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
