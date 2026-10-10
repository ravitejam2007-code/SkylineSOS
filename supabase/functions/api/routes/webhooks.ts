import type { Request, Response, NextFunction } from "npm:express@4.18.2";
import { env } from "../lib/env.ts";
import { verifyWebhookSignature } from "../lib/hmac.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";

export async function razorpayWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const signature = req.header("x-razorpay-signature");

  if (!signature) {
    return next(new ApiError(401, "INVALID_SIGNATURE", "Missing X-Razorpay-Signature header"));
  }

  // req.body is a Buffer or Uint8Array because express.raw({ type: "*/*" }) was mounted
  const rawBody = req.body as Buffer | Uint8Array;
  if (!rawBody || rawBody.length === 0) {
    return next(new ApiError(400, "BAD_REQUEST", "Empty webhook payload"));
  }

  const isValid = await verifyWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
  if (!isValid) {
    return next(new ApiError(401, "INVALID_SIGNATURE", "Webhook signature verification failed"));
  }

  try {
    const textPayload = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
    const event = JSON.parse(textPayload);
    const eventId = event.event_id || event.id || event.payload?.payment?.entity?.id || `evt_${Date.now()}`;
    const eventType = event.event || "unknown";

    // Deduplicate event using webhook_events table
    const { data: existing } = await supabaseAdmin
      .from("webhook_events")
      .select("provider_event_id")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (existing) {
      res.json({ data: { status: "duplicate", eventId } });
      return;
    }

    // Insert event
    await supabaseAdmin.from("webhook_events").insert({
      provider_event_id: eventId,
      event_type: eventType,
      payload_hash: signature
    });

    // Handle payment.captured
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;

      if (orderId) {
        // Find checkout linked to provider_order_id in payments table
        const { data: paymentRow } = await supabaseAdmin
          .from("payments")
          .select("checkout_id")
          .eq("provider_order_id", orderId)
          .maybeSingle();

        if (paymentRow?.checkout_id) {
          // Trigger idempotent fulfilment RPC
          await supabaseAdmin.rpc("fn_fulfil_checkout", {
            p_checkout_id: paymentRow.checkout_id,
            p_verification: "razorpay_verified",
            p_actor: null
          });
        }
      }
    }

    res.json({ data: { status: "processed", eventId } });
  } catch (err: any) {
    next(new ApiError(500, "INTERNAL", `Failed to process webhook: ${err.message}`));
  }
}
