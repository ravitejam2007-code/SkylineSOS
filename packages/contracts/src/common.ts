import { z } from "zod";

export const AppRoleSchema = z.enum(["admin", "treasurer", "door", "volunteer", "member"]);
export type AppRole = z.infer<typeof AppRoleSchema>;

export const PaymentMethodSchema = z.enum(["online", "cash", "manual_upi"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ItemTypeSchema = z.enum(["ticket", "merch", "membership"]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "CAPACITY_EXCEEDED",
  "OUT_OF_STOCK",
  "ALREADY_MEMBER",
  "APPLICATION_EXISTS",
  "APPLICATION_NOT_APPROVED",
  "CHECKOUT_EXPIRED",
  "CHECKOUT_NOT_PENDING",
  "TICKET_ALREADY_CHECKED_IN",
  "WRONG_EVENT",
  "TICKET_CANCELLED",
  "TICKET_NOT_FOUND",
  "CODE_INVALID",
  "NO_ACTIVE_MEMBERSHIP",
  "SELF_APPROVAL_FORBIDDEN",
  "MEMBER_ONLY",
  "VALIDATION_FAILED",
  "NOTE_REQUIRED",
  "INVALID_SIGNATURE",
  "RATE_LIMITED",
  "PAYMENT_PROVIDER_ERROR",
  "INTERNAL"
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string()
  })
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const SuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        nextCursor: z.string().optional(),
        total: z.number().int().optional()
      })
      .optional()
  });
