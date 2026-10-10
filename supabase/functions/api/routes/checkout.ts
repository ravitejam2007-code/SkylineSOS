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
  itemType: z.enum(["ticket", "merch", "membership"]).optional(),
  type: z.enum(["ticket", "merch", "membership"]).optional(),
  refId: z.string().uuid().optional(),
  ref_id: z.string().uuid().optional(),
  quantity: z.number().int().positive()
}).refine((d) => Boolean((d.itemType || d.type) && (d.refId || d.ref_id)), {
  message: "item type and refId are required"
});

const CreateCheckoutSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1),
  paymentMethod: z.enum(["online"]).default("online").optional()
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
  buyer: z.object({
    email: z.string().email().optional(),
    guest: z.boolean().optional()
  }).optional(),
  holderName: z.string().min(2).optional(),
  paymentMethod: z.enum(["cash", "manual_upi"]),
  note: z.string().min(2, "Note is required for staff checkout"),
  items: z.array(CheckoutItemSchema).min(1)
});

// GET /checkout/:id (owner, A, T)
checkoutRouter.get("/checkout/:id", authenticate, async (req, res, next) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const { data: checkout, error } = await supabaseAdmin
      .from("checkouts")
      .select("*, checkout_items(*), payments(*)")
      .eq("id", id)
      .maybeSingle();

    if (error || !checkout) {
      return next(new ApiError(404, "NOT_FOUND", "Checkout not found"));
    }

    if (checkout.buyer_id !== user.id && user.role !== "admin" && user.role !== "treasurer") {
      return next(new ApiError(403, "FORBIDDEN", "Unauthorized to view this checkout"));
    }

    res.json({
      data: {
        id: checkout.id,
        status: checkout.status,
        paymentMethod: checkout.payment_method,
        subtotalPaise: checkout.subtotal_paise,
        discountPaise: checkout.discount_paise,
        totalPaise: checkout.total_paise,
        expiresAt: checkout.expires_at,
        createdAt: checkout.created_at,
        items: (checkout.checkout_items || []).map((ci: any) => ({
          id: ci.id,
          type: ci.item_type,
          itemType: ci.item_type,
          refId: ci.ref_id,
          quantity: ci.quantity,
          unitPricePaise: ci.unit_price_paise,
          discountPaise: ci.discount_paise,
          fulfilmentStatus: ci.fulfilment_status
        })),
        payments: (checkout.payments || []).map((p: any) => ({
          id: p.id,
          provider: p.provider,
          amountPaise: p.amount_paise,
          status: p.status,
          providerOrderId: p.provider_order_id,
          providerPaymentId: p.provider_payment_id
        }))
      }
    });
  } catch (err) {
    next(err);
  }
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

    const normalizedItems = items.map((i: any) => ({
      itemType: i.itemType || i.type,
      refId: i.refId || i.ref_id,
      quantity: i.quantity
    }));

    try {
      // 1. Call Postgres fn_create_checkout
      const { data: checkout, error: checkoutErr } = await supabaseAdmin.rpc("fn_create_checkout", {
        p_buyer_id: user.id,
        p_items: JSON.stringify(normalizedItems),
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
            checkout: {
              id: checkout.id,
              status: checkout.status,
              subtotalPaise: checkout.subtotal_paise,
              discountPaise: checkout.discount_paise,
              totalPaise: checkout.total_paise,
              expiresAt: checkout.expires_at,
              items: normalizedItems
            },
            razorpay: null,
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

        return res.status(201).json({
          data: {
            checkout: {
              id: checkout.id,
              status: "fulfilled",
              subtotalPaise: checkout.subtotal_paise || 0,
              discountPaise: checkout.discount_paise || 0,
              totalPaise: 0,
              expiresAt: checkout.expires_at,
              items: normalizedItems
            },
            razorpay: null,
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
          checkout: {
            id: checkout.id,
            status: "pending",
            subtotalPaise: checkout.subtotal_paise,
            discountPaise: checkout.discount_paise,
            totalPaise: checkout.total_paise,
            expiresAt: checkout.expires_at,
            items: normalizedItems
          },
          razorpay: {
            keyId: env.RAZORPAY_KEY_ID,
            orderId: rzpOrder.id,
            amountPaise: totalPaise,
            currency: "INR",
            mode: env.RAZORPAY_MODE
          },
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

      // Query any issued tickets
      const { data: itemRows } = await supabaseAdmin
        .from("checkout_items")
        .select("id")
        .eq("checkout_id", checkoutId);

      const itemIds = (itemRows || []).map((i: any) => i.id);
      let tickets: any[] = [];
      if (itemIds.length > 0) {
        const { data: tData } = await supabaseAdmin
          .from("tickets")
          .select("id, code, event_id, holder_name")
          .in("checkout_item_id", itemIds);
        tickets = (tData || []).map((t: any) => ({
          id: t.id,
          code: t.code,
          eventId: t.event_id,
          holderName: t.holder_name
        }));
      }

      res.json({
        data: {
          checkoutId,
          status: "fulfilled",
          tickets,
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
    const { buyerId, buyerEmail, buyerName, buyer, holderName, paymentMethod, note, items } = req.body;
    const idemKey = req.header("idempotency-key") || crypto.randomUUID();

    const normalizedItems = items.map((i: any) => ({
      itemType: i.itemType || i.type,
      refId: i.refId || i.ref_id,
      quantity: i.quantity
    }));

    // Door staff can only sell tickets
    if (staff.role === "door") {
      const hasNonTicket = normalizedItems.some((i: any) => i.itemType !== "ticket");
      if (hasNonTicket) {
        return next(new ApiError(403, "FORBIDDEN", "Door staff can only record ticket sales"));
      }
    }

    try {
      let finalBuyerId = buyerId;
      const effectiveEmail = buyer?.email || buyerEmail;

      // Handle guest/walk-in buyer if buyerId is omitted
      if (!finalBuyerId) {
        if (effectiveEmail) {
          const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", effectiveEmail)
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
        p_items: JSON.stringify(normalizedItems),
        p_method: paymentMethod,
        p_recorded_by: staff.id,
        p_note: note,
        p_idem_key: idemKey
      });

      if (error) {
        return next(new ApiError(409, error.message, error.message));
      }

      const checkoutId = result?.id || result;

      // Query any issued tickets
      const { data: itemRows } = await supabaseAdmin
        .from("checkout_items")
        .select("id")
        .eq("checkout_id", checkoutId);

      const itemIds = (itemRows || []).map((i: any) => i.id);
      let tickets: any[] = [];
      if (itemIds.length > 0) {
        // If holderName supplied for guest checkout, update ticket holder name
        if (holderName && holderName.trim().length > 0) {
          await supabaseAdmin
            .from("tickets")
            .update({ holder_name: holderName.trim() })
            .in("checkout_item_id", itemIds);
        }

        const { data: tData } = await supabaseAdmin
          .from("tickets")
          .select("id, code, event_id, holder_name")
          .in("checkout_item_id", itemIds);

        tickets = (tData || []).map((t: any) => ({
          id: t.id,
          code: t.code,
          eventId: t.event_id,
          holderName: t.holder_name
        }));
      }

      res.status(201).json({
        data: {
          checkoutId,
          status: "fulfilled",
          verification: "staff_recorded",
          paymentMethod,
          recordedBy: staff.id,
          tickets
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
