import { Router } from "npm:express@4.18.2";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";

export const publicRouter = Router();

// GET /public/events
publicRouter.get("/public/events", async (req, res, next) => {
  const when = req.query.when as string | undefined;
  const now = new Date().toISOString();

  try {
    let query = supabaseAdmin
      .from("events")
      .select("id, slug, title, description, venue, starts_at, ends_at, capacity, status, created_at")
      .eq("status", "published");

    if (when === "upcoming") {
      query = query.gte("starts_at", now).order("starts_at", { ascending: true });
    } else if (when === "past") {
      query = query.lt("starts_at", now).order("starts_at", { ascending: false });
    } else {
      query = query.order("starts_at", { ascending: true });
    }

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// GET /public/events/:slug
publicRouter.get("/public/events/:slug", async (req, res, next) => {
  const slug = req.params.slug;

  try {
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("id, slug, title, description, venue, starts_at, ends_at, capacity, status, created_at, ticket_types(*)")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) return next(error);
    if (!event) {
      return next(new ApiError(404, "NOT_FOUND", `Event with slug '${slug}' not found`));
    }

    res.json({ data: event });
  } catch (err) {
    next(err);
  }
});

// GET /public/tiers
publicRouter.get("/public/tiers", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("membership_tiers")
      .select("id, name, fee_paise, duration_days, discount_percent, benefits, is_active")
      .eq("is_active", true)
      .order("fee_paise", { ascending: true });

    if (error) return next(error);

    const formatted = (data || []).map((t) => ({
      id: t.id,
      name: t.name,
      feePaise: t.fee_paise,
      durationDays: t.duration_days,
      discountPercent: t.discount_percent,
      benefits: t.benefits,
      isActive: t.is_active
    }));

    res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /public/merch
publicRouter.get("/public/merch", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, name, description, status, product_variants(id, sku, label, price_paise, stock_on_hand, reserved)")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) return next(error);

    const formatted = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      variants: (p.product_variants || []).map((v: any) => ({
        id: v.id,
        sku: v.sku,
        label: v.label,
        pricePaise: v.price_paise,
        stockOnHand: v.stock_on_hand,
        reserved: v.reserved,
        available: Math.max(0, v.stock_on_hand - v.reserved)
      }))
    }));

    res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /public/merch/:id
publicRouter.get("/public/merch/:id", async (req, res, next) => {
  const id = req.params.id;

  try {
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, name, description, status, product_variants(id, sku, label, price_paise, stock_on_hand, reserved)")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (error) return next(error);
    if (!product) {
      return next(new ApiError(404, "NOT_FOUND", "Product not found"));
    }

    res.json({
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        status: product.status,
        variants: (product.product_variants || []).map((v: any) => ({
          id: v.id,
          sku: v.sku,
          label: v.label,
          pricePaise: v.price_paise,
          stockOnHand: v.stock_on_hand,
          reserved: v.reserved,
          available: Math.max(0, v.stock_on_hand - v.reserved)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});
