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

    try {
      // Find or create profile
      let profileId: string;
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        profileId = existingProfile.id;
      } else {
        // Create an auth user or guest profile
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, student_id: studentId }
        });

        if (authErr || !authUser?.user) {
          return next(new ApiError(409, "CONFLICT", authErr?.message || "Failed to create user account"));
        }
        profileId = authUser.user.id;
      }

      // If tier provided, record walk-up application and dues if paid
      if (tierId && paymentMethod) {
        await supabaseAdmin.rpc("fn_record_staff_checkout", {
          p_buyer_id: profileId,
          p_items: JSON.stringify([{ itemType: "membership", refId: tierId, quantity: 1 }]),
          p_method: paymentMethod,
          p_recorded_by: staff.id,
          p_note: note || "Walk-up registration at desk",
          p_idem_key: req.header("idempotency-key") || crypto.randomUUID()
        });
      }

      res.status(201).json({
        data: {
          userId: profileId,
          fullName,
          email
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
