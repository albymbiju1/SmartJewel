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

  const inputClasses =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";

  const storesStats = React.useMemo(() => {
    const active = stores.filter((store) => store.status === 'active').length;
    const inactive = stores.filter((store) => store.status !== 'active').length;
    return { active, inactive };
  }, [stores]);

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
      <div className="min-h-screen bg-slate-50/80 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Header */}
          <div className="rounded-3xl border border-blue-100/60 bg-gradient-to-br from-white via-white to-blue-50/20 p-8 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Operations</p>
                <h2 className="mt-1 text-3xl font-bold text-gray-900">Store Management</h2>
                <p className="mt-2 max-w-xl text-sm text-gray-600">
                  Create, track, and maintain your SmartJewel retail locations with consistent brand experience.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingStore(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Store
              </button>
            </div>
          </div>

          {/* Store Form Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10">
              <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
                      {editingStore ? 'Update Store' : 'New Store'}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900">
                      {editingStore ? `Editing ${editingStore.name}` : 'Register a New Location'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-6">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Store Identity</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          Provide the basics so your store appears correctly across customer experiences.
                        </p>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-gray-700">Store Name *</label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleFormChange}
                              required
                              className={inputClasses}
                              placeholder="Central Avenue Boutique"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">City / Locality *</label>
                            <input
                              type="text"
                              name="location"
                              value={formData.location}
                              onChange={handleFormChange}
                              required
                              className={inputClasses}
                              placeholder="Bandra West, Mumbai"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Manager Name *</label>
                            <input
                              type="text"
                              name="manager"
                              value={formData.manager}
                              onChange={handleFormChange}
                              required
                              className={inputClasses}
                              placeholder="Priya Sharma"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-gray-700">Full Address *</label>
                            <input
                              type="text"
                              name="address"
                              value={formData.address}
                              onChange={handleFormChange}
                              required
                              className={inputClasses}
                              placeholder="Unit 3, High Street Phoenix Mall, Lower Parel, Mumbai"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/60 p-6">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact & Timing</h4>
                      <p className="mt-1 text-xs text-gray-500">
                        These details ensure your customers and staff can reach the store easily.
                      </p>

                      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Primary Phone *</label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleFormChange}
                            required
                            className={inputClasses}
                            placeholder="+91 98765 43210"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Store Email *</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleFormChange}
                            required
                            className={inputClasses}
                            placeholder="bandra.smartjewel@stores.com"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-gray-700">Opening Hours</label>
                          <input
                            type="text"
                            name="opening_hours"
                            value={formData.opening_hours}
                            onChange={handleFormChange}
                            className={inputClasses}
                            placeholder="Monday - Sunday, 10:30 AM to 8:30 PM"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Geo Coordinates</h4>
                      <p className="mt-1 text-xs text-blue-600/80">
                        Optional but recommended for location services and directions.
                      </p>

                      <div className="mt-6 space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Latitude</label>
                          <input
                            type="number"
                            name="latitude"
                            value={formData.latitude}
                            onChange={handleFormChange}
                            step="0.000001"
                            className={inputClasses}
                            placeholder="19.0660"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Longitude</label>
                          <input
                            type="number"
                            name="longitude"
                            value={formData.longitude}
                            onChange={handleFormChange}
                            step="0.000001"
                            className={inputClasses}
                            placeholder="72.8777"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Tips</h4>
                      <ul className="mt-3 space-y-2 text-xs text-gray-500">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500"></span>
                          Use the exact display name customers will see.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500"></span>
                          Provide landmark details inside the address field.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500"></span>
                          Operating hours help power store finder features.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col-reverse items-center justify-end gap-4 border-t border-gray-100 pt-6 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800 sm:w-auto"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl sm:w-auto"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingStore ? 'Save Changes' : 'Create Store'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        {/* Stores List */}
        <div className="rounded-3xl border border-gray-100 bg-white/70 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Stores Overview</h3>
              <p className="text-sm text-gray-500">Monitor all retail locations and keep information up to date.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                {storesStats.active} active
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                {storesStats.inactive} pending
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-8 py-12 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
              <p className="mt-4 text-sm font-medium text-gray-500">Fetching store records...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v10m-5-5h10" />
                </svg>
              </div>
              <h4 className="mt-6 text-xl font-semibold text-gray-900">No stores yet</h4>
              <p className="mt-2 text-sm text-gray-500">Start by adding your first physical storefront to keep track of operations.</p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingStore(null);
                }}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:to-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add your first store
              </button>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="flex items-start justify-between px-5 pt-5">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">Store</p>
                        <h4 className="mt-1 text-lg font-semibold text-gray-900">{store.name}</h4>
                        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657 13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                          </svg>
                          {store.location}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          store.status === 'active'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                        {store.status === 'active' ? 'Live' : 'Pending'}
                      </span>
                    </div>

                    <div className="px-5 py-4 text-sm text-gray-600">
                      <p className="flex items-start gap-2">
                        <span className="mt-1 text-blue-500">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                          </svg>
                        </span>
                        {store.email}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-gray-500">
                        <span className="text-blue-500">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.457 12C3.732 7.943 7.943 3.732 12 2.457c.622-.21 1.298-.21 1.92 0 4.057 1.275 8.268 5.486 9.543 9.543.21.622.21 1.298 0 1.92-1.275 4.057-5.486 8.268-9.543 9.543-.622.21-1.298.21-1.92 0-4.057-1.275-8.268-5.486-9.543-9.543-.21-.622-.21-1.298 0-1.92Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15.536 8.464-3.182 5.304a1 1 0 0 1-1.624.11L9 12" />
                          </svg>
                        </span>
                        {store.phone}
                      </p>
                      <p className="mt-4 text-xs text-gray-500">
                        {store.opening_hours || 'Opening hours not specified'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4 text-xs text-gray-500">
                      <div>
                        <p className="font-medium text-gray-700">Manager</p>
                        <p className="mt-1 text-sm text-gray-600">{store.manager}</p>
                      </div>
                      <div className="text-right">
                        <p>Created</p>
                        <p className="mt-1 text-sm text-gray-600">{formatDate(store.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 text-sm">
                      <button
                        onClick={() => handleEdit(store)}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/60 px-4 py-2 font-medium text-blue-600 transition hover:bg-blue-100"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 002 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50/60 px-4 py-2 font-medium text-red-600 transition hover:bg-red-100"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12M9 7V4h6v3m-7 4v6m4-6v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </RoleBasedNavigation>
  );
};