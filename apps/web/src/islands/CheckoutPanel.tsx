import React, { useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { formatPaise } from "../lib/money.ts";

interface ItemInput {
  itemType: "ticket" | "merch" | "membership";
  refId: string;
  name: string;
  unitPricePaise: number;
  quantity: number;
}

interface CheckoutPanelProps {
  item: ItemInput;
  isStaff?: boolean;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function CheckoutPanel({ item, isStaff = false }: CheckoutPanelProps) {
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [payMethod, setPayMethod] = useState<"online" | "cash" | "manual_upi">("online");
  const [staffNote, setStaffNote] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  const totalPaise = item.unitPricePaise * quantity;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    const idemKey = crypto.randomUUID();

    try {
      if (payMethod === "online") {
        // 1. Create online checkout
        const orderData = await api<any>("/checkout", {
          method: "POST",
          headers: { "Idempotency-Key": idemKey },
          json: {
            items: [
              {
                itemType: item.itemType,
                refId: item.refId,
                quantity
              }
            ]
          }
        });

        // If free checkout, fulfilled immediately
        if (orderData.status === "fulfilled" || orderData.amountPaise === 0) {
          setSuccessResult({
            checkoutId: orderData.checkoutId,
            status: "fulfilled",
            paymentMethod: "online",
            totalPaise: 0
          });
          return;
        }

        // 2. Open Razorpay Checkout modal
        if (typeof window.Razorpay !== "undefined") {
          const rzp = new window.Razorpay({
            key: orderData.keyId,
            amount: orderData.amountPaise,
            currency: orderData.currency || "INR",
            name: "SkylineSOS",
            description: `${item.name} (${quantity}x)`,
            order_id: orderData.orderId,
            handler: async (response: any) => {
              try {
                // Verify callback
                const verifyRes = await api<any>(`/checkout/${orderData.checkoutId}/verify`, {
                  method: "POST",
                  json: {
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpaySignature: response.razorpay_signature
                  }
                });
                setSuccessResult(verifyRes);
              } catch (verifyErr: any) {
                setError(`Verification failed: ${verifyErr.message}`);
              }
            },
            modal: {
              ondismiss: () => {
                setLoading(false);
              }
            }
          });
          rzp.open();
        } else {
          // Fallback simulation for environments where Razorpay SDK script isn't loaded
          setError(
            "Razorpay Checkout SDK not loaded. For local/test demonstrations, select Cash or Manual UPI."
          );
        }
      } else {
        // Staff-recorded checkout (cash or manual UPI)
        const staffRes = await api<any>("/staff/checkout", {
          method: "POST",
          headers: { "Idempotency-Key": idemKey },
          json: {
            paymentMethod: payMethod,
            note: staffNote || `In-person ${payMethod} sale for ${item.name}`,
            buyerEmail: buyerEmail || undefined,
            items: [
              {
                itemType: item.itemType,
                refId: item.refId,
                quantity
              }
            ]
          }
        });

        setSuccessResult({
          checkoutId: staffRes.checkoutId,
          status: "fulfilled",
          paymentMethod: payMethod,
          totalPaise
        });
      }
    } catch (err: any) {
      setError(err.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (successResult) {
    return (
      <div className="p-8 rounded-3xl bg-green-50 border border-success/30 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-success text-white text-3xl font-black flex items-center justify-center mx-auto mb-4">
          ✓
        </div>
        <h3 className="text-2xl font-black text-ink-deep">Order Confirmed!</h3>
        <p className="text-sm text-steel mt-1 mb-4">
          Payment recorded via <span className="font-bold text-ink uppercase">{successResult.paymentMethod}</span>.
        </p>
        <div className="bg-white p-4 rounded-2xl border border-hairline text-left text-xs space-y-1 mb-6">
          <div className="flex justify-between">
            <span className="text-steel">Item:</span>
            <span className="font-bold">{item.name} ({quantity}x)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-steel">Total Amount:</span>
            <span className="font-bold">{formatPaise(totalPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-steel">Order ID:</span>
            <span className="font-mono">{successResult.checkoutId}</span>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <a
            href="/my/tickets"
            className="px-6 py-2.5 rounded-full bg-ink-deep text-white text-xs font-bold hover:bg-charcoal transition-colors"
          >
            View My Tickets
          </a>
          <button
            onClick={() => setSuccessResult(null)}
            className="px-6 py-2.5 rounded-full border border-hairline text-ink text-xs font-bold hover:bg-surface-soft transition-colors"
          >
            Order Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-3xl border border-hairline shadow-sm max-w-md mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-hairline mb-4">
        <div>
          <h3 className="text-base font-bold text-ink-deep">{item.name}</h3>
          <span className="text-xs text-steel font-medium">Unit: {formatPaise(item.unitPricePaise)}</span>
        </div>
        <div className="flex items-center gap-2 border border-hairline rounded-full px-2 py-1">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm text-charcoal disabled:opacity-30"
          >
            -
          </button>
          <span className="w-5 text-center font-bold text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm text-charcoal"
          >
            +
          </button>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="mb-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-2">
          Payment Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPayMethod("online")}
            className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${
              payMethod === "online"
                ? "bg-primary text-white border-primary shadow-xs"
                : "bg-surface-soft text-charcoal border-hairline hover:bg-white"
            }`}
          >
            Razorpay Test
          </button>
          <button
            type="button"
            onClick={() => setPayMethod("cash")}
            className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${
              payMethod === "cash"
                ? "bg-ink-deep text-white border-ink-deep shadow-xs"
                : "bg-surface-soft text-charcoal border-hairline hover:bg-white"
            }`}
          >
            Cash Desk
          </button>
          <button
            type="button"
            onClick={() => setPayMethod("manual_upi")}
            className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${
              payMethod === "manual_upi"
                ? "bg-ink-deep text-white border-ink-deep shadow-xs"
                : "bg-surface-soft text-charcoal border-hairline hover:bg-white"
            }`}
          >
            Manual UPI
          </button>
        </div>
      </div>

      {payMethod !== "online" && (
        <div className="space-y-3 mb-5 p-3 rounded-2xl bg-surface-soft border border-hairline-soft">
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Staff Note (mandatory for cash audit)
            </label>
            <input
              type="text"
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              placeholder="e.g. Received ₹300 at door registration desk"
              className="w-full h-9 px-3 rounded-lg border border-hairline bg-white text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">
              Buyer Email (optional, leaves unlinked if guest)
            </label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="buyer@students.skylinesos.demo"
              className="w-full h-9 px-3 rounded-lg border border-hairline bg-white text-xs focus:outline-none"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-critical/30 text-critical text-xs font-medium">
          {error}
        </div>
      )}

      {/* Summary & Submit */}
      <div className="pt-3 border-t border-hairline flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-steel">Total Amount</span>
        <span className="text-2xl font-black text-ink-deep">{formatPaise(totalPaise)}</span>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleCheckout}
        className={`w-full h-12 rounded-full font-bold text-sm text-white transition-all shadow-sm flex items-center justify-center gap-2 ${
          payMethod === "online" ? "bg-primary hover:bg-primary-deep" : "bg-ink-deep hover:bg-charcoal"
        }`}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          `Pay ${formatPaise(totalPaise)}`
        )}
      </button>
    </div>
  );
}
