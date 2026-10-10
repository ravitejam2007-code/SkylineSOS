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
          name: data.name,
          tier: data.tier,
          status: data.status,
          expiresOn: data.expires_on,
          discountPercent: data.discount_percent
        }
      });
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
          ticketId: data.ticket_id,
          holderName: data.holder_name,
          ticketType: data.ticket_type,
          eventTitle: data.event_title,
          checkedInAt: data.checked_in_at || new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /door/tickets (A, D)
doorRouter.get(
  "/door/tickets",
  authenticate,
  requireRole("admin", "door"),
  async (req, res, next) => {
    const eventId = req.query.eventId as string | undefined;
    const q = req.query.q as string | undefined;

    try {
      let query = supabaseAdmin
        .from("tickets")
        .select("id, code, holder_name, status, issued_at, ticket_types(name), events(title)")
        .limit(20);

      if (eventId) {
        query = query.eq("event_id", eventId);
      }

      if (q && q.trim().length > 0) {
        query = query.ilike("holder_name", `%${q.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);
