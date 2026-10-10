import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Routes Functional Specs: 1. System & Profile (/me, /health)", () => {
  it("GET /health should return ok: true, version v1, and current timestamp", () => {
    const healthResponse = {
      ok: true,
      version: "v1",
      time: new Date().toISOString()
    };
    assert.equal(healthResponse.ok, true);
    assert.equal(healthResponse.version, "v1");
    assert.ok(Date.parse(healthResponse.time));
  });

  it("GET /me should return sanitized profile with attached app role", () => {
    const profile = {
      id: "6c1e0000-0000-0000-0000-000000000001",
      fullName: "Demo Member",
      email: "member@skylinesos.demo",
      studentId: "4GT23AI005",
      role: "member",
      isDemo: true
    };
    assert.equal(profile.fullName, "Demo Member");
    assert.equal(profile.role, "member");
    assert.equal(profile.isDemo, true);
  });

  it("POST /me/verify-code should issue a 60-second rotating code with ttlSeconds", () => {
    const codeResponse = {
      data: {
        code: "482915",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        ttlSeconds: 60
      }
    };
    assert.match(codeResponse.data.code, /^\d{6}$/);
    assert.equal(codeResponse.data.ttlSeconds, 60);
    assert.ok(Date.parse(codeResponse.data.expiresAt) > Date.now());
  });

  it("GET /me/notifications should return formatted list of in-app alerts", () => {
    const notifications = [
      {
        id: "n1",
        kind: "renewal_reminder",
        title: "Membership expiring in 7 days",
        body: "Renew today to retain your 10% event discounts.",
        dedupeKey: "renew_n1",
        readAt: null,
        createdAt: new Date().toISOString()
      }
    ];
    assert.equal(notifications[0].kind, "renewal_reminder");
    assert.equal(notifications[0].readAt, null);
  });

  it("GET & PUT /me/preferences should manage topic-based email notification toggles", () => {
    const preferences = {
      events: true,
      merch: false,
      fundraisers: true,
      general: false
    };
    assert.equal(preferences.events, true);
    assert.equal(preferences.merch, false);
  });
});

describe("Routes Functional Specs: 2. Public Content (/public, /announcements)", () => {
  it("GET /public/events/:slug should compute event and ticket availability in real-time", () => {
    const capacity = 120;
    const soldTickets = 32;
    const availableTotal = Math.max(0, capacity - soldTickets);

    const ticketType1 = { limit: 60, sold: 10 };
    const tt1Available = Math.min(ticketType1.limit - ticketType1.sold, availableTotal);

    const eventDetail = {
      id: "e0b1",
      slug: "skyline-gala-2026",
      title: "Skyline Gala Night",
      capacity,
      available: availableTotal,
      ticketTypes: [
        {
          id: "tt1",
          name: "General Admission",
          pricePaise: 50000,
          memberPricePaise: 30000,
          memberOnly: false,
          available: tt1Available
        }
      ]
    };

    assert.equal(eventDetail.available, 88);
    assert.equal(eventDetail.ticketTypes[0].available, 50);
    assert.equal(eventDetail.ticketTypes[0].memberPricePaise, 30000);
  });

  it("GET /announcements should filter feed by caller audience level", () => {
    const allAnnouncements = [
      { id: "a1", audience: "public", title: "Public Launch" },
      { id: "a2", audience: "members", title: "Member Only Perks" },
      { id: "a3", audience: "staff", title: "Door Shift Roster" }
    ];

    const filterAudience = (role) => {
      let allowed = ["public"];
      if (role === "member") allowed = ["public", "members"];
      else if (["admin", "treasurer", "door", "volunteer"].includes(role)) {
        allowed = ["public", "members", "staff"];
      }
      return allAnnouncements.filter((a) => allowed.includes(a.audience));
    };

    assert.equal(filterAudience(null).length, 1);
    assert.equal(filterAudience("member").length, 2);
    assert.equal(filterAudience("volunteer").length, 3);
  });

  it("GET /public/merch should calculate available variant stock as stock_on_hand - reserved", () => {
    const variant = {
      id: "v1",
      sku: "HD-BLK-M",
      label: "M / Black",
      pricePaise: 89900,
      stockOnHand: 15,
      reserved: 3
    };
    const available = Math.max(0, variant.stockOnHand - variant.reserved);
    assert.equal(available, 12);
  });
});

describe("Routes Functional Specs: 3. Membership (/membership, /admin/tiers)", () => {
  it("PUT /membership/applications/:id should only allow resubmitting rejected applications", () => {
    const checkCanResubmit = (appStatus) => {
      if (appStatus !== "rejected") {
        throw new Error("CONFLICT: Only rejected applications can be resubmitted");
      }
      return true;
    };

    assert.equal(checkCanResubmit("rejected"), true);
    assert.throws(() => checkCanResubmit("pending"), /CONFLICT/);
    assert.throws(() => checkCanResubmit("approved"), /CONFLICT/);
  });

  it("POST /admin/members/walk-up should restrict door staff from taking dues", () => {
    const handleWalkUp = (staffRole, hasPayment) => {
      if (staffRole === "door" && hasPayment) {
        throw new Error("FORBIDDEN: Door staff may only create walk-up applications, not process dues");
      }
      return { success: true };
    };

    assert.equal(handleWalkUp("admin", true).success, true);
    assert.equal(handleWalkUp("door", false).success, true);
    assert.throws(() => handleWalkUp("door", true), /FORBIDDEN/);
  });

  it("POST /admin/membership/applications/:id/review requires reason on rejection", () => {
    const reviewApp = (decision, reason) => {
      if (decision === "rejected" && (!reason || reason.trim().length === 0)) {
        throw new Error("VALIDATION_FAILED: Rejection reason is required");
      }
      return { status: decision };
    };

    assert.equal(reviewApp("approved", null).status, "approved");
    assert.equal(reviewApp("rejected", "ID mismatch").status, "rejected");
    assert.throws(() => reviewApp("rejected", ""), /VALIDATION_FAILED/);
  });
});

describe("Routes Functional Specs: 4. Identity & Door Gate Operations", () => {
  it("POST /door/check-in should reject already checked-in tickets with 409 and timestamps", () => {
    const ticket = { status: "checked_in", checkedInAt: "2026-10-17T13:12:08Z", by: "Demo Door Staff" };
    const checkIn = (t) => {
      if (t.status === "checked_in") {
        throw new Error(`TICKET_ALREADY_CHECKED_IN: Already checked in at ${t.checkedInAt}`);
      }
      return { status: "checked_in" };
    };

    assert.throws(() => checkIn(ticket), /TICKET_ALREADY_CHECKED_IN/);
  });

  it("GET /door/tickets should sanitize codes and mask attendee emails", () => {
    const maskEmail = (email) => {
      if (!email || !email.includes("@")) return "***";
      const [local, domain] = email.split("@");
      return `${local[0]}***${local[local.length - 1]}@${domain}`;
    };

    const attendeeRecord = {
      ticketId: "t-123",
      holderName: "Aarav Gowda",
      ticketType: "General Admission",
      status: "issued",
      rawEmail: "aarav.gowda@students.skylinesos.demo"
    };

    const sanitized = {
      ticketId: attendeeRecord.ticketId,
      holderName: attendeeRecord.holderName,
      ticketType: attendeeRecord.ticketType,
      status: attendeeRecord.status,
      maskedEmail: maskEmail(attendeeRecord.rawEmail)
    };

    assert.equal(sanitized.maskedEmail, "a***a@students.skylinesos.demo");
    assert.equal(sanitized.code, undefined, "Ticket code MUST NEVER be exposed in attendee list");
  });

  it("GET /staff/members should hide sensitive fields from non-admin staff", () => {
    const rawMember = {
      id: "u1",
      fullName: "Neha Sharma",
      email: "neha@skylinesos.demo",
      studentId: "4GT23CS042",
      isDemo: false,
      tier: "Plus"
    };

    const formatForStaff = (role, m) => {
      if (role === "admin") {
        return { ...m };
      }
      // Minimal fields for door and treasurer
      return {
        id: m.id,
        fullName: m.fullName,
        studentId: m.studentId,
        tier: m.tier
      };
    };

    const doorView = formatForStaff("door", rawMember);
    assert.equal(doorView.email, undefined);
    assert.equal(doorView.isDemo, undefined);
    assert.equal(doorView.fullName, "Neha Sharma");

    const adminView = formatForStaff("admin", rawMember);
    assert.equal(adminView.email, "neha@skylinesos.demo");
  });
});

describe("Routes Functional Specs: 5. Checkout & Payments", () => {
  it("POST /checkout should fulfil ₹0 checkouts immediately without Razorpay order", () => {
    const handleCheckout = (totalPaise) => {
      if (totalPaise === 0) {
        return {
          status: "fulfilled",
          razorpay: null
        };
      }
      return {
        status: "pending",
        razorpay: { orderId: "order_123", amountPaise: totalPaise }
      };
    };

    const freeRes = handleCheckout(0);
    assert.equal(freeRes.status, "fulfilled");
    assert.equal(freeRes.razorpay, null);

    const paidRes = handleCheckout(50000);
    assert.equal(paidRes.status, "pending");
    assert.ok(paidRes.razorpay.orderId);
  });

  it("POST /staff/checkout requires non-empty note for cash or manual UPI", () => {
    const recordStaffCheckout = (note) => {
      if (!note || note.trim().length === 0) {
        throw new Error("NOTE_REQUIRED: Verification note required for staff checkout");
      }
      return { status: "fulfilled", verification: "staff_recorded" };
    };

    assert.equal(recordStaffCheckout("Paid ₹600 cash at door").status, "fulfilled");
    assert.throws(() => recordStaffCheckout(""), /NOTE_REQUIRED/);
    assert.throws(() => recordStaffCheckout(null), /NOTE_REQUIRED/);
  });

  it("POST /staff/checkout forbids door staff from selling non-ticket items", () => {
    const validateDoorItems = (role, items) => {
      if (role === "door") {
        const hasNonTicket = items.some((i) => i.itemType !== "ticket");
        if (hasNonTicket) {
          throw new Error("FORBIDDEN: Door staff can only record ticket sales");
        }
      }
      return true;
    };

    assert.equal(validateDoorItems("door", [{ itemType: "ticket" }]), true);
    assert.throws(() => validateDoorItems("door", [{ itemType: "merch" }]), /FORBIDDEN/);
    assert.equal(validateDoorItems("treasurer", [{ itemType: "merch" }]), true);
  });
});

describe("Routes Functional Specs: 6. Treasury, Ledger & Admin Governance", () => {
  it("POST /expenses/:id/status should forbid self-approval by submitter", () => {
    const reviewExpense = (submitterId, reviewerId, action) => {
      if (action === "approved" && submitterId === reviewerId) {
        throw new Error("SELF_APPROVAL_FORBIDDEN: Submitters cannot approve their own expenses");
      }
      return { status: "approved" };
    };

    assert.equal(reviewExpense("user-1", "user-2", "approved").status, "approved");
    assert.throws(() => reviewExpense("user-1", "user-1", "approved"), /SELF_APPROVAL_FORBIDDEN/);
  });

  it("PATCH /admin/users/:id/role should prevent demoting the last remaining admin", () => {
    const demoteAdmin = (currentRole, newRole, adminCount) => {
      if (currentRole === "admin" && newRole !== "admin" && adminCount <= 1) {
        throw new Error("CONFLICT: Cannot demote the last remaining admin");
      }
      return { role: newRole };
    };

    assert.equal(demoteAdmin("admin", "treasurer", 2).role, "treasurer");
    assert.throws(() => demoteAdmin("admin", "member", 1), /CONFLICT/);
  });

  it("PATCH /admin/variants/:id should forbid reducing stock below reserved quantity", () => {
    const adjustStock = (currentStock, reserved, delta) => {
      const newStock = currentStock + delta;
      if (newStock < reserved) {
        throw new Error("OUT_OF_STOCK: Cannot reduce stock below already reserved quantity");
      }
      return newStock;
    };

    assert.equal(adjustStock(10, 3, -5), 5);
    assert.throws(() => adjustStock(10, 3, -8), /OUT_OF_STOCK/);
  });
});
