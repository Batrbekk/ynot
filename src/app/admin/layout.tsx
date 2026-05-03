import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { isAdminRole } from "@/server/auth/admin";
import { AdminSignOutButton } from "./_components/sign-out-button";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/returns", label: "Returns" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/sign-in?next=/admin");
  }
  if (!isAdminRole(user.role)) {
    // Optimistic redirect — middleware can't verify the role from the JWT
    // alone, so the layout is the first server-side place we can check.
    redirect("/sign-in?next=/admin");
  }
  const envName = process.env.NODE_ENV ?? "development";
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white px-5 py-6 flex flex-col">
            <div className="mb-8">
              <h1 className="text-lg font-semibold tracking-tight">YNOT Admin</h1>
              <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
                env: {envName}
              </p>
            </div>
            <nav className="flex flex-col gap-1 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-2 hover:bg-neutral-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t border-neutral-200 text-xs text-neutral-600">
              <div className="mb-2">
                <div className="font-medium text-neutral-900">{user.name ?? user.email}</div>
                <div>{user.role}</div>
              </div>
              <AdminSignOutButton />
            </div>
          </aside>
          <main className="flex-1 px-8 py-8 overflow-x-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
