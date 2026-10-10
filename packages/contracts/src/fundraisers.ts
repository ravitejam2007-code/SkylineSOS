import { z } from "zod";

export const FundraiserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  goalPaise: z.number().int().positive(),
  startsOn: z.string().nullable().optional(),
  endsOn: z.string().nullable().optional(),
  status: z.enum(["active", "closed"]),
  ownerId: z.string().uuid().nullable().optional()
});
export type Fundraiser = z.infer<typeof FundraiserSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  fundraiserId: z.string().uuid(),
  title: z.string().min(1),
  assigneeId: z.string().uuid().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done", "cancelled"])
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateContributionSchema = z.object({
  amountPaise: z.number().int().positive(),
  method: z.enum(["cash", "manual_upi"]),
  note: z.string().min(2, "Note is required for contributions")
});
export type CreateContributionInput = z.infer<typeof CreateContributionSchema>;

export const CreateTaskSchema = z.object({
  fundraiserId: z.string().uuid(),
  title: z.string().min(1),
  assigneeId: z.string().uuid().optional(),
  dueOn: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium")
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional()
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
