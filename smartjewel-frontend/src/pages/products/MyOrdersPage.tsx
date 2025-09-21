import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-amber-600 transition-colors">Home</button>
          <span>/</span>
          <span className="text-gray-900 font-medium">My Orders</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 py-12">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">My Orders</h1>
          <p className="text-gray-600 text-lg">Track and manage your jewelry orders</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 text-amber-600 mb-6">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">No orders yet</h2>
            <p className="text-gray-600 mb-8 text-lg">Start shopping to see your orders here.</p>
            <button 
              onClick={() => navigate('/products/all')} 
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Start Shopping
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                {/* Order Header */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">Order #{order.order_id}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)} {order.status}
                          </span>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(order.payment_status)}`}>
                            💳 {order.payment_status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span>📅 Placed on {formatDate(order.created_at)}</span>
                        {order.delivery_date && (
                          <span>🚚 Delivered on {formatDate(order.delivery_date)}</span>
                        )}
                        {order.payment_method && (
                          <span>💳 {order.payment_method}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ₹{order.amount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-gray-500">{order.currency}</div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-4">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                        {/* Product Image */}
                        <div className="relative">
                          <img
                            src={toAbsoluteImage(item.image)}
                            alt={item.name}
                            className="w-20 h-20 rounded-lg object-cover border-2 border-gray-100 cursor-zoom-in hover:border-amber-200 transition-colors"
                            onClick={() => setPreview({ url: toAbsoluteImage(item.image), alt: item.name })}
                            onError={(e) => { (e.target as HTMLImageElement).src = '/jewel1.png'; }}
                          />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs">
                            {getCategoryIcon(item.category || '')}
                          </div>
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                            {item.category && (
                              <div>
                                <span className="font-medium">Category:</span>
                                <span className="ml-1">{item.category}</span>
                              </div>
                            )}
                            {item.metal && (
                              <div>
                                <span className="font-medium">Metal:</span>
                                <span className="ml-1">{item.metal}</span>
                              </div>
                            )}
                            {item.weight && (
                              <div>
                                <span className="font-medium">Weight:</span>
                                <span className="ml-1">{item.weight}</span>
                              </div>
                            )}
                            {item.size && (
                              <div>
                                <span className="font-medium">Size:</span>
                                <span className="ml-1">{item.size}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600">Quantity: <span className="font-medium">{item.qty}</span></span>
                            <span className="text-gray-600">Price: <span className="font-bold text-gray-900">₹{(item.price * item.qty).toLocaleString('en-IN')}</span></span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleViewOrderDetails(order._id)}
                            className="px-4 py-2 text-sm font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                          >
                            View Details
                          </button>
                          {order.status === 'delivered' && (
                            <button
                              onClick={() => handleRateReview(order._id, item.id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              Rate & Review
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Actions */}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleTrackOrder(order._id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Track Order
                        </button>
                        <button
                          onClick={() => handleViewInvoice(order._id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Invoice
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Total Amount</div>
                        <div className="text-xl font-bold text-gray-900">
                          ₹{order.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{preview.alt}</h3>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setPreview(null)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <img src={preview.url} alt={preview.alt} className="w-full h-auto rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;