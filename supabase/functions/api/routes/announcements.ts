import { Router } from "npm:express@4.18.2";
import { supabaseAdmin, supabaseAnon } from "../lib/db.ts";

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
