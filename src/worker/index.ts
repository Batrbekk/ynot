import 'dotenv/config';
import cron from 'node-cron';
import { env } from '@/server/env';
import { buildDeps } from '@/server/fulfilment/deps';
import { recoverPendingPayments } from './jobs/recover-pending-payment';
import { cleanupExpiredCarts } from './jobs/cleanup-expired-carts';
import { syncTracking } from './jobs/sync-tracking';
import { processEmailJobs } from './jobs/process-email-jobs';
import { retryFailedShipments } from './jobs/retry-failed-shipments';
import { enqueueAbandonedCart } from './jobs/enqueue-abandoned-cart';

if (!env.WORKER_ENABLED) {
  process.stderr.write('[ynot-worker] WORKER_ENABLED=false; exiting.\n');
  process.exit(0);
}

const deps = buildDeps(env);

interface JobSpec {
  name: string;
  cron: string;
  run: () => Promise<unknown>;
}

const JOBS: JobSpec[] = [
  {
    name: 'recover-pending-payment',
    cron: '*/5 * * * *',
    run: () => recoverPendingPayments(),
  },
  {
    name: 'cleanup-expired-carts',
    cron: '0 * * * *',
    run: () => cleanupExpiredCarts(),
  },
  {
    name: 'sync-tracking',
    cron: '0 * * * *',
    run: () =>
      syncTracking({
        providers: deps.providers,
        sendTrackingStaleAlert: deps.sendTrackingStaleAlert,
      }),
  },
  {
    name: 'process-email-jobs',
    cron: '*/5 * * * *',
    run: () => processEmailJobs(),
  },
  {
    name: 'retry-failed-shipments',
    cron: '*/5 * * * *',
    run: () =>
      retryFailedShipments({
        dhl: deps.dhl,
        rm: deps.rm,
        storage: deps.storage,
        sendLabelFailureAlert: deps.sendLabelFailureAlert,
      }),
  },
  {
    name: 'enqueue-abandoned-cart',
    cron: '*/5 * * * *',
    run: () => enqueueAbandonedCart(),
  },
];

for (const job of JOBS) {
  cron.schedule(job.cron, async () => {
    const started = Date.now();
    process.stderr.write(`[ynot-worker] tick ${job.name}\n`);
    try {
      const result = await job.run();
      process.stderr.write(
        `[ynot-worker] done ${job.name} (${Date.now() - started}ms): ${
          result ? JSON.stringify(result) : 'ok'
        }\n`,
      );
    } catch (err) {
      process.stderr.write(
        `[ynot-worker] error ${job.name}: ${
          err instanceof Error ? err.stack ?? err.message : String(err)
        }\n`,
      );
    }
  });
  process.stderr.write(`[ynot-worker] scheduled ${job.name} (${job.cron})\n`);
}

process.stderr.write('[ynot-worker] all jobs scheduled\n');

// Keep process alive so Docker keeps the container running.
setInterval(() => {}, 1 << 30);
