import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  tracking_number?: string;
  estimated_delivery?: string;
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
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null);

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
      const response = await api.get(`/customers/me/orders/${orderId}`);
      const orderData = response.data.order;
      
      // Ensure the order has a valid created_at date
      if (orderData && orderData.created_at && orderData.created_at.trim() !== '') {
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

  const getOrderTimeline = (order: Order): TimelineStep[] => {
    const timeline: TimelineStep[] = [
      {
        id: 'confirmed',
        title: 'Order Confirmed',
        description: 'Your order has been confirmed and payment received',
        status: 'completed',
        date: order.created_at,
        icon: '✅'
      },
      {
        id: 'packed',
        title: 'Packed',
        description: 'Your jewelry is being carefully packed',
        status: order.status === 'shipped' || order.status === 'delivered' ? 'completed' : 
                order.status === 'processing' ? 'current' : 'upcoming',
        icon: '📦'
      },
      {
        id: 'shipped',
        title: 'Shipped',
        description: order.tracking_number ? `Shipped with tracking: ${order.tracking_number}` : 'Your order is on its way',
        status: order.status === 'delivered' ? 'completed' : 
                order.status === 'shipped' ? 'current' : 'upcoming',
        icon: '🚚'
      },
      {
        id: 'delivered',
        title: 'Delivered',
        description: order.delivery_date ? `Delivered on ${formatDate(order.delivery_date)}` : 'Your order will be delivered soon',
        status: order.status === 'delivered' ? 'completed' : 'upcoming',
        date: order.delivery_date,
        icon: '🏠'
      }
    ];

    return timeline;
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
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:text-amber-600 transition-colors">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/my-orders')} className="hover:text-amber-600 transition-colors">My Orders</button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Order #{order.order_id}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Order Details</h1>
              <p className="text-gray-600 text-lg">Order #{order.order_id}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                ₹{order.amount.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-gray-500">{order.currency}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Status</h2>
              <div className="flex items-center gap-4 mb-6">
                <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(order.payment_status)}`}>
                  💳 {order.payment_status}
                </span>
                <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(order.delivery_status)}`}>
                  🚚 {order.delivery_status}
                </span>
              </div>
              
              {/* Timeline */}
              <div className="space-y-4">
                {timeline.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      step.status === 'completed' ? 'bg-green-100 text-green-600' :
                      step.status === 'current' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {step.status === 'completed' ? '✅' : step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-medium ${
                          step.status === 'completed' ? 'text-green-900' :
                          step.status === 'current' ? 'text-amber-900' :
                          'text-gray-500'
                        }`}>
                          {step.title}
                        </h3>
                        {step.date && (
                          <span className="text-xs text-gray-500">{formatDate(step.date)}</span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'current' ? 'text-amber-700' :
                        'text-gray-500'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Items</h2>
              <div className="space-y-6">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl">
                    <div className="relative">
                      <img
                        src={toAbsoluteImage(item.image)}
                        alt={item.name}
                        className="w-24 h-24 rounded-lg object-cover border-2 border-gray-100 cursor-zoom-in hover:border-amber-200 transition-colors"
                        onClick={() => setPreview({ url: toAbsoluteImage(item.image), alt: item.name })}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/jewel1.png'; }}
                      />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs">
                        {getCategoryIcon(item.category || '')}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
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
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Quantity: <span className="font-medium">{item.qty}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            ₹{(item.price * item.qty).toLocaleString('en-IN')}
                          </div>
                          <div className="text-sm text-gray-500">
                            ₹{item.price.toLocaleString('en-IN')} each
                          </div>
                        </div>
                      </div>
                      {order.status === 'delivered' && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleRateReview(item.id)}
                            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            Rate & Review Product
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 text-gray-900 font-medium">{order.customer.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 text-gray-900">{order.customer.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 text-gray-900">{order.customer.phone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Address:</span>
                  <span className="ml-2 text-gray-900">{order.customer.address}</span>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Price Breakdown</h2>
              <div className="space-y-3 text-sm">
                {order.mrp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">MRP:</span>
                    <span className="text-gray-900">₹{order.mrp.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {order.discount && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-₹{order.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {order.tax && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">₹{order.tax.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900">Final Price:</span>
                    <span className="text-gray-900">₹{order.amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Policy */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Return Policy</h2>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• 30-day return policy for all jewelry items</p>
                <p>• Items must be in original condition</p>
                <p>• Original packaging and certificates required</p>
                <p>• Refund processed within 5-7 business days</p>
                {order.status === 'delivered' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button className="w-full px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      Request Return
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={handleDownloadInvoice}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Invoice
                </button>
                <button
                  onClick={handleTrackOrder}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Track Order
                </button>
              </div>
            </div>
          </div>
        </div>
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

export default OrderDetailsPage;
