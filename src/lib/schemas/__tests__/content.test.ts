import { describe, it, expect } from "vitest";
import {
  HeroBlockSchema,
  AnnouncementBlockSchema,
  StaticPageSchema,
} from "../content";

describe("HeroBlockSchema", () => {
  it("accepts an image hero", () => {
    expect(() =>
      HeroBlockSchema.parse({
        kind: "image",
        image: "/images/hero/1.webp",
        videoUrl: null,
        eyebrow: "New Collection",
        ctaLabel: "SHOP",
        ctaHref: "/collection/jackets",
      }),
    ).not.toThrow();
  });
});

describe("AnnouncementBlockSchema", () => {
  it("accepts a list of messages", () => {
    expect(() =>
      AnnouncementBlockSchema.parse({
        messages: ["Sign in and get 10% off", "Free UK shipping"],
      }),
    ).not.toThrow();
  });
});

describe("StaticPageSchema", () => {
  it("accepts a markdown body", () => {
    expect(() =>
      StaticPageSchema.parse({
        slug: "our-story",
        title: "Our Story",
        bodyMarkdown: "# Why Not?\n\nWe build outerwear...",
        meta: { title: "Our Story · YNOT", description: "About YNOT London" },
      }),
    ).not.toThrow();
  });
});
