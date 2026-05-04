import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { processEmailJobs } from '../process-email-jobs';

describe('processEmailJobs', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zero counts when no due jobs exist', async () => {
    const send = vi.fn();
    const r = await processEmailJobs({ send });
    expect(r).toEqual({ processed: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('drains a due job using the registered AbandonedCart1h template (side-effect import)', async () => {
    const job = await prisma.emailJob.create({
      data: {
        template: 'AbandonedCart1h',
        recipientEmail: 'shopper@ynot.test',
        payload: {
          customerName: 'Shopper',
          items: [{ name: 'Silk Tee', image: '/x.jpg', priceCents: 4500, qty: 1 }],
          cartUrl: 'https://ynot.test/cart',
        },
        dispatchAt: new Date(Date.now() - 1000),
      },
    });
    const send = vi.fn().mockResolvedValue({ id: 'msg_x' });
    const r = await processEmailJobs({ send });
    expect(r).toEqual({ processed: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    const args = send.mock.calls[0][0];
    expect(args.to).toBe('shopper@ynot.test');
    expect(args.subject).toMatch(/cart|left/i);

    const refreshed = await prisma.emailJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(refreshed.status).toBe('SENT');
    expect(refreshed.sentAt).not.toBeNull();
  });
});
