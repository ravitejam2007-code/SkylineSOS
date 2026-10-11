import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import { openRazorpayCheckout } from '../../lib/razorpay';
import type { Product, ProductVariant } from '@campusone/contracts';

export interface CartItem {
  id: string; // `${productId}_${variantId}`
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  label: string;
  size: string;
  basePricePaise: number;
  quantity: number;
  stockAvailable: number;
}

export interface MerchOrder {
  id: string;
  code: string;
  otp: string;
  status: 'pending' | 'approved';
  buyer_name: string;
  buyer_email: string;
  item_name: string;
  item_variant: string;
  items_detail?: Array<{ name: string; size: string; quantity: number; pricePaise: number }>;
  amount_paise: number;
  order_date: string;
  created_at: string;
}

const SEED_MERCH_ORDERS: MerchOrder[] = [
  {
    id: 'merch-seed-01',
    code: 'Seat #FEB4',
    otp: '918273',
    status: 'approved',
    buyer_name: 'sanjayd',
    buyer_email: 'sanjaydsanjay042@gmail.com',
    item_name: 'Skyline Navy Heavyweight Hoodie',
    item_variant: 'SIZE: L • 1 UNIT • ₹319',
    items_detail: [{ name: 'Skyline Navy Heavyweight Hoodie', size: 'L', quantity: 1, pricePaise: 31920 }],
    amount_paise: 31920,
    order_date: '21-10-2026',
    created_at: new Date('2026-10-21T10:00:00Z').toISOString(),
  },
  {
    id: 'merch-seed-02',
    code: 'Seat #46E6',
    otp: '582914',
    status: 'pending',
    buyer_name: 'Sarah Student',
    buyer_email: 'student@studentorg.edu',
    item_name: 'Annual Tech Gala & Hackathon 2026',
    item_variant: 'STANDARD DELEGATE PASS',
    items_detail: [{ name: 'Annual Tech Gala & Hackathon 2026', size: 'Standard', quantity: 1, pricePaise: 19900 }],
    amount_paise: 19900,
    order_date: '11 Oct 2026',
    created_at: new Date('2026-10-11T08:30:00Z').toISOString(),
  },
];

export default function MerchScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isMember, setIsMember] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [cartSuccessNotice, setCartSuccessNotice] = useState<string | null>(null);
  const [latestPlacedOrder, setLatestPlacedOrder] = useState<MerchOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);

  // Shopping Cart State (Multi-product & multi-size support)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:merch_cart');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  // Admin Merchandise Console State
  const [merchOrders, setMerchOrders] = useState<MerchOrder[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:merch_orders');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return SEED_MERCH_ORDERS;
  });
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    try {
      const pList = await api.getProducts();
      setProducts(pList);
      if (pList.length > 0) {
        const prod = pList[selectedProductIndex] || pList[0];
        if (prod.variants && prod.variants.length > 0) {
          setSelectedVariant(prod.variants[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (typeof window !== 'undefined') {
      getCurrentUserSession().then((s) => {
        setSession(s);
      });

      const handleAuthChange = (e: CustomEvent) => {
        const updated = e.detail as UserSession | null;
        setSession(updated);
      };

      const handleOrdersUpdated = () => {
        try {
          const stored = localStorage.getItem('skylinesos:merch_orders');
          if (stored) setMerchOrders(JSON.parse(stored));
        } catch {}
      };

      window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.addEventListener('campusone:merch_orders_updated' as any, handleOrdersUpdated);

      return () => {
        window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
        window.removeEventListener('campusone:merch_orders_updated' as any, handleOrdersUpdated);
      };
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('skylinesos:merch_cart', JSON.stringify(cart));
      } catch {}
    }
  }, [cart]);

  const handleProductSelect = (index: number) => {
    setSelectedProductIndex(index);
    setSelectedQuantity(1);
    const prod = products[index];
    if (prod?.variants && prod.variants.length > 0) {
      setSelectedVariant(prod.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  };

  const handleVariantSelect = (v: ProductVariant) => {
    setSelectedVariant(v);
    setSelectedQuantity(1);
  };

  // Add selected product + size to cart
  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const primaryProduct = products[selectedProductIndex] || products[0];
    const sizeDisplay = selectedVariant.size || selectedVariant.label || 'Std';
    const cartItemId = `${primaryProduct.id}_${selectedVariant.id}`;
    const maxStock = selectedVariant.stock_on_hand ?? (selectedVariant as any).available ?? 10;
    const basePrice = selectedVariant.price_paise || (selectedVariant as any).pricePaise || 39900;

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === cartItemId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = Math.min(maxStock, updated[existingIdx].quantity + selectedQuantity);
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        return updated;
      }
      return [
        ...prev,
        {
          id: cartItemId,
          productId: primaryProduct.id,
          productName: primaryProduct.name,
          variantId: selectedVariant.id,
          sku: selectedVariant.sku,
          label: selectedVariant.label || sizeDisplay,
          size: sizeDisplay,
          basePricePaise: basePrice,
          quantity: selectedQuantity,
          stockAvailable: maxStock,
        },
      ];
    });

    setCartSuccessNotice(`Added ${selectedQuantity}x ${primaryProduct.name} (${sizeDisplay}) to your cart!`);
    setTimeout(() => setCartSuccessNotice(null), 3500);
  };

  const updateCartQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === cartItemId) {
          return { ...item, quantity: Math.min(item.stockAvailable, newQty) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Cart Calculations
  const totalCartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBaseTotalPaise = cart.reduce((sum, item) => sum + item.basePricePaise * item.quantity, 0);
  const cartTotalPaise = cart.reduce((sum, item) => {
    const unitPrice = isMember ? Math.round(item.basePricePaise * 0.8) : item.basePricePaise;
    return sum + unitPrice * item.quantity;
  }, 0);

  // Single Item Direct Buy
  const handleBuySingle = async () => {
    if (!selectedVariant) return;
    setIsOrdering(true);
    try {
      const primaryProduct = products[selectedProductIndex] || products[0];
      const activeSession = getActiveSession();
      const unitPricePaise = isMember ? Math.round(basePricePaise * 0.8) : basePricePaise;
      const totalAmountPaise = unitPricePaise * selectedQuantity;

      // Step 1: Open Razorpay Payment Gateway Modal (Test Mode)
      const paymentResult = await openRazorpayCheckout({
        amountPaise: totalAmountPaise,
        name: 'Skyline Merch Store',
        description: `${primaryProduct.name} (${selectedVariant.size || selectedVariant.label}) x${selectedQuantity}`,
        prefill: {
          name: activeSession?.fullName || 'Student Shopper',
          email: activeSession?.email || 'student@skyline.edu',
        },
        notes: {
          product_id: primaryProduct.id,
          variant_id: selectedVariant.id,
          sku: selectedVariant.sku,
          quantity: selectedQuantity.toString(),
        },
      });

      // Step 2: Fulfill order via API
      await api.orderMerchVariant({
        variant_id: selectedVariant.id,
        quantity: selectedQuantity,
        is_member: isMember,
      });

      // Step 3: Generate 6-Digit Pickup OTP upon successful payment settlement
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
      const seatCode = `Seat #${randomHex}`;
      const todayFormatted = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const sizeDisplay = selectedVariant.size || selectedVariant.label || 'Std';
      const newOrder: MerchOrder = {
        id: `merch-ord-${Date.now()}`,
        code: seatCode,
        otp: generatedOtp,
        status: 'pending',
        buyer_name: activeSession?.fullName || 'Student Shopper',
        buyer_email: activeSession?.email || 'student@skyline.edu',
        item_name: `${primaryProduct.name} (${sizeDisplay}) x${selectedQuantity}`,
        item_variant: `${selectedQuantity} UNIT • ${formatPaise(totalAmountPaise)}`,
        items_detail: [
          {
            name: primaryProduct.name,
            size: sizeDisplay,
            quantity: selectedQuantity,
            pricePaise: totalAmountPaise,
          },
        ],
        amount_paise: totalAmountPaise,
        order_date: todayFormatted,
        created_at: new Date().toISOString(),
      };

      // Step 4: Persist in merchandise orders storage
      const existingOrders: MerchOrder[] = (() => {
        try {
          const raw = localStorage.getItem('skylinesos:merch_orders');
          return raw ? JSON.parse(raw) : SEED_MERCH_ORDERS;
        } catch {
          return SEED_MERCH_ORDERS;
        }
      })();
      const updatedOrders = [newOrder, ...existingOrders];
      setMerchOrders(updatedOrders);
      try {
        localStorage.setItem('skylinesos:merch_orders', JSON.stringify(updatedOrders));
      } catch {}

      // Step 5: Deliver Pickup OTP to the student/buyer
      setLatestPlacedOrder(newOrder);
      setOrderSuccess(
        `Payment successful via Razorpay (ID: ${paymentResult.paymentId})! Order confirmed for ${primaryProduct.name}. Your Pickup OTP is ${generatedOtp}.`
      );
      window.dispatchEvent(new CustomEvent('campusone:merch_orders_updated'));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Order was not placed.');
    } finally {
      setIsOrdering(false);
    }
  };

  // Full Multi-Item Cart Checkout via Razorpay
  const handleCheckoutCart = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    try {
      const activeSession = getActiveSession();
      const cartSummary = cart
        .map((item) => `${item.productName} (${item.size}) x${item.quantity}`)
        .join(', ');

      // Step 1: Open Razorpay Payment Gateway Modal for Total Cart Amount
      const paymentResult = await openRazorpayCheckout({
        amountPaise: cartTotalPaise,
        name: 'Skyline Merch Store',
        description: `Bundle Order (${totalCartUnits} Items): ${cartSummary.slice(0, 90)}...`,
        prefill: {
          name: activeSession?.fullName || 'Student Shopper',
          email: activeSession?.email || 'student@skyline.edu',
        },
        notes: {
          total_items: totalCartUnits.toString(),
          bundle_details: cartSummary.slice(0, 100),
          cart_items: cart.map((i) => `${i.sku}x${i.quantity}`).join(';'),
        },
      });

      // Step 2: Fulfill all cart items
      for (const item of cart) {
        try {
          await api.orderMerchVariant({
            variant_id: item.variantId,
            quantity: item.quantity,
            is_member: isMember,
          });
        } catch (e) {
          console.warn('API orderMerchVariant error:', e);
        }
      }

      // Step 3: Generate single Pickup OTP for the entire cart purchase
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
      const seatCode = `Seat #${randomHex}`;
      const todayFormatted = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const newOrder: MerchOrder = {
        id: `merch-ord-${Date.now()}`,
        code: seatCode,
        otp: generatedOtp,
        status: 'pending',
        buyer_name: activeSession?.fullName || 'Student Shopper',
        buyer_email: activeSession?.email || 'student@skyline.edu',
        item_name: cartSummary,
        item_variant: `${totalCartUnits} ITEMS IN CART • ${formatPaise(cartTotalPaise)}`,
        items_detail: cart.map((i) => ({
          name: i.productName,
          size: i.size,
          quantity: i.quantity,
          pricePaise: (isMember ? Math.round(i.basePricePaise * 0.8) : i.basePricePaise) * i.quantity,
        })),
        amount_paise: cartTotalPaise,
        order_date: todayFormatted,
        created_at: new Date().toISOString(),
      };

      // Step 4: Persist in merchandise orders storage
      const existingOrders: MerchOrder[] = (() => {
        try {
          const raw = localStorage.getItem('skylinesos:merch_orders');
          return raw ? JSON.parse(raw) : SEED_MERCH_ORDERS;
        } catch {
          return SEED_MERCH_ORDERS;
        }
      })();
      const updatedOrders = [newOrder, ...existingOrders];
      setMerchOrders(updatedOrders);
      try {
        localStorage.setItem('skylinesos:merch_orders', JSON.stringify(updatedOrders));
      } catch {}

      // Step 5: Deliver Pickup OTP to the student/buyer & clear cart
      setLatestPlacedOrder(newOrder);
      setCart([]);
      setOrderSuccess(
        `Payment successful via Razorpay (ID: ${paymentResult.paymentId})! ${totalCartUnits} items confirmed. Your Pickup OTP is ${generatedOtp}.`
      );
      window.dispatchEvent(new CustomEvent('campusone:merch_orders_updated'));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Order was not placed.');
    } finally {
      setIsOrdering(false);
    }
  };

  // Admin approves order via entered OTP
  const handleApproveOtp = (order: MerchOrder) => {
    const entered = (otpInputs[order.id] || '').trim();
    if (!entered) {
      setApprovalFeedback({
        success: false,
        message: 'Please enter the student OTP before clicking Approve.',
      });
      setTimeout(() => setApprovalFeedback(null), 3500);
      return;
    }

    if (entered === order.otp) {
      // Both match: Mark status as approved/done
      const updatedOrders = merchOrders.map((item) =>
        item.id === order.id ? { ...item, status: 'approved' as const } : item
      );
      setMerchOrders(updatedOrders);
      try {
        localStorage.setItem('skylinesos:merch_orders', JSON.stringify(updatedOrders));
      } catch {}

      setApprovalFeedback({
        success: true,
        message: `OTP Verified! Order ${order.code} for ${order.buyer_name} (${order.item_name}) approved successfully! Order marked as done.`,
      });
      setTimeout(() => setApprovalFeedback(null), 4500);

      window.dispatchEvent(new CustomEvent('campusone:merch_orders_updated'));
    } else {
      // Incorrect OTP mismatch
      setApprovalFeedback({
        success: false,
        message: `Invalid OTP "${entered}"! Incorrect OTP for order ${order.code}. Order not approved.`,
      });
      setTimeout(() => setApprovalFeedback(null), 4000);
    }
  };

  const handleRefreshOrders = () => {
    try {
      const stored = localStorage.getItem('skylinesos:merch_orders');
      if (stored) {
        setMerchOrders(JSON.parse(stored));
      } else {
        setMerchOrders(SEED_MERCH_ORDERS);
      }
      setApprovalFeedback({
        success: true,
        message: 'Merchandise orders refreshed successfully.',
      });
      setTimeout(() => setApprovalFeedback(null), 3000);
    } catch {}
  };

  if (loading) {
    return <LoadingCard label="Loading merchandise catalog & real-time inventory..." />;
  }

  const primaryProduct = products[selectedProductIndex] || products[0];
  const variants = primaryProduct?.variants || [];
  const totalStock = variants.reduce((sum, v) => sum + (v.stock_on_hand ?? (v as any).available ?? 0), 0);

  const basePricePaise = selectedVariant?.price_paise || (selectedVariant as any)?.pricePaise || 39900;
  const discountedPricePaise = isMember ? Math.round(basePricePaise * 0.8) : basePricePaise;

  return (
    <div className="space-y-10 t-enter">
      {/* Toast Alert */}
      {orderSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {orderSuccess}</span>
          <button onClick={() => setOrderSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Cart Addition Feedback Notice */}
      {cartSuccessNotice && (
        <div className="p-4 rounded-2xl bg-black text-white flex justify-between items-center text-[14px] shadow-md transition-all">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">✓</span>
            <span>{cartSuccessNotice}</span>
          </div>
          <a
            href="#cart-section"
            className="px-3 py-1 rounded-full text-xs font-bold bg-white text-black hover:bg-slate-200 transition-colors cursor-pointer"
          >
            View Cart ({totalCartUnits}) →
          </a>
        </div>
      )}

      {/* Floating Cart Indicator */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 shadow-2xl">
          <a
            href="#cart-section"
            className="flex items-center gap-3 px-5 py-3 rounded-full bg-black hover:bg-slate-900 text-white font-bold text-sm shadow-xl transition-transform hover:scale-105 border border-slate-700"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-extrabold">
              {totalCartUnits}
            </div>
            <span>Cart: {formatPaise(cartTotalPaise)}</span>
            <span className="text-slate-400">↓ Checkout</span>
          </a>
        </div>
      )}

      {/* ─── STUDENT / BUYER: GENERATED PICKUP OTP RECEIPT CARD ─── */}
      {latestPlacedOrder && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                ✓
              </span>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-emerald-950">
                  Payment Successful! Merchandise Order Confirmed
                </h4>
                <p className="text-xs text-emerald-800">
                  Your order is confirmed. Present this 6-digit Pickup OTP to the merchandise admin to collect all your items.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLatestPlacedOrder(null)}
              className="px-3.5 py-1 rounded-full text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 self-start sm:self-auto cursor-pointer transition-colors"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ordered Items</p>
              <p className="text-sm font-bold text-slate-900 mt-1 line-clamp-2">{latestPlacedOrder.item_name}</p>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{latestPlacedOrder.item_variant}</p>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order Reference</p>
              <p className="text-sm font-mono font-bold text-slate-900 mt-1">{latestPlacedOrder.code}</p>
              <p className="text-xs text-slate-600 mt-0.5">Buyer: {latestPlacedOrder.buyer_name}</p>
            </div>

            <div className="bg-emerald-950 text-white p-4 rounded-2xl shadow-sm text-center border-2 border-emerald-400">
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Your Pickup OTP</p>
              <p className="text-3xl font-extrabold tracking-widest font-mono text-emerald-300 my-1">
                {latestPlacedOrder.otp}
              </p>
              <p className="text-[11px] text-emerald-200 font-medium">
                Show this OTP to Admin for Pickup
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Product Switcher Pills (Matching Screenshot 093432) */}
      {products.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {products.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProductSelect(idx)}
              className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedProductIndex === idx
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-[var(--color-surface-soft)] text-[var(--color-steel)] hover:text-black border border-[var(--color-hairline-soft)]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ─── PDP SPLIT: Visual left + Sticky purchase rail right ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Product Visual Card (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
            <div className="aspect-video w-full rounded-2xl bg-[var(--color-surface-soft)] flex items-center justify-center border border-[var(--color-hairline-soft)] relative overflow-hidden">
              {(() => {
                const name = (primaryProduct?.name || '').toLowerCase();
                let imgSrc: string | null = null;
                if (name.includes('hoodie') || name.includes('sweatshirt') || name.includes('sweater')) {
                  imgSrc = '/merch/hoodie.png';
                } else if (name.includes('tshirt') || name.includes('t-shirt') || name.includes('tee') || name.includes('shirt')) {
                  imgSrc = '/merch/tshirt.png';
                } else if (name.includes('cap') || name.includes('hat') || name.includes('snapback') || name.includes('headwear')) {
                  imgSrc = '/merch/cap.png';
                } else if (name.includes('sticker') || name.includes('pack') || name.includes('badge')) {
                  imgSrc = '/merch/stickers.png';
                }

                return imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={primaryProduct?.name || 'Skyline Merch'}
                    className="w-full h-full object-contain transition-opacity duration-300"
                  />
                ) : (
                  <div className="text-center p-8">
                    <span className="w-24 h-24 mx-auto rounded-full bg-[var(--color-ink-deep)] text-white flex items-center justify-center font-extrabold text-3xl mb-4 shadow-sm">
                      SOS
                    </span>
                    <p className="font-bold text-2xl text-[var(--color-ink-deep)]">
                      {primaryProduct?.name || 'Skyline Official Merchandise'}
                    </p>
                    <p className="text-[13px] text-[var(--color-steel)] mt-1">Official Student Organization Apparel & Goods</p>
                  </div>
                );
              })()}

              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-warning)] text-[var(--color-ink-deep)]">
                  Official 2026 Release
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Product Details</h3>
              <p className="text-[15px] text-[var(--color-ink)] leading-relaxed tracking-[-0.16px]">
                {primaryProduct?.description ||
                  'Official Skyline Student Association club merchandise. Crafted for comfort and community pride.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Sticky Purchase Rail (5 Cols) */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="p-6 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] shadow-sm space-y-6 t-card-interactive">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-[var(--color-steel)] uppercase tracking-wider font-mono">
                  SKU: {selectedVariant?.sku || 'P2-XL'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
                  In Stock ({totalStock} available)
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-ink-deep)]">
                {primaryProduct?.name}
              </h2>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-[var(--color-ink-deep)]">
                  {formatPaise(discountedPricePaise)}
                </span>
                {isMember && (
                  <>
                    <span className="text-lg line-through text-[var(--color-stone)]">
                      {formatPaise(basePricePaise)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-warning)] text-[var(--color-ink-deep)]">
                      20% Member Off
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Member Toggle */}
            <div className="p-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[var(--color-ink)]">Apply Active Member Pricing</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMember}
                  onChange={(e) => setIsMember(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>

            {/* Variant Picker Pills */}
            <div className="space-y-3 pt-2 border-t border-[var(--color-hairline-soft)]">
              <label className="text-[14px] font-bold text-[var(--color-ink-deep)] block">
                Select Option / Size:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  const stock = v.stock_on_hand ?? (v as any).available ?? 0;
                  const isOut = stock === 0;
                  const displayLabel = v.size || v.label || v.sku?.split('-')[1] || 'Std';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={isOut}
                      onClick={() => handleVariantSelect(v)}
                      className={`py-3 rounded-xl border text-[14px] font-bold transition-all text-center cursor-pointer t-button-action ${
                        isSelected
                          ? 'border-2 border-[var(--color-ink-deep)] bg-[var(--color-canvas)] text-[var(--color-ink-deep)]'
                          : isOut
                          ? 'border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] text-[var(--color-stone)] line-through cursor-not-allowed opacity-60'
                          : 'border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-ink-deep)] text-[var(--color-ink)]'
                      }`}
                    >
                      <div>{displayLabel}</div>
                      <div className="text-[10px] font-normal text-[var(--color-steel)] mt-0.5">
                        {isOut ? 'Out' : `${stock} left`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-[var(--color-ink)]">Choose Quantity</p>
                <p className="text-[11px] text-[var(--color-steel)]">
                  Total: {formatPaise(discountedPricePaise * selectedQuantity)}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={selectedQuantity <= 1}
                  onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  -
                </button>
                <span className="font-bold font-mono text-sm w-6 text-center text-[var(--color-ink-deep)]">
                  {selectedQuantity}
                </span>
                <button
                  type="button"
                  disabled={selectedQuantity >= (selectedVariant?.stock_on_hand ?? (selectedVariant as any)?.available ?? 10)}
                  onClick={() =>
                    setSelectedQuantity((q) =>
                      Math.min(selectedVariant?.stock_on_hand ?? (selectedVariant as any)?.available ?? 10, q + 1)
                    )
                  }
                  className="w-8 h-8 rounded-full border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Live Stock & Payment Note */}
            <div className="p-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] text-[12px] text-[var(--color-steel)] space-y-1">
              <div>
                <strong className="text-[var(--color-ink)]">Real-Time Stock:</strong> Inventory is verified to prevent overselling.
              </div>
              <div>
                <strong>Razorpay Test Mode:</strong> Key <code className="px-1.5 py-0.5 rounded bg-slate-200 text-black font-mono text-[10px]">rzp_test_T8GBnZ6P23gRoO</code>
              </div>
            </div>

            {/* Action Buttons: Add to Cart + Direct Buy */}
            <div className="space-y-2.5 pt-1">
              {/* 1. Add to Cart Button */}
              <button
                type="button"
                disabled={!selectedVariant || (selectedVariant.stock_on_hand ?? (selectedVariant as any).available ?? 0) === 0}
                onClick={handleAddToCart}
                className="w-full py-3.5 px-6 rounded-full font-bold text-black bg-white hover:bg-slate-50 border-2 border-black transition-all text-[15px] shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>Add to Cart ({selectedQuantity}) • {formatPaise(discountedPricePaise * selectedQuantity)}</span>
              </button>

              {/* 2. Buy Now (Direct Single Item Checkout) */}
              <button
                type="button"
                disabled={!selectedVariant || (selectedVariant.stock_on_hand ?? (selectedVariant as any).available ?? 0) === 0 || isOrdering}
                onClick={handleBuySingle}
                className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-black hover:bg-slate-900 transition-all text-[15px] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isOrdering ? (
                  <>
                    <ButtonSpinner size={18} />
                    <span>Opening Razorpay Gateway...</span>
                  </>
                ) : (
                  `Buy Now • ${formatPaise(discountedPricePaise * selectedQuantity)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MULTI-ITEM SHOPPING CART SECTION ─── */}
      <div id="cart-section" className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                Your Shopping Cart
              </h3>
              <p className="text-xs sm:text-sm text-[#64748b]">
                {cart.length > 0
                  ? `${totalCartUnits} item${totalCartUnits === 1 ? '' : 's'} across ${cart.length} variant${cart.length === 1 ? '' : 's'} ready for checkout.`
                  : 'Your cart is empty. Pick different products & sizes above and click "Add to Cart" to bundle them together.'}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline self-start sm:self-auto cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-sm space-y-2">
            <p className="font-semibold text-slate-700">No items added to cart yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Select any merchandise product (Club T-Shirt, Skyline Cap, Hoodie, Sticker Pack) and choose your size, then click <strong>Add to Cart</strong> to assemble your order!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart Items List */}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
              {cart.map((item) => {
                const itemEffectivePrice = isMember ? Math.round(item.basePricePaise * 0.8) : item.basePricePaise;
                const itemLineTotal = itemEffectivePrice * item.quantity;
                return (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <span className="font-bold text-[11px] text-slate-700 font-mono">{item.sku}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-[#0f172a]">{item.productName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold font-mono">
                            Size: {item.size}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {formatPaise(itemEffectivePrice)} each
                          </span>
                          {isMember && (
                            <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                              20% Member Off
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stepper + Line Total + Remove */}
                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <div className="flex items-center gap-2 border border-slate-200 rounded-full px-2 py-1 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center font-bold text-xs text-slate-700 cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono text-xs w-6 text-center text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.stockAvailable}
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center font-bold text-xs text-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right min-w-[90px]">
                        <p className="font-extrabold text-base text-[#0f172a]">
                          {formatPaise(itemLineTotal)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Summary & Total */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal ({totalCartUnits} items)</span>
                  <span className="font-semibold text-slate-900">{formatPaise(cartBaseTotalPaise)}</span>
                </div>
                {isMember && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Active Member Discount (20%)</span>
                    <span>- {formatPaise(cartBaseTotalPaise - cartTotalPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
                  <span className="text-base font-bold text-[#0f172a]">Total Payable Amount</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#0f172a]">
                    {formatPaise(cartTotalPaise)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>Razorpay Test Key: <code className="font-mono text-[11px] font-bold text-black">rzp_test_T8GBnZ6P23gRoO</code></span>
                <span className="text-emerald-700 font-bold">Instant Order OTP Generated Upon Payment</span>
              </div>

              {/* Checkout Button directly linked with Razorpay */}
              <button
                type="button"
                disabled={isOrdering || cart.length === 0}
                onClick={handleCheckoutCart}
                className="w-full py-4 px-6 rounded-full font-bold text-white bg-black hover:bg-slate-900 transition-all text-[16px] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isOrdering ? (
                  <>
                    <ButtonSpinner size={18} />
                    <span>Opening Razorpay Gateway for {formatPaise(cartTotalPaise)}...</span>
                  </>
                ) : (
                  `Proceed to Checkout & Pay ${formatPaise(cartTotalPaise)} via Razorpay (${totalCartUnits} Items)`
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── ADMIN ONLY: MERCHANDISE APPLICATIONS & APPROVALS CONSOLE (SCREENSHOT 090602) ─── */}
      {session?.role === 'admin' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                  Admin Only
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                  Merchandise Orders & Approvals Console
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b]">
                Review student registrations, merchandise orders, and enter attendee OTP for instant order fulfillment approval.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshOrders}
              className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              Refresh Applications
            </button>
          </div>

          {approvalFeedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold text-center ${
                approvalFeedback.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {approvalFeedback.message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748b] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">STUDENT / EMAIL</th>
                  <th className="py-3 px-4">EVENT NAME</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">VALIDITY DATES / SEAT</th>
                  <th className="py-3 px-4">COMMITTEE DECISION / ENTER OTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {merchOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                      <div>{order.buyer_name}</div>
                      <div className="text-[11px] font-normal text-[#64748b]">{order.buyer_email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#0f172a]">
                      <div className="font-bold">{order.item_name}</div>
                      <div className="text-[11px] text-[#64748b] font-medium uppercase">{order.item_variant}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {order.status === 'approved' ? 'APPROVED' : 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#334155]">
                      <div>{order.order_date}</div>
                      <div className="font-extrabold text-black font-mono">{order.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {order.status === 'approved' ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          ✓ Approved & Admitted
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ENTER OTP"
                            value={otpInputs[order.id] || ''}
                            onChange={(e) =>
                              setOtpInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            className="w-28 px-3 py-1.5 rounded-full border border-slate-200 text-center text-xs font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => handleApproveOtp(order)}
                            className="px-4 py-1.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
