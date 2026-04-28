let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const r = await fetch("/api/auth/csrf");
  const j = (await r.json()) as { csrfToken: string };
  cachedCsrfToken = j.csrfToken;
  return j.csrfToken;
}

/**
 * Browser fetch wrapper that injects the x-csrf-token header. Used by every
 * auth form / account mutation. Reads (and caches) the CSRF token from
 * Auth.js's /api/auth/csrf endpoint.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const csrfToken = await getCsrfToken();
  const headers = new Headers(init?.headers);
  headers.set("x-csrf-token", csrfToken);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(url, { ...init, headers, credentials: "same-origin" });
}
