import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ENTRYPOINT = resolve(__dirname, '../index.ts');

describe('worker entrypoint', { timeout: 20_000 }, () => {
  it('schedules all 6 cron jobs and stays alive', async () => {
    const child = spawn(
      'pnpm',
      ['dotenv', '-e', '.env.test', '--', 'pnpm', 'tsx', ENTRYPOINT],
      {
        env: { ...process.env, WORKER_ENABLED: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    try {
      // Give the process up to ~10s to register the jobs.
      const started = Date.now();
      while (Date.now() - started < 12_000) {
        if (stderr.includes('all jobs scheduled')) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      expect(stderr).toContain('scheduled recover-pending-payment');
      expect(stderr).toContain('scheduled cleanup-expired-carts');
      expect(stderr).toContain('scheduled sync-tracking');
      expect(stderr).toContain('scheduled process-email-jobs');
      expect(stderr).toContain('scheduled retry-failed-shipments');
      expect(stderr).toContain('scheduled enqueue-abandoned-cart');
      expect(stderr).toContain('all jobs scheduled');
    } finally {
      child.kill('SIGTERM');
      await new Promise((r) => child.once('exit', () => r(null)));
    }
  });

  it('exits cleanly when WORKER_ENABLED=false', async () => {
    const child = spawn(
      'pnpm',
      ['dotenv', '-e', '.env.test', '--', 'pnpm', 'tsx', ENTRYPOINT],
      {
        env: { ...process.env, WORKER_ENABLED: 'false' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number | null>((r) =>
      child.once('exit', (code) => r(code)),
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain('WORKER_ENABLED=false');
  });
});
