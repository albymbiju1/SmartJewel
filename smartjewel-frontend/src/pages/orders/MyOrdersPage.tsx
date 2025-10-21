import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  imageUrl?: string;
}

interface StatusHistoryEntry {
  status: string;
  timestamp?: string;
  at?: string; // backward compat
  notes?: string;
  note?: string; // backward compat
}

interface OrderSummary {
  orderId: string;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
  amount: number;
  createdAt: string;
  shipping?: { status?: string | null };
  cancellation?: {
    requested?: boolean;
    reason?: string;
    requestedAt?: string;
    approved?: boolean;
    approvedAt?: string;
    rejectedAt?: string;
    refundProcessed?: boolean;
    refundDetails?: any;
  };
}

const STATUS_STEPS = ['created', 'paid', 'shipped', 'delivered'];

const toINR = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const MyOrdersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [yearFilters, setYearFilters] = useState<string[]>([]);

  // cancel modal state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; orderId: string; reason: string; loading: boolean }>({
    open: false,
    orderId: '',
    reason: '',
    loading: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/api/orders/my-orders');
        const data: OrderSummary[] = res.data?.orders || [];
        setOrders(data);

        // Fetch product images
        const productIds = new Set<string>();
        data.forEach(o => o.items.forEach(i => productIds.add(i.id)));
        if (productIds.size > 0) {
          try {
            const productsRes = await api.get('/inventory/products');
            const products = productsRes.data.products || [];
            const idToImage = new Map(products.map((p: any) => [p._id, p.image]));
            setOrders(data.map(o => ({
              ...o,
              items: o.items.map(i => ({
                ...i,
                imageUrl: idToImage.get(i.id)
              }))
            })));
          } catch (e) {
            console.warn('Failed to fetch product images:', e);
            // Orders still show without images
          }
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, navigate]);

  const getCurrentStatus = (hist: StatusHistoryEntry[]) => {
    if (!hist || hist.length === 0) return 'created';
    const last = hist[hist.length - 1];
    return (last.status || '').toLowerCase();
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const status = getCurrentStatus(o.statusHistory);
      const created = new Date(o.createdAt);
      const year = created.getFullYear().toString();
      const isLast30Days = (new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24) <= 30;
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(status);
      const matchesYear = yearFilters.length === 0 || yearFilters.some(y => y === 'Last 30 days' ? isLast30Days : y === year);
      const matchesSearch = !search || o.orderId.toLowerCase().includes(search.toLowerCase()) || o.items.some(it => it.name.toLowerCase().includes(search.toLowerCase()));
      return matchesStatus && matchesYear && matchesSearch;
    });
  }, [orders, search, statusFilters, yearFilters]);

  const isEligibleForCancellation = (o: OrderSummary) => {
    const last = getCurrentStatus(o.statusHistory);
    const allowed = ['created','pending','paid'];
    const isCancelled = last === 'cancelled';
    const alreadyRequested = !!o.cancellation?.requested;
    return allowed.includes(last) && !isCancelled && !alreadyRequested;
  };

  const openCancelModal = (orderId: string) => setCancelModal({ open: true, orderId, reason: '', loading: false });
  const closeCancelModal = () => setCancelModal({ open: false, orderId: '', reason: '', loading: false });
  const submitCancellation = async () => {
    if (!cancelModal.reason.trim()) {
      toast.info('Please enter a reason');
      return;
    }
    try {
      setCancelModal((m) => ({ ...m, loading: true }));
      await api.post(`/api/orders/${cancelModal.orderId}/cancel`, { reason: cancelModal.reason.trim() });
      toast.success('Cancellation requested');
      // refresh list
      const res = await api.get('/api/orders/my-orders');
      setOrders(res.data?.orders || []);
      closeCancelModal();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Failed to request cancellation');
      setCancelModal((m) => ({ ...m, loading: false }));
    }
  };

  const getProgress = (status: string) => Math.max(0, STATUS_STEPS.indexOf((status || '').toLowerCase()));

  const formatDate = (s?: string) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'paid':
      case 'shipped':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'returned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-[#C0A172] transition-colors">Home</button>
          <span>&gt;</span>
          <span className="text-gray-900 font-medium">My Orders</span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 flex gap-8">
        <div className="w-1/4">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 uppercase text-gray-700">Filter Orders</h3>
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase">STATUS</h4>
              {['Processing', 'Shipped', 'Delivered', 'Returned'].map(s => {
                const checked = statusFilters.includes(s.toLowerCase());
                return (
                  <label key={s} className="block text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStatusFilters(prev => [...prev, s.toLowerCase()]);
                        } else {
                          setStatusFilters(prev => prev.filter(f => f !== s.toLowerCase()));
                        }
                      }}
                      className="mr-2"
                    />
                    {s}
                  </label>
                );
              })}
            </div>
            <hr className="border-gray-200 mb-6" />
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase">YEAR</h4>
              {['Last 30 days', '2025', '2024', '2023'].map(y => {
                const checked = yearFilters.includes(y);
                return (
                  <label key={y} className="block text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setYearFilters(prev => [...prev, y]);
                        } else {
                          setYearFilters(prev => prev.filter(f => f !== y));
                        }
                      }}
                      className="mr-2"
                    />
                    {y}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-4 text-gray-900">My Orders</h1>
            <div className="relative max-w-md">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or order ID"
                className="w-full p-3 border border-gray-300 rounded-lg pr-10"
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#C0A172] transition-colors">
                🔍
              </button>
            </div>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">No orders yet</h2>
              <p className="text-gray-600 mb-8 text-lg">Start shopping to see your orders here.</p>
              <button onClick={() => navigate('/products/all')} className="px-6 py-3 bg-[#C0A172] text-white rounded-lg">Start Shopping</button>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredOrders.map((o) => {
                const status = getCurrentStatus(o.statusHistory);
                const firstItem = o.items[0];
                const metal = '18k Yellow Gold';
                const carat = '0.75';
                const ringSize = '6';
                const imageUrl = (firstItem.imageUrl?.startsWith('http') ? firstItem.imageUrl : firstItem.imageUrl ? `http://127.0.0.1:5000${firstItem.imageUrl}` : 'https://via.placeholder.com/80x80?text=Jewelry');
                const isDelivered = status === 'delivered';
                const isCancelledRefunded = o.cancellation?.approved && o.cancellation?.refundDetails?.status === 'processed';
                const isReturned = status === 'returned';
                const isGift = false; // assume no gift field
                const deliveredDate = o.statusHistory.find(h => h.status.toLowerCase() === 'delivered')?.timestamp || o.createdAt;
                return (
                  <div key={o.orderId} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col cursor-pointer" onClick={() => navigate(`/order-details/${o.orderId}`)}>
                    {isGift && (
                      <div className="mb-4 p-3 bg-[#C0A172] text-white rounded flex items-center">
                        <span className="mr-2">🎁</span>
                        This order was a gift from [Sender's Name]
                      </div>
                    )}
                    <div className="flex items-center">
                      <img src={imageUrl} alt={firstItem.name} className="w-20 h-20 object-contain rounded border border-gray-200 mr-4" />
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-gray-900">{firstItem.name}</h4>
                        <p className="text-sm text-gray-600">Metal: {metal}, Carat: {carat}, Ring Size: {ringSize}</p>
                        {o.items.length > 1 && <p className="text-sm text-gray-600">and {o.items.length - 1} more items</p>}
                      </div>
                      <div className="text-xl font-bold text-gray-900 mr-6">{toINR(o.amount)}</div>
                      <div className="text-right">
                        {isDelivered && (
                          <>
                            <div className="flex items-center justify-end mb-2">
                              <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center mr-2">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-green-700 font-medium">Delivered on {formatDate(deliveredDate)}</span>
                            </div>
                            <button className="text-[#C0A172] hover:underline" onClick={(e) => { e.stopPropagation(); /* TODO: navigate to review page */ }}>Review Your Purchase</button>
                          </>
                        )}
                        {isCancelledRefunded && (
                          <>
                            <div className="flex items-center justify-end mb-2">
                              <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center mr-2">
                                <span className="text-white text-xs">-</span>
                              </div>
                              <span className="text-red-700 font-medium">Refund Completed</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">This item was cancelled at your request.</p>
                          </>
                        )}
                        {isReturned && (
                          <>
                            <div className="flex items-center justify-end mb-2">
                              <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center mr-2">
                                <span className="text-white text-xs">↩</span>
                              </div>
                              <span className="text-red-700 font-medium">Returned</span>
                            </div>
                          </>
                        )}
                        {!isDelivered && !isCancelledRefunded && !isReturned && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusClass(status)}`}>{capitalize(status)}</span>
                        )}
                      </div>
                    </div>
                    {isCancelledRefunded && (
                      <div className="mt-4 bg-gray-50 p-4 rounded">
                        <h5 className="font-semibold text-gray-900">Refund Information (Ref ID: {o.cancellation?.refundDetails?.refundId})</h5>
                        <p className="text-sm text-gray-600">Your refund has been processed successfully. The amount will be credited to your original payment method within 5-7 business days.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeCancelModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Cancellation</h3>
            <p className="text-sm text-gray-600 mb-4">Please tell us why you want to cancel this order.</p>
            <textarea
              value={cancelModal.reason}
              onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value }))}
              placeholder="Reason for cancellation..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeCancelModal} className="px-4 py-2 border rounded">Close</button>
              <button onClick={submitCancellation} disabled={cancelModal.loading || !cancelModal.reason.trim()} className="px-4 py-2 bg-amber-600 text-white rounded disabled:opacity-50">
                {cancelModal.loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
