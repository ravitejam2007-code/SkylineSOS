# SkylineSOS — Student Organization System

> **Odoo × NMIT 2026 Hackathon** · High-Integrity Campus Club Operations Platform  
> *One App. One Permission Model. One Immutable Ledger.*

---

## 1. Executive Summary & Problem Statement

College student clubs struggle with fragmented operations: Google Forms for membership signups, insecure QR codes screenshot and shared among non-paying friends, manual spreadsheets for hoodie merchandise orders, and untraceable cash/UPI receipts that lead to treasurer deficits and audit disputes.

**SkylineSOS** eliminates campus leakage through three core engineering innovations:
1. **Zero-Camera Door Verification:** Door staff type 6-digit rotating member codes or 8-character Crockford ticket codes with immediate feedback in under 0.5 seconds. No camera glare, bad lighting, or scanner crashes at dark auditorium doors.
2. **Atomic Anti-Oversell Engine:** Database row-level locks (`FOR UPDATE`) in PostgreSQL prevent concurrency race conditions. 20 students competing for the last 5 seats are reconciled cleanly with zero overbooking.
3. **Immutable Double-Entry Ledger:** Every rupee recorded on the treasurer screen connects directly to a verified checkout ID, dues receipt, or approved reimbursement claim with append-only database triggers.

---

## 2. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Astro 5 Static Frontend (apps/web)                   │
│   Tailwind CSS v4 · Meta Design Tokens · Responsive Viewport (360px+)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Authenticated REST (Bearer JWT)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Supabase Edge Function: Express API (api)                │
│   RequestId · CORS · Auth Middleware · RBAC · Zod Validation · HMAC   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Atomic plpgsql RPC Calls
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL Core (Postgres 15)                │
│   RLS Deny-All · Row Locks · Append-Only Ledger Triggers · pg_cron    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 15-Minute Local Quickstart

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)
- Git

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ravitejam2007-code/SkylineSOS.git
   cd SkylineSOS
   ```

2. **Install all monorepo dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp docs/.env.example .env
   cp docs/.env.example apps/web/.env
   ```
   *(Fill in your Supabase project credentials or use the shared team demo project `xwwkpwzartndbjlzpttc`).*

4. **Build shared contracts and static frontend:**
   ```bash
   npm run build
   ```

5. **Start local development web server:**
   ```bash
   cd apps/web
   npm run dev
   ```
   *Open [http://localhost:4321](http://localhost:4321) in your browser.*

---

## 4. Demo Accounts & Credentials

For hackathon judging and live evaluation, 5 pre-configured demo role accounts are seeded into the database:

| Role | Email | Password | Access / Capabilities |
|---|---|---|---|
| **Administrator** | `admin@skylinesos.demo` | `Skyline@2026` | Full system console, membership reviews, events, merch, and action queue. |
| **Treasurer** | `treasurer@skylinesos.demo` | `Skyline@2026` | Double-entry ledger, expense approvals, financial audit trail. |
| **Door Staff** | `door@skylinesos.demo` | `Skyline@2026` | High-speed door verification console, manual attendee search. |
| **Volunteer** | `volunteer@skylinesos.demo` | `Skyline@2026` | Task kanban board, manual donation logging, expense reimbursement claims. |
| **Student Member** | `member@skylinesos.demo` | `Skyline@2026` | Rotating 60s dynamic pass, gala tickets, hoodie pre-orders. |

> **Pro-tip:** Visit [`/login`](http://localhost:4321/login) to use the **1-Click Role Switcher** to instantaneously jump between any account without typing credentials.

---

## 5. Live Judge Demonstration Script (5-Minute Runbook)

| Stage | Screen / Route | Action & Key Talking Point |
|---|---|---|
| **1. The Pitch & Landing** | `/` | Present the **Live Interactive Simulator** on the hero band. Show sub-second door check-in, 60s rotating pass, and real-time ledger stats. |
| **2. Member Application (Scene 1)** | `/membership` → `/admin/applications` | Apply for student membership as a student. Switch to Admin and approve the application with one click. |
| **3. Anti-Screenshot Pass (Scene 1)** | `/membership/card` | Show the rotating 6-digit dynamic pass with the live countdown ring. Explain why static screenshot sharing is defeated. |
| **4. Gala Ticketing & Door Check-in (Scene 2)** | `/events` → `/door` | Purchase a Gala Night ticket. Take the 8-character Crockford code (e.g. `SKY-GALA-0042`) and verify it at the Door Console. Show immediate green approval and seat decrement. |
| **5. Merchandise & Fulfilment (Scene 4)** | `/merch` → `/admin/merch` | Pre-order a club hoodie. Show stock decrementing in real time and mark the order item fulfilled in the staff inventory view. |
| **6. Treasurer Reconciliation (Scene 6)** | `/treasurer` | Show the source-linked double-entry ledger. Point out how every rupee connects back to the Gala ticket order and dues receipt. |

---

## 6. Security & Integrity Guarantees

- **Deny-All RLS Architecture:** Browser connections cannot query database tables directly. All queries pass through the validated Express API middleware.
- **Append-Only Ledger Triggers:** PostgreSQL database triggers reject any `UPDATE` or `DELETE` query against `ledger_entries`. Ledger records are mathematically immutable.
- **Constant-Time Webhook Verification:** Razorpay payment webhooks use Web Crypto constant-time HMAC-SHA256 signature verification to prevent timing attacks.
- **Rate-Limiting on Verification Gates:** Door check-in endpoints are rate-limited via database RPC to prevent brute-force code enumeration.

---

## 7. License & Hackathon Attribution

Built for the **Odoo × NMIT 2026 Hackathon** by the **SkylineSOS Engineering Team**:
- R1: Tech Lead · API & Payments
- R2: Database & Data Integrity
- R3: Frontend Lead · Design System
- R4: Operations UI · QA & Demo Lead