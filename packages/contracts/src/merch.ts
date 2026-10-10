import { z } from "zod";

export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sku: z.string().min(1),
  label: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  stockOnHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative()
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]),
  variants: z.array(ProductVariantSchema).default([])
});
export type Product = z.infer<typeof ProductSchema>;

export const AdjustStockSchema = z.object({
  quantityDelta: z.number().int(),
  reason: z.string().min(3, "Reason required for stock adjustment")
});
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

export const UpdateFulfilmentSchema = z.object({
  fulfilmentStatus: z.enum(["pending", "packed", "handed_over", "n/a"])
});
export type UpdateFulfilmentInput = z.infer<typeof UpdateFulfilmentSchema>;
