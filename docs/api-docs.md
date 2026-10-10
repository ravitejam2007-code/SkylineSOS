# SkylineSOS — API Documentation

| | |
|---|---|
| **API version** | `v1` |
| **Date** | 10 October 2026 |
| **Runtime** | Express inside Supabase Edge Function `api` ([Architecture](./architecture.md)) |
| **Contract rule** | This file is the contract between frontend and backend. Change it **in the same PR** as the code. |

---

## 1. Basics

| Item | Value |
|---|---|
| **Base URL** | `https://<project-ref>.supabase.co/functions/v1/api/v1` |
| **Local** | `http://127.0.0.1:54321/functions/v1/api/v1` (`supabase functions serve api --env-file supabase/.env.local`) |
| **Format** | JSON, UTF-8, `Content-Type: application/json` |
| **Field naming** | `camelCase` in JSON; `snake_case` in the database (handlers map between them) |
| **Money** | Integer **paise** (`amountPaise: 30000` = ₹300.00). Never floats |
| **Dates** | ISO 8601 UTC (`2026-10-17T13:00:00Z`); date-only fields `YYYY-MM-DD` |
| **IDs** | UUID v4 |

> **Why the odd path?** Edge Function routing requires every route to start with the function name, so Express mounts at `/api/v1` and the public URL becomes `/functions/v1/api/v1/…`.

### 1.1 Authentication

1. The web app signs in with Supabase Auth (`signInWithPassword`) and receives a JWT.
2. Send it on every non-public request: `Authorization: Bearer <access_token>`.
3. The API verifies the token with Supabase Auth, loads the user's role from `user_roles` and attaches it to the request.

Roles: `admin`, `treasurer`, `door`, `volunteer`, `member`. A signed-in user without a special role is `member`.

> **Auth configuration for the hackathon.** In Supabase → Authentication: turn **off** "Confirm email" (no email provider is configured) and note that Supabase's built-in email service only reaches project-team addresses and is rate-limited, so **password-reset emails are unreliable for ordinary users**. Treat `/forgot-password` as P1; admins can reset a demo password from the Supabase dashboard.

### 1.2 Response envelope

```json
// success
{ "data": { … }, "meta": { "nextCursor": "eyJ…", "total": 123 } }

// failure
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details": { … }, "requestId": "5c8a2f…" } }
```

`meta` appears only on list endpoints. Every response carries `x-request-id`.

### 1.3 Pagination

`GET` list endpoints accept `?limit=` (default 20, max 50) and `?cursor=` (opaque, from `meta.nextCursor`). Ordering is stable (newest first unless stated).

### 1.4 Idempotency

Endpoints marked **🔁** require `Idempotency-Key: <uuid>`. The client generates one UUID per user intent (per click of "Pay"), reuses it on network retries and creates a new one for a new attempt. Replays return the original result with `200`.

### 1.5 Rate limits (database-backed)

| Route group | Limit | On exceed |
|---|---|---|
| `POST /staff/verify/member`, `POST /door/check-in`, `GET /door/tickets` | 10 / min / staff user; 5 consecutive failures → 60 s lockout | `429 RATE_LIMITED` + `Retry-After` |
| `POST /me/verify-code` | 6 / min / user | `429` |
| `POST /checkout`, `POST /staff/checkout` | 20 / min / user | `429` |
| Everything else | 120 / min / user | `429` |

### 1.6 CORS

Only the exact `APP_ORIGIN`. Allowed headers: `Authorization, Content-Type, Idempotency-Key`. Preflight cached 10 minutes.

## 2. Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON / missing header (e.g. `Idempotency-Key`) |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN` | Role not allowed |
| 404 | `NOT_FOUND` | Resource does not exist (or is not visible to you) |
| 409 | `CONFLICT` | Generic state conflict |
| 409 | `CAPACITY_EXCEEDED` | Not enough tickets left |
| 409 | `OUT_OF_STOCK` | Not enough stock |
| 409 | `ALREADY_MEMBER` | Active membership with ≥ 30 days left |
| 409 | `APPLICATION_EXISTS` | An open application already exists |
| 409 | `APPLICATION_NOT_APPROVED` | Dues can't be paid yet |
| 409 | `CHECKOUT_EXPIRED` | Reservation expired |
| 409 | `CHECKOUT_NOT_PENDING` | Wrong checkout state |
| 409 | `TICKET_ALREADY_CHECKED_IN` | `details.checkedInAt`, `details.by` |
| 409 | `WRONG_EVENT` | Ticket belongs to another event |
| 409 | `TICKET_CANCELLED` | — |
| 404 | `TICKET_NOT_FOUND` | Code does not match any ticket |
| 404 | `CODE_INVALID` | Member code unknown or expired (deliberately generic) |
| 409 | `NO_ACTIVE_MEMBERSHIP` | Cannot issue a member code |
| 409 | `SELF_APPROVAL_FORBIDDEN` | Submitter cannot approve own expense |
| 409 | `MEMBER_ONLY` | Ticket requires membership |
| 422 | `VALIDATION_FAILED` | Zod error list in `details.issues[]` |
| 422 | `NOTE_REQUIRED` | Cash/UPI entries need a note |
| 401 | `INVALID_SIGNATURE` | Razorpay signature mismatch |
| 429 | `RATE_LIMITED` | See §1.5 |
| 502 | `PAYMENT_PROVIDER_ERROR` | Razorpay order creation failed |
| 500 | `INTERNAL` | Unexpected; quote `requestId` |

## 3. Endpoint index

Legend — **Auth:** 🌐 public · 👤 any signed-in · role letters: **A** admin, **T** treasurer, **D** door, **V** volunteer, **M** member. 🔁 needs `Idempotency-Key`.

### 3.1 System and profile

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | 🌐 | `{ ok, version, time }` |
| `GET /me` | 👤 | Profile + role |
| `PATCH /me` | 👤 | Update `fullName`, `studentId` |
| `GET /me/notifications` | 👤 | In-app notifications |
| `POST /me/notifications/:id/read` | 👤 | Mark read |
| `GET /me/preferences` | 👤 | Mailing preferences |
| `PUT /me/preferences` | 👤 | Replace preferences |

### 3.2 Public content

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /public/events` | 🌐 | Published events (`?when=upcoming|past`) |
| `GET /public/events/:slug` | 🌐 | Event + ticket types + availability |
| `GET /public/tiers` | 🌐 | Active membership tiers |
| `GET /public/merch` | 🌐 | Active products with variants and availability |
| `GET /public/merch/:id` | 🌐 | One product |
| `GET /announcements` | 🌐/👤 | Published feed filtered by caller's audience (visitor: `public`; member: `public,members`; staff roles add `staff`) |

### 3.3 Membership

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /membership/applications` | 👤 | Create and submit an application |
| `PUT /membership/applications/:id` | owner | Edit **rejected** application and resubmit (revision + 1) |
| `GET /me/membership` | 👤 | Active membership or `null` |
| `GET /me/membership/applications` | 👤 | My applications with review history |
| `GET /me/membership/history` | 👤 | Past membership periods |
| `POST /me/verify-code` | M with active membership | Issue/rotate my 60-second member code |
| `GET /admin/membership/applications` | A | Queue (`?status=pending`) |
| `POST /admin/membership/applications/:id/review` | A | Approve / reject |
| `POST /admin/members/walk-up` 🔁 | A, D | Create/find account + application + (optional) staff-recorded dues |
| `GET /admin/tiers`, `POST /admin/tiers`, `PATCH /admin/tiers/:id` | A | Tier CRUD |

### 3.4 Identity verification and door

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /staff/verify/member` | A, T, D | Verify a member by 6-digit code |
| `GET /staff/members?q=` | A, T, D | Search by name / email / student ID (minimal fields; admin gets more) |
| `GET /door/tickets?eventId=&q=` | A, D | Find tickets by buyer name/email |
| `POST /door/check-in` | A, D | Check in a ticket by code |

### 3.5 Events and tickets

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /admin/events`, `POST /admin/events` | A | List / create |
| `PATCH /admin/events/:id` | A | Edit, publish, cancel |
| `POST /admin/events/:id/ticket-types` | A | Add ticket type |
| `PATCH /admin/ticket-types/:id` | A | Edit ticket type |
| `GET /admin/events/:id/summary` | A, T, D | Sold / capacity / checked-in / revenue by method |
| `GET /me/tickets` | 👤 | My tickets with codes |

### 3.6 Checkout and payments

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /checkout` 🔁 | 👤 | Create online checkout + Razorpay order |
| `GET /checkout/:id` | owner, A, T | Checkout detail |
| `POST /checkout/:id/verify` | owner | Verify Razorpay callback and fulfil |
| `POST /checkout/:id/cancel` | owner | Cancel a pending checkout (releases reservation) |
| `POST /staff/checkout` 🔁 | A, T (any item); D (tickets only) | Staff-recorded **cash / manual UPI** checkout, fulfilled immediately |
| `POST /webhooks/razorpay` | 🌐 (signature) | Razorpay webhook |
| `GET /me/orders` | 👤 | My dues/tickets/merch orders |

### 3.7 Announcements

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /admin/announcements` | A | All statuses |
| `POST /admin/announcements` | A | Create draft |
| `PATCH /admin/announcements/:id` | A | Edit |
| `POST /admin/announcements/:id/publish` | A | Publish |
| `POST /admin/announcements/:id/archive` | A | Archive |

### 3.8 Merchandise

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/:id` | A | Product CRUD |
| `POST /admin/products/:id/variants` | A | Add variant |
| `PATCH /admin/variants/:id` | A | Edit price / adjust stock (`reason` required, audited) |
| `GET /admin/orders` | A, V | Merch order lines |
| `PATCH /admin/orders/:itemId/fulfilment` | A, V | `pending → packed → handed_over` |

### 3.9 Fundraising

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /fundraisers` | 👤 | List with progress |
| `POST /fundraisers` | A | Create |
| `GET /fundraisers/:id/progress` | A, T, V | Goal, raised, task counts |
| `GET /tasks?fundraiserId=&assignee=me` | A, V | List tasks |
| `POST /tasks` | A | Create |
| `PATCH /tasks/:id` | A (any field); V (status of assigned tasks only) | Update |
| `POST /fundraisers/:id/contributions` 🔁 | A, T, V | Record cash / UPI income |

### 3.10 Treasurer and platform

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /treasurer/overview?from=&to=` | A, T | In / out / net + breakdowns |
| `GET /treasurer/ledger` | A, T | Source-linked entries |
| `POST /expenses` | A, T, D, V | Submit expense |
| `GET /expenses` | A, T (all); others (own) | List |
| `POST /expenses/:id/status` | A, T | `approve` / `reject` / `mark-paid` |
| `GET /audit` | A (all); T (financial) | Audit log |
| `GET /actions` | A, T, V | Action queue (role-filtered) |
| `GET /admin/overview` | A | Counts for the admin home |
| `GET /admin/users?q=` | A | Search users |
| `PATCH /admin/users/:id/role` | A | Grant role (audited) |

## 4. Endpoint details

### 4.1 `GET /me`

```json
{ "data": { "id": "6c1e…", "fullName": "Demo Member", "email": "member@skylinesos.demo", "studentId": "4GT23AI005", "role": "member", "isDemo": true } }
```

### 4.2 `POST /membership/applications`

Request
```json
{ "tierId": "b2f0…", "answers": { "branch": "AI&ML", "year": 2, "why_join": "Interested in events" } }
```
Response `201`
```json
{ "data": { "id": "a41c…", "status": "pending", "revision": 1, "tierId": "b2f0…", "submittedAt": "2026-10-10T09:21:00Z" } }
```
Errors: `APPLICATION_EXISTS`, `VALIDATION_FAILED`.

### 4.3 `POST /admin/membership/applications/:id/review` (A)

Request
```json
{ "decision": "rejected", "reason": "Student ID could not be matched" }
```
`reason` is **required** when `decision = "rejected"`. Response:
```json
{ "data": { "id": "a41c…", "status": "rejected", "revision": 1, "reviewedAt": "…" } }
```
Approving a **free** tier activates the membership; a paid tier moves to "pay dues".

### 4.4 `PUT /membership/applications/:id` (owner, rejected only)

Body: `{ "tierId"?, "answers" }` → status becomes `pending`, `revision + 1`; earlier reviews stay in history. Error `CONFLICT` if not rejected.

### 4.5 `POST /me/verify-code`

Response — the code the member shows at the door
```json
{ "data": { "code": "482915", "expiresAt": "2026-10-17T13:01:00Z", "ttlSeconds": 60 } }
```
Errors: `NO_ACTIVE_MEMBERSHIP`, `RATE_LIMITED`. Calling again replaces the previous code.

### 4.6 `POST /staff/verify/member` (A, T, D)

Request `{ "code": "482915" }`

Success
```json
{ "data": { "valid": true, "fullName": "Aarav Gowda", "tier": "Plus", "status": "active", "expiresOn": "2027-03-01", "discountPercent": 10 } }
```
Failure `404 CODE_INVALID` (same response for unknown *and* expired codes). Every attempt writes an audit row (`member.verify`, success/failure, actor).

### 4.7 `GET /public/events/:slug`

```json
{ "data": {
  "id": "e0b1…", "slug": "skyline-gala-2026", "title": "Skyline Gala Night",
  "venue": "Open Auditorium", "startsAt": "2026-10-17T13:00:00Z", "capacity": 120,
  "available": 88,
  "ticketTypes": [
    { "id": "tt04…", "name": "General admission", "pricePaise": 50000, "memberPricePaise": 30000, "memberOnly": false, "available": 56 },
    { "id": "tt06…", "name": "Core member", "pricePaise": 0, "memberPricePaise": 0, "memberOnly": true, "available": 40 }
  ] } }
```

### 4.8 `POST /checkout` 🔁 (online)

Request
```json
{ "paymentMethod": "online",
  "items": [ { "type": "ticket", "refId": "tt04…", "quantity": 2 } ] }
```
`type` ∈ `ticket | merch | membership`; `refId` = ticket type / variant / tier. **There is no price field** — the server computes everything.

Response `201`
```json
{ "data": {
  "checkout": { "id": "c77a…", "status": "pending", "subtotalPaise": 100000, "discountPaise": 40000, "totalPaise": 60000, "expiresAt": "2026-10-10T09:36:00Z",
                "items": [ { "type":"ticket","refId":"tt04…","quantity":2,"unitPricePaise":30000,"discountPaise":0 } ] },
  "razorpay": { "keyId": "rzp_test_xxxxxxxx", "orderId": "order_Nxxxx", "amountPaise": 60000, "currency": "INR", "mode": "test" } } }
```
Zero-total checkouts skip Razorpay: the response has `razorpay: null` and the checkout is fulfilled immediately (`status: "fulfilled"`).

Errors: `CAPACITY_EXCEEDED`, `OUT_OF_STOCK`, `MEMBER_ONLY`, `APPLICATION_NOT_APPROVED`, `ALREADY_MEMBER`, `PAYMENT_PROVIDER_ERROR`.

### 4.9 `POST /checkout/:id/verify`

Request (values returned by Razorpay Checkout.js)
```json
{ "razorpayOrderId": "order_Nxxxx", "razorpayPaymentId": "pay_Nyyyy", "razorpaySignature": "9ef4…" }
```
Server verifies `HMAC_SHA256(orderId + "|" + paymentId, KEY_SECRET)` in constant time, then fulfils. Response `200`:
```json
{ "data": { "status": "fulfilled", "tickets": [ { "id": "t1…", "code": "SKY-7K3M-92QH", "eventId": "e0b1…", "holderName": "Demo Member" } ] } }
```
Errors: `INVALID_SIGNATURE`, `CHECKOUT_EXPIRED`, `CHECKOUT_NOT_PENDING`. Replays return the same body.

### 4.10 `POST /staff/checkout` 🔁 (cash / manual UPI)

Request
```json
{ "paymentMethod": "cash",
  "buyer": { "email": "member@skylinesos.demo" },
  "items": [ { "type": "ticket", "refId": "tt05…", "quantity": 1 } ],
  "holderName": "Walk-in guest",
  "note": "Door sale, paid ₹600 cash to Demo Door Staff" }
```
- `buyer` is `{ "email": … }` (existing account) or `{ "guest": true }` (uses the shared walk-in profile; `holderName` is then required).
- `note` is **required** → `NOTE_REQUIRED`.
- Door staff may include only `ticket` items.

Response `201`: same shape as §4.9, plus `"verification": "staff_recorded"`. Audit action `checkout.staff_recorded` stores method, actor and amount.

### 4.11 `POST /webhooks/razorpay`

Headers: `X-Razorpay-Signature`. Body: raw JSON from Razorpay. Handling order: read raw bytes → verify `HMAC_SHA256(rawBody, WEBHOOK_SECRET)` → parse → insert `webhook_events` (duplicate event ID → `200` no-op) → on `payment.captured` fulfil the checkout matching `order_id` → `200`. Invalid signature → `401 INVALID_SIGNATURE`. Always responds quickly; no business data in the response.

### 4.12 `POST /door/check-in` (A, D)

Request `{ "eventId": "e0b1…", "code": "sky 7k3m 92qh" }` (any case, spaces/dashes tolerated; `O→0`, `I/L→1` mapped)

Success
```json
{ "data": { "ticketId": "t1…", "holderName": "Demo Member", "ticketType": "General admission", "checkedInAt": "2026-10-17T13:12:08Z",
            "counters": { "sold": 32, "checkedIn": 14, "capacity": 120 } } }
```
Failure `409 TICKET_ALREADY_CHECKED_IN`
```json
{ "error": { "code": "TICKET_ALREADY_CHECKED_IN", "message": "Already checked in at 18:42", "details": { "checkedInAt": "2026-10-17T13:12:08Z", "by": "Demo Door Staff" }, "requestId": "…" } }
```
Other failures: `TICKET_NOT_FOUND`, `WRONG_EVENT`, `TICKET_CANCELLED`, `RATE_LIMITED`.

### 4.13 `GET /door/tickets?eventId=&q=`

Search by buyer/holder name or email (min 3 characters, exact or prefix). Returns `[{ ticketId, holderName, ticketType, status, maskedEmail }]` — **never the ticket code** (staff must still have the code or choose a manual "check in" action which logs `door.manual_check_in`).

### 4.14 `GET /admin/events/:id/summary`

```json
{ "data": { "eventId": "e0b1…", "capacity": 120, "sold": 32, "checkedIn": 14, "attendanceRate": 0.4375,
            "revenuePaise": { "online_test": 90000, "cash": 624000, "manual_upi": 270000, "total": 984000 }, "refundsPaise": 0 } }
```

### 4.15 `POST /fundraisers/:id/contributions` 🔁

Request `{ "amountPaise": 25000, "method": "cash", "note": "Bake sale stall" }` → `201` `{ "data": { "id": "…", "ledgerEntryId": "…" } }`. Creates contribution, ledger `in` row (category `fundraiser`) and audit row atomically.

### 4.16 `GET /fundraisers/:id/progress`

```json
{ "data": { "name": "Gala Night Bake Sale", "goalPaise": 2500000, "raisedPaise": 590000, "percent": 23.6,
            "tasks": { "total": 8, "done": 3, "overdue": 2 } } }
```
Money comes **only** from contributions; tasks are separate.

### 4.17 `POST /expenses` and `POST /expenses/:id/status`

Submit: `{ "amountPaise": 80000, "category": "Printing", "description": "Poster printing" }`.
Status: `{ "action": "approve" }` · `{ "action": "reject", "reason": "…" }` · `{ "action": "mark-paid" }`.
Rules: submitter cannot approve own (`SELF_APPROVAL_FORBIDDEN`); `mark-paid` requires approved and posts one `out` ledger row.

### 4.18 `GET /treasurer/overview?from=2026-08-01&to=2026-10-31`

```json
{ "data": {
  "range": { "from": "2026-08-01", "to": "2026-10-31" },
  "inPaise": 3120000, "outPaise": 1010000, "netPaise": 2110000,
  "label": "Recorded net movement (not a bank balance)",
  "byCategory": [ { "category": "dues", "inPaise": 1010000 }, { "category": "tickets", "inPaise": 984000 }, { "category": "merch", "inPaise": 536000 }, { "category": "fundraiser", "inPaise": 590000 }, { "category": "expense", "outPaise": 1010000 } ],
  "byMethod": [ { "method": "online_test", "inPaise": 90000 }, { "method": "cash", "inPaise": 2000000 }, { "method": "manual_upi", "inPaise": 1030000 } ],
  "recent": [ { "id": "l1…", "direction": "in", "amountPaise": 30000, "category": "tickets", "method": "cash", "source": { "type": "checkout_item", "id": "ci…" }, "effectiveOn": "2026-10-10" } ] } }
```
(Numbers illustrative.)

### 4.19 `GET /actions`

```json
{ "data": [
  { "rule": "low_stock", "title": "Skyline Hoodie S is almost gone", "reason": "2 left (threshold 3)", "nextAction": "Review stock", "priority": "high", "link": "/admin/merch?variant=v01…" },
  { "rule": "overdue_task", "title": "Print posters is overdue", "reason": "Due 2026-10-05", "nextAction": "Contact assignee", "priority": "medium", "link": "/admin/fundraisers/board?id=f1…" } ] }
```

### 4.20 `POST /admin/members/walk-up` 🔁 (A, D)

```json
{ "email": "new.student@students.skylinesos.demo", "fullName": "New Student", "studentId": "4GT23AI099", "tierId": "b2f0…",
  "payment": { "method": "cash", "note": "Paid ₹300 cash at signup desk" } }
```
Creates (or finds) the account, creates an application, and — because the admin is physically present — records the approval and staff-recorded dues in one flow, **still writing review and audit rows**. For a new account the response includes `temporaryPassword` **once**; the student should change it after first login. Door staff may only create the application (no approval/payment).

### 4.21 Admin role grant `PATCH /admin/users/:id/role`

`{ "role": "treasurer" }` → audited as `role.grant` with before/after. An admin cannot demote the last admin (`CONFLICT`).

## 5. Webhook configuration (Razorpay dashboard, Test Mode)

| Setting | Value |
|---|---|
| URL | `https://<ref>.supabase.co/functions/v1/api/v1/webhooks/razorpay` |
| Events | `payment.captured`, `payment.failed` |
| Secret | Same value as `RAZORPAY_WEBHOOK_SECRET` |

## 6. Client usage example

```ts
const key = crypto.randomUUID();                       // one per click of "Pay"
const res = await api<CheckoutResponse>('/checkout', {
  method: 'POST', headers: { 'Idempotency-Key': key },
  json: { paymentMethod: 'online', items: [{ type: 'ticket', refId, quantity: 1 }] },
});
if (res.razorpay) openRazorpay(res.razorpay, async (r) => {
  await api(`/checkout/${res.checkout.id}/verify`, { method: 'POST', json: r });
});
```

## 7. Changelog

| Date | Change |
|---|---|
| 2026-10-10 | v1 contract drafted from the SkylineSOS PRD/TRD |
