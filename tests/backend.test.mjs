import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// --- 1. HMAC-SHA256 Constant-Time Verification Tests ---
async function computeHmacHex(message, secret) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

describe("Backend Crypto: Razorpay & Webhook HMAC Verification", () => {
  const secret = "test_rzp_secret_key_123456";
  const orderId = "order_Nxxxx123";
  const paymentId = "pay_Nyyyy456";
  const payload = `${orderId}|${paymentId}`;

  it("should successfully verify valid payment signatures", async () => {
    const validSignature = await computeHmacHex(payload, secret);
    const isValid = timingSafeEqualHex(validSignature, await computeHmacHex(payload, secret));
    assert.equal(isValid, true, "Signature verification should pass for exact secret and payload");
  });

  it("should reject tampered payment signatures", async () => {
    const validSignature = await computeHmacHex(payload, secret);
    const tamperedSig = validSignature.slice(0, -2) + "ff";
    const isValid = timingSafeEqualHex(tamperedSig, await computeHmacHex(payload, secret));
    assert.equal(isValid, false, "Tampered signature should fail verification");
  });

  it("should reject signatures signed with wrong secret", async () => {
    const wrongSignature = await computeHmacHex(payload, "wrong_secret");
    const isValid = timingSafeEqualHex(wrongSignature, await computeHmacHex(payload, secret));
    assert.equal(isValid, false, "Signature with wrong secret should fail verification");
  });

  it("should verify raw webhook payloads", async () => {
    const webhookBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 30000 } } }
    });
    const webhookSig = await computeHmacHex(webhookBody, secret);
    const expected = await computeHmacHex(webhookBody, secret);
    assert.equal(timingSafeEqualHex(webhookSig, expected), true);
  });
});

// --- 2. Ticket Code Normalization Tests ---
function normalizeTicketCode(input) {
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

describe("Door Check-In: Ticket Code Normalization", () => {
  it("should format standard dashed code correctly", () => {
    assert.equal(normalizeTicketCode("SKY-7K3M-92QH"), "SKY-7K3M-92QH");
  });

  it("should normalize lowercase and spaces", () => {
    assert.equal(normalizeTicketCode("sky 7k3m 92qh"), "SKY-7K3M-92QH");
  });

  it("should normalize O to 0 and I/L to 1", () => {
    // 7KOM-9ILH -> 7K0M-911H
    assert.equal(normalizeTicketCode("7kom9ilh"), "SKY-7K0M-911H");
  });

  it("should handle raw 8-character codes without SKY prefix", () => {
    assert.equal(normalizeTicketCode("abcd1234"), "SKY-ABCD-1234");
  });
});

// --- 3. Error Envelope & Status Code Mapping Tests ---
function mapError(err, requestId = "req-12345") {
  let status = err.statusCode || 500;
  let code = err.code || "INTERNAL";
  let message = err.message || "An unexpected error occurred";
  let details = err.details;

  const knownCodes = [
    "BAD_REQUEST",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "CAPACITY_EXCEEDED",
    "OUT_OF_STOCK",
    "ALREADY_MEMBER",
    "APPLICATION_EXISTS",
    "APPLICATION_NOT_APPROVED",
    "CHECKOUT_EXPIRED",
    "CHECKOUT_NOT_PENDING",
    "TICKET_ALREADY_CHECKED_IN",
    "WRONG_EVENT",
    "TICKET_CANCELLED",
    "TICKET_NOT_FOUND",
    "CODE_INVALID",
    "NO_ACTIVE_MEMBERSHIP",
    "SELF_APPROVAL_FORBIDDEN",
    "MEMBER_ONLY",
    "VALIDATION_FAILED",
    "NOTE_REQUIRED",
    "INVALID_SIGNATURE",
    "RATE_LIMITED",
    "PAYMENT_PROVIDER_ERROR"
  ].sort((a, b) => b.length - a.length);

  for (const kc of knownCodes) {
    if (err.message && err.message.includes(kc)) {
      code = kc;
      if (kc === "UNAUTHENTICATED") status = 401;
      else if (kc === "FORBIDDEN") status = 403;
      else if (kc === "NOT_FOUND" || kc === "TICKET_NOT_FOUND" || kc === "CODE_INVALID") status = 404;
      else if (kc === "VALIDATION_FAILED" || kc === "NOTE_REQUIRED") status = 422;
      else if (kc === "RATE_LIMITED") status = 429;
      else status = 409;
      break;
    }
  }

  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        requestId
      }
    }
  };
}

describe("Error Envelope: Specification Compliance", () => {
  it("should map UNAUTHENTICATED to 401", () => {
    const res = mapError(new Error("UNAUTHENTICATED: missing access token"));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHENTICATED");
    assert.ok(res.body.error.requestId);
  });

  it("should map FORBIDDEN to 403", () => {
    const res = mapError(new Error("FORBIDDEN: required role admin"));
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  it("should map CODE_INVALID and TICKET_NOT_FOUND to 404", () => {
    const res1 = mapError(new Error("CODE_INVALID: code expired"));
    assert.equal(res1.status, 404);
    assert.equal(res1.body.error.code, "CODE_INVALID");

    const res2 = mapError(new Error("TICKET_NOT_FOUND: no ticket"));
    assert.equal(res2.status, 404);
    assert.equal(res2.body.error.code, "TICKET_NOT_FOUND");
  });

  it("should map VALIDATION_FAILED and NOTE_REQUIRED to 422", () => {
    const res1 = mapError(new Error("VALIDATION_FAILED: invalid email"));
    assert.equal(res1.status, 422);
    assert.equal(res1.body.error.code, "VALIDATION_FAILED");

    const res2 = mapError(new Error("NOTE_REQUIRED: verification note required"));
    assert.equal(res2.status, 422);
    assert.equal(res2.body.error.code, "NOTE_REQUIRED");
  });

  it("should map RATE_LIMITED to 429", () => {
    const res = mapError(new Error("RATE_LIMITED: too many requests"));
    assert.equal(res.status, 429);
    assert.equal(res.body.error.code, "RATE_LIMITED");
  });

  it("should map CAPACITY_EXCEEDED and TICKET_ALREADY_CHECKED_IN to 409", () => {
    const res1 = mapError(new Error("CAPACITY_EXCEEDED: sold out"));
    assert.equal(res1.status, 409);
    assert.equal(res1.body.error.code, "CAPACITY_EXCEEDED");

    const res2 = mapError(new Error("TICKET_ALREADY_CHECKED_IN: checked in"));
    assert.equal(res2.status, 409);
    assert.equal(res2.body.error.code, "TICKET_ALREADY_CHECKED_IN");
  });
});

// --- 4. Role Authorization Matrix Tests ---
function checkRoleAccess(userRole, allowedRoles) {
  if (!userRole) return false;
  if (userRole === "admin") return true; // admin can access all staff routes
  return allowedRoles.includes(userRole);
}

describe("RBAC: Role Authorization Matrix", () => {
  it("should allow admin on all role-restricted routes", () => {
    assert.equal(checkRoleAccess("admin", ["treasurer"]), true);
    assert.equal(checkRoleAccess("admin", ["door"]), true);
    assert.equal(checkRoleAccess("admin", ["volunteer"]), true);
  });

  it("should permit treasurer only on treasurer routes", () => {
    assert.equal(checkRoleAccess("treasurer", ["treasurer"]), true);
    assert.equal(checkRoleAccess("treasurer", ["door"]), false);
  });

  it("should block ordinary member from staff routes", () => {
    assert.equal(checkRoleAccess("member", ["admin"]), false);
    assert.equal(checkRoleAccess("member", ["door"]), false);
    assert.equal(checkRoleAccess("member", ["treasurer"]), false);
    assert.equal(checkRoleAccess("member", ["volunteer"]), false);
  });
});

// --- 5. Shared Contracts Zod Validation Tests ---
import {
  CreateApplicationSchema,
  CreateCheckoutSchema,
  CreateExpenseSchema,
  CreateAnnouncementSchema
} from "../packages/contracts/dist/index.js";

describe("Contracts: Zod Schemas Validation", () => {
  it("should validate valid membership application", () => {
    const valid = {
      tierId: "90000000-0000-0000-0000-000000000001",
      answers: { branch: "CSE", year: 2 }
    };
    const res = CreateApplicationSchema.safeParse(valid);
    assert.equal(res.success, true);
  });

  it("should reject membership application with invalid tierId UUID", () => {
    const invalid = {
      tierId: "not-a-uuid",
      answers: {}
    };
    const res = CreateApplicationSchema.safeParse(invalid);
    assert.equal(res.success, false);
  });

  it("should validate valid checkout request", () => {
    const valid = {
      items: [
        {
          itemType: "ticket",
          refId: "30000000-0000-0000-0000-000000000001",
          quantity: 2
        }
      ]
    };
    const res = CreateCheckoutSchema.safeParse(valid);
    assert.equal(res.success, true);
  });

  it("should reject checkout request with zero or negative quantity", () => {
    const invalid = {
      items: [
        {
          itemType: "ticket",
          refId: "30000000-0000-0000-0000-000000000001",
          quantity: 0
        }
      ]
    };
    const res = CreateCheckoutSchema.safeParse(invalid);
    assert.equal(res.success, false);
  });

  it("should validate expense submission", () => {
    const valid = {
      amountPaise: 50000,
      category: "Operations",
      description: "Logistics equipment rental"
    };
    const res = CreateExpenseSchema.safeParse(valid);
    assert.equal(res.success, true);
  });

  it("should reject expense with non-positive amount", () => {
    const invalid = {
      amountPaise: -100,
      category: "Operations",
      description: "Invalid expense"
    };
    const res = CreateExpenseSchema.safeParse(invalid);
    assert.equal(res.success, false);
  });

  it("should validate announcement draft creation", () => {
    const valid = {
      title: "Annual Hackathon Gala",
      body: "Welcome to SkylineSOS 2026!",
      audience: "public"
    };
    const res = CreateAnnouncementSchema.safeParse(valid);
    assert.equal(res.success, true);
  });
});

