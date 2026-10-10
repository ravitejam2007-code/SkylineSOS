# SkylineSOS — Project Memory

## Project Overview
- **Project Name:** SkylineSOS (Student Organization System for the Skyline Student Association)
- **Event:** Odoo × NMIT 2026 Hackathon
- **Repository:** https://github.com/ravitejam2007-code/SkylineSOS.git
- **Description:** A unified web platform for student clubs to manage memberships, events, announcements, merchandise, fundraisers, door check-ins via code verification, and club finances/treasury with full ledger traceability.

## Documentation Index (`docs/`)
- `PRD.md`: Product Requirements Document detailing user journeys, scenes, functional requirements, and acceptance criteria.
- `TRD.md`: Technical Requirements Document covering tech stack, data models, API contracts, security, and verification workflows.
- `architecture.md`: System architecture, component diagrams, state management, and deployment topology.
- `api-docs.md`: Comprehensive API specifications and endpoint reference.
- `Navigation-plan.md`: UI navigation hierarchy, routes, screens, and permission gates.
- `team-management.md`: Roles, responsibilities, permissions, and team workflow specifications.
- `demo-data.md`: Specification and seeding instructions for hackathon demonstration datasets.
- `frontend-api-integration-guide.md`: Comprehensive frontend developer guide with typed fetch client, error mappings, rate limit handling, and screen integration recipes.
- `demo-data.json`: Seed data JSON containing mock members, events, merchandise, and transactions.
- `.env.example`: Environment variable template.

## Progress & Completed Work
- **Git Repository Setup:**
  - Initialized local Git repository tracking remote `https://github.com/ravitejam2007-code/SkylineSOS.git`.
  - Synced with upstream `main` branch.
- **Documentation Migration:**
  - Staged and pushed the complete `docs/` folder along with initial project tracking assets.
- **R1 Tech Lead Roadmap & Architecture Analysis:**
  - Analyzed `docs/team-management.md`, `docs/TRD.md`, `docs/PRD.md`, `docs/api-docs.md`, and `docs/architecture.md`.
  - Created comprehensive R1 Execution Plan artifact (`r1_tech_lead_execution_plan.md`) covering Phase 0 Day-0 spike through Phase 4 rehearsal.
  - Defined key technical decisions (Express-on-Edge, contracts package, database-backed rate limiting, webhook raw-body HMAC, and cash-first scene delivery).
- **R1 Implementation (Phase 0 & Foundation Scaffolding):**
  - **Shared Contracts (`packages/contracts`):** Implemented all Zod schemas and TypeScript types for `common`, `auth`, `membership`, `events`, `checkout`, `merch`, `announcements`, `fundraisers`, `treasurer`, and `actions`. Verified clean build and typecheck.
  - **Supabase Edge Function API (`supabase/functions/api`):**
    - Configured `supabase/config.toml` with `verify_jwt = false` for the `api` function.
    - Implemented Express 4.18 bootstrap with raw-body parsing for `/api/v1/webhooks/razorpay` and JSON parsing for standard routes.
    - Built middleware stack: `requestId` tracing, CORS with `APP_ORIGIN`, JWT `authenticate` via Supabase Auth, `requireRole` RBAC, `validate` with Zod, database-backed `rateLimit`, and error envelope handler.
    - Implemented Web Crypto constant-time HMAC-SHA256 signature verification in `lib/hmac.ts`.
    - Implemented modular route handlers: `/health`, `/me`, `/public`, `/announcements`, `/membership`, `/door`, `/checkout` (Razorpay order/verify + staff cash/UPI), `/admin/events`, `/admin/merch`, `/fundraisers`, and `/treasurer`.
  - **CI/CD & Repository Hygiene:** Added `.gitignore`, root `.env.example`, and `.github/workflows/ci.yml`.
- **Supabase Cloud Project Connection & MCP Integration:**
  - Configured project ref `xwwkpwzartndbjlzpttc` across `.env` and `supabase/.env.local`.
  - Added Supabase MCP HTTP server via Claude CLI (`.mcp.json`).
  - Installed official Supabase agent skills (`supabase`, `supabase-postgres-best-practices`) into `.agents/skills/`.
- **Database Architecture & Seed Implementation (Phase 1 & Backup R2 Deliverables):**
  - **`supabase/migrations/0001_init.sql`**: Full DDL for all 18 tables, custom enums (`app_role`, `pay_method`, `item_type`), check constraints, foreign key indexes, trigger on `auth.users` for auto-profile creation, and trigger on `ledger_entries` ensuring append-only immutability.
  - **`supabase/migrations/0002_rls.sql`**: RLS deny-all configuration revoking all permissions from `anon` and `authenticated` browser roles, and granting complete access to `service_role`.
  - **`supabase/migrations/0003_functions.sql`**: Implemented all atomic business logic RPCs (`gen_ticket_code`, `fn_rate_limit`, `fn_issue_member_code`, `fn_verify_member_code`, `fn_create_checkout`, `fn_fulfil_checkout`, `fn_record_staff_checkout`, `fn_check_in`, `fn_expire_checkouts`, `fn_review_application`, `fn_set_expense_status`, `fn_record_contribution`, `fn_treasurer_overview`, `fn_event_summary`, `fn_fundraiser_progress`, `fn_action_queue`, `fn_renewal_reminders`).
  - **`supabase/migrations/0004_cron.sql`**: Background scheduling via `pg_cron` for expiring checkouts every minute and sending daily renewal reminders.
  - **Seed Loader (`scripts/seed.mjs` & `seed/demo-data.json`)**: End-to-end data loader replaying 297 seed records through the real RPCs, creating 5 staff demo accounts and students, and verifying mathematical reconciliation between ledger and source transactions.
- **Frontend Architecture & Web Application (`apps/web`):**
  - **Core Setup:** Astro 5 static output (`output: 'static'`) with React islands (`@astrojs/react`) and Tailwind CSS v4 (`@tailwindcss/vite`).
  - **Design System Tokens (`apps/web/src/styles/global.css`):** Configured `@theme` with Meta commerce tokens, Montserrat typography, cobalt `#0064e0` reserved strictly for buy/pay CTAs, and pill-shaped component primitives.
  - **Client Utilities (`apps/web/src/lib/`):** Currency formatter (`money.ts`), Supabase Auth browser client (`auth.ts`), API fetch wrapper handling the error envelope (`api.ts`), and client-side role guards (`guards.ts`).
  - **Interactive React Islands (`apps/web/src/islands/`):**
    - `DoorConsole.tsx`: High-speed door gate console auto-detecting 6-digit member codes vs 8-char ticket codes, visual result cards, and attendee lookup.
    - `MemberCard.tsx`: Digital student pass with real-time 60-second countdown and dynamic code rotation.
    - `LoginPanel.tsx`: Authentication screen with 1-click role switcher for demo accounts (`Admin`, `Treasurer`, `Door`, `Volunteer`, `Member`).
  - **Application Routes (`apps/web/src/pages/`):**
    - Public: `/` (Landing/Hero), `/events`, `/membership`, `/announcements`, `/merch`, `/login`.
    - Operations & Member: `/door`, `/membership/card`, `/admin`, `/treasurer`, `/403`, `/404`.
- **Frontend Web Application (`apps/web`):**
  - **Tech Stack & Tokens:** Astro 5 static site with Tailwind CSS v4 design tokens from `docs/TRD.md §5.5` in `src/styles/global.css` and `@fontsource-variable/montserrat`.
  - **Client Infrastructure:** `lib/money.ts` (paise currency formatter), `lib/auth.ts` (Supabase browser auth), `lib/api.ts` (authenticated API client with error envelope handling), and `lib/guards.ts` (client role guards).
  - **Interactive React Islands:**
    - `DoorConsole.tsx`: Gate check-in console with dual-mode detection (6-digit member code and Crockford ticket code), visual outcome cards, and manual attendee search.
    - `MemberCard.tsx`: Digital membership card with auto-refreshing 60-second dynamic verification code and animated countdown timer.
    - `CheckoutPanel.tsx`: Ticket & merchandise purchase drawer supporting online Razorpay payments and staff cash/UPI checkouts with audit notes.
    - `TreasurerLedger.tsx`: Real-time financial statistics (Net Movement, Inflow, Outflow) and immutable source-linked ledger table with category filters.
    - `LoginPanel.tsx`: Authentication screen featuring 1-click quick sign-in for all 5 demo role accounts (`admin`, `treasurer`, `door`, `volunteer`, `member`).
- **Full Backend API Completion (100% Coverage of `docs/api-docs.md`):**
  - **45+ Endpoints Implemented:**
    - **System & Profile (`/me`, `/health`):** `GET /health`, `GET /me`, `PATCH /me`, `GET /me/notifications`, `POST /me/notifications/:id/read`, `GET /me/preferences`, `PUT /me/preferences`, `GET /me/membership`, `GET /me/membership/history`, `POST /me/verify-code` (with `expiresAt` & `ttlSeconds`), `GET /me/tickets`, `GET /me/orders`.
    - **Public Content (`/public`, `/announcements`):** `GET /public/events`, `GET /public/events/:slug` (with real-time capacity and ticket availability computation), `GET /public/tiers`, `GET /public/merch`, `GET /public/merch/:id`, `GET /announcements` (role-filtered visibility).
    - **Membership Management:** `POST /membership/applications`, `PUT /membership/applications/:id` (resubmit rejected applications incrementing revision), `GET /admin/membership/applications`, `POST /admin/membership/applications/:id/review`, `POST /admin/members/walk-up` (with door staff restriction & temporary password generation), `GET /admin/tiers`, `POST /admin/tiers`, `PATCH /admin/tiers/:id`.
    - **Identity & Door Operations:** `POST /staff/verify/member`, `GET /staff/members?q=` (profile search with minimal fields for door/treasurer and full for admin), `GET /door/tickets` (with rate limiting, attendee search, email masking, ticket code redaction), `POST /door/check-in` (with real-time sold/checked-in counters and checked-in staff details in conflict response).
    - **Events & Ticketing:** `GET /admin/events`, `POST /admin/events`, `PATCH /admin/events/:id`, `POST /admin/events/:id/ticket-types`, `PATCH /admin/ticket-types/:id`, `GET /admin/events/:id/summary`.
    - **Checkout & Payments:** `POST /checkout` (handles free checkouts, computes Razorpay order, maps `type`/`itemType` and `refId`/`ref_id`), `GET /checkout/:id`, `POST /checkout/:id/verify` (returns issued tickets), `POST /checkout/:id/cancel` (releases reservations), `POST /staff/checkout` (supports guest/walk-in buyer, notes, ticket restrictions for door staff), `POST /webhooks/razorpay` (raw body constant-time HMAC-SHA256 signature verification).
    - **Announcements Admin:** `GET /admin/announcements`, `POST /admin/announcements`, `PATCH /admin/announcements/:id`, `POST /admin/announcements/:id/publish`, `POST /admin/announcements/:id/archive`.
    - **Merchandise Admin:** `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/:id`, `POST /admin/products/:id/variants`, `PATCH /admin/variants/:id` (audited stock delta), `GET /admin/orders`, `PATCH /admin/orders/:itemId/fulfilment`.
    - **Fundraising & Tasks:** `GET /fundraisers`, `POST /fundraisers`, `GET /fundraisers/:id/progress`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id` (volunteer status-only restriction), `POST /fundraisers/:id/contributions`.
    - **Treasury, Audit & Platform Admin:** `GET /treasurer/overview`, `GET /treasurer/ledger`, `POST /expenses`, `GET /expenses`, `POST /expenses/:id/status` (self-approval guard), `GET /audit`, `GET /actions` (dynamic action queue), `GET /admin/overview` (aggregate counts for admin home), `GET /admin/users?q=` (user search), `PATCH /admin/users/:id/role` (last-admin demotion protection with `role.grant` audit log).
  - **Database RPC & Middleware Enhancements:**
    - `0003_functions.sql`: `fn_create_checkout` and `fn_record_staff_checkout` accept both `itemType`/`type` and `refId`/`ref_id`; `fn_verify_member_code` outputs complete camelCase and snake_case properties; `fn_check_in` returns counters (`sold, checkedIn, capacity`) and audits check-ins.
    - `middleware/errors.ts`: Sorted `knownCodes` descending by length to guarantee exact, specific error codes (e.g. `TICKET_NOT_FOUND`, `TICKET_ALREADY_CHECKED_IN`) are never shadowed by shorter substrings (`NOT_FOUND`, `CONFLICT`).
  - **Automated Backend Test Suite (`tests/`):**
    - **57 tests across 16 suites** covering 100% of routes, middleware, and business contracts:
      1. `tests/middleware.test.mjs` (13 tests): `requestId` UUID generation & preservation, `rbac` role enforcement & 401/403 status codes, `validate` with formatted issues list & 422 status, database-backed `rateLimit` with `Retry-After` & 429 status, `notFound` 404 envelope, and `errorHandler` status mapping & internal error scrubbing.
      2. `tests/routes.test.mjs` (20 tests): System & profile routes, live availability calculation for events & ticket types, audience filtering, application resubmission revision checks, walk-up door restrictions, door check-in collision detection, code redaction & email masking, zero-total checkout bypass, note requirements for cash/UPI, self-approval prevention on expenses, last-admin demotion prevention, and reserved stock protections.
      3. `tests/backend.test.mjs` (24 tests): Razorpay payment & webhook raw body HMAC-SHA256 constant-time verification, door ticket code normalization (case-insensitivity, O→0, I/L→1, Crockford format), error envelope and HTTP status code mappings (`401`, `403`, `404`, `409`, `422`, `429`), RBAC role authorization matrix, and shared Zod contract validation (`@skylinesos/contracts`).
    - Verified clean run with 100% pass rate (`npm test`).
  - **Frontend Engineering Integration Guide (`docs/frontend-api-integration-guide.md`):**
    - Created comprehensive developer guide with typed `api` client boilerplate, complete error code reference, rate limit policies, pre-seeded demo login table, and screen-by-screen code recipes (digital pass, online checkout with Razorpay popup, door console dual-mode scanner, staff cash/UPI desk, treasury tiles, and action queue).
- **Phase 7 Database Integrity & Concurrency Verification:**
  - **Automated Integrity Test Suite (`tests/integrity.test.mjs`):**
    - 22 dedicated invariant tests covering:
      1. Ledger immutability (`trg_protect_ledger`) preventing update/delete and mathematical equality (`Inflow - Outflow = Net Movement`).
      2. Event capacity bounds preventing flash-crowd overselling.
      3. Single-use door ticket check-in preventing duplicate admission and preserving timestamps.
      4. Merchandise stock formula (`available = stock_on_hand - reserved`) and checkout expiration releases.
      5. Payment webhook deduplication via `provider_event_id` and idempotent checkout fulfilment.
      6. Expense segregation of duties (self-approval forbidden, approval required before payment).
      7. Dynamic 60s rotating member code expiration.
      8. Zero-secret audit logs and last-admin demotion prevention.
    - Full test suite now expanded to **79 tests across 24 suites with 100% pass rate** (`npm test`).
  - **Live Database Integrity Script (`scripts/verify-integrity.mjs`):**
    - Script (`npm run verify:integrity`) verifying 27 core tables, ledger mathematical reconciliation, stock invariants, and zero duplicate check-ins against remote Supabase database.
  - **Phase 7 Documentation (`docs/DATABASE_INTEGRITY.md`):**
    - Documented all 8 core invariants (`INV-01` to `INV-08`), concurrency race condition mitigations, and verification procedures.
- **Supabase Cloud Remote Deployment & Database Seeding (Project `xwwkpwzartndbjlzpttc`):**
  - **Database Migrations:** Applied all 5 migrations (`0001_init.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_cron.sql`, `0005_fix_checkout_order.sql`). Fixed foreign-key constraint ordering in `fn_create_checkout` and variable declarations in `fn_check_in`.
  - **Remote Database Seeding (`scripts/seed.mjs`):** Successfully executed the full 297 seed records against the cloud database. Created 60 user profiles, 3 membership tiers, 5 events, 10 ticket types, 4 products, 9 variants, fulfilled 28 membership dues checkouts via RPC, 37 ticket purchases and check-ins, 30 merch checkouts, 12 fundraiser contributions (₹5,900), and 10 expenses. Verified ledger reconciliation (Total Income: ₹52,192, Total Outflow: ₹7,500, Net: ₹44,692).
  - **Supabase Edge Function Deployment (`api`):** Deployed Express Edge Function with `--no-verify-jwt` to `https://xwwkpwzartndbjlzpttc.supabase.co/functions/v1/api/v1`. Verified live health check endpoint returning `{"data":{"ok":true,"version":"v1"}}`.
  - **Pure Dynamic Environment Configuration:** Removed all hardcoded keys and secrets from TypeScript code in `supabase/functions/api/lib/env.ts`. Implemented dynamic multi-path `.env` parser reading from `.env` and `supabase/.env.local`, overlaid with runtime environment variables.
- **GitHub Actions CI Hardening & Deno Resolution:**
  - Resolved CI workflow failure (red ❌ icon) by adding root `deno.json` with `"nodeModulesDir": "auto"`, configuring `denoland/setup-deno@v2` with explicit `--config supabase/functions/api/deno.json` in `ci.yml`, fixing Web Crypto BufferSource typing in `lib/hmac.ts`, and integrating `npm test` into the CI pipeline.
- **Frontend Application Integration & Optimization (`Frontend/`):**
  - **Target Environment Update:** Configured `Frontend/.env` and `Frontend/.env.example` with the active Supabase project `xwwkpwzartndbjlzpttc` and edge function base URL `https://xwwkpwzartndbjlzpttc.supabase.co/functions/v1/api/v1`.
  - **Removal of Unnecessary Assets & Route Deduplication:**
    - Removed 32 legacy documentation markdown files in `Frontend/src/styles/transitions/` and purged the directory.
    - Converted duplicate route `Frontend/src/pages/finance.astro` into a permanent redirect to `/treasurer` and updated all navigation links across `index.astro`, `500.astro`, and auth utilities.
    - Added canonical `/membership.astro` redirecting to `/memberships`.
    - Standardized branding and page titles in `signup.astro` to SkylineSOS.
  - **Official Typed API Client (`Frontend/src/lib/api.ts`):**
    - Replaced mock local storage client with the official typed client specified in `docs/frontend-api-integration-guide.md §3`.
    - Automatic session JWT retrieval via Supabase Auth (`Authorization: Bearer <jwt>`).
    - Automatic UUID `Idempotency-Key` headers on mutating requests.
    - Typed `ApiError` class with status codes, error code mapping, and `requestId` tracking.
    - Implemented `startOnlineCheckout` with Razorpay modal integration and backend signature verification.
    - Implemented `recordStaffDeskSale` for staff cash and manual UPI checkouts with audit notes.
    - Added high-level typed service wrappers for public events, memberships, ticket sales, merch, announcements, fundraisers, and treasury.
  - **End-to-End Scene Integrations:**
    - `TreasurerScene.tsx`: Connected to `GET /treasurer/overview` and `GET /treasurer/ledger`, supporting both snake_case and camelCase ledger records.
    - `StudentPortalScene.tsx`: Connected to `POST /me/verify-code` with live 60-second rotating door code countdown.
    - `MerchScene.tsx`: Integrated multi-product tab pills across all 4 seeded catalog items with real-time stock levels and `/checkout` ordering.
    - `EventOperationsScene.tsx`: Gate check-in console with dual-mode detection (6-digit numeric pass routes to `POST /staff/verify/member`; Crockford ticket code routes to `POST /door/check-in`).
    - `EventsScene.tsx`: Integrated ticket purchase flow with `POST /checkout` and staff cash desk sales with `POST /staff/checkout`.
    - `MembershipScene.tsx`: Connected to `GET /public/tiers`, `POST /membership/applications`, `POST /admin/members/walk-up`, and `POST /admin/membership/applications/:id/review`.
    - `AdminDashboardScene.tsx`: Connected to `GET /admin/overview`, displaying live active members, pending applications, and low stock variant alerts.
    - `AnnouncementsScene.tsx`: Connected to `GET /public/announcements`, `POST /admin/announcements`, and `PUT /me/preferences`.
    - `FundraiserScene.tsx`: Connected to `GET /fundraisers`, `POST /tasks`, and `POST /fundraisers/:id/contributions`.
  - **Verification:**
    - `npm run build` in `Frontend/` built all 20 static pages in 5.95s with zero errors.
    - `npm test` at workspace root executed 79 tests across 24 suites with 100% pass rate.
- **Troubleshooting & Fix: Supabase Auth DNS Failure (`leifxoxnqnvezbmdtmcr`):**
  - **Issue:** Browser reported `net::ERR_NAME_NOT_RESOLVED` hitting `https://leifxoxnqnvezbmdtmcr.supabase.co/auth/v1/signup`.
  - **Root Cause:** The project `leifxoxnqnvezbmdtmcr` is decommissioned/deleted (`DNS_ERROR_RCODE_NAME_ERROR`). An active dev server (PID 29784) was holding onto obsolete credentials from `C:\Users\javal\Videos\CampusOne\frontend\.env`.
  - **Resolution:**
    - Verified DNS resolution for active project `xwwkpwzartndbjlzpttc.supabase.co` (`104.18.38.10`, `172.64.149.246`).
    - Updated both [`Frontend/.env`](file:///c:/Users/javal/Videos/SkylineSOS/Frontend/.env) and [`CampusOne/frontend/.env`](file:///c:/Users/javal/Videos/CampusOne/frontend/.env) to point to the active project `xwwkpwzartndbjlzpttc`.
- **6-Digit Dynamic Identity Verification (Replacing QR Code as Primary):**
  - **Student Portal ([`StudentPortalScene.tsx`](file:///c:/Users/javal/Videos/SkylineSOS/Frontend/src/components/scenes/StudentPortalScene.tsx)):**
    - Replaced the large QR code presentation with the prominent **Official 6-Digit Dynamic Door Verification Pass**.
    - Displays large, high-contrast monospace code (`482 915`) with a live 60-second countdown bar.
    - Added auto-rotation every 60s via `POST /me/verify-code` (`api.getRotatingDoorPass`), plus manual "Refresh Code" and "Copy Code" actions.
  - **Gate & Door Operations ([`EventOperationsScene.tsx`](file:///c:/Users/javal/Videos/SkylineSOS/Frontend/src/components/scenes/EventOperationsScene.tsx)):**
    - Established **`🔢 6-Digit Member Pass`** as the default primary verification mode.
    - Staff enters attendee's 6-digit dynamic code, which verifies immediately via `POST /staff/verify/member`.
    - Shows instant green admission card with member name, student ID, tier, and validity.
  - **Events Scene ([`EventsScene.tsx`](file:///c:/Users/javal/Videos/SkylineSOS/Frontend/src/components/scenes/EventsScene.tsx)):**
    - Converted the Door Check-in terminal into a dedicated 6-digit member code and Crockford ticket code identity verification terminal, removing mock QR graphics.
  - **API Client ([`Frontend/src/lib/api.ts`](file:///c:/Users/javal/Videos/SkylineSOS/Frontend/src/lib/api.ts)):**
    - Added `api.getRotatingDoorPass()` (`POST /me/verify-code`) and `api.verifyMemberByCode()` (`POST /staff/verify/member`).




