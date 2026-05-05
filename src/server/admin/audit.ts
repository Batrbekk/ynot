import { prisma } from '@/server/db/client';
import { Prisma } from '@prisma/client';

export interface AuditContext {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  ip?: string;
  ua?: string;
}

/**
 * Wraps a mutation. The mutation runs first; on success, an AuditLog row is
 * inserted capturing the actor, entity, action, before/after JSON snapshots,
 * IP, UA. If the audit insert fails (e.g. DB issue), we log to stderr and
 * swallow — the mutation has already committed. Phase 7b can wrap in a single
 * transaction if compliance becomes a strict requirement.
 */
export async function withAudit<T>(ctx: AuditContext, run: () => Promise<T>): Promise<T> {
  const result = await run();
  try {
    await prisma.auditLog.create({
      data: {
        actorId: ctx.actorId,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        action: ctx.action,
        before:
          ctx.before === undefined || ctx.before === null
            ? Prisma.JsonNull
            : (ctx.before as Prisma.InputJsonValue),
        after: (result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.ua ?? null,
      },
    });
  } catch (e) {
    process.stderr.write(`[audit] failed to write AuditLog row: ${(e as Error).message}\n`);
  }
  return result;
}
