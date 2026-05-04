import type { SessionUser } from "./session";
import { getSessionUser } from "./session";

/** Roles allowed to access /admin/* and /api/admin/*. */
export const ADMIN_ROLES = ["ADMIN", "OWNER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string | undefined | null): role is AdminRole {
  return role === "ADMIN" || role === "OWNER";
}

/**
 * Defense-in-depth helper — confirms the caller is signed in AND has an admin
 * role. Use at the top of every `/api/admin/*` route handler. Returns the
 * session user on success; throws an Error with `status` 401 (no session) or
 * 403 (wrong role) so route handlers can short-circuit with a uniform JSON
 * envelope.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!isAdminRole(user.role)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}
