import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { API_BASE_URL, api } from '../../api';

interface Product {
  _id: string;
  name: string;
  price?: number;
  image?: string;
  metal?: string;
  purity?: string;
  weight?: number;
  weight_unit?: string;
  category?: string;
}

// Safely create absolute image URL for backend-hosted assets
const toAbsoluteImage = (img?: string) => {
  if (!img) return '/jewel1.png';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const path = img.startsWith('/') ? img : `/${img}`;
  return `${API_BASE_URL}${path}`;
};

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart } = useCart();

  // Fetched product details to supplement cart items (weight, current price if missing, etc.)
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    const uniqueIds = Array.from(new Set(items.map(i => i.productId))).filter(Boolean);
    if (uniqueIds.length === 0) {
      setProductMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingProducts(true);
        // Fetch individually to keep it simple and resilient (backend supports /inventory/items/:id)
        const results: Record<string, Product> = {};
        for (const id of uniqueIds) {
          try {
            const res = await api.get(`/inventory/items/${id}`);
            const p = res.data?.item as Product | undefined;
            if (p) results[id] = p;
          } catch {
            // Fallback: skip if not found; UI will handle gracefully
          }
        }
        if (!cancelled) setProductMap(results);
      } catch {
        if (!cancelled) setProductMap({});
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [items]);

  // Pricing helpers
  const lineItems = useMemo(() => items.map(it => {
    const p = productMap[it.productId];
    const derived = (p?.computed_price ?? p?.price ?? 0);
    const unitPrice = typeof it.price === 'number' ? it.price : derived;
    const total = unitPrice * it.quantity;
    return { cart: it, product: p, unitPrice, total };
  }), [items, productMap]);

  const subtotal = useMemo(() => lineItems.reduce((sum, li) => sum + li.total, 0), [lineItems]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  const discount = useMemo(() => {
    // Simple demo: 5% off for code SAVE5 or 5% if 3+ items
    const base = subtotal;
    if (!base) return 0;
    if (appliedPromo === 'SAVE5' || items.reduce((s, it) => s + it.quantity, 0) >= 3) return Math.round(base * 0.05);
    return 0;
  }, [subtotal, items, appliedPromo]);

  const TAX_RATE = 0.03; // 3% GST (illustrative)
  const taxes = useMemo(() => Math.round((subtotal - discount) * TAX_RATE), [subtotal, discount]);
  const total = Math.max(0, subtotal - discount + taxes);

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    // Support a single illustrative code. Extend as needed.
    if (code === 'SAVE5') setAppliedPromo(code);
    setPromoCode('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button>
          <span>/</span>
          <span className="text-gray-900">Bag</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 py-10">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Your Bag</h1>
          <p className="text-gray-600">Review your selected designs and proceed to checkout</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Empty state */}
        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 mb-4">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 3H3m4 10v6a1 1 0 001 1h1m-4-3h12a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v10z"/></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your bag is empty</h2>
            <p className="text-gray-600 mb-6">Discover our jewellery and add your favorites to the bag.</p>
            <button onClick={() => navigate('/products/all')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:opacity-90">
              Browse Jewellery
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items list */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((it) => {
                const p = productMap[it.productId];
                const unitPrice = typeof it.price === 'number' ? it.price : (p?.price ?? 0);
                const lineTotal = unitPrice * it.quantity;
                return (
                  <div key={`${it.productId}-${it.size || ''}-${it.style || ''}`} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      {/* Image */}
                      <div className="w-28 h-28 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
                        <img src={toAbsoluteImage(it.image || p?.image)} alt={it.name} className="w-full h-full object-cover" onError={(e)=>{ (e.target as HTMLImageElement).src = '/jewel1.png'; }} />
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-gray-900 font-medium leading-snug" title={it.name}>{it.name}</h3>
                            <div className="mt-1 text-sm text-gray-600 flex flex-wrap items-center gap-2">
                              {(it.metal || p?.metal) && <span>{it.metal || p?.metal}</span>}
                              {(it.purity || p?.purity) && <span>• {it.purity || p?.purity}</span>}
                              {p?.weight ? <span>• {p.weight}{p.weight_unit ? ` ${p.weight_unit}` : ''}</span> : null}
                              {it.size && <span className="inline-flex items-center text-xs bg-gray-100 px-2 py-0.5 rounded">Size: {it.size}</span>}
                              {it.style && <span className="inline-flex items-center text-xs bg-gray-100 px-2 py-0.5 rounded">Style: {it.style}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-900 font-semibold">{unitPrice ? `₹${unitPrice.toLocaleString('en-IN')}` : 'Price on request'}</div>
                            <button className="mt-2 text-sm text-rose-700 hover:text-rose-800" onClick={() => removeFromCart(it.productId)}>Remove</button>
                          </div>
                        </div>

                        {/* Quantity and line total */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center border rounded-md">
                            <button className="p-2 hover:bg-gray-50" onClick={() => updateQuantity(it.productId, Math.max(1, it.quantity - 1))} aria-label="Decrease quantity">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            </button>
                            <span className="px-4 py-2 border-x min-w-[3rem] text-center">{it.quantity}</span>
                            <button className="p-2 hover:bg-gray-50" onClick={() => updateQuantity(it.productId, Math.min(99, it.quantity + 1))} aria-label="Increase quantity">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Line total</div>
                            <div className="text-gray-900 font-semibold">{lineTotal ? `₹${lineTotal.toLocaleString('en-IN')}` : '-'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between">
                <button className="text-sm text-gray-600 hover:text-rose-700" onClick={clearCart}>Clear bag</button>
                {loadingProducts && <span className="text-sm text-gray-500">Refreshing product details…</span>}
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900 font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Discount{appliedPromo ? ` (${appliedPromo})` : ''}</span>
                    <span className="text-emerald-700 font-medium">- ₹{discount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Taxes (3%)</span>
                    <span className="text-gray-900 font-medium">₹{taxes.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between text-base">
                    <span className="text-gray-900 font-semibold">Total</span>
                    <span className="text-gray-900 font-bold">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Promo code */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e)=>setPromoCode(e.target.value)}
                      placeholder="Enter code (e.g., SAVE5)"
                      className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    <button onClick={applyPromo} className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:opacity-90">Apply</button>
                  </div>
                </div>

                <button
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => navigate('/checkout')}
                >
                  Proceed to Checkout
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;