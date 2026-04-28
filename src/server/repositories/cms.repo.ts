import type { AnnouncementMessage, HeroBlock, LookbookImage, StaticPage } from "@prisma/client";
import { prisma } from "../db/client";

export function getActiveHero(): Promise<HeroBlock | null> {
  return prisma.heroBlock.findFirst({ where: { isActive: true } });
}

export function getAnnouncementMessages(): Promise<AnnouncementMessage[]> {
  return prisma.announcementMessage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listLookbook(): Promise<LookbookImage[]> {
  return prisma.lookbookImage.findMany({ orderBy: { sortOrder: "asc" } });
}

export function getStaticPageBySlug(slug: string): Promise<StaticPage | null> {
  return prisma.staticPage.findUnique({ where: { slug } });
}
