# SkylineSOS — Navigation Plan

| | |
|---|---|
| **Version** | 3.0 |
| **Date** | 10 October 2026 |
| **Stack** | Astro (static) + React islands + Tailwind v4 |
| **UI source** | `DESIGN-meta.md` tokens (see [TRD §5.5](./TRD.md#55-design-system-mapping-from-design-metamd)) |
| **Read with** | [PRD](./PRD.md) · [API Docs](./api-docs.md) |

---

## 1. Principles

1. **Role-based home.** After login each role lands on the screen it uses most.
2. **Thin navigation.** At most 6 primary links per role; everything else is one tap deeper.
3. **Static build ⇒ query-string detail pages.** `/event?slug=…`, not `/events/[slug]`.
4. **Guards are UX.** The API is the real gate; a hidden link is never security.
5. **Every page has four states:** loading, empty, error (with request ID), success.
6. **Mobile-first** for Door, Treasurer and Member screens (360 px minimum).
7. **Cobalt means money.** Blue pill buttons appear only on buy/pay actions; everything else uses the black pill.

## 2. Site map

```text
PUBLIC
/                       Home
/events                 Event list
/event?slug=            Event detail + ticket purchase
/announcements          Public feed
/membership             Tiers + apply CTA
/merch                  Product list
/merch/item?id=         Product detail + variant picker
/login   /register   /forgot-password   /reset-password
/privacy   /terms   /403   /404

MEMBER (role: any signed-in user)
/dashboard
/membership/apply            Application form (create/edit)
/membership/status           Application status, rejection reason, reapply, pay dues
/membership/card             Card + rotating member code
/membership/history
/my/tickets                  Tickets with ticket codes
/my/orders                   Merch + dues orders
/my/preferences              Mailing-list opt in/out
/my/notifications
/checkout?id=                Payment step (online) / confirmation

DOOR (role: door, admin, treasurer-limited)
/door                        Door console (code entry, lookup, cash sale)
/door/event?id=              Event-scoped console with live counters

VOLUNTEER (role: volunteer, admin)
/volunteer                   My tasks + record contribution

TREASURER (role: treasurer, admin)
/treasurer                   Money in / out / net + breakdown
/treasurer/ledger            Source-linked entries
/treasurer/expenses          Review queue
/treasurer/audit             Audit log
/treasurer/record            Record cash/UPI (dues, merch, contribution)

ADMIN (role: admin)
/admin                       Overview + action queue
/admin/applications          Review queue
/admin/members               Search, walk-up signup, role grants
/admin/tiers
/admin/events                List
/admin/events/edit?id=       Create/edit event + ticket types
/admin/events/summary?id=    Sales, attendance, revenue
/admin/announcements
/admin/merch                 Products, variants, stock, orders
/admin/fundraisers           Fundraiser list + progress
/admin/fundraisers/board?id= Task board + contributions
/admin/actions               Full action queue
```

## 3. Navigation bars

### 3.1 Public header (desktop ≥ 1024 px)

Left: **SkylineSOS** wordmark → `/`. Centre: pill tabs `Events · Announcements · Membership · Merch`. Right: `search-pill` (optional), `Sign in` (ghost) and `Join the club` (black primary). Signed-in: avatar circle → menu (`Dashboard`, `My tickets`, `Sign out`).

Mobile (< 768 px): logo + hamburger + avatar; pill tabs move into a full-screen drawer; active tab is shown as the label in the closed nav. A **promo banner** above the header is optional (e.g., "Gala tickets live — member price ₹300").

### 3.2 App shells per role

| Role | Primary links (max 6) | Mobile pattern |
|---|---|---|
| **Member** | Dashboard · Tickets · Orders · Card · Membership · Preferences | Bottom tab bar (Dashboard, Tickets, Card, More) |
| **Door** | Door console · Events · Lookup | Single screen, no tab bar (speed) |
| **Volunteer** | My tasks · Contributions · Announcements | Bottom tab bar |
| **Treasurer** | Overview · Ledger · Expenses · Record · Audit | Top tabs scroll horizontally |
| **Admin** | Overview · Applications · Events · Merch · Fundraisers · More (Members, Tiers, Announcements, Actions) | Drawer |

All shells show a persistent **environment chip**: `Demo Club` and, near payment UI, `Razorpay Test Mode`.

## 4. Route table

`API` column lists the endpoints from [api-docs.md](./api-docs.md) each page calls.

### 4.1 Public

| Route | Purpose | API | Key UI | States / notes |
|---|---|---|---|---|
| `/` | Value proposition + next event + latest announcements + tiers | `GET /public/events`, `GET /announcements?audience=public`, `GET /public/tiers` | Hero band (black + outlined CTA pair), 3-up feature tiles, event cards (32 px radius) | Empty: "No upcoming events yet" |
| `/events` | List upcoming/past | `GET /public/events` | Event cards, pill filter tabs (Upcoming/Past) | Sold-out and "Almost gone" badges |
| `/event?slug=` | Detail + buy | `GET /public/events/:slug`, `POST /checkout`, `POST /checkout/:id/verify` | Gallery poster, ticket-type radio options, **checkout summary card** (sticky; bottom bar on mobile), member-price hint, cobalt `Pay ₹…` | Unauthenticated → "Sign in to buy" keeps `next` |
| `/announcements` | Feed by audience | `GET /announcements` | Cards with audience badge | Visitors only see public |
| `/membership` | Tiers, benefits, apply | `GET /public/tiers`, `GET /me/membership` | Tier cards, comparison rows, black `Apply` | Signed-in with active membership → "Renew" |
| `/merch`, `/merch/item?id=` | Browse, variants, member price | `GET /public/merch`, `GET /public/merch/:id` | Product tiles (1:1), size picker (pill chips), stock badge, cobalt `Add to order` | `Out of stock` critical badge |
| `/login`, `/register`, `/forgot-password`*, `/reset-password`* | Auth (*P1: password-reset email needs a custom SMTP; hide for the demo) | Supabase Auth | Single-column forms, 44 px inputs | Errors under field in `critical-strong` |
| `/privacy`, `/terms`, `/403`, `/404` | Static | — | — | — |

### 4.2 Member

| Route | Purpose | API | Key UI | States / notes |
|---|---|---|---|---|
| `/dashboard` | Status hub | `GET /me`, `GET /me/membership`, `GET /me/tickets`, `GET /me/notifications`, `GET /announcements` | Membership status tile (active/expiring/expired), next ticket, notifications | Empty: CTA "Apply for membership" |
| `/membership/apply` | Create/edit application | `GET /public/tiers`, `POST /membership/applications`, `PUT /membership/applications/:id` | Tier radio cards, short form | Disabled if an open application exists |
| `/membership/status` | Decision and next step | `GET /me/membership/applications` | Status badge, rejection reason, `Reapply`, cobalt `Pay dues` when approved | Pending: reassuring copy; rejected: edit-and-resubmit |
| `/membership/card` | Card + **member code** | `GET /me/membership`, `POST /me/verify-code` | Card with tier/expiry, 6-digit code in large type, countdown ring, auto-refresh while visible | Not active → "No active membership" with link to apply/renew |
| `/membership/history` | Past periods | `GET /me/membership/history` | Table | — |
| `/my/tickets` | Tickets | `GET /me/tickets` | Ticket cards: event, type, **ticket code** (copy button), status | Checked-in tickets greyed with time |
| `/my/orders` | Orders | `GET /me/orders` | List with method badge (Test / Cash / UPI) and fulfilment status | — |
| `/my/preferences` | Mailing preferences | `GET/PUT /me/preferences` | Toggles per topic | Success toast |
| `/my/notifications` | Reminders | `GET /me/notifications`, `POST /me/notifications/:id/read` | List | — |
| `/checkout?id=` | Pay / confirm | `GET /checkout/:id`, `POST /checkout/:id/verify` | Summary, countdown for reservation, cobalt `Pay` | Expired → "Reservation expired, start again" |

### 4.3 Door

| Route | Purpose | API | Key UI | Notes |
|---|---|---|---|---|
| `/door` | Pick event, quick actions | `GET /public/events` | Event chips, big buttons | Remembers last event |
| `/door/event?id=` | **Door console** | `POST /door/check-in`, `POST /staff/verify/member`, `GET /door/search`, `POST /staff/checkout`, `GET /admin/events/:id/summary` | Segmented `CodeInput` (auto-detects ticket vs member by format), result card (✔ green / ✖ red + reason, holder name, tier), tabs: *Code · Lookup · Cash sale*, live counters (checked-in / sold / capacity) | Large 56 px targets; no camera permission; sound/vibration optional |

### 4.4 Volunteer

| Route | Purpose | API | Key UI |
|---|---|---|---|
| `/volunteer` | My tasks, record contribution | `GET /tasks?assignee=me`, `PATCH /tasks/:id`, `POST /fundraisers/:id/contributions`, `POST /expenses` | Task list with status pills, contribution form (amount, method, note), expense form |

### 4.5 Treasurer

| Route | Purpose | API | Key UI |
|---|---|---|---|
| `/treasurer` | **Money in / out / net** | `GET /treasurer/overview` | Three stat tiles, category and method breakdown bars, recent entries, date-range pills, labelled *Recorded net movement* |
| `/treasurer/ledger` | Source-linked entries | `GET /treasurer/ledger` | Table; each row links to its source |
| `/treasurer/expenses` | Review | `GET /expenses`, `POST /expenses/:id/status` | Queue; approve / reject (reason) / mark paid |
| `/treasurer/record` | Staff-recorded entry | `POST /staff/checkout`, `POST /fundraisers/:id/contributions` | Forms with method + note required |
| `/treasurer/audit` | Audit | `GET /audit` | Filterable table |

### 4.6 Admin

| Route | Purpose | API |
|---|---|---|
| `/admin` | Overview: counts + **action queue** top 5 | `GET /actions`, `GET /admin/overview` |
| `/admin/applications` | Review queue; approve/reject with reason; history | `GET /admin/membership/applications`, `POST /admin/membership/applications/:id/review` |
| `/admin/members` | Search, walk-up signup, role grant | `GET /staff/members`, `POST /admin/members/walk-up`, `PATCH /admin/users/:id/role` |
| `/admin/tiers` | CRUD tiers | `GET/POST/PATCH /admin/tiers` |
| `/admin/events`, `/admin/events/edit?id=` | CRUD events and ticket types; publish | `GET/POST/PATCH /admin/events…`, `POST /admin/events/:id/ticket-types` |
| `/admin/events/summary?id=` | Sold, capacity, checked-in, revenue by method | `GET /admin/events/:id/summary` |
| `/admin/announcements` | Draft, publish, archive | `GET/POST/PATCH /admin/announcements…` |
| `/admin/merch` | Products, variants, stock, fulfilment | `GET/POST/PATCH /admin/products…`, `PATCH /admin/orders/:itemId/fulfilment` |
| `/admin/fundraisers`, `/admin/fundraisers/board?id=` | Goal, progress, tasks board, contributions | `GET/POST /fundraisers…`, `GET /fundraisers/:id/progress`, `POST/PATCH /tasks…` |
| `/admin/actions` | Full action queue | `GET /actions` |

## 5. Guards and redirects

| Situation | Behaviour |
|---|---|
| Signed-out visits a protected route | → `/login?next=<path>` |
| Signed-in, wrong role | → `/403` with a link to the role's home |
| After login | → `next` if present, else role home (admin `/admin`, treasurer `/treasurer`, door `/door`, volunteer `/volunteer`, member `/dashboard`) |
| API returns 401 | Clear session, → `/login?next=` |
| API returns 403 | Toast "You don't have access", stay on page |
| Checkout reservation expired | Banner + return to the item page |
| Unknown route | `/404` |

## 6. Core journeys (map to the six scenes)

```mermaid
flowchart TD
  A[Visit /membership] --> B[Register / login]
  B --> C[/membership/apply]
  C --> D[/membership/status: pending]
  D -->|Admin approves| E[Pay dues → /checkout]
  D -->|Admin rejects| C
  E --> F[/membership/card]
  F --> G[Door types member code → verified]
```

```mermaid
flowchart TD
  A[/event?slug=] --> B{Signed in?}
  B -- no --> L[/login?next=] --> A
  B -- yes --> C[Choose ticket type]
  C --> D[Pay → Razorpay Test]
  D --> E[/my/tickets: SKY-XXXX-XXXX]
  E --> F[Door: enter code → checked in]
  F --> G[/admin/events/summary]
```

| Scene | Entry | Path | Exit proof |
|---|---|---|---|
| 1 Join | `/membership` | apply → status → pay → card → door verify | Door result card + audit row |
| 2 Gala | `/event?slug=skyline-gala-2026` | buy → ticket code → check-in → summary | Checked-in counter, revenue by method |
| 3 Announce | `/admin/announcements` | publish → member feed → preferences | Feed differs by role |
| 4 Hoodies | `/merch` | pick size → member price → pay → fulfilment | Stock before/after |
| 5 Fundraiser | `/admin/fundraisers/board` | mark task → record cash | Progress card moves |
| 6 Treasurer | `/treasurer` | overview → ledger row → source | Totals reconcile |

## 7. Component-to-page matrix

| Component | Pages |
|---|---|
| `EventCard` | `/`, `/events`, `/door` |
| `CheckoutSummary` (sticky card → bottom bar) | `/event`, `/merch/item`, `/membership/status`, `/checkout` |
| `CodeInput` | `/door/event` |
| `MemberCodePanel` + `Countdown` | `/membership/card` |
| `TicketCard` | `/my/tickets` |
| `StatTile` | `/treasurer`, `/admin`, `/admin/events/summary` |
| `MoneyBadge` | `/treasurer*`, `/my/orders`, `/door/event` |
| `DataTable` | `/treasurer/ledger`, `/admin/*` lists |
| `TaskBoard` | `/admin/fundraisers/board`, `/volunteer` |
| `ActionQueueList` | `/admin`, `/admin/actions`, `/treasurer` |
| `EmptyState` / `ErrorState` / `Skeleton` | every data page |

## 8. Responsive behaviour

| Breakpoint | Changes |
|---|---|
| < 480 | One column; hero 24 px; bottom tab bar for Member/Volunteer; checkout summary as sticky bottom bar |
| 480–767 | Feature tiles two-up |
| 768–1023 | Two-column grids; pill tabs return to the header |
| 1024–1359 | Full layout; detail pages 58 / 42 split with sticky rail (max 380 px) |
| ≥ 1360 | Wider gutters, larger hero art |

## 9. Accessibility checklist per page

- One `<h1>`; landmarks (`header`, `nav`, `main`, `footer`)
- Visible focus ring (`2px` `--color-focus`), logical tab order
- Form inputs have labels and error text linked with `aria-describedby`
- Status never conveyed by colour alone (icon + text)
- Code input: `inputmode="text"`, `autocapitalize="characters"`, `autocomplete="off"`, announces result with `aria-live="polite"`
- Countdown is also available as text ("expires in 42 s")
- Touch targets ≥ 44 px (door console 56 px)
