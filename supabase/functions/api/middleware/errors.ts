import type { Request, Response, NextFunction } from "npm:express@4.18.2";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(req: Request, res: Response): void {
  const reqId = (req as any).requestId || "unknown";
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
      requestId: reqId
    }
  });
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = (req as any).requestId || "unknown";
  let status = err.statusCode || 500;
  let code = err.code || "INTERNAL";
  let message = err.message || "An unexpected error occurred";
  let details = err.details;

  // Handle Postgres / RPC exception messages
  if (err.message && typeof err.message === "string") {
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
    ];

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

  // Attempt to parse JSON details from Postgres exception detail if available
  if (err.details && typeof err.details === "string") {
    try {
      details = JSON.parse(err.details);
    } catch {
      // keep raw details
    }
  }

  if (status === 500) {
    console.error(`[${reqId}] INTERNAL ERROR:`, err);
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
