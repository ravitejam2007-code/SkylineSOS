import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Mock Express Request and Response factories
function createMockReq(options = {}) {
  const headers = {};
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers[k.toLowerCase()] = v;
    }
  }
  return {
    headers,
    header(name) {
      return headers[name.toLowerCase()];
    },
    get(name) {
      return headers[name.toLowerCase()];
    },
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    method: options.method || "GET",
    path: options.path || "/",
    ip: options.ip || "127.0.0.1",
    user: options.user
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      res.headers[name.toLowerCase()] = val;
      return res;
    },
    getHeader(name) {
      return res.headers[name.toLowerCase()];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    send(data) {
      res.body = data;
      return res;
    }
  };
  return res;
}

// 1. ApiError definition
class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }
}

// 2. RequestId Middleware implementation
function requestIdMiddleware(req, res, next) {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

// 3. RBAC Middleware implementation
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    }
    if (!allowedRoles.includes(user.role)) {
      return next(
        new ApiError(403, "FORBIDDEN", `Role '${user.role}' is not authorized to access this resource`)
      );
    }
    next();
  };
}

// 4. Validate Middleware implementation
function validateMiddleware(schema, source = "body") {
  return (req, _res, next) => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const issues = result.error.issues.map((iss) => ({
        path: iss.path.join("."),
        message: iss.message
      }));
      return next(
        new ApiError(422, "VALIDATION_FAILED", "Request validation failed", { issues })
      );
    }
    req[source] = result.data;
    next();
  };
}

// 5. RateLimit Middleware implementation
function createRateLimitMiddleware(rpcMock, keyPrefix, limit, windowSec = 60) {
  return async (req, res, next) => {
    const userId = req.user?.id || req.ip || "anon";
    const key = `${keyPrefix}:${userId}`;
    try {
      const allowed = await rpcMock(key, limit, windowSec);
      if (allowed === false) {
        res.setHeader("Retry-After", windowSec.toString());
        return next(
          new ApiError(429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${windowSec} seconds.`)
        );
      }
      next();
    } catch (err) {
      next();
    }
  };
}

// 6. Error & NotFound Handlers
function notFoundHandler(req, res) {
  const reqId = req.requestId || "unknown";
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
      requestId: reqId
    }
  });
}

function errorHandler(err, req, res, _next) {
  const reqId = req.requestId || "unknown";
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

  if (err.message && typeof err.message === "string") {
    for (const kc of knownCodes) {
      if (err.message.includes(kc)) {
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
  }

  if (status === 500) {
    message = "An unexpected internal error occurred";
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: reqId
    }
  });
}

// ========================
// Test Suites
// ========================

describe("Middleware: Request ID Tracing", () => {
  it("should generate a UUID v4 when no x-request-id is provided", () => {
    const req = createMockReq();
    const res = createMockRes();
    let calledNext = false;

    requestIdMiddleware(req, res, () => {
      calledNext = true;
    });

    assert.equal(calledNext, true);
    assert.ok(req.requestId, "req.requestId should be defined");
    assert.match(req.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(res.getHeader("x-request-id"), req.requestId);
  });

  it("should preserve existing incoming x-request-id header", () => {
    const customId = "client-req-abc-12345";
    const req = createMockReq({ headers: { "X-Request-Id": customId } });
    const res = createMockRes();

    requestIdMiddleware(req, res, () => {});

    assert.equal(req.requestId, customId);
    assert.equal(res.getHeader("x-request-id"), customId);
  });
});

describe("Middleware: RBAC & Role Enforcement", () => {
  it("should block unauthenticated requests with 401 UNAUTHENTICATED", () => {
    const req = createMockReq({ user: null });
    const res = createMockRes();
    let capturedErr = null;

    requireRole("admin")(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr instanceof ApiError);
    assert.equal(capturedErr.statusCode, 401);
    assert.equal(capturedErr.code, "UNAUTHENTICATED");
  });

  it("should block unauthorized role with 403 FORBIDDEN", () => {
    const req = createMockReq({ user: { id: "u1", role: "member" } });
    const res = createMockRes();
    let capturedErr = null;

    requireRole("admin", "treasurer")(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr instanceof ApiError);
    assert.equal(capturedErr.statusCode, 403);
    assert.equal(capturedErr.code, "FORBIDDEN");
    assert.match(capturedErr.message, /member/);
  });

  it("should permit user matching one of multiple allowed roles", () => {
    const req = createMockReq({ user: { id: "u2", role: "door" } });
    const res = createMockRes();
    let calledNext = false;

    requireRole("admin", "door")(req, res, (err) => {
      assert.equal(err, undefined);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });
});

describe("Middleware: Zod Validation", () => {
  const TestSchema = z.object({
    email: z.string().email(),
    quantity: z.number().int().positive()
  });

  it("should successfully pass valid data to req.body", () => {
    const req = createMockReq({
      body: { email: "student@skylinesos.demo", quantity: 3 }
    });
    const res = createMockRes();
    let calledNext = false;

    validateMiddleware(TestSchema)(req, res, (err) => {
      assert.equal(err, undefined);
      calledNext = true;
    });

    assert.equal(calledNext, true);
    assert.equal(req.body.email, "student@skylinesos.demo");
    assert.equal(req.body.quantity, 3);
  });

  it("should return 422 VALIDATION_FAILED with formatted issues list on invalid input", () => {
    const req = createMockReq({
      body: { email: "not-an-email", quantity: -5 }
    });
    const res = createMockRes();
    let capturedErr = null;

    validateMiddleware(TestSchema)(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr instanceof ApiError);
    assert.equal(capturedErr.statusCode, 422);
    assert.equal(capturedErr.code, "VALIDATION_FAILED");
    assert.ok(Array.isArray(capturedErr.details.issues));
    assert.equal(capturedErr.details.issues.length, 2);
    assert.equal(capturedErr.details.issues[0].path, "email");
    assert.equal(capturedErr.details.issues[1].path, "quantity");
  });
});

describe("Middleware: Database-Backed Rate Limiting", () => {
  it("should pass when under the rate limit", async () => {
    const rpcMock = async () => true;
    const middleware = createRateLimitMiddleware(rpcMock, "test_prefix", 10, 60);
    const req = createMockReq({ user: { id: "u-123" } });
    const res = createMockRes();
    let calledNext = false;

    await middleware(req, res, (err) => {
      assert.equal(err, undefined);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });

  it("should return 429 RATE_LIMITED with Retry-After header when rate limit is exceeded", async () => {
    const rpcMock = async () => false;
    const middleware = createRateLimitMiddleware(rpcMock, "test_prefix", 10, 60);
    const req = createMockReq({ user: { id: "u-123" } });
    const res = createMockRes();
    let capturedErr = null;

    await middleware(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr instanceof ApiError);
    assert.equal(capturedErr.statusCode, 429);
    assert.equal(capturedErr.code, "RATE_LIMITED");
    assert.equal(res.getHeader("retry-after"), "60");
  });
});

describe("Middleware: 404 NotFound & Global Error Envelope", () => {
  it("should format 404 NOT_FOUND envelope with requestId", () => {
    const req = createMockReq({ method: "POST", path: "/unknown-endpoint" });
    req.requestId = "req-xyz-789";
    const res = createMockRes();

    notFoundHandler(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
    assert.equal(res.body.error.message, "Cannot POST /unknown-endpoint");
    assert.equal(res.body.error.requestId, "req-xyz-789");
  });

  it("should format ApiError with code, message, and details", () => {
    const req = createMockReq();
    req.requestId = "req-err-111";
    const res = createMockRes();
    const err = new ApiError(409, "OUT_OF_STOCK", "Product variant out of stock", { variantId: "v1" });

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, "OUT_OF_STOCK");
    assert.equal(res.body.error.message, "Product variant out of stock");
    assert.equal(res.body.error.details.variantId, "v1");
    assert.equal(res.body.error.requestId, "req-err-111");
  });

  it("should map Postgres specific error strings without masking", () => {
    const req = createMockReq();
    req.requestId = "req-err-222";
    const res = createMockRes();
    const err = new Error("TICKET_NOT_FOUND: no ticket matches code SKY-0000-0000");

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, "TICKET_NOT_FOUND");
  });

  it("should obscure internal server errors to prevent leaking stack traces", () => {
    const req = createMockReq();
    req.requestId = "req-err-333";
    const res = createMockRes();
    const err = new Error("FATAL: Database connection timeout at 10.0.0.1:5432");

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.code, "INTERNAL");
    assert.equal(res.body.error.message, "An unexpected internal error occurred");
    assert.equal(res.body.error.requestId, "req-err-333");
  });
});
