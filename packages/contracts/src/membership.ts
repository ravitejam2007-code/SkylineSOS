import { z } from "zod";
import { PaymentMethodSchema } from "./common.js";

export const MembershipTierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  feePaise: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  discountPercent: z.number().int().min(0).max(100),
  benefits: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});
export type MembershipTier = z.infer<typeof MembershipTierSchema>;

export const CreateApplicationSchema = z.object({
  tierId: z.string().uuid(),
  answers: z.record(z.unknown()).default({})
});
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationSchema = z.object({
  answers: z.record(z.unknown())
});
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;

export const ReviewApplicationSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().optional()
});
export type ReviewApplicationInput = z.infer<typeof ReviewApplicationSchema>;

export const WalkUpMemberSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  studentId: z.string().optional(),
  tierId: z.string().uuid().optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  note: z.string().optional()
});
export type WalkUpMemberInput = z.infer<typeof WalkUpMemberSchema>;

export const VerifyMemberCodeRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Must be a 6-digit numeric code")
});
export type VerifyMemberCodeRequest = z.infer<typeof VerifyMemberCodeRequestSchema>;

export const VerifyMemberResultSchema = z.object({
  name: z.string(),
  tier: z.string(),
  status: z.enum(["active", "expired", "cancelled"]),
  expiresOn: z.string(),
  discountPercent: z.number().int()
});
export type VerifyMemberResult = z.infer<typeof VerifyMemberResultSchema>;
