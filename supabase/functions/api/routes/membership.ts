import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const membershipRouter = Router();

const CreateApplicationSchema = z.object({
  tierId: z.string().uuid(),
  answers: z.record(z.unknown()).default({})
});

const ReviewApplicationSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().optional()
});

const ResubmitApplicationSchema = z.object({
  tierId: z.string().uuid().optional(),
  answers: z.record(z.unknown())
});

const CreateTierSchema = z.object({
  name: z.string().min(1),
  feePaise: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  benefits: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

const UpdateTierSchema = CreateTierSchema.partial();

const WalkUpMemberSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  studentId: z.string().optional(),
  tierId: z.string().uuid().optional(),
  paymentMethod: z.enum(["cash", "manual_upi"]).optional(),
  note: z.string().optional()
});

// POST /membership/applications
membershipRouter.post(
  "/membership/applications",
  authenticate,
  validate(CreateApplicationSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const { tierId, answers } = req.body;

    try {
      // Check for existing open applications
      const { data: existing } = await supabaseAdmin
        .from("membership_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .in("status", ["draft", "pending", "approved"])
        .maybeSingle();

      if (existing) {
        return next(
          new ApiError(409, "APPLICATION_EXISTS", "You already have an active or pending application")
        );
      }

      const { data, error } = await supabaseAdmin
        .from("membership_applications")
        .insert({
          user_id: user.id,
          tier_id: tierId,
          status: "pending",
          answers,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) return next(error);

      res.status(201).json({
        data: {
          id: data.id,
          status: data.status,
          revision: data.revision,
          tierId: data.tier_id,
          submittedAt: data.submitted_at
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /membership/applications/:id (owner, rejected only)
membershipRouter.put(
  "/membership/applications/:id",
  authenticate,
  validate(ResubmitApplicationSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { tierId, answers } = req.body;

    try {
      const { data: app, error: fetchErr } = await supabaseAdmin
        .from("membership_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !app) {
        return next(new ApiError(404, "NOT_FOUND", "Application not found"));
      }

      if (app.user_id !== user.id) {
        return next(new ApiError(403, "FORBIDDEN", "Not authorized to edit this application"));
      }

      if (app.status !== "rejected") {
        return next(new ApiError(409, "CONFLICT", "Only rejected applications can be resubmitted"));
      }

      const updates: Record<string, unknown> = {
        status: "pending",
        revision: app.revision + 1,
        answers,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rejection_reason: null
      };

      if (tierId) updates.tier_id = tierId;

      const { data, error } = await supabaseAdmin
        .from("membership_applications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return next(error);

      res.json({
        data: {
          id: data.id,
          status: data.status,
          revision: data.revision,
          tierId: data.tier_id,
          submittedAt: data.submitted_at
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /me/membership/applications
membershipRouter.get(
  "/me/membership/applications",
  authenticate,
  async (req, res, next) => {
    const user = (req as any).user;
    try {
      const { data, error } = await supabaseAdmin
        .from("membership_applications")
        .select("*, membership_tiers(name, fee_paise), membership_application_reviews(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return next(error);

      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/membership/applications
membershipRouter.get(
  "/admin/membership/applications",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    const status = (req.query.status as string) || "pending";
    try {
      const { data, error } = await supabaseAdmin
        .from("membership_applications")
        .select("*, profiles:user_id(id, full_name, email, student_id), membership_tiers(id, name, fee_paise)")
        .eq("status", status)
        .order("created_at", { ascending: true });

      if (error) return next(error);

      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/membership/applications/:id/review
membershipRouter.post(
  "/admin/membership/applications/:id/review",
  authenticate,
  requireRole("admin"),
  validate(ReviewApplicationSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const { id } = req.params;
    const { decision, reason } = req.body;

    if (decision === "rejected" && (!reason || reason.trim().length === 0)) {
      return next(new ApiError(422, "VALIDATION_FAILED", "Rejection reason is required"));
    }

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_review_application", {
        p_application_id: id,
        p_reviewer_id: admin.id,
        p_decision: decision,
        p_reason: reason || null
      });

      if (error) return next(error);

      res.json({ data: data || { status: decision } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/members/walk-up
membershipRouter.post(
  "/admin/members/walk-up",
  authenticate,
  requireRole("admin", "door"),
  validate(WalkUpMemberSchema),
  async (req, res, next) => {
    const staff = (req as any).user;
    const { fullName, email, studentId, tierId, paymentMethod, note } = req.body;

    // Door staff cannot approve or record dues
    if (staff.role === "door" && paymentMethod) {
      return next(new ApiError(403, "FORBIDDEN", "Door staff may only create walk-up applications, not process dues"));
    }

    try {
      let profileId: string;
      let tempPassword: string | undefined = undefined;

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        profileId = existingProfile.id;
      } else {
        tempPassword = `Sky@${Math.random().toString(36).slice(-8)}!`;
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, student_id: studentId }
        });

        if (authErr || !authUser?.user) {
          return next(new ApiError(409, "CONFLICT", authErr?.message || "Failed to create user account"));
        }
        profileId = authUser.user.id;
      }

      // If tier provided, record walk-up application
      if (tierId) {
        // Create an application record if none exists
        const { data: existingApp } = await supabaseAdmin
          .from("membership_applications")
          .select("id")
          .eq("user_id", profileId)
          .in("status", ["pending", "approved"])
          .maybeSingle();

        let appId = existingApp?.id;
        if (!appId) {
          const { data: newApp } = await supabaseAdmin
            .from("membership_applications")
            .insert({
              user_id: profileId,
              tier_id: tierId,
              status: staff.role === "admin" && paymentMethod ? "approved" : "pending",
              answers: { walkUp: true, registeredBy: staff.id },
              submitted_at: new Date().toISOString()
            })
            .select()
            .single();
          appId = newApp?.id;
        }

        // Admin records dues immediately if payment method provided
        if (staff.role === "admin" && paymentMethod) {
          await supabaseAdmin.rpc("fn_record_staff_checkout", {
            p_buyer_id: profileId,
            p_items: JSON.stringify([{ itemType: "membership", refId: tierId, quantity: 1 }]),
            p_method: paymentMethod,
            p_recorded_by: staff.id,
            p_note: note || "Walk-up registration at desk",
            p_idem_key: req.header("idempotency-key") || crypto.randomUUID()
          });
        }
      }

      res.status(201).json({
        data: {
          userId: profileId,
          fullName,
          email,
          ...(tempPassword ? { temporaryPassword: tempPassword } : {})
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/tiers (A)
membershipRouter.get(
  "/admin/tiers",
  authenticate,
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("membership_tiers")
        .select("*")
        .order("fee_paise", { ascending: true });

      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/tiers (A)
membershipRouter.post(
  "/admin/tiers",
  authenticate,
  requireRole("admin"),
  validate(CreateTierSchema),
  async (req, res, next) => {
    const { name, feePaise, durationDays, discountPercent, benefits, isActive } = req.body;
    try {
      const { data, error } = await supabaseAdmin
        .from("membership_tiers")
        .insert({
          name,
          fee_paise: feePaise,
          duration_days: durationDays,
          discount_percent: discountPercent || 0,
          benefits: benefits || [],
          is_active: isActive !== undefined ? isActive : true
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

// PATCH /admin/tiers/:id (A)
membershipRouter.patch(
  "/admin/tiers/:id",
  authenticate,
  requireRole("admin"),
  validate(UpdateTierSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.feePaise !== undefined) updates.fee_paise = body.feePaise;
    if (body.durationDays !== undefined) updates.duration_days = body.durationDays;
    if (body.discountPercent !== undefined) updates.discount_percent = body.discountPercent;
    if (body.benefits !== undefined) updates.benefits = body.benefits;
    if (body.isActive !== undefined) updates.is_active = body.isActive;

    try {
      const { data, error } = await supabaseAdmin
        .from("membership_tiers")
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
