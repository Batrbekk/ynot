import * as React from "react";
import { AuthHeader } from "@/components/auth/auth-header";

export const metadata = {
  title: "Account · YNOT London",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
