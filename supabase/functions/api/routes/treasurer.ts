import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const treasurerRouter = Router();

treasurerRouter.use(authenticate);

const CreateExpenseSchema = z.object({
  amountPaise: z.number().int().positive(),
  category: z.string().min(1),
  description: z.string().min(3)
});

const UpdateExpenseStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "paid"]),
  reason: z.string().optional()
});

const UpdateUserRoleSchema = z.object({
  role: z.enum(["admin", "treasurer", "door", "volunteer", "member"])
});

// GET /treasurer/overview?from=&to= (A, T)
treasurerRouter.get(
  "/treasurer/overview",
  requireRole("admin", "treasurer"),
  async (req, res, next) => {
    const from = (req.query.from as string) || null;
    const to = (req.query.to as string) || null;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_treasurer_overview", {
        p_from: from,
        p_to: to
      });

      if (error) return next(error);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /treasurer/ledger (A, T)
treasurerRouter.get(
  "/treasurer/ledger",
  requireRole("admin", "treasurer"),
  async (req, res, next) => {
    const limit = Math.min(50, parseInt((req.query.limit as string) || "20", 10));

    try {
      const { data, error } = await supabaseAdmin
        .from("ledger_entries")
        .select("*")
        .order("effective_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /expenses (A, T, D, V)
treasurerRouter.post(
  "/expenses",
  requireRole("admin", "treasurer", "door", "volunteer"),
  validate(CreateExpenseSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("expenses")
        .insert({
          amount_paise: body.amountPaise,
          category: body.category,
          description: body.description,
          submitted_by: user.id,
          status: "submitted"
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

// GET /expenses (A, T see all; others see own)
treasurerRouter.get("/expenses", async (req, res, next) => {
  const user = (req as any).user;

  try {
    let query = supabaseAdmin
      .from("expenses")
      .select("*, profiles:submitted_by(full_name, email)")
      .order("created_at", { ascending: false });

    if (user.role !== "admin" && user.role !== "treasurer") {
      query = query.eq("submitted_by", user.id);
    }

    const { data, error } = await query;
    if (error) return next(error);
    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /expenses/:id/status (A, T — prevents self approval)
treasurerRouter.post(
  "/expenses/:id/status",
  requireRole("admin", "treasurer"),
  validate(UpdateExpenseStatusSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { status, reason } = req.body;

    try {
      // Check submitter
      const { data: expense } = await supabaseAdmin
        .from("expenses")
        .select("submitted_by")
        .eq("id", id)
        .single();

      if (!expense) return next(new ApiError(404, "NOT_FOUND", "Expense not found"));

      if (status === "approved" && expense.submitted_by === user.id) {
        return next(
          new ApiError(409, "SELF_APPROVAL_FORBIDDEN", "Submitters cannot approve their own expenses")
        );
      }

      const { data, error } = await supabaseAdmin.rpc("fn_set_expense_status", {
        p_expense_id: id,
        p_actor_id: user.id,
        p_status: status,
        p_reason: reason || null
      });

      if (error) return next(new ApiError(409, error.message, error.message));
      res.json({ data: data || { status } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /audit (A see all; T see financial)
treasurerRouter.get(
  "/audit",
  requireRole("admin", "treasurer"),
  async (req, res, next) => {
    const user = (req as any).user;
    const limit = Math.min(50, parseInt((req.query.limit as string) || "20", 10));

    try {
      let query = supabaseAdmin
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (user.role === "treasurer") {
        query = query.in("action", ["checkout_fulfilled", "expense_approved", "expense_paid", "contribution_recorded"]);
      }

      const { data, error } = await query;
      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /actions (A, T, V — dynamic action queue from fn_action_queue)
treasurerRouter.get(
  "/actions",
  requireRole("admin", "treasurer", "volunteer"),
  async (req, res, next) => {
    const user = (req as any).user;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_action_queue", {
        p_role: user.role,
        p_user_id: user.id
      });

      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/overview (Admin only)
treasurerRouter.get(
  "/admin/overview",
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [
        membersRes,
        pendingAppsRes,
        eventsRes,
        tasksRes,
        expensesRes,
        variantsRes
      ] = await Promise.all([
        supabaseAdmin.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active").gte("expires_on", today),
        supabaseAdmin.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).in("status", ["todo", "in_progress"]),
        supabaseAdmin.from("expenses").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabaseAdmin.from("product_variants").select("id, stock_on_hand, reserved")
      ]);

      const lowStockCount = (variantsRes.data || []).filter(
        (v: any) => (v.stock_on_hand - v.reserved) <= 3
      ).length;

      res.json({
        data: {
          activeMembers: membersRes.count || 0,
          pendingApplications: pendingAppsRes.count || 0,
          publishedEvents: eventsRes.count || 0,
          openTasks: tasksRes.count || 0,
          submittedExpenses: expensesRes.count || 0,
          lowStockVariants: lowStockCount
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/users?q= (Admin only)
treasurerRouter.get(
  "/admin/users",
  requireRole("admin"),
  async (req, res, next) => {
    const q = req.query.q as string | undefined;

    try {
      let query = supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, student_id, is_demo, created_at, user_roles(role)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (q && q.trim().length > 0) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},student_id.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        studentId: p.student_id,
        isDemo: p.is_demo,
        role: p.user_roles?.role || "member",
        createdAt: p.created_at
      }));

      res.json({ data: formatted });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/users/:id/role (Admin only)
treasurerRouter.patch(
  "/admin/users/:id/role",
  requireRole("admin"),
  validate(UpdateUserRoleSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const { id } = req.params;
    const { role } = req.body;

    try {
      // Fetch target's current role
      const { data: currentRoleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .maybeSingle();

      const previousRole = currentRoleRow?.role || "member";

      // If demoting an admin, ensure they are not the last remaining admin
      if (previousRole === "admin" && role !== "admin") {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");

        if ((count || 0) <= 1) {
          return next(new ApiError(409, "CONFLICT", "Cannot demote the last remaining admin"));
        }
      }

      const { data, error } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: id,
          role,
          granted_by: admin.id,
          granted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) return next(error);

      // Audit log as role.grant with before and after
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: admin.id,
        action: "role.grant",
        entity_type: "user",
        entity_id: id,
        meta: { before: previousRole, after: role }
      });

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
