import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  getActiveHero,
  getAnnouncementMessages,
  getStaticPageBySlug,
} from "../../repositories/cms.repo";
import { resetDb } from "../helpers/reset-db";

describe("cms.repo", () => {
  beforeEach(async () => {
    await resetDb();
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
    await prisma.announcementMessage.createMany({
      data: [
        { text: "Free UK delivery", sortOrder: 0 },
        { text: "Worldwide shipping", sortOrder: 1 },
      ],
    });
    await prisma.staticPage.create({
      data: { slug: "our-story", title: "Our Story", bodyMarkdown: "# Our Story" },
    });
  });

  it("getActiveHero returns the row with isActive=true", async () => {
    const hero = await getActiveHero();
    expect(hero?.eyebrow).toBe("Welcome");
  });

  it("getAnnouncementMessages returns active rows in sortOrder", async () => {
    const msgs = await getAnnouncementMessages();
    expect(msgs.map((m) => m.text)).toEqual(["Free UK delivery", "Worldwide shipping"]);
  });

  it("getStaticPageBySlug returns the matching page", async () => {
    const page = await getStaticPageBySlug("our-story");
    expect(page?.title).toBe("Our Story");
  });

  it("getStaticPageBySlug returns null for unknown slugs", async () => {
    expect(await getStaticPageBySlug("nope")).toBeNull();
  });
});
