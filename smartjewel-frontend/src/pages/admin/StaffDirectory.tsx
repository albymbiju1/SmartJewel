import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

interface StaffItem {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  status: 'active' | 'inactive';
  role?: { _id: string; role_name: string } | null;
}

interface StaffResponse {
  items: StaffItem[];
  page: number;
  limit: number;
  total: number;
}

export const StaffDirectory: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('');
  const [roleId, setRoleId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StaffResponse>({ items: [], page: 1, limit: 10, total: 0 });
  const [roles, setRoles] = useState<{ id: string; role_name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' as 'active'|'inactive' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const navigate = useNavigate();

  const qp = useMemo(() => {
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (status) p.set('status', status);
    if (roleId) p.set('role_id', roleId);
    p.set('page', String(page));
    p.set('limit', String(limit));
    return p.toString();
  }, [query, status, roleId, page, limit]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<StaffResponse>(`/api/staff?${qp}`);
      // Exclude customers from staff dashboard view
      const filtered = { ...res.data, items: (res.data.items || []).filter(u => !['Customer','Admin'].includes(u.role?.role_name || '')) };
      setData(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [qp]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<{ items: { id: string; role_name: string }[] }>("/api/roles");
        // Only expose staff roles in the dropdown (no Admin/Customer)
        const allowed = new Set(['Staff_L1','Staff_L2','Staff_L3']);
        setRoles((r.data.items || []).filter(x => allowed.has(x.role_name)));
      } catch (e) { console.error(e); }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post('/api/staff', {
        full_name: form.full_name,
        email: form.email,
        phone_number: form.phone_number || undefined,
        role_id: form.role_id,
        status: form.status,
      });
      setShowForm(false);
      setForm({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' });
      // Fetch a fresh first page explicitly to reflect the new row
      const fresh = await api.get<StaffResponse>(`/api/staff?page=1&limit=${limit}`);
      const filtered = { ...fresh.data, items: (fresh.data.items || []).filter(u => !['Customer','Admin'].includes(u.role?.role_name || '')) };
      setData(filtered);
      setPage(1);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.message || 'Failed to save';
      setSubmitError(typeof msg === 'string' ? msg : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Directory</h1>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>setShowForm(true)}>Add Staff</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="h-10 border border-gray-200 rounded-md px-3" placeholder="Search name/email/phone" value={query} onChange={e=>{ setPage(1); setQuery(e.target.value); }} />
          <select className="h-10 border border-gray-200 rounded-md px-3" value={status} onChange={e=>{ setPage(1); setStatus(e.target.value); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="h-10 border border-gray-200 rounded-md px-3" value={roleId} onChange={e=>{ setPage(1); setRoleId(e.target.value); }}>
            <option value="">All Roles</option>
            {roles.map(r=> (
              <option key={r.id} value={r.id}>
                {r.role_name === 'Staff_L1' ? 'Store Manager' : r.role_name === 'Staff_L2' ? 'Sales Executive' : r.role_name === 'Staff_L3' ? 'Inventory Staff' : r.role_name}
              </option>
            ))}
          </select>
          <div className="flex items-center">
            <button className="w-full h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700" onClick={()=>setPage(1)}>Filter</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>Loading...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>No records</td></tr>
            ) : data.items.map((u)=> (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-700">{u.email}</td>
                <td className="px-4 py-3 text-gray-700">{u.phone_number || '-'}</td>
                <td className="px-4 py-3">{u.role?.role_name === 'Staff_L1' ? 'Store Manager' : u.role?.role_name === 'Staff_L2' ? 'Sales Executive' : u.role?.role_name === 'Staff_L3' ? 'Inventory Staff' : (u.role?.role_name || '-')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${u.status==='active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button className="text-sm text-blue-700 hover:underline" onClick={()=>navigate(`/admin/staff/${u.id}/schedule`)}>Schedule</button>
                    <button className="text-sm text-gray-700 hover:underline" onClick={()=>{/* TODO: edit */}}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">Page {data.page} of {Math.ceil((data.total||0)/(data.limit||1) || 1)}</div>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className={`px-3 py-1.5 rounded-md border ${page<=1? 'text-gray-400 border-gray-200':'text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Prev</button>
          <button disabled={(page*limit)>=data.total} onClick={()=>setPage(p=>p+1)} className={`px-3 py-1.5 rounded-md border ${(page*limit)>=data.total? 'text-gray-400 border-gray-200':'text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Next</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Staff</h2>
              <button onClick={()=>setShowForm(false)} className="text-gray-500 hover:text-gray-800">✕</button>
            </div>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
              {submitError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{submitError}</div>
              )}
              <input className="h-10 border border-gray-200 rounded-md px-3" placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} required />
              <input className="h-10 border border-gray-200 rounded-md px-3" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required />
              <input className="h-10 border border-gray-200 rounded-md px-3" placeholder="Phone (optional)" value={form.phone_number} onChange={e=>setForm({...form, phone_number: e.target.value})} />
              <select className="h-10 border border-gray-200 rounded-md px-3" value={form.role_id} onChange={e=>setForm({...form, role_id: e.target.value})} required>
                <option value="">Select Role</option>
                {roles.map(r=> (
                  <option key={r.id} value={r.id}>
                    {r.role_name === 'Staff_L1' ? 'Store Manager' : r.role_name === 'Staff_L2' ? 'Sales Executive' : r.role_name === 'Staff_L3' ? 'Inventory Staff' : r.role_name}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button type="button" className="px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>setShowForm(false)}>Cancel</button>
                <button disabled={submitting} type="submit" className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">{submitting? 'Saving...':'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffDirectory;
