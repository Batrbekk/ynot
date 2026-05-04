import { handleWebhook } from '@/server/checkout/webhook';
import { buildDeps } from '@/server/fulfilment/deps';
import { env } from '@/server/env';

// Webhooks need the raw body for signature verification — disable body parsing.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Build production carrier/storage/alert deps once per cold start so each
 * webhook invocation reuses the same provider singletons (HTTP keep-alive,
 * fewer auth handshakes). This is the deferred wiring flagged in the Group
 * I+J handoff: Phase 4 left the webhook route with no deps, so the
 * post-payment `tryCreateShipment` short-circuited even when carrier
 * credentials were configured. Group P (admin endpoints) lands the same
 * factory pattern so this is the right time to backfill.
 */
const deps = buildDeps(env);

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  const result = await handleWebhook(
    { rawBody, signature },
    {
      tryCreateShipment: async (shipmentId) => {
        const r = await deps.tryCreateShipment(shipmentId);
        return { ok: r.ok };
      },
    },
  );
  return new Response(result.body ?? null, { status: result.status });
}
