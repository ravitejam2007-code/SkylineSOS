import { z } from "zod";
import { ItemTypeSchema, PaymentMethodSchema } from "./common.js";

export const CheckoutItemInputSchema = z.object({
  itemType: ItemTypeSchema,
  refId: z.string().uuid(),
  quantity: z.number().int().positive()
});
export type CheckoutItemInput = z.infer<typeof CheckoutItemInputSchema>;

export const CreateCheckoutSchema = z.object({
  items: z.array(CheckoutItemInputSchema).min(1)
});
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const StaffCheckoutSchema = z.object({
  buyerId: z.string().uuid().optional(),
  buyerEmail: z.string().email().optional(),
  buyerName: z.string().min(2).optional(),
  paymentMethod: z.enum(["cash", "manual_upi"]),
  note: z.string().min(2, "A verification note is required for staff-recorded payments"),
  items: z.array(CheckoutItemInputSchema).min(1)
});
export type StaffCheckoutInput = z.infer<typeof StaffCheckoutSchema>;

export const VerifyCheckoutSchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1)
});
export type VerifyCheckoutInput = z.infer<typeof VerifyCheckoutSchema>;

export const CheckoutResponseSchema = z.object({
  checkoutId: z.string().uuid(),
  orderId: z.string().optional(),
  keyId: z.string().optional(),
  amountPaise: z.number().int().nonnegative(),
  currency: z.literal("INR").default("INR"),
  paymentMethod: PaymentMethodSchema,
  status: z.string(),
  expiresAt: z.string().datetime().nullable().optional()
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
