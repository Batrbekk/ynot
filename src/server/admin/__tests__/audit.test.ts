import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { withAudit } from '../audit';

describe('withAudit', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({
      data: { id: 'admin-u1', email: 'a@b.com', role: 'OWNER' },
    });
  });

  it('runs the operation and writes one AuditLog row with before/after', async () => {
    const result = await withAudit(
      {
        actorId: 'admin-u1',
        entityType: 'product',
        entityId: 'p1',
        action: 'product.create',
        before: null,
        ip: '1.2.3.4',
        ua: 'curl',
      },
      async () => ({ id: 'p1', name: 'X', priceCents: 10000 }),
    );
    expect(result.id).toBe('p1');
    const log = await prisma.auditLog.findFirst();
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe('admin-u1');
    expect(log!.entityType).toBe('product');
    expect(log!.entityId).toBe('p1');
    expect(log!.action).toBe('product.create');
    expect(log!.before).toBeNull();
    expect(log!.after).toEqual({ id: 'p1', name: 'X', priceCents: 10000 });
    expect(log!.ipAddress).toBe('1.2.3.4');
    expect(log!.userAgent).toBe('curl');
  });

  it('does not write a log when run() throws', async () => {
    await expect(
      withAudit(
        { actorId: 'admin-u1', entityType: 'product', entityId: 'p1', action: 'product.create' },
        async () => {
          throw new Error('boom');
        },
      ),
    ).rejects.toThrow('boom');
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('logs to stderr but does not throw when audit insert fails (mutation already committed)', async () => {
    // Force audit failure by passing a non-existent actorId (FK constraint).
    const result = await withAudit(
      { actorId: 'does-not-exist', entityType: 'product', entityId: 'p1', action: 'product.create' },
      async () => ({ id: 'p1' }),
    );
    expect(result).toEqual({ id: 'p1' });
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
