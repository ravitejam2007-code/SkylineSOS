import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const eventsAdminRouter = Router();

eventsAdminRouter.use(authenticate);

const CreateEventSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  venue: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  capacity: z.number().int().positive(),
  status: z.enum(["draft", "published", "cancelled", "completed"]).default("draft")
});

const UpdateEventSchema = CreateEventSchema.partial();

const CreateTicketTypeSchema = z.object({
  name: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  memberPricePaise: z.number().int().nonnegative().optional(),
  memberOnly: z.boolean().default(false),
  quantityLimit: z.number().int().positive(),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional()
});

// GET /admin/events
eventsAdminRouter.get("/admin/events", requireRole("admin"), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*, ticket_types(*)")
      .order("starts_at", { ascending: false });

    if (error) return next(error);
    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /admin/events
eventsAdminRouter.post(
  "/admin/events",
  requireRole("admin"),
  validate(CreateEventSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("events")
        .insert({
          slug: body.slug,
          title: body.title,
          description: body.description,
          venue: body.venue,
          starts_at: body.startsAt,
          ends_at: body.endsAt,
          capacity: body.capacity,
          status: body.status,
          created_by: admin.id
        })
        .select()
        .single();

      if (error) return next(error);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/events/:id
eventsAdminRouter.patch(
  "/admin/events/:id",
  requireRole("admin"),
  validate(UpdateEventSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.venue !== undefined) updates.venue = body.venue;
      if (body.startsAt !== undefined) updates.starts_at = body.startsAt;
      if (body.endsAt !== undefined) updates.ends_at = body.endsAt;
      if (body.capacity !== undefined) updates.capacity = body.capacity;
      if (body.status !== undefined) updates.status = body.status;

      const { data, error } = await supabaseAdmin
        .from("events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return next(error);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/events/:id/ticket-types
eventsAdminRouter.post(
  "/admin/events/:id/ticket-types",
  requireRole("admin"),
  validate(CreateTicketTypeSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("ticket_types")
        .insert({
          event_id: id,
          name: body.name,
          price_paise: body.pricePaise,
          member_price_paise: body.memberPricePaise,
          member_only: body.memberOnly,
          quantity_limit: body.quantityLimit,
          sales_start: body.salesStart,
          sales_end: body.salesEnd
        })
        .select()
        .single();

      if (error) return next(error);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/events/:id/summary (A, T, D)
eventsAdminRouter.get(
  "/admin/events/:id/summary",
  requireRole("admin", "treasurer", "door"),
  async (req, res, next) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabaseAdmin.rpc("fn_event_summary", {
        p_event_id: id
      });

      if (error) return next(error);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
