import { Router } from "npm:express@4.18.2";
import { supabaseAdmin, supabaseAnon } from "../lib/db.ts";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const announcementsRouter = Router();

// GET /announcements (optional authentication to determine audience tier)
announcementsRouter.get("/announcements", async (req, res, next) => {
  const authHeader = req.header("authorization");
  let userRole: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    try {
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (user) {
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        userRole = roleRow?.role || "member";
      }
    } catch {
      // Treat as unauthenticated visitor
    }
  }

  try {
    let allowedAudiences = ["public"];
    if (userRole === "member") {
      allowedAudiences = ["public", "members"];
    } else if (["admin", "treasurer", "door", "volunteer"].includes(userRole || "")) {
      allowedAudiences = ["public", "members", "staff"];
    }

    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, audience, status, published_at, created_at")
      .eq("status", "published")
      .in("audience", allowedAudiences)
      .order("published_at", { ascending: false });

    if (error) return next(error);

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// Admin Announcement Endpoints (A)
const CreateAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.enum(["public", "members", "staff"]).default("public")
});

const UpdateAnnouncementSchema = CreateAnnouncementSchema.partial();

// GET /admin/announcements (A)
announcementsRouter.get(
  "/admin/announcements",
  authenticate,
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .select("id, title, body, audience, status, published_at, created_at")
        .order("created_at", { ascending: false });

      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/announcements (A)
announcementsRouter.post(
  "/admin/announcements",
  authenticate,
  requireRole("admin"),
  validate(CreateAnnouncementSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const { title, body, audience } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .insert({
          title,
          body,
          audience,
          status: "draft",
          author_id: admin.id
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

// PATCH /admin/announcements/:id (A)
announcementsRouter.patch(
  "/admin/announcements/:id",
  authenticate,
  requireRole("admin"),
  validate(UpdateAnnouncementSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.body !== undefined) updates.body = body.body;
      if (body.audience !== undefined) updates.audience = body.audience;

      const { data, error } = await supabaseAdmin
        .from("announcements")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return next(new ApiError(404, "NOT_FOUND", "Announcement not found"));
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/announcements/:id/publish (A)
announcementsRouter.post(
  "/admin/announcements/:id/publish",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    const { id } = req.params;

    try {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .update({
          status: "published",
          published_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return next(new ApiError(404, "NOT_FOUND", "Announcement not found"));
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/announcements/:id/archive (A)
announcementsRouter.post(
  "/admin/announcements/:id/archive",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    const { id } = req.params;

    try {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .update({
          status: "archived"
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return next(new ApiError(404, "NOT_FOUND", "Announcement not found"));
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
