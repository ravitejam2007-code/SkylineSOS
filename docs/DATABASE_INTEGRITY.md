# SkylineSOS — Database Integrity & Concurrency Specification (Phase 7)

## Overview
This document defines the mathematical, transactional, and concurrency invariants enforced across the **SkylineSOS** PostgreSQL database, Supabase Edge Functions, and application services as required by **Phase 7** of the Database & Authentication roadmap.

---

## 1. Core Invariants Matrix

| Invariant | Description | Database Enforcement Mechanism | Error Code / Behavior |
|---|---|---|---|
| **INV-01: Ledger Immutability** | Financial ledger entries are strictly append-only. No row may be updated or deleted. | Trigger `trg_protect_ledger` on `ledger_entries` | `LEDGER_IMMUTABLE` (500/409) |
| **INV-02: Ledger Reconciliation** | Mathematical balance identity holds: `Net Movement = Total Inflow - Total Outflow`. | Aggregated via `fn_treasurer_overview`, checked on each write | `unique (source_type, source_id)` prevents duplicates |
| **INV-03: Event Capacity Limit** | Sold tickets + pending active reservations cannot exceed event or ticket-type limits. | Row lock `SELECT ... FOR UPDATE` in `fn_create_checkout`, counts checked atomically | `CAPACITY_EXCEEDED` (409) |
| **INV-04: Single-Use Door Check-In** | A ticket may only be checked in once. Subsequent attempts must fail with original timestamp preserved. | Row lock on `tickets` in `fn_check_in`, single-row `check_ins` table with `ticket_id` PK | `TICKET_ALREADY_CHECKED_IN` (409) |
| **INV-05: Merchandise Stock Integrity** | Reserved stock cannot exceed stock on hand (`reserved <= stock_on_hand`), and stock cannot be negative. | Table constraints `check (reserved <= stock_on_hand)` and `check (stock_on_hand >= 0)` | `OUT_OF_STOCK` (409) / Check Violation |
| **INV-06: Payment & Webhook Idempotency** | Duplicate payment webhook calls or replay attacks must never generate duplicate tickets or ledger rows. | Status check in `fn_fulfil_checkout` (`status in ('paid', 'fulfilled')`), `provider_event_id` PK | Returns idempotent payload, no-op on ledger |
| **INV-07: Segregation of Duties** | An expense submitter cannot approve their own expense. Unapproved expenses cannot be marked paid. | Explicit identity comparison `v_expense.submitted_by = p_actor_id` in `fn_set_expense_status` | `SELF_APPROVAL_FORBIDDEN` (403), `CONFLICT` (409) |
| **INV-08: Zero-Secret Audit Trail** | Sensitive actions are recorded in `audit_logs` without leaking passwords, tokens, or private secrets. | Sanitized JSONB `meta` payload in database triggers and RPCs | Safe audit history |

---

## 2. Concurrency Race Conditions Handled

### 2.1 Capacity Limit Overshoot (The "Flash Crowd" Problem)
* **Risk:** Multiple users initiate checkout for the last remaining ticket simultaneously.
* **Mitigation:**
  * `fn_create_checkout` acquires an exclusive row lock (`FOR UPDATE`) on `ticket_types` and `events`.
  * Computes `sold_count + pending_count + requested_qty`.
  * If the sum exceeds `quantity_limit`, the transaction is rolled back with `CAPACITY_EXCEEDED`.
  * Expired pending checkouts are cleaned up automatically by `fn_expire_checkouts` scheduled via `pg_cron`.

### 2.2 Door Check-In Race (Double Gate Entry)
* **Risk:** The same ticket code is submitted simultaneously at two different door gates.
* **Mitigation:**
  * `fn_check_in` issues `SELECT * FROM tickets WHERE code = ... FOR UPDATE`.
  * The first transaction writes to `check_ins(ticket_id, staff_id, checked_in_at)` and updates `tickets.status = 'checked_in'`.
  * The second concurrent transaction waits on the lock, reads the updated `checked_in` status, and throws `TICKET_ALREADY_CHECKED_IN` containing the exact timestamp of the first entry.

### 2.3 Stock Decrement & Expiration Reconciliation
* **Risk:** Checkout reservation locks merchandise stock, but buyer abandons payment.
* **Mitigation:**
  * Creation increments `reserved`.
  * Fulfilment atomically decrements both `stock_on_hand` and `reserved` by equal amounts.
  * Minute cron (`fn_expire_checkouts`) detects abandoned checkouts (`expires_at <= now()`) and decrements `reserved` without touching `stock_on_hand`.

---

## 3. Verification & Automated Testing

### 3.1 Automated Test Suite
Run the full test suite (79 tests across 24 suites):
```bash
npm test
```
The integrity tests in `tests/integrity.test.mjs` verify:
1. **Ledger Immutability & Mathematical Reconciliation** (4 tests)
2. **Event Capacity & Ticket Allocation Invariants** (2 tests)
3. **Door Gate Check-In & Single-Use Ticket Guarantees** (4 tests)
4. **Merchandise Stock & Reservation Invariants** (4 tests)
5. **Payment Webhook & Fulfilment Idempotency** (2 tests)
6. **Expense Approvals & Segregation of Duties** (3 tests)
7. **Dynamic Member Code Rotation & TTL Invariants** (1 test)
8. **Audit Logging & Zero Secrets Guarantee** (2 tests)

### 3.2 Live Database Invariant Verifier
To verify constraints, schema tables, and ledger balance against the live connected Supabase database:
```bash
npm run verify:integrity
```
This script queries the remote PostgreSQL database and asserts:
* All 27 core tables exist and are accessible with `service_role`.
* `fn_treasurer_overview` satisfies `Inflow - Outflow == Net Movement`.
* All product variants satisfy `reserved <= stock_on_hand >= 0`.
* All checked-in tickets have exactly 1 record in `check_ins`.
