import React, { useState, useEffect, useMemo } from 'react';
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
  // Added location-specific stock levels
  stock_levels?: Array<{
    location_id: string;
    location_name: string;
    quantity: number;
    weight?: number;
  }>;
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

interface StoreLocation {
  _id: string;
  name: string;
}

export const StockPage: React.FC = () => {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState<{ [key: string]: number }>({});
  const [editingLocation, setEditingLocation] = useState<string>(''); // New state for location selection during editing
  const [redistributingAll, setRedistributingAll] = useState<boolean>(false); // Track if redistributing all stock
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
        low_stock_threshold: 5,
        stock_levels: product.stock_levels || []
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

  const loadStoreLocations = async () => {
    try {
      // Get all store locations
      const response = await api.get('/stores');
      const stores = response.data.stores || [];
      setStoreLocations(stores);
      
      // Set default selected location if there's only one
      if (stores.length === 1) {
        setSelectedLocation(stores[0]._id);
      }
    } catch (error) {
      console.error('Failed to load store locations:', error);
    }
  };

  useEffect(() => {
    loadStockData();
    loadStoreLocations();
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
    if (!currentItem) return;

    setSavingItems(prev => new Set([...prev, itemId]));

    try {
      // If we're editing for a specific location, use the location-specific endpoint
      if (editingLocation) {
        await api.put(`/inventory/stock/${currentItem.sku}/location/${editingLocation}`, {
          quantity: newQuantity
        });
      } else {
        // Otherwise, use the intelligent distribution endpoint
        await api.post(`/inventory/stock/${currentItem.sku}/distribute`, {
          quantity: newQuantity
        });
      }

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
      
      // Clear editing location
      setEditingLocation('');

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

  // New function to distribute stock intelligently
  const distributeStockIntelligently = async (itemId: string) => {
    const currentItem = stockItems.find(item => item._id === itemId);
    if (!currentItem) return;

    // Set saving state to show loading indicator
    setSavingItems(prev => new Set([...prev, itemId]));

    try {
      // Call the backend endpoint to distribute stock intelligently
      await api.post(`/inventory/stock/${currentItem.sku}/distribute`, {
        quantity: currentItem.quantity
      });

      // Refresh the stock table
      loadStockData();

      alert(`Stock for ${currentItem.name} successfully distributed across store locations!`);
    } catch (error) {
      console.error('Failed to distribute stock:', error);
      alert('Failed to distribute stock. Please try again.');
    } finally {
      setSavingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // New function to redistribute all stock equally
  const redistributeAllStockEqually = async () => {
    if (!confirm("Are you sure you want to redistribute all stock equally across all store locations? This will override existing distribution patterns.")) {
      return;
    }

    setRedistributingAll(true);

    try {
      // Call the backend endpoint to redistribute all stock
      await api.post(`/inventory/stock/redistribute-all`);

      // Refresh the stock table
      loadStockData();

      alert(`All stock successfully redistributed equally across all store locations!`);
    } catch (error) {
      console.error('Failed to redistribute stock:', error);
      alert('Failed to redistribute stock. Please try again.');
    } finally {
      setRedistributingAll(false);
    }
  };

  const cancelEdit = (itemId: string) => {
    setEditingQuantity(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
    setEditingLocation(''); // Clear editing location
  };

  // Start editing with location selection
  const startEditingWithLocation = (itemId: string, locationId: string = '') => {
    const currentItem = stockItems.find(item => item._id === itemId);
    if (!currentItem) return;
    
    // Set the current quantity for editing
    const currentQuantity = locationId 
      ? getStockForLocation(currentItem, locationId)
      : currentItem.quantity;
      
    setEditingQuantity(prev => ({
      ...prev,
      [itemId]: currentQuantity
    }));
    
    // Set the editing location
    setEditingLocation(locationId);
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
      // Filter by search term
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by selected location if applicable
      if (selectedLocation) {
        // Check if item has stock in the selected location
        const hasStockInLocation = item.stock_levels?.some(level => level.location_id === selectedLocation);
        return matchesSearch && hasStockInLocation;
      }
      
      return matchesSearch;
    });
  }, [stockItems, searchTerm, selectedLocation]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  // Reset to page 1 when search or location changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation]);

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

  // Get stock quantity for a specific location
  const getStockForLocation = (item: StockItem, locationId: string) => {
    if (!item.stock_levels) return 0;
    const level = item.stock_levels.find(level => level.location_id === locationId);
    return level ? level.quantity : 0;
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
              {/* Redistribute All Stock Button */}
              {canManageStock && storeLocations.length > 1 && (
                <button
                  onClick={redistributeAllStockEqually}
                  disabled={redistributingAll || isLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {redistributingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Redistributing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span>Redistribute All Stock</span>
                    </>
                  )}
                </button>
              )}
              
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

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            
            {/* Location Filter */}
            <div className="flex items-center space-x-2">
              <label htmlFor="locationFilter" className="text-sm font-medium text-gray-700">
                Location:
              </label>
              <select
                id="locationFilter"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Locations</option>
                {storeLocations.map(location => (
                  <option key={location._id} value={location._id}>
                    {location.name}
                  </option>
                ))}
              </select>
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
                      {selectedLocation ? (
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Quantity ({storeLocations.find(l => l._id === selectedLocation)?.name || 'Selected Location'})</th>
                      ) : (
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Total Quantity</th>
                      )}
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentItems.map((item: StockItem) => {
                      const isEditing = editingQuantity.hasOwnProperty(item._id);
                      const currentQuantity = selectedLocation 
                        ? getStockForLocation(item, selectedLocation)
                        : (isEditing ? editingQuantity[item._id] : item.quantity);
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
                                  {/* Location selection dropdown when editing */}
                                  {!selectedLocation && item.stock_levels && item.stock_levels.length > 1 && (
                                    <select
                                      value={editingLocation}
                                      onChange={(e) => setEditingLocation(e.target.value)}
                                      className="border border-gray-300 rounded-md px-2 py-1 text-sm mr-2"
                                    >
                                      <option value="">All Locations</option>
                                      {item.stock_levels.map((level) => (
                                        <option key={level.location_id} value={level.location_id}>
                                          {level.location_name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  
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
                                  {item.stock_levels && item.stock_levels.length > 1 && !selectedLocation && (
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({item.stock_levels.length} locations)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            {/* Show location-specific stock levels when no filter is applied */}
                            {!selectedLocation && item.stock_levels && item.stock_levels.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500">
                                {item.stock_levels.map((level: { location_name: string; quantity: number; unit?: string }, idx: number) => (
                                  <div key={idx}>
                                    {level.location_name}: {level.quantity} {item.unit}
                                  </div>
                                ))}
                              </div>
                            )}
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
                                    <>
                                      <button
                                        onClick={() => startEditingWithLocation(item._id, selectedLocation)}
                                        className="text-blue-600 hover:text-blue-900 p-1 transition-colors"
                                        title="Edit Quantity"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      {storeLocations.length > 1 && (
                                        <button
                                          onClick={() => distributeStockIntelligently(item._id)}
                                          disabled={isSaving}
                                          className="text-purple-600 hover:text-purple-900 p-1 disabled:opacity-50 transition-colors"
                                          title="Distribute Intelligently Across Stores"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                          </svg>
                                        </button>
                                      )}
                                    </>
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
                            <p className="text-gray-400 mt-1">Try adjusting your search or location filter</p>
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
                      className={`w-10 h-10 rounded-full transition-all ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
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
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div 
                  className="absolute inset-0 bg-gray-500 opacity-75"
                  onClick={() => setShowHistory(false)}
                ></div>
              </div>
              
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Stock History
                      </h3>
                      
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex space-x-2">
                            <select
                              value={historyFilter}
                              onChange={(e) => handleHistoryFilterChange(e.target.value)}
                              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                            >
                              <option value="All">All Changes</option>
                              <option value="Added">Added</option>
                              <option value="Removed">Removed</option>
                              <option value="Updated">Updated</option>
                            </select>
                          </div>
                        </div>
                        
                        {loadingHistory ? (
                          <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-600">Loading history...</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {stockHistory.map((record) => (
                                  <tr key={record._id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{record.productName}</div>
                                      <div className="text-sm text-gray-500">{record.sku}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getChangeTypeColor(record.changeType)}`}>
                                        {record.changeType}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {record.quantityBefore} → {record.quantityAfter}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {record.changedBy}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {record.formattedTimestamp}
                                    </td>
                                  </tr>
                                ))}
                                {stockHistory.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                      No stock history records found
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                        
                        {/* Pagination for history */}
                        {historyPagination && historyPagination.total_pages > 1 && (
                          <div className="mt-4 flex items-center justify-center gap-2">
                            <button 
                              disabled={!historyPagination.has_prev} 
                              onClick={() => handleHistoryPageChange(currentHistoryPage - 1)} 
                              className={`px-3 py-1 rounded border text-sm ${
                                !historyPagination.has_prev 
                                  ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Previous
                            </button>
                            
                            <span className="text-sm text-gray-600">
                              Page {currentHistoryPage} of {historyPagination.total_pages}
                            </span>
                            
                            <button 
                              disabled={!historyPagination.has_next} 
                              onClick={() => handleHistoryPageChange(currentHistoryPage + 1)} 
                              className={`px-3 py-1 rounded border text-sm ${
                                !historyPagination.has_next 
                                  ? 'text-gray-300 border-gray-200 cursor-not-allowed' 
                                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowHistory(false)}
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