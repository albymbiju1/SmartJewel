import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { AddItemForm } from '../../components/AddItemForm';

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
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  // Simplified state management
  
  // Check permissions - admins get full access, others need specific permissions
  const isAdmin = !!(user?.roles?.includes('admin') || user?.role?.role_name?.toLowerCase() === 'admin');
  const canCreate = isAdmin || !!(user?.perms?.includes('inventory.create') || user?.permissions?.includes('inventory.create'));
  const canEdit = isAdmin || !!(user?.perms?.includes('inventory.update') || user?.permissions?.includes('inventory.update'));
  const canDelete = isAdmin; // delete restricted to admin only
  

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
    <RoleBasedNavigation>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jewelry Items</h1>
              <p className="text-gray-600 mt-1">Manage your jewelry inventory</p>
            </div>
            {/* Show Add New Item button for users with create permission */}
            {canCreate && (
              <button 
                onClick={openAddModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add New Item</span>
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
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map(item => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.image ? (
                          <img 
                            src={item.image.startsWith('http') ? item.image : `http://127.0.0.1:5000${item.image}`} 
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.brand || 'Smart Jewel'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.metal} ({item.purity})</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{item.price?.toLocaleString() || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <p className="text-lg font-medium">No items found</p>
                          <p className="text-gray-400 mt-1">Get started by adding your first jewelry item</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
      </div>
    </RoleBasedNavigation>
  );
};