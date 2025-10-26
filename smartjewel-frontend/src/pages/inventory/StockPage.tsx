import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

interface StockItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  metal: string;
  purity: string;
  status: string;
  quantity: number;
  weight?: number;
  unit?: string;
  location_id?: string;
  low_stock_threshold?: number;
}

interface StockHistory {
  _id: string;
  sku: string;
  productName: string;
  changedBy: string;
  changeType: 'Added' | 'Removed' | 'Updated';
  quantityBefore: number;
  quantityAfter: number;
  timestamp: string;
  formattedTimestamp: string;
}

interface PaginationInfo {
  current_page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export const StockPage: React.FC = () => {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState<{ [key: string]: number }>({});
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [historyPagination, setHistoryPagination] = useState<PaginationInfo | null>(null);
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState('All');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  // Check permissions
  const isAdmin = !!(user?.roles?.includes('admin') || user?.role?.role_name?.toLowerCase() === 'admin');
  const canManageStock = isAdmin || !!(
    user?.perms?.includes('inventory.update') || 
    user?.permissions?.includes('inventory.update') ||
    user?.perms?.includes('inventory.modify') || 
    user?.permissions?.includes('inventory.modify')
  );

  const loadStockData = async () => {
    try {
      setIsLoading(true);
      // Get all products with stock information
      const response = await api.get('/inventory/stock');
      const products = response.data.products || [];

      // Transform products to match StockItem interface
      const stockItems = products.map((product: any) => ({
        ...product,
        quantity: product.quantity || 0,
        unit: 'pcs',
        low_stock_threshold: 5
      }));

      // Sort items: Low stock first, then by quantity ascending
      const sortedItems = stockItems.sort((a: StockItem, b: StockItem) => {
        const aIsLowStock = a.quantity <= (a.low_stock_threshold || 5);
        const bIsLowStock = b.quantity <= (b.low_stock_threshold || 5);
        
        // If one is low stock and the other isn't, low stock comes first
        if (aIsLowStock && !bIsLowStock) return -1;
        if (!aIsLowStock && bIsLowStock) return 1;
        
        // If both are low stock or both are not, sort by quantity (ascending)
        return a.quantity - b.quantity;
      });

      setStockItems(sortedItems);
    } catch (error) {
      console.error('Failed to load stock data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, []);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setEditingQuantity(prev => ({
      ...prev,
      [itemId]: Math.max(0, newQuantity)
    }));
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    const currentItem = stockItems.find(item => item._id === itemId);
    if (!currentItem) return;

    const currentQuantity = editingQuantity[itemId] ?? currentItem.quantity;
    const newQuantity = Math.max(0, currentQuantity + delta);
    handleQuantityChange(itemId, newQuantity);
  };

  const saveStockQuantity = async (itemId: string) => {
    const newQuantity = editingQuantity[itemId];
    if (newQuantity === undefined) return;

    const currentItem = stockItems.find(item => item._id === itemId);
    if (!currentItem || newQuantity === currentItem.quantity) {
      // No change, just clear editing state
      setEditingQuantity(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      return;
    }

    setSavingItems(prev => new Set([...prev, itemId]));

    try {
      await api.put(`/inventory/stock/${currentItem.sku}`, {
        quantity: newQuantity
      });

      // Update local state
      setStockItems(prev => prev.map(item => 
        item._id === itemId ? { ...item, quantity: newQuantity } : item
      ));

      // Clear editing state
      setEditingQuantity(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });

      // Refresh the stock table
      loadStockData();

    } catch (error) {
      console.error('Failed to update stock:', error);
      alert('Failed to update stock quantity. Please try again.');
    } finally {
      setSavingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const cancelEdit = (itemId: string) => {
    setEditingQuantity(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

  const loadStockHistory = async (page: number = 1, changeType: string = 'All') => {
    try {
      setLoadingHistory(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '10',
        changeType: changeType
      });
      
      const response = await api.get(`/inventory/stock/history?${params}`);
      setStockHistory(response.data.history || []);
      setHistoryPagination(response.data.pagination);
      setCurrentHistoryPage(page);
      setHistoryFilter(changeType);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to load stock history:', error);
      alert('Failed to load stock history. Please try again.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHistoryPageChange = (newPage: number) => {
    loadStockHistory(newPage, historyFilter);
  };

  const handleHistoryFilterChange = (newFilter: string) => {
    setCurrentHistoryPage(1);
    loadStockHistory(1, newFilter);
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'Added':
        return 'bg-green-100 text-green-800';
      case 'Removed':
        return 'bg-red-100 text-red-800';
      case 'Updated':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter and pagination
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [stockItems, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const isLowStock = (item: StockItem) => {
    return item.quantity <= (item.low_stock_threshold || 5);
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex px-2 py-1 text-xs font-semibold rounded-full";
    if (status === 'active') {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    return `${baseClasses} bg-red-100 text-red-800`;
  };

  return (
    <RoleBasedNavigation sidebarCollapsed={sidebarCollapsed}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
              <p className="text-gray-600 mt-1">
                Manage inventory stock levels • {stockItems.length} total items
                {searchTerm && (
                  <span className="text-blue-600"> • {filteredItems.length} filtered</span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Stats */}
              <div className="text-sm text-gray-600">
                Total Items: <span className="font-semibold">{stockItems.length}</span>
              </div>
              <div className="text-sm text-red-600">
                Low Stock: <span className="font-semibold">{stockItems.filter(isLowStock).length}</span>
              </div>
              {/* Sidebar Toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 inline-flex items-center space-x-2 text-gray-700"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sidebarCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  )}
                </svg>
                <span className="text-sm">{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search by SKU, name, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Stock Management Table */}
        <div className="bg-white rounded-lg shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading stock data...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Product Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Quantity</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentItems.map(item => {
                      const isEditing = editingQuantity.hasOwnProperty(item._id);
                      const currentQuantity = isEditing ? editingQuantity[item._id] : item.quantity;
                      const isSaving = savingItems.has(item._id);
                      const lowStock = isLowStock(item);

                      return (
                        <tr key={item._id} className={`hover:bg-gray-50 transition-colors ${lowStock ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {item.sku}
                            {lowStock && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Low Stock
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{item.category}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <div className="flex items-center space-x-2">
                              {canManageStock && isEditing ? (
                                <>
                                  <button
                                    onClick={() => adjustQuantity(item._id, -1)}
                                    className="w-7 h-7 bg-red-100 text-red-600 rounded-full hover:bg-red-200 flex items-center justify-center transition-colors"
                                    disabled={isSaving}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentQuantity}
                                    onChange={(e) => handleQuantityChange(item._id, parseInt(e.target.value) || 0)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500"
                                    disabled={isSaving}
                                  />
                                  <button
                                    onClick={() => adjustQuantity(item._id, 1)}
                                    className="w-7 h-7 bg-green-100 text-green-600 rounded-full hover:bg-green-200 flex items-center justify-center transition-colors"
                                    disabled={isSaving}
                                  >
                                    +
                                  </button>
                                  <span className="text-xs text-gray-500">{item.unit}</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium">{currentQuantity}</span>
                                  <span className="text-xs text-gray-500">{item.unit}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={getStatusBadge(item.status)}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end space-x-2">
                              {canManageStock && (
                                <>
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveStockQuantity(item._id)}
                                        disabled={isSaving}
                                        className="text-green-600 hover:text-green-900 p-1 disabled:opacity-50 transition-colors"
                                        title="Save"
                                      >
                                        {isSaving ? (
                                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => cancelEdit(item._id)}
                                        disabled={isSaving}
                                        className="text-gray-600 hover:text-gray-900 p-1 disabled:opacity-50 transition-colors"
                                        title="Cancel"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleQuantityChange(item._id, item.quantity)}
                                      className="text-blue-600 hover:text-blue-900 p-1 transition-colors"
                                      title="Edit Quantity"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => loadStockHistory()}
                                className="text-purple-600 hover:text-purple-900 p-1 transition-colors"
                                title="View History"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {currentItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-lg font-medium">No stock items found</p>
                            <p className="text-gray-400 mt-1">Try adjusting your search</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2 pb-6">
                  <button 
                    disabled={currentPage <= 1} 
                    onClick={() => setCurrentPage(currentPage - 1)} 
                    className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                      currentPage <= 1 
                        ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </span>
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg border min-w-[40px] font-medium transition-all ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button 
                    disabled={currentPage >= totalPages} 
                    onClick={() => setCurrentPage(currentPage + 1)} 
                    className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                      currentPage >= totalPages 
                        ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stock History Modal */}
        {showHistory && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" onClick={() => setShowHistory(false)}>
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Stock History</h3>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Filter Dropdown */}
                  <div className="mb-4">
                    <label htmlFor="changeTypeFilter" className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Change Type:
                    </label>
                    <select
                      id="changeTypeFilter"
                      value={historyFilter}
                      onChange={(e) => handleHistoryFilterChange(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="All">All</option>
                      <option value="Added">Added</option>
                      <option value="Removed">Removed</option>
                      <option value="Updated">Updated</option>
                    </select>
                  </div>

                  {/* History Table */}
                  <div className="max-h-96 overflow-y-auto">
                    {loadingHistory ? (
                      <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Loading history...</p>
                      </div>
                    ) : stockHistory.length > 0 ? (
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Before</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity After</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changed By</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stockHistory.map(record => (
                            <tr key={record._id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {record.sku}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {record.productName}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getChangeTypeColor(record.changeType)}`}>
                                  {record.changeType}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {record.quantityBefore}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {record.quantityAfter}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {record.changedBy}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {record.formattedTimestamp}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No stock history found</p>
                    )}
                  </div>

                  {/* Pagination */}
                  {historyPagination && historyPagination.total_pages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {((historyPagination.current_page - 1) * historyPagination.per_page) + 1} to{' '}
                        {Math.min(historyPagination.current_page * historyPagination.per_page, historyPagination.total_count)} of{' '}
                        {historyPagination.total_count} results
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleHistoryPageChange(currentHistoryPage - 1)}
                          disabled={!historyPagination.has_prev}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          Page {historyPagination.current_page} of {historyPagination.total_pages}
                        </span>
                        <button
                          onClick={() => handleHistoryPageChange(currentHistoryPage + 1)}
                          disabled={!historyPagination.has_next}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </RoleBasedNavigation>
  );
};