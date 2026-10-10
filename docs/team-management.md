# SkylineSOS — Team Management Plan

| | |
|---|---|
| **Version** | 3.0 |
| **Date** | 10 October 2026 |
| **Team size** | 4 |
| **Team skills** | Frontend and backend only (no dedicated DevOps, DBA, QA or designer) |
| **Read with** | [PRD](./PRD.md) · [TRD](./TRD.md) · [API Docs](./api-docs.md) · [Navigation Plan](./Navigation-plan.md) |

> **How to use this file:** fill in names in §1, run the kickoff checklist (§11), then follow the phases (§6). Phases are percentages of your build window; the hour examples assume **~36 hours** — scale them to the real schedule.

---

## 1. Roster

| Role | Person (fill in) | Primary skill | Backup for |
|---|---|---|---|
| **R1 — Tech Lead · API & Payments** (Backend) | ______ | Node/Express, APIs, security basics | R2 |
| **R2 — Database & Integrity** (Backend) | ______ | SQL / data modelling, careful thinker | R1 |
| **R3 — Frontend Lead · Design System** (Frontend) | ______ | Astro/React/Tailwind, component design | R4 |
| **R4 — Operations UI · QA · Demo** (Frontend) | ______ | UI + testing + presenting | R3 |

**Choosing who is who.** Each person rates themselves 1–5 on: *Express/API*, *SQL*, *Tailwind/design systems*, *forms and state*, *testing*, *presenting*. Give R2 the person with the highest SQL score (or the one most willing to learn it — §9); R1 the strongest backend/security person; R3 the strongest CSS/design eye; R4 the best communicator who also likes testing.

**Why these four roles.** The product has four risk areas that need an owner: (1) the API and payments surface, (2) money and data correctness, (3) the public/member experience and design system, (4) the operational screens plus proof that everything works. All four use only frontend or backend skills.

## 2. Role charters

### R1 — Tech Lead · API & Payments

**Mission:** a secure, boring, well-documented API.

| Owns | Responsibilities | Done when |
|---|---|---|
| `supabase/functions/api/**`, `api-docs.md`, `.github/workflows/**`, deployment | Day-0 Express-on-Edge spike · auth, RBAC, validation, error and rate-limit middleware · every route handler · Razorpay order/verify/webhook · idempotency · CORS · secrets/`.env` hygiene · deployment pipeline · final security review of every PR touching auth or money | All endpoints in `api-docs.md` return the documented shapes; permission matrix test passes; webhook rejects bad signatures; deploy is one command |

**Also:** keeps `api-docs.md` the single contract, runs the daily 10-minute sync, decides scope cuts.

### R2 — Database & Integrity

**Mission:** money and stock can never be wrong.

| Owns | Responsibilities | Done when |
|---|---|---|
| `supabase/migrations/**`, `supabase/tests/**`, `scripts/**`, `seed/**`, `demo-data.md` | Schema and constraints · RLS deny-all + revokes · all `fn_*` functions (checkout, fulfil, check-in, member code, ledger, overview, action queue) · `pg_cron` jobs · pgTAP and concurrency tests · reconciliation check · seed script (297 records via real RPCs) | Parallel-purchase test passes; duplicate fulfilment test passes; anon/authenticated read nothing; seed loads on a clean project in < 3 minutes |

### R3 — Frontend Lead · Design System

**Mission:** a fast, accessible, on-brand UI that feels like one product.

| Owns | Responsibilities | Done when |
|---|---|---|
| `apps/web/src/{components,layouts,styles,lib}/**`, public + member pages, `Navigation-plan.md` | Astro + Tailwind v4 setup · tokens from `DESIGN-meta.md` · reusable components (Button, Card, Badge, Field, Modal, Toast, States) · auth pages · public pages · member dashboard/card/tickets/orders · checkout UI and Razorpay launch · member-code panel with countdown · responsive and a11y pass | All public/member routes in the nav plan work on 360 px; the four UI states exist everywhere; no hard-coded colours outside tokens |

### R4 — Operations UI · QA · Demo

**Mission:** staff screens that are fast under pressure, and proof it all works.

| Owns | Responsibilities | Done when |
|---|---|---|
| `apps/web/src/pages/{admin,door,treasurer,volunteer}/**`, `apps/web/src/islands/ops/**`, `e2e/**`, `README.md` | Door console (code entry, lookup, cash sale) · admin screens · treasurer screens · volunteer screens · action-queue UI · Playwright demo path · bug triage list · demo script, rehearsals, slides, README | Door verification ≤ 10 s on a phone; E2E demo path green; README gets a newcomer running in 15 minutes; presents the demo |

## 3. Ownership map and code review

```text
CODEOWNERS (suggested)
/supabase/functions/        @R1   (review: @R2)
/supabase/migrations/       @R2   (review: @R1)
/supabase/tests/  /scripts/ /seed/   @R2
/apps/web/src/components/ /layouts/ /styles/ /lib/   @R3   (review: @R4)
/apps/web/src/pages/{index,events,event,announcements,membership,merch,my,checkout,login,register}*   @R3
/apps/web/src/pages/{admin,door,treasurer,volunteer}/   @R4   (review: @R3)
/packages/contracts/        @R1 + @R3 (both approve)
/docs/  /*.md               @R4 (R1 approves api-docs.md)
```

**Review rule:** every PR needs one approval from the *other discipline* (backend ↔ frontend) for contract changes, and from the code owner otherwise. Anything touching **auth, money, codes or secrets also needs R1** (or R2 if R1 is the author).

## 4. Who is responsible for what (RACI by scene)

R = does the work · A = accountable · C = consulted · I = informed

| Scene | R1 API | R2 DB | R3 Public/Member UI | R4 Ops UI/QA |
|---|:-:|:-:|:-:|:-:|
| 1 Join (apply, approve, dues, card, codes) | R | R | R (apply/status/card) | R (admin review, door verify) |
| 2 Gala (tickets, checkout, check-in, summary) | R (+Razorpay) | R | R (event, checkout, tickets) | R (door console, summary) |
| 3 Announcements | R | R (small) | R (feed, prefs) | R (admin editor) |
| 4 Hoodies | R | R (stock) | R (merch pages) | R (admin merch) |
| 5 Fundraiser | R | R | C | R (board, contributions) |
| 6 Treasurer | R | R (ledger/overview) | I | R (overview, ledger, expenses, audit) |
| Cross-cutting: security, deploy | A/R | R | C | C |
| Cross-cutting: tests, demo | C | R (DB tests) | C | A/R |
| Accountable for the scene overall | **A** for scenes 2, 6 | **A** for scenes 1, 4 | **A** for 3 | **A** for 5 |

## 5. Work breakdown (task IDs for the board)

Estimates are focused hours for one person.

### Phase 0 — Setup and spike (first ~10 %)

| ID | Task | Owner | Est | Depends |
|---|---|---|---|---|
| T-01 | Repo, branch protection, CODEOWNERS, `.gitignore`, `.env.example` | R4 | 0.5 | — |
| T-02 | Supabase project; Auth: confirm-email **off**; enable pg_cron | R2 | 0.5 | — |
| T-03 | **Day-0 spike** (TRD §15): health route, CORS, JWT, raw-body webhook, rate-limit RPC | R1 | 1.5 | T-02 |
| T-04 | Astro + React + Tailwind v4 + Montserrat + tokens + `Button/Card/Badge` | R3 | 2 | T-01 |
| T-05 | `packages/contracts`: zod schemas for first 10 endpoints | R1 | 1 | T-03 |
| T-06 | Migration 0001 (all tables) + 0002 (RLS/revokes) | R2 | 2 | T-02 |
| T-07 | Task board (columns/labels), CI skeleton | R4 | 1 | T-01 |

**Exit:** hello route live on Supabase; static site deployed; tables exist; everyone can run the project locally.

### Phase 1 — Foundations (~10–30 %)

| ID | Task | Owner | Est | Depends |
|---|---|---|---|---|
| T-10 | `fn_create_checkout`, `fn_fulfil_checkout`, `fn_record_staff_checkout`, `fn_expire_checkouts` | R2 | 5 | T-06 |
| T-11 | pgTAP: deny-all, idempotent fulfilment, no negative stock | R2 | 2 | T-10 |
| T-12 | Middleware: auth, rbac, validate, errors, requestId, rateLimit | R1 | 3 | T-03 |
| T-13 | Routes: `/me`, `/public/*`, `/announcements`, tiers | R1 | 2 | T-12 |
| T-14 | App shell layouts (Public, Member, Staff), nav bars, guards, `api.ts` | R3 | 3 | T-04 |
| T-15 | Form components + Field/Input/Select/Modal/Toast/States | R3 | 3 | T-04 |
| T-16 | Login/register pages, role redirect | R3 | 1.5 | T-14 |
| T-17 | Staff layout + `DataTable`, `StatTile`, `CodeInput` | R4 | 3 | T-04 |
| T-18 | Mock server (fixtures from `api-docs.md`) so UI work never waits for the API | R4 | 1.5 | T-05 |

**Exit:** a user can register, log in, be redirected by role; checkout functions pass tests; UI builds against mocks.

### Phase 2 — Six scenes as thin slices (~30–65 %)

| ID | Task | Owner | Est | Scene |
|---|---|---|---|---|
| T-20 | `fn_review_application`, member-code functions, `fn_verify_member_code`, audit helpers | R2 | 4 | 1 |
| T-21 | Membership routes (apply, edit, review, walk-up, verify-code, verify member) | R1 | 4 | 1 |
| T-22 | Apply, status, card (+ code countdown), history pages | R3 | 5 | 1 |
| T-23 | Admin applications + members + walk-up UI | R4 | 4 | 1 |
| T-24 | `fn_check_in`, ticket code generation, `fn_event_summary` | R2 | 3 | 2 |
| T-25 | Event/ticket/checkout/door routes (without Razorpay: cash first) | R1 | 4 | 2 |
| T-26 | Events list/detail, ticket picker, checkout summary, my tickets | R3 | 5 | 2 |
| T-27 | **Door console** (code, lookup, cash sale, counters) | R4 | 5 | 2 |
| T-28 | Announcements: routes + admin editor + member feed + preferences | R1/R4/R3 | 3+2+2 | 3 |
| T-29 | Merch: stock logic verified, routes, merch pages, admin merch | R2/R1/R3/R4 | 1+2+3+2 | 4 |
| T-30 | Fundraiser/task/contribution functions + routes + board UI + volunteer page | R2/R1/R4 | 2+2+4 | 5 |
| T-31 | Ledger overview functions + treasurer routes + overview/ledger/expenses/audit UI | R2/R1/R4 | 3+2+5 | 6 |
| T-32 | `fn_action_queue` + `/actions` + UI list | R2/R1/R4 | 2+0.5+1.5 | all |

**Exit:** the 5-minute script runs end-to-end on **cash/manual UPI**, locally and on the deployed project.

### Phase 3 — Payments, codes hardening, seed (~65–80 %)

| ID | Task | Owner | Est |
|---|---|---|---|
| T-40 | Razorpay order + verify + webhook (raw body) + idempotency | R1 | 4 |
| T-41 | Razorpay launch UI, "Test payment" labelling, expiry countdown | R3 | 3 |
| T-42 | Rate limiting on verify/check-in/code routes; audit rows for each | R1 | 2 |
| T-43 | pg_cron jobs enabled and verified (expiry + reminders) | R2 | 1.5 |
| T-44 | **Seed script**; load 297 records through RPCs; reconciliation check | R2 | 4 |
| T-45 | Notifications UI + reminder display | R3 | 1.5 |

**Exit:** online payment works; seeded club looks alive; reconciliation passes.

### Phase 4 — Hardening and rehearsal (~80–100 %)

| ID | Task | Owner | Est |
|---|---|---|---|
| T-50 | Concurrency test (20 parallel buys of last 5) · permission-matrix tests | R2 / R1 | 2+2 |
| T-51 | Playwright demo path on a phone viewport | R4 | 3 |
| T-52 | A11y + responsive pass (360 px), empty/error states audit | R3 | 3 |
| T-53 | Security checklist: secrets scan, CORS origin, headers, service key absent from bundle | R1 | 1.5 |
| T-54 | README, demo script cards, slides, backup plan printed | R4 | 3 |
| T-55 | **Feature freeze at ~90 %**; three full rehearsals with a timer; fix only blockers | all | 3 |
| T-56 | Un-pause Supabase, warm the API, confirm all five accounts the morning of the demo | R1 | 0.5 |

## 6. Timeline at a glance (example: 36 h)

| Phase | Hours | Focus | Gate |
|---|---|---|---|
| 0 | 0 – 3.5 | Setup + spike | Hello route on Supabase |
| 1 | 3.5 – 11 | Foundations | Login by role; checkout functions tested |
| 2 | 11 – 23 | Six scenes (cash path) | Demo script works on cash/UPI |
| 3 | 23 – 29 | Razorpay, rate limits, seed | Online payment + seeded data |
| 4 | 29 – 36 | Tests, polish, rehearse | Three clean rehearsals; freeze at ~h32 |

## 7. If time runs short — cut order

Never cut a **scene**; thin it. Cut these first, in order:

1. Rejection reapply UI polish (keep API)
2. Preferences page (keep API)
3. Notifications UI (keep reminders in the action queue)
4. Task priority/due editing UI (keep status change)
5. Expense reject-reason UI polish
6. Audit log filters
7. Razorpay (fallback to cash/UPI only — say so honestly)

**Never cut:** auth + RBAC, atomic checkout/fulfilment, single-use check-in, ledger uniqueness, secrets hygiene, labelling of test/cash/UPI.

## 8. Collaboration rules

### 8.1 Git

- `main` is always deployable; protected; no direct pushes; squash-merge.
- Branches: `feat/T-27-door-console`, `fix/T-44-seed-idempotency`, `chore/ci`.
- Commits: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); reference the task ID.
- PRs ≤ 400 changed lines, with a screenshot for UI and a curl/response for API; link PRD IDs (`FR-14`).
- Migrations: **never edit an applied migration**; add a new numbered file. R2 owns numbering to avoid clashes.
- Rebase on `main` before opening a PR; resolve conflicts in your own folders first.

### 8.2 Contract-first

1. Anyone who needs a new/changed endpoint edits `api-docs.md` in a PR **first**.
2. R1 approves; the frontend can immediately build against the mock (T-18).
3. Backend implements; the PR that changes behaviour must also change the doc.

### 8.3 Environments and secrets

- Each developer has a local `.env` (never committed). Shared secrets are passed in person or via a password manager — **not** chat screenshots.
- One shared Supabase project and one Razorpay Test account for the team; R1 holds the dashboard credentials.
- If a key leaks: rotate immediately, tell the team, check `git log -p` for the string.

### 8.4 Definition of done (every task)

- [ ] Meets the PRD acceptance criteria (`FR-xx`)
- [ ] Types pass (`tsc`, `deno check`), lint clean
- [ ] Loading / empty / error / success states exist (UI)
- [ ] Permission checked server-side (API) and tested for one denied role
- [ ] `api-docs.md` updated (API)
- [ ] Reviewed by the right person; merged to `main`
- [ ] Verified on the **deployed** environment, not only locally

### 8.5 Communication

- One chat group + one task board. Blockers are posted immediately with `BLOCKED:` and a task ID.
- **Daily sync, 10 minutes** (stand-up, led by R1): done · next · blocked.
- **Integration hour** at the end of each phase: merge, deploy, click through together.
- Decisions go into a short `docs/decisions.md` list (date, decision, who) so nobody re-litigates.

### 8.6 Task board

Columns: **Backlog → Ready → In progress (max 2 per person) → In review → Done**. Labels: `scene-1`…`scene-6`, `api`, `db`, `ui`, `test`, `blocker`, `cut-candidate`. Each card lists owner, estimate, task ID and PRD IDs.

## 9. Skill gaps and a quick learning plan

| Gap | Who | Learn in | Source of truth |
|---|---|---|---|
| SQL, constraints, transactions, row locks (`FOR UPDATE`) | R2 (R1 buddy) | 2 h guided: read TRD §7, run each `fn_*` in the Supabase SQL editor | TRD §7 + Supabase docs |
| Postgres functions (`plpgsql`), `RAISE EXCEPTION` | R2 | 1 h | Same |
| Deno/Edge Function differences from Node (`npm:` imports, `Deno.serve`, env) | R1 | 1 h | Supabase Edge Functions docs |
| HMAC/signature verification, constant-time compare | R1 | 30 min | TRD §10 |
| Tailwind v4 `@theme` tokens | R3 | 1 h | Tailwind docs |
| Astro islands (`client:load`) | R3, R4 | 1 h | Astro docs |
| Playwright basics | R4 | 1 h | Playwright docs |
| pgTAP basics | R2 | 1 h | `supabase test db` docs |

**Pairing rule:** the first `fn_*` function is written by R2 *with* R1 on a call; after that they review each other's.

## 10. Risks and escalation

| Risk | Trigger | Owner | Action |
|---|---|---|---|
| Express-on-Edge issue | Spike fails | R1 | Switch to Hono the same day (routes stay identical) |
| SQL learning curve slows R2 | No working `fn_create_checkout` by ~h8 | R1 | R1 pairs for 2 h; reduce item types in phase 1 |
| UI blocked by API | Missing endpoint | R3/R4 | Use mock (T-18); post `BLOCKED:` |
| Merge conflicts | Two people editing a shared file | All | Stay in owned folders; shared files via PR with the owner |
| Demo-day outage | Supabase paused / Wi-Fi | R1 / R4 | Un-pause the day before; phone hotspot; cash/UPI fallback path |
| Burnout / uneven load | Anyone > 2 blocked tasks or no sleep | R1 | Rebalance tasks at the next sync; cut by §7 |

## 11. Checklists

**Kickoff (first 30 minutes)**
- [ ] Names in the roster; self-ratings done; roles confirmed
- [ ] Read PRD §5–§7 together (15 min)
- [ ] Repo created, everyone has access, CODEOWNERS set
- [ ] Supabase and Razorpay Test accounts created; credentials shared securely
- [ ] Task board filled from §5
- [ ] Daily sync time agreed

**Pre-demo (T-minus 2 hours)**
- [ ] Deployed URLs open on phone and laptop; five accounts log in
- [ ] Supabase project active; API `/health` is 200
- [ ] Razorpay Test checkout completes once; webhook received
- [ ] Seed data present; treasurer totals reconcile
- [ ] Door phone has data/hotspot; fallback cash path rehearsed
- [ ] Slides and printed demo cards ready; roles in the demo assigned

## 12. Demo roles

| Part | Person |
|---|---|
| Narrator / pitch (USP, problem, security) | R4 |
| Driver — member and public screens | R3 |
| Driver — staff screens (door, admin, treasurer) | R4 or R1 |
| Technical Q&A (architecture, payments, integrity) | R1 + R2 |
| Backup operator (fallback path, resets via the approved seed only) | R2 |

## Appendix A — Recommended skills to improve the coding

**Claude skills available in this workspace (use them at these moments):**

| Skill | Use it when | Best for |
|---|---|---|
| `engineering:code-review` | Before merging any PR touching auth, money, SQL | R1, R2 |
| `engineering:testing-strategy` | Planning pgTAP / API / Playwright coverage | R2, R4 |
| `engineering:debug` | A failing webhook, 401/403 loop, CORS error, deadlock | R1, R2 |
| `engineering:system-design` + `engineering:architecture` | Any change to the architecture or a new ADR | R1 |
| `engineering:deploy-checklist` | Before every deploy and before the demo | R1 |
| `engineering:documentation` | README, API docs, runbook | R4 |
| `frontend-design` / `frontend` | Building pages and components in the DESIGN-meta style | R3, R4 |
| `design:accessibility-review` | Phase 4 a11y pass (contrast, focus, touch targets) | R3 |
| `design:design-critique` | Reviewing a screen against the design tokens | R3, R4 |
| `design:ux-copy` | Error messages, empty states, button labels | R3, R4 |
| `product-management:write-spec` | Adding a new requirement without scope creep | R1 |
| `skill-creator` | Packaging your own project rules (e.g., "SkylineSOS conventions": money in paise, no price from client, error envelope) so every session follows them | R1 |

**Developer skills worth an hour each** (highest return first): Postgres transactions and row locking · API authorization patterns (never trust the client) · HMAC signature verification · Zod validation · Tailwind v4 theming · accessible form patterns · writing one good Playwright test · reading Supabase logs.
