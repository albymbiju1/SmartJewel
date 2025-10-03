import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, API_BASE_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import {
  Package,
  CreditCard,
  Truck,
  MapPin,
  User,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
  Navigation,
  Star,
  Calendar,
  Hash,
  IndianRupee,
  Receipt,
  RotateCcw
} from 'lucide-react';

// Safely create absolute image URL for backend-hosted assets
const toAbsoluteImage = (img?: string) => {
  if (!img) return '/jewel1.png';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const path = img.startsWith('/') ? img : `/${img}`;
  return `${API_BASE_URL}${path}`;
};

// Jewelry category icons mapping
const getCategoryIcon = (category: string) => {
  const categoryLower = category?.toLowerCase() || '';
  if (categoryLower.includes('ring')) return '💍';
  if (categoryLower.includes('necklace') || categoryLower.includes('chain')) return '📿';
  if (categoryLower.includes('bracelet') || categoryLower.includes('bangle')) return '🔗';
  if (categoryLower.includes('earring')) return '💎';
  if (categoryLower.includes('pendant')) return '✨';
  return '💍'; // default ring icon
};

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  image?: string;
  category?: string;
  metal?: string;
  weight?: string;
  size?: string;
}

interface StatusEntry { status: string; timestamp?: string; at?: string; notes?: string; note?: string }

interface Order {
  orderId: string;
  items: OrderItem[];
  statusHistory: StatusEntry[];
  shipping?: { address?: string; method?: string | null; trackingId?: string | null; status?: string | null };
  amount: number;
  payment?: { provider?: string; status?: string; currency?: string; amount?: number; receipt?: string; transactionId?: string };
  createdAt?: string;
  updatedAt?: string;
  customer?: { name?: string; email?: string; phone?: string; address?: string };
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

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  date?: string;
  icon: string;
}

export const OrderDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ open: boolean; reason: string; loading: boolean }>({ open: false, reason: '', loading: false });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (orderId) {
      fetchOrderDetails();
    }
  }, [isAuthenticated, navigate, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/orders/${orderId}`);
      const orderData: Order = response.data.order;
      if (orderData && (orderData.createdAt || orderData.orderId)) {
        setOrder(orderData);
      } else {
        setError('Order not found or invalid order data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const getLastStatus = (ord?: Order | null) => {
    const hist = ord?.statusHistory || [];
    return (hist[hist.length - 1]?.status || '').toLowerCase();
  };

  const isEligibleForCancellation = (ord?: Order | null) => {
    if (!ord) return false;
    const last = getLastStatus(ord);
    const allowed = ['created','pending','paid'];
    const alreadyRequested = !!ord.cancellation?.requested;
    return allowed.includes(last) && !alreadyRequested && last !== 'cancelled';
  };

  const openCancelModal = () => setCancelModal({ open: true, reason: '', loading: false });
  const closeCancelModal = () => setCancelModal({ open: false, reason: '', loading: false });
  const submitCancellation = async () => {
    if (!orderId) return;
    if (!cancelModal.reason.trim()) {
      toast.info('Please enter a reason');
      return;
    }
    try {
      setCancelModal((m) => ({ ...m, loading: true }));
      await api.post(`/api/orders/${orderId}/cancel`, { reason: cancelModal.reason.trim() });
      toast.success('Cancellation requested');
      await fetchOrderDetails();
      closeCancelModal();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Failed to request cancellation');
      setCancelModal((m) => ({ ...m, loading: false }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    const s = (status || '').toString().toLowerCase();
    switch (s) {
      case 'confirmed':
      case 'paid':
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
      case 'processing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
      case 'failed':
      case 'refunded':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'shipped':
      case 'in-transit':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getOrderTimeline = (ord: Order): TimelineStep[] => {
    const hist = ord.statusHistory || [];
    const steps = ['created','paid','shipped','delivered'];
    const last = (hist[hist.length-1]?.status || '').toLowerCase();
    return steps.map((s) => {
      const entry = hist.find(h => (h.status || '').toLowerCase() === s);
      const idx = steps.indexOf(s);
      const lastIdx = steps.indexOf(last);
      return {
        id: s,
        title: s.charAt(0).toUpperCase() + s.slice(1),
        description: s === 'paid' ? 'Payment confirmed' : s === 'shipped' ? 'Order shipped' : s === 'delivered' ? 'Order delivered' : 'Order created',
        status: lastIdx > idx ? 'completed' : lastIdx === idx ? 'current' : 'upcoming',
        date: entry?.timestamp || entry?.at || ord.createdAt,
        icon: s === 'shipped' ? '🚚' : s === 'delivered' ? '🏠' : '✅',
      } as TimelineStep;
    });
  };

  const handleDownloadInvoice = () => {
    // Implement invoice download
    console.log('Download invoice for order:', orderId);
  };

  const handleTrackOrder = () => {
    // Implement order tracking
    console.log('Track order:', orderId);
  };

  const handleRateReview = (itemId: string) => {
    // Navigate to rating page
    console.log('Rate and review item:', itemId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <p className="text-gray-600">Please log in to view order details.</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow border border-gray-200 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The order you are looking for does not exist.'}</p>
          <button 
            onClick={() => navigate('/my-orders')}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Back to My Orders
          </button>
        </div>
      </div>
    );
  }

  const timeline = getOrderTimeline(order);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-2 text-sm">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-amber-600 transition-colors font-medium"
              >
                Home
              </button>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => navigate('/my-orders')}
                className="text-gray-600 hover:text-amber-600 transition-colors font-medium"
              >
                My Orders
              </button>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-600" />
                {order.orderId}
              </span>
            </nav>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                ₹{(order.amount || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                {order.payment?.currency || 'INR'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Main Content */}
          <div className="space-y-4">
            {/* Product Details */}
            {order.items.slice(0, 1).map((item, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h1 className="text-lg font-medium text-gray-900 mb-1">{item.name}</h1>
                    <p className="text-sm text-gray-600 mb-2">Seller: SmartJewel</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-900">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                      {item.qty > 1 && (
                        <span className="text-sm text-gray-500">({item.qty} items)</span>
                      )}
                    </div>
                    {order.discount && order.discount > 0 && (
                      <div className="text-sm text-green-600 font-medium mt-1">
                        You saved ₹{order.discount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <img
                      src={toAbsoluteImage(item.image)}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      onClick={() => setPreview({ url: toAbsoluteImage(item.image), alt: item.name })}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Order Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-base font-medium text-gray-900 mb-4">Order Timeline</h2>
              <div className="space-y-3">
                {timeline.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{step.title}</div>
                      {step.date && (
                        <div className="text-xs text-gray-500">{formatDate(step.date)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Policy */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-base font-medium text-gray-900 mb-3">Return Policy</h2>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Easy returns within 30 days</li>
                <li>• Free pickup service</li>
                <li>• Refund processed instantly</li>
                <li>• Exchange available</li>
              </ul>
            </div>

            {/* Rate Your Experience */}
            {(order.statusHistory?.[order.statusHistory.length-1]?.status || '').toLowerCase() === 'delivered' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-base font-medium text-gray-900 mb-3">Rate your experience</h2>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} className="text-gray-300 hover:text-yellow-400">
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleRateReview(order.items[0]?.id)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Write a review
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-4">
            {/* Delivery Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h2 className="text-base font-medium text-gray-900">Delivery details</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{order.customer?.name}</div>
                  <div className="text-sm text-gray-600">{order.customer?.phone}</div>
                </div>
                <div className="text-sm text-gray-600 leading-relaxed">
                  {order.shipping?.address || order.customer?.address}
                </div>
              </div>
            </div>

            {/* Price Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-gray-600" />
                <h2 className="text-base font-medium text-gray-900">Price details</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Listing price</span>
                  <span className="text-gray-900">₹{(order.mrp || order.amount).toLocaleString('en-IN')}</span>
                </div>
                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">Discount</span>
                    <span className="text-green-600 font-medium">-₹{order.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-900">Final price</span>
                  <span className="text-gray-900">₹{order.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment method</span>
                  <span className="text-gray-900">{order.payment_method || 'Online'}</span>
                </div>
                <button
                  onClick={handleDownloadInvoice}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <Download className="w-4 h-4" />
                  Download invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-4xl w-full p-8 border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-serif font-bold text-slate-900">{preview.alt}</h3>
              <button
                className="p-3 hover:bg-slate-100/80 rounded-2xl transition-all duration-300 hover:scale-110"
                onClick={() => setPreview(null)}
              >
                <XCircle className="w-7 h-7 text-slate-600" />
              </button>
            </div>
            <img src={preview.url} alt={preview.alt} className="w-full h-auto rounded-2xl shadow-xl shadow-slate-900/20" />
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeCancelModal}>
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-lg w-full p-10 border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-red-100 to-rose-100 rounded-2xl border border-red-200/60">
                  <AlertCircle className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-slate-900">Request Cancellation</h3>
              </div>
              <button
                className="p-3 hover:bg-slate-100/80 rounded-2xl transition-all duration-300 hover:scale-110"
                onClick={closeCancelModal}
              >
                <XCircle className="w-7 h-7 text-slate-600" />
              </button>
            </div>
            <p className="text-slate-700 mb-8 leading-relaxed text-base">Please provide a detailed reason for cancelling your order. This will help us process your request more efficiently.</p>
            <div className="space-y-6">
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value }))}
                placeholder="Please describe the reason for cancellation..."
                className="w-full p-5 border-2 border-slate-200/60 rounded-2xl resize-none focus:border-brand-gold/60 focus:ring-0 transition-all duration-300 text-base"
                rows={4}
              />
              <div className="flex justify-end gap-4">
                <button
                  onClick={closeCancelModal}
                  className="px-8 py-4 text-slate-700 font-serif font-semibold border-2 border-slate-200/60 rounded-2xl hover:bg-slate-50/80 transition-all duration-300 shadow-lg shadow-slate-900/10 hover:shadow-xl hover:scale-[1.02]"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCancellation}
                  disabled={cancelModal.loading || !cancelModal.reason.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-serif font-semibold rounded-2xl hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-red-900/20 hover:shadow-xl hover:shadow-red-900/30 hover:scale-[1.02]"
                >
                  {cancelModal.loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
