import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const meRouter = Router();

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  studentId: z.string().max(40).optional()
});

// All routes under /me require authentication
meRouter.use(authenticate);

// GET /me
meRouter.get("/me", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, student_id, is_demo")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return next(new ApiError(404, "NOT_FOUND", "User profile not found"));
    }

    res.json({
      data: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        studentId: profile.student_id,
        role: user.role,
        isDemo: profile.is_demo
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /me
meRouter.patch("/me", validate(UpdateProfileSchema), async (req, res, next) => {
  const user = (req as any).user;
  const { fullName, studentId } = req.body;

  try {
    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.full_name = fullName;
    if (studentId !== undefined) updateData.student_id = studentId;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select("id, full_name, email, student_id, is_demo")
      .single();

    if (error) {
      return next(new ApiError(409, "CONFLICT", error.message));
    }

    res.json({
      data: {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        studentId: data.student_id,
        role: user.role,
        isDemo: data.is_demo
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /me/membership
meRouter.get("/me/membership", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: membership, error } = await supabaseAdmin
      .from("memberships")
      .select("id, status, starts_on, expires_on, membership_tiers (id, name, discount_percent, benefits)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("expires_on", today)
      .order("expires_on", { ascending: false })
      .maybeSingle();

    if (error) return next(error);

    res.json({ data: membership || null });
  } catch (err) {
    next(err);
  }
});

// GET /me/membership/history
meRouter.get("/me/membership/history", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: history, error } = await supabaseAdmin
      .from("memberships")
      .select("id, status, starts_on, expires_on, checkout_id, membership_tiers(id, name, fee_paise, duration_days, discount_percent)")
      .eq("user_id", user.id)
      .order("starts_on", { ascending: false });

    if (error) return next(error);

    res.json({ data: history || [] });
  } catch (err) {
    next(err);
  }
});

// POST /me/verify-code (rate limited to 6/min)
meRouter.post("/me/verify-code", rateLimit("member_code", 6, 60), async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data, error } = await supabaseAdmin.rpc("fn_issue_member_code", {
      p_user_id: user.id,
      p_ttl_seconds: 60
    });

    if (error) {
      return next(new ApiError(409, "NO_ACTIVE_MEMBERSHIP", error.message));
    }

    res.json({
      data: {
        code: data?.code || data,
        expiresAt: data?.expires_at || new Date(Date.now() + 60000).toISOString(),
        ttlSeconds: 60
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /me/tickets
meRouter.get("/me/tickets", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: tickets, error } = await supabaseAdmin
      .from("tickets")
      .select("id, code, holder_name, status, issued_at, events(id, title, venue, starts_at), ticket_types(name, price_paise)")
      .eq("owner_id", user.id)
      .order("issued_at", { ascending: false });

    if (error) return next(error);

    res.json({ data: tickets || [] });
  } catch (err) {
    next(err);
  }
});

// GET /me/orders
meRouter.get("/me/orders", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: orders, error } = await supabaseAdmin
      .from("checkouts")
      .select("id, status, payment_method, total_paise, created_at, checkout_items(id, item_type, quantity, unit_price_paise, discount_paise, fulfilment_status)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return next(error);

    res.json({ data: orders || [] });
  } catch (err) {
    next(err);
  }
});

// GET /me/notifications
meRouter.get("/me/notifications", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("id, kind, title, body, dedupe_key, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return next(error);

    const formatted = (notifications || []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      dedupeKey: n.dedupe_key,
      readAt: n.read_at,
      createdAt: n.created_at
    }));

    res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /me/notifications/:id/read
meRouter.post("/me/notifications/:id/read", async (req, res, next) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, read_at")
      .single();

    if (error || !data) {
      return next(new ApiError(404, "NOT_FOUND", "Notification not found"));
    }

    res.json({
      data: {
        id: data.id,
        readAt: data.read_at
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /me/preferences
meRouter.get("/me/preferences", async (req, res, next) => {
  const user = (req as any).user;
  try {
    const { data: prefs, error } = await supabaseAdmin
      .from("mailing_preferences")
      .select("topic, opted_in, updated_at")
      .eq("user_id", user.id);

    if (error) return next(error);

    const result: Record<string, boolean> = {
      events: false,
      merch: false,
      fundraisers: false,
      general: false
    };

    (prefs || []).forEach((p) => {
      result[p.topic] = p.opted_in;
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// PUT /me/preferences
meRouter.put("/me/preferences", async (req, res, next) => {
  const user = (req as any).user;
  const body = req.body || {};

  try {
    const topics = ["events", "merch", "fundraisers", "general"] as const;
    const upserts = [];

    for (const topic of topics) {
      if (body[topic] !== undefined) {
        upserts.push({
          user_id: user.id,
          topic,
          opted_in: Boolean(body[topic]),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (upserts.length > 0) {
      const { error } = await supabaseAdmin
        .from("mailing_preferences")
        .upsert(upserts, { onConflict: "user_id,topic" });

      if (error) return next(error);
    }

    const { data: updatedPrefs, error: fetchErr } = await supabaseAdmin
      .from("mailing_preferences")
      .select("topic, opted_in")
      .eq("user_id", user.id);

    if (fetchErr) return next(fetchErr);

    const result: Record<string, boolean> = {
      events: false,
      merch: false,
      fundraisers: false,
      general: false
    };
    (updatedPrefs || []).forEach((p) => {
      result[p.topic] = p.opted_in;
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
