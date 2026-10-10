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
