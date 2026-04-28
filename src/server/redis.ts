import Redis from "ioredis";

declare global {
  var __redis__: Redis | undefined;
}

/**
 * Lazy ioredis singleton. Construction is deferred to first access so Next.js
 * build-time route collection (which evaluates this module without runtime
 * env vars) does not crash. Throws on first real use if REDIS_URL is missing.
 */
function buildClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set — refusing to construct Redis client");
  }
  return new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
}

function getRedis(): Redis {
  if (!globalThis.__redis__) {
    globalThis.__redis__ = buildClient();
  }
  return globalThis.__redis__;
}

export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    return Reflect.get(getRedis(), prop, receiver);
  },
});
