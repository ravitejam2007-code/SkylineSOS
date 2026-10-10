# SkylineSOS — Demo Data Plan

| | |
|---|---|
| **Dataset** | [`seed/demo-data.json`](./seed/demo-data.json) — **297 seed records** (target was 200–300) |
| **As-of date** | 10 October 2026 (relative dates in the loader are computed from "today") |
| **Label** | Every profile has `is_demo = true`; the UI shows a **Demo Club** chip |
| **Read with** | [TRD §11](./TRD.md#11-demo-data) · [PRD §12](./PRD.md#12-demo-plan-5-minutes) |

---

## 1. Principle

The dataset contains **inputs only** (people, tiers, events, orders to place…). It is loaded by calling the **same database functions the app uses**, so tickets, stock, ledger rows, audit rows and memberships are *consequences*, not hand-inserted numbers. Nothing on a dashboard is typed in.

- Seeded payments are **staff-recorded `cash` or `manual_upi`** and show that label. They are never presented as Razorpay-verified.
- **One live Razorpay Test payment** is made by hand during the demo to show the online path.
- All names and emails are synthetic (`@skylinesos.demo`, `@students.skylinesos.demo`). No real person's data.

## 2. What is in the file

| Section | Records | Notes |
|---|---:|---|
| `profiles` | 60 | 5 role accounts + 55 students |
| `membership_tiers` | 3 | Basic ₹100 · Plus ₹300 (10 % merch discount) · Core ₹500 (20 %) — placeholders until the PDF confirms fees |
| `membership_applications` | 40 | 30 approved · 6 pending · 4 rejected (2 of them already resubmitted → revision 2) |
| `membership_purchases` | 28 | Dues paid for 28 of the 30 approved (2 approved-but-unpaid show the "Pay dues" step) |
| `events` | 5 | 2 past (Freshers Welcome, Hack Night), 3 upcoming (Gala Night 17 Oct, Cloud 101, Sports Meet) |
| `ticket_types` | 10 | Member vs non-member prices; one `member_only` type |
| `ticket_purchases` | 60 | 14 for past events (most checked in), 32 for the Gala, 14 for the others |
| `products` | 4 | Hoodie, T-shirt, Cap, Sticker pack |
| `product_variants` | 9 | Sizes; stock set so the loader never fails |
| `merch_orders` | 30 | Mixed fulfilment states |
| `announcements` | 10 | 9 published, 1 draft; public / members / staff audiences |
| `fundraisers` | 2 | Gala Night Bake Sale (₹25,000 goal), Scholarship Fund Drive (₹50,000 goal) |
| `tasks` | 14 | 5 done · 5 in progress · 4 to do (5 overdue) |
| `contributions` | 12 | ₹5,900 total cash/UPI (₹4,050 + ₹1,850) |
| `expenses` | 10 | 3 submitted · 2 approved · 3 paid · 2 rejected |
| **Total** | **297** | |

A shared **walk-in guest** profile (for cash door sales) is created by the loader in addition to the 297.

### Derived rows the loader will produce (approximate)

| Table | ≈ Rows |
|---|---:|
| `checkouts` / `checkout_items` | 118 (28 dues + 60 tickets + 30 merch) |
| `memberships` | 28 (20 active · 4 expiring ≤ 30 days · 4 expired) |
| `tickets` / `check_ins` | 60 / ~12 |
| `ledger_entries` | ~100–130 (free tickets create none) |
| `audit_logs` | 250+ |
| `notifications` | after the first cron run: reminders for the 4 expiring memberships |

## 3. Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@skylinesos.demo` | `DEMO_ACCOUNT_PASSWORD` from `scripts/.env` |
| Treasurer | `treasurer@skylinesos.demo` | same |
| Door staff | `door@skylinesos.demo` | same |
| Volunteer | `volunteer@skylinesos.demo` | same |
| Member | `member@skylinesos.demo` | same |

The 55 student accounts get random passwords that are never printed. **Passwords are not stored in the repo, the docs or the dataset**; give them to judges through the event's approved channel.

## 4. Loader specification (`scripts/seed.mjs`)

Reads `seed/demo-data.json`; uses the service-role key from `scripts/.env`; runs against the real project; **idempotent** (skips rows that already exist by email, slug, SKU or idempotency key).

```text
 0. Safety: refuse to run if DEMO_CLUB != "true"; print the project URL and wait 5 s.
 1. Auth users  → admin API createUser (email_confirm: true); profile + role rows via the new-user trigger;
                  set role for the 4 staff accounts; create the walk-in guest profile.
 2. Tiers        → insert.
 3. Events       → insert as `published` (so purchases are allowed); ticket types.
 4. Products     → insert; variants with stock_on_hand.
 5. Applications → insert via fn (status pending, revision 1) using submitted_at = now − (3…10 days);
                   review via fn_review_application for approved/rejected; for the 2 rejected+resubmitted
                   apply the PUT flow so revision = 2 and history keeps the first rejection.
 6. Membership dues → fn_record_staff_checkout(method, note "Seed: dues", effective_on = `start`)
                   in the order listed, so member prices/discounts apply to later purchases.
 7. Ticket purchases → fn_record_staff_checkout (buyer, ticket_type, qty 1, method, effective_on = event date − 1…14 days);
                   then fn_check_in for the entries with check_in = true (staff = door account).
 8. Past events  → set status `completed`.
 9. Merch orders → fn_record_staff_checkout; then update fulfilment status per the file.
10. Announcements→ create; publish the ones marked published.
11. Fundraisers  → create; tasks; contributions via fn_record_contribution.
12. Expenses     → submit via the expense function, then apply status transitions with a different actor than the submitter.
13. Run fn_expire_checkouts() and fn_renewal_reminders() once.
14. Verify (see §5) and print a summary table. Exit non-zero if any check fails.
```

`--reset` (optional) truncates **only** rows where the owning profile has `is_demo = true`, in dependency order, and refuses to run unless `DEMO_CLUB=true`. Real data is never touched. Ledger deletion is blocked by trigger, so reset is a **project-level** action on the demo project (recreate via migrations) — keep the demo project separate from anything real.

## 5. Verification queries (run by the loader and before the demo)

```sql
-- 1) Ledger reconciliation: ledger must equal source records
select
  (select coalesce(sum(amount_paise),0) from ledger_entries where direction='in')  as ledger_in,
  (select coalesce(sum(unit_price_paise*quantity - discount_paise),0)
     from checkout_items ci join checkouts c on c.id=ci.checkout_id
    where c.status='fulfilled')
  + (select coalesce(sum(amount_paise),0) from contributions)                      as source_in;     -- must match

select
  (select coalesce(sum(amount_paise),0) from ledger_entries where direction='out') as ledger_out,
  (select coalesce(sum(amount_paise),0) from expenses where status='paid')         as source_out;    -- must match

-- 2) No negative or oversold stock
select * from product_variants where stock_on_hand < 0 or reserved > stock_on_hand;                   -- 0 rows

-- 3) No event over capacity
select e.id from events e
 join tickets t on t.event_id=e.id and t.status<>'cancelled'
 group by e.id, e.capacity having count(*) > e.capacity;                                              -- 0 rows

-- 4) One check-in per ticket
select ticket_id from check_ins group by 1 having count(*) > 1;                                       -- 0 rows

-- 5) Browser roles see nothing
set role anon;          select count(*) from profiles;    -- permission denied
reset role;
```

## 6. What the seeded club shows in each scene

| Scene | What judges will see from the seed |
|---|---|
| 1 Join | 20 active members, 4 expiring within 30 days, 4 expired; 6 pending applications; rejected applications with reasons; 2 approved-unpaid students for the live "pay dues" demo |
| 2 Gala | Skyline Gala Night with ≈ 32 tickets sold of 120; Freshers/Hack Night with realistic attendance (checked-in < sold) |
| 3 Announcements | Public, members-only and staff-only posts; one draft |
| 4 Hoodies | Plus/Core member discounts; **Hoodie S has 2 left** (low-stock warning); fulfilment states mixed |
| 5 Fundraiser | Two fundraisers with tasks, 5 overdue, and cash/UPI contributions; progress is 16 % (₹4,050 of ₹25,000) for the bake sale |
| 6 Treasurer | Dues ≈ ₹8,800, ticket and merch income, fundraiser cash ₹5,900, paid expenses ₹6,500 → a believable net movement, every row linked to its source |

**Action-queue rules visible out of the box:** renewal due (4), low stock (1), overdue tasks (5), reimbursements waiting (3), applications waiting (6). The sixth rule — **low event availability** — can be triggered live by lowering an event's capacity in the admin screen.

## 7. Demo-day operating rules

1. Seed **the day before**, then log in with all five accounts and run the script once.
2. Do not edit tables by hand. If something looks wrong, fix the cause (code or migration) and re-seed on the demo project.
3. During the demo, create *new* records through the UI (the live purchase, the live check-in, the new announcement) so judges see the system working, not just pre-filled data.
4. Keep a printed card with the five accounts' emails (not passwords) and the fallback path (cash + manual lookup).
5. Never commit `scripts/.env`, the service-role key, or the demo password.
