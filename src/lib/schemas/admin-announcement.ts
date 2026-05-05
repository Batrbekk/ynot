import { z } from 'zod';

/**
 * Admin announcement bar schemas. Multiple rows can be active and rotate
 * client-side based on `sortOrder`.
 */
export const AnnouncementCreateSchema = z.object({
  text: z.string().min(1).max(280),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const AnnouncementUpdateSchema = AnnouncementCreateSchema.partial();

export type AnnouncementCreateInput = z.infer<typeof AnnouncementCreateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof AnnouncementUpdateSchema>;
