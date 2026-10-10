import { z } from "zod";
import { AppRoleSchema } from "./common.js";

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  studentId: z.string().nullable().optional(),
  role: AppRoleSchema,
  isDemo: z.boolean().default(false)
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  studentId: z.string().max(40).optional()
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UpdateUserRoleSchema = z.object({
  role: AppRoleSchema
});
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;
