import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api, API_BASE_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { AddItemForm } from '../../components/AddItemForm';
import { CsvImportModal } from '../../components/CsvImportModal';

interface Item { 
  _id: string; 
  sku: string; 
  name: string; 
  category: string; 
  sub_category?: string;
  metal: string; 
  purity: string; 
  weight_unit: string; 
  weight?: number;
  price?: number;
  description?: string;
  image?: string;
  gemstones?: string[];
  color?: string;
  style?: string;
  tags?: string[];
  brand?: string;
  status: string; 
  created_at?: string;
  updated_at?: string;
}

export const ItemsPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const itemsPerPage = 10;
  // Simplified state management
  
  // Version timestamp for cache busting
  const imageVersion = useMemo(() => Date.now(), []);
  
  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return '';
    const baseUrl = imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}${imagePath}`;
    if (!imagePath.startsWith('http')) {
      return `${baseUrl}?v=${imageVersion}`;
    }
    return baseUrl;
  };
  
  // Check permissions - admins get full access, others need specific permissions
  const isAdmin = !!(user?.roles?.includes('admin') || user?.role?.role_name?.toLowerCase() === 'admin');
  
  // Debug: Log user permissions
  useEffect(() => {
    if (user) {
      console.log('=== ItemsPage - User Info ===');
      console.log('Full User Object:', user);
      console.log('Role Name:', user.role?.role_name);
      console.log('Roles Array:', user.roles);
      console.log('Perms Array:', user.perms);
      console.log('Permissions Array:', user.permissions);
      console.log('Is Admin:', isAdmin);
      console.log('=============================');
    }
  }, [user, isAdmin]);
  
  // Check for inventory.modify permission in multiple possible locations
  const hasInventoryModify = !!(
    user?.perms?.includes('inventory.modify') || 
    user?.permissions?.includes('inventory.modify')
  );
  
  const canCreate = isAdmin || !!(
    user?.perms?.includes('inventory.create') || 
    user?.permissions?.includes('inventory.create') ||
    hasInventoryModify
  );
  
  const canEdit = isAdmin || !!(
    user?.perms?.includes('inventory.update') || 
    user?.permissions?.includes('inventory.update') ||
    hasInventoryModify
  );
  
  const canDelete = isAdmin || !!(
    user?.perms?.includes('inventory.delete') || 
    user?.permissions?.includes('inventory.delete') ||
    hasInventoryModify
  );
  
  // Debug: Log computed permissions
  useEffect(() => {
    console.log('=== ItemsPage - Computed Permissions ===');
    console.log('hasInventoryModify:', hasInventoryModify);
    console.log('canCreate:', canCreate);
    console.log('canEdit:', canEdit);
    console.log('canDelete:', canDelete);
    console.log('=========================================');
  }, [hasInventoryModify, canCreate, canEdit, canDelete]);

  // Get unique categories from items
  const categories = useMemo(() => {
    const uniqueCategories = new Set(items.map(item => item.category).filter(Boolean));
    return ['All', ...Array.from(uniqueCategories).sort()];
  }, [items]);

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = 
        selectedCategory === '' ||
        selectedCategory === 'All' ||
        item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  // Pagination calculations based on filtered items
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);
  

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/inventory/items');
      setItems(res.data.items || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => { 
    load(); 
  }, []);

  // Simplified form handlers
  const handleAddItem = useCallback(async (formData: any, imageFile: File | null) => {
    console.log('Adding item with data:', formData);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value != null ? value.toString() : '');
      });
      if (imageFile) {
        data.append('image', imageFile);
      }
      
      const response = await api.post('/inventory/items', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Item created successfully:', response.data);
      setShowAddModal(false);
      load(); // Refresh the list
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
    }
  }, []);

  const handleEditItem = useCallback(async (formData: any, imageFile: File | null) => {
    if (!editingItem) return;
    
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value != null ? value.toString() : '');
      });
      if (imageFile) {
        data.append('image', imageFile);
      }
      
      await api.put(`/inventory/items/${editingItem._id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowEditModal(false);
      setEditingItem(null);
      load(); // Refresh the list
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('Failed to update item. Please try again.');
    }
  }, [editingItem]);


  const openAddModal = useCallback(() => {
    console.log('Opening add modal...');
    setShowAddModal(true);
  }, []);

  const openEditModal = useCallback((item: Item) => {
    setEditingItem(item);
    setShowEditModal(true);
  }, []);

  const openDetailsModal = useCallback((item: Item) => {
    setViewingItem(item);
    setShowDetailsModal(true);
  }, []);

  // Convert Item to FormData format for editing
  const convertItemToFormData = (item: Item) => {
    return {
      ...item,
      gemstones: Array.isArray(item.gemstones) ? item.gemstones.join(', ') : (item.gemstones || ''),
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || ''),
    };
  };


  const deleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await api.delete(`/inventory/items/${id}`);
        load();
      } catch (error) {
        console.error('Failed to delete item:', error);
        alert('Failed to delete item. Please try again.');
      }
    }
  };



  return (
    <RoleBasedNavigation sidebarCollapsed={sidebarCollapsed}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Jewelry Items</h1>
              <p className="text-gray-600 mt-1">
                Manage your jewelry inventory • {items.length} total items
                {(searchTerm || selectedCategory) && (
                  <span className="text-blue-600"> • {filteredItems.length} filtered</span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
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
              {/* Show Add New Item button for users with create permission */}
              {canCreate && (
                <>
                  <button 
                    onClick={() => setShowCsvImportModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 inline-flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Import CSV</span>
                  </button>
                  <button 
                    onClick={openAddModal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add New Item</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-64">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
                >
                  {categories.map((category, idx) => (
                    <option key={idx} value={category === 'All' ? '' : category}>
                      {category}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading items...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Image</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Brand</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Metal</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Price</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.map(item => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {item.image ? (
                          <img 
                            src={getImageUrl(item.image)} 
                            alt={item.name} 
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => {
                              console.error('Image failed to load:', item.image);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{item.sku}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-900">{item.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{item.category}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{item.brand || 'Smart Jewel'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{item.metal} ({item.purity})</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-900">₹{item.price?.toLocaleString() || 'N/A'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openDetailsModal(item)}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => deleteItem(item._id)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          {items.length === 0 ? (
                            <>
                              <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              <p className="text-lg font-medium">No items found</p>
                              <p className="text-gray-400 mt-1">Get started by adding your first jewelry item</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <p className="text-lg font-medium">No items match your filters</p>
                              <p className="text-gray-400 mt-1">Try adjusting your search or category filter</p>
                              <button
                                onClick={() => {
                                  setSearchTerm('');
                                  setSelectedCategory('');
                                }}
                                className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Clear all filters
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {!isLoading && filteredItems.length > 0 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} items
                {(searchTerm || selectedCategory) && (
                  <span className="text-gray-400"> (filtered from {items.length} total)</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>


        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" onClick={() => setShowAddModal(false)}>
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Jewelry Item</h3>
                  <AddItemForm 
                    onSubmit={handleAddItem}
                    onCancel={() => setShowAddModal(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingItem && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" onClick={() => setShowEditModal(false)}>
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Jewelry Item</h3>
                  <AddItemForm 
                    onSubmit={handleEditItem}
                    onCancel={() => { setShowEditModal(false); setEditingItem(null); }}
                    isEdit
                    initialData={editingItem ? convertItemToFormData(editingItem) : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvImportModal && (
          <CsvImportModal
            onClose={() => setShowCsvImportModal(false)}
            onSuccess={load}
          />
        )}
      </div>
    </RoleBasedNavigation>
  );
};