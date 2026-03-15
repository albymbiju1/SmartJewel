import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, API_BASE_URL } from '../../api';
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

interface ProductOption {
  _id: string;
  name: string;
  category?: string;
  metal?: string;
  purity?: string;
  image?: string;
  price?: number;
  computed_price?: number;
}

const CATEGORIES = ['Gold', 'Diamond', 'Silver', 'Platinum', 'Wedding', 'Gifting', 'Other'];

// ---- Helpers ---------------------------------------------------------------

const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtValue = (d: Discount) =>
  d.discount_type === 'percentage' ? `${d.discount_value}%` : `₹${d.discount_value.toLocaleString('en-IN')}`;

const fmtMoney = (n?: number | null) => {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
};

const getBasePrice = (p?: ProductOption | null) => {
  if (!p) return null;
  if (typeof p.computed_price === 'number') return p.computed_price;
  if (typeof p.price === 'number') return p.price;
  return null;
};

const getImageUrl = (imagePath?: string) => {
  if (!imagePath) return '';
  return imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}${imagePath}`;
};

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

  // filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // create / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);
  const [resolvingSelected, setResolvingSelected] = useState(false);

  const selectedProductIds = useMemo(() => selectedProducts.map((p) => p._id), [selectedProducts]);

  // delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // cached product meta for price display in discounts table (single-product discounts only)
  const [productMeta, setProductMeta] = useState<Record<string, ProductOption>>({});

  // ---- Fetch discounts -------------------------------------------------------

  const fetchDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, limit: 15 };
      if (activeFilter !== 'all') params.active = activeFilter === 'active' ? 'true' : 'false';
      const res = await api.get<{ discounts: Discount[]; pagination: { pages: number; total: number } }>(
        '/api/store-manager/discounts',
        { params }
      );
      setDiscounts(res.data.discounts);
      setTotalPages(res.data.pagination.pages || 1);
      setTotal(res.data.pagination.total || 0);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load discounts');
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter]);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  const hydrateProductMetaForDiscounts = useCallback(async (ds: Discount[]) => {
    const ids = Array.from(
      new Set(
        ds
          .filter((d) => d.scope === 'product' && Array.isArray(d.product_ids) && d.product_ids.length === 1)
          .map((d) => d.product_ids[0])
      )
    );
    const missing = ids.filter((id) => !productMeta[id]);
    if (missing.length === 0) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H7',location:'StoreApproveDiscountsPage.tsx:hydrateProductMetaForDiscounts',message:'Hydrating product meta for discount table',data:{missingCount:missing.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          const res = await api.get<{ item: ProductOption }>(`/inventory/items/${id}`);
          const item = res.data?.item;
          if (item && item._id) return item;
        } catch {
          // ignore
        }
        return null;
      })
    );

    setProductMeta((prev) => {
      const next = { ...prev };
      for (const p of fetched) {
        if (p && p._id) next[p._id] = p;
      }
      return next;
    });
  }, [productMeta]);

  useEffect(() => {
    if (!discounts.length) return;
    hydrateProductMetaForDiscounts(discounts);
  }, [discounts, hydrateProductMetaForDiscounts]);

  // ---- Product search -------------------------------------------------------

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      setSearching(true);
      // Inventory items endpoint is `/inventory/items` in this backend
      const res = await api.get<{ items: ProductOption[] }>('/inventory/items', { params: { q, limit: 8 } });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af84b1c6-c029-417c-9354-921aac94b4cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H6',location:'StoreApproveDiscountsPage.tsx:searchProducts',message:'Search results received',data:{qLen:q.length,count:(res.data.items||[]).length,hasAnyPrice:(res.data.items||[]).some((x)=>typeof x.price==='number'||typeof x.computed_price==='number')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      setSearchResults((res.data.items || []).filter((p) => !form.product_ids.includes(p._id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [form.product_ids]);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(form.product_search), 350);
    return () => clearTimeout(timer);
  }, [form.product_search, searchProducts]);

  // ---- Modal helpers --------------------------------------------------------

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedProducts([]);
    setSearchResults([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (d: Discount) => {
    setEditingId(d._id);
    setForm({
      name: d.name,
      scope: d.scope,
      product_ids: d.product_ids,
      product_search: '',
      category: d.category || '',
      discount_type: d.discount_type,
      discount_value: String(d.discount_value),
      start_date: d.start_date ? d.start_date.slice(0, 10) : '',
      end_date: d.end_date ? d.end_date.slice(0, 10) : '',
      active: d.active,
    });
    // Resolve product names/images for editing (fallback to id if fetch fails)
    setSelectedProducts(d.product_ids.map((id) => ({ _id: id, name: id })));
    setSearchResults([]);
    setFormError(null);
    setShowModal(true);
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

  const resolveSelectedProducts = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      setResolvingSelected(true);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await api.get<{ item: ProductOption }>(`/inventory/items/${id}`);
            const item = res.data?.item;
            if (item && item._id) return item;
            return { _id: id, name: id } as ProductOption;
          } catch {
            return { _id: id, name: id } as ProductOption;
          }
        })
      );
      setSelectedProducts(results);
    } finally {
      setResolvingSelected(false);
    }
  }, []);

  // When opening edit modal (or if product_ids change externally), resolve product metadata
  useEffect(() => {
    if (!showModal) return;
    if (form.scope !== 'product') return;
    // Only resolve when we have placeholder names (id-like)
    const needsResolve = selectedProducts.some((p) => p.name === p._id);
    if (!needsResolve) return;
    resolveSelectedProducts(form.product_ids);
  }, [form.product_ids, form.scope, resolveSelectedProducts, selectedProducts, showModal]);

  // ---- Save (create or update) ----------------------------------------------

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (form.scope === 'product' && form.product_ids.length === 0) {
      setFormError('Select at least one product'); return;
    }
    if (form.scope === 'category' && !form.category) {
      setFormError('Select a category'); return;
    }
    const value = parseFloat(form.discount_value);
    if (!form.discount_value || isNaN(value) || value <= 0) {
      setFormError('Enter a valid discount value'); return;
    }
    if (form.discount_type === 'percentage' && value > 100) {
      setFormError('Percentage cannot exceed 100'); return;
    }

    const payload = {
      name: form.name.trim(),
      scope: form.scope,
      product_ids: form.scope === 'product' ? form.product_ids : undefined,
      category: form.scope === 'category' ? form.category : undefined,
      discount_type: form.discount_type,
      discount_value: value,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      active: form.active,
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.patch(`/api/store-manager/discounts/${editingId}`, payload);
      } else {
        await api.post('/api/store-manager/discounts', payload);
      }
      closeModal();
      fetchDiscounts();
    } catch (err: unknown) {
      const details = (err as { response?: { data?: { details?: Record<string, string[]>; error?: string } } })?.response?.data;
      if (details?.details) {
        setFormError(Object.values(details.details).flat().join('; '));
      } else {
        setFormError(details?.error || 'Failed to save discount');
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle active --------------------------------------------------------

  const handleToggle = async (d: Discount) => {
    try {
      await api.patch(`/api/store-manager/discounts/${d._id}`, { active: !d.active });
      setDiscounts((prev) => prev.map((x) => x._id === d._id ? { ...x, active: !d.active } : x));
    } catch {
      // silent — re-fetch will correct state
      fetchDiscounts();
    }
  };

  // ---- Delete ---------------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/store-manager/discounts/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchDiscounts();
    } catch {
      setDeleteTarget(null);
    }
  };

  // ---- Stats ----------------------------------------------------------------

  const activeCount = discounts.filter((d) => d.active).length;
  const inactiveCount = discounts.filter((d) => !d.active).length;
  const productCount = discounts.filter((d) => d.scope === 'product').length;
  const categoryCount = discounts.filter((d) => d.scope === 'category').length;

  // ---- Render ---------------------------------------------------------------

  return (
    <RoleBasedNavigation>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Discount Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage discounts on specific products or categories</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Discount
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
          {/* Stat cards */}
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

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setPage(1); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Loading discounts…</div>
            ) : discounts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-500 text-sm">No discounts found.</p>
                <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">
                  Create your first discount
                </button>
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
                    {discounts.map((d) => (
                      <tr key={d._id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            d.scope === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                          }`}>
                            {d.scope === 'product' ? 'Product' : 'Category'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="space-y-1">
                            <div>
                              {d.scope === 'category'
                                ? d.category
                                : `${d.product_ids.length} product${d.product_ids.length !== 1 ? 's' : ''}`}
                            </div>
                            {d.scope === 'product' && d.product_ids.length === 1 && (() => {
                              const p = productMeta[d.product_ids[0]];
                              const base = getBasePrice(p);
                              if (base == null) return <div className="text-xs text-gray-400">Price: —</div>;
                              const after = d.discount_type === 'percentage'
                                ? Math.max(0, base - (base * (d.discount_value / 100)))
                                : Math.max(0, base - d.discount_value);
                              return (
                                <div className="text-xs text-gray-500">
                                  <span className="line-through text-gray-400">{fmtMoney(base)}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-semibold text-emerald-700">{fmtMoney(Math.round(after * 100) / 100)}</span>
                                </div>
                              );
                            })()}
                            {(d.scope === 'product' && d.product_ids.length > 1) && (
                              <div className="text-xs text-gray-400">Price impact: Varies</div>
                            )}
                            {d.scope === 'category' && (
                              <div className="text-xs text-gray-400">Price impact: Varies</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{fmtValue(d)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmt(d.end_date)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge active={d.active} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* Toggle */}
                            <button
                              onClick={() => handleToggle(d)}
                              title={d.active ? 'Deactivate' : 'Activate'}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                d.active ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                d.active ? 'translate-x-4' : 'translate-x-0'
                              }`} />
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(d)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget({ id: d._id, name: d.name })}
                              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t px-5 py-3 flex items-center justify-between text-sm text-gray-600">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- Create / Edit Modal ---- */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-base font-semibold text-gray-900">
                  {editingId ? 'Edit Discount' : 'Create Discount'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{formError}</div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Diwali Sale — Gold Rings"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                {/* Scope */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apply To</label>
                  <div className="flex gap-3">
                    {(['product', 'category'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm((f) => ({ ...f, scope: s, product_ids: [], category: '' }))}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.scope === s
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {s === 'product' ? 'Specific Products' : 'All in Category'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product selector */}
                {form.scope === 'product' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.product_search}
                        onChange={(e) => setForm((f) => ({ ...f, product_search: e.target.value }))}
                        placeholder="Type product name…"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      {searching && (
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>
                      )}
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {searchResults.map((p) => (
                            <button
                              key={p._id}
                              onClick={() => addProduct(p)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                {p.image ? (
                                  <img
                                    src={getImageUrl(p.image)}
                                    alt={p.name}
                                    className="w-9 h-9 rounded-md object-cover bg-gray-100 border"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-md bg-gray-100 border flex items-center justify-center text-[10px] text-gray-400">
                                    No img
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 truncate">{p.name}</div>
                                  <div className="text-xs text-gray-400 truncate">
                                    {p.category ? p.category : '—'}
                                    {p.metal ? ` • ${p.metal}${p.purity ? ` (${p.purity})` : ''}` : ''}
                                    {getBasePrice(p) != null ? ` • ${fmtMoney(getBasePrice(p) as number)}` : ''}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedProducts.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Selected products ({selectedProducts.length})
                            {resolvingSelected && <span className="ml-2 text-gray-400">Resolving…</span>}
                          </div>
                          {selectedProductIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, product_ids: [] })); setSelectedProducts([]); }}
                              className="text-xs text-gray-500 hover:text-red-600"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div className="max-h-40 overflow-y-auto border rounded-lg divide-y bg-white">
                          {selectedProducts.map((p) => (
                            <div key={p._id} className="flex items-center gap-3 px-3 py-2">
                              {p.image ? (
                                <img
                                  src={getImageUrl(p.image)}
                                  alt={p.name}
                                  className="w-9 h-9 rounded-md object-cover bg-gray-100 border"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-gray-100 border flex items-center justify-center text-[10px] text-gray-400">
                                  No img
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                                <div className="text-xs text-gray-400 truncate">
                                  {p.category ? p.category : '—'}
                                  {p.metal ? ` • ${p.metal}${p.purity ? ` (${p.purity})` : ''}` : ''}
                                  {getBasePrice(p) != null ? ` • ${fmtMoney(getBasePrice(p) as number)}` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeProduct(p._id)}
                                className="text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                                aria-label={`Remove ${p.name}`}
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Category picker */}
                {form.scope === 'category' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="">Select a category</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c.toLowerCase()}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Discount type + value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type & Value</label>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border overflow-hidden">
                      {(['percentage', 'flat'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setForm((f) => ({ ...f, discount_type: t }))}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${
                            form.discount_type === t
                              ? 'bg-gray-900 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t === 'percentage' ? '% Off' : '₹ Flat'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={form.discount_type === 'percentage' ? 100 : undefined}
                      step="any"
                      value={form.discount_value}
                      onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                      placeholder={form.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-gray-700">Active immediately</span>
                  <button
                    onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      form.active ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.active ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 px-6 py-4 border-t">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Discount'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Delete Confirm Modal ---- */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Discount</h3>
              <p className="text-sm text-gray-600 mb-6">
                Delete <span className="font-medium text-gray-900">"{deleteTarget.name}"</span>?
                This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};

export default StoreApproveDiscountsPage;
