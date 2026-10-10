# SkylineSOS — Frontend API Integration Guide

| Metadata | Details |
|---|---|
| **API Version** | `v1` |
| **Edge Runtime** | Express inside Supabase Edge Function `api` |
| **Target Audience** | Frontend Engineers (Astro / React Islands / Mobile Web) |
| **Companion Specification** | [`docs/api-docs.md`](./api-docs.md) · [`docs/architecture.md`](./architecture.md) |
| **Last Updated** | October 2026 |

---

## 1. Architecture & Protocol Basics

### 1.1 Base URLs

All API routes run inside a single Edge Function named `api`. Supabase Edge Functions require the function name in the URL path, so Express mounts at `/api/v1`, producing the following URLs:

- **Local Development:**
  ```
  http://127.0.0.1:54321/functions/v1/api/v1
  ```
- **Supabase Cloud (Hackathon Project):**
  ```
  https://xwwkpwzartndbjlzpttc.supabase.co/functions/v1/api/v1
  ```

> [!IMPORTANT]
> Always route API calls through your configured environment variable `PUBLIC_API_BASE_URL`. Never hardcode hostnames in components or islands.

### 1.2 Core Data Invariants

1. **Integer Money (Paise):**
   Currency is strictly represented as integer **paise** (`₹1.00 = 100 paise`).
   - ₹500.00 general ticket = `50000`
   - ₹299.00 club t-shirt = `29900`
   - **Never format or send floating-point numbers** (e.g., `500.5` is invalid).
2. **Date Format:**
   All timestamps are ISO 8601 UTC strings (`2026-10-17T13:00:00Z`). Date-only fields use `YYYY-MM-DD`.
3. **Identifiers:**
   All database IDs are UUID v4 strings (e.g. `e0b10000-0000-0000-0000-000000000001`).
4. **Casing Convention:**
   - Frontend JSON requests and API responses use **`camelCase`**.
   - The database internally uses `snake_case`, but handlers convert all fields before returning them to the client.

---

## 2. Standard Envelopes & Error Handling

### 2.1 Success Envelope

Every successful API response is wrapped in a `data` envelope:

```typescript
// Single object response (200 OK or 201 Created)
{
  "data": {
    "id": "c77a...",
    "status": "fulfilled"
  }
}

// List response with optional pagination metadata
{
  "data": [ ... ],
  "meta": {
    "total": 42,
    "nextCursor": "eyJpZCI6..."
  }
}
```

### 2.2 Error Envelope

When a request fails, the API returns a structured error object along with an HTTP error status:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": {
      "issues": [
        { "path": "items.0.quantity", "message": "Expected positive integer" }
      ]
    },
    "requestId": "5c8a2f1b-3e4d-4a11-b22c-882199042a19"
  }
}
```

Every response includes the `X-Request-Id` HTTP header. Always log or display `error.requestId` in UI toast notifications for easy server log tracing.

### 2.3 Comprehensive Error Code Reference

| Status | Error Code | Description / UI Action |
|---|---|---|
| **401** | `UNAUTHENTICATED` | Session missing or expired. Redirect user to `/login`. |
| **401** | `INVALID_SIGNATURE` | Razorpay payment signature verification failed. Prompt user to retry payment. |
| **403** | `FORBIDDEN` | Caller lacks the required role. Redirect to `/403` or show an access denied banner. |
| **404** | `NOT_FOUND` | Resource does not exist or is invisible to the caller. |
| **404** | `CODE_INVALID` | Member pass verification code is wrong or expired (> 60s). Prompt user to refresh card. |
| **404** | `TICKET_NOT_FOUND` | Scanned ticket code does not match any issued ticket. |
| **409** | `CONFLICT` | Generic state conflict. |
| **409** | `CAPACITY_EXCEEDED` | Event or ticket type is sold out. Disable buy button. |
| **409** | `OUT_OF_STOCK` | Merchandise variant has insufficient stock. |
| **409** | `ALREADY_MEMBER` | User already holds an active membership. |
| **409** | `APPLICATION_EXISTS` | User already has a pending application under review. |
| **409** | `CHECKOUT_EXPIRED` | 15-minute checkout reservation expired. Prompt user to start over. |
| **409** | `CHECKOUT_NOT_PENDING` | Checkout was already cancelled or fulfilled. |
| **409** | `TICKET_ALREADY_CHECKED_IN` | Ticket was already checked in. Display `details.checkedInAt` and `details.by` in error modal. |
| **409** | `SELF_APPROVAL_FORBIDDEN` | Submitter cannot approve their own expense reimbursement. |
| **409** | `NO_ACTIVE_MEMBERSHIP` | User has no active membership to issue a door verification code. |
| **422** | `VALIDATION_FAILED` | Input validation failed. Highlight input fields using `details.issues[]`. |
| **422** | `NOTE_REQUIRED` | Staff cash/UPI checkouts require a physical verification note. |
| **429** | `RATE_LIMITED` | Rate limit exceeded. Read `Retry-After` header and display a countdown timer. |
| **502** | `PAYMENT_PROVIDER_ERROR`| Razorpay order creation failed. Display temporary payment downtime alert. |
| **500** | `INTERNAL` | Unexpected edge error. Quote `error.requestId` in bug report. |

---

## 3. Reusable Frontend API Client

Use this clean, typed client in Astro pages, React islands, or Svelte components. It handles:
1. Attaching Supabase Auth JWT access tokens automatically.
2. Generating unique UUID `Idempotency-Key` headers on mutating requests.
3. Parsing and raising typed `ApiError` instances.

```typescript
// src/lib/api.ts
import { supabase } from "./auth";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  json?: unknown;
  idempotent?: boolean;
}

const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || "https://xwwkpwzartndbjlzpttc.supabase.co/functions/v1/api/v1";

export async function api<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { json, idempotent = false, headers = {}, ...customConfig } = options;

  // 1. Retrieve current user session JWT
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotent ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    ...(headers as Record<string, string>)
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...customConfig,
    headers: requestHeaders,
    body: json ? JSON.stringify(json) : customConfig.body
  });

  const requestId = response.headers.get("x-request-id") || undefined;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const err = errorBody?.error;
    throw new ApiError(
      response.status,
      err?.code || "INTERNAL",
      err?.message || `HTTP request failed with status ${response.status}`,
      err?.details,
      err?.requestId || requestId
    );
  }

  const payload = await response.json();
  return payload.data as T;
}
```

---

## 4. Screen-by-Screen Integration Recipes

### 4.1 Digital Student Pass (Live Rotating Door Pass)

```typescript
// Component: MemberCard.tsx
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface CodeResponse {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
}

export function MemberCard() {
  const [pass, setPass] = useState<CodeResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  const fetchPass = async () => {
    try {
      setError(null);
      const res = await api<CodeResponse>("/me/verify-code", { method: "POST" });
      setPass(res);
      setSecondsLeft(res.ttlSeconds);
    } catch (err: any) {
      setError(err.code === "NO_ACTIVE_MEMBERSHIP" ? "No active membership found." : err.message);
    }
  };

  useEffect(() => {
    fetchPass();
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchPass(); // Auto-refresh when countdown hits 0
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="text-red-500 font-bold">{error}</div>;
  if (!pass) return <div>Loading pass...</div>;

  return (
    <div className="rounded-3xl p-6 bg-slate-900 text-white text-center">
      <div className="text-xs uppercase tracking-widest text-slate-400">Door Verification Pass</div>
      <div className="text-5xl font-mono font-bold tracking-widest my-4 text-emerald-400">
        {pass.code}
      </div>
      <div className="text-xs text-slate-400">
        Code expires in <span className="font-bold text-white">{secondsLeft}s</span>
      </div>
    </div>
  );
}
```

---

### 4.2 Online Checkout with Razorpay Modal

The checkout process follows a 2-step verification protocol:
1. `POST /checkout` with `Idempotency-Key`: The server verifies inventory/pricing, checks member discounts, and returns the Razorpay order details.
2. If `totalPaise === 0` (e.g. member-free ticket), the API fulfills immediately (`razorpay: null`).
3. If paid, open `Razorpay(options)` and submit the signature callback to `POST /checkout/:id/verify`.

```typescript
// Component: CheckoutFlow.ts
import { api } from "@/lib/api";

declare const Razorpay: any;

interface CheckoutItemInput {
  type: "ticket" | "merch" | "membership";
  refId: string;
  quantity: number;
}

interface CheckoutResponse {
  checkout: {
    id: string;
    status: string;
    totalPaise: number;
  };
  razorpay: {
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
  } | null;
}

export async function startOnlineCheckout(items: CheckoutItemInput[]) {
  // 1. Create checkout (idempotent intent)
  const res = await api<CheckoutResponse>("/checkout", {
    method: "POST",
    idempotent: true,
    json: { paymentMethod: "online", items }
  });

  // Zero-total free checkouts bypass payment gateway immediately
  if (!res.razorpay) {
    return { success: true, checkoutId: res.checkout.id, free: true };
  }

  // 2. Open Razorpay Checkout modal
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: res.razorpay!.keyId,
      amount: res.razorpay!.amountPaise,
      currency: res.razorpay!.currency,
      name: "Skyline Student Association",
      order_id: res.razorpay!.orderId,
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          // 3. Verify Razorpay cryptographic signature on backend
          const verifyRes = await api<{ status: string; tickets?: any[] }>(
            `/checkout/${res.checkout.id}/verify`,
            {
              method: "POST",
              json: {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature
              }
            }
          );
          resolve({ success: true, checkoutId: res.checkout.id, tickets: verifyRes.tickets });
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled by user"))
      }
    });

    rzp.open();
  });
}
```

---

### 4.3 High-Speed Door & Gate Console

The door console supports both:
1. **6-Digit Member Codes** (issued by `/me/verify-code`).
2. **8-Character Crockford Ticket Codes** (e.g. `SKY-7K3M-92QH`).
The input automatically normalizes lowercase letters, removes spaces and dashes, and maps `O→0` and `I/L→1`.

```typescript
// Component: DoorConsole.tsx
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export function DoorConsole({ eventId }: { eventId: string }) {
  const [inputCode, setInputCode] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleScanOrSubmit = async () => {
    const cleaned = inputCode.trim();
    if (!cleaned) return;

    try {
      if (/^\d{6}$/.test(cleaned)) {
        // Mode A: 6-Digit Member Pass Verification
        const res = await api<any>("/staff/verify/member", {
          method: "POST",
          json: { code: cleaned }
        });
        setResult({ type: "MEMBER_VERIFIED", data: res });
      } else {
        // Mode B: Ticket Check-In
        const res = await api<any>("/door/check-in", {
          method: "POST",
          json: { eventId, code: cleaned }
        });
        setResult({ type: "TICKET_CHECKED_IN", data: res });
      }
      setInputCode("");
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "TICKET_ALREADY_CHECKED_IN") {
        setResult({
          type: "ALREADY_CHECKED_IN",
          message: err.message,
          checkedInAt: err.details?.checkedInAt
        });
      } else {
        setResult({ type: "ERROR", message: err.message });
      }
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <input
        type="text"
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleScanOrSubmit()}
        placeholder="Scan barcode or enter code..."
        className="w-full text-2xl font-mono p-4 border rounded-2xl"
      />
      <button onClick={handleScanOrSubmit} className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold">
        Check In / Verify
      </button>

      {result && (
        <div className="mt-6 p-4 rounded-2xl border">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

---

### 4.4 Staff Desk Checkouts (Cash & Manual UPI)

Staff members (Admin, Treasurer, Door) can record in-person cash or UPI sales directly into the immutable ledger:

```typescript
// Component: StaffCashCheckout.ts
import { api } from "@/lib/api";

export async function recordStaffDeskSale(payload: {
  buyerEmail?: string;
  isGuest?: boolean;
  holderName?: string;
  paymentMethod: "cash" | "manual_upi";
  note: string;
  items: Array<{ type: "ticket" | "merch"; refId: string; quantity: number }>;
}) {
  return await api("/staff/checkout", {
    method: "POST",
    idempotent: true,
    json: {
      buyer: payload.isGuest ? { guest: true } : { email: payload.buyerEmail },
      holderName: payload.holderName,
      paymentMethod: payload.paymentMethod,
      note: payload.note, // Required: e.g. "Received ₹600 cash at door desk"
      items: payload.items
    }
  });
}
```

---

### 4.5 Treasurer Financial Overview & Ledger

```typescript
// Component: TreasurerOverview.tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function TreasurerOverview() {
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    api("/treasurer/overview").then(setOverview);
  }, []);

  if (!overview) return <div>Loading treasury records...</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="p-6 bg-white rounded-3xl border shadow-sm">
        <div className="text-xs uppercase text-slate-500 font-bold">Total Inflow (In)</div>
        <div className="text-3xl font-black text-emerald-600 mt-2">
          ₹{(overview.inPaise / 100).toFixed(2)}
        </div>
      </div>
      <div className="p-6 bg-white rounded-3xl border shadow-sm">
        <div className="text-xs uppercase text-slate-500 font-bold">Total Outflow (Out)</div>
        <div className="text-3xl font-black text-rose-600 mt-2">
          ₹{(overview.outPaise / 100).toFixed(2)}
        </div>
      </div>
      <div className="p-6 bg-slate-50 rounded-3xl border shadow-sm">
        <div className="text-xs uppercase text-slate-500 font-bold">Recorded Net Movement</div>
        <div className="text-3xl font-black text-slate-900 mt-2">
          ₹{(overview.netPaise / 100).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
```

---

### 4.6 Action Queue (Staff Tasks & High-Priority Alerts)

The action queue surfaces actionable items based on the caller's role:

```typescript
// Component: ActionQueue.tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ActionItem {
  rule: string;
  title: string;
  reason: string;
  nextAction: string;
  priority: "high" | "medium" | "low";
  link: string;
}

export function ActionQueue() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => {
    api<ActionItem[]>("/actions").then(setActions);
  }, []);

  return (
    <div className="space-y-3">
      {actions.map((act, i) => (
        <a
          key={i}
          href={act.link}
          className="flex items-center justify-between p-4 bg-white rounded-2xl border hover:border-blue-500 transition-colors shadow-xs"
        >
          <div>
            <div className="font-bold text-slate-900">{act.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{act.reason}</div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            act.priority === "high" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
          }`}>
            {act.nextAction}
          </span>
        </a>
      ))}
    </div>
  );
}
```

---

## 5. Rate Limit Policies & UI Throttling

To prevent abuse, the backend enforces PostgreSQL-backed rate limits:

| Endpoint | Quota | UI Handling |
|---|---|---|
| `POST /staff/verify/member`<br>`POST /door/check-in`<br>`GET /door/tickets` | 10 req/min per staff user | On `429`, read `Retry-After` header and disable scan button for duration. |
| `POST /me/verify-code` | 6 req/min per user | Disable "Regenerate Pass" button for 10 seconds between clicks. |
| `POST /checkout`<br>`POST /staff/checkout` | 20 req/min per user | Disable "Submit Order" button immediately upon click. |
| All other endpoints | 120 req/min per user | General app navigation. |

---

## 6. Demo Accounts & Role Switcher

For judging and testing, use these pre-seeded demo accounts in local development:

| Role | Email | Password | Primary Feature to Test |
|---|---|---|---|
| **Admin** | `admin@skylinesos.demo` | `demo1234` | Full Command Center, User Roles, Walk-Up Desk, Tiers, Announcements |
| **Treasurer** | `treasurer@skylinesos.demo` | `demo1234` | Immutable Ledger, Financial Overview, Expense Status Changes |
| **Door Staff** | `door@skylinesos.demo` | `demo1234` | Gate Console, 60s Pass Verification, Crockford Ticket Check-Ins |
| **Volunteer** | `volunteer@skylinesos.demo` | `demo1234` | Merch Fulfilment (`packed` → `handed_over`), Task Progress |
| **Member** | `member@skylinesos.demo` | `demo1234` | Digital Pass (`/me/verify-code`), Discounted Tickets, My Orders |

---

## 7. Automated Test Verification

Frontend developers can run the backend regression suite locally to ensure backend contracts and endpoints match expectations:

```bash
npm test
```

This runs 57 tests across 16 suites:
- Crypto HMAC-SHA256 signature verifications.
- Crockford Crockford base32 ticket normalization logic.
- HTTP error envelope status mappings.
- Role-based authorization matrix.
- Shared `@skylinesos/contracts` Zod validation.
- All 10 functional route groups.
