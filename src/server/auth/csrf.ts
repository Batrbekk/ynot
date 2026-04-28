import { headers, cookies } from "next/headers";

/**
 * Validates the x-csrf-token header against Auth.js's CSRF cookie.
 * Auth.js v5 sets `__Host-authjs.csrf-token` in HTTPS contexts and
 * `authjs.csrf-token` in HTTP dev. The cookie value format is
 * `<token>|<hmac>`; the catch-all Auth.js route already validates the
 * hmac when it reads the cookie, so for our custom routes we only need
 * a string-equality check between the header and the token portion.
 */
export async function assertCsrf(): Promise<void> {
  const h = await headers();
  const headerToken = h.get("x-csrf-token");
  if (!headerToken) {
    const err = new Error("INVALID_CSRF") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  const c = await cookies();
  const cookie =
    c.get("__Host-authjs.csrf-token") ?? c.get("authjs.csrf-token");
  const cookieValue = cookie?.value.split("|")[0];
  if (!cookieValue || cookieValue !== headerToken) {
    const err = new Error("INVALID_CSRF") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
