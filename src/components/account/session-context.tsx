"use client";

import * as React from "react";

export interface SessionUserClient {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "EDITOR" | "ADMIN" | "OWNER";
  emailVerifiedAt: string | null;
}

const SessionContext = React.createContext<SessionUserClient | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUserClient;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUserClient {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionUser must be used inside <SessionProvider>");
  }
  return ctx;
}

export function useSessionUserOrNull(): SessionUserClient | null {
  return React.useContext(SessionContext);
}
