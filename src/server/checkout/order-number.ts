import type { Prisma } from '@prisma/client';

/**
 * Generate a display-friendly order number using the Postgres sequence
 * `order_number_seq` (created in Phase 4 migration; specified by Phase 1 §241).
 *
 * Format: YN-YYYY-NNNNN (e.g. "YN-2026-00001"). Zero-padded to 5 digits;
 * gracefully degrades to longer formats above 99,999 without truncation.
 *
 * Must be called inside a Prisma transaction so the sequence advance and the
 * Order insert commit atomically.
 */
export async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('order_number_seq')`;
  const n: bigint = rows[0]?.nextval ?? BigInt(1);
  const year = new Date().getUTCFullYear();
  return `YN-${year}-${n.toString().padStart(5, '0')}`;
}
