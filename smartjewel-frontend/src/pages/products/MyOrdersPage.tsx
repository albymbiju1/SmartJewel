import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, Package } from 'lucide-react';
import { api, API_BASE_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

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

interface Order {
  _id: string;
  order_id: string;
  status: string;
  payment_status: string;
  delivery_status: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  delivery_date?: string;
  payment_method?: string;
  mrp?: number;
  discount?: number;
  tax?: number;
}

export const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchOrders();
  }, [isAuthenticated, navigate]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/customers/me/orders');
      const allOrders = response.data.orders || [];
      
      // Filter out orders without proper created_at date and remove duplicates
      const validOrders = allOrders.filter((order: Order) => {
        return order.created_at && order.created_at.trim() !== '';
      });
      
      // Remove duplicates based on order_id, keeping the one with the most recent created_at
      const uniqueOrders = validOrders.reduce((acc: Order[], current: Order) => {
        const existingIndex = acc.findIndex(order => order.order_id === current.order_id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          // Keep the order with the more recent created_at date
          const existing = acc[existingIndex];
          if (new Date(current.created_at) > new Date(existing.created_at)) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      }, []);
      
      setOrders(uniqueOrders);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch orders');
    } finally {
      setLoading(false);
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
      case 'failed':
      case 'refunded':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'shipped':
      case 'in-transit':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    const s = (status || '').toString().toLowerCase();
    switch (s) {
      case 'delivered':
        return '✅';
      case 'shipped':
      case 'in-transit':
        return '🚚';
      case 'processing':
        return '⏳';
      case 'cancelled':
        return '❌';
      case 'refunded':
        return '💰';
      default:
        return '📦';
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    navigate(`/order-details/${orderId}`);
  };

  const handleTrackOrder = (orderId: string) => {
    // Navigate to tracking page or show tracking modal
    console.log('Track order:', orderId);
  };

  const handleViewInvoice = (orderId: string) => {
    // Download or view invoice
    console.log('View invoice:', orderId);
  };

  const handleRateReview = (orderId: string, itemId: string) => {
    // Navigate to rating page
    console.log('Rate and review:', orderId, itemId);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <p className="text-gray-600">Please log in to view your orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-medium text-gray-900">My Orders</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-600 mb-6">Start shopping to see your orders here</p>
            <button
              onClick={() => navigate('/products/all')}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Product Image */}
                    <img
                      src={toAbsoluteImage(order.items[0]?.image)}
                      alt={order.items[0]?.name}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/jewel1.png'; }}
                    />

                    {/* Order Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-base font-medium text-gray-900 truncate">{order.items[0]?.name}</h3>
                          <p className="text-sm text-gray-600">Order #{order.order_id}</p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-gray-900">₹{order.amount.toLocaleString('en-IN')}</div>
                          <div className="text-xs text-gray-500">{order.currency}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </div>
                          <span className="text-sm text-gray-600">{formatDate(order.created_at)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewOrderDetails(order._id)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View details
                          </button>
                          {order.status.toLowerCase() === 'shipped' && (
                            <button
                              onClick={() => handleTrackOrder(order._id)}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Track order
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Items Indicator */}
                {order.items.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-600">+{order.items.length - 1} more item{order.items.length > 2 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
};

export default MyOrdersPage;