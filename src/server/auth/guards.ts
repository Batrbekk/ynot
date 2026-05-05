import type { Session } from 'next-auth';

/**
 * Thrown by `requireOwner` (and future role guards) when the caller lacks
 * the necessary authentication or authorization. Route handlers that catch
 * this should respond with 401/403 — see `withAudit()` for the canonical
 * mapping.
 */
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Asserts that `session` represents a logged-in OWNER. Returns the session
 * unchanged on success; throws `AuthorizationError` otherwise.
 *
 * Auth.js v5 augments `session.user` with `role` via callbacks in
 * `src/server/auth.ts`; we read it loosely (cast through `unknown`) to
 * avoid forcing every caller to import the augmented type.
 */
export function requireOwner(session: Session | null): Session {
  if (!session?.user) {
    throw new AuthorizationError('Authentication required');
  }
  const role = (session.user as unknown as { role?: string }).role;
  if (role !== 'OWNER') {
    throw new AuthorizationError('Owner role required');
  }
  return session;
}
