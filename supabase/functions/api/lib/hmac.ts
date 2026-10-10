/**
 * Constant-time comparison between two hex strings to mitigate timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Compute HMAC-SHA256 hex digest using Web Crypto API.
 */
export async function computeHmacSha256(secret: string, message: string | Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = typeof message === "string" ? enc.encode(message) : message;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData as any);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify Razorpay payment signature: HMAC(order_id + "|" + payment_id, secret) == signature
 */
export async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const payload = `${orderId}|${paymentId}`;
  const computed = await computeHmacSha256(secret, payload);
  return timingSafeEqual(computed, signature);
}

/**
 * Verify Razorpay webhook signature over raw payload bytes.
 */
export async function verifyWebhookSignature(
  rawBody: Uint8Array | string,
  signature: string,
  secret: string
): Promise<boolean> {
  const computed = await computeHmacSha256(secret, rawBody);
  return timingSafeEqual(computed, signature);
}
