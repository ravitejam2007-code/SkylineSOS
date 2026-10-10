import { z } from "zod";

export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  amountPaise: z.number().int().nonnegative(),
  category: z.enum(["dues", "tickets", "merch", "fundraiser", "expense", "refund"]),
  method: z.enum(["online_test", "cash", "manual_upi"]),
  sourceType: z.enum(["checkout_item", "contribution", "expense", "reversal"]),
  sourceId: z.string().uuid(),
  memo: z.string().nullable().optional(),
  effectiveOn: z.string(),
  reversesId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime()
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const CreateExpenseSchema = z.object({
  amountPaise: z.number().int().positive(),
  category: z.string().min(1),
  description: z.string().min(3)
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const UpdateExpenseStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "paid"]),
  reason: z.string().optional()
});
export type UpdateExpenseStatusInput = z.infer<typeof UpdateExpenseStatusSchema>;

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  amountPaise: z.number().int().positive(),
  category: z.string(),
  description: z.string(),
  submittedBy: z.string().uuid(),
  status: z.enum(["submitted", "approved", "rejected", "paid"]),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  rejectReason: z.string().nullable().optional(),
  createdAt: z.string().datetime()
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const TreasurerOverviewSchema = z.object({
  inPaise: z.number().int().nonnegative(),
  outPaise: z.number().int().nonnegative(),
  netPaise: z.number().int(),
  byCategory: z.record(z.number().int()),
  byMethod: z.record(z.number().int()),
  recent: z.array(LedgerEntrySchema).default([])
});
export type TreasurerOverview = z.infer<typeof TreasurerOverviewSchema>;
