import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { api } from '../../api';

interface InventoryStats {
  total_items: number;
  low_stock_alerts: number;
  today_movements: number;
  total_locations: number;
  location_summaries: Array<{
    name: string;
    item_count: number;
  }>;
  recent_movements: Array<{
    type: string;
    item_name: string;
    item_sku: string;
    location: string;
    created_at: string;
    quantity: number;
  }>;
  low_stock_items: Array<{
    name: string;
    sku: string;
    quantity: number;
  }>;
  // Added valuation updates data
  valuation_updates: {
    items_needing_price_update: number;
    gold_rate_changed_today: boolean;
    bom_review_count: number;
  };
}

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventoryStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get<InventoryStats>('/inventory/dashboard/stats');
        
        if (response.data) {
          setStats(response.data);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (error: any) {
        console.error('Failed to fetch inventory stats:', error);
        let errorMessage = 'Failed to load inventory data. Please try again later.';
        if (error.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.response?.status === 403) {
          errorMessage = 'Access denied. You may not have permission to view this data.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchInventoryStats();
  }, []);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-IN').format(num);
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

  // Get movement type color
  const getMovementTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'inward':
        return 'bg-green-100 text-green-800';
      case 'outward':
        return 'bg-red-100 text-red-800';
      case 'transfer':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Inventory Dashboard</h2>
          <p className="text-gray-600 mb-6">Monitor and manage inventory levels, stock movements, and item tracking.</p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Items */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Total Items</h3>
              {loading ? (
                <div className="h-8 bg-blue-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {stats ? formatNumber(stats.total_items) : '0'}
                </p>
              )}
              <p className="text-sm text-blue-700 mt-1">Active SKUs</p>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900">Low Stock Alerts</h3>
              {loading ? (
                <div className="h-8 bg-red-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-red-600 mt-2">
                  {stats ? formatNumber(stats.low_stock_alerts) : '0'}
                </p>
              )}
              <p className="text-sm text-red-700 mt-1">Items need restocking</p>
            </div>

            {/* Today's Movements */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Today's Movements</h3>
              {loading ? (
                <div className="h-8 bg-green-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {stats ? formatNumber(stats.today_movements) : '0'}
                </p>
              )}
              <p className="text-sm text-green-700 mt-1">Stock transactions</p>
            </div>

            {/* Total Locations */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Store Locations</h3>
              {loading ? (
                <div className="h-8 bg-purple-200 rounded animate-pulse mt-2"></div>
              ) : (
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {stats ? formatNumber(stats.total_locations) : '0'}
                </p>
              )}
              <p className="text-sm text-purple-700 mt-1">Active locations</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => navigate('/inventory/items')}
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-blue-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-medium">Add Item</span>
            </button>
            
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-green-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <span className="text-sm font-medium">Stock Movement</span>
            </button>

            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-purple-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Scan RFID/Barcode</span>
            </button>

            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="text-orange-600 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Generate Report</span>
            </button>
          </div>
        </div>

        {/* Recent Stock Movements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Movements</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-200 rounded mb-1 w-16"></div>
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : stats && stats.recent_movements.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_movements.map((movement, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {movement.item_name} - SKU: {movement.item_sku}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)}: {movement.quantity} units to {movement.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${getMovementTypeColor(movement.type)}`}>
                      {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(movement.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No recent stock movements
            </div>
          )}
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Alerts</h3>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 bg-gray-50 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
                <div className="space-y-2 mt-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded mt-3 w-1/3"></div>
              </div>
              <div className="p-4 border border-gray-200 bg-gray-50 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
                <div className="space-y-2 mt-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded mt-3 w-1/3"></div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-900">Low Stock Items</h4>
                <div className="mt-2 space-y-1">
                  {stats && stats.low_stock_items.length > 0 ? (
                    stats.low_stock_items.map((item, index) => (
                      <p key={index} className="text-sm text-red-700">
                        • {item.name} - SKU: {item.sku} ({item.quantity} left)
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-red-700">No low stock items</p>
                  )}
                </div>
                <button className="mt-3 text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full hover:bg-red-200">
                  Create Purchase Order
                </button>
              </div>
              
              <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900">Valuation Updates</h4>
                <div className="mt-2 space-y-1">
                  {stats && stats.valuation_updates ? (
                    <>
                      <p className="text-sm text-yellow-700">
                        • {stats.valuation_updates.items_needing_price_update} items need price updates
                      </p>
                      <p className="text-sm text-yellow-700">
                        • {stats.valuation_updates.gold_rate_changed_today ? 'Gold rate changed today' : 'Gold rate unchanged'}
                      </p>
                      <p className="text-sm text-yellow-700">
                        • BOM review required for {stats.valuation_updates.bom_review_count} items
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-yellow-700">• Loading valuation data...</p>
                      <p className="text-sm text-yellow-700">• Loading gold rate status...</p>
                      <p className="text-sm text-yellow-700">• Loading BOM review status...</p>
                    </>
                  )}
                </div>
                <button className="mt-3 text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full hover:bg-yellow-200">
                  Update Valuations
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Location Summary */}
      </div>
    </RoleBasedNavigation>
  );
};