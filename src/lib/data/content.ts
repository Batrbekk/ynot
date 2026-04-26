import {
  AnnouncementBlockSchema,
  HeroBlockSchema,
  LookbookSchema,
  StaticPageSchema,
  type HeroBlock,
  type Lookbook,
  type StaticPage,
} from "../schemas";
import contentJson from "./_mock/content.json";
import lookbookJson from "./_mock/lookbook.json";

export async function getAnnouncementMessages(): Promise<string[]> {
  return AnnouncementBlockSchema.parse(contentJson.announcement).messages;
}

export async function getHero(): Promise<HeroBlock> {
  return HeroBlockSchema.parse(contentJson.hero);
}

export async function getLookbook(): Promise<Lookbook> {
  return LookbookSchema.parse(lookbookJson);
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const found = contentJson.staticPages.find((p) => p.slug === slug);
  return found ? StaticPageSchema.parse(found) : null;
}
