import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  getAnnouncementMessages,
  getHero,
  getLookbook,
  getStaticPage,
} from "@/server/data/content";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/content", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("getAnnouncementMessages returns active rows in sortOrder as strings", async () => {
    await prisma.announcementMessage.createMany({
      data: [
        { text: "Free UK delivery", sortOrder: 0, isActive: true },
        { text: "Worldwide shipping", sortOrder: 1, isActive: true },
        { text: "Hidden", sortOrder: 99, isActive: false },
      ],
    });
    expect(await getAnnouncementMessages()).toEqual([
      "Free UK delivery",
      "Worldwide shipping",
    ]);
  });

  it("getHero returns the active hero adapted to Zod shape", async () => {
    await prisma.heroBlock.create({
      data: {
        kind: "IMAGE",
        imageUrl: "/cms/hero.jpg",
        eyebrow: "Welcome",
        ctaLabel: "Shop",
        ctaHref: "/collection/jackets",
        isActive: true,
      },
    });
    const h = await getHero();
    expect(h).toMatchObject({
      kind: "image",
      image: "/cms/hero.jpg",
      eyebrow: "Welcome",
    });
  });

  it("getHero throws when no active hero exists", async () => {
    await expect(getHero()).rejects.toThrow();
  });

  it("getLookbook wraps rows in { images } sorted by sortOrder", async () => {
    await prisma.lookbookImage.createMany({
      data: [
        { src: "/lb/2.jpg", alt: "two", sortOrder: 1 },
        { src: "/lb/1.jpg", alt: "one", sortOrder: 0 },
      ],
    });
    const lb = await getLookbook();
    expect(lb.images.map((i) => i.src)).toEqual(["/lb/1.jpg", "/lb/2.jpg"]);
  });

  it("getStaticPage returns the page nested with meta, or null", async () => {
    await prisma.staticPage.create({
      data: {
        slug: "our-story",
        title: "Our Story",
        bodyMarkdown: "# Our Story",
        metaTitle: "Our Story",
        metaDescription: "About us.",
      },
    });
    const p = await getStaticPage("our-story");
    expect(p?.title).toBe("Our Story");
    expect(p?.meta).toEqual({ title: "Our Story", description: "About us." });
    expect(await getStaticPage("nope")).toBeNull();
  });
});
