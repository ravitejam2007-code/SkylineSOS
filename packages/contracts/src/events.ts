import { z } from "zod";

export const TicketTypeSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  name: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  memberPricePaise: z.number().int().nonnegative().nullable().optional(),
  memberOnly: z.boolean().default(false),
  quantityLimit: z.number().int().positive(),
  salesStart: z.string().datetime().nullable().optional(),
  salesEnd: z.string().datetime().nullable().optional()
});
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const EventSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  venue: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive(),
  status: z.enum(["draft", "published", "cancelled", "completed"]),
  createdAt: z.string().datetime(),
  ticketTypes: z.array(TicketTypeSchema).optional()
});
export type Event = z.infer<typeof EventSchema>;

export const CheckInTicketSchema = z.object({
  eventId: z.string().uuid().optional(),
  code: z.string().min(4).max(20)
});
export type CheckInTicketInput = z.infer<typeof CheckInTicketSchema>;

export const CheckInResultSchema = z.object({
  ticketId: z.string().uuid(),
  holderName: z.string(),
  ticketType: z.string(),
  eventTitle: z.string(),
  checkedInAt: z.string().datetime()
});
export type CheckInResult = z.infer<typeof CheckInResultSchema>;

export const EventSummarySchema = z.object({
  eventId: z.string().uuid(),
  sold: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  checkedIn: z.number().int().nonnegative(),
  attendanceRate: z.number().min(0).max(100),
  revenueByMethod: z.record(z.number().int())
});
export type EventSummary = z.infer<typeof EventSummarySchema>;
