import type { Prisma } from '@prisma/client';

/**
 * Generate a display-friendly return number using the Postgres sequence
 * `return_number_seq` (created in the Phase 5 migration).
 *
 * Format: RT-YYYY-NNNNN (e.g. "RT-2026-00001"). Zero-padded to 5 digits;
 * gracefully degrades to longer formats above 99,999 without truncation.
 *
 * Mirrors {@link nextOrderNumber}. Must be called inside a Prisma transaction
 * so the sequence advance and the Return insert commit atomically.
 */
export async function nextReturnNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('return_number_seq')`;
  const n: bigint = rows[0]?.nextval ?? BigInt(1);
  const year = new Date().getUTCFullYear();
  return `RT-${year}-${n.toString().padStart(5, '0')}`;
}
