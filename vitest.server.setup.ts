import { config } from "dotenv";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll } from "vitest";

// Load .env.test before any test code (and before server modules import process.env).
config({ path: resolve(__dirname, ".env.test"), override: true });

beforeAll(() => {
  // Apply pending migrations to the test database. Idempotent.
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
});
