import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const aliases = { "@": path.resolve(__dirname, "./src") };

const clientProject = {
  plugins: [react()],
  resolve: { alias: aliases },
  test: {
    name: "client",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/server/**", "src/app/api/**/*.test.ts"],
    css: false,
  },
};

// Server tests need a real Postgres / Redis and run sequentially in one fork.
// `pool` / `poolOptions` / `fileParallelism` are valid at runtime inside a
// project but the inline ProjectConfig type omits them; cast keeps the file
// type-clean until vitest narrows the type.
const serverProject = {
  resolve: { alias: aliases },
  test: {
    name: "server",
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.server.setup.ts"],
    include: ["src/server/**/*.{test,spec}.ts", "src/app/api/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
};

export default defineConfig({
  test: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: [clientProject, serverProject] as any,
  },
});
