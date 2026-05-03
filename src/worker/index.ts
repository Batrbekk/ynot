import { env } from '@/server/env';

if (!env.WORKER_ENABLED) {
  console.log('[ynot-worker] WORKER_ENABLED=false; exiting.');
  process.exit(0);
}

console.log('[ynot-worker] starting (jobs will register in Group N tasks)...');

// Keep process alive so Docker keeps the container running.
setInterval(() => {}, 1 << 30);
