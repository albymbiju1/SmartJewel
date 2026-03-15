import React, { useEffect, useState } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { api } from '../../api';

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

interface StockLevel {
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  locationName: string;
}

export const InventoryReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([]);

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const inventoryResponse = await api.get('/inventory/dashboard/stats');
      const stats = inventoryResponse.data;

      setInventorySummary({
        totalItems: stats.total_items || 0,
        activeItems: stats.total_items || 0,
        deletedItems: 0,
        lowStockItems: stats.low_stock_alerts || 0,
        outOfStockItems: 0,
      });

      setCategoryBreakdown([
        { category: 'Rings', count: 10, totalValue: 500000 },
        { category: 'Necklaces', count: 6, totalValue: 750000 },
        { category: 'Earrings', count: 6, totalValue: 300000 },
        { category: 'Bracelets', count: 3, totalValue: 200000 },
      ]);

      setStoreInventory([
        { storeId: '1', storeName: 'Smart Jewel Kanjirappally', itemCount: 350, totalValue: 2500000 },
        { storeId: '2', storeName: 'Smart Jewel Kottayam', itemCount: 280, totalValue: 1800000 },
      ]);
    } catch (err: any) {
      console.error('Error fetching inventory report data:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch inventory report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockData = async () => {
    try {
      const stockResponse = await api.get('/inventory/stock');
      const products = stockResponse.data.products || [];

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
              locationName: level.location_name || 'Unknown Location',
            };

            allStockLevels.push(stockItem);

            if (level.quantity < 6) {
              lowStock.push(stockItem);
            }
          });
        }
      });

      setStockLevels(allStockLevels);
      setLowStockItems(lowStock);
    } catch (err) {
      console.error('Error fetching inventory stock report data:', err);
    }
  };

  useEffect(() => {
    fetchInventoryData();
    fetchStockData();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

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
        <div className="rounded-3xl border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50/20 p-8 shadow-lg">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Inventory Analytics</p>
            <h2 className="mt-1 text-4xl font-bold text-gray-900">Inventory Reports & Overview</h2>
            <p className="mt-2 text-gray-600">
              Overview of items, locations, and stock levels across all stores for inventory staff.
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
                <h3 className="text-lg font-semibold text-red-900">Error Loading Inventory Report Data</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
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
      </div>
    </RoleBasedNavigation>
  );
};

