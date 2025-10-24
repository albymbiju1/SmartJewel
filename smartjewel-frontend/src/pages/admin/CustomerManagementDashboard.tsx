import React, { useState, useEffect } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { api } from '../../api';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  status: string;
  created_at: string;
  last_login?: string;
  statistics?: {
    total_orders: number;
    total_spent: number;
    avg_order_value: number;
    last_order_date?: string;
  };
}

interface CustomerDetails extends Customer {
  purchase_history: Array<{
    order_id: string;
    date?: string; // fallback
    createdAt_ist?: string;
    items?: Array<{ name: string; quantity: number; price: number }>; // optional for count fallback
    items_count?: number;
    total_amount: number;
    status: string;
  }>;
}

interface CustomerAnalytics {
  total_customers: number;
  new_customers_this_month: number;
  customer_growth: Array<{
    month: string;
    count: number;
  }>;
  top_customers: Array<{
    id: string;
    name: string;
    total_spent: number;
    orders: number;
  }>;
  average_order_value: number;
  repeat_customer_rate: number;
}

export const CustomerManagementDashboard: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetails | null>(null);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Fetch customers
  const fetchCustomers = async (page = 1, search = '') => {
    try {
      setLoading(true);
      console.log('Fetching customers...', { page, search });
      const response = await api.get(`/customers/?page=${page}&limit=20&search=${search}`);
      console.log('Customers response:', response.data);
      setCustomers(response.data.customers);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch customer details
  const fetchCustomerDetails = async (customerId: string) => {
    try {
      console.log('Fetching customer details for:', customerId);
      const response = await api.get(`/customers/${customerId}`);
      console.log('Customer details response:', response.data);
      setSelectedCustomer(response.data);
      setShowCustomerModal(true);
    } catch (error: any) {
      console.error('Error fetching customer details:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      // Show error message instead of fallback data
      alert('Failed to load customer details. Please check your authentication and try again.');
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      console.log('Fetching analytics...');
      const response = await api.get('/customers/analytics/summary');
      console.log('Analytics response:', response.data);
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      // Set empty analytics on error
      setAnalytics(null);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchAnalytics();
  }, []);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(1, searchTerm);
  };

  const handlePageChange = (page: number) => {
    fetchCustomers(page, searchTerm);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Customer Management</h2>
            </div>
          </div>

          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">Total Customers</h3>
                <p className="text-2xl font-bold text-blue-600 mt-2">{analytics.total_customers}</p>
                <p className="text-sm text-blue-700 mt-1">Registered</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900">New This Month</h3>
                <p className="text-2xl font-bold text-green-600 mt-2">{analytics.new_customers_this_month}</p>
                <p className="text-sm text-green-700 mt-1">New Registrations</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900">Avg Order Value</h3>
                <p className="text-2xl font-bold text-purple-600 mt-2">{formatCurrency(analytics.average_order_value)}</p>
                <p className="text-sm text-purple-700 mt-1">Per Order</p>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-900">Repeat Rate</h3>
                <p className="text-2xl font-bold text-orange-600 mt-2">{Math.round(analytics.repeat_customer_rate * 100)}%</p>
                <p className="text-sm text-orange-700 mt-1">Returning Customers</p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Customer List</h3>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading customers...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{customer.full_name}</div>
                            <div className="text-sm text-gray-500">ID: {customer.id.slice(-8)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{customer.email}</div>
                          <div className="text-sm text-gray-500">{customer.phone_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {customer.statistics?.total_orders || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customer.statistics?.total_spent || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            customer.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {customer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => fetchCustomerDetails(customer.id)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Customer Details Modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Customer Details</h3>
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">Profile Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Name:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedCustomer.full_name}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Email:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedCustomer.email}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Phone:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedCustomer.phone_number}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedCustomer.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedCustomer.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Member Since:</span>
                        <span className="ml-2 text-sm text-gray-900">
                          {selectedCustomer.created_at ? formatDate(selectedCustomer.created_at) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">Purchase Statistics</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Total Orders:</span>
                        <span className="ml-2 text-sm text-gray-900">{selectedCustomer.statistics?.total_orders || 0}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Total Spent:</span>
                        <span className="ml-2 text-sm text-gray-900">
                          {formatCurrency(selectedCustomer.statistics?.total_spent || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Avg Order Value:</span>
                        <span className="ml-2 text-sm text-gray-900">
                          {formatCurrency(selectedCustomer.statistics?.avg_order_value || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Last Order:</span>
                        <span className="ml-2 text-sm text-gray-900">
                          {selectedCustomer.statistics?.last_order_date ? formatDate(selectedCustomer.statistics.last_order_date) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchase History */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Purchase History</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Items
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCustomer.purchase_history.map((order) => (
                          <tr key={order.order_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {order.order_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(order.createdAt_ist || order.date || '')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {order.items_count ?? (order.items ? order.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(order.total_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                order.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};
