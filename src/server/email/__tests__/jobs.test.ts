import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { enqueueEmailJob, processDueEmailJobs } from "../jobs";
import {
  _clearRegistryForTests,
  registerTemplate,
} from "../render-template-registry";

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
    _clearRegistryForTests();
    registerTemplate("OrderShipped", async () => ({
      subject: "Test",
      html: "<p>x</p>",
      text: "x",
    }));
  });

  it("returns zero counts when there are no due jobs", async () => {
    const result = await processDueEmailJobs({
      send: async () => ({ id: "_" }),
    });
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it("processes jobs whose dispatchAt is in the past, marks SENT", async () => {
    await prisma.emailJob.create({
      data: {
        template: "OrderShipped",
        recipientEmail: "a@b.com",
        payload: {},
        dispatchAt: new Date(Date.now() - 1000),
      },
    });
    const result = await processDueEmailJobs({
      send: async () => ({ id: "sent_1" }),
    });
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    const j = await prisma.emailJob.findFirst();
    expect(j!.status).toBe("SENT");
    expect(j!.sentAt).not.toBeNull();
    expect(j!.attempts).toBe(1);
  });

  it("marks FAILED after 3 failed attempts", async () => {
    await prisma.emailJob.create({
      data: {
        template: "OrderShipped",
        recipientEmail: "a@b.com",
        payload: {},
        dispatchAt: new Date(Date.now() - 1000),
        attempts: 2,
      },
    });
    const result = await processDueEmailJobs({
      send: async () => {
        throw new Error("boom");
      },
    });
    expect(result.failed).toBe(1);
    const j = await prisma.emailJob.findFirst();
    expect(j!.status).toBe("FAILED");
    expect(j!.attempts).toBe(3);
    expect(j!.lastError).toContain("boom");
  });

  it("keeps a job PENDING after the first failure (attempts < 3)", async () => {
    await prisma.emailJob.create({
      data: {
        template: "OrderShipped",
        recipientEmail: "a@b.com",
        payload: {},
        dispatchAt: new Date(Date.now() - 1000),
      },
    });
    const result = await processDueEmailJobs({
      send: async () => {
        throw new Error("transient");
      },
    });
    expect(result.failed).toBe(1);
    const j = await prisma.emailJob.findFirst();
    expect(j!.status).toBe("PENDING");
    expect(j!.attempts).toBe(1);
    expect(j!.lastError).toContain("transient");
  });

  it("ignores jobs in the future", async () => {
    await prisma.emailJob.create({
      data: {
        template: "OrderShipped",
        recipientEmail: "a@b.com",
        payload: {},
        dispatchAt: new Date(Date.now() + 60_000),
      },
    });
    const result = await processDueEmailJobs({
      send: async () => ({ id: "_" }),
    });
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });
});

describe("template registry", () => {
  beforeEach(() => _clearRegistryForTests());

  it("renderTemplate throws when name is unregistered", async () => {
    const { renderTemplate } = await import("../render-template-registry");
    await expect(renderTemplate("Unknown", {})).rejects.toThrow(/not registered/);
  });

  it("renderTemplate returns the registered renderer's output", async () => {
    const { renderTemplate, registerTemplate } = await import(
      "../render-template-registry"
    );
    registerTemplate("Greet", async (payload) => ({
      subject: `Hi ${(payload as { name: string }).name}`,
      html: "<p/>",
      text: "x",
    }));
    const r = await renderTemplate("Greet", { name: "Ada" });
    expect(r.subject).toBe("Hi Ada");
  });
});
