import type { EmailJob, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { EmailService } from "./types";
import { renderTemplate } from "./render-template-registry";

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

export interface ProcessResult {
  processed: number;
  failed: number;
}

const MAX_ATTEMPTS = 3;

/**
 * Worker entrypoint: drains up to 50 due PENDING jobs, dispatching each via
 * the registered template renderer + the supplied EmailService. On error,
 * increments `attempts`; flips to FAILED only on the third failure.
 */
export async function processDueEmailJobs(svc: EmailService): Promise<ProcessResult> {
  const due = await prisma.emailJob.findMany({
    where: { status: "PENDING", dispatchAt: { lte: new Date() } },
    orderBy: { dispatchAt: "asc" },
    take: 50,
  });
  let processed = 0;
  let failed = 0;
  for (const job of due) {
    try {
      const rendered = await renderTemplate(job.template, job.payload);
      await svc.send({
        to: job.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments,
      });
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), attempts: job.attempts + 1 },
      });
      processed++;
    } catch (e) {
      const next = job.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          attempts: next,
          lastError: message,
          status: next >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        },
      });
      failed++;
    }
  }
  return { processed, failed };
}
