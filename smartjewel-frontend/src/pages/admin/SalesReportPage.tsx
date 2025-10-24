import React, { useState, useEffect } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { api } from '../../api';

interface Order {
  orderId: string;
  amount: number;
  createdAt: string;
  status?: string;
  customer?: { name?: string; email?: string };
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface SalesMetrics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
}

interface DailySalesData {
  date: string;
  amount: number;
  orders: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  amount: number;
}

export const SalesReportPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);

  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
        from: dateFrom,
        to: dateTo,
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await api.get(`/api/admin/orders?${params.toString()}`);
      const ordersData = response.data.orders || [];

      setOrders(ordersData);

      const calculatedMetrics = calculateMetrics(ordersData);
      setMetrics(calculatedMetrics);

      const dailyData = calculateDailySales(ordersData);
      setDailySales(dailyData);

      const statusData = calculateStatusBreakdown(ordersData);
      setStatusBreakdown(statusData);
    } catch (error: any) {
      console.error('Error fetching sales data:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to fetch sales data. Please ensure the backend server is running.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (ordersData: Order[]): SalesMetrics => {
    const totalAmount = ordersData.reduce((sum, order) => sum + (order.amount || 0), 0);
    const completed = ordersData.filter((o) => o.status?.toLowerCase() === 'delivered').length;
    const cancelled = ordersData.filter((o) => o.status?.toLowerCase() === 'cancelled').length;
    const pending = ordersData.filter((o) => 
      ['created', 'paid', 'shipped'].includes(o.status?.toLowerCase() || '')
    ).length;

    return {
      totalSales: totalAmount,
      totalOrders: ordersData.length,
      averageOrderValue: ordersData.length > 0 ? totalAmount / ordersData.length : 0,
      completedOrders: completed,
      cancelledOrders: cancelled,
      pendingOrders: pending,
    };
  };

  const calculateDailySales = (ordersData: Order[]): DailySalesData[] => {
    const dailyMap: Record<string, { amount: number; count: number }> = {};

    ordersData.forEach((order) => {
      const date = order.createdAt?.split('T')[0];
      if (date) {
        if (!dailyMap[date]) {
          dailyMap[date] = { amount: 0, count: 0 };
        }
        dailyMap[date].amount += order.amount || 0;
        dailyMap[date].count += 1;
      }
    });

    return Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        orders: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const calculateStatusBreakdown = (ordersData: Order[]): StatusBreakdown[] => {
    const statusMap: Record<string, { count: number; amount: number }> = {};

    ordersData.forEach((order) => {
      const status = order.status?.toLowerCase() || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, amount: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].amount += order.amount || 0;
    });

    return Object.entries(statusMap).map(([status, data]) => ({
      status,
      count: data.count,
      amount: data.amount,
    }));
  };

  useEffect(() => {
    fetchSalesData();
  }, [dateFrom, dateTo, statusFilter, page]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'paid':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading && orders.length === 0) {
    return (
      <RoleBasedNavigation>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <div className="h-12 w-12 rounded-full border-4 border-amber-200 border-t-amber-600"></div>
          </div>
        </div>
      </RoleBasedNavigation>
    );
  }

  if (error) {
    return (
      <RoleBasedNavigation>
        <div className="space-y-8">
          <div className="rounded-3xl border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50/20 p-8 shadow-lg">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Analytics</p>
              <h2 className="mt-1 text-4xl font-bold text-gray-900">Sales Report & Overview</h2>
            </div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Error Loading Sales Data</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => fetchSalesData()}
                  className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </RoleBasedNavigation>
    );
  }

  return (
    <RoleBasedNavigation>
      <div className="space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50/20 p-8 shadow-lg">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Analytics</p>
            <h2 className="mt-1 text-4xl font-bold text-gray-900">Sales Report & Overview</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Track your sales performance, revenue trends, and order metrics with real-time insights.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                <option value="">All Statuses</option>
                <option value="created">Created</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fetchSalesData()}
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-amber-600 hover:to-amber-700 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Total Sales */}
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700">Total Sales Revenue</p>
                  <p className="mt-3 text-3xl font-bold text-amber-900">{formatCurrency(metrics.totalSales)}</p>
                  <p className="mt-2 text-xs text-amber-600">{metrics.totalOrders} orders</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Average Order Value</p>
                  <p className="mt-3 text-3xl font-bold text-blue-900">{formatCurrency(metrics.averageOrderValue)}</p>
                  <p className="mt-2 text-xs text-blue-600">per order</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Completed Orders */}
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Completed Orders</p>
                  <p className="mt-3 text-3xl font-bold text-emerald-900">{metrics.completedOrders}</p>
                  <p className="mt-2 text-xs text-emerald-600">successfully delivered</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pending Orders */}
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-purple-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Pending Orders</p>
                  <p className="mt-3 text-3xl font-bold text-purple-900">{metrics.pendingOrders}</p>
                  <p className="mt-2 text-xs text-purple-600">awaiting fulfillment</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Cancelled Orders */}
            <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Cancelled Orders</p>
                  <p className="mt-3 text-3xl font-bold text-red-900">{metrics.cancelledOrders}</p>
                  <p className="mt-2 text-xs text-red-600">total cancellations</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-teal-100/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-700">Success Rate</p>
                  <p className="mt-3 text-3xl font-bold text-teal-900">
                    {metrics.totalOrders > 0 ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100) : 0}%
                  </p>
                  <p className="mt-2 text-xs text-teal-600">completed orders</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Breakdown Chart */}
        {statusBreakdown.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Status Breakdown</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              {statusBreakdown.map((item) => (
                <div key={item.status} className={`rounded-xl border p-4 ${getStatusColor(item.status)}`}>
                  <p className="text-sm font-medium capitalize">{item.status}</p>
                  <p className="mt-2 text-2xl font-bold">{item.count}</p>
                  <p className="mt-1 text-xs opacity-75">{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Sales Trend */}
        {dailySales.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Sales Trend</h3>
            <div className="space-y-3">
              {dailySales.slice(-14).map((item) => {
                const maxAmount = Math.max(...dailySales.map((d) => d.amount));
                const barWidth = (item.amount / maxAmount) * 100;
                return (
                  <div key={item.date} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-gray-600">{formatDate(item.date)}</div>
                    <div className="flex-1">
                      <div className="h-8 rounded-lg bg-gradient-to-r from-amber-200 to-amber-400 flex items-center px-3 text-xs font-semibold text-amber-900" style={{ width: `${Math.max(barWidth, 5)}%` }}>
                        {item.orders} order{item.orders > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Orders Table */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.slice(0, 10).map((order) => (
                  <tr key={order.orderId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderId.substring(0, 8)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.customer?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(order.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status || '')}`}>
                        {order.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        {orders.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Report Summary</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-gray-600">Total Orders Analyzed</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date Range</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {formatDate(dateFrom)} - {formatDate(dateTo)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Daily Sales</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCurrency(
                    dailySales.length > 0
                      ? dailySales.reduce((sum, d) => sum + d.amount, 0) / dailySales.length
                      : 0
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};
