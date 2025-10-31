import React, { useState, useEffect } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { api } from '../../api';

// Interfaces for our data
interface InventorySummary {
  totalItems: number;
  activeItems: number;
  deletedItems: number;
  lowStockItems: number;
  outOfStockItems: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  totalValue: number;
}

interface StoreInventory {
  storeId: string;
  storeName: string;
  itemCount: number;
  totalValue: number;
}

interface SalesSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  completedOrders: number;
  cancelledOrders: number;
}

interface DailySales {
  date: string;
  amount: number;
  orders: number;
}

interface OrderStatusBreakdown {
  status: string;
  count: number;
  amount: number;
}

interface StockLevel {
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  locationName: string;
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'stock'>('inventory');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Inventory state
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([]);
  
  // Sales state
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<OrderStatusBreakdown[]>([]);
  
  // Stock state
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Fetch all report data
  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch inventory data
      await fetchInventoryData();
      
      // Fetch sales data
      await fetchSalesData();
      
      // Fetch stock data
      await fetchStockData();
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    try {
      // Get inventory summary
      const inventoryResponse = await api.get('/inventory/dashboard/stats');
      const stats = inventoryResponse.data;
      
      setInventorySummary({
        totalItems: stats.total_items || 0,
        activeItems: stats.total_items || 0, // This should be fixed in backend
        deletedItems: 0, // This should be fixed in backend
        lowStockItems: stats.low_stock_alerts || 0,
        outOfStockItems: 0 // This should be fixed in backend
      });
      
      // Get category breakdown (would need a new endpoint)
      // For now, we'll mock this data
      setCategoryBreakdown([
        { category: 'Rings', count: 10, totalValue: 500000 },
        { category: 'Necklaces', count: 6, totalValue: 750000 },
        { category: 'Earrings', count: 6, totalValue: 300000 },
        { category: 'Bracelets', count: 3, totalValue: 200000 },
      ]);
      
      // Get store inventory data
      setStoreInventory([
        { storeId: '1', storeName: 'Smart Jewel Kanjirappally', itemCount: 350, totalValue: 2500000 },
        { storeId: '2', storeName: 'Smart Jewel Kottayam', itemCount: 280, totalValue: 1800000 },
      ]);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    }
  };

  const fetchSalesData = async () => {
    try {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
      });
      
      const response = await api.get(`/api/admin/orders?${params.toString()}`);
      const orders = response.data.orders || [];
      
      // Calculate sales metrics
      const totalAmount = orders.reduce((sum: number, order: any) => sum + (order.amount || 0), 0);
      const completed = orders.filter((o: any) => o.status?.toLowerCase() === 'delivered').length;
      const cancelled = orders.filter((o: any) => o.status?.toLowerCase() === 'cancelled').length;
      
      setSalesSummary({
        totalSales: totalAmount,
        totalOrders: orders.length,
        averageOrderValue: orders.length > 0 ? totalAmount / orders.length : 0,
        completedOrders: completed,
        cancelledOrders: cancelled,
      });
      
      // Calculate daily sales
      const dailyMap: Record<string, { amount: number; count: number }> = {};
      orders.forEach((order: any) => {
        const date = order.createdAt?.split('T')[0];
        if (date) {
          if (!dailyMap[date]) {
            dailyMap[date] = { amount: 0, count: 0 };
          }
          dailyMap[date].amount += order.amount || 0;
          dailyMap[date].count += 1;
        }
      });
      
      const dailyData = Object.entries(dailyMap)
        .map(([date, data]) => ({
          date,
          amount: data.amount,
          orders: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      setDailySales(dailyData);
      
      // Calculate status breakdown
      const statusMap: Record<string, { count: number; amount: number }> = {};
      orders.forEach((order: any) => {
        const status = order.status?.toLowerCase() || 'unknown';
        if (!statusMap[status]) {
          statusMap[status] = { count: 0, amount: 0 };
        }
        statusMap[status].count += 1;
        statusMap[status].amount += order.amount || 0;
      });
      
      const statusData = Object.entries(statusMap).map(([status, data]) => ({
        status,
        count: data.count,
        amount: data.amount,
      }));
      
      setStatusBreakdown(statusData);
    } catch (err) {
      console.error('Error fetching sales data:', err);
    }
  };

  const fetchStockData = async () => {
    try {
      // Get stock levels
      const stockResponse = await api.get('/inventory/stock');
      const products = stockResponse.data.products || [];
      
      // Flatten stock levels from all products
      const allStockLevels: StockLevel[] = [];
      const lowStock: StockLevel[] = [];
      
      products.forEach((product: any) => {
        if (product.stock_levels && Array.isArray(product.stock_levels)) {
          product.stock_levels.forEach((level: any) => {
            const stockItem: StockLevel = {
              itemId: product._id,
              itemName: product.name,
              sku: product.sku,
              quantity: level.quantity || 0,
              locationName: level.location_name || 'Unknown Location'
            };
            
            allStockLevels.push(stockItem);
            
            // Add to low stock if quantity is below threshold
            if (level.quantity < 6) {
              lowStock.push(stockItem);
            }
          });
        }
      });
      
      setStockLevels(allStockLevels);
      setLowStockItems(lowStock);
    } catch (err) {
      console.error('Error fetching stock data:', err);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateFrom, dateTo]);

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

  if (loading) {
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

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50/20 p-8 shadow-lg">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Analytics</p>
            <h2 className="mt-1 text-4xl font-bold text-gray-900">Business Reports & Insights</h2>
            <p className="mt-2 text-gray-600">
              Comprehensive reports on inventory, sales, and stock levels across all locations.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Error Loading Report Data</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Date Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchReportData}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                Refresh Reports
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'inventory'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inventory Overview
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'sales'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sales Performance
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'stock'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Stock Levels
            </button>
          </nav>
        </div>

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Inventory Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {inventorySummary?.totalItems || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Active Items</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {inventorySummary?.activeItems || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Low Stock Items</h3>
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {inventorySummary?.lowStockItems || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Out of Stock</h3>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {inventorySummary?.outOfStockItems || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Deleted Items</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {inventorySummary?.deletedItems || 0}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Category</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryBreakdown.map((category, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{category.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(category.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Store Inventory */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Store Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {storeInventory.map((store, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-5">
                    <h4 className="font-semibold text-gray-900">{store.storeName}</h4>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Items</p>
                        <p className="text-2xl font-bold text-gray-900">{store.itemCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Estimated Value</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(store.totalValue)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCurrency(salesSummary?.totalSales || 0)}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {salesSummary?.totalOrders || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Avg. Order Value</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCurrency(salesSummary?.averageOrderValue || 0)}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Completed Orders</h3>
                <p className="mt-2 text-3xl font-bold text-emerald-600">
                  {salesSummary?.completedOrders || 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">Cancelled Orders</h3>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {salesSummary?.cancelledOrders || 0}
                </p>
              </div>
            </div>

            {/* Daily Sales Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
              <div className="h-80 overflow-x-auto">
                <div className="min-w-full">
                  {dailySales.length > 0 ? (
                    <div className="flex items-end h-64 gap-2 pt-4">
                      {dailySales.slice(0, 30).map((day, index) => (
                        <div key={index} className="flex flex-col items-center flex-1">
                          <div
                            className="w-full bg-amber-500 rounded-t hover:bg-amber-600 transition duration-200"
                            style={{ height: `${Math.max(5, (day.amount / Math.max(...dailySales.map(d => d.amount))) * 100)}%` }}
                            title={`${formatDate(day.date)}: ${formatCurrency(day.amount)} (${day.orders} orders)`}
                          ></div>
                          <div className="text-xs text-gray-500 mt-2 text-center">
                            {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No sales data available for the selected period
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statusBreakdown.map((status, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 capitalize">{status.status}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(status.status)}`}>
                        {status.count}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {formatCurrency(status.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stock Tab */}
        {activeTab === 'stock' && (
          <div className="space-y-6">
            {/* Low Stock Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-start">
                <svg className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-amber-800">Low Stock Alert</h3>
                  <p className="mt-1 text-amber-700">
                    {lowStockItems.length} items are running low on stock (below 6 units)
                  </p>
                </div>
              </div>
            </div>

            {/* Low Stock Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lowStockItems.length > 0 ? (
                      lowStockItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.itemName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.locationName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600 font-semibold">{item.quantity}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No low stock items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* All Stock Levels */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Stock Levels</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockLevels.length > 0 ? (
                      stockLevels.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.itemName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.locationName}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                            item.quantity < 6 ? 'text-amber-600' : 'text-gray-900'
                          }`}>
                            {item.quantity}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No stock data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};