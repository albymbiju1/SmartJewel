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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, navigate]);

  const toggleExpand = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const getCurrentStatus = (hist: StatusHistoryEntry[]) => {
    if (!hist || hist.length === 0) return 'created';
    const last = hist[hist.length - 1];
    return (last.status || '').toLowerCase();
  };

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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-amber-600 transition-colors">Home</button>
          <span>/</span>
          <span className="text-gray-900 font-medium">My Orders</span>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">No orders yet</h2>
            <p className="text-gray-600 mb-8 text-lg">Start shopping to see your orders here.</p>
            <button onClick={() => navigate('/products/all')} className="px-6 py-3 bg-amber-600 text-white rounded-lg">Start Shopping</button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((o) => {
              const status = getCurrentStatus(o.statusHistory);
              const progressIdx = getProgress(status);
              return (
                <div key={o.orderId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Order Header */}
                  <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">Order #{o.orderId}</h3>
                        </div>
                        <div className="text-sm text-gray-600">Placed on {formatDate(o.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Amount Paid</div>
                        <div className="text-2xl font-bold text-gray-900">{toINR(o.amount)}</div>
                        <div className="mt-2 flex items-center gap-2 justify-end">
                          {o.cancellation?.requested && !o.cancellation?.approved && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">Cancellation Requested</span>
                          )}
                          {o.cancellation?.approved && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Cancelled</span>
                          )}
                          {o.cancellation?.approved && o.cancellation?.refundDetails?.refundId && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              {o.cancellation.refundDetails.status === 'processed' ? '💰 Refunded' : '⏳ Refund Processing'}
                            </span>
                          )}
                          {o.cancellation?.approved && o.cancellation?.refundDetails?.failed && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">❌ Refund Failed</span>
                          )}
                          {isEligibleForCancellation(o) && (
                            <button
                              onClick={() => openCancelModal(o.orderId)}
                              className="px-3 py-2 text-xs font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                              title="Request order cancellation"
                            >
                              Cancel Order
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/order-details/${o.orderId}`)}
                            className="px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress tracker */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center justify-between">
                      {STATUS_STEPS.map((step, idx) => (
                        <div key={step} className="flex-1 flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border ${idx <= progressIdx ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-500 border-gray-300'}`}>{idx + 1}</div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`flex-1 h-1 mx-2 rounded ${idx < progressIdx ? 'bg-amber-500' : 'bg-gray-200'}`}></div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs uppercase tracking-wide text-gray-500">
                      {STATUS_STEPS.map((s) => (<div key={s}>{s}</div>))}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="px-6 pb-4">
                    <button onClick={() => setExpanded((s) => ({ ...s, [o.orderId]: !s[o.orderId] }))} className="text-amber-700 hover:underline text-sm">
                      {expanded[o.orderId] ? 'Hide details' : 'View details'}
                    </button>
                    {expanded[o.orderId] && (
                      <div className="mt-4 space-y-3">
                        {o.items.map((it, i) => (
                          <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                            <div>
                              <div className="font-medium text-gray-900">{it.name}</div>
                              <div className="text-sm text-gray-600">Qty: {it.qty}</div>
                            </div>
                            <div className="text-gray-900 font-semibold">{toINR(it.price * it.qty)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  {o.statusHistory && o.statusHistory.length > 0 && (
                    <div className="px-6 pb-6">
                      <div className="text-sm font-semibold text-gray-800 mb-2">Status timeline</div>
                      <div className="space-y-2">
                        {o.statusHistory.map((h, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="mt-1 w-2 h-2 rounded-full bg-amber-500"></div>
                            <div>
                              <div className="text-sm text-gray-900 capitalize">{h.status}</div>
                              <div className="text-xs text-gray-500">{formatDate(h.timestamp || h.at)}</div>
                              {(h.notes || h.note) && <div className="text-xs text-gray-600 mt-0.5">{h.notes || h.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
