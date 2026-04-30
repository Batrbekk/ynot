import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

export async function recordStripeEvent(
  id: string,
  type: string,
  payload: Prisma.InputJsonValue,
): Promise<{ alreadyProcessed: boolean }> {
  try {
    await prisma.stripeEvent.create({ data: { id, type, payload } });
    return { alreadyProcessed: false };
  } catch (e) {
    // Postgres unique violation on PK (id) → replay; safe to ack.
    const code = (e as { code?: string }).code;
    if (code === 'P2002') return { alreadyProcessed: true };
    throw e;
  }
}
