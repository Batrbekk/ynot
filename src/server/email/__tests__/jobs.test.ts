import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { enqueueEmailJob, processDueEmailJobs } from "../jobs";

describe("enqueueEmailJob", () => {
  beforeEach(async () => {
    await prisma.emailJob.deleteMany();
  });

  it("inserts a PENDING job with given dispatchAt", async () => {
    const future = new Date(Date.now() + 60_000);
    const job = await enqueueEmailJob({
      template: "AbandonedCart1h",
      recipientEmail: "a@b.com",
      payload: { cartId: "c1" },
      dispatchAt: future,
    });
    expect(job.status).toBe("PENDING");
    expect(job.dispatchAt.getTime()).toBe(future.getTime());
    expect(job.template).toBe("AbandonedCart1h");
    expect(job.recipientEmail).toBe("a@b.com");
  });

  it("skips duplicates when called with the same dedupKey", async () => {
    await enqueueEmailJob({
      template: "AbandonedCart24h",
      recipientEmail: "a@b.com",
      payload: { cartId: "c2" },
      dispatchAt: new Date(),
      dedupKey: "cart:c2:24h",
    });
    await enqueueEmailJob({
      template: "AbandonedCart24h",
      recipientEmail: "a@b.com",
      payload: { cartId: "c2" },
      dispatchAt: new Date(),
      dedupKey: "cart:c2:24h",
    });
    expect(await prisma.emailJob.count()).toBe(1);
  });

  it("treats dedupKey as scoped per template (different templates can share key)", async () => {
    await enqueueEmailJob({
      template: "AbandonedCart1h",
      recipientEmail: "a@b.com",
      payload: { cartId: "c3" },
      dispatchAt: new Date(),
      dedupKey: "cart:c3",
    });
    await enqueueEmailJob({
      template: "AbandonedCart24h",
      recipientEmail: "a@b.com",
      payload: { cartId: "c3" },
      dispatchAt: new Date(),
      dedupKey: "cart:c3",
    });
    expect(await prisma.emailJob.count()).toBe(2);
  });
});

describe("processDueEmailJobs", () => {
  beforeEach(async () => {
    await prisma.emailJob.deleteMany();
  });

  // The three behavioural tests below depend on the template registry — they
  // are wired up in Task 21 alongside `registerTemplate`.
  it.todo("processes jobs whose dispatchAt is in the past, marks SENT");
  it.todo("marks FAILED after 3 failed attempts");
  it.todo("ignores jobs in the future");

  // Smoke test we can ship now — confirms the no-op path doesn't blow up
  // when there are no due jobs (registry is never consulted).
  it("returns zero counts when there are no due jobs", async () => {
    const result = await processDueEmailJobs({
      send: async () => ({ id: "_" }),
    });
    expect(result).toEqual({ processed: 0, failed: 0 });
  });
});
