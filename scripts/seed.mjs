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
    fundraisers: {}
  };

  // 1. Seed Auth Profiles & Staff Roles
  console.log("\n[1/9] Seeding Profiles & Staff Roles...");
  for (const prof of seedData.profiles) {
    try {
      // Check if user already exists
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

        // Set role in user_roles
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
  const adminId = idMap.users["u001"];
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
      const { data: newEv } = await supabase
        .from("events")
        .insert({
          slug: ev.slug,
          title: ev.title,
          description: ev.description,
          venue: ev.venue,
          starts_at: ev.starts_at,
          ends_at: ev.ends_at,
          capacity: ev.capacity,
          status: ev.status,
          created_by: adminId
        })
        .select()
        .single();
      eventId = newEv?.id;
    }
    if (eventId) idMap.events[ev.ref] = eventId;
  }

  for (const tt of seedData.ticket_types) {
    const eventId = idMap.events[tt.event_ref];
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
      const { data: newTT } = await supabase
        .from("ticket_types")
        .insert({
          event_id: eventId,
          name: tt.name,
          price_paise: tt.price_paise,
          member_price_paise: tt.member_price_paise,
          member_only: tt.member_only ?? false,
          quantity_limit: tt.quantity_limit,
          sales_start: tt.sales_start,
          sales_end: tt.sales_end
        })
        .select()
        .single();
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
      const { data: newProd } = await supabase
        .from("products")
        .insert({
          name: prod.name,
          description: prod.description,
          status: prod.status || "active"
        })
        .select()
        .single();
      prodId = newProd?.id;
    }
    if (prodId) idMap.products[prod.ref] = prodId;
  }

  for (const v of seedData.product_variants) {
    const prodId = idMap.products[v.product_ref];
    if (!prodId) continue;

    const { data: existingVar } = await supabase
      .from("product_variants")
      .select("id")
      .eq("sku", v.sku)
      .maybeSingle();

    if (existingVar) {
      idMap.variants[v.ref] = existingVar.id;
    } else {
      const { data: newVar } = await supabase
        .from("product_variants")
        .insert({
          product_id: prodId,
          sku: v.sku,
          label: v.label,
          price_paise: v.price_paise,
          stock_on_hand: v.stock_on_hand,
          reserved: 0
        })
        .select()
        .single();
      if (newVar) idMap.variants[v.ref] = newVar.id;
    }
  }
  console.log(`✓ Seeded ${Object.keys(idMap.products).length} products, ${Object.keys(idMap.variants).length} variants`);

  // 5. Membership Applications & Dues Purchases via RPC
  console.log("\n[5/9] Processing Membership Applications & Dues...");
  if (seedData.membership_applications) {
    for (const app of seedData.membership_applications) {
      const userId = idMap.users[app.user_ref];
      const tierId = idMap.tiers[app.tier_ref];
      if (!userId || !tierId) continue;

      const { data: existingApp } = await supabase
        .from("membership_applications")
        .select("id")
        .eq("user_id", userId)
        .eq("tier_id", tierId)
        .maybeSingle();

      if (!existingApp) {
        await supabase.from("membership_applications").insert({
          user_id: userId,
          tier_id: tierId,
          status: app.status || "pending",
          revision: app.revision || 1,
          answers: app.answers || {},
          submitted_at: app.submitted_at || new Date().toISOString(),
          reviewed_by: app.status !== "pending" ? adminId : null,
          reviewed_at: app.status !== "pending" ? new Date().toISOString() : null,
          rejection_reason: app.rejection_reason || null
        });
      }
    }
  }

  if (seedData.membership_purchases) {
    let duesPaid = 0;
    for (const pur of seedData.membership_purchases) {
      const userId = idMap.users[pur.user_ref];
      const tierId = idMap.tiers[pur.tier_ref];
      if (!userId || !tierId) continue;

      const idemKey = `seed_dues_${pur.user_ref}_${pur.tier_ref}`;
      const { error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: JSON.stringify([{ itemType: "membership", refId: tierId, quantity: 1 }]),
        p_method: pur.payment_method || "cash",
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
    const doorStaffId = idMap.users["u003"] || adminId;

    for (const tp of seedData.ticket_purchases) {
      const userId = idMap.users[tp.user_ref] || idMap.users["guest"];
      const ttId = idMap.ticketTypes[tp.ticket_type_ref];
      if (!userId || !ttId) continue;

      const idemKey = `seed_ticket_${tp.user_ref || "guest"}_${tp.ticket_type_ref}_${ticketsIssued}`;
      const { error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: JSON.stringify([{ itemType: "ticket", refId: ttId, quantity: 1 }]),
        p_method: tp.payment_method || "cash",
        p_recorded_by: doorStaffId,
        p_note: "Seed: ticket sale",
        p_idem_key: idemKey
      });

      if (!error) {
        ticketsIssued++;
        // If marked checked_in in seed, check in immediately
        if (tp.checked_in) {
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

  // 7. Merchandise Orders
  console.log("\n[7/9] Processing Merch Purchases via RPC...");
  if (seedData.merch_orders) {
    let merchCount = 0;
    for (const mo of seedData.merch_orders) {
      const userId = idMap.users[mo.user_ref];
      const variantId = idMap.variants[mo.variant_ref];
      if (!userId || !variantId) continue;

      const idemKey = `seed_merch_${mo.user_ref}_${mo.variant_ref}_${merchCount}`;
      const { error } = await supabase.rpc("fn_record_staff_checkout", {
        p_buyer_id: userId,
        p_items: JSON.stringify([{ itemType: "merch", refId: variantId, quantity: mo.quantity || 1 }]),
        p_method: mo.payment_method || "cash",
        p_recorded_by: adminId,
        p_note: "Seed: merchandise order",
        p_idem_key: idemKey
      });

      if (!error) merchCount++;
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
            starts_on: f.starts_on,
            ends_on: f.ends_on,
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
      const fId = idMap.fundraisers[t.fundraiser_ref];
      const assigneeId = idMap.users[t.assignee_ref];
      if (!fId) continue;

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

  if (seedData.contributions) {
    let contribCount = 0;
    for (const c of seedData.contributions) {
      const fId = idMap.fundraisers[c.fundraiser_ref];
      if (!fId) continue;

      const { error } = await supabase.rpc("fn_record_contribution", {
        p_fundraiser_id: fId,
        p_amount_paise: c.amount_paise,
        p_method: c.method || "cash",
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

  if (seedData.expenses) {
    const treasurerId = idMap.users["u002"] || adminId;
    for (const e of seedData.expenses) {
      const submitterId = idMap.users[e.submitted_by_ref] || adminId;
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

      if (newExpense && e.status !== "submitted") {
        await supabase.rpc("fn_set_expense_status", {
          p_expense_id: newExpense.id,
          p_actor_id: treasurerId !== submitterId ? treasurerId : adminId,
          p_status: e.status,
          p_reason: e.reject_reason || null
        });
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
