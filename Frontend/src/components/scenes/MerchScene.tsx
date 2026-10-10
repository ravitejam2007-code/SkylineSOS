import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { Product, ProductVariant } from '@campusone/contracts';

export default function MerchScene() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isMember, setIsMember] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);

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
  }, []);

  const handleProductSelect = (index: number) => {
    setSelectedProductIndex(index);
    const prod = products[index];
    if (prod?.variants && prod.variants.length > 0) {
      setSelectedVariant(prod.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  };

  // Handle Merch Checkout
  const handleBuy = async () => {
    if (!selectedVariant) return;
    setIsOrdering(true);
    try {
      const primaryProduct = products[selectedProductIndex] || products[0];
      const res = await api.orderMerchVariant({
        variant_id: selectedVariant.id,
        quantity: 1,
        is_member: isMember,
      });
      setOrderSuccess(
        `Order confirmed for ${primaryProduct.name} (${selectedVariant.size || selectedVariant.label})! Decremented stock in live database.`
      );
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsOrdering(false);
    }
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
    <div className="space-y-8 t-enter">
      {orderSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {orderSuccess}</span>
          <button onClick={() => setOrderSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Product Switcher Pills */}
      {products.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {products.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProductSelect(idx)}
              className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedProductIndex === idx
                  ? 'bg-[var(--color-ink-deep)] text-white shadow-sm'
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
                  SKU: {selectedVariant?.sku || 'SKY-MRCH'}
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
                      onClick={() => setSelectedVariant(v)}
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

            {/* Live Stock Note */}
            <div className="p-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] text-[12px] text-[var(--color-steel)]">
              <strong className="text-[var(--color-ink)]">Real-Time Stock:</strong> Inventory is verified through the Edge Function API to prevent overselling.
            </div>

            {/* Buy Action */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!selectedVariant || (selectedVariant.stock_on_hand ?? (selectedVariant as any).available ?? 0) === 0 || isOrdering}
                onClick={handleBuy}
                className="w-full py-4 px-6 rounded-full font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-deep)] transition-all text-[16px] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed t-button-action flex items-center justify-center gap-2"
              >
                {isOrdering ? (
                  <ButtonSpinner size={18} />
                ) : (
                  `Order Now · ${formatPaise(discountedPricePaise)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
