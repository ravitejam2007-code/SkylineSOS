# SkylineSOS — Technical Requirements Document (TRD)

| | |
|---|---|
| **Version** | 3.0 — implementation baseline |
| **Date** | 10 October 2026 |
| **Audience** | The four developers; reviewers/judges who want the engineering depth |
| **Companions** | [PRD](./PRD.md) · [Architecture](./architecture.md) · [API Docs](./api-docs.md) · [Navigation Plan](./Navigation-plan.md) · [Team](./team-management.md) · [Demo Data](./demo-data.md) |

---

## 1. Purpose and constraints

This document says **how** SkylineSOS is built. The PRD says **what** and **why**.

| Constraint (from the team) | Technical consequence |
|---|---|
| Frontend: **Astro + Tailwind CSS** | Static Astro build, React islands for interactive screens, Tailwind v4 |
| Backend: **Node.js + Express.js** | Express routes in TypeScript, structured like a normal Express app |
| **Host everything on Supabase**; no Render/Railway/Node host | Express runs **inside one Supabase Edge Function** (`api`). Database, Auth and cron are Supabase-native |
| Keep it as simple as possible | One API function, one database, no queue, no cache, no Storage, no email provider |
| Keys only via `.env` | See §12; `.env.example` is committed, real values never are |
| Code-based identity verification, no QR | See §9 |
| UI from the supplied `DESIGN-meta.md` | See §5.5 |

> **Honest hosting note.** Supabase hosts the *backend* (Postgres, Auth, Edge Functions, cron). It does **not** serve a website. The Astro app is a **static build** (HTML/CSS/JS files) that needs no Node runtime, so it can sit on any free static host (Cloudflare Pages, Netlify, Vercel static, GitHub Pages). No Node-capable backend host is used anywhere.
>
> **Express note.** Supabase's own documentation shows Express running in an Edge Function through the `npm:express@4.18.2` specifier, with every route prefixed by the function name. Edge Functions run on **Deno**, not Node, and have per-request CPU limits, so handlers stay small and heavy work lives in SQL. A day-0 spike (§15) confirms this works for our webhook raw-body case; the fallback is Hono with an identical route layout.

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | **Astro 5**, static output | `output: 'static'`; no adapter |
| Interactive UI | `@astrojs/react` islands | Only for forms, checkout, door mode, boards |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | Tokens in `@theme` (§5.5) |
| Language | TypeScript (`strict: true`) everywhere | Shared types in `packages/contracts` |
| Validation | **Zod** | Same schemas on client forms and API |
| API runtime | **Supabase Edge Function `api`** (Deno) | Express 4.18.2 via `npm:` specifier |
| Database | **Supabase Postgres** | SQL migrations in Git, plpgsql functions for atomic work |
| Auth | **Supabase Auth** (email + password) | JWT sent as `Authorization: Bearer` |
| Scheduler | **pg_cron** | Two jobs (§7.6) |
| Payments | **Razorpay Test Mode** | `fetch` + Web Crypto, no Node SDK |
| Tests | Vitest, Deno test, pgTAP (`supabase test db`), Playwright | §13 |
| CI | GitHub Actions | Lint, typecheck, build, tests |
| Frontend host | Static host (Cloudflare Pages recommended) | HTTPS + security headers via `_headers` file |

Pin exact versions in `package.json` and in the Edge Function import specifiers when you install; do not copy version numbers from this document blindly.

## 3. Key technical decisions

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | **All browser data access goes through the Express API** (browser talks to Supabase only for sign-in/sign-up/refresh) | Direct Data API + RLS policies | One place for authorization the team can read and test; no policy-writing skills required; RLS stays as deny-all safety net |
| D2 | **Atomic business rules in plpgsql functions** (checkout, fulfil, check-in, ledger) | Rules in Express | Row locks + transactions give correctness under concurrency; Express stays thin |
| D3 | **Single Edge Function** for the whole API | One function per endpoint | One cold start, one deploy, normal Express routing |
| D4 | **Static Astro + query-string detail pages** (`/event?slug=…`) | SSR with an adapter | No Node host; no cookie/SSR auth complexity. Trade-off: no per-page SEO for dynamic data (irrelevant for this product) |
| D5 | **Single club, single role per user** | Orgs table, multi-role | Removes tenancy and join complexity |
| D6 | **Codes instead of QR** | QR via camera | Works without camera/light; no scanner dependency (§9) |
| D7 | **Action queue computed on read** | Table + cron + dedupe | No duplicate/stale rows, nothing to schedule |
| D8 | **No Supabase Storage, no email provider** | Receipts, Resend | Both add setup risk with no P0 value |
| D9 | **Demo data via the real RPCs** | SQL inserts | Ledger, audit and stock stay truthful (§11) |

## 4. Repository layout

```text
skylinesos/
├─ apps/
│  └─ web/                         # Astro (static)
│     ├─ src/
│     │  ├─ pages/                 # see Navigation-plan.md
│     │  ├─ layouts/               # PublicLayout, AppLayout, StaffLayout
│     │  ├─ components/            # .astro presentational components
│     │  ├─ islands/               # React: CheckoutPanel, DoorConsole, TaskBoard, ...
│     │  ├─ lib/
│     │  │  ├─ api.ts              # fetch wrapper (adds JWT, handles error envelope)
│     │  │  ├─ auth.ts             # supabase-js client (auth only) + session helpers
│     │  │  ├─ guards.ts           # requireRole() client-side route guard
│     │  │  └─ money.ts            # paise <-> ₹ formatting
│     │  └─ styles/global.css      # Tailwind v4 + @theme tokens
│     ├─ public/_headers           # security headers
│     └─ astro.config.mjs
├─ packages/
│  └─ contracts/                   # zod schemas + TS types shared by web and api
├─ supabase/
│  ├─ config.toml                  # [functions.api] verify_jwt = false
│  ├─ functions/
│  │  └─ api/
│  │     ├─ index.ts               # Express app bootstrap
│  │     ├─ middleware/            # auth.ts, rbac.ts, validate.ts, errors.ts, requestId.ts
│  │     ├─ routes/                # one file per module (see api-docs.md)
│  │     ├─ lib/                   # db.ts, razorpay.ts, hmac.ts, audit.ts, env.ts
│  │     └─ deno.json
│  ├─ migrations/                  # 0001_init.sql, 0002_rls.sql, 0003_functions.sql, 0004_cron.sql
│  └─ tests/                       # pgTAP
├─ scripts/
│  └─ seed.mjs                     # reads seed/demo-data.json, calls RPCs
├─ seed/demo-data.json
├─ docs/                           # the six docs + demo-data.md
├─ .github/workflows/ci.yml
├─ .env.example
└─ README.md
```

**Ownership of folders is defined in [team-management.md](./team-management.md)** to avoid merge conflicts.

## 5. Frontend

### 5.1 Rendering model

- Astro builds static HTML. Interactive pages hydrate a React island (`client:load`) that calls the API.
- Dynamic IDs use query strings because there is no server to resolve paths: `/event?slug=skyline-gala-2026`, `/admin/events/edit?id=<uuid>`.
- Route guards are **UX only**. Every API call is authorized server-side.

### 5.2 Auth handling

> **Supabase Auth setup:** disable "Confirm email" (no email provider is configured). Supabase's built-in mailer only reaches project-team addresses and is rate-limited, so password-reset emails are unreliable for ordinary users: `/forgot-password` is **P1** (hide the link in the demo; admins reset demo passwords in the dashboard). Create one shared **walk-in guest** profile in the seed for cash door sales to people without accounts.

1. `supabase-js` (anon key) handles `signUp`, `signInWithPassword`, `signOut`, session refresh. Session is stored by the library.
2. `lib/api.ts` reads the current access token and sends `Authorization: Bearer <jwt>`.
3. After login the app calls `GET /me` to learn `role`, then redirects: admin→`/admin`, treasurer→`/treasurer`, door→`/door`, volunteer→`/volunteer`, member→`/dashboard`.
4. `guards.ts`: if `/me` is missing or role not allowed → redirect to `/login?next=…` or `/403`.

### 5.3 API client contract

```ts
// lib/api.ts (sketch)
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Request failed', body.error?.requestId);
  return body.data as T;
}
```

Every screen implements four states: **loading, empty, error (with request ID), success**.

### 5.4 Components (build once, reuse everywhere)

`Button` (variants below), `Pill`/`Badge`, `Card`, `Input`, `Select`, `Field` (label + error), `DataTable`, `Stat`, `EmptyState`, `ErrorState`, `Skeleton`, `Toast`, `Modal`, `CodeInput` (segmented, auto-uppercase, paste-friendly), `Countdown` (member code), `MoneyBadge` (method label), `Stepper`, `StickyCheckoutBar`.

### 5.5 Design system mapping (from `DESIGN-meta.md`)

The supplied design file describes Meta's commerce look. SkylineSOS adopts its **tokens and rules**, adapted to a club app.

| Design rule | SkylineSOS usage |
|---|---|
| White canvas, soft cloud surfaces | Page `bg-canvas`; tiles `bg-surface-soft` |
| Black pill = marketing/general primary | "Join the club", "View events", nav primary |
| **Cobalt `#0064e0` only for buy/pay actions** | "Pay ₹…", "Buy ticket", "Add to order", Razorpay launch |
| Outlined ghost pill = secondary | Secondary CTA beside primary |
| Pill buttons, chips, badges (`rounded-full`) | All buttons, tabs, badges |
| 32 px (`xxxl`) photo cards, 16 px (`xl`) feature tiles, 8 px inputs | Event cards 32 px; stat/feature tiles 16 px; inputs 8 px |
| Inputs 44 px high; focus border 2 px `#1876f2` | Same |
| Badges: success / attention / critical / promo | In stock / Almost gone / Out / Limited |
| Flat by default; shadow only on checkout summary | Same |
| No hover documentation; pressed states only | Implement `:active` + `:focus-visible`; hover is optional polish |
| Dark mode tokens undefined | **Light theme only** |
| Photography-first | We have no product photography: use gradient/solid posters generated in CSS and simple line icons; keep the generous radius and whitespace |

**Font.** Optimistic VF is Meta's proprietary typeface and must not be bundled. Use the design file's own fallback, **Montserrat** (self-host via `@fontsource-variable/montserrat`), with the same size/weight/line-height scale.

```css
/* apps/web/src/styles/global.css */
@import "tailwindcss";

@theme {
  --font-sans: "Montserrat Variable", Montserrat, Helvetica, Arial, "Noto Sans", sans-serif;

  --color-primary: #0064e0;        /* buy/pay CTAs ONLY */
  --color-primary-deep: #0457cb;   /* pressed */
  --color-primary-soft: #0091ff;
  --color-focus: #1876f2;
  --color-ink-deep: #0a1317;
  --color-ink: #1c1e21;
  --color-charcoal: #444950;
  --color-steel: #5d6c7b;
  --color-stone: #8595a4;
  --color-canvas: #ffffff;
  --color-surface-soft: #f1f4f7;
  --color-hairline: #ced0d4;
  --color-hairline-soft: #dee3e9;
  --color-disabled: #bcc0c4;
  --color-success: #31a24c;
  --color-attention: #f2a918;
  --color-warning: #f7b928;
  --color-critical: #e41e3f;
  --color-critical-strong: #f0284a;

  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px;
  --radius-xl: 16px; --radius-2xl: 24px; --radius-3xl: 32px; --radius-feature: 40px;
  --radius-pill: 100px;

  --text-hero: 64px;  --text-display: 48px; --text-h1: 36px;
  --text-h2: 28px;    --text-h3: 24px;      --text-lead: 18px;
  --text-body: 16px;  --text-small: 14px;   --text-caption: 12px;

  --shadow-checkout: 0 1px 4px 0 rgb(20 22 26 / 0.3);
}
```

Button recipes: **primary** `bg-ink-deep text-white rounded-pill px-[30px] py-[14px] font-bold text-[14px] active:bg-charcoal disabled:bg-disabled`; **buy** same shape with `bg-primary active:bg-primary-deep`; **secondary** `border-2 border-ink-deep bg-transparent px-7 py-3`; **ghost** `border-2 border-ink-deep/12`.

Responsive breakpoints: 480 / 768 / 1024 / 1360. Hero 64 px → 36 px under 768 px → 24 px under 480 px. Feature grids 4→2→1. Checkout summary becomes a sticky bottom bar under 768 px.

Accessibility: AA contrast checked on `ink-deep`/`canvas`, white on `primary`, white on `success` (use `ink-deep` text on `warning`); never convey status by colour alone; 44 px minimum touch target (the design's 32 px swatches get a larger hit area).

## 6. Backend (Express in one Edge Function)

### 6.1 Bootstrapping

```ts
// supabase/functions/api/index.ts (skeleton)
import express from "npm:express@4.18.2";
import cors from "npm:cors@2.8.5";
import { requestId } from "./middleware/requestId.ts";
import { errorHandler, notFound } from "./middleware/errors.ts";
import { razorpayWebhook } from "./routes/webhooks.ts";
import { router } from "./routes/index.ts";
import { env } from "./lib/env.ts";

const app = express();
app.disable("x-powered-by");
app.use(requestId);
app.use(cors({ origin: env.APP_ORIGIN, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
               allowedHeaders: ["Authorization","Content-Type","Idempotency-Key"], maxAge: 600 }));

// 1) Webhook FIRST: needs the raw bytes for the signature. Do not run express.json() before it.
app.post("/api/v1/webhooks/razorpay", express.raw({ type: "*/*", limit: "100kb" }), razorpayWebhook);

// 2) Everything else is JSON
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1", router);          // routes are prefixed with the FUNCTION NAME: /api/...
app.use(notFound);
app.use(errorHandler);

app.listen(8000);                    // Supabase routes the invocation to this port
```

Public URL = `https://<ref>.supabase.co/functions/v1/api/v1/<route>`. `supabase/config.toml` sets `verify_jwt = false` for `api` because the webhook has no user JWT; **our own middleware verifies the JWT on every non-public route**.

### 6.2 Middleware order and responsibilities

| # | Middleware | Responsibility |
|---|---|---|
| 1 | `requestId` | Read/create `x-request-id`; attach to logs and to every error |
| 2 | `cors` | Exact origin from `APP_ORIGIN`; never `*` with credentials |
| 3 | body parsers | Raw for webhook; JSON (100 kb cap) elsewhere |
| 4 | `authenticate` | Verify bearer token with `supabase.auth.getUser(token)`; load `user_roles.role`; attach `req.user = { id, role, email }` |
| 5 | `requireRole(...roles)` | 403 `FORBIDDEN` when role not allowed |
| 6 | `validate(schema)` | Zod parse of `body`, `query`, `params`; 422 `VALIDATION_FAILED` |
| 7 | `rateLimit(key, limit, windowSec)` | Calls `fn_rate_limit` (database-backed so it survives cold starts) |
| 8 | handler | Calls one RPC or a few small queries |
| 9 | `errorHandler` | Maps Postgres/known errors to the envelope in §6.4 |

### 6.3 Authorization matrix (enforced by `requireRole` and inside RPCs)

| Capability | Admin | Treasurer | Door | Volunteer | Member |
|---|:-:|:-:|:-:|:-:|:-:|
| Manage roles, tiers, events, ticket types, products, announcements, fundraisers | ✔ | | | | |
| Review membership applications | ✔ | | | | |
| Own profile, application, membership, code, tickets, orders, preferences | ✔ | ✔ | ✔ | ✔ | ✔ |
| Verify member by code / search; check in ticket; sell cash ticket | ✔ | ✔ (sell) | ✔ | | |
| Record cash/UPI for membership or merch | ✔ | ✔ | | | |
| Update tasks | ✔ | | | assigned only | |
| Record fundraiser contribution | ✔ | ✔ | | ✔ | |
| Submit expense | ✔ | ✔ | ✔ | ✔ | |
| Approve/reject/mark-paid expense | ✔ | ✔ (not own) | | | |
| Treasurer overview, ledger | ✔ | ✔ | | | |
| Audit log | ✔ | ✔ (financial) | | | |
| Action queue | ✔ (all) | ✔ (finance) | | own tasks | |

### 6.4 Error envelope

```json
{ "error": { "code": "TICKET_ALREADY_CHECKED_IN", "message": "Checked in at 18:42 by Demo Door Staff", "details": { "checkedInAt": "2026-10-17T13:12:08Z" }, "requestId": "5c8a…" } }
```

Success responses are `{ "data": … , "meta": { … } }`. Full code list in [api-docs.md](./api-docs.md#2-error-codes).

Database functions raise `RAISE EXCEPTION 'CODE' USING DETAIL = '<json>'`; the handler converts `message` → `error.code`, `details` → `error.details`. Unknown errors become `500 INTERNAL` and log the real cause with the request ID.

### 6.5 Idempotency

- Purchases and staff-recorded entries require an `Idempotency-Key` header (UUID generated by the client per attempt). `checkouts.idempotency_key` is unique; a retry returns the original checkout.
- Fulfilment is idempotent through status transitions and `ledger_entries (source_type, source_id)` uniqueness.
- Webhook events are deduplicated by `webhook_events.provider_event_id`.

### 6.6 Logging

One JSON line per request: `{ ts, level, requestId, method, path, status, ms, userId?, role? }`. Never log tokens, request bodies, codes, or payment payloads. View in the Supabase dashboard (Edge Function logs).

## 7. Database

### 7.1 Conventions

UUID primary keys (`gen_random_uuid()`), `timestamptz`, money as **integer paise**, `CHECK` constraints on statuses, foreign keys, restrictive deletes on financial tables, snake_case, one migration file per concern, no demo rows in migrations.

### 7.2 Schema (core DDL)

```sql
-- 0001_init.sql
create extension if not exists pgcrypto with schema extensions;

create type app_role      as enum ('admin','treasurer','door','volunteer','member');
create type pay_method    as enum ('online','cash','manual_upi');
create type item_type     as enum ('ticket','merch','membership');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (length(full_name) between 2 and 80),
  email       text not null unique,
  student_id  text unique,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create table user_roles (
  user_id    uuid primary key references profiles(id) on delete cascade,
  role       app_role not null default 'member',
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now()
);
create table app_settings (key text primary key, value jsonb not null);   -- thresholds, TTLs

create table membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee_paise int not null check (fee_paise >= 0),
  duration_days int not null check (duration_days > 0),
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  benefits text[] not null default '{}',
  is_active boolean not null default true
);
create table membership_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  tier_id uuid not null references membership_tiers(id),
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','withdrawn')),
  revision int not null default 1,
  answers jsonb not null default '{}',
  submitted_at timestamptz, reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_open_application on membership_applications(user_id) where status in ('draft','pending','approved');
create table membership_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references membership_applications(id),
  revision int not null, reviewer_id uuid not null references profiles(id),
  decision text not null check (decision in ('approved','rejected')), reason text,
  created_at timestamptz not null default now()
);
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  tier_id uuid not null references membership_tiers(id),
  application_id uuid references membership_applications(id),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  starts_on date not null, expires_on date not null check (expires_on > starts_on),
  checkout_id uuid
);
create index on memberships(user_id, expires_on desc);
create table member_codes (                      -- one row per member, rotated in place
  user_id uuid primary key references profiles(id) on delete cascade,
  code char(6) not null unique, expires_at timestamptz not null
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, title text not null, description text, venue text not null,
  starts_at timestamptz not null, ends_at timestamptz,
  capacity int not null check (capacity > 0),
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  created_by uuid references profiles(id), created_at timestamptz not null default now()
);
create table ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null, price_paise int not null check (price_paise >= 0),
  member_price_paise int check (member_price_paise >= 0),   -- null = no member price
  member_only boolean not null default false,
  quantity_limit int not null check (quantity_limit > 0),
  sales_start timestamptz, sales_end timestamptz
);

create table products (id uuid primary key default gen_random_uuid(), name text not null, description text, status text not null default 'active' check (status in ('active','archived')));
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique, label text not null, price_paise int not null check (price_paise >= 0),
  stock_on_hand int not null check (stock_on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  check (reserved <= stock_on_hand)               -- the database refuses to oversell
);

create table checkouts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending','paid','fulfilled','expired','failed','cancelled')),
  payment_method pay_method not null,
  subtotal_paise int not null check (subtotal_paise >= 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  total_paise int not null check (total_paise >= 0),
  verification text check (verification in ('razorpay_verified','staff_recorded')),
  recorded_by uuid references profiles(id), note text,
  idempotency_key text not null unique,
  expires_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now(),
  check (payment_method = 'online' or (recorded_by is not null and note is not null))
);
create table checkout_items (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references checkouts(id),
  item_type item_type not null,
  ref_id uuid not null,                          -- ticket_type_id | variant_id | tier_id
  quantity int not null check (quantity > 0),
  unit_price_paise int not null check (unit_price_paise >= 0),   -- captured at purchase
  discount_paise int not null default 0 check (discount_paise >= 0),
  fulfilment_status text not null default 'pending' check (fulfilment_status in ('pending','packed','handed_over','n/a'))
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references checkouts(id),
  provider text not null default 'razorpay', mode text not null default 'test',
  provider_order_id text unique, provider_payment_id text unique,
  amount_paise int not null, status text not null default 'created' check (status in ('created','captured','failed')),
  created_at timestamptz not null default now()
);
create table webhook_events (provider_event_id text primary key, event_type text not null, payload_hash text not null, received_at timestamptz not null default now(), processed_at timestamptz);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  checkout_item_id uuid not null references checkout_items(id),
  event_id uuid not null references events(id), ticket_type_id uuid not null references ticket_types(id),
  owner_id uuid not null references profiles(id),
  holder_name text not null,                    -- shown to door staff; guests use the shared walk-in profile
  code text not null unique,                     -- SKY-XXXX-XXXX (§9)
  status text not null default 'issued' check (status in ('issued','checked_in','cancelled')),
  issued_at timestamptz not null default now()
);
create index on tickets(event_id, status);
create table check_ins (ticket_id uuid primary key references tickets(id), staff_id uuid not null references profiles(id), checked_in_at timestamptz not null default now());

create table announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  audience text not null check (audience in ('public','members','staff')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid references profiles(id), published_at timestamptz, created_at timestamptz not null default now()
);
create table mailing_preferences (user_id uuid references profiles(id) on delete cascade, topic text not null check (topic in ('events','merch','fundraisers','general')), opted_in boolean not null default false, updated_at timestamptz not null default now(), primary key(user_id, topic));
create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, kind text not null, title text not null, body text, dedupe_key text not null unique, read_at timestamptz, created_at timestamptz not null default now());

create table fundraisers (id uuid primary key default gen_random_uuid(), name text not null, goal_paise int not null check (goal_paise > 0), starts_on date, ends_on date, status text not null default 'active' check (status in ('active','closed')), owner_id uuid references profiles(id));
create table tasks (id uuid primary key default gen_random_uuid(), fundraiser_id uuid not null references fundraisers(id) on delete cascade, title text not null, assignee_id uuid references profiles(id), due_on date, priority text not null default 'medium' check (priority in ('low','medium','high')), status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')), created_by uuid references profiles(id));
create table contributions (id uuid primary key default gen_random_uuid(), fundraiser_id uuid not null references fundraisers(id), amount_paise int not null check (amount_paise > 0), method text not null check (method in ('cash','manual_upi')), note text not null, recorded_by uuid not null references profiles(id), created_at timestamptz not null default now());
create table expenses (id uuid primary key default gen_random_uuid(), amount_paise int not null check (amount_paise > 0), category text not null, description text not null, submitted_by uuid not null references profiles(id), status text not null default 'submitted' check (status in ('submitted','approved','rejected','paid')), reviewed_by uuid references profiles(id), reviewed_at timestamptz, reject_reason text, created_at timestamptz not null default now());

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  amount_paise int not null check (amount_paise >= 0),
  category text not null check (category in ('dues','tickets','merch','fundraiser','expense','refund')),
  method text not null check (method in ('online_test','cash','manual_upi')),
  source_type text not null check (source_type in ('checkout_item','contribution','expense','reversal')),
  source_id uuid not null, memo text, effective_on date not null default current_date,
  reverses_id uuid references ledger_entries(id), created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (source_type, source_id)                -- one posting per source, ever
);
create table audit_logs (id bigint generated always as identity primary key, actor_id uuid, action text not null, entity_type text, entity_id text, meta jsonb not null default '{}', request_id text, created_at timestamptz not null default now());
create index on audit_logs(created_at desc);
create table rate_limits (key text not null, bucket bigint not null, count int not null default 0, primary key (key, bucket));
```

Ledger rows are never updated or deleted (enforced by a trigger that raises on `UPDATE`/`DELETE`). Corrections insert a `reversal` row with `reverses_id`.

### 7.3 Security of the database

```sql
-- 0002_rls.sql — runs for EVERY table above
alter table <t> enable row level security;       -- no policies => browser roles see nothing
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
-- Only the Edge Function (service_role) touches data. Confirm with a pgTAP test that anon/authenticated get 0 rows.
```

New-user trigger (security definer): on insert into `auth.users`, create `profiles` + `user_roles(role='member')`. Role escalation is possible only through `PATCH /admin/users/:id/role`, which is admin-only and audited.

### 7.4 Business functions (all `security definer`, `set search_path = public, extensions`, execute granted to `service_role` only)

| Function | Purpose and algorithm |
|---|---|
| `fn_create_checkout(buyer, items jsonb, method, idem_key, recorded_by, note)` | 1) If `idem_key` exists return that checkout. 2) For each item lock the row (`FOR UPDATE` on `events`, `product_variants`, tier). 3) **Ticket:** verify event published and sales window; `member_only` requires an active membership; price = member price if buyer has active membership and a member price exists; **capacity check** `issued + pending_reserved + qty ≤ min(type.quantity_limit, event.capacity)` where *pending_reserved* counts items of `pending` unexpired checkouts. 4) **Merch:** `available = stock_on_hand − reserved ≥ qty` then `reserved += qty`; discount = `price × tier.discount_percent / 100` (integer rounding down). 5) **Membership:** require an `approved` application for this user and tier (or an expiring active membership for renewal); reject if an active, unexpired membership with ≥ 30 days left exists. 6) Insert checkout + items with captured prices; `expires_at = now() + CHECKOUT_TTL` for `online`, null for staff methods. Totals are computed here, never accepted from the client. |
| `fn_fulfil_checkout(checkout_id, verification, actor, effective_on default current_date)` | `SELECT … FOR UPDATE`; if status is `paid`/`fulfilled` return as-is (**idempotent**); if not `pending` raise. Set `paid`. For each item: **ticket** → insert `qty` tickets with unique codes; **merch** → `stock_on_hand −= qty`, `reserved −= qty`, fulfilment `pending`; **membership** → insert membership (`starts_on = max(today, current expiry)`), mark application consumed. **Post one ledger row per item** (`source_type='checkout_item'`, amount = `unit × qty − discount`, skip when 0). Write audit row. Set `fulfilled`. `effective_on` is accepted only for the seed script (service role). |
| `fn_record_staff_checkout(...)` | `fn_create_checkout` + `fn_fulfil_checkout('staff_recorded')` in **one transaction**; requires `recorded_by` and a note; audited with method |
| `fn_expire_checkouts()` | Pending checkouts past `expires_at` → `expired`; release merch `reserved`; idempotent through the status change. Cron every minute |
| `fn_check_in(event_id, code, staff_id)` | Normalise code; lock ticket; reject `TICKET_NOT_FOUND`, `WRONG_EVENT`, `TICKET_CANCELLED`, `TICKET_ALREADY_CHECKED_IN`; insert `check_ins` (primary key = ticket) and set status; return holder + ticket type; audit |
| `fn_issue_member_code(user_id, ttl_seconds)` | Requires an active membership; generate 6 digits with `gen_random_bytes`; upsert the member's row; retry up to 5× on unique collision |
| `fn_verify_member_code(code, staff_id)` | Look up unexpired code; return `{name, tier, status, expires_on, discount_percent}` only; audit success and failure |
| `fn_review_application(id, reviewer, decision, reason)` | Admin only; reason required on reject; append review row; free tier activates immediately |
| `fn_set_expense_status(id, actor, status, reason)` | `approved` requires `actor ≠ submitted_by`; `paid` requires `approved` and posts one `out` ledger row; audited |
| `fn_record_contribution(fundraiser, amount, method, note, actor)` | Insert contribution + ledger `in` row + audit atomically |
| `fn_treasurer_overview(from, to)` | `{in, out, net, by_category, by_method, recent[10]}` from `ledger_entries` |
| `fn_event_summary(event_id)` | sold, capacity, checked_in, attendance_rate, revenue by method |
| `fn_fundraiser_progress(id)` | `{goal, raised, tasks:{total,done,overdue}}` — money from contributions only |
| `fn_action_queue(role, user_id)` | Six rules (PRD §8) as `UNION ALL` selects with `reason`, `next_action`, `link` |
| `fn_renewal_reminders()` | Insert notifications for memberships expiring in exactly 30 and 7 days; `dedupe_key = membership_id:30d` makes reruns harmless |
| `fn_rate_limit(key, limit, window_sec)` | Upsert counter for the current bucket; returns `false` when exceeded |

### 7.5 State machines

| Entity | Transitions |
|---|---|
| Application | `draft → pending → approved \| rejected`; `rejected → pending` (revision + 1); `pending → withdrawn` |
| Checkout | `pending → paid → fulfilled`; `pending → expired \| failed \| cancelled` |
| Payment | `created → captured \| failed` |
| Ticket | `issued → checked_in`; `issued → cancelled` |
| Membership | `active → expired` (derived by date) / `cancelled` |
| Expense | `submitted → approved → paid`; `submitted → rejected` |
| Announcement | `draft → published → archived` |
| Task | `todo → in_progress → done`; `→ cancelled` |

The API never accepts a status value from a client for these entities; it calls a function or a fixed transition endpoint.

### 7.6 Scheduled jobs (`pg_cron`)

```sql
select cron.schedule('sky-expire-checkouts',  '* * * * *', $$ select fn_expire_checkouts() $$);
select cron.schedule('sky-renewal-reminders', '0 3 * * *', $$ select fn_renewal_reminders() $$);
```

Enable the extension in the project dashboard first (Database → Extensions). Verify by inserting an expired pending checkout and waiting one minute.

## 8. Money rules

1. Integer **paise** everywhere; the UI formats with `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })`.
2. Price resolution is server-side only: ticket price = `member_price_paise` when the buyer holds an active membership and the type has one; otherwise `price_paise`. Merch discount = tier `discount_percent` (rounded down to a whole paisa).
3. Zero-value checkouts (free tickets) are valid, are fulfilled, and create **no** ledger row.
4. A ledger row exists only after verified online capture or an authorized staff-recorded entry. Pending/failed/expired never count.
5. Ledger methods: `online_test` (Razorpay Test), `cash`, `manual_upi`. UI labels: "Razorpay Test", "Cash (staff-recorded)", "Manual UPI (staff-recorded)".
6. Treasurer headline is **"Recorded net movement"** — never "bank balance".
7. Refunds (P1) post a `reversal` row linked by `reverses_id`.

## 9. Code-based identity verification (USP)

### 9.1 Ticket code

- Format `SKY-XXXX-XXXX`; 8 characters from the **Crockford base32** alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I, L, O, U) → 32⁸ = 2⁴⁰ possibilities.
- Generated inside Postgres from `gen_random_bytes`, unique-indexed, **random** (not derived from anything guessable). It is stored in plain text because the buyer must be able to see it again; only the owner (via the API) and door staff (via check-in) can read it.
- Input normalisation: upper-case, strip spaces/dashes, `O→0`, `I/L→1`, optional leading `SKY`.

```sql
create or replace function gen_ticket_code() returns text language plpgsql as $$
declare alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        b bytea := extensions.gen_random_bytes(8); s text := ''; i int;
begin
  for i in 0..7 loop s := s || substr(alphabet, (get_byte(b, i) & 31) + 1, 1); end loop;
  return 'SKY-' || substr(s,1,4) || '-' || substr(s,5,4);
end $$;
```

(Issuing retries on the rare unique-violation.)

### 9.2 Member code

- 6 digits, valid **60 s** (`MEMBER_CODE_TTL_SECONDS`), one row per member, rotated in place; uniqueness guarantees a code identifies one member at a time.
- The member page requests a fresh code on load and every ~45 s while visible; a countdown ring shows time left.
- Only **staff** can verify; a verification returns the minimum fields and is audited. Brute-force defence: per-staff limit (default **10 attempts/minute**, 5 consecutive failures → 60 s lockout via `fn_rate_limit`), plus short validity.

### 9.3 Door console UX

Single screen: segmented `CodeInput`, auto-detects mode from length (6 digits = member, `SKY-…` = ticket), big result card (green ✔ / red ✖ with reason), "manual lookup" tab (name/email/student ID), cash-sale button. Works at 360 px; no camera permission is requested.

### 9.4 Threats considered

| Threat | Mitigation |
|---|---|
| Screenshot of a member code shared with a friend | 60-second validity; staff also sees the *name* and compares to the person |
| Guessing ticket codes | 40-bit random codes + staff-only endpoint + rate limit + audit |
| Re-using a ticket | Atomic single-use check-in |
| Shoulder-surfing a ticket code | Result shows holder name for visual confirmation; ticket codes are single-use |
| Staff abuse | Audit log of every verification and check-in with actor |

## 10. Payments (Razorpay Test Mode)

```text
Browser            API (Edge Fn)                    Razorpay              Postgres
  | POST /checkout (items, Idempotency-Key) -->    |                          |
  |                |-- fn_create_checkout ------------------------------->    | pending + reservation
  |                |-- POST /v1/orders (Basic auth, amount from DB) -->|      |
  | <-- {checkoutId, orderId, keyId, amount}       |                          |
  | Razorpay Checkout.js (keyId, orderId) ------------------------>|          |
  | <-- {payment_id, order_id, signature} ---------|                          |
  | POST /checkout/:id/verify ----------->|                                   |
  |                |-- HMAC-SHA256(order_id|payment_id, KEY_SECRET) == signature? (constant-time)
  |                |-- fn_fulfil_checkout('razorpay_verified') ------------>  | tickets/stock/ledger
  | Razorpay -> POST /webhooks/razorpay (backup path, raw body, X-Razorpay-Signature)
```

Rules: amount comes from `checkouts.total_paise`; callback alone is never proof; webhook verifies `HMAC-SHA256(rawBody, WEBHOOK_SECRET)` on the **exact raw bytes** before `JSON.parse`; dedupe by event ID; both paths call the same idempotent fulfilment; show a **"Test payment"** badge; never store card/UPI credentials. Use `crypto.subtle` (Web Crypto) for HMAC and `fetch` with Basic auth for orders — no Node SDK.

## 11. Demo data

See [demo-data.md](./demo-data.md). Summary: `scripts/seed.mjs` creates the five role accounts and ~55 student accounts through the Auth admin API, then replays `seed/demo-data.json` (**297 seed records**) through the same RPCs the app uses. Therefore ledger rows, tickets, stock and audit entries are real consequences, not inserts. Seeded purchases use `cash`/`manual_upi` (staff-recorded) and are labelled as such; **one live Razorpay Test payment is made by hand in the demo.** All seeded profiles have `is_demo = true`. The script reads secrets from `scripts/.env`, is idempotent (skips existing emails/slugs/SKUs) and has a `--reset` flag that refuses to run unless `DEMO_CLUB=true`.

## 12. Configuration and secrets

| Where | Variables | Rule |
|---|---|---|
| `apps/web/.env` | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_API_BASE_URL` | Browser-visible; non-secret only |
| Edge Function secrets | `APP_ORIGIN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MODE`, `CHECKOUT_TTL_MINUTES`, `MEMBER_CODE_TTL_SECONDS`, `LOG_LEVEL` | `supabase secrets set --env-file …`; `SUPABASE_URL`, anon and service-role keys are injected by the platform on hosted projects |
| `scripts/.env` | `SEED_SUPABASE_URL`, `SEED_SERVICE_ROLE_KEY`, `DEMO_ACCOUNT_PASSWORD` | Local only |

Rules: nothing hard-coded; `lib/env.ts` validates required variables with Zod at cold start and fails loudly; `.env*` ignored by Git (only `.env.example` committed); run a secret scanner (e.g. gitleaks) in CI; the service-role key never appears under `apps/web`; if a secret leaks, rotate it immediately in Supabase/Razorpay.

## 13. Testing strategy

| Layer | Tool | Must-pass cases |
|---|---|---|
| Database | pgTAP (`supabase test db`) | anon/authenticated read 0 rows on every table; cannot execute any `fn_*`; ledger update/delete blocked; stock cannot go negative; duplicate fulfilment creates 1 ticket set and 1 ledger set |
| Concurrency | Script firing N parallel `POST /checkout` | 20 requests for 5 remaining tickets → exactly 5 succeed; same for last hoodie |
| API | Deno test or Vitest + HTTP against `supabase functions serve` | Permission matrix (each role × sensitive endpoints, allowed and denied); webhook bad signature → 401; duplicate webhook → single fulfilment; validation errors → 422 |
| Codes | API tests | Ticket check-in once; second → `TICKET_ALREADY_CHECKED_IN`; wrong event rejected; expired member code → generic failure; rate limit triggers |
| Reconciliation | SQL check | `sum(in) − sum(out)` from ledger equals independent sum over checkout items + contributions − paid expenses |
| E2E | Playwright | The 5-minute demo path on a phone viewport |
| Static | ESLint, Prettier, `tsc --noEmit`, `deno check` | Zero errors |

## 14. CI/CD, deployment and rollback

**CI (`.github/workflows/ci.yml`, every PR):** install → lint → typecheck (web, contracts, `deno check` for api) → `astro build` → unit tests → secret scan. DB tests run locally/pre-merge (needs Docker).

**Deploy order (always):**

1. `supabase link --project-ref <ref>`
2. `supabase db push` (migrations)
3. `supabase secrets set --env-file supabase/.env.secrets`
4. `supabase functions deploy api --no-verify-jwt`
5. Razorpay dashboard → webhook URL `…/functions/v1/api/v1/webhooks/razorpay`, event `payment.captured` (and `payment.failed`), set the webhook secret
6. Build `apps/web` and publish to the static host (set the three `PUBLIC_` vars in the host's settings)
7. `node scripts/seed.mjs`
8. Smoke test with the five demo accounts

**Rollback:** function — redeploy the previous Git tag; database — migrations are forward-only, so ship a corrective migration (never edit an applied one); frontend — redeploy the previous build on the static host.

## 15. Day-0 technical spike (30–45 minutes, do first)

One person proves, on the real Supabase project:

- [ ] `GET /api/v1/health` returns 200 from the deployed Express function
- [ ] CORS preflight succeeds from the static-host origin
- [ ] A valid JWT → `req.user`; invalid → 401
- [ ] `POST` to the webhook route receives **raw bytes** and an HMAC over them matches a locally computed one
- [ ] One `rpc('fn_rate_limit')` call works with the service-role client
- [ ] `pg_cron` extension enabled

If Express misbehaves on any item, switch the same routes to Hono (`npm:hono`) the same afternoon — route files stay identical in shape.

## 16. Performance and limits

- Edge Functions have per-request CPU and memory limits: no large loops, no big JSON, paginate every list (`limit ≤ 50`).
- Index list filters: `tickets(event_id,status)`, `memberships(user_id,expires_on)`, `ledger_entries(effective_on)`, `audit_logs(created_at)`.
- Cold start is mitigated by the single-function design; ping `/health` every 5 minutes during the demo window if needed.
- Free-tier project pausing: log in and run a query the day before the demo.

## 17. Coding standards

TypeScript `strict`; no `any` without a comment; one route file per module; handlers ≤ 40 lines; no business rule in a handler if SQL can own it; no `console.log` of data; conventional commits; PRs ≤ 400 changed lines; every PR links an FR/ID from the PRD; every new endpoint updates [api-docs.md](./api-docs.md) in the same PR.
