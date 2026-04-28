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
 * the top of a Route Handler.
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
