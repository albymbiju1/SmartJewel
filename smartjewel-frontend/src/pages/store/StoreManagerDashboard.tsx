import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

interface InventoryStats {
  total_items: number;
  low_stock_alerts: number;
  today_movements: number;
  total_locations: number;
}

interface OrderSummary {
  totalOrders: number;
  delivered: number;
  paid: number;
  pending: number;
}

interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: string;
  created_at: string;
}

export const StoreManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch inventory stats
        const inventoryResponse = await api.get<InventoryStats>('/inventory/dashboard/stats');
        setInventoryStats(inventoryResponse.data);
        
        // Fetch order summary
        const ordersResponse = await api.get<OrderSummary>('/api/store-manager/orders/summary');
        setOrderSummary(ordersResponse.data);
        
        // Fetch appointments
        const appointmentsResponse = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
        setAppointments(appointmentsResponse.data.appointments);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApproveAppointment = async (appointmentId: string) => {
    try {
      await api.patch(`/api/store-manager/appointments/${appointmentId}/approve`, { notes: 'Approved by store manager' });
      // Refresh the appointments list
      const response = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
      setAppointments(response.data.appointments);
    } catch (err) {
      console.error('Failed to approve appointment:', err);
    }
  };

  const handleRejectAppointment = async (appointmentId: string) => {
    try {
      await api.patch(`/api/store-manager/appointments/${appointmentId}/reject`, { notes: 'Rejected by store manager' });
      // Refresh the appointments list
      const response = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
      setAppointments(response.data.appointments);
    } catch (err) {
      console.error('Failed to reject appointment:', err);
    }
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RoleBasedNavigation>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Store Manager Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your store's inventory, orders, and appointments</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Inventory Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  {loading ? (
                    <div className="h-6 bg-gray-200 rounded animate-pulse mt-1 w-16"></div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStats ? formatNumber(inventoryStats.total_items) : '0'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
                  {loading ? (
                    <div className="h-6 bg-gray-200 rounded animate-pulse mt-1 w-16"></div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStats ? formatNumber(inventoryStats.low_stock_alerts) : '0'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today's Movements</p>
                  {loading ? (
                    <div className="h-6 bg-gray-200 rounded animate-pulse mt-1 w-16"></div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStats ? formatNumber(inventoryStats.today_movements) : '0'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Store Locations</p>
                  {loading ? (
                    <div className="h-6 bg-gray-200 rounded animate-pulse mt-1 w-16"></div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {inventoryStats ? formatNumber(inventoryStats.total_locations) : '0'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Orders Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
                  <button 
                    onClick={() => navigate('/store/orders')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All Orders
                  </button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-8"></div>
                      </div>
                    ))}
                  </div>
                ) : orderSummary ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total Orders</span>
                      <span className="font-semibold">{formatNumber(orderSummary.totalOrders)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Delivered</span>
                      <span className="font-semibold text-green-600">{formatNumber(orderSummary.delivered)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Paid</span>
                      <span className="font-semibold text-blue-600">{formatNumber(orderSummary.paid)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-semibold text-yellow-600">{formatNumber(orderSummary.pending)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No order data available</p>
                )}
              </div>
            </div>

            {/* Appointments Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Appointment Requests</h2>
                  <button 
                    onClick={() => navigate('/store/appointments')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All
                  </button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((appointment) => (
                      <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{appointment.customer_name}</h3>
                            <p className="text-sm text-gray-600">{appointment.customer_email}</p>
                            <p className="text-sm text-gray-600">{appointment.customer_phone}</p>
                            <p className="text-sm mt-1">
                              <span className="font-medium">Date:</span> {appointment.preferred_date} at {appointment.preferred_time}
                            </p>
                            {appointment.notes && (
                              <p className="text-sm mt-1 text-gray-600">
                                <span className="font-medium">Notes:</span> {appointment.notes}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(appointment.status)}`}>
                            {appointment.status}
                          </span>
                        </div>
                        {appointment.status === 'pending' && (
                          <div className="flex space-x-2 mt-3">
                            <button
                              onClick={() => handleApproveAppointment(appointment.id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectAppointment(appointment.id)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No appointment requests</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => navigate('/store/products')}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-blue-100 rounded-lg mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">View Products</span>
                </button>
                
                <button 
                  onClick={() => navigate('/store/inventory')}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-green-100 rounded-lg mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">View Inventory</span>
                </button>
                
                <button 
                  onClick={() => navigate('/store/orders')}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-purple-100 rounded-lg mb-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Manage Orders</span>
                </button>
                
                <button 
                  onClick={() => navigate('/store/appointments')}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-yellow-100 rounded-lg mb-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Appointments</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleBasedNavigation>
  );
};

export default StoreManagerDashboard;