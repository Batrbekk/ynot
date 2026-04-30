import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".worktrees/**",
  ]),
  // Allow underscore-prefixed parameters to be unused (e.g. _req in route handlers).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        args: "all",
        argsIgnorePattern: "^_",
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
  // Prevent client/lib code from importing server-only modules.
  // The Prisma client must never be bundled to the browser.
  {
    files: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/**", "**/src/server/**"],
              message:
                "Do not import server-only modules from client code. Move logic into a Server Component, Route Handler, or Server Action.",
            },
            {
              group: ["@prisma/client", "ioredis"],
              message:
                "Database/cache clients are server-only. Use src/server/repositories/* via a Server Component or Route Handler.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
