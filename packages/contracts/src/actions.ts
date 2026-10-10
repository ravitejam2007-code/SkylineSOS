import { z } from "zod";

export const ActionItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  link: z.string(),
  nextAction: z.string(),
  createdAt: z.string().datetime().optional()
});
export type ActionItem = z.infer<typeof ActionItemSchema>;
