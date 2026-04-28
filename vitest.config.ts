import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/server/**", "src/app/api/**/*.test.ts"],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          globals: true,
          setupFiles: ["./vitest.server.setup.ts"],
          include: ["src/server/**/*.{test,spec}.ts", "src/app/api/**/*.test.ts"],
          pool: "forks",
          poolOptions: {
            forks: { singleFork: true },
          },
        },
      },
    ],
  },
});
