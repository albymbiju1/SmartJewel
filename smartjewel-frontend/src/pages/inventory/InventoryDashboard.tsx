import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Inventory Dashboard</h2>
          <p className="text-gray-600 mb-6">Monitor and manage inventory levels, stock movements, and item tracking.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Items */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Total Items</h3>
              <p className="text-2xl font-bold text-blue-600 mt-2">1,247</p>
              <p className="text-sm text-blue-700 mt-1">Active SKUs</p>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900">Low Stock Alerts</h3>
              <p className="text-2xl font-bold text-red-600 mt-2">5</p>
              <p className="text-sm text-red-700 mt-1">Items need restocking</p>
            </div>

            {/* Today's Movements */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Today's Movements</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">23</p>
              <p className="text-sm text-green-700 mt-1">Stock transactions</p>
            </div>

            {/* Total Locations */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Storage Locations</h3>
              <p className="text-2xl font-bold text-purple-600 mt-2">12</p>
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Gold Ring - SKU: GR001</p>
                <p className="text-xs text-gray-500">Inward: 10 units to Main Store</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Inward</span>
                <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Diamond Earrings - SKU: DE015</p>
                <p className="text-xs text-gray-500">Transfer: 2 units from Main Store to Display</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Transfer</span>
                <p className="text-xs text-gray-500 mt-1">3 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Wedding Chain - SKU: WC008</p>
                <p className="text-xs text-gray-500">Outward: 1 unit sold from Display</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Outward</span>
                <p className="text-xs text-gray-500 mt-1">5 hours ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Alerts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-900">Low Stock Items</h4>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-red-700">• Gold Chains - SKU: GC021 (2 left)</p>
                <p className="text-sm text-red-700">• Silver Rings - SKU: SR045 (3 left)</p>
                <p className="text-sm text-red-700">• Diamond Pendants - SKU: DP012 (1 left)</p>
              </div>
              <button className="mt-3 text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full hover:bg-red-200">
                Create Purchase Order
              </button>
            </div>
            
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-900">Valuation Updates</h4>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-yellow-700">• 15 items need price updates</p>
                <p className="text-sm text-yellow-700">• Gold rate changed today</p>
                <p className="text-sm text-yellow-700">• BOM review required for 8 items</p>
              </div>
              <button className="mt-3 text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full hover:bg-yellow-200">
                Update Valuations
              </button>
            </div>
          </div>
        </div>

        {/* Location Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Location Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Main Store</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">456</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Display Counter</p>
              <p className="text-2xl font-bold text-green-600 mt-1">123</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Safe Vault</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">89</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Repair Shop</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">12</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
          </div>
        </div>
      </div>
    </RoleBasedNavigation>
  );
};
