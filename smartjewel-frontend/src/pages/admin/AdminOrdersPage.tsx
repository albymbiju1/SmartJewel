import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';
import { useToast } from '../../components/Toast';

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

export const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

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
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

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
      const res = await api.get<OrdersResponse>('/api/admin/orders', { params });
      const data = res.data;
      const normalized = (data.orders || []).map((o) => ({
        orderId: o.orderId,
        customer: o.customer,
        amount: o.amount || 0,
        createdAt: o.createdAt,
        status: o.status || (o.statusHistory && o.statusHistory[o.statusHistory.length - 1]?.status) || 'created',
        cancellation: (o as any).cancellation || undefined,
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
  const handleCancelAction = async () => {
    if (!cancelModal.notes.trim()) {
      toast.info('Please add admin notes');
      return;
    }
    try {
      setCancelModal((m) => ({ ...m, loading: true }));
      await api.patch(`/api/admin/orders/${cancelModal.orderId}/cancel`, { action: cancelModal.action, notes: cancelModal.notes.trim() });
      toast.success(cancelModal.action === 'approve' ? 'Cancellation approved' : 'Cancellation rejected');
      await fetchOrders();
      closeCancelModal();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Failed to process cancellation');
      setCancelModal((m) => ({ ...m, loading: false }));
    }
  };

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
    for (const id of ids) {
      try {
        await api.patch(`/api/admin/orders/${id}/status`, { status: newStatus });
      } catch (e) {
        // continue; show error later if needed
      }
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

  return (
    <RoleBasedNavigation>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <h1 className="text-2xl font-bold text-gray-900">View Orders</h1>
              <p className="text-gray-600">Browse and manage all customer orders</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 h-10 text-sm w-full">
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-3 h-10 text-sm w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-3 h-10 text-sm w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <input placeholder="Customer / Order ID" value={q} onChange={(e) => setQ(e.target.value)} className="border rounded px-3 h-10 text-sm w-full" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Sort</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border rounded px-3 h-10 text-sm w-full">
                  <option value="createdAt">Date</option>
                  <option value="amount">Amount</option>
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)} className="border rounded px-3 h-10 text-sm w-full">
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-1 md:justify-self-end">
              <button onClick={() => { setPage(1); fetchOrders(); }} className="h-10 px-4 bg-gray-100 rounded border text-sm w-full md:w-auto">Apply</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} checked={rows.length > 0 && selectedIds.length === rows.length} />
              <span className="text-sm text-gray-600">Select all</span>
            </div>
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="border rounded px-3 h-10 text-sm">
              <option value="">Bulk status…</option>
              {UPDATE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <button disabled={!nextStatus || selectedIds.length === 0} onClick={() => setConfirmOpen(true)} className="h-10 px-3 text-sm rounded bg-amber-600 text-white disabled:opacity-50">Update Selected</button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 px-3 w-10"></th>
                  <th className="py-2 px-3">Order ID</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Date</th>
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
                    <tr key={r.orderId} className={`odd:bg-white even:bg-gray-50`}>
                      <td className="h-14 align-middle px-3">
                        <input type="checkbox" checked={!!selected[r.orderId]} onChange={(e) => toggleOne(r.orderId, e.target.checked)} />
                      </td>
                      <td className="h-14 align-middle px-3 font-mono text-xs max-w-[160px] truncate" title={r.orderId}>{r.orderId}</td>
                      <td className="h-14 align-middle px-3">
                        <div className="flex items-center gap-2 text-gray-900 truncate max-w-[260px] whitespace-nowrap" title={`${r.customer?.name || ''}${r.customer?.email ? ' · ' + r.customer?.email : ''}`}>
                          <span className="font-medium truncate">{r.customer?.name || '—'}</span>
                          {r.customer?.email && <span className="text-gray-400">·</span>}
                          {r.customer?.email && <span className="text-gray-600 truncate">{r.customer?.email}</span>}
                        </div>
                      </td>
                      <td className="h-14 align-middle px-3 whitespace-nowrap">₹{(r.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="h-14 align-middle px-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full border min-w-[96px] ${badgeClass(r.status)}`}>{(r.status || 'created')}</span>
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
                      <td className="h-14 align-middle px-3 whitespace-nowrap tabular-nums">{formatDate(r.createdAt ?? undefined)}</td>
                      <td className="h-14 align-middle px-3 text-right">
                        <div className="inline-flex gap-2">
                          <button onClick={() => navigate(`/order-details/${r.orderId}`)} className="px-3 py-1.5 border rounded">View</button>
                          {/* Hide status dropdown while cancellation is pending or order is already cancelled */}
                          {!(r.cancellation?.requested && !r.cancellation?.approved && !r.cancellation?.rejectedAt) && (r.status || '').toLowerCase() !== 'cancelled' && (
                            <div className="relative">
                              <select className="px-3 py-1.5 border rounded" value="" onChange={async (e) => { const val = e.target.value; if (!val) return; await doUpdateStatus([r.orderId], val); e.currentTarget.value=''; }}>
                                <option value="">Update status…</option>
                                {UPDATE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                            </div>
                          )}
                          {r.cancellation?.requested && !r.cancellation?.approved && !r.cancellation?.rejectedAt && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openCancelModal(r.orderId, 'approve')} className="px-3 py-1.5 border border-green-300 text-green-700 rounded">Approve</button>
                              <button onClick={() => openCancelModal(r.orderId, 'reject')} className="px-3 py-1.5 border border-red-300 text-red-700 rounded">Reject</button>
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Total: {total}</div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={() => setPage((p) => Math.max(1, p-1))} className="px-3 py-1.5 border rounded disabled:opacity-50">Prev</button>
              <span className="text-sm">Page {page}</span>
              <button disabled={(page*limit) >= total} onClick={() => setPage((p) => p+1)} className="px-3 py-1.5 border rounded disabled:opacity-50">Next</button>
              <select value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }} className="ml-2 border rounded px-2 py-1 text-sm">
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
      {/* Cancellation Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeCancelModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{cancelModal.action === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation'}</h3>
            <p className="text-sm text-gray-600 mb-4">Add admin notes for this action.</p>
            <textarea
              value={cancelModal.notes}
              onChange={(e) => setCancelModal((m) => ({ ...m, notes: e.target.value }))}
              placeholder="Admin notes..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeCancelModal} className="px-4 py-2 border rounded">Close</button>
              <button onClick={handleCancelAction} disabled={cancelModal.loading || !cancelModal.notes.trim()} className="px-4 py-2 bg-amber-600 text-white rounded disabled:opacity-50">
                {cancelModal.loading ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleBasedNavigation>
  );
};

export default AdminOrdersPage;
