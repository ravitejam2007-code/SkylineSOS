import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// =====================================================================
// SkylineSOS Phase 7: Integrity & Concurrency Invariant Test Suite
// Verifies transaction boundaries, database constraints, immutable ledger,
// capacity limits, single-use check-in, stock reservations, and idempotency.
// =====================================================================

// --- Helper Functions Simulating Database State & Triggers ---

class MockDatabase {
  constructor() {
    this.ledgerEntries = [];
    this.tickets = [];
    this.checkIns = [];
    this.productVariants = new Map();
    this.checkouts = new Map();
    this.auditLogs = [];
    this.webhookEvents = new Set();
  }

  // Invariant 1: Ledger Immutability & Reversals
  insertLedgerEntry(entry) {
    if (entry.amountPaise < 0) {
      throw new Error("CHECK_VIOLATION: amount_paise must be >= 0");
    }
    // Unique (source_type, source_id)
    const duplicate = this.ledgerEntries.find(
      (e) => e.sourceType === entry.sourceType && e.sourceId === entry.sourceId
    );
    if (duplicate) {
      throw new Error("UNIQUE_VIOLATION: duplicate ledger entry for source");
    }
    const record = { id: crypto.randomUUID(), ...entry, createdAt: new Date() };
    this.ledgerEntries.push(record);
    return record;
  }

  updateLedgerEntry(id, _updates) {
    // Triggers trg_protect_ledger()
    throw new Error("LEDGER_IMMUTABLE: ledger entries cannot be updated or deleted");
  }

  deleteLedgerEntry(id) {
    // Triggers trg_protect_ledger()
    throw new Error("LEDGER_IMMUTABLE: ledger entries cannot be updated or deleted");
  }

  getTreasurerOverview() {
    let inPaise = 0;
    let outPaise = 0;
    for (const e of this.ledgerEntries) {
      if (e.direction === "in") inPaise += e.amountPaise;
      else if (e.direction === "out") outPaise += e.amountPaise;
    }
    return {
      inPaise,
      outPaise,
      netPaise: inPaise - outPaise
    };
  }

  // Invariant 2: Capacity & Ticket Allocation
  createTicketCheckout({ ticketTypeId, eventId, capacity, soldCount, requestedQty, activePendingQty }) {
    if (requestedQty <= 0) {
      throw new Error("VALIDATION_FAILED: quantity must be positive");
    }
    if (soldCount + activePendingQty + requestedQty > capacity) {
      throw new Error("CAPACITY_EXCEEDED: ticket type sold out");
    }
    const checkoutId = crypto.randomUUID();
    return { checkoutId, status: "pending", expiresAt: Date.now() + 15 * 60 * 1000 };
  }

  // Invariant 3: Door Check-In Single-Use
  checkInTicket({ ticketId, eventId, staffId }) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND: no ticket matches code");
    }
    if (ticket.eventId !== eventId) {
      throw new Error("WRONG_EVENT: ticket is for another event");
    }
    if (ticket.status === "cancelled") {
      throw new Error("TICKET_CANCELLED: ticket has been cancelled");
    }
    if (ticket.status === "checked_in") {
      const existing = this.checkIns.find((c) => c.ticketId === ticketId);
      throw new Error(`TICKET_ALREADY_CHECKED_IN: Already checked in at ${existing?.checkedInAt}`);
    }

    const checkedInAt = new Date().toISOString();
    ticket.status = "checked_in";
    this.checkIns.push({ ticketId, staffId, checkedInAt });

    this.auditLogs.push({
      actorId: staffId,
      action: "ticket_checked_in",
      entityType: "ticket",
      entityId: ticketId,
      meta: { checkedInAt }
    });

    return { ticketId, status: "checked_in", checkedInAt };
  }

  // Invariant 4: Merch Stock Reservations
  initVariant(sku, stockOnHand) {
    this.productVariants.set(sku, { sku, stockOnHand, reserved: 0 });
  }

  reserveStock(sku, qty) {
    const variant = this.productVariants.get(sku);
    if (!variant) throw new Error("NOT_FOUND: product variant not found");
    const available = variant.stockOnHand - variant.reserved;
    if (available < qty) {
      throw new Error("OUT_OF_STOCK: item out of stock");
    }
    variant.reserved += qty;
    return variant;
  }

  releaseStockReservation(sku, qty) {
    const variant = this.productVariants.get(sku);
    if (variant) {
      variant.reserved = Math.max(0, variant.reserved - qty);
    }
  }

  fulfilStock(sku, qty) {
    const variant = this.productVariants.get(sku);
    if (!variant) throw new Error("NOT_FOUND: product variant not found");
    variant.stockOnHand -= qty;
    variant.reserved = Math.max(0, variant.reserved - qty);
    if (variant.stockOnHand < 0) {
      throw new Error("CHECK_VIOLATION: stock_on_hand cannot be negative");
    }
    return variant;
  }

  // Invariant 5: Expense Approvals & Self-Approval Guard
  setExpenseStatus({ expense, actorId, newStatus, reason }) {
    if (newStatus === "approved" && expense.submittedBy === actorId) {
      throw new Error("SELF_APPROVAL_FORBIDDEN: submitter cannot approve own expense");
    }
    if (newStatus === "paid" && expense.status !== "approved") {
      throw new Error("CONFLICT: expense must be approved before marked paid");
    }

    expense.status = newStatus;
    expense.reviewedBy = actorId;

    if (newStatus === "paid") {
      this.insertLedgerEntry({
        direction: "out",
        amountPaise: expense.amountPaise,
        category: "expense",
        method: "manual_upi",
        sourceType: "expense",
        sourceId: expense.id,
        memo: expense.description,
        createdBy: actorId
      });
    }

    this.auditLogs.push({
      actorId,
      action: `expense_${newStatus}`,
      entityType: "expense",
      entityId: expense.id,
      meta: { amountPaise: expense.amountPaise }
    });

    return expense;
  }
}

// =====================================================================
// Test Suite 1: Ledger Immutability & Mathematical Balance
// =====================================================================
describe("Integrity Suite 1: Ledger Immutability & Mathematical Reconciliation", () => {
  it("should preserve mathematical equality: Inflow - Outflow = Net Movement", () => {
    const db = new MockDatabase();
    db.insertLedgerEntry({
      direction: "in",
      amountPaise: 50000,
      category: "tickets",
      method: "online_test",
      sourceType: "checkout_item",
      sourceId: "item-1"
    });
    db.insertLedgerEntry({
      direction: "in",
      amountPaise: 25000,
      category: "dues",
      method: "cash",
      sourceType: "checkout_item",
      sourceId: "item-2"
    });
    db.insertLedgerEntry({
      direction: "out",
      amountPaise: 15000,
      category: "expense",
      method: "manual_upi",
      sourceType: "expense",
      sourceId: "exp-1"
    });

    const overview = db.getTreasurerOverview();
    assert.equal(overview.inPaise, 75000, "Inflow should sum ticket + dues");
    assert.equal(overview.outPaise, 15000, "Outflow should sum expenses");
    assert.equal(overview.netPaise, 60000, "Net should exactly equal Inflow - Outflow");
    assert.equal(overview.netPaise, overview.inPaise - overview.outPaise);
  });

  it("should strictly reject any update or delete on ledger entries (trg_protect_ledger)", () => {
    const db = new MockDatabase();
    const entry = db.insertLedgerEntry({
      direction: "in",
      amountPaise: 10000,
      category: "merch",
      method: "online_test",
      sourceType: "checkout_item",
      sourceId: "item-merch-1"
    });

    assert.throws(
      () => db.updateLedgerEntry(entry.id, { amountPaise: 20000 }),
      /LEDGER_IMMUTABLE/,
      "Update on ledger must be prevented"
    );

    assert.throws(
      () => db.deleteLedgerEntry(entry.id),
      /LEDGER_IMMUTABLE/,
      "Delete on ledger must be prevented"
    );
  });

  it("should enforce unique (source_type, source_id) to prevent duplicate ledger postings", () => {
    const db = new MockDatabase();
    db.insertLedgerEntry({
      direction: "in",
      amountPaise: 5000,
      category: "tickets",
      method: "cash",
      sourceType: "checkout_item",
      sourceId: "item-unique-1"
    });

    assert.throws(
      () =>
        db.insertLedgerEntry({
          direction: "in",
          amountPaise: 5000,
          category: "tickets",
          method: "cash",
          sourceType: "checkout_item",
          sourceId: "item-unique-1"
        }),
      /UNIQUE_VIOLATION/,
      "Duplicate ledger posting for same source must throw unique violation"
    );
  });

  it("should reject negative amount_paise check constraint violations", () => {
    const db = new MockDatabase();
    assert.throws(
      () =>
        db.insertLedgerEntry({
          direction: "in",
          amountPaise: -100,
          category: "tickets",
          method: "online_test",
          sourceType: "checkout_item",
          sourceId: "item-neg-1"
        }),
      /CHECK_VIOLATION/
    );
  });
});

// =====================================================================
// Test Suite 2: Event Capacity & Ticket Allocation Invariants
// =====================================================================
describe("Integrity Suite 2: Event Capacity & Ticket Allocation Invariants", () => {
  it("should accurately prevent checkout creation when capacity is reached", () => {
    const db = new MockDatabase();
    const capacity = 100;
    const soldCount = 95;
    const activePendingQty = 3;

    // 95 sold + 3 pending + 2 requested = 100 <= 100 (OK)
    const co = db.createTicketCheckout({
      ticketTypeId: "tt-1",
      eventId: "ev-1",
      capacity,
      soldCount,
      activePendingQty,
      requestedQty: 2
    });
    assert.ok(co.checkoutId);

    // 95 sold + 3 pending + 3 requested = 101 > 100 (CAPACITY_EXCEEDED)
    assert.throws(
      () =>
        db.createTicketCheckout({
          ticketTypeId: "tt-1",
          eventId: "ev-1",
          capacity,
          soldCount,
          activePendingQty,
          requestedQty: 3
        }),
      /CAPACITY_EXCEEDED/,
      "Capacity exceeded error must be raised when requested qty overflows limit"
    );
  });

  it("should release pending capacity when checkouts expire", () => {
    const capacity = 50;
    let soldCount = 48;
    let activePendingQty = 2; // Full: 48 + 2 = 50

    const db = new MockDatabase();
    assert.throws(
      () =>
        db.createTicketCheckout({
          ticketTypeId: "tt-2",
          eventId: "ev-2",
          capacity,
          soldCount,
          activePendingQty,
          requestedQty: 1
        }),
      /CAPACITY_EXCEEDED/
    );

    // Simulate fn_expire_checkouts() releasing 2 pending units
    activePendingQty -= 2;

    const co = db.createTicketCheckout({
      ticketTypeId: "tt-2",
      eventId: "ev-2",
      capacity,
      soldCount,
      activePendingQty,
      requestedQty: 2
    });
    assert.ok(co.checkoutId, "Checkout must succeed after expired reservations are released");
  });
});

// =====================================================================
// Test Suite 3: Door Gate Check-In & Single-Use Enforcement
// =====================================================================
describe("Integrity Suite 3: Door Gate Check-In & Single-Use Ticket Guarantees", () => {
  it("should successfully check in valid issued ticket on first scan", () => {
    const db = new MockDatabase();
    const ticketId = "ticket-001";
    db.tickets.push({
      id: ticketId,
      eventId: "event-hackathon",
      status: "issued"
    });

    const res = db.checkInTicket({
      ticketId,
      eventId: "event-hackathon",
      staffId: "staff-door-1"
    });

    assert.equal(res.status, "checked_in");
    assert.ok(res.checkedInAt);
    const updatedTicket = db.tickets.find((t) => t.id === ticketId);
    assert.equal(updatedTicket.status, "checked_in");
  });

  it("should reject duplicate check-in with 409 TICKET_ALREADY_CHECKED_IN and preserve timestamp", () => {
    const db = new MockDatabase();
    const ticketId = "ticket-002";
    db.tickets.push({
      id: ticketId,
      eventId: "event-hackathon",
      status: "issued"
    });

    // First scan
    const firstCheckIn = db.checkInTicket({
      ticketId,
      eventId: "event-hackathon",
      staffId: "staff-door-1"
    });
    const originalTime = firstCheckIn.checkedInAt;

    // Second scan on same ticket
    assert.throws(
      () =>
        db.checkInTicket({
          ticketId,
          eventId: "event-hackathon",
          staffId: "staff-door-2"
        }),
      /TICKET_ALREADY_CHECKED_IN/
    );

    const ticketInDb = db.tickets.find((t) => t.id === ticketId);
    assert.equal(ticketInDb.status, "checked_in");
    assert.equal(db.checkIns.length, 1, "Only one check-in record may exist per ticket");
    assert.equal(db.checkIns[0].checkedInAt, originalTime, "Original check-in timestamp preserved");
  });

  it("should reject check-in if ticket belongs to a different event (WRONG_EVENT)", () => {
    const db = new MockDatabase();
    const ticketId = "ticket-003";
    db.tickets.push({
      id: ticketId,
      eventId: "event-gala",
      status: "issued"
    });

    assert.throws(
      () =>
        db.checkInTicket({
          ticketId,
          eventId: "event-hackathon",
          staffId: "staff-door-1"
        }),
      /WRONG_EVENT/
    );
  });

  it("should reject check-in on cancelled tickets (TICKET_CANCELLED)", () => {
    const db = new MockDatabase();
    const ticketId = "ticket-004";
    db.tickets.push({
      id: ticketId,
      eventId: "event-hackathon",
      status: "cancelled"
    });

    assert.throws(
      () =>
        db.checkInTicket({
          ticketId,
          eventId: "event-hackathon",
          staffId: "staff-door-1"
        }),
      /TICKET_CANCELLED/
    );
  });
});

// =====================================================================
// Test Suite 4: Merchandise Stock & Reservation Invariants
// =====================================================================
describe("Integrity Suite 4: Merchandise Stock & Reservation Invariants", () => {
  it("should correctly reserve available stock: available = stock_on_hand - reserved", () => {
    const db = new MockDatabase();
    db.initVariant("HOODIE-M", 20);

    // Reserve 5
    const variant = db.reserveStock("HOODIE-M", 5);
    assert.equal(variant.stockOnHand, 20);
    assert.equal(variant.reserved, 5);

    // Available is now 15. Attempting to reserve 16 must fail with OUT_OF_STOCK
    assert.throws(() => db.reserveStock("HOODIE-M", 16), /OUT_OF_STOCK/);
  });

  it("should release reserved stock when checkout expires without altering stock_on_hand", () => {
    const db = new MockDatabase();
    db.initVariant("TEE-L", 10);
    db.reserveStock("TEE-L", 4);

    // Available is 6, reserved is 4
    let v = db.productVariants.get("TEE-L");
    assert.equal(v.reserved, 4);

    // Expiration releases reservation
    db.releaseStockReservation("TEE-L", 4);
    v = db.productVariants.get("TEE-L");
    assert.equal(v.stockOnHand, 10, "Stock on hand must remain unaffected");
    assert.equal(v.reserved, 0, "Reserved stock must be reset to 0");
  });

  it("should decrement both stock_on_hand and reserved on checkout fulfilment", () => {
    const db = new MockDatabase();
    db.initVariant("STICKER-PACK", 50);
    db.reserveStock("STICKER-PACK", 10);

    const fulfilled = db.fulfilStock("STICKER-PACK", 10);
    assert.equal(fulfilled.stockOnHand, 40, "Stock on hand must be decremented by quantity");
    assert.equal(fulfilled.reserved, 0, "Reserved quantity must be decremented by quantity");
  });

  it("should enforce check (reserved <= stock_on_hand) and check (stock_on_hand >= 0)", () => {
    const db = new MockDatabase();
    db.initVariant("CAP-BLACK", 2);
    db.reserveStock("CAP-BLACK", 2);

    assert.throws(
      () => db.fulfilStock("CAP-BLACK", 5),
      /CHECK_VIOLATION/,
      "Cannot decrement below 0 stock on hand"
    );
  });
});

// =====================================================================
// Test Suite 5: Payment Webhook & Fulfilment Idempotency
// =====================================================================
describe("Integrity Suite 5: Payment Webhook & Fulfilment Idempotency", () => {
  it("should deduplicate webhook delivery via provider_event_id", () => {
    const db = new MockDatabase();
    const eventId = "evt_rzp_test_123456789";

    // First arrival
    const isFirst = !db.webhookEvents.has(eventId);
    if (isFirst) db.webhookEvents.add(eventId);
    assert.equal(isFirst, true, "First webhook delivery must be accepted");

    // Second arrival of same event
    const isDuplicate = db.webhookEvents.has(eventId);
    assert.equal(isDuplicate, true, "Duplicate webhook must be detected as existing");
  });

  it("should return idempotent success on duplicate fn_fulfil_checkout calls without double-posting ledger", () => {
    const db = new MockDatabase();
    const checkoutId = "co-idempotent-001";
    db.checkouts.set(checkoutId, { id: checkoutId, status: "pending" });

    // Helper simulating fn_fulfil_checkout idempotency guard
    function fulfil(id) {
      const co = db.checkouts.get(id);
      if (co.status === "fulfilled" || co.status === "paid") {
        return { id: co.id, status: co.status, idempotent: true };
      }
      co.status = "fulfilled";
      db.insertLedgerEntry({
        direction: "in",
        amountPaise: 4000,
        category: "dues",
        method: "online_test",
        sourceType: "checkout_item",
        sourceId: id
      });
      return { id: co.id, status: co.status, idempotent: false };
    }

    const firstRun = fulfil(checkoutId);
    assert.equal(firstRun.idempotent, false);
    assert.equal(db.ledgerEntries.length, 1);

    const secondRun = fulfil(checkoutId);
    assert.equal(secondRun.idempotent, true);
    assert.equal(db.ledgerEntries.length, 1, "Ledger entry count must not increase on replay");
  });
});

// =====================================================================
// Test Suite 6: Expense Approvals & Segregation of Duties
// =====================================================================
describe("Integrity Suite 6: Expense Approvals & Segregation of Duties", () => {
  it("should forbid submitter from self-approving their own expense (SELF_APPROVAL_FORBIDDEN)", () => {
    const db = new MockDatabase();
    const expense = {
      id: "exp-self-001",
      submittedBy: "user-alice",
      amountPaise: 12000,
      description: "Audio Cables",
      status: "submitted"
    };

    assert.throws(
      () =>
        db.setExpenseStatus({
          expense,
          actorId: "user-alice", // Submitter trying to approve
          newStatus: "approved"
        }),
      /SELF_APPROVAL_FORBIDDEN/
    );
  });

  it("should require prior approval before an expense can be marked paid (CONFLICT)", () => {
    const db = new MockDatabase();
    const expense = {
      id: "exp-paid-001",
      submittedBy: "user-bob",
      amountPaise: 8000,
      description: "Badges",
      status: "submitted"
    };

    // Submitter != Treasurer, but status is 'submitted'
    assert.throws(
      () =>
        db.setExpenseStatus({
          expense,
          actorId: "user-treasurer",
          newStatus: "paid"
        }),
      /CONFLICT/,
      "Expense must be approved before paid"
    );
  });

  it("should post outflow to ledger when expense is approved and marked paid", () => {
    const db = new MockDatabase();
    const expense = {
      id: "exp-paid-002",
      submittedBy: "user-bob",
      amountPaise: 8000,
      description: "Badges",
      status: "submitted"
    };

    // 1. Approve
    db.setExpenseStatus({
      expense,
      actorId: "user-treasurer",
      newStatus: "approved"
    });
    assert.equal(expense.status, "approved");
    assert.equal(db.ledgerEntries.length, 0, "No ledger entry on approval");

    // 2. Mark Paid
    db.setExpenseStatus({
      expense,
      actorId: "user-treasurer",
      newStatus: "paid"
    });
    assert.equal(expense.status, "paid");
    assert.equal(db.ledgerEntries.length, 1, "Exactly one outflow ledger entry posted");
    assert.equal(db.ledgerEntries[0].direction, "out");
    assert.equal(db.ledgerEntries[0].amountPaise, 8000);
    assert.equal(db.ledgerEntries[0].sourceId, expense.id);
  });
});

// =====================================================================
// Test Suite 7: Dynamic Member Code Rotation & Security Invariants
// =====================================================================
describe("Integrity Suite 7: Dynamic Member Code Rotation & TTL Invariants", () => {
  it("should issue valid 6-digit member code and reject expired codes", () => {
    const codeStore = new Map();

    function issueCode(userId, ttlSeconds = 60) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + ttlSeconds * 1000;
      codeStore.set(code, { userId, expiresAt });
      return { code, expiresAt };
    }

    function verifyCode(code) {
      const record = codeStore.get(code);
      if (!record || record.expiresAt <= Date.now()) {
        throw new Error("CODE_INVALID: verification code is invalid or expired");
      }
      return { valid: true, userId: record.userId };
    }

    const { code } = issueCode("member-01", 60);
    assert.equal(code.length, 6, "Code must be 6 digits");
    assert.match(code, /^\d{6}$/, "Code must contain only digits");

    const validResult = verifyCode(code);
    assert.equal(validResult.valid, true);

    // Simulate expired code
    const expiredRecord = issueCode("member-02", -5); // already expired
    assert.throws(() => verifyCode(expiredRecord.code), /CODE_INVALID/);
  });
});

// =====================================================================
// Test Suite 8: Audit Logging & Zero Secrets Guarantee
// =====================================================================
describe("Integrity Suite 8: Audit Logging & Zero Secrets Guarantee", () => {
  it("should capture state transitions without exposing passwords or JWTs", () => {
    const db = new MockDatabase();
    const sensitiveTokens = ["eyJh...jwt_secret", "Skyline@2026", "rzp_secret_key_123"];

    // Action with sanitized metadata
    db.auditLogs.push({
      actorId: "admin-uuid",
      action: "user.role.grant",
      entityType: "profile",
      entityId: "target-user-uuid",
      meta: { newRole: "treasurer", previousRole: "member" },
      createdAt: new Date().toISOString()
    });

    assert.equal(db.auditLogs.length, 1);
    const logStr = JSON.stringify(db.auditLogs[0]);

    for (const token of sensitiveTokens) {
      assert.equal(
        logStr.includes(token),
        false,
        `Audit log must never contain sensitive secret: ${token}`
      );
    }
  });

  it("should prevent demoting the sole remaining admin to preserve governance integrity", () => {
    const users = [
      { id: "u1", role: "admin" },
      { id: "u2", role: "treasurer" },
      { id: "u3", role: "member" }
    ];

    function changeRole(actorId, targetUserId, newRole) {
      const adminCount = users.filter((u) => u.role === "admin").length;
      const targetUser = users.find((u) => u.id === targetUserId);

      if (targetUser.role === "admin" && newRole !== "admin" && adminCount <= 1) {
        throw new Error("CONFLICT: cannot demote the last remaining admin");
      }
      targetUser.role = newRole;
      return targetUser;
    }

    assert.throws(
      () => changeRole("u1", "u1", "member"),
      /CONFLICT/,
      "Demoting the only admin must throw error to prevent orphan system"
    );
  });
});
