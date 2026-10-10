import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { env } from "../lib/env.ts";
import { verifyRazorpaySignature } from "../lib/hmac.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const checkoutRouter = Router();

const CheckoutItemSchema = z.object({
  itemType: z.enum(["ticket", "merch", "membership"]),
  refId: z.string().uuid(),
  quantity: z.number().int().positive()
});

const CreateCheckoutSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1)
});

const VerifyCheckoutSchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1)
});

const StaffCheckoutSchema = z.object({
  buyerId: z.string().uuid().optional(),
  buyerEmail: z.string().email().optional(),
  buyerName: z.string().min(2).optional(),
  paymentMethod: z.enum(["cash", "manual_upi"]),
  note: z.string().min(2, "Note is required for staff checkout"),
  items: z.array(CheckoutItemSchema).min(1)
});

// POST /checkout 🔁 (Online Razorpay order flow)
checkoutRouter.post(
  "/checkout",
  authenticate,
  rateLimit("checkout_online", 20, 60),
  validate(CreateCheckoutSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const { items } = req.body;
    const idemKey = req.header("idempotency-key") || crypto.randomUUID();

    try {
      // 1. Call Postgres fn_create_checkout
      const { data: checkout, error: checkoutErr } = await supabaseAdmin.rpc("fn_create_checkout", {
        p_buyer_id: user.id,
        p_items: JSON.stringify(items),
        p_method: "online",
        p_idem_key: idemKey,
        p_recorded_by: null,
        p_note: null
      });

      if (checkoutErr || !checkout) {
        return next(new ApiError(409, checkoutErr?.message || "CHECKOUT_FAILED", checkoutErr?.message || "Could not create checkout"));
      }

      // If already paid/fulfilled (replayed idempotency)
      if (checkout.status === "paid" || checkout.status === "fulfilled") {
        return res.json({
          data: {
            checkoutId: checkout.id,
            status: checkout.status,
            amountPaise: checkout.total_paise,
            paymentMethod: "online"
          }
        });
      }

      const totalPaise = checkout.total_paise;

      // Handle free/zero checkouts immediately
      if (totalPaise === 0) {
        await supabaseAdmin.rpc("fn_fulfil_checkout", {
          p_checkout_id: checkout.id,
          p_verification: "staff_recorded",
          p_actor: user.id
        });

        return res.json({
          data: {
            checkoutId: checkout.id,
            status: "fulfilled",
            amountPaise: 0,
            paymentMethod: "online"
          }
        });
      }

      // 2. Create Razorpay order via REST API using Basic auth
      const basicAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: totalPaise,
          currency: "INR",
          receipt: checkout.id
        })
      });

      if (!rzpRes.ok) {
        const errBody = await rzpRes.json().catch(() => ({}));
        console.error("Razorpay order creation failed:", errBody);
        return next(
          new ApiError(502, "PAYMENT_PROVIDER_ERROR", "Failed to initiate payment with Razorpay")
        );
      }

      const rzpOrder = await rzpRes.json();

      // Record created payment
      await supabaseAdmin.from("payments").insert({
        checkout_id: checkout.id,
        provider: "razorpay",
        mode: env.RAZORPAY_MODE,
        provider_order_id: rzpOrder.id,
        amount_paise: totalPaise,
        status: "created"
      });

      res.status(201).json({
        data: {
          checkoutId: checkout.id,
          orderId: rzpOrder.id,
          keyId: env.RAZORPAY_KEY_ID,
          amountPaise: totalPaise,
          currency: "INR",
          status: "pending",
          expiresAt: checkout.expires_at
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /checkout/:id/verify
checkoutRouter.post(
  "/checkout/:id/verify",
  authenticate,
  validate(VerifyCheckoutSchema),
  async (req, res, next) => {
    const user = (req as any).user;
    const checkoutId = req.params.id;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    try {
      // 1. Verify Razorpay signature using constant-time HMAC check
      const isValid = await verifyRazorpaySignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        env.RAZORPAY_KEY_SECRET
      );

      if (!isValid) {
        return next(new ApiError(401, "INVALID_SIGNATURE", "Payment signature verification failed"));
      }

      // Update payment record to captured
      await supabaseAdmin
        .from("payments")
        .update({
          provider_payment_id: razorpayPaymentId,
          status: "captured"
        })
        .eq("provider_order_id", razorpayOrderId);

      // 2. Fulfill checkout atomically via Postgres RPC
      const { data: result, error: fulfilErr } = await supabaseAdmin.rpc("fn_fulfil_checkout", {
        p_checkout_id: checkoutId,
        p_verification: "razorpay_verified",
        p_actor: user.id
      });

      if (fulfilErr) {
        return next(new ApiError(409, fulfilErr.message, fulfilErr.message));
      }

      res.json({
        data: {
          checkoutId,
          status: "fulfilled",
          result
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /checkout/:id/cancel
checkoutRouter.post("/checkout/:id/cancel", authenticate, async (req, res, next) => {
  const user = (req as any).user;
  const checkoutId = req.params.id;

  try {
    const { data: checkout } = await supabaseAdmin
      .from("checkouts")
      .select("buyer_id, status")
      .eq("id", checkoutId)
      .maybeSingle();

    if (!checkout) return next(new ApiError(404, "NOT_FOUND", "Checkout not found"));
    if (checkout.buyer_id !== user.id && user.role !== "admin") {
      return next(new ApiError(403, "FORBIDDEN", "Unauthorized to cancel this checkout"));
    }

    if (checkout.status !== "pending") {
      return next(new ApiError(409, "CHECKOUT_NOT_PENDING", "Only pending checkouts can be cancelled"));
    }

    await supabaseAdmin
      .from("checkouts")
      .update({ status: "cancelled" })
      .eq("id", checkoutId);

    // Release any merchandise reservation
    await supabaseAdmin.rpc("fn_expire_checkouts");

    res.json({ data: { checkoutId, status: "cancelled" } });
  } catch (err) {
    next(err);
  }
});

// POST /staff/checkout 🔁 (Staff cash / manual UPI)
checkoutRouter.post(
  "/staff/checkout",
  authenticate,
  requireRole("admin", "treasurer", "door"),
  rateLimit("staff_checkout", 20, 60),
  validate(StaffCheckoutSchema),
  async (req, res, next) => {
    const staff = (req as any).user;
    const { buyerId, buyerEmail, buyerName, paymentMethod, note, items } = req.body;
    const idemKey = req.header("idempotency-key") || crypto.randomUUID();

    // Door staff can only sell tickets
    if (staff.role === "door") {
      const hasNonTicket = items.some((i: any) => i.itemType !== "ticket");
      if (hasNonTicket) {
        return next(new ApiError(403, "FORBIDDEN", "Door staff can only record ticket sales"));
      }
    }

    try {
      let finalBuyerId = buyerId;

      // Handle guest/walk-in buyer if buyerId is omitted
      if (!finalBuyerId) {
        if (buyerEmail) {
          const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", buyerEmail)
            .maybeSingle();

          if (existing) {
            finalBuyerId = existing.id;
          }
        }

        if (!finalBuyerId) {
          // Fall back to designated walk-in guest profile or staff themselves
          const { data: guestProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", "guest@skylinesos.demo")
            .maybeSingle();

          finalBuyerId = guestProfile?.id || staff.id;
        }
      }

      // Execute atomic staff checkout RPC (create + fulfil in 1 transaction)
      const { data: result, error } = await supabaseAdmin.rpc("fn_record_staff_checkout", {
        p_buyer_id: finalBuyerId,
        p_items: JSON.stringify(items),
        p_method: paymentMethod,
        p_recorded_by: staff.id,
        p_note: note,
        p_idem_key: idemKey
      });

      if (error) {
        return next(new ApiError(409, error.message, error.message));
      }

      res.status(201).json({
        data: {
          checkoutId: result?.id || result,
          status: "fulfilled",
          paymentMethod,
          recordedBy: staff.id
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
