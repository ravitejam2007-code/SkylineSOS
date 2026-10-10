import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const doorRouter = Router();

const VerifyMemberSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Must be a 6-digit numeric code")
});

const CheckInTicketSchema = z.object({
  eventId: z.string().uuid().optional(),
  code: z.string().min(4).max(20)
});

// Normalise ticket code: upper-case, strip spaces/dashes, O->0, I/L->1
function normalizeTicketCode(input: string): string {
  let cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.startsWith("SKY")) {
    cleaned = cleaned.substring(3);
  }
  cleaned = cleaned.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (cleaned.length === 8) {
    return `SKY-${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
  }
  return input.trim().toUpperCase();
}

function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// POST /staff/verify/member (A, T, D) — Rate limit: 10 / min
doorRouter.post(
  "/staff/verify/member",
  authenticate,
  requireRole("admin", "treasurer", "door"),
  rateLimit("staff_verify_member", 10, 60),
  validate(VerifyMemberSchema),
  async (req, res, next) => {
    const staff = (req as any).user;
    const { code } = req.body;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_verify_member_code", {
        p_code: code,
        p_staff_id: staff.id
      });

      if (error || !data) {
        return next(
          new ApiError(404, "CODE_INVALID", "Invalid or expired member verification code")
        );
      }

      res.json({
        data: {
          valid: true,
          fullName: data.fullName || data.name,
          tier: data.tier,
          status: data.status,
          expiresOn: data.expiresOn || data.expires_on,
          discountPercent: data.discountPercent ?? data.discount_percent
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /staff/members?q= (A, T, D)
doorRouter.get(
  "/staff/members",
  authenticate,
  requireRole("admin", "treasurer", "door"),
  async (req, res, next) => {
    const staff = (req as any).user;
    const q = req.query.q as string | undefined;

    try {
      let query = supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, student_id, is_demo, memberships(status, expires_on, membership_tiers(name))")
        .limit(30);

      if (q && q.trim().length > 0) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},student_id.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map((p: any) => {
        const activeMembership = (p.memberships || []).find((m: any) => m.status === "active");
        const tierName = activeMembership?.membership_tiers?.name || null;
        const status = activeMembership ? "active" : "inactive";

        if (staff.role === "admin") {
          return {
            id: p.id,
            fullName: p.full_name,
            email: p.email,
            studentId: p.student_id,
            isDemo: p.is_demo,
            membershipStatus: status,
            tier: tierName,
            expiresOn: activeMembership?.expires_on || null
          };
        }

        // Minimal fields for door and treasurer staff
        return {
          id: p.id,
          fullName: p.full_name,
          studentId: p.student_id,
          membershipStatus: status,
          tier: tierName
        };
      });

      res.json({ data: formatted });
    } catch (err) {
      next(err);
    }
  }
);

// POST /door/check-in (A, D) — Rate limit: 10 / min
doorRouter.post(
  "/door/check-in",
  authenticate,
  requireRole("admin", "door"),
  rateLimit("door_check_in", 10, 60),
  validate(CheckInTicketSchema),
  async (req, res, next) => {
    const staff = (req as any).user;
    const { eventId, code } = req.body;
    const normalizedCode = normalizeTicketCode(code);

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_check_in", {
        p_event_id: eventId || null,
        p_code: normalizedCode,
        p_staff_id: staff.id
      });

      if (error) {
        return next(new ApiError(409, error.message, error.message, error.details ? { details: error.details } : undefined));
      }

      res.json({
        data: {
          ticketId: data.ticket_id || data.ticketId,
          holderName: data.holder_name || data.holderName,
          ticketType: data.ticket_type || data.ticketType,
          checkedInAt: data.checked_in_at || data.checkedInAt || new Date().toISOString(),
          counters: data.counters || { sold: 0, checkedIn: 0, capacity: 0 }
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /door/tickets?eventId=&q= (A, D) — Rate limit: 10 / min
doorRouter.get(
  "/door/tickets",
  authenticate,
  requireRole("admin", "door"),
  rateLimit("door_tickets", 10, 60),
  async (req, res, next) => {
    const eventId = req.query.eventId as string | undefined;
    const q = req.query.q as string | undefined;

    if (q && q.trim().length > 0 && q.trim().length < 3) {
      return next(new ApiError(422, "VALIDATION_FAILED", "Search query must be at least 3 characters"));
    }

    try {
      let query = supabaseAdmin
        .from("tickets")
        .select("id, holder_name, status, ticket_types(name), profiles:owner_id(email)")
        .limit(30);

      if (eventId) {
        query = query.eq("event_id", eventId);
      }

      if (q && q.trim().length >= 3) {
        query = query.ilike("holder_name", `%${q.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      // NEVER return the ticket code as per §4.13 contract
      const formatted = (data || []).map((t: any) => ({
        ticketId: t.id,
        holderName: t.holder_name,
        ticketType: t.ticket_types?.name,
        status: t.status,
        maskedEmail: maskEmail(t.profiles?.email)
      }));

      res.json({ data: formatted });
    } catch (err) {
      next(err);
    }
  }
);
