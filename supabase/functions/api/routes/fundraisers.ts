import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const fundraisersRouter = Router();

fundraisersRouter.use(authenticate);

const CreateFundraiserSchema = z.object({
  name: z.string().min(1),
  goalPaise: z.number().int().positive(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional()
});

const CreateTaskSchema = z.object({
  fundraiserId: z.string().uuid(),
  title: z.string().min(1),
  assigneeId: z.string().uuid().optional(),
  dueOn: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium")
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional()
});

const CreateContributionSchema = z.object({
  amountPaise: z.number().int().positive(),
  method: z.enum(["cash", "manual_upi"]),
  note: z.string().min(2, "Note required for contribution")
});

// GET /fundraisers
fundraisersRouter.get("/fundraisers", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("fundraisers")
      .select("*, tasks(id, status), contributions(amount_paise)")
      .order("created_at", { ascending: false });

    if (error) return next(error);

    const formatted = (data || []).map((f) => {
      const raisedPaise = (f.contributions || []).reduce(
        (sum: number, c: any) => sum + (c.amount_paise || 0),
        0
      );
      return {
        id: f.id,
        name: f.name,
        goalPaise: f.goal_paise,
        raisedPaise,
        startsOn: f.starts_on,
        endsOn: f.ends_on,
        status: f.status,
        tasksTotal: f.tasks?.length || 0,
        tasksDone: f.tasks?.filter((t: any) => t.status === "done").length || 0
      };
    });

    res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /fundraisers (Admin)
fundraisersRouter.post(
  "/fundraisers",
  requireRole("admin"),
  validate(CreateFundraiserSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("fundraisers")
        .insert({
          name: body.name,
          goal_paise: body.goalPaise,
          starts_on: body.startsOn,
          ends_on: body.endsOn,
          owner_id: admin.id
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

// GET /fundraisers/:id/progress (A, T, V)
fundraisersRouter.get(
  "/fundraisers/:id/progress",
  requireRole("admin", "treasurer", "volunteer"),
  async (req, res, next) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabaseAdmin.rpc("fn_fundraiser_progress", {
        p_fundraiser_id: id
      });

      if (error) return next(error);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /tasks (A, V)
fundraisersRouter.get(
  "/tasks",
  requireRole("admin", "volunteer"),
  async (req, res, next) => {
    const user = (req as any).user;
    const fundraiserId = req.query.fundraiserId as string | undefined;
    const assignee = req.query.assignee as string | undefined;

    try {
      let query = supabaseAdmin
        .from("tasks")
        .select("*, profiles:assignee_id(id, full_name, email)");

      if (fundraiserId) query = query.eq("fundraiser_id", fundraiserId);
      if (assignee === "me") query = query.eq("assignee_id", user.id);

      const { data, error } = await query;
      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /tasks (Admin)
fundraisersRouter.post(
  "/tasks",
  requireRole("admin"),
  validate(CreateTaskSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          fundraiser_id: body.fundraiserId,
          title: body.title,
          assignee_id: body.assigneeId,
          due_on: body.dueOn,
          priority: body.priority,
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

// PATCH /tasks/:id (Admin any field; volunteer only assigned task status)
fundraisersRouter.patch(
  "/tasks/:id",
  requireRole("admin", "volunteer"),
  validate(UpdateTaskSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const { id } = req.params;
    const body = req.body;

    try {
      if (user.role === "volunteer") {
        const { data: task } = await supabaseAdmin
          .from("tasks")
          .select("assignee_id")
          .eq("id", id)
          .single();

        if (!task || task.assignee_id !== user.id) {
          return next(new ApiError(403, "FORBIDDEN", "Volunteers can only update tasks assigned to them"));
        }

        // Volunteer can only update status
        const { data, error } = await supabaseAdmin
          .from("tasks")
          .update({ status: body.status })
          .eq("id", id)
          .select()
          .single();

        if (error) return next(error);
        return res.json({ data });
      }

      // Admin update
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .update(body)
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

// POST /fundraisers/:id/contributions 🔁 (A, T, V)
fundraisersRouter.post(
  "/fundraisers/:id/contributions",
  requireRole("admin", "treasurer", "volunteer"),
  validate(CreateContributionSchema),
  async (req, res, next) => {
    const actor = (req as any).user;
    const { id } = req.params;
    const { amountPaise, method, note } = req.body;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_record_contribution", {
        p_fundraiser_id: id,
        p_amount_paise: amountPaise,
        p_method: method,
        p_note: note,
        p_actor_id: actor.id
      });

      if (error) return next(new ApiError(409, error.message, error.message));

      res.status(201).json({
        data: {
          id: data?.id || data,
          amountPaise,
          method
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
