import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/money";

interface Product {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  memberPricePaise: number;
  variants: Array<{
    id: string;
    sku: string;
    size?: string;
    color?: string;
    stock: number;
  }>;
}

interface OrderItem {
  id: string;
  orderId: string;
  customerName: string;
  productName: string;
  sku: string;
  quantity: number;
  amountPaise: number;
  fulfilmentStatus: "pending" | "fulfilled";
  orderedAt: string;
}

export function AdminMerchPanel() {
  const [activeTab, setActiveTab] = useState<"inventory" | "orders">("inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodsData, ordersData] = await Promise.all([
        api<Product[]>("/admin/products").catch(() => []),
        api<OrderItem[]>("/admin/orders").catch(() => [])
      ]);
      setProducts(prodsData || []);
      setOrders(ordersData || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load merchandise records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStockUpdate = async (variantId: string, currentStock: number) => {
    const raw = prompt("Enter new inventory stock count:", currentStock.toString());
    if (raw === null) return;
    const newStock = parseInt(raw, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert("Invalid stock number");
      return;
    }

    try {
      await api(`/admin/variants/${variantId}`, {
        method: "PATCH",
        json: { stock: newStock }
      });
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update stock");
    }
  };

  const handleToggleFulfilment = async (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "fulfilled" ? "pending" : "fulfilled";
    try {
      await api(`/admin/orders/${itemId}/fulfilment`, {
        method: "PATCH",
        json: { status: nextStatus }
      });
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update order fulfilment");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Merchandise Inventory & Orders</h2>
          <p className="text-xs text-steel mt-0.5">
            Manage hoodie stock quantities, prevent negative inventory, and mark student orders fulfilled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1 bg-white rounded-full border border-hairline flex">
            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "inventory"
                  ? "bg-ink-deep text-white shadow-xs"
                  : "text-steel hover:text-ink"
              }`}
            >
              Stock Inventory ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "orders"
                  ? "bg-ink-deep text-white shadow-xs"
                  : "text-steel hover:text-ink"
              }`}
            >
              Order Fulfilment ({orders.length})
            </button>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-full bg-white border border-hairline hover:bg-surface-soft text-charcoal text-xs font-bold shadow-xs transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading merchandise records...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Tab 1: Products & Stock */}
      {!loading && !error && activeTab === "inventory" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((p) => (
            <div
              key={p.id}
              className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-2xl p-2.5 bg-surface-soft rounded-2xl border border-hairline">
                    👕
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-black text-ink-deep block">
                      {formatPaise(p.pricePaise)}
                    </span>
                    <span className="text-[11px] font-bold text-success">
                      Member: {formatPaise(p.memberPricePaise)}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-ink-deep mt-2">{p.name}</h3>
                <p className="text-xs text-steel mt-1 leading-relaxed">{p.description}</p>

                <div className="mt-6 pt-4 border-t border-hairline">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-steel block mb-2">
                    SKU Variants & Live Stock
                  </span>
                  <div className="space-y-2">
                    {p.variants && p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-surface-soft border border-hairline text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-ink-deep mr-2">
                            {v.size || v.color || v.sku}
                          </span>
                          <span className="text-[10px] text-steel">SKU: {v.sku}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-black font-mono ${
                              v.stock === 0
                                ? "text-critical"
                                : v.stock < 10
                                ? "text-attention"
                                : "text-success"
                            }`}
                          >
                            {v.stock} units
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStockUpdate(v.id, v.stock)}
                            className="px-2.5 py-1 rounded-full bg-white border border-hairline hover:bg-hairline text-[11px] font-bold text-charcoal shadow-xs"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Orders Fulfilment */}
      {!loading && !error && activeTab === "orders" && (
        <div className="rounded-3xl bg-white border border-hairline shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-soft text-[10px] uppercase font-bold text-steel border-b border-hairline tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Order ID & Date</th>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Item & Variant</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-6 text-right">Fulfilment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-steel">
                    No student merchandise orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-soft/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-ink-deep">
                      {o.orderId.slice(0, 8)}...
                      <div className="text-[10px] text-steel font-normal">
                        {new Date(o.orderedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-ink-deep">
                      {o.customerName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-ink-deep">{o.productName}</span>{" "}
                      <span className="text-steel font-mono text-[11px]">({o.sku})</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-success">
                      {formatPaise(o.amountPaise)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleFulfilment(o.id, o.fulfilmentStatus)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                          o.fulfilmentStatus === "fulfilled"
                            ? "bg-success text-white"
                            : "bg-surface-soft hover:bg-hairline text-steel border border-hairline"
                        }`}
                      >
                        {o.fulfilmentStatus === "fulfilled" ? "✓ Handed Over" : "Mark Fulfilled"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
