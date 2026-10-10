# SkylineSOS — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | SkylineSOS — Student Organization System for the Skyline Student Association |
| **Event** | Odoo × NMIT 2026 Hackathon |
| **Doc status** | v3.0 — implementation baseline (supersedes CampusOne Architecture Plan v2.0) |
| **Date** | 10 October 2026 |
| **Related docs** | [TRD](./TRD.md) · [Architecture](./architecture.md) · [Navigation Plan](./Navigation-plan.md) · [API Docs](./api-docs.md) · [Team Management](./team-management.md) · [Demo Data](./demo-data.md) |

> **Assumption notice.** The original problem-statement PDF was not part of the upload. Scene coverage below is taken from the six scenes listed in the CampusOne plan (new student, gala tickets, announcements, hoodies, fundraiser, treasurer). If the PDF has wording that differs, update §5 and the acceptance criteria — the structure will not change.

---

## 1. Summary

SkylineSOS lets a student club run **memberships, events and tickets, announcements, merchandise, fundraising and club finances from one app, one permission model and one ledger**. Every rupee on the treasurer screen is traceable to a source record. Door verification uses **codes, not QR scanning**.

**One-line pitch:** *Run the whole club from one screen — and verify anyone at the door with just a code.*

## 2. Problem

Student clubs run on WhatsApp groups, Google Forms, paper receipts and one overworked treasurer's spreadsheet.

| Pain | Consequence |
|---|---|
| Membership lives in a sheet; expiry is tracked by memory | Members lapse silently; non-members get member prices |
| Tickets sold through forms + cash at the door | Oversold events, fake or duplicated entries, no attendance numbers |
| Merch pre-orders in chat | Stock oversold, no record of who paid |
| Fundraiser cash is counted on paper | Nobody can prove how much was raised or where it went |
| Treasurer reconciles by hand | Slow, error-prone, hard to hand over to the next team |
| QR-based entry needs good light, a camera and a working scanner app | Queues and failures exactly when the door is busiest |

## 3. Goals and non-goals

### 3.1 Goals (measurable)

| # | Goal | How we know |
|---|---|---|
| G1 | All six scenes work end-to-end on persisted data | 5-minute judge script completes with zero manual database edits |
| G2 | A door volunteer can verify a ticket or member in **under 10 seconds** with a keypad only | Timed on a mid-range phone during rehearsal |
| G3 | Zero financial inconsistency | Treasurer "net recorded movement" equals the sum of source records in an automated check |
| G4 | No oversell, no double fulfilment | Concurrency test: 20 parallel purchases of the last 5 tickets/units → exactly 5 succeed |
| G5 | Least privilege | Each of the 5 roles passes an allowed/denied permission test matrix at API level |
| G6 | A team of four, knowing only frontend and backend, can build it | Every task in [team-management.md](./team-management.md) is assignable to a person with those skills |

### 3.2 Non-goals

| Non-goal | Why |
|---|---|
| Multi-club / multi-tenant switching | One configured "SkylineSOS Demo Club"; avoids tenancy complexity |
| QR code generation or scanning | Replaced by code-based verification (USP) |
| Email delivery | Needs a verified sender domain; in-app feed + notifications are primary |
| Live (real-money) payments | Razorpay **Test Mode** only; labelled as sandbox |
| AI assistant, advanced analytics, CSV export, bank reconciliation | Deferred until all P0 scenes work |
| Native mobile apps | Responsive web, mobile-first at the door/treasurer screens |
| Receipt/file uploads | Removes Storage from the critical path |

## 4. Users and roles

| Role | Who | Core jobs |
|---|---|---|
| **Visitor** | Anyone, signed out | See public events/announcements/merch/tiers; sign up |
| **Member** | Student with an account (membership optional until approved & paid) | Apply, pay dues, buy tickets/merch, show a **member code**, manage preferences |
| **Door staff** | Trusted volunteer at events | Verify member code, check in ticket code, sell cash tickets |
| **Volunteer** | Fundraiser/task helper | Update assigned tasks, record fundraiser contributions |
| **Treasurer** | Finance owner | See money in/out/net, review expenses, read audit log, record cash |
| **Admin** | Club president / core committee | Everything operational: tiers, events, merch, announcements, applications, role grants |

Roles are stored server-side (`user_roles`) and enforced by the API and the database. A user holds exactly one role in this version.

## 5. Scene coverage (all P0)

| # | Scene | What must be demonstrable |
|---|---|---|
| 1 | **New student joins** | Apply → admin approves (or rejects with reason; student reapplies) → pays dues (Test Mode online, cash, or manual UPI) → membership card with tier, benefits and expiry → **member code** verified at the door → renewal reminders at 30 and 7 days |
| 2 | **Gala tickets** | Publish event with member/non-member prices → online or cash purchase → ticket with **ticket code** → single-use check-in by code → summary: sold vs capacity, checked-in vs sold, online vs cash revenue |
| 3 | **Announcements** | Admin publishes to an audience (public / members / staff) → members see an audience-scoped feed → mailing-list preferences persist with opt-out |
| 4 | **Hoodies / merch** | Variants by size, live stock, member discount, stock decrements exactly once, never negative, fulfilment status |
| 5 | **Fundraiser** | Task board (owner, status, due date) + progress card (tasks done/total, raised vs goal) + cash bake-sale contribution recorded and audited |
| 6 | **Treasurer** | Money in, money out, net recorded movement, breakdown by source and method, recent audited entries, expense review |

## 6. Unique selling points

1. **Code-first door ("SkylineCode").** No camera, scanner or app. 
   - *Ticket code* — `SKY-7K3M-92QH` format, random, single-use, shown in the buyer's ticket page.
   - *Member code* — a 6-digit code that **rotates every 60 seconds** (a screenshot is useless).
   - Works in poor light, on any phone, accessible to people who cannot aim a camera; manual name/email lookup is the fallback.
2. **One checkout, one ledger.** Dues, tickets and merch share one checkout model and post to one immutable, source-linked ledger.
3. **Honest money labels.** Every figure is tagged *Razorpay Test*, *Cash (staff-recorded)* or *Manual UPI (staff-recorded)*; the treasurer view says "recorded balance", never "bank balance".
4. **Action queue.** A rules-based list of things that need a human today (renewals due, low stock, overdue tasks, …) — deterministic, not AI-generated.

## 7. User stories and acceptance criteria

IDs are used by the team board and by tests (`FR-xx`).

### 7.1 Membership

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-01 | As a student I can create an account and apply for a tier | Application stores tier + answers; status `pending`; student sees only their own applications |
| FR-02 | As an admin I can approve or reject an application | Rejection requires a reason; each decision is appended to review history and audit log; a student cannot change `status` directly |
| FR-03 | As a rejected student I can edit and resubmit | Revision increments; earlier decisions remain visible to admin |
| FR-04 | As an approved student I can pay dues | Paid tier activates only after verified online payment or staff-recorded cash/UPI; free tier may activate on approval; duplicate active membership prevented |
| FR-05 | As a member I can see my card | Tier, benefits, start date, expiry, status (`active` / `expiring` / `expired`) |
| FR-06 | As admin/door staff I can sign up a walk-up student | Uses the same application + approval + payment rules; shortcut UI only |
| FR-07 | As a member I get renewal reminders | In-app notification at 30 and 7 days before expiry, once each (deduplicated) |
| FR-08 | As a member I can renew | Creates a new period, history preserved |

### 7.2 Identity verification (USP)

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-10 | As a member I can show a rotating code | Code is 6 digits, valid 60 s, unique among currently valid codes; page auto-refreshes with a countdown |
| FR-11 | As door staff I can verify a member by code | Returns name, tier, status, expiry, discount eligibility **only**; expired/unknown code returns a generic failure; attempt is audited and rate-limited |
| FR-12 | As door staff I can verify a member by name/email/student ID (fallback) | Exact or prefix match; minimal fields returned; audited |
| FR-13 | As a buyer I can see my ticket code any time | Code is stable, readable (Crockford base32, no I/L/O/U), copyable |
| FR-14 | As door staff I can check in a ticket by code | Atomic and single-use; second attempt returns *already checked in at HH:MM by <staff>*; wrong-event and cancelled tickets are rejected |
| FR-15 | As door staff I can look up a ticket by buyer name/email | Still validated against current database state |

### 7.3 Events and tickets

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-20 | As admin I can create/publish events and ticket types | Capacity, window, member and non-member prices, per-type limit, `member_only` flag |
| FR-21 | As a buyer I can purchase tickets | Price and discount computed by the server; capacity enforced atomically; reservation held for 15 minutes for online payments |
| FR-22 | As door staff I can sell a cash/UPI ticket | Same checkout path, actor + method + note required, audited, ticket issued immediately |
| FR-23 | As admin/treasurer I see an event summary | Sold, capacity, checked-in, attendance rate, online test revenue, cash/UPI revenue, net |

### 7.4 Announcements

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-30 | As admin I can draft and publish announcements by audience | `draft → published → archived`; audience enforced in queries |
| FR-31 | As a member I see an audience-scoped feed | Visitors see `public` only; members add `members`; staff add `staff` |
| FR-32 | As a user I can set mailing-list preferences | Opt-in/out per topic persisted; account email is not treated as marketing consent |

### 7.5 Merchandise

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-40 | As admin I manage products, variants and stock | SKU, label, price, stock on hand |
| FR-41 | As a buyer I see member pricing | Discount % from the buyer's active tier, applied server-side, captured on the order line |
| FR-42 | As a buyer I can order | Stock reserved atomically; never negative; consumed once on fulfilment; released once on expiry |
| FR-43 | As admin/volunteer I update fulfilment | `pending → packed → handed_over`; payment history untouched |

### 7.6 Fundraiser

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-50 | As admin I create a fundraiser with a goal | Goal in paise, dates, owner |
| FR-51 | As admin/volunteer I manage tasks | Owner, status (`todo/in_progress/done`), due date, priority; volunteers edit only assigned tasks |
| FR-52 | As anyone permitted I see progress | Tasks done/total/overdue + raised vs goal; tasks are never counted as money |
| FR-53 | As treasurer/admin/volunteer I record cash income | Amount, method, note, actor; one linked ledger entry; audited |

### 7.7 Treasurer

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-60 | As treasurer I see money in / out / net | Computed from ledger entries for a date range; breakdown by source and method |
| FR-61 | As treasurer I see every entry's source | Each row links to its checkout item / contribution / expense |
| FR-62 | As a volunteer I submit an expense | Status `submitted` |
| FR-63 | As treasurer I approve/reject/mark paid | Rejection needs a reason; submitter cannot approve own expense; paid posts an `out` ledger entry once |
| FR-64 | As treasurer I read the audit log | Cash/UPI entries, approvals, role grants, verification attempts |

### 7.8 Platform

| ID | Story | Acceptance criteria |
|---|---|---|
| FR-70 | As admin I grant roles | Audited; users cannot self-assign |
| FR-71 | As staff I see an action queue | Six rules (see §8); each item links to its record and states the next action; role-filtered |
| FR-72 | As a visitor I can use the app on a phone | All screens usable at 360 px width |

## 8. Action queue rules

| Rule | Trigger (default) | Next action | Visible to |
|---|---|---|---|
| Renewal due | Active membership expires within 30 days | Open member, send/review reminder | Admin |
| Low event availability | ≤ 15 % of capacity left | Review capacity and pricing | Admin |
| Overdue task | Due date passed, not done | Contact assignee / reschedule | Admin, assignee |
| Low merch stock | Available ≤ 3 units | Review stock | Admin |
| Reimbursement waiting | Expense `submitted` | Approve or reject | Treasurer, Admin |
| Application waiting | `pending` for more than 2 days | Review application | Admin |

> *Change from the CampusOne plan:* "announcement delivery failure" is replaced by "application waiting" because email delivery is out of scope.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Security** | Server-side authorization on every endpoint; database RLS enabled with deny-all for browser roles; secrets only in environment/secret stores; payment signatures verified on the raw body; PII minimised in codes, logs and verification responses |
| **Integrity** | Money in integer paise; atomic capacity/stock; idempotent fulfilment (unique source keys); immutable ledger with reversal entries |
| **Performance** | p95 API latency < 500 ms for reads, < 1.5 s for checkout; door verification round trip < 1 s on normal Wi-Fi |
| **Availability** | Single managed region; accepted risk for a hackathon. Free-tier Supabase projects pause after inactivity — **un-pause and warm up before judging** |
| **Accessibility** | WCAG 2.1 AA contrast, 44 px touch targets, visible focus, labels on all inputs |
| **Responsiveness** | Mobile-first; breakpoints follow the design system (480 / 768 / 1024 / 1360) |
| **Observability** | Structured JSON logs with request ID; audit table for sensitive actions |
| **Maintainability** | TypeScript strict; ESLint + Prettier; migrations in Git; API contract in [api-docs.md](./api-docs.md) |
| **Privacy** | Collect name, email, student ID only; no card data ever; demo data is synthetic and labelled |

## 10. Success metrics

| Type | Metric | Target |
|---|---|---|
| Leading | Scenes complete in the live demo | 6 / 6 |
| Leading | Door verification time (code entry → result) | ≤ 10 s |
| Leading | Permission matrix tests passing | 100 % |
| Leading | Concurrency test (no oversell) | Pass |
| Lagging (post-hackathon) | Club pilot: events run without spreadsheets | 1 event |

## 11. Release scope

| Priority | Scope |
|---|---|
| **P0** | Auth + roles; applications; tiers; membership checkout; events and tickets; ticket/member codes; cash and Razorpay Test checkout; announcements + preferences; merch variants and stock; fundraiser board + contributions; treasurer overview; expenses (submit/approve/paid); audit log; action queue; demo seed (≈ 300 records); 5-minute demo |
| **P1** | Action-queue dismiss/assign; CSV export; realtime updates; refund flow; event-staff assignment per event; email via a verified sender |
| **P2** | Multi-club; analytics; AI assistant; bank reconciliation; native app |

## 12. Demo plan (5 minutes)

Accounts come from the seed script; passwords are handed to judges out-of-band. See [demo-data.md](./demo-data.md).

| Time | Scene | Show |
|---|---|---|
| 0:00–0:50 | 1 · Join | Student applies → admin approves → cash dues → card shows tier/expiry → door types the **member code** → verified |
| 0:50–1:45 | 2 · Gala | Member buys a ticket (Razorpay Test) → ticket code appears → door enters code → checked in → second attempt rejected → event summary |
| 1:45–2:25 | 3 · Announce | Publish to *members* → member sees it, visitor does not → toggle preference |
| 2:25–3:10 | 4 · Hoodies | Member price, stock before/after |
| 3:10–4:00 | 5 · Fundraiser | Mark a task done, record ₹ cash, progress moves |
| 4:00–5:00 | 6 · Treasurer | In/out/net, source breakdown, click a row to its source, audit log |

**Fallback path:** if Razorpay or Wi-Fi misbehaves, use staff-recorded cash and manual lookup. Never edit database totals to "fix" a demo.

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope too large for four people | High | High | Thin vertical slices; P0 only; the cut order in [team-management.md](./team-management.md) |
| Express on Supabase Edge Functions misbehaves | Medium | High | Spike on day 0 (hello route + auth + CORS + webhook raw body); fallback to Hono with the same route layout |
| Supabase free project paused / limits | Medium | High | Un-pause before demo; keep requests light; no heavy loops in handlers |
| Razorpay Test flow fails on stage | Medium | Medium | Cash and manual-UPI path is first-class |
| Code brute-forcing at the door | Low | Medium | Staff-only verification, per-staff rate limit, random 40-bit ticket codes, 60 s member codes, audit |
| Money inconsistency | Low | High | Single fulfilment function, unique ledger source keys, reconciliation test |
| Team merges break each other | Medium | Medium | Folder ownership, contract-first API, small PRs |

## 14. Assumptions and open questions

| # | Item | Owner |
|---|---|---|
| A1 | Hackathon build window is ~36 h (phases in team-management are percentages; scale them) | Team lead |
| A2 | Judges accept Razorpay Test Mode and staff-recorded cash as "payments" | Team lead |
| Q1 | Does the problem-statement PDF require email delivery of announcements? If yes, add a verified-sender P1 task | Team lead |
| Q2 | Does the PDF specify membership fee tiers or discounts? Current tiers (₹100 / ₹300 / ₹500) are placeholders | Admin persona |
| Q3 | Will judges need their own accounts, or use the five demo roles? | Team lead |

## 15. Definition of done (release)

- [ ] 6/6 scenes pass the demo script on the **deployed** URL, on a phone and a laptop
- [ ] Permission matrix and concurrency tests pass
- [ ] Ledger reconciliation check passes against the seeded data
- [ ] No secret in Git history, browser bundle, logs or screenshots
- [ ] Demo club and Razorpay Test Mode clearly labelled in the UI
- [ ] README lets a new developer run the project in under 15 minutes
