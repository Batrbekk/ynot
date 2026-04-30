import { handleWebhook } from '@/server/checkout/webhook';

// Webhooks need the raw body for signature verification — disable body parsing.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  const result = await handleWebhook({ rawBody, signature });
  return new Response(result.body ?? null, { status: result.status });
}
