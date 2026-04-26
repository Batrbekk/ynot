import { describe, it, expect } from "vitest";
import {
  getAnnouncementMessages,
  getHero,
  getLookbook,
  getStaticPage,
} from "../content";

describe("content adapter", () => {
  it("returns announcement messages", async () => {
    const m = await getAnnouncementMessages();
    expect(m.length).toBeGreaterThan(0);
  });
  it("returns hero", async () => {
    const h = await getHero();
    expect(h.eyebrow).toBe("New Collection");
  });
  it("returns lookbook images", async () => {
    const l = await getLookbook();
    expect(l.images.length).toBeGreaterThan(0);
  });
  it("returns static page by slug", async () => {
    expect((await getStaticPage("our-story"))?.title).toBe("Our Story");
    expect(await getStaticPage("nope")).toBeNull();
  });
});
