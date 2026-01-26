import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { GoldPriceDisplay } from '../../components/GoldPriceDisplay';
import { PriceUpdateManager } from '../../components/PriceUpdateManager';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardStats {
  total_sales: number;
  total_inventory_items: number;
  total_customers: number;
  total_staff: number;
}

interface Activity {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        console.log('Fetching dashboard stats...');
        console.log('Current user:', user);
        console.log('Auth token:', api.defaults.headers.common?.Authorization);

        setLoading(true);
        setError(null);

        // Add a small delay to ensure auth token is set
        await new Promise(resolve => setTimeout(resolve, 100));

        // Log the current API configuration
        console.log('API Base URL:', api.defaults.baseURL);
        console.log('API Headers:', api.defaults.headers);

        // Use the correct endpoint with /core prefix
        const response = await api.get<DashboardStats>('/core/admin/dashboard/stats');
        console.log('Dashboard stats response:', response.data);

        // Validate response data
        if (response.data) {
          setStats(response.data);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (error: any) {
        console.error('Failed to fetch dashboard stats:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);

        // More detailed error message
        let errorMessage = 'Failed to load dashboard data. Please try again later.';
        if (error.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.response?.status === 403) {
          errorMessage = 'Access denied. You may not have permission to view this data.';
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    const fetchRecentActivity = async () => {
      try {
        console.log('Fetching recent activity...');
        setActivityLoading(true);
        setActivityError(null);

        // Use the correct endpoint with /core prefix
        const response = await api.get<Activity[]>('/core/admin/dashboard/recent-activity');
        console.log('Recent activity response:', response.data);

        // Validate response data
        if (response.data) {
          setActivities(response.data);
        } else {
          setActivities([]);
        }
      } catch (error: any) {
        console.error('Failed to fetch recent activity:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);

        // More detailed error message
        let errorMessage = 'Failed to load recent activity. Please try again later.';
        if (error.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.response?.status === 403) {
          errorMessage = 'Access denied. You may not have permission to view this data.';
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }

        setActivityError(errorMessage);
        setActivities([]);
      } finally {
        setActivityLoading(false);
      }
    };

    // Only fetch stats if user is authenticated
    if (user) {
      fetchDashboardStats();
      fetchRecentActivity();
    } else {
      // If user is not authenticated, show error
      setError('You must be logged in to view this dashboard.');
      setLoading(false);
    }
  }, [user]);

  // Format currency in Indian Rupees
  const formatCurrency = (amount: number): string => {
    // Handle case where amount might be a string
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '₹0';

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    // Handle case where num might be a string
    const numValue = typeof num === 'string' ? parseInt(num, 10) : num;
    if (isNaN(numValue)) return '0';

    return new Intl.NumberFormat('en-IN').format(numValue);
  };

  // Format timestamp to relative time
  const formatTimeAgo = (timestamp: string): string => {
    if (!timestamp) return 'Unknown time';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)} days ago`;
    } else {
      return date.toLocaleDateString('en-IN');
    }
  };

  // Get icon color based on activity type
  const getIconColor = (type: string): string => {
    switch (type) {
      case 'order':
        return 'bg-blue-500';
      case 'inventory':
        return 'bg-green-500';
      case 'customer':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Admin Dashboard</h2>
          <p className="text-gray-600 mb-6">Welcome to the SmartJewel admin panel. Manage your entire jewelry business from here.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sales Overview */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Total Sales</h3>
              {loading ? (
                <div className="h-8 bg-blue-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {stats ? formatCurrency(stats.total_sales) : '₹0'}
                </p>
              )}
              <p className="text-sm text-blue-700 mt-1">All Time</p>
            </div>

            {/* Inventory Status */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Items in Stock</h3>
              {loading ? (
                <div className="h-8 bg-green-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {stats ? formatNumber(stats.total_inventory_items) : '0'}
                </p>
              )}
              <p className="text-sm text-green-700 mt-1">Active Items</p>
            </div>

            {/* Customers */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Total Customers</h3>
              {loading ? (
                <div className="h-8 bg-purple-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {stats ? formatNumber(stats.total_customers) : '0'}
                </p>
              )}
              <p className="text-sm text-purple-700 mt-1">Registered</p>
            </div>

            {/* Staff */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900">Active Staff</h3>
              {loading ? (
                <div className="h-8 bg-orange-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {stats ? formatNumber(stats.total_staff) : '0'}
                </p>
              )}
              <p className="text-sm text-orange-700 mt-1">Team Members</p>
            </div>
          </div>
        </div>

        {/* Gold Prices */}
        <GoldPriceDisplay />

        {/* Price Update Manager */}
        <PriceUpdateManager />

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/admin/orders')}
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-amber-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                </svg>
              </div>
              <span className="text-sm font-medium">View Orders</span>
            </button>
            <button
              onClick={() => navigate('/inventory/items')}
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-blue-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-medium">Add New Item</span>
            </button>

            <button
              onClick={() => navigate('/admin/analytics')}
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-green-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium">View Analytics</span>
            </button>

            <button
              onClick={() => navigate('/admin/staff')}
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-purple-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Manage Staff</span>
            </button>

          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {activityError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{activityError}</p>
            </div>
          )}
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg animate-pulse">
                  <div className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`flex-shrink-0 w-2 h-2 ${getIconColor(activity.type)} rounded-full`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.description}</p>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No recent activity found
            </div>
          )}
        </div>
      </div>
    </RoleBasedNavigation>
  );
};