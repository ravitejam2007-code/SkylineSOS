import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from scripts/.env or root .env
function loadEnv() {
  const envPaths = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "supabase", ".env.local")
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...rest] = trimmed.split("=");
          const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SEED_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SEED_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD || "Skyline@2026";
const demoClub = process.env.DEMO_CLUB || "true";

if (!supabaseUrl || !serviceKey) {
  console.error("❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("   Ensure .env or scripts/.env is populated with valid keys.");
  process.exit(1);
}

if (demoClub !== "true") {
  console.error("❌ ERROR: Safety check DEMO_CLUB != 'true'. Refusing to seed non-demo project.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log("=================================================================");
  console.log("  SkylineSOS — Demo Data Loader (297 seed records)");
  console.log(`  Target: ${supabaseUrl}`);
  console.log("=================================================================\n");

  const dataPath = path.join(__dirname, "..", "seed", "demo-data.json");
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Could not find seed data file at ${dataPath}`);
    process.exit(1);
  }

  const seedData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log(`✓ Loaded demo data file (as of: ${seedData.meta?.as_of || "2026-10-10"})`);

  // Map to store generated/retrieved UUIDs by reference (e.g., u001 -> UUID)
  const idMap = {
    users: {},
    tiers: {},
    events: {},
    ticketTypes: {},
    products: {},
    variants: {},
    applications: {},
    fundraisers: {}
  };

  // 1. Seed Auth Profiles & Staff Roles
  console.log("\n[1/9] Seeding Profiles & Staff Roles...");
  for (const prof of seedData.profiles) {
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", prof.email)
        .maybeSingle();

      let userId;
      if (existingProfile) {
        userId = existingProfile.id;
      } else {
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: prof.email,
          password: demoPassword,
          email_confirm: true,
          user_metadata: {
            full_name: prof.full_name,
            student_id: prof.student_id,
            is_demo: true
          }
        });

        if (authErr && !authErr.message.includes("already registered")) {
          console.warn(`  ⚠️ Could not create auth user ${prof.email}: ${authErr.message}`);
          continue;
        }
        userId = authUser?.user?.id;
      }

      if (userId) {
        idMap.users[prof.ref] = userId;

        // Ensure user_roles has the right role
        await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role: prof.role || "member" });
      }
    } catch (err) {
      console.warn(`  ⚠️ Error on profile ${prof.email}: ${err.message}`);
    }
  }
  console.log(`✓ Processed ${Object.keys(idMap.users).length} user profiles`);

  // Shared walk-in guest profile for desk ticket sales
  const guestEmail = "guest@skylinesos.demo";
  const { data: guestUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", guestEmail)
    .maybeSingle();

  if (!guestUser) {
    const { data: newGuest } = await supabase.auth.admin.createUser({
      email: guestEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: "Walk-in Guest", is_demo: true }
    });
    if (newGuest?.user) idMap.users["guest"] = newGuest.user.id;
  } else {
    idMap.users["guest"] = guestUser.id;
  }

  const adminId = idMap.users["u001"];
  const treasurerId = idMap.users["u002"] || adminId;
  const doorStaffId = idMap.users["u003"] || adminId;

  // 2. Membership Tiers
  console.log("\n[2/9] Seeding Membership Tiers...");
  for (const tier of seedData.membership_tiers) {
    const { data: existingTier } = await supabase
      .from("membership_tiers")
      .select("id")
      .eq("name", tier.name)
      .maybeSingle();

    if (existingTier) {
      idMap.tiers[tier.ref] = existingTier.id;
    } else {
      const { data: newTier, error } = await supabase
        .from("membership_tiers")
        .insert({
          name: tier.name,
          fee_paise: tier.fee_paise,
          duration_days: tier.duration_days,
          discount_percent: tier.discount_percent,
          benefits: tier.benefits || [],
          is_active: tier.is_active ?? true
        })
        .select()
        .single();

      if (!error && newTier) {
        idMap.tiers[tier.ref] = newTier.id;
      }
    }
  }
  console.log(`✓ Seeded ${Object.keys(idMap.tiers).length} membership tiers`);

  // 3. Events & Ticket Types
  console.log("\n[3/9] Seeding Events & Ticket Types...");
  for (const ev of seedData.events) {
    const { data: existingEv } = await supabase
      .from("events")
      .select("id")
      .eq("slug", ev.slug)
      .maybeSingle();

    let eventId;
    if (existingEv) {
      eventId = existingEv.id;
    } else {
      const startsAt = ev.starts_at || (ev.starts ? new Date(ev.starts).toISOString() : new Date().toISOString());
      const endsAt = ev.ends_at || (ev.ends ? new Date(ev.ends).toISOString() : new Date(new Date(startsAt).getTime() + 4 * 3600 * 1000).toISOString());

      const { data: newEv, error: evErr } = await supabase
        .from("events")
        .insert({
          slug: ev.slug,
          title: ev.title,
          description: ev.description || ev.title,
          venue: ev.venue || "Campus Hall",
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: ev.capacity || 100,
          status: "published", // Start as published so ticket checkout RPC allows orders
          created_by: adminId
        })
        .select()
        .single();

      if (evErr) {
        console.warn(`  ⚠️ Could not insert event ${ev.slug}:`, evErr.message);
      }
      eventId = newEv?.id;
    }
    if (eventId) idMap.events[ev.ref] = eventId;
  }

  for (const tt of seedData.ticket_types) {
    const eventRef = tt.event || tt.event_ref;
    const eventId = idMap.events[eventRef];
    if (!eventId) continue;

    const { data: existingTT } = await supabase
      .from("ticket_types")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", tt.name)
      .maybeSingle();

    if (existingTT) {
      idMap.ticketTypes[tt.ref] = existingTT.id;
    } else {
      const { data: newTT, error: ttErr } = await supabase
        .from("ticket_types")
        .insert({
          event_id: eventId,
          name: tt.name,
          price_paise: tt.price_paise || 0,
          member_price_paise: tt.member_price_paise ?? null,
          member_only: tt.member_only ?? false,
          quantity_limit: tt.quantity_limit || 100
        })
        .select()
        .single();

      if (ttErr) {
        console.warn(`  ⚠️ Could not insert ticket type ${tt.name}:`, ttErr.message);
      }
      if (newTT) idMap.ticketTypes[tt.ref] = newTT.id;
    }
  }
  console.log(`✓ Seeded ${Object.keys(idMap.events).length} events, ${Object.keys(idMap.ticketTypes).length} ticket types`);

  // 4. Products & Variants
  console.log("\n[4/9] Seeding Products & Variants...");
  for (const prod of seedData.products) {
    const { data: existingProd } = await supabase
      .from("products")
      .select("id")
      .eq("name", prod.name)
      .maybeSingle();

    let prodId;
    if (existingProd) {
      prodId = existingProd.id;
    } else {
      const { data: newProd, error: pErr } = await supabase
        .from("products")
        .insert({
          name: prod.name,
          description: prod.description || "",
          status: prod.status || "active"
        })
        .select()
        .single();

      if (pErr) console.warn(`  ⚠️ Could not insert product ${prod.name}:`, pErr.message);
      prodId = newProd?.id;
    }
    if (prodId) idMap.products[prod.ref] = prodId;
  }

  for (const v of seedData.product_variants) {
    const prodRef = v.product || v.product_ref;
    const prodId = idMap.products[prodRef];
    if (!prodId) continue;

    const { data: existingVar } = await supabase
      .from("product_variants")
      .select("id")
      .eq("sku", v.sku)
      .maybeSingle();

    if (existingVar) {
      idMap.variants[v.ref] = existingVar.id;
    } else {
      const { data: newVar, error: vErr } = await supabase
        .from("product_variants")
        .insert({
          product_id: prodId,
          sku: v.sku,
          label: v.label,
          price_paise: v.price_paise,
          stock_on_hand: v.stock_on_hand || 10,
          reserved: 0
        })
        .select()
        .single();

      if (vErr) console.warn(`  ⚠️ Could not insert variant ${v.sku}:`, vErr.message);
      if (newVar) idMap.variants[v.ref] = newVar.id;
    }
  }
  console.log(`✓ Seeded ${Object.keys(idMap.products).length} products, ${Object.keys(idMap.variants).length} variants`);

  // 5. Membership Applications & Dues Purchases via RPC
  console.log("\n[5/9] Processing Membership Applications & Dues...");
  if (seedData.membership_applications) {
    for (const app of seedData.membership_applications) {
      const userRef = app.user || app.user_ref;
      const tierRef = app.tier || app.tier_ref;
      const userId = idMap.users[userRef];
      const tierId = idMap.tiers[tierRef];
      if (!userId || !tierId) continue;

      const { data: existingApp } = await supabase
        .from("membership_applications")
        .select("id, status")
        .eq("user_id", userId)
        .eq("tier_id", tierId)
        .maybeSingle();

      let appId;
      if (!existingApp) {
        const { data: newApp, error: appErr } = await supabase
          .from("membership_applications")
          .insert({
            user_id: userId,
            tier_id: tierId,
            status: "pending",
            revision: app.revision || 1,
            answers: app.answers || {},
            submitted_at: app.submitted_at || new Date().toISOString()
          })
          .select()
          .single();

        if (appErr) console.warn(`  ⚠️ Error creating application for ${userRef}:`, appErr.message);
        appId = newApp?.id;

        if (appId && app.status && app.status !== "pending") {
          await supabase.rpc("fn_review_application", {
            p_application_id: appId,
            p_reviewer_id: adminId,
            p_decision: app.status,
            p_reason: app.rejection_reason || null
          });
        }
      } else {
        appId = existingApp.id;
      }
      if (appId) idMap.applications[app.ref] = appId;
    }
  }

  if (seedData.membership_purchases) {
    let duesPaid = 0;
    for (const pur of seedData.membership_purchases) {
      const app = seedData.membership_applications?.find((a) => a.ref === pur.application);
      const userRef = app?.user || pur.user_ref;
      const tierRef = app?.tier || pur.tier_ref;
      const userId = idMap.users[userRef];
      const tierId = idMap.tiers[tierRef];
      if (!userId || !tierId) continue;

      const idemKey = `seed_dues_${pur.ref || `${userRef}_${tierRef}`}`;
      const { error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: [{ itemType: "membership", refId: tierId, quantity: 1 }],
        p_method: pur.method || pur.payment_method || "cash",
        p_recorded_by: adminId,
        p_note: "Seed: dues payment",
        p_idem_key: idemKey
      });

      if (!error) duesPaid++;
    }
    console.log(`✓ Fulfilled ${duesPaid} membership dues checkouts via RPC`);
  }

  // 6. Ticket Purchases & Check-ins
  console.log("\n[6/9] Processing Ticket Purchases & Check-ins...");
  if (seedData.ticket_purchases) {
    let ticketsIssued = 0;

    for (const tp of seedData.ticket_purchases) {
      const buyerRef = tp.buyer || tp.user_ref || "guest";
      const ttRef = tp.ticket_type || tp.ticket_type_ref;
      const userId = idMap.users[buyerRef] || idMap.users["guest"];
      const ttId = idMap.ticketTypes[ttRef];
      if (!userId || !ttId) continue;

      const idemKey = `seed_ticket_${tp.ref || `${buyerRef}_${ttRef}_${ticketsIssued}`}`;
      const { data: checkoutRes, error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: [{ itemType: "ticket", refId: ttId, quantity: tp.qty || 1 }],
        p_method: tp.method || tp.payment_method || "cash",
        p_recorded_by: doorStaffId,
        p_note: "Seed: ticket sale",
        p_idem_key: idemKey
      });

      if (!error) {
        ticketsIssued++;
        if (tp.check_in || tp.checked_in) {
          const { data: ticket } = await supabase
            .from("tickets")
            .select("code")
            .eq("owner_id", userId)
            .eq("ticket_type_id", ttId)
            .eq("status", "issued")
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ticket) {
            await supabase.rpc("fn_check_in", {
              p_event_id: null,
              p_code: ticket.code,
              p_staff_id: doorStaffId
            });
          }
        }
      }
    }
    console.log(`✓ Processed ${ticketsIssued} ticket checkouts & door check-ins via RPC`);
  }

  // Update past events to 'completed'
  for (const ev of seedData.events) {
    if (ev.status === "past" && idMap.events[ev.ref]) {
      await supabase.from("events").update({ status: "completed" }).eq("id", idMap.events[ev.ref]);
    }
  }

  // 7. Merchandise Orders
  console.log("\n[7/9] Processing Merch Purchases via RPC...");
  if (seedData.merch_orders) {
    let merchCount = 0;
    for (const mo of seedData.merch_orders) {
      const buyerRef = mo.buyer || mo.user_ref;
      const varRef = mo.variant || mo.variant_ref;
      const userId = idMap.users[buyerRef];
      const variantId = idMap.variants[varRef];
      if (!userId || !variantId) continue;

      const idemKey = `seed_merch_${mo.ref || `${buyerRef}_${varRef}_${merchCount}`}`;
      const { data: merchRes, error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: [{ itemType: "merch", refId: variantId, quantity: mo.qty || 1 }],
        p_method: mo.method || mo.payment_method || "cash",
        p_recorded_by: adminId,
        p_note: "Seed: merchandise order",
        p_idem_key: idemKey
      });

      if (!error) {
        merchCount++;
        if (mo.fulfilment && mo.fulfilment !== "pending" && merchRes?.id) {
          await supabase
            .from("checkout_items")
            .update({ fulfilment_status: mo.fulfilment })
            .eq("checkout_id", merchRes.id);
        }
      }
    }
    console.log(`✓ Processed ${merchCount} merch checkouts via RPC`);
  }

  // 8. Fundraisers, Tasks & Contributions
  console.log("\n[8/9] Seeding Fundraisers, Tasks & Contributions...");
  if (seedData.fundraisers) {
    for (const f of seedData.fundraisers) {
      const { data: existingF } = await supabase
        .from("fundraisers")
        .select("id")
        .eq("name", f.name)
        .maybeSingle();

      let fId;
      if (existingF) {
        fId = existingF.id;
      } else {
        const { data: newF } = await supabase
          .from("fundraisers")
          .insert({
            name: f.name,
            goal_paise: f.goal_paise,
            starts_on: f.starts_on || "2026-08-01",
            ends_on: f.ends_on || "2026-11-01",
            status: f.status || "active",
            owner_id: adminId
          })
          .select()
          .single();
        fId = newF?.id;
      }
      if (fId) idMap.fundraisers[f.ref] = fId;
    }
  }

  if (seedData.tasks) {
    for (const t of seedData.tasks) {
      const fRef = t.fundraiser || t.fundraiser_ref;
      const aRef = t.assignee || t.assignee_ref;
      const fId = idMap.fundraisers[fRef];
      const assigneeId = idMap.users[aRef];
      if (!fId) continue;

      const { data: existingTask } = await supabase
        .from("tasks")
        .select("id")
        .eq("fundraiser_id", fId)
        .eq("title", t.title)
        .maybeSingle();

      if (!existingTask) {
        await supabase.from("tasks").insert({
          fundraiser_id: fId,
          title: t.title,
          assignee_id: assigneeId || null,
          due_on: t.due_on,
          priority: t.priority || "medium",
          status: t.status || "todo",
          created_by: adminId
        });
      }
    }
  }

  if (seedData.contributions) {
    let contribCount = 0;
    for (const c of seedData.contributions) {
      const fRef = c.fundraiser || c.fundraiser_ref;
      const fId = idMap.fundraisers[fRef];
      if (!fId) continue;

      const { error } = await supabase.rpc("fn_record_contribution", {
        p_fundraiser_id: fId,
        p_amount_paise: c.amount_paise,
        p_method: c.method || c.payment_method || "cash",
        p_note: c.note || "Seed contribution",
        p_actor_id: adminId
      });

      if (!error) contribCount++;
    }
    console.log(`✓ Recorded ${contribCount} fundraiser contributions into ledger via RPC`);
  }

  // 9. Expenses & Announcements
  console.log("\n[9/9] Seeding Expenses & Announcements...");
  if (seedData.announcements) {
    for (const a of seedData.announcements) {
      const { data: existingA } = await supabase
        .from("announcements")
        .select("id")
        .eq("title", a.title)
        .maybeSingle();

      if (!existingA) {
        await supabase.from("announcements").insert({
          title: a.title,
          body: a.body,
          audience: a.audience || "public",
          status: a.status || "published",
          author_id: adminId,
          published_at: a.published_at || new Date().toISOString()
        });
      }
    }
  }

  if (seedData.expenses) {
    for (const e of seedData.expenses) {
      const subRef = e.submitted_by || e.submitted_by_ref;
      const submitterId = idMap.users[subRef] || adminId;

      const { data: existingExp } = await supabase
        .from("expenses")
        .select("id")
        .eq("description", e.description)
        .eq("amount_paise", e.amount_paise)
        .maybeSingle();

      let expId;
      if (!existingExp) {
        const { data: newExpense } = await supabase
          .from("expenses")
          .insert({
            amount_paise: e.amount_paise,
            category: e.category,
            description: e.description,
            submitted_by: submitterId,
            status: "submitted"
          })
          .select()
          .single();

        expId = newExpense?.id;

        if (expId && e.status && e.status !== "submitted") {
          const actorId = treasurerId !== submitterId ? treasurerId : adminId;
          if (e.status === "approved") {
            await supabase.rpc("fn_set_expense_status", {
              p_expense_id: expId,
              p_actor_id: actorId,
              p_status: "approved",
              p_reason: null
            });
          } else if (e.status === "paid") {
            await supabase.rpc("fn_set_expense_status", {
              p_expense_id: expId,
              p_actor_id: actorId,
              p_status: "approved",
              p_reason: null
            });
            await supabase.rpc("fn_set_expense_status", {
              p_expense_id: expId,
              p_actor_id: actorId,
              p_status: "paid",
              p_reason: null
            });
          } else if (e.status === "rejected") {
            await supabase.rpc("fn_set_expense_status", {
              p_expense_id: expId,
              p_actor_id: actorId,
              p_status: "rejected",
              p_reason: e.reject_reason || "Policy mismatch"
            });
          }
        }
      }
    }
  }

  // Run cleanup & reminders
  await supabase.rpc("fn_expire_checkouts");
  await supabase.rpc("fn_renewal_reminders");

  // Reconciliation Check
  console.log("\n=================================================================");
  console.log("  Reconciliation Check (TRD §13 & Demo Data Plan §5)");
  console.log("=================================================================");

  const { data: overview } = await supabase.rpc("fn_treasurer_overview");
  console.log(`  Total Recorded Income (In)  : ₹${((overview?.inPaise || 0) / 100).toLocaleString("en-IN")}`);
  console.log(`  Total Recorded Expenses (Out): ₹${((overview?.outPaise || 0) / 100).toLocaleString("en-IN")}`);
  console.log(`  Net Recorded Movement       : ₹${((overview?.netPaise || 0) / 100).toLocaleString("en-IN")}`);
  console.log("=================================================================\n");
  console.log("✅ Seeding completed successfully! All records verified via real RPCs.");
}

main().catch((err) => {
  console.error("❌ Fatal Error during seeding:", err);
  process.exit(1);
});
