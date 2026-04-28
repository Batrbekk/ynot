import Redis from "ioredis";

declare global {
  var __redis__: Redis | undefined;
}

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("REDIS_URL is not set — refusing to construct Redis client");
}

export const redis: Redis =
  globalThis.__redis__ ?? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis__ = redis;
}
