import { Router } from "npm:express@4.18.2";
import { authenticate } from "../middleware/auth.ts";
import { requireRole } from "../middleware/rbac.ts";
import { validate } from "../middleware/validate.ts";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "../middleware/errors.ts";
import { z } from "npm:zod@3.24.2";

export const merchAdminRouter = Router();

merchAdminRouter.use(authenticate);

const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active")
});

const CreateVariantSchema = z.object({
  sku: z.string().min(1),
  label: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  stockOnHand: z.number().int().nonnegative()
});

const AdjustStockSchema = z.object({
  quantityDelta: z.number().int(),
  reason: z.string().min(3)
});

const UpdateFulfilmentSchema = z.object({
  fulfilmentStatus: z.enum(["pending", "packed", "handed_over", "n/a"])
});

// GET /admin/products
merchAdminRouter.get("/admin/products", requireRole("admin"), async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*, product_variants(*)")
      .order("name", { ascending: true });

    if (error) return next(error);
    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /admin/products
merchAdminRouter.post(
  "/admin/products",
  requireRole("admin"),
  validate(CreateProductSchema),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .insert(req.body)
        .select()
        .single();

      if (error) return next(error);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

const UpdateProductSchema = CreateProductSchema.partial();

// PATCH /admin/products/:id (A)
merchAdminRouter.patch(
  "/admin/products/:id",
  requireRole("admin"),
  validate(UpdateProductSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.status !== undefined) updates.status = body.status;

      const { data, error } = await supabaseAdmin
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return next(new ApiError(404, "NOT_FOUND", "Product not found"));
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/products/:id/variants
merchAdminRouter.post(
  "/admin/products/:id/variants",
  requireRole("admin"),
  validate(CreateVariantSchema),
  async (req, res, next) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .insert({
          product_id: id,
          sku: body.sku,
          label: body.label,
          price_paise: body.pricePaise,
          stock_on_hand: body.stockOnHand
        })
        .select()
        .single();

      if (error) return next(error);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/variants/:id (Stock adjustment, audited)
merchAdminRouter.patch(
  "/admin/variants/:id",
  requireRole("admin"),
  validate(AdjustStockSchema),
  async (req, res, next) => {
    const admin = (req as any).user;
    const { id } = req.params;
    const { quantityDelta, reason } = req.body;

    try {
      // Fetch variant
      const { data: variant, error: varErr } = await supabaseAdmin
        .from("product_variants")
        .select("stock_on_hand, reserved")
        .eq("id", id)
        .single();

      if (varErr || !variant) return next(new ApiError(404, "NOT_FOUND", "Variant not found"));

      const newStock = variant.stock_on_hand + quantityDelta;
      if (newStock < variant.reserved) {
        return next(
          new ApiError(409, "OUT_OF_STOCK", "Cannot reduce stock below already reserved quantity")
        );
      }

      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .update({ stock_on_hand: newStock })
        .eq("id", id)
        .select()
        .single();

      if (error) return next(error);

      // Write audit log
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: admin.id,
        action: "stock_adjusted",
        entity_type: "product_variant",
        entity_id: id,
        meta: { quantityDelta, previousStock: variant.stock_on_hand, newStock, reason }
      });

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/orders (A, V)
merchAdminRouter.get(
  "/admin/orders",
  requireRole("admin", "volunteer"),
  async (_req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("checkout_items")
        .select("*, checkouts(buyer_id, status, created_at, profiles:buyer_id(full_name, email))")
        .eq("item_type", "merch")
        .order("id", { ascending: false });

      if (error) return next(error);
      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/orders/:itemId/fulfilment (A, V)
merchAdminRouter.patch(
  "/admin/orders/:itemId/fulfilment",
  requireRole("admin", "volunteer"),
  validate(UpdateFulfilmentSchema),
  async (req, res, next) => {
    const { itemId } = req.params;
    const { fulfilmentStatus } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from("checkout_items")
        .update({ fulfilment_status: fulfilmentStatus })
        .eq("id", itemId)
        .select()
        .single();

      if (error) return next(error);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
