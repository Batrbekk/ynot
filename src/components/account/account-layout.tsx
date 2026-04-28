"use client";

import * as React from "react";
import { useSessionUser } from "./session-context";
import { Display } from "@/components/ui/typography";
import { AccountTabs } from "./account-tabs";

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = useSessionUser();
  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];
  return (
    <div className="flex flex-col gap-10">
      <Display level="lg" as="h1">Welcome, {firstName}</Display>
      <AccountTabs />
      <div className="min-h-[40vh]">{children}</div>
    </div>
  );
}
