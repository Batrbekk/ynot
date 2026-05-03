import type { EmailJob, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export interface EnqueueInput {
  template: string;
  recipientEmail: string;
  payload: Prisma.InputJsonValue;
  dispatchAt: Date;
  /**
   * Optional idempotency marker. When supplied, repeated calls with the same
   * (template, dedupKey) tuple return the original row instead of inserting a
   * duplicate. Stored in the re-purposed `cancelReason` column for now —
   * Phase 5 YAGNI; promote to a dedicated column if usage grows.
   */
  dedupKey?: string;
}

/**
 * Insert a PENDING EmailJob row that will be picked up by the worker.
 * Honors `dedupKey` for idempotent enqueue.
 */
export async function enqueueEmailJob(input: EnqueueInput): Promise<EmailJob> {
  if (input.dedupKey) {
    const existing = await prisma.emailJob.findFirst({
      where: {
        template: input.template,
        status: { in: ["PENDING", "SENT"] },
        cancelReason: input.dedupKey,
      },
    });
    if (existing) return existing;
  }
  return prisma.emailJob.create({
    data: {
      template: input.template,
      recipientEmail: input.recipientEmail,
      payload: input.payload,
      dispatchAt: input.dispatchAt,
      cancelReason: input.dedupKey ?? null,
    },
  });
}
