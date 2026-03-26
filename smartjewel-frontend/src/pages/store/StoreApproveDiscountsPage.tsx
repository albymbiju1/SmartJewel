import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

// ---- Types ----------------------------------------------------------------

interface Discount {
  _id: string;
  name: string;
  scope: 'product' | 'category';
  product_ids: string[];
  category: string | null;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface ProductDetail {
  _id: string;
  name: string;
  image?: string;
  price?: number;
  computed_price?: number;
  category?: string;
  metal?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  category?: string;
  metal?: string;
  computed_price?: number;
  price?: number;
  images?: string[];
}

const CATEGORIES = ['Gold', 'Diamond', 'Silver', 'Platinum', 'Wedding', 'Gifting', 'Other'];

// ---- Helpers ---------------------------------------------------------------

const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtValue = (d: Discount) =>
  d.discount_type === 'percentage' ? `${d.discount_value}%` : `₹${d.discount_value.toLocaleString('en-IN')}`;

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

// ---- Empty form state ------------------------------------------------------

const emptyForm = () => ({
  name: '',
  scope: 'product' as 'product' | 'category',
  product_ids: [] as string[],
  product_search: '',
  category: '',
  discount_type: 'percentage' as 'percentage' | 'flat',
  discount_value: '',
  start_date: '',
  end_date: '',
  active: true,
});

// ---- Component -------------------------------------------------------------

export const StoreApproveDiscountsPage: React.FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [expandedRows, setExpandedRows] = useState<Record<string, ProductDetail[]>>({});
  const [expandLoading, setExpandLoading] = useState<Record<string, boolean>>({});

  const toggleExpand = async (d: Discount) => {
    if (expandedRows[d._id]) {
      setExpandedRows((prev) => { const n = { ...prev }; delete n[d._id]; return n; });
      return;
    }
    if (d.scope === 'category') {
      setExpandedRows((prev) => ({ ...prev, [d._id]: [] }));
      return;
    }
    setExpandLoading((prev) => ({ ...prev, [d._id]: true }));
    try {
      const results = await Promise.all(
        d.product_ids.map((id) =>
          api.get(`/inventory/items/${id}`).then((r) => r.data.item).catch(() => null)
        )
      );
      setExpandedRows((prev) => ({ ...prev, [d._id]: results.filter(Boolean) as ProductDetail[] }));
    } catch {
      setExpandedRows((prev) => ({ ...prev, [d._id]: [] }));
    } finally {
      setExpandLoading((prev) => { const n = { ...prev }; delete n[d._id]; return n; });
    }
  };

  const calcDiscountedPrice = (price: number, d: Discount) => {
    if (d.discount_type === 'percentage') return price - (price * d.discount_value) / 100;
    return Math.max(0, price - d.discount_value);
  };

  const fetchDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, limit: 100 };
      const res = await api.get<{ discounts: Discount[]; pagination: { pages: number; total: number } }>(
        '/api/store-manager/discounts', { params }
      );
      const now = new Date();
      const all: Discount[] = res.data.discounts;
      const filtered = activeFilter === 'all'
        ? all
        : activeFilter === 'active'
          ? all.filter((d) => d.active && !(d.end_date && new Date(d.end_date) < now))
          : all.filter((d) => !d.active || (d.end_date && new Date(d.end_date) < now));
      setDiscounts(filtered);
      setTotalPages(1);
      setTotal(filtered.length);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load discounts');
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter]);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const res = await api.get('/inventory/items', { params: { q, limit: 8 } });
      const items: ProductOption[] = (res.data.items || []).map((p: any) => ({
        _id: p._id, name: p.name, category: p.category, metal: p.metal,
        computed_price: p.computed_price || p.price,
        images: p.image ? [p.image] : (p.images || []),
      }));
      setSearchResults(items.filter((p) => !form.product_ids.includes(p._id)));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [form.product_ids]);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(form.product_search), 350);
    return () => clearTimeout(timer);
  }, [form.product_search, searchProducts]);

  const openCreate = () => {
    setEditingId(null); setForm(emptyForm()); setSelectedProducts([]);
    setSearchResults([]); setFormError(null); setShowModal(true);
  };

  const openEdit = (d: Discount) => {
    setEditingId(d._id);
    setForm({
      name: d.name, scope: d.scope, product_ids: d.product_ids, product_search: '',
      category: d.category || '', discount_type: d.discount_type,
      discount_value: String(d.discount_value),
      start_date: d.start_date ? d.start_date.slice(0, 10) : '',
      end_date: d.end_date ? d.end_date.slice(0, 10) : '', active: d.active,
    });
    setSelectedProducts(d.product_ids.map((id) => ({ _id: id, name: id })));
    setSearchResults([]); setFormError(null); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setFormError(null); };

  const addProduct = (p: ProductOption) => {
    if (form.product_ids.includes(p._id)) return;
    setForm((f) => ({ ...f, product_ids: [...f.product_ids, p._id], product_search: '' }));
    setSelectedProducts((s) => [...s, p]);
    setSearchResults([]);
  };

  const removeProduct = (id: string) => {
    setForm((f) => ({ ...f, product_ids: f.product_ids.filter((x) => x !== id) }));
    setSelectedProducts((s) => s.filter((p) => p._id !== id));
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (form.scope === 'product' && form.product_ids.length === 0) { setFormError('Select at least one product'); return; }
    if (form.scope === 'category' && !form.category) { setFormError('Select a category'); return; }
    const value = parseFloat(form.discount_value);
    if (!form.discount_value || isNaN(value) || value <= 0) { setFormError('Enter a valid discount value'); return; }
    if (form.discount_type === 'percentage' && value > 100) { setFormError('Percentage cannot exceed 100'); return; }
    const payload = {
      name: form.name.trim(), scope: form.scope,
      product_ids: form.scope === 'product' ? form.product_ids : undefined,
      category: form.scope === 'category' ? form.category : undefined,
      discount_type: form.discount_type, discount_value: value,
      start_date: form.start_date || null, end_date: form.end_date || null, active: form.active,
    };
    try {
      setSaving(true);
      if (editingId) { await api.patch(`/api/store-manager/discounts/${editingId}`, payload); }
      else { await api.post('/api/store-manager/discounts', payload); }
      closeModal(); fetchDiscounts();
    } catch (err: unknown) {
      const details = (err as { response?: { data?: { details?: Record<string, string[]>; error?: string } } })?.response?.data;
      if (details?.details) setFormError(Object.values(details.details).flat().join('; '));
      else setFormError(details?.error || 'Failed to save discount');
    } finally { setSaving(false); }
  };

  const handleToggle = async (d: Discount) => {
    try {
      await api.patch(`/api/store-manager/discounts/${d._id}`, { active: !d.active });
      setDiscounts((prev) => prev.map((x) => x._id === d._id ? { ...x, active: !d.active } : x));
    } catch { fetchDiscounts(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/store-manager/discounts/${deleteTarget.id}`);
      setDeleteTarget(null); fetchDiscounts();
    } catch { setDeleteTarget(null); }
  };

  const now = new Date();
  const activeCount = discounts.filter((d) => d.active && !(d.end_date && new Date(d.end_date) < now)).length;
  const inactiveCount = discounts.filter((d) => !d.active || (d.end_date && new Date(d.end_date) < now)).length;
  const productCount = discounts.filter((d) => d.scope === 'product').length;

  return (
    <RoleBasedNavigation>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Discount Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage discounts on specific products or categories</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Create Discount
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: total, color: 'text-gray-900' },
              { label: 'Active', value: activeCount, color: 'text-emerald-600' },
              { label: 'Inactive', value: inactiveCount, color: 'text-gray-400' },
              { label: 'By Product', value: productCount, color: 'text-blue-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className={`text-2xl font-bold ${color}`}>{loading ? '—' : value}</div>
                <div className="text-sm text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button key={f} onClick={() => { setActiveFilter(f); setPage(1); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Loading discounts…</div>
            ) : discounts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-500 text-sm">No discounts found.</p>
                <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">Create your first discount</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-3">Name</th>
                      <th className="px-4 py-3">Scope</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {discounts.map((d) => {
                      const isExpiredRow = d.end_date ? new Date(d.end_date) < new Date() : false;
                      const effectivelyActive = d.active && !isExpiredRow;
                      return (
                      <React.Fragment key={d._id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.scope === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                              {d.scope === 'product' ? 'Product' : 'Category'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <button onClick={() => toggleExpand(d)} className="flex items-center gap-1 hover:text-amber-600 transition-colors">
                              {d.scope === 'category' ? <span className="capitalize">{d.category}</span> : <span>{d.product_ids.length} product{d.product_ids.length !== 1 ? 's' : ''}</span>}
                              <svg className={`w-3.5 h-3.5 transition-transform ${expandedRows[d._id] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">{fmtValue(d)}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {fmt(d.end_date)}
                            {isExpiredRow && <span className="ml-1 text-xs text-red-500 font-medium">(Expired)</span>}
                          </td>
                          <td className="px-4 py-3"><StatusBadge active={effectivelyActive} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => !isExpiredRow && handleToggle(d)}
                                disabled={isExpiredRow}
                                title={isExpiredRow ? 'Discount expired' : effectivelyActive ? 'Deactivate' : 'Activate'}
                                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${isExpiredRow ? 'bg-gray-200 cursor-not-allowed opacity-50' : effectivelyActive ? 'bg-emerald-500 cursor-pointer' : 'bg-gray-300 cursor-pointer'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${effectivelyActive ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                              <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700" title="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setDeleteTarget({ id: d._id, name: d.name })} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows[d._id] !== undefined && (
                          <tr>
                            <td colSpan={7} className="px-5 pb-4 pt-0 bg-gray-50/60">
                              {expandLoading[d._id] ? (
                                <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                                  <div className="h-4 w-4 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />Loading products…
                                </div>
                              ) : d.scope === 'category' ? (
                                <p className="py-3 text-sm text-gray-500">Applies to all <span className="font-medium capitalize text-gray-700">{d.category}</span> products.</p>
                              ) : expandedRows[d._id].length === 0 ? (
                                <p className="py-3 text-sm text-gray-400">No product details found.</p>
                              ) : (
                                <div className="flex flex-wrap gap-3 pt-3">
                                  {expandedRows[d._id].map((p) => {
                                    const orig = p.computed_price || p.price || 0;
                                    const discounted = calcDiscountedPrice(orig, d);
                                    const now = new Date();
                                    const isExpired = d.end_date ? new Date(d.end_date) < now : false;
                                    const isDiscountActive = d.active && !isExpired;
                                    return (
                                      <div key={p._id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-72">
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                          <p className="text-xs text-gray-400">{[p.metal, p.category].filter(Boolean).join(' · ')}</p>
                                          {orig > 0 ? (
                                            <div className="mt-1 flex items-center gap-2">
                                              {isDiscountActive ? (
                                                <>
                                                  <span className="text-xs text-gray-400 line-through">₹{orig.toLocaleString('en-IN')}</span>
                                                  <span className="text-sm font-bold text-emerald-600">₹{Math.round(discounted).toLocaleString('en-IN')}</span>
                                                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                                    {d.discount_type === 'percentage' ? `${d.discount_value}% off` : `₹${d.discount_value.toLocaleString('en-IN')} off`}
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="text-sm font-bold text-gray-800">₹{orig.toLocaleString('en-IN')}</span>
                                                  {isExpired && <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-medium">Expired</span>}
                                                </>
                                              )}
                                            </div>
                                          ) : <p className="text-xs text-gray-400 mt-1">Price N/A</p>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="border-t px-5 py-3 flex items-center justify-between text-sm text-gray-600">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50">Previous</button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-base font-semibold text-gray-900">{editingId ? 'Edit Discount' : 'Create Discount'}</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{formError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Diwali Sale" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apply To</label>
                  <div className="flex gap-3">
                    {(['product', 'category'] as const).map((s) => (
                      <button key={s} onClick={() => setForm((f) => ({ ...f, scope: s, product_ids: [], category: '' }))}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.scope === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                        {s === 'product' ? 'Specific Products' : 'All in Category'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.scope === 'product' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
                    <div className="relative">
                      <input type="text" value={form.product_search} onChange={(e) => setForm((f) => ({ ...f, product_search: e.target.value }))}
                        placeholder="Type product name…" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {searchResults.map((p) => (
                            <button key={p._id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b last:border-0 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0">
                                {p.images && p.images.length > 0 ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                <p className="text-xs text-gray-400">{[p.metal, p.category].filter(Boolean).join(' · ')}</p>
                              </div>
                              {(p.computed_price || p.price) && (
                                <span className="text-sm font-semibold text-amber-700 shrink-0">₹{((p.computed_price || p.price) as number).toLocaleString('en-IN')}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedProducts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedProducts.map((p) => (
                          <span key={p._id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                            {p.name.length > 28 ? p.name.slice(0, 28) + '…' : p.name}
                            <button onClick={() => removeProduct(p._id)} className="text-gray-400 hover:text-red-500">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {form.scope === 'category' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                      <option value="">Select a category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type & Value</label>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border overflow-hidden">
                      {(['percentage', 'flat'] as const).map((t) => (
                        <button key={t} onClick={() => setForm((f) => ({ ...f, discount_type: t }))}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${form.discount_type === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {t === 'percentage' ? '% Off' : '₹ Flat'}
                        </button>
                      ))}
                    </div>
                    <input type="number" min={0} max={form.discount_type === 'percentage' ? 100 : undefined} step="any"
                      value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                      placeholder={form.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-gray-700">Active immediately</span>
                  <button onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t">
                <button onClick={closeModal} className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Discount'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Discount</h3>
              <p className="text-sm text-gray-600 mb-6">Delete <span className="font-medium text-gray-900">"{deleteTarget.name}"</span>? This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};

export default StoreApproveDiscountsPage;
