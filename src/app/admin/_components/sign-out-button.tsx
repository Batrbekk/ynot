"use client";
import * as React from "react";

/**
 * Posts to the existing `/api/auth/sign-out` endpoint then hard-navigates the
 * browser to /sign-in. Sign-out wants the Auth.js CSRF cookie/header pair;
 * we read the cookie (set by `auth()` on first session read) and forward the
 * unsigned token portion as the `x-csrf-token` header.
 */
export function AdminSignOutButton() {
  const [busy, setBusy] = React.useState(false);
  async function onClick() {
    setBusy(true);
    try {
      const csrf = readCsrfCookie();
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: csrf ? { "x-csrf-token": csrf } : {},
      });
    } finally {
      window.location.href = "/sign-in";
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs underline hover:text-neutral-900 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  const found = cookies.find(
    (c) =>
      c.startsWith("__Host-authjs.csrf-token=") ||
      c.startsWith("authjs.csrf-token="),
  );
  if (!found) return null;
  const value = decodeURIComponent(found.split("=")[1] ?? "");
  return value.split("|")[0] ?? null;
}
