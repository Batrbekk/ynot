import { describe, expect, it } from "vitest";
import { prisma } from "../../db/client";

describe("prisma singleton", () => {
  it("executes a trivial query", async () => {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });

  it("returns the same instance on repeated import", async () => {
    const { prisma: again } = await import("../../db/client");
    expect(again).toBe(prisma);
  });
});
