import type { HeroBlock, Lookbook, StaticPage } from "@/lib/schemas";
import {
  getActiveHero,
  getAnnouncementMessages as getAnnouncementMessagesRepo,
  getStaticPageBySlug,
  listLookbook,
} from "@/server/repositories/cms.repo";
import { toHero, toLookbook, toStaticPage } from "./adapters/content";

export async function getAnnouncementMessages(): Promise<string[]> {
  const rows = await getAnnouncementMessagesRepo();
  return rows.map((r) => r.text);
}

export async function getHero(): Promise<HeroBlock> {
  const row = await getActiveHero();
  if (!row) throw new Error("No active hero block configured");
  return toHero(row);
}

export async function getLookbook(): Promise<Lookbook> {
  const rows = await listLookbook();
  return toLookbook(rows);
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const row = await getStaticPageBySlug(slug);
  return row ? toStaticPage(row) : null;
}
