import { z } from "zod";

export const AnnouncementAudienceSchema = z.enum(["public", "members", "staff"]);
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceSchema>;

export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  audience: AnnouncementAudienceSchema,
  status: z.enum(["draft", "published", "archived"]),
  authorId: z.string().uuid().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime()
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  audience: AnnouncementAudienceSchema
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  audience: AnnouncementAudienceSchema.optional()
});
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;
