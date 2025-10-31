import React, { useEffect, useMemo, useState } from 'react';
import { api, API_BASE_URL } from '../../api';

interface StoreProductItem {
  _id: string;
  sku: string;
  name: string;
  category?: string;
  metal?: string;
  purity?: string;
  weight?: number;
  weight_unit?: string;
  price?: number;
  image?: string;
  status?: string;
  quantity: number;
}

interface StoreProductsResponse {
  items: StoreProductItem[];
  page: number;
  limit: number;
  total: number;
  error?: string;
}

export const StoreProductsPage: React.FC = () => {
  const [items, setItems] = useState<StoreProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const imageVersion = useMemo(() => Date.now(), []);
  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return '';
    const baseUrl = imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}${imagePath}`;
    if (!imagePath.startsWith('http')) {
      return `${baseUrl}?v=${imageVersion}`;
    }
    return baseUrl;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await api.get<StoreProductsResponse>(`/inventory/store/products?${params.toString()}`);
      if ((res.data as any)?.error === 'no_store_assigned') {
        setError('No store assigned to your profile');
        setItems([]);
      } else {
        setItems(res.data.items || []);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to load products';
      setError(typeof msg === 'string' ? msg : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, limit]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Store Products</h1>
            <div className="hidden md:block text-sm text-gray-500">Page {page}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              placeholder="Search by name, SKU, or category"
              value={query}
              onChange={(e) => { setPage(1); setQuery(e.target.value); }}
            />
            <div className="flex items-center space-x-3">
              <button
                className="flex-1 py-3 px-4 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-xl font-semibold hover:from-slate-700 hover:to-gray-800"
                onClick={() => { setPage(1); load(); }}
              >
                Apply
              </button>
              <button
                className="py-3 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                onClick={() => { setQuery(''); setPage(1); load(); }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <div className="w-full h-40 bg-gray-200 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18M9 7h6m-9 4h12m-8 4h8m-6 4h6" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">Try adjusting the search.</p>
            </div>
          ) : (
            items.map((p) => (
              <div key={p._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                <div className="w-full h-44 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center mb-4">
                  {p.image ? (
                    <img src={getImageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-300">No Image</div>
                  )}
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-400">{p.sku}</div>
                    <div className="text-lg font-semibold text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.category}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${p.quantity <= 0 ? 'bg-red-50 text-red-700' : p.quantity <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{p.quantity <= 0 ? 'Out' : p.quantity <= 5 ? `Low (${p.quantity})` : `${p.quantity}`}</div>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <span>{p.metal}</span>{p.purity ? <span className="ml-2">{p.purity}</span> : null}
                </div>
                <div className="mt-2 text-gray-900 font-semibold">{p.price ? `₹${p.price}` : '—'}</div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-600">Page {page}</div>
          <div className="flex space-x-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-5 py-2.5 rounded-lg border font-medium ${page <= 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed bg-gray-50' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              className={`px-5 py-2.5 rounded-lg border font-medium text-gray-700 border-gray-300 hover:bg-gray-50`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreProductsPage;
