import React, { useState, useEffect } from 'react';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api';

interface Store {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  latitude?: number;
  longitude?: number;
  opening_hours?: string;
  status: string;
  created_at: string;
}

interface StoreForm {
  name: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  latitude: string;
  longitude: string;
  opening_hours: string;
}

export const StoreManagementPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [authToken] = useState(() => localStorage.getItem('access_token'));
  const [formData, setFormData] = useState<StoreForm>({
    name: '',
    location: '',
    address: '',
    phone: '',
    email: '',
    manager: '',
    latitude: '',
    longitude: '',
    opening_hours: '',
  });

  // Debug: Check authentication
  useEffect(() => {
    console.log('Store Management Page - Auth Status:', {
      isAuthenticated,
      user: user ? { id: user.id, email: user.email, perms: user.perms } : null,
      tokenPresent: !!authToken,
      tokenLength: authToken?.length || 0
    });
  }, [user, isAuthenticated, authToken]);

  // Fetch stores
  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stores');
      setStores(response.data.stores || []);
    } catch (error: any) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up form data - convert empty latitude/longitude to null/undefined
      const cleanedData = {
        name: formData.name,
        location: formData.location,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        manager: formData.manager,
        opening_hours: formData.opening_hours || undefined,
        ...(formData.latitude ? { latitude: parseFloat(formData.latitude) } : {}),
        ...(formData.longitude ? { longitude: parseFloat(formData.longitude) } : {}),
      };

      if (editingStore) {
        // Update store
        await api.patch(`/stores/${editingStore.id}`, cleanedData);
      } else {
        // Create new store
        await api.post('/stores', cleanedData);
      }
      setShowForm(false);
      setEditingStore(null);
      setFormData({
        name: '',
        location: '',
        address: '',
        phone: '',
        email: '',
        manager: '',
        latitude: '',
        longitude: '',
        opening_hours: '',
      });
      fetchStores();
    } catch (error: any) {
      console.error('Error saving store:', error);
      
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;
      const fullError = error.response?.data;
      
      let userMessage = `Failed to save store: ${errorMsg}`;
      
      if (statusCode === 401) {
        userMessage = 'Authentication failed. Please ensure you are logged in as an admin. Check the browser console for details.';
        console.error('Authentication details:', {
          token: authToken ? `${authToken.substring(0, 20)}...` : 'NO TOKEN',
          user,
          isAuthenticated,
          status: statusCode,
          response: fullError
        });
      } else if (statusCode === 403) {
        userMessage = 'You do not have permission to create stores. Admin access required.';
      }
      
      alert(userMessage);
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      location: store.location,
      address: store.address,
      phone: store.phone,
      email: store.email,
      manager: store.manager,
      latitude: store.latitude?.toString() || '',
      longitude: store.longitude?.toString() || '',
      opening_hours: store.opening_hours || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (storeId: string) => {
    if (window.confirm('Are you sure you want to delete this store?')) {
      try {
        await api.delete(`/stores/${storeId}`);
        fetchStores();
      } catch (error: any) {
        console.error('Error deleting store:', error);
        alert('Failed to delete store. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStore(null);
    setFormData({
      name: '',
      location: '',
      address: '',
      phone: '',
      email: '',
      manager: '',
      latitude: '',
      longitude: '',
      opening_hours: '',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Store Management</h2>
              <p className="text-gray-600 mt-1">Manage all store locations and operations</p>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingStore(null);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add New Store
            </button>
          </div>
        </div>

        {/* Store Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingStore ? 'Edit Store' : 'Add New Store'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter store name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manager Name *
                  </label>
                  <input
                    type="text"
                    name="manager"
                    value={formData.manager}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter manager name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleFormChange}
                      step="0.000001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 28.6139"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleFormChange}
                      step="0.000001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 77.2090"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Hours
                  </label>
                  <input
                    type="text"
                    name="opening_hours"
                    value={formData.opening_hours}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 10:00 AM - 8:00 PM"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingStore ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stores List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Stores ({stores.length})</h3>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              <p>No stores found. Create your first store!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Manager
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opening Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stores.map((store) => (
                    <tr key={store.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{store.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{store.location}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {store.manager}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {store.opening_hours || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          store.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {store.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(store.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEdit(store)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(store.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RoleBasedNavigation>
  );
};