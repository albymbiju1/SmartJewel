import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

type OrderRow = {
  orderId: string;
  customer?: { name?: string; email?: string; phone?: string };
  amount: number;
  createdAt?: string;
  status?: string | null;
  cancellation?: {
    requested?: boolean;
    reason?: string;
    requestedAt?: string;
    approved?: boolean;
    approvedAt?: string;
    rejectedAt?: string;
    adminNotes?: string;
    refundProcessed?: boolean;
    refundDetails?: {
      refundId?: string;
      amount?: number;
      status?: string;
      failed?: boolean;
      message?: string;
      manualRefundRequired?: boolean;
      noRefundRequired?: boolean;
      processedAt?: string;
    };
  };
};

type OrdersResponse = {
  orders: Array<OrderRow & { statusHistory?: Array<{ status: string; timestamp?: string }> }>;
  pagination: { page: number; limit: number; total: number; pages: number };
};

const STATUS_OPTIONS = ['created', 'paid', 'shipped', 'delivered', 'cancelled'];
const UPDATE_OPTIONS = ['shipped', 'delivered', 'cancelled']; // exclude created/paid

const badgeClass = (s?: string | null) => {
  const v = (s || '').toLowerCase();
  switch (v) {
    case 'paid':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'shipped':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'delivered':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'created':
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
};

export const StoreOrdersPage: React.FC = () => {
  const navigate = useNavigate();

  // table state
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  // filters
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // sorting
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount' | 'customer.name'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  // modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');

  // cancellation modal
  const [cancelModal, setCancelModal] = useState<{ open: boolean; orderId: string; action: 'approve' | 'reject'; notes: string; loading: boolean }>({
    open: false,
    orderId: '',
    action: 'approve',
    notes: '',
    loading: false,
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page, limit, sortBy, sortDir };
      if (status) params.status = status;
      if (q) params.q = q;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get<OrdersResponse>('/api/store-manager/orders', { params });
      const data = res.data;
      const normalized = (data.orders || []).map((o) => ({
        orderId: o.orderId || '',
        customer: o.customer,
        amount: o.amount || 0,
        createdAt: o.createdAt,
        status: o.status || (o.statusHistory && o.statusHistory[o.statusHistory.length - 1]?.status) || 'created',
        cancellation: o.cancellation || undefined,
      } as OrderRow));
      setRows(normalized);
      setTotal(data.pagination?.total || 0);
      
      // clear selection if out of page
      setSelected({});
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (orderId: string, action: 'approve' | 'reject') => {
    setCancelModal({ open: true, orderId, action, notes: '', loading: false });
  };
  const closeCancelModal = () => setCancelModal({ open: false, orderId: '', action: 'approve', notes: '', loading: false });

  useEffect(() => { fetchOrders(); }, [page, limit, status, q, from, to, sortBy, sortDir]);

  const toggleAll = (checked: boolean) => {
    const m: Record<string, boolean> = {};
    rows.forEach((r) => { m[r.orderId] = checked; });
    setSelected(m);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((s) => ({ ...s, [id]: checked }));
  };

  const doUpdateStatus = async (ids: string[], newStatus: string) => {
    let hasError = false;
    for (const id of ids) {
      try {
        await api.patch(`/api/store-manager/orders/${id}/status`, { status: newStatus });
      } catch (e) {
        hasError = true;
        console.error(`Failed to update status for order ${id}:`, e);
      }
    }
    if (hasError) {
      // Show error message
    }
    await fetchOrders();
  };

  const formatDate = (s?: string | null) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s || '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const MMM = months[d.getMonth()];
    const yyyy = d.getFullYear();
    let hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    const hhStr = String(hh).padStart(2, '0');
    return `${dd} ${MMM} ${yyyy}, ${hhStr}:${mm} ${ampm}`; // e.g., 30 Sep 2025, 02:33 pm
  };

  // Truncate email for display
  const truncateEmail = (email: string, maxLength: number = 20) => {
    if (!email) return '';
    if (email.length <= maxLength) return email;
    const [user, domain] = email.split('@');
    if (user.length > maxLength - 7) {
      return `${user.substring(0, maxLength - 7)}...@${domain}`;
    }
    return email;
  };

  return (
    <RoleBasedNavigation>
      <div className="space-y-6 px-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Store Orders</h1>
            <p className="text-gray-600 text-sm">Manage orders for your store</p>
          </div>
          
          {/* Filters */}
          <div className="filters flex flex-wrap items-center gap-3 p-3 border-b border-gray-200 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Search</label>
              <div className="relative">
                <input 
                  placeholder="Customer / Order ID" 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)} 
                  className="border rounded px-2 py-1.5 text-sm pl-8" 
                />
                <svg className="w-4 h-4 absolute left-2 top-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border rounded px-2 py-1.5 text-sm">
                <option value="createdAt">Date</option>
                <option value="amount">Amount</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)} className="border rounded px-2 py-1.5 text-sm">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            
            <button 
              onClick={() => { setPage(1); fetchOrders(); }} 
              className="h-8 px-3 bg-gray-100 rounded border text-sm whitespace-nowrap"
            >
              Apply Filters
            </button>
          </div>
          
          {/* Bulk Actions */}
          <div className="flex items-center gap-3 mb-4 p-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} checked={rows.length > 0 && selectedIds.length === rows.length} />
              <span className="text-sm text-gray-600">Select all</span>
            </div>
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">Bulk status…</option>
              {UPDATE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <button disabled={!nextStatus || selectedIds.length === 0} onClick={() => setConfirmOpen(true)} className="h-8 px-3 text-sm rounded bg-amber-600 text-white disabled:opacity-50">
              Update Selected
            </button>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto rounded-lg border shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-gray-600">
                  <th className="py-2 px-3 w-10"></th>
                  <th className="py-2 px-3">🧾 Order ID</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3 text-right">💰 Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">📅 Date</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="py-6 px-3" colSpan={7}>Loading…</td></tr>
                ) : error ? (
                  <tr><td className="py-6 px-3 text-red-600" colSpan={7}>{error}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="py-6 px-3 text-gray-600" colSpan={7}>No orders found.</td></tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={r.orderId} className="hover:bg-gray-50">
                      <td className="h-14 align-middle px-3">
                        <input type="checkbox" checked={!!selected[r.orderId]} onChange={(e) => toggleOne(r.orderId, e.target.checked)} />
                      </td>
                      <td className="h-14 align-middle px-3 font-mono text-xs max-w-[120px] truncate" title={r.orderId}>{r.orderId}</td>
                      <td className="h-14 align-middle px-3">
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[160px]" title={r.customer?.name}>{r.customer?.name || '—'}</span>
                          <span className="text-gray-600 text-xs truncate max-w-[160px]" title={r.customer?.email}>
                            {truncateEmail(r.customer?.email || '')}
                          </span>
                        </div>
                      </td>
                      <td className="h-14 align-middle px-3 whitespace-nowrap text-right">₹{(r.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="h-14 align-middle px-3">
                        <div className="flex flex-wrap gap-1">
                          <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border min-w-[80px] ${badgeClass(r.status)}`}>{(r.status || 'created')}</span>
                          {/* Show at most one cancellation badge; if status itself is 'cancellation requested', don't render extra */}
                          {r.cancellation?.requested && !r.cancellation?.approved && !r.cancellation?.rejectedAt && (r.status || '').toLowerCase() !== 'cancellation requested' && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-yellow-100 text-yellow-800 border-yellow-200">cancellation requested</span>
                          )}
                          {r.cancellation?.approved && (r.status || '').toLowerCase() !== 'cancelled' && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-red-100 text-red-800 border-red-200">cancelled</span>
                          )}
                          {r.cancellation?.rejectedAt && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-gray-100 text-gray-800 border-gray-200">cancellation rejected</span>
                          )}
                          {r.cancellation?.approved && r.cancellation?.refundDetails?.refundId && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-blue-100 text-blue-800 border-blue-200">
                              {r.cancellation.refundDetails.status === 'processed' ? '💰 refunded' : '⏳ refund processing'}
                            </span>
                          )}
                          {r.cancellation?.approved && r.cancellation?.refundDetails?.failed && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-red-100 text-red-800 border-red-200">❌ refund failed</span>
                          )}
                          {r.cancellation?.approved && r.cancellation?.refundDetails?.manualRefundRequired && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full border bg-orange-100 text-orange-800 border-orange-200">⚠️ manual refund</span>
                          )}
                        </div>
                      </td>
                      <td className="h-14 align-middle px-3 whitespace-nowrap tabular-nums text-xs">{formatDate(r.createdAt ?? undefined)}</td>
                      <td className="h-14 align-middle px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => navigate(`/order-details/${r.orderId}`)} 
                            className="p-1.5 border rounded hover:bg-gray-100" 
                            title="View Order"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          
                          {/* Hide status dropdown while cancellation is pending or order is already cancelled */}
                          {!(r.cancellation?.requested && !r.cancellation?.approved && !r.cancellation?.rejectedAt) && (r.status || '').toLowerCase() !== 'cancelled' && (
                            <div className="relative">
                              <select 
                                className="p-1.5 border rounded hover:bg-gray-100" 
                                value="" 
                                onChange={async (e) => { 
                                  const val = e.target.value; 
                                  if (!val) return; 
                                  await doUpdateStatus([r.orderId], val); 
                                  e.currentTarget.value=''; 
                                }}
                                title="Update Status"
                              >
                                <option value="">Update…</option>
                                {UPDATE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                            </div>
                          )}
                          
                          {r.cancellation?.requested && !r.cancellation?.approved && !r.cancellation?.rejectedAt && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => openCancelModal(r.orderId, 'approve')} 
                                className="p-1.5 border border-green-300 text-green-700 rounded hover:bg-green-50" 
                                title="Approve Cancellation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button 
                                onClick={() => openCancelModal(r.orderId, 'reject')} 
                                className="p-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50" 
                                title="Reject Cancellation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 p-2">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} orders
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={page<=1} 
                onClick={() => setPage((p) => Math.max(1, p-1))} 
                className="px-3 py-1.5 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <span className="text-sm">Page {page} of {Math.ceil(total / limit) || 1}</span>
              <button 
                disabled={(page*limit) >= total} 
                onClick={() => setPage((p) => p+1)} 
                className="px-3 py-1.5 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
              <select 
                value={limit} 
                onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }} 
                className="ml-2 border rounded px-2 py-1 text-sm"
              >
                {[10,20,50,100].map(n => (<option key={n} value={n}>{n}/page</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Confirm modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm status update</h3>
              <p className="text-sm text-gray-600 mb-4">Update {selectedIds.length} selected order(s) to <span className="font-semibold">{nextStatus || '—'}</span>?</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={async () => { await doUpdateStatus(selectedIds, nextStatus); setConfirmOpen(false); setNextStatus(''); }} className="px-4 py-2 bg-amber-600 text-white rounded">Update</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleBasedNavigation>
  );
};

export default StoreOrdersPage;