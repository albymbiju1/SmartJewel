import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { api } from '../../api';
import { stockService } from '../../services/stockService';

// Customer form now includes phone for Razorpay prefill/contact
interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, cartTotal, updateQuantity, removeFromCart } = useCart();

  // Form + UI state
  const [form, setForm] = useState<CustomerForm>({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockValidating, setStockValidating] = useState(false);
  const [stockErrors, setStockErrors] = useState<string[]>([]);

  // Pricing: demo taxes and shipping for a clear summary
  const taxRate = 0.03; // 3% GST demo
  const shipping = items.length ? 199 : 0; // flat demo shipping

  const subtotal = useMemo(() => Math.max(0, items.reduce((s, it) => s + (it.price || 0) * it.quantity, 0)), [items]);
  const taxes = useMemo(() => Math.round(subtotal * taxRate), [subtotal]);
  const total = useMemo(() => subtotal + taxes + shipping, [subtotal, taxes, shipping]);

  // Load Razorpay checkout script lazily
  useEffect(() => {
    if (window.Razorpay) return;
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Validate stock availability when cart items change
  useEffect(() => {
    if (items.length > 0) {
      validateStockAvailability();
    } else {
      setStockErrors([]);
    }
  }, [items]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const disabled = loading || stockValidating || !total || total < 1 || !form.name || !form.email || !form.address || !form.phone || stockErrors.length > 0;

  const friendlyError = (err: any) => {
    const raw = err?.response?.data?.error || err?.message || '';
    const details = err?.response?.data?.details;
    if (raw === 'razorpay_keys_missing') {
      return 'Payment is temporarily unavailable: Razorpay test keys are not configured on the server.';
    }
    if (raw === 'razorpay_order_failed') {
      return `Unable to create order with payment provider. ${details ? `Details: ${String(details).slice(0,200)}` : 'Please try again.'}`;
    }
    return raw || 'Something went wrong. Please try again.';
  };

  // Validate stock availability for all cart items
  const validateStockAvailability = async () => {
    if (items.length === 0) return true;

    try {
      setStockValidating(true);
      setStockErrors([]);

      // Fetch current product data to get live stock quantities
      const response = await api.get('/inventory/products');
      const products = response.data.products || [];
      
      const errors: string[] = [];
      
      items.forEach(item => {
        // Find the product by SKU or productId
        const product = products.find((p: any) => p.sku === item.sku || p._id === item.productId);
        if (!product) {
          errors.push(`${item.name}: Product not found`);
          return;
        }

        const availableQuantity = product.quantity || 0;
        if (availableQuantity < item.quantity) {
          if (availableQuantity === 0) {
            errors.push(`${item.name}: Out of stock`);
          } else {
            errors.push(`${item.name}: Only ${availableQuantity} available (requested: ${item.quantity})`);
            // Automatically adjust cart quantity to available stock
            updateQuantity(item.productId, availableQuantity);
          }
        }
      });

      setStockErrors(errors);
      return errors.length === 0;
    } catch (error) {
      console.error('Failed to validate stock:', error);
      setStockErrors(['Unable to verify stock availability. Please try again.']);
      return false;
    } finally {
      setStockValidating(false);
    }
  };

  const payNow = async () => {
    try {
      setError(null);
      setLoading(true);

      // First validate stock availability
      const isStockValid = await validateStockAvailability();
      if (!isStockValid) {
        setLoading(false);
        return;
      }

      // Guard: Razorpay requires INR; backend already uses INR
      const amountRupees = Math.max(1, Math.round(total));

      // 1) Create Razorpay order (test mode via backend). Send total (incl. taxes + shipping)
      const res = await api.post('/payments/api/create-order', {
        amount: amountRupees, // rupees
        currency: 'INR',
        customer: { name: form.name, email: form.email, phone: form.phone, address: form.address },
        items: items.map(i => ({ id: i.productId, name: i.name, qty: i.quantity, price: i.price || 0 })),
      });
      const { order, key_id } = res.data as { order: any; key_id: string };

      if (!order?.id || !key_id) throw new Error('Failed to initiate payment');

      // 2) Open Razorpay checkout
      if (!window.Razorpay) throw new Error('Razorpay SDK not loaded');

      const rzp = new window.Razorpay({
        key: key_id,
        order_id: order.id,
        amount: order.amount, // in paise
        currency: order.currency || 'INR',
        name: 'SmartJewel',
        description: 'Order Payment',
        prefill: { name: form.name, email: form.email, contact: form.phone },
        notes: { address: form.address },
        theme: { color: '#b45309' },
        // Prioritize UPI and Netbanking; hide Cards to avoid international-card limitations in test
        method: { upi: true, card: false, netbanking: true, wallet: true, emi: false, paylater: false },
        config: {
          display: {
            blocks: {
              upi: { name: 'UPI', instruments: [{ method: 'upi' }] },
              nb: { name: 'Netbanking', instruments: [{ method: 'netbanking' }] },
            },
            sequence: ['block.upi', 'block.nb'],
            // Disable default blocks to avoid duplicate UPI/Netbanking sections
            preferences: { show_default_blocks: false },
          },
          // Ensure UPI collect flow is enabled (desktop-friendly)
          upi: { flow: 'collect' },
        },
        retry: { enabled: true, max_count: 2 },
        handler: async (response) => {
          try {
            // 3) Verify signature on backend
            const verify = await api.post('/payments/razorpay/verify', response);
            const { order_id } = verify.data;
            navigate('/order-confirmation', { state: { orderId: order_id, amount: amountRupees } });
          } catch (e: any) {
            const msg = e?.response?.data?.reason || e?.response?.data?.error || e?.message || 'Payment verification failed.';
            setError(String(msg));
          }
        },
        modal: {
          ondismiss: () => setError('Payment cancelled. You can try again.'),
        },
      });

      // Capture detailed failure reasons from Razorpay Checkout (if available)
      (rzp as any).on?.('payment.failed', (resp: any) => {
        const desc = resp?.error?.description || resp?.error?.reason || 'Payment failed.';
        setError(desc);
      });

      rzp.open();
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Breadcrumb */}
      <div className="bg-white/80 backdrop-blur border-b">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-amber-600">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/cart')} className="hover:text-amber-600">Bag</button>
          <span>/</span>
          <span className="text-gray-900">Checkout</span>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Customer + Items */}
          <div className="lg:col-span-2 space-y-8">
            {/* Customer Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold">1</div>
                <h2 className="text-xl font-semibold tracking-tight text-gray-900">Customer Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input name="name" value={form.name} onChange={onChange} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g., Priya Sharma" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={form.email} onChange={onChange} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" name="phone" value={form.phone} onChange={onChange} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="10-digit mobile" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea name="address" value={form.address} onChange={onChange} rows={3} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Flat, Street, City, Pincode" />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
              )}

              {/* Stock Validation Errors */}
              {stockErrors.length > 0 && (
                <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-red-800 font-medium text-sm">Stock Issues</span>
                  </div>
                  <ul className="text-red-700 text-sm space-y-1">
                    {stockErrors.map((error, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-red-600 text-xs mt-2">Please update your cart or try again later.</p>
                </div>
              )}

              {/* Stock Validation Loading */}
              {stockValidating && (
                <div className="mt-4 p-3 rounded-md bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-blue-700 text-sm">Checking stock availability...</span>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => navigate('/cart')} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Back to Bag</button>
                <button disabled={disabled} onClick={payNow} className={`px-6 py-2.5 rounded-lg text-white transition-colors ${disabled ? 'bg-amber-300' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {loading ? 'Opening Razorpay…' : stockValidating ? 'Checking Stock…' : stockErrors.length > 0 ? 'Stock Issues - Cannot Proceed' : `Pay Now (₹${total.toLocaleString('en-IN')})`}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Test Mode: use Razorpay test cards (e.g., 4111 1111 1111 1111) or dismiss the modal to simulate failure.</p>
            </div>

            {/* Items List */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold">2</div>
                <h2 className="text-xl font-semibold tracking-tight text-gray-900">Your Items</h2>
              </div>

              {items.length === 0 ? (
                <p className="text-gray-600">Your bag is empty.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <li key={`${it.productId}-${it.size || ''}-${it.style || ''}`} className="py-4 flex items-center gap-4">
                      <img src={it.image || '/jewel1.png'} alt={it.name} className="w-20 h-20 object-cover rounded-lg border" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{it.name}</p>
                        <p className="text-sm text-gray-600">
                          {it.metal || (it as any).material || '—'}{it.purity ? ` • ${it.purity}` : ''}{(it as any).weight ? ` • ${(it as any).weight}${(it as any).unit || 'g'}` : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="inline-flex items-center gap-2">
                            <button
                              aria-label="Decrease quantity"
                              className="w-8 h-8 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                              onClick={() => updateQuantity(it.productId, Math.max(1, it.quantity - 1))}
                            >
                              −
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm">{it.quantity}</span>
                            <button
                              aria-label="Increase quantity"
                              className="w-8 h-8 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                              onClick={() => updateQuantity(it.productId, it.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="text-sm text-rose-600 hover:text-rose-700"
                            onClick={() => removeFromCart(it.productId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-900 font-medium">₹{((it.price || 0) * it.quantity).toLocaleString('en-IN')}</div>
                        {it.price ? <div className="text-xs text-gray-500">₹{(it.price).toLocaleString('en-IN')} each</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Items</span>
                  <span className="text-gray-900 font-medium">{items.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900 font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Taxes (3%)</span>
                  <span className="text-gray-900 font-medium">₹{taxes.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900 font-medium">₹{shipping.toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between text-base">
                  <span className="text-gray-900 font-semibold">Total</span>
                  <span className="text-gray-900 font-bold">₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                disabled={disabled}
                onClick={payNow}
                className={`mt-5 w-full px-6 py-3 rounded-lg text-white font-medium tracking-wide shadow-sm transition-colors ${disabled ? 'bg-amber-300' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {loading ? 'Processing…' : `Pay Now (₹${total.toLocaleString('en-IN')})`}
              </button>

              <p className="text-xs text-gray-500 mt-2 text-center">Secure payments via Razorpay (Test Mode)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;