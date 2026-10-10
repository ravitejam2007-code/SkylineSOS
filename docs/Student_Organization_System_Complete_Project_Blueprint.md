# Student Organization System

## Complete Project Blueprint, Architecture, Workflow, Technology Stack, and Integration Plan

**Document purpose:** This is the single source-of-truth planning
document for building the Student Organization System. It consolidates
the project information discussed in this conversation: the problem
statement, design direction, feature requirements, backend-first
strategy, frontend integration, database model, API structure, security,
testing, project layout, and implementation workflow.

> **Implementation status note:** This document is a build
> specification, not proof that the software has already been
> implemented. Always inspect the actual repository and verify code,
> integrations, tests, and credentials before marking a feature
> complete.

------------------------------------------------------------------------

# 1. Project Overview

## 1.1 Project name

**Student Organization System (SOS)**

## 1.2 Project purpose

The Student Organization System is a centralized web application for
managing a student association's memberships, events, ticket sales,
merchandise, announcements, fundraisers, volunteer tasks,
reimbursements, and finances.

The system replaces fragmented spreadsheets, cash-at-the-door ticket
handling, handwritten budget notes, individually sent WhatsApp messages,
and manual reimbursement tracking with a consistent, auditable digital
workflow.

## 1.3 Problem statement

A student organization may manage: - Student membership details and
annual dues in spreadsheets. - Event registrations and ticket sales
manually. - Member and non-member ticket prices separately. -
Merchandise orders and sizes without reliable stock visibility. -
Announcements through separate messages and mailing lists. - Fundraiser
duties through informal task assignments. - Expenses and reimbursements
in notebooks. - Income and outflow across several disconnected records.

These practices make it difficult to see the current membership status,
prevent ticket overselling, verify attendance, track merchandise
inventory, know who owns a task, maintain financial accuracy, and
retrieve a history of announcements or decisions.

## 1.4 Proposed solution

Create one secure, responsive system with role-based dashboards and
connected modules. All important actions should flow through validated
backend APIs and persist to the database. External services such as
email and payment gateways should be integrated through server-side
components.

## 1.5 Primary goals

1.  Centralize student organization operations.
2.  Make membership, event, merchandise, task, and finance data
    consistent.
3.  Provide a reliable student experience on desktop and mobile.
4.  Enforce permissions on the backend, not only in the UI.
5.  Reduce repetitive manual work through notifications and scheduled
    jobs.
6.  Provide traceable records and reports.
7.  Keep the code modular, testable, and maintainable.

------------------------------------------------------------------------

# 2. Users and Roles

Use least-privilege access. The precise permissions should be documented
and enforced by the backend.

  -----------------------------------------------------------------------
  Role                                Main responsibilities
  ----------------------------------- -----------------------------------
  Student / Member                    Manage own profile, apply for
                                      membership, view membership, browse
                                      events, book tickets, place
                                      merchandise orders, read
                                      announcements, view own tasks when
                                      assigned, view own order and
                                      booking history

  Volunteer                           Student permissions plus access to
                                      assigned tasks and permitted
                                      fundraiser workflows

  Treasurer                           Review permitted financial records,
                                      expenses, reimbursements, payments,
                                      and reports

  Event Staff / Coordinator           Manage assigned events, validate
                                      tickets, monitor attendance, and
                                      coordinate assigned volunteers

  Administrator                       Manage users, roles, memberships,
                                      events, products, announcements,
                                      fundraisers, settings, and
                                      authorized reports

  System / Background Worker          Run scheduled reminders,
                                      notification retries, and other
                                      authorized background operations
  -----------------------------------------------------------------------

**Important:** A role shown or hidden in the frontend is not a security
boundary. Every protected API operation must validate the user's
identity and permissions server-side.

------------------------------------------------------------------------

# 3. Technology Stack

Prefer the following stack if it fits the existing repository. If the
current codebase already uses a sound equivalent, preserve it unless
there is a clear reason to migrate.

## 3.1 Frontend

-   **Astro.js** --- page routing and application shell.
-   **TypeScript** --- typed application code.
-   **Tailwind CSS** --- responsive styling and reusable design tokens.
-   **Client-side components** --- use the framework already present in
    the repository for interactive UI components.
-   **Central API client** --- one consistent layer for requests, auth
    tokens, errors, and response types.

Frontend responsibilities: - Render pages, forms, tables, dashboards,
dialogs, and navigation. - Validate user input for usability. - Call
backend APIs and display server results. - Show loading, empty, success,
validation, and error states. - Never make trusted decisions about
permissions, payments, ticket capacity, inventory, or finance.

## 3.2 Backend

-   **Python**
-   **FastAPI**
-   **Pydantic** request and response schemas.
-   **Uvicorn** ASGI server.
-   Database access through a consistent repository/data-access layer.
-   Modular service layer for business rules.
-   OpenAPI/Swagger documentation for API contracts.

Backend responsibilities: - Authenticate requests. - Enforce roles and
object-level permissions. - Validate all inputs. - Apply business
rules. - Use database transactions where consistency matters. - Call
trusted external services. - Return consistent error responses. - Record
important audit events. - Expose health and readiness endpoints.

## 3.3 Authentication and database

-   **Supabase Auth** --- sign-up/sign-in and access-token issuance.
-   **Supabase PostgreSQL** --- relational database.
-   **Supabase Storage** --- product images and private receipt
    documents.
-   **Database migrations** --- version-controlled changes to schema and
    policies.
-   **Row Level Security (RLS)** --- use where compatible with the
    access architecture.

Security note: if the FastAPI server connects using a
privileged/service-role key, RLS may be bypassed. In that case,
implement and test equivalent authorization checks in the backend and
use least-privilege access wherever possible. Never expose service-role
credentials in browser code.

## 3.4 External services

-   **Payment provider:** Razorpay or another supported provider for
    ticket and merchandise payments.
-   **Email provider:** Brevo or Resend for announcements and reminders.
-   **QR library:** generate and scan event ticket QR codes.
-   **Background scheduler:** a suitable scheduler/worker for renewals,
    reminders, and retry jobs.
-   **Optional calendar integration:** only if the project needs it.

Use sandbox/test mode for payments during development. External
integrations that require credentials must be clearly marked as awaiting
configuration until actually tested.

## 3.5 Testing and quality

-   **pytest** --- backend tests.
-   **Vitest** --- frontend/unit tests if supported by the chosen
    frontend setup.
-   **Playwright** --- end-to-end browser tests.
-   **Linting and formatting** --- use the tools already configured in
    the repository.
-   **Type checking** --- TypeScript and any configured Python type
    checks.

## 3.6 Architecture choice

Use a **modular monolith** initially: one backend application organized
by feature modules. Do not introduce microservices unless scale or
deployment requirements genuinely justify them.

------------------------------------------------------------------------

# 4. High-Level Architecture

``` text
Student / Volunteer / Treasurer / Event Staff / Admin
                         |
                         v
              Responsive Frontend (Astro)
                         |
                         v
              Central Typed API Client
                         |
                HTTPS + Access Token
                         |
                         v
                 FastAPI Backend
        +----------------+----------------+
        |                |                |
        v                v                v
 Authentication     Business Services   API Validation
 and Permissions    and Workflows       and Error Handling
        |                |
        +----------------+
                         |
                         v
                PostgreSQL Database
                         |
             +-----------+------------+
             |           |            |
             v           v            v
         Supabase     Payment       Email /
         Storage      Provider      Scheduler
             |
             v
       Private Receipts /
       Product Images

All important mutations -> Audit Events -> Logs / Reports
```

## Request lifecycle

1.  The user opens a page and performs an action.
2.  The frontend validates basic input and sends a typed API request.
3.  The backend validates the access token and loads trusted user/role
    information.
4.  The backend validates request data and permissions.
5.  A service applies business rules and performs a transaction if
    needed.
6.  The database commits the change.
7.  External side effects, such as emails, are queued or attempted
    safely.
8.  The API returns a consistent response.
9.  The frontend updates the visible state from the response or
    refetches authoritative data.
10. Errors are shown clearly; they are not silently converted into fake
    success.

------------------------------------------------------------------------

# 5. Required Functional Modules

## 5.1 Authentication and user management

Features: - Sign up, sign in, sign out, session validation, and password
recovery. - User profile and profile updates. - Role and permission
checks. - Protected pages and endpoints. - Administrative user
management. - Account status and access restrictions.

Core workflow:
`Sign up -> Verify account if configured -> Sign in -> Backend validates token -> Load profile/role -> Open permitted dashboard`

## 5.2 Membership management

Features: - Membership application and review. - Membership dues and
payment records. - Status tracking: pending, active, expired,
rejected. - Benefits and member discounts. - Renewal and expiry
reminders. - Membership verification for event eligibility. - Membership
history and reports.

Core workflow:
`Student applies -> Admin reviews -> Required fee is verified -> Membership becomes active -> Student sees status -> Reminder runs before expiry -> Renewal or expiry`

Business rules: - Calculate membership validity on the server. - Do not
treat a payment initiation as a completed payment. - Keep payment and
membership status transitions auditable. - Prevent a student from
approving their own application unless explicitly authorized by policy.

## 5.3 Events and ticketing

Features: - Create, edit, publish, and cancel events. - Ticket types and
sales periods. - Member and non-member pricing. - Capacity limits. -
Online booking and payment. - QR ticket issuance. - Entrance check-in. -
Attendance and revenue reports. - Cancellation/refund handling under
configured rules.

Core workflow:
`Admin publishes event -> Student views event -> Server checks eligibility and price -> Booking is created and capacity is reserved -> Payment is verified if required -> Ticket/QR is issued -> Staff scans QR -> Server checks ticket and check-in state -> Attendance report updates`

Critical safeguards: - Use a database transaction or equivalent
concurrency-safe operation for capacity. - Do not allow overselling
during simultaneous requests. - Use a unique ticket identifier. - Make
check-in atomic; reject a second check-in. - Payment webhooks must be
signature-verified and idempotent.

## 5.4 Merchandise and inventory

Features: - Product catalogue and images. - Product variants such as
size and color. - Stock counts by variant. - Orders, order items,
payment status, and history. - Cancellation/refund rules. - Inventory
adjustments and audit history.

Core workflow:
`Admin publishes product/variants -> Student checks availability -> Places order -> Backend validates price and stock -> Stock is reserved or updated safely -> Payment is verified -> Order is confirmed -> Inventory/order views refresh`

Safeguards: - Derive prices from the database, not the browser
request. - Prevent negative stock and overselling. - Handle
failed/late/repeated payment callbacks safely. - Record stock changes
with a reason and actor.

## 5.5 Announcements and notifications

Features: - Draft, edit, publish, and archive announcements. - Website
announcement feed. - Audience selection. - Email delivery attempts and
status history. - Reminders for events, dues, orders, and tasks. - Retry
handling for temporary provider failures.

Core workflow:
`Admin drafts -> Validates audience/content -> Publishes database record -> Website shows it -> Email delivery is attempted -> Result recorded -> Failed delivery can be retried`

An email failure must not erase a successfully published announcement.

## 5.6 Fundraisers and volunteer tasks

Features: - Fundraiser details and goal. - Task creation, ownership,
priority, deadline, and status. - Volunteer assignment. - Progress
updates. - Overdue task tracking. - Completion history and fundraiser
progress reports.

Core workflow:
`Coordinator creates fundraiser -> Creates tasks -> Assigns volunteers -> Volunteers update progress -> Coordinator reviews -> Tasks close -> Fundraiser progress/report updates`

## 5.7 Treasurer and financial management

Features: - Membership income. - Event ticket income. - Merchandise
income. - Fundraiser income. - Expense and reimbursement submissions. -
Receipt attachments. - Review, approval, rejection, and payment
tracking. - Income/outflow/net-balance summaries. -
Event/category/semester reports and CSV exports.

Core workflow:
`Verified financial event -> One transaction record -> Expense claim with receipt -> Treasurer reviews -> Approved claim is paid and recorded -> Dashboard/report is recalculated`

Safeguards: - Use decimal-safe money handling. - Define how refunds and
reversals are represented. - Avoid duplicate transactions. - Distinguish
approved reimbursement from actually paid reimbursement. - Apply
authorization to finance data and exports. - Keep an audit trail for
sensitive changes.

## 5.8 Dashboards and reporting

Student dashboard: - Membership status. - Upcoming events and own
bookings. - Merchandise orders. - Relevant announcements. - Assigned
volunteer tasks.

Administrator dashboard: - Membership totals and expiries. - Events,
ticket sales, and attendance. - Products and low-stock indicators. -
Announcement status. - Volunteer progress. - Finance summaries and
authorized reports.

Treasurer dashboard: - Income by category. - Expenses and outstanding
reimbursements. - Net balance and reporting periods. - Exportable
reports.

All dashboard metrics must be calculated from authoritative
backend/database records rather than hardcoded numbers.

------------------------------------------------------------------------

# 6. Database Design

Use existing equivalent tables where present; do not create duplicates
just to match the names below. Add migrations for required changes.

  -----------------------------------------------------------------------
  Table / entity                      Purpose
  ----------------------------------- -----------------------------------
  `profiles`                          User profile and
                                      application-specific account
                                      details

  `memberships`                       Membership application, validity,
                                      status, and benefits

  `membership_payments`               Membership fee/payment records

  `events`                            Event details, status, dates, and
                                      capacity configuration

  `ticket_types`                      Event ticket types, prices, and
                                      limits

  `bookings`                          Booking records and booking status

  `tickets`                           Unique ticket identity, QR
                                      reference, and check-in status

  `products`                          Merchandise catalogue

  `product_variants`                  Size/color and variant-level
                                      inventory

  `orders`                            Customer order and status

  `order_items`                       Purchased products/variants,
                                      quantities, and recorded prices

  `payments`                          Provider references, amount,
                                      status, and payment lifecycle

  `announcements`                     Announcement content, audience,
                                      publication, and archive state

  `announcement_deliveries`           Per-channel/per-recipient delivery
                                      outcomes where needed

  `fundraisers`                       Fundraising goal, timeline, and
                                      status

  `volunteer_tasks`                   Assignment, owner, deadline,
                                      status, and progress

  `expenses`                          Expense/reimbursement claim and
                                      approval/payment state

  `financial_transactions`            Canonical ledger-style records for
                                      income, expense, refund, and
                                      reversal

  `audit_logs`                        Sensitive administrative and
                                      financial actions
  -----------------------------------------------------------------------

## 6.1 General schema requirements

-   Use stable primary keys and foreign keys.
-   Add unique constraints for identities and provider event identifiers
    where appropriate.
-   Add indexes for common filters and joins.
-   Store timestamps consistently; display in the configured local
    timezone.
-   Use constrained status values.
-   Use transactions for multi-step operations.
-   Avoid storing redundant calculated totals unless necessary and
    consistently maintained.
-   Preserve historical order-item prices rather than recalculating old
    orders from current product prices.
-   Define deletion/retention policies for financial and audit records.

## 6.2 RLS and authorization

-   Define policies for user-owned records and role-controlled data.
-   Test policies using real authenticated contexts.
-   If a privileged server connection bypasses RLS, enforce equivalent
    server-side checks and document the trust boundary.
-   Do not expose database secrets to the browser.
-   Keep receipts private and issue authorized access only.

------------------------------------------------------------------------

# 7. Backend API Plan

Use `/api/v1` as the versioned prefix. Adapt names to existing
conventions and document the final contract in OpenAPI.

## 7.1 Common/system

-   `GET /api/v1/health`
-   `GET /api/v1/auth/me`
-   `GET /api/v1/profiles/me`
-   `PATCH /api/v1/profiles/me`
-   Administrative user/role endpoints protected by authorization.

## 7.2 Membership

-   `GET /api/v1/memberships/me`
-   `POST /api/v1/memberships/applications`
-   `GET /api/v1/memberships` --- authorized administrative listing
-   `POST /api/v1/memberships/{membership_id}/approve`
-   `POST /api/v1/memberships/{membership_id}/reject`
-   `POST /api/v1/memberships/{membership_id}/renew`
-   `GET /api/v1/memberships/expiring`

## 7.3 Events and tickets

-   `GET /api/v1/events`
-   `POST /api/v1/events`
-   `GET /api/v1/events/{event_id}`
-   `PATCH /api/v1/events/{event_id}`
-   `POST /api/v1/events/{event_id}/publish`
-   `GET /api/v1/events/{event_id}/tickets/availability`
-   `POST /api/v1/events/{event_id}/bookings`
-   `GET /api/v1/bookings/me`
-   `POST /api/v1/bookings/{booking_id}/cancel`
-   `POST /api/v1/tickets/check-in`
-   `GET /api/v1/events/{event_id}/attendance`

## 7.4 Products and orders

-   `GET /api/v1/products`
-   `POST /api/v1/products`
-   `PATCH /api/v1/products/{product_id}`
-   Product-variant and inventory-adjustment endpoints.
-   `POST /api/v1/orders`
-   `GET /api/v1/orders/me`
-   Authorized order listing and order status endpoints.

## 7.5 Announcements

-   `GET /api/v1/announcements`
-   `POST /api/v1/announcements`
-   `PATCH /api/v1/announcements/{announcement_id}`
-   `POST /api/v1/announcements/{announcement_id}/publish`
-   `POST /api/v1/announcements/{announcement_id}/archive`
-   Authorized delivery status/retry endpoints.

## 7.6 Fundraisers and tasks

-   `GET /api/v1/fundraisers`
-   `POST /api/v1/fundraisers`
-   `GET /api/v1/tasks/me`
-   `POST /api/v1/fundraisers/{fundraiser_id}/tasks`
-   `PATCH /api/v1/tasks/{task_id}`
-   Authorized task assignment and progress endpoints.

## 7.7 Finance

-   `GET /api/v1/finance/summary`
-   `GET /api/v1/finance/transactions`
-   `POST /api/v1/expenses`
-   `GET /api/v1/expenses/me`
-   Authorized expense approve/reject/pay endpoints.
-   `GET /api/v1/reports/semester`
-   Authorized CSV export endpoints.

## 7.8 Integrations

-   Payment checkout/session creation.
-   Signed payment webhook endpoint.
-   Refund request/status endpoints.
-   Private receipt upload authorization.
-   Email provider callbacks if supported.
-   Background job health/status endpoints where useful.

**API rule:** All endpoints require explicit
authentication/authorization rules. Public listing endpoints should
expose only intentionally public data. Validate every object identifier
against the caller's permissions.

------------------------------------------------------------------------

# 8. Frontend Pages and Routes

Adapt to the current route conventions; the list is a target inventory,
not a demand to duplicate existing pages.

``` text
/
├── /login
├── /signup
├── /forgot-password
├── /dashboard
├── /profile
├── /membership
│   ├── /apply
│   ├── /status
│   └── /renew
├── /events
│   ├── /[eventId]
│   ├── /[eventId]/book
│   └── /my-bookings
├── /tickets
│   └── /[ticketId]
├── /merchandise
│   ├── /[productId]
│   └── /my-orders
├── /announcements
├── /volunteer
│   ├── /tasks
│   └── /fundraisers
├── /finance
│   ├── /expenses
│   └── /reports
└── /admin
    ├── /users
    ├── /memberships
    ├── /events
    ├── /products
    ├── /announcements
    ├── /fundraisers
    ├── /tasks
    └── /finance
```

## Frontend integration checklist for every page

-   Correct API endpoint and HTTP method.
-   Correct typed request/response.
-   Auth token sent securely through the established client.
-   Server-side authorization remains authoritative.
-   Loading state.
-   Empty state.
-   Success feedback only after server success.
-   Validation errors.
-   Network/server error display and retry where appropriate.
-   Duplicate-submit prevention.
-   Data refresh after mutation.
-   Responsive layout and keyboard accessibility.
-   Tests for the important happy path and failure path.

------------------------------------------------------------------------

# 9. Recommended Project File Structure

The actual repository may use a different structure. Inspect first and
adapt rather than moving files blindly.

``` text
student-organization-system/
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   ├── PROJECT_BLUEPRINT.md
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATABASE_SCHEMA.md
│   ├── SECURITY.md
│   ├── SETUP.md
│   └── TEST_PLAN.md
│
├── frontend/
│   ├── package.json
│   ├── astro.config.mjs
│   ├── tsconfig.json
│   ├── public/
│   └── src/
│       ├── pages/
│       │   ├── index.astro
│       │   ├── login.astro
│       │   ├── signup.astro
│       │   ├── dashboard.astro
│       │   ├── membership/
│       │   ├── events/
│       │   ├── tickets/
│       │   ├── merchandise/
│       │   ├── announcements/
│       │   ├── volunteer/
│       │   ├── finance/
│       │   └── admin/
│       ├── components/
│       │   ├── layout/
│       │   ├── forms/
│       │   ├── tables/
│       │   ├── dashboard/
│       │   └── feedback/
│       ├── layouts/
│       ├── styles/
│       │   ├── global.css
│       │   └── design-tokens.css
│       ├── lib/
│       │   ├── api.ts
│       │   ├── supabase.ts
│       │   ├── auth.ts
│       │   ├── errors.ts
│       │   └── types.ts
│       └── tests/
│
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── permissions.py
│   │   │   ├── errors.py
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── router.py
│   │   ├── dependencies/
│   │   │   ├── auth.py
│   │   │   └── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── profiles.py
│   │   │   ├── memberships.py
│   │   │   ├── events.py
│   │   │   ├── bookings.py
│   │   │   ├── tickets.py
│   │   │   ├── products.py
│   │   │   ├── orders.py
│   │   │   ├── announcements.py
│   │   │   ├── fundraisers.py
│   │   │   ├── tasks.py
│   │   │   ├── expenses.py
│   │   │   ├── finance.py
│   │   │   └── webhooks.py
│   │   ├── integrations/
│   │   │   ├── supabase.py
│   │   │   ├── payments.py
│   │   │   ├── email.py
│   │   │   └── storage.py
│   │   ├── jobs/
│   │   │   ├── reminders.py
│   │   │   └── retries.py
│   │   └── tests/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── conftest.py
│   └── alembic/              # only if using Alembic for schema management
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
│
├── tests/
│   └── e2e/
│       ├── auth.spec.ts
│       ├── membership.spec.ts
│       ├── ticketing.spec.ts
│       ├── merchandise.spec.ts
│       └── finance.spec.ts
│
└── scripts/
    ├── dev-check.*
    └── seed-dev-data.*
```

### Structure notes

-   Do not use both Supabase migrations and Alembic to manage the same
    schema unless the ownership is clearly divided.
-   Do not duplicate a frontend/backend implementation just to match
    this tree.
-   Keep the existing design file, for example in `docs/design/`, and
    reference it from the implementation instructions.
-   Commit `.env.example` placeholders, never actual secrets.

------------------------------------------------------------------------

# 10. Design System Integration

The design reference `DESIGN-meta (1).md` should be inspected and
applied as a design-language reference, not copied as another
application.

Previously discussed direction: - White and light-gray surfaces. - Dark,
high-contrast text. - Cobalt-blue primary actions around `#0064E0`. -
Soft gray surfaces around `#F1F4F7`. - Rounded inputs, cards, and
pill-shaped actions. - Clear hierarchy, generous whitespace, and
responsive layouts. - Public event and merchandise pages can be more
visual. - Admin, attendance, and finance pages should prioritize
readable data tables and clear status indicators.

Implementation requirements: 1. Extract design tokens into reusable CSS
variables or Tailwind theme values. 2. Build shared buttons, inputs,
badges, cards, dialogs, tables, and feedback components. 3. Preserve the
existing logo and brand assets, if any; do not copy Meta logos or
proprietary branding. 4. Apply the design consistently across student
and admin pages. 5. Make all layouts responsive and accessible. 6. Do
not let visual work replace backend or integration completion.

------------------------------------------------------------------------

# 11. Integration Strategy: Build One Vertical Slice at a Time

Do not build every screen first and postpone integration until the end.
Complete each feature end-to-end before moving to the next.

## Suggested implementation sequence

### Phase 1 --- Repository audit and setup

-   Inspect the existing source code and design file.
-   Record implemented, partial, mocked, broken, and missing features.
-   Verify runtime versions and dependencies.
-   Check environment variables without printing secret values.
-   Establish local development and test instructions.

**Exit criteria:** The team knows the actual repository structure, how
to run it, and the first blockers to address.

### Phase 2 --- Database and authentication foundation

-   Review schema and migrations.
-   Implement user profile and role model.
-   Configure Supabase Auth.
-   Verify access tokens in FastAPI.
-   Implement server-side authorization and ownership checks.
-   Add health and authenticated-user endpoints.

**Exit criteria:** Sign-in and a protected API call work using real test
accounts.

### Phase 3 --- Membership vertical slice

-   Database and migrations.
-   Backend schemas, services, routes, permissions, and tests.
-   Frontend application form and status page.
-   Admin review/approval interface.
-   Payment verification if required.
-   Expiry reminder job.

**Exit criteria:** Application, approval, status, and renewal flow
persist and survive refresh.

### Phase 4 --- Events and ticketing

-   Event CRUD and publication.
-   Ticket types and availability.
-   Safe booking and capacity control.
-   Payment lifecycle and QR issuance.
-   Check-in validation.
-   Attendance and revenue reports.

**Exit criteria:** A ticket can be purchased/issued and checked in once;
duplicate check-in and overselling are rejected.

### Phase 5 --- Merchandise and inventory

-   Product and variant management.
-   Product images and stock.
-   Order creation and payment lifecycle.
-   Order history and inventory reports.

**Exit criteria:** An order uses server-authoritative price/stock and
does not oversell.

### Phase 6 --- Announcements and notifications

-   Draft/publish/archive APIs.
-   Website announcement feed.
-   Email provider configuration.
-   Delivery status and retry logic.
-   Scheduled reminders.

**Exit criteria:** Published announcements persist even when email
delivery fails; delivery attempts are traceable.

### Phase 7 --- Fundraisers and tasks

-   Fundraiser and task management.
-   Assignment and authorization.
-   Progress, overdue tasks, and completion.
-   Volunteer and coordinator dashboards.

**Exit criteria:** Task changes are persisted, permission-checked, and
reflected in relevant dashboards.

### Phase 8 --- Finance and reports

-   Transaction model.
-   Expense submission and private receipt storage.
-   Treasurer approval/rejection/payment workflow.
-   Income/outflow/balance calculations.
-   CSV reports and audit logs.

**Exit criteria:** Test transactions and expenses produce correct,
non-duplicated reports.

### Phase 9 --- Cross-feature integration

-   Membership discounts in event bookings.
-   Payment records linked to bookings/orders/memberships.
-   Refunds/reversals reflected in finance.
-   Announcements and reminders linked to relevant events and users.
-   Role permissions consistent across every module.
-   Dashboard totals sourced from backend data.

**Exit criteria:** Related features agree on the same underlying records
and status.

### Phase 10 --- Hardening, deployment, and handover

-   Run unit, integration, and browser tests.
-   Verify migration and deployment instructions.
-   Configure CORS, secrets, storage, and payment webhooks.
-   Test failure and retry paths.
-   Document backups, recovery, logs, and known limitations.

**Exit criteria:** The application can be deployed from documented
instructions and every claimed feature has evidence of verification.

------------------------------------------------------------------------

# 12. Integration Matrix

  ------------------------------------------------------------------------------------
  Frontend feature  Backend/service      Database entities           Verification
  ----------------- -------------------- --------------------------- -----------------
  Login/profile     Supabase Auth +      `profiles`                  Authenticated
                    FastAPI token                                    profile loads;
                    validation                                       unauthorized
                                                                     access rejected

  Membership        Membership services  `memberships`,              Apply, approve,
                                         `membership_payments`       renew, expiry

  Event list/detail Events API           `events`, `ticket_types`    Published events
                                                                     and correct
                                                                     availability

  Booking/QR        Booking, payment,    `bookings`, `tickets`,      Capacity,
                    ticket services      `payments`                  payment, unique
                                                                     QR, duplicate
                                                                     scan

  Merchandise       Product/order        `products`,                 Correct stock and
                    services             `product_variants`,         order persistence
                                         `orders`, `order_items`     

  Announcements     Announcement/email   `announcements`,            Publish, archive,
                    services             `announcement_deliveries`   delivery and
                                                                     retry

  Volunteer tasks   Fundraiser/task      `fundraisers`,              Assignment,
                    services             `volunteer_tasks`           status, deadline,
                                                                     permissions

  Expenses          Expense/storage      `expenses`                  Receipt access,
                    services                                         review, approval

  Finance dashboard Finance/report       `payments`,                 Totals reconcile
                    services             `financial_transactions`,   with source
                                         `expenses`                  records

  Admin management  Admin APIs and       Relevant module tables,     Unauthorized
                    authorization        `audit_logs`                requests fail and
                                                                     changes are
                                                                     audited
  ------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 13. Critical Algorithms and Business Rules

## 13.1 Membership eligibility

1.  Load the authenticated user and membership record.
2.  Validate membership status and validity dates.
3.  Apply the policy for the requested action.
4.  Determine the applicable member/non-member price on the backend.
5.  Return the result and reason; do not rely on a browser-supplied
    membership flag.

## 13.2 Safe ticket booking

1.  Authenticate the user.
2.  Load event and ticket type.
3.  Validate publication status, sale window, eligibility, and price.
4.  Begin a transaction or use a concurrency-safe database operation.
5.  Reserve capacity only if availability remains.
6.  Create a pending booking and a unique idempotency reference.
7.  Process payment through the provider where required.
8.  Verify payment server-side through a trusted callback/webhook.
9.  Issue a ticket only after the configured confirmation condition.
10. Release capacity on an eligible failure/expiry/cancellation.
11. Record state changes and test concurrent requests.

## 13.3 QR check-in

1.  Receive the ticket reference from the scanner.
2.  Authenticate and authorize the event staff member.
3.  Load the ticket from the database.
4.  Verify event, ticket status, and eligibility.
5.  Atomically change check-in state only if it has not already been
    checked in.
6.  Return success or a clear duplicate/invalid result.
7.  Record the check-in time and staff actor.

## 13.4 Inventory

1.  Load the product variant.
2.  Validate quantity and order eligibility.
3.  Use a transaction or conditional update to reserve/decrement
    available stock.
4.  Create order and order items with recorded prices.
5.  Confirm stock changes according to the payment lifecycle.
6.  Release reservation for eligible failures.
7.  Record adjustments and test simultaneous orders.

## 13.5 Finance reconciliation

1.  Accept financial changes only from authorized workflows.
2.  Verify payment provider events and idempotency keys.
3.  Record one canonical transaction for each recognized financial
    event.
4.  Represent refunds/reversals explicitly rather than deleting history.
5.  Calculate income, expenses, refunds, and net balance using defined
    rules.
6.  Reconcile summaries against source records in tests.

## 13.6 Scheduled reminders

1.  Query eligible memberships/tasks/events.
2.  Check that a reminder has not already been sent for the same target
    and period.
3.  Create a durable delivery/job record.
4.  Attempt delivery.
5.  Record result and retry count.
6.  Retry transient failures with bounded backoff.
7.  Avoid duplicate reminders and log permanent failures.

------------------------------------------------------------------------

# 14. Environment Configuration

Maintain `.env.example` files with placeholders only. Typical variables
may include:

``` dotenv
# Frontend
PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=

# Backend
APP_ENV=development
API_PREFIX=/api/v1
FRONTEND_URL=http://localhost:4321
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_PROVIDER_KEY_ID=
PAYMENT_PROVIDER_KEY_SECRET=
PAYMENT_WEBHOOK_SECRET=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
```

Use only variables actually required by the chosen implementation.
Confirm which Supabase keys are public/publishable and which are secret
according to the project's Supabase configuration. Public browser
configuration is not a substitute for backend authorization. Do not
print secrets in terminal output or commit them.

Use separate development, test, and production credentials. Payment
providers should use sandbox credentials during development.

------------------------------------------------------------------------

# 15. Local Development Workflow

The exact commands depend on the repository's existing scripts and
package manager. Inspect `package.json`, Python dependency files, and
the README before running commands.

Typical setup pattern:

1.  Install frontend dependencies using the project's package manager.
2.  Create the backend virtual environment.
3.  Install the declared Python dependencies.
4.  Configure local environment files from the examples.
5.  Apply database migrations and optional development seed data.
6.  Start the FastAPI backend.
7.  Start the Astro frontend in a separate terminal.
8.  Open the frontend and test an authenticated API request.
9.  Run unit, integration, and end-to-end tests.
10. Verify the application uses real database records rather than mock
    data.

Typical commands **only if they match the repository**:

``` bash
# Frontend
cd frontend
npm install
npm run dev
```

``` powershell
# Backend — Windows PowerShell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

If PowerShell blocks virtual-environment activation, use the project's
approved environment instructions or invoke the environment's Python
executable directly. Do not assume these commands fit an existing
project without checking its files.

Useful verification targets: - Backend health endpoint. - FastAPI
OpenAPI page, commonly `/docs` in development. - Frontend page and
browser console. - Database migration status. - Test reports. - Payment
sandbox and email test results.

------------------------------------------------------------------------

# 16. Testing Plan and Acceptance Criteria

## 16.1 Backend tests

-   Valid/invalid authentication.
-   Role and ownership enforcement.
-   Membership approval and expiry.
-   Ticket capacity under concurrent booking attempts.
-   Duplicate payment webhook processing.
-   Duplicate QR check-in.
-   Inventory race conditions.
-   Invalid order quantities and prices.
-   Announcement publication and email failure.
-   Task assignment permissions.
-   Expense approval and payment transitions.
-   Financial calculations and duplicate transaction prevention.
-   Database constraint and rollback behavior.

## 16.2 Frontend tests

-   Sign-in and protected navigation.
-   Form validation and server error messages.
-   Membership application and status refresh.
-   Event booking and QR display.
-   Product selection, stock messages, and order history.
-   Announcement publishing and display.
-   Volunteer task status updates.
-   Expense submission and finance report display.
-   Responsive layout and accessibility.

## 16.3 End-to-end acceptance

A feature is complete only when: - The frontend calls the correct
backend API. - The backend validates authentication, permissions, and
business rules. - Data persists in the intended database. - The frontend
reflects the saved state after refresh. - Invalid actions fail safely. -
Tests cover the important success and failure paths. - Required external
integrations are tested or clearly marked as blocked by missing
credentials.

------------------------------------------------------------------------

# 17. Security Checklist

-   [ ] No service-role key, payment secret, or database password in
    browser code.
-   [ ] Backend verifies access tokens.
-   [ ] Roles and permissions are loaded from trusted data.
-   [ ] Object-level access is checked on every protected resource.
-   [ ] Database policies are tested where RLS is used.
-   [ ] Privileged database access is treated as a trust boundary.
-   [ ] Payment webhooks are signature-verified.
-   [ ] Payment processing is idempotent.
-   [ ] Ticket booking and inventory operations are concurrency-safe.
-   [ ] Private receipts are not publicly accessible.
-   [ ] Upload type and size are restricted.
-   [ ] CORS allows only trusted origins.
-   [ ] Sensitive actions are audited.
-   [ ] Errors and logs do not reveal secrets or private information.
-   [ ] Migrations and backup/recovery steps are documented.

------------------------------------------------------------------------

# 18. Design and Usability Checklist

-   [ ] Reuse the existing `DESIGN-meta (1).md` as a design reference if
    present.
-   [ ] Extract reusable design tokens and components.
-   [ ] Maintain consistent typography, spacing, buttons, cards, inputs,
    badges, and tables.
-   [ ] Make student and admin experiences responsive.
-   [ ] Use data-focused tables for administration and finance.
-   [ ] Use clear loading, empty, success, and error states.
-   [ ] Ensure keyboard accessibility and readable contrast.
-   [ ] Avoid copying Meta branding or proprietary assets.
-   [ ] Do not sacrifice functional integration for visual polish.

------------------------------------------------------------------------

# 19. Master Prompt for a Coding Agent

Copy this section into Claude Code, Cursor, or another coding agent
after opening the actual project repository.

------------------------------------------------------------------------

**ROLE:** Act as a senior full-stack architect and implementation
engineer. Complete the Student Organization System in the existing
repository.

**PRIMARY OBJECTIVE:** Finish the backend and connect every frontend
feature to real backend APIs, database records, and configured external
integrations. Prioritize correct business workflows, security, data
integrity, and tested functionality over cosmetic changes.

**REQUIRED ACTIONS:**

1.  Inspect the repository, package/dependency files, environment
    examples, migrations, existing UI, API clients, and the design
    reference before editing.
2.  Produce a concise audit of implemented, partial, mocked, broken, and
    missing functionality.
3.  Preserve working code and the existing design. Avoid unnecessary
    rewrites and duplicate frameworks.
4.  Complete authentication, role-based authorization, profiles,
    memberships, events/tickets, merchandise/inventory,
    announcements/email, fundraisers/tasks, expenses, finance, reports,
    and audit history.
5.  Inspect and evolve the database schema through version-controlled
    migrations.
6.  Implement and document validated, versioned backend APIs.
7.  Connect every existing frontend form, table, dashboard card,
    navigation item, and button to its correct API.
8.  Replace mock data and fake success responses with real persistence
    and accurate UI state.
9.  Add loading, empty, validation, success, and error states.
10. Integrate Supabase Auth, PostgreSQL, Storage, payment processing, QR
    check-in, email delivery, and scheduled jobs when credentials and
    infrastructure are available.
11. Use transactions or concurrency-safe operations for ticket capacity,
    inventory, payments, and financial records.
12. Enforce authorization server-side; never trust frontend role checks
    or client-supplied prices/statuses.
13. Keep secrets out of frontend code and source control.
14. Write and run unit, integration, and end-to-end tests. Fix failures
    introduced by your changes.
15. Maintain a persistent checklist and continue through the
    implementation phases rather than stopping after writing a plan.
16. Report all changed files, routes, migrations, tests run and their
    actual results, integrations awaiting credentials, known
    limitations, and exact commands to run the project.

**WORKFLOW:** Repository audit -\> database/auth foundation -\>
membership vertical slice -\> ticketing -\> merchandise -\>
announcements -\> tasks -\> finance -\> cross-module integration -\>
tests/security -\> setup and deployment documentation.

**DEFINITION OF DONE:** Each claimed feature works from frontend action
through backend validation to persistent database state and back to the
UI. Important workflows are tested, unauthorized requests fail safely,
duplicate payment processing is prevented, inventory/capacity remain
consistent, and untested integrations are explicitly disclosed.

**DO NOT:** Merely explain what should be done, create mock APIs that
always succeed, hardcode dashboard totals, expose secrets, claim tests
passed without running them, or report an integration as complete
without verifying it.

Begin by inspecting the current repository. Implement the
highest-priority missing pieces and continue until the available
environment or external configuration becomes a genuine blocker.

------------------------------------------------------------------------

# 20. Final Project Rule

**Build and verify the system as connected workflows, not as isolated
pages.**

For each module, prove this chain:

`Frontend action -> API request -> Authentication/authorization -> Validation -> Business service -> Database transaction -> API response -> Frontend update -> Automated test`

Then verify cross-module consistency:

-   Membership status controls eligibility and applicable discounts.
-   Bookings, orders, and memberships link to verified payment records.
-   Refunds and expenses update financial reporting correctly.
-   Announcements and reminders reflect the real underlying event or
    membership.
-   Role permissions apply consistently across every module.
-   Dashboard metrics match the authoritative database records.

The final result should be a reliable Student Organization System that
is maintainable, secure, responsive, and demonstrably functional---not
just a collection of attractive screens.
