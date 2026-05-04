import { NextResponse } from "next/server";
import { requireAdmin } from "./admin";
import type { SessionUser } from "./session";

/**
 * Wraps an admin route handler with role enforcement + uniform JSON error
 * envelopes. Each route exports `POST = withAdmin(async (req, ctx, user) => …)`.
 *
 * Errors thrown inside the handler are mapped to JSON responses:
 * - `Error & { status }` → that status with `{ error: e.message }`.
 * - Any other throw → 500 with `{ error: 'INTERNAL' }`.
 */
export function withAdmin<C>(
  handler: (req: Request, ctx: C, user: SessionUser) => Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    let user: SessionUser;
    try {
      user = await requireAdmin();
    } catch (e) {
      const err = e as Error & { status?: number };
      return NextResponse.json(
        { error: err.message ?? "ERROR" },
        { status: err.status ?? 500 },
      );
    }
    try {
      return await handler(req, ctx, user);
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status ?? 500;
      const body = err.message ?? "INTERNAL";
      return NextResponse.json(
        { error: status === 500 ? "INTERNAL" : body, message: body },
        { status },
      );
    }
  };
}
