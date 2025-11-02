import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_SIZE = 10;

export interface StaffItem {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  status: 'active' | 'inactive';
  role?: { _id: string; role_name: string } | null;
  store_id?: string | null;
}

export interface StaffResponse {
  items: StaffItem[];
  page: number;
  limit: number;
  total: number;
}

export const StaffDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();
  // UI/State
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [totalStaff, setTotalStaff] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<{ id: string; role_name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', status: 'active' });

  // When editing staff, populate role_id from staff data
  useEffect(() => {
    if (editingStaff) {
      setForm({
        full_name: '',
        email: '',
        phone_number: '',
        role_id: editingStaff.role_id || '',
        status: editingStaff.status || 'active'
      });
    }
  }, [editingStaff]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [showAppoint, setShowAppoint] = useState(false);
  const [appointing, setAppointing] = useState<StaffItem | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [savingAppoint, setSavingAppoint] = useState(false);
  const [appointError, setAppointError] = useState('');
  // Fetch roles
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      api.get<{ items: { id: string; role_name: string }[] }>('/api/roles')
        .then((r) => setRoles(r.data.items.filter(r => ['Staff_L1', 'Staff_L2', 'Staff_L3'].includes(r.role_name))))
        .catch(() => setError('Failed to load staff roles.'));
    }
  }, [isAuthLoading, isAuthenticated]);
  // Fetch stores
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      api.get<{ stores: { id: string; name: string }[] }>('/stores')
        .then(res => setStores(res.data.stores || []))
        .catch(() => { /* ignore */ });
    }
  }, [isAuthLoading, isAuthenticated]);
  // Fetch staff list
  const loadStaff = () => {
    setLoading(true);
    setError('');
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (status) p.set('status', status);
    if (roleId) p.set('role_id', roleId);
    p.set('page', page.toString());
    p.set('limit', PAGE_SIZE.toString());
    api.get<StaffResponse>(`/api/staff?${p.toString()}`)
      .then((r) => {
        setStaff(r.data.items);
        setTotalStaff(r.data.total);
      })
      .catch((e) => {
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError('You are not authorized to view staff. Contact admin.');
        } else {
          setError('Failed to load staff list.');
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      loadStaff();
    }
    // eslint-disable-next-line
  }, [isAuthLoading, isAuthenticated, query, status, roleId, page]);
  // Modal logic
  const openForm = (staff?: StaffItem) => {
    setShowForm(true);
    setEditingStaff(staff || null);
    setForm(staff ? {
      full_name: staff.full_name,
      email: staff.email,
      phone_number: staff.phone_number || '',
      role_id: staff.role?._id || '',
      status: staff.status
    } : { full_name: '', email: '', phone_number: '', role_id: '', status: 'active' });
    setSubmitError('');
  };
  const closeForm = () => { setShowForm(false); setEditingStaff(null); setForm({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' }); };
  // Add/Edit submit
  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      if (editingStaff) {
        await api.put(`/api/staff/${editingStaff.id}`, { ...form });
      } else {
        await api.post('/api/staff', form);
      }
      closeForm();
      loadStaff();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };
  // Store assign modal
  const openAppointStore = (staff: StaffItem) => {
    setAppointing(staff);
    setSelectedStoreId(staff.store_id || '');
    setAppointError('');
    setShowAppoint(true);
  };
  const onAppointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointing) return;
    setSavingAppoint(true);
    setAppointError('');
    try {
      await api.put(`/api/staff/${appointing.id}`, { store_id: selectedStoreId || null });
      setShowAppoint(false);
      setAppointing(null);
      setSelectedStoreId('');
      loadStaff();
    } catch (err: any) {
      setAppointError('Failed to set store');
    } finally {
      setSavingAppoint(false);
    }
  };
  // UI helpers
  const getRoleDisplay = (role: string) => role === 'Staff_L1' ? 'Store Manager' : role === 'Staff_L2' ? 'Sales Executive' : role === 'Staff_L3' ? 'Inventory Staff' : role;
  const pageCount = Math.ceil(totalStaff / PAGE_SIZE);
  if (isAuthLoading) {
    return <div className="text-center py-24 text-blue-600">Checking authentication...</div>;
  }
  if (!isAuthenticated) {
    return <div className="text-center py-24 text-red-600">Please log in to view staff directory.</div>;
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 font-fraunces">Staff Management</h1>
          <button onClick={()=>openForm()} className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-4 mb-6 flex-wrap">
          <input className="w-full max-w-xs pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" placeholder="Search name/email/phone..." value={query} onChange={e=>{setPage(1);setQuery(e.target.value)}} />
          <select className="py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" value={roleId} onChange={e=>{setPage(1);setRoleId(e.target.value)}}>
            <option value="">All Roles</option>
            {roles.map(r=>(<option key={r.id} value={r.id}>{getRoleDisplay(r.role_name)}</option>))}
          </select>
        </div>
        {/* Main Content */}
        {loading && (<div className="text-center py-12 text-blue-600">Loading staff...</div>)}
        {error && (<div className="text-center text-red-600 py-6">{error}</div>)}
        {!loading && !error && staff.length===0 && (<div className="text-center text-gray-500 py-12">No staff found. Try another search or add a staff member.</div>)}
        {!loading && !error && staff.length>0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staff.map(staff => (<div key={staff.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg flex flex-col">
              <div className="flex items-center mb-3 gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">{(staff.full_name || '').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{staff.full_name || 'Unknown Name'}</h3>
                  <p className="text-sm text-gray-500">{staff.email}</p>
                  {staff.phone_number && (<p className="text-xs text-gray-500">{staff.phone_number}</p>)}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${staff.status==='active'? 'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-gray-50 text-gray-700 border-gray-200'}`}>{staff.status}</span>
              </div>
              <div className="flex items-center gap-2 mb-2"><span className="px-2 py-1 rounded text-xs font-medium border bg-gray-50 border-gray-200">{getRoleDisplay(staff.role?.role_name||'')}</span></div>
              <div className="flex gap-2 mt-auto">
                <button onClick={()=>openForm(staff)} className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-200 border border-gray-200">Edit</button>
                <button onClick={()=>openAppointStore(staff)} className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 border border-emerald-200">Assign Store</button>
              </div>
            </div>))}
          </div>
        )}
        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex justify-center gap-2 my-8">
            <button disabled={page<=1} onClick={()=>setPage(Math.max(1, page-1))} className="px-4 py-2 rounded-lg border font-medium transition-all disabled:text-gray-300 disabled:border-gray-100 disabled:bg-gray-50">Previous</button>
            <span className="px-3 py-2 text-gray-600 font-medium">Page {page} of {pageCount}</span>
            <button disabled={page>=pageCount} onClick={()=>setPage(page+1)} className="px-4 py-2 rounded-lg border font-medium transition-all disabled:text-gray-300 disabled:border-gray-100 disabled:bg-gray-50">Next</button>
          </div>
        )}
      </div>
      {/* Add/Edit Modal */}
      {showForm && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"><div className="flex items-center justify-between p-6 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-900 font-fraunces">{editingStaff ? 'Edit Staff Member':'Add New Staff Member'}</h2><button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div><form onSubmit={onFormSubmit} className="p-6 space-y-4">{submitError && (<div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{submitError}</div>)}<div><label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label><input className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all bg-white" required placeholder="Enter full name" value={form.full_name} onChange={e=>setForm(f=>({...f, full_name:e.target.value}))}/></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label><input className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all bg-white" type="email" required placeholder="Enter email address" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}/></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label><input className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all bg-white" placeholder="Enter phone number (optional)" value={form.phone_number} onChange={e=>setForm(f=>({...f, phone_number:e.target.value}))}/></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Role</label><select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all bg-white" value={form.role_id} onChange={e=>setForm(f=>({...f, role_id:e.target.value}))}><option value="">Select a role</option>{roles.map(r=>(<option key={r.id} value={r.id}>{getRoleDisplay(r.role_name)}</option>))}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-2">Status</label><select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white" value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="flex space-x-3 pt-4"><button type="button" className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200" onClick={closeForm}>Cancel</button><button disabled={submitting} type="submit" className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-800 transition-all disabled:opacity-50">{submitting?'Saving...':(editingStaff?'Update Staff':'Add Staff')}</button></div></form></div></div>)}
      {/* Appoint to Store Modal */}
      {showAppoint && appointing && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="w-full max-w-md bg-white rounded-2xl shadow-2xl"><div className="flex items-center justify-between p-6 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-900 font-fraunces">Appoint to Store</h2><button onClick={()=>{ setShowAppoint(false); setAppointing(null); setSelectedStoreId(''); setAppointError(''); }} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div><form onSubmit={onAppointSubmit} className="p-6 space-y-4">{appointError && (<div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{appointError}</div>)}<div><label className="block text-sm font-medium text-gray-700 mb-2">Select Store</label><select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all bg-white" value={selectedStoreId} onChange={e=>setSelectedStoreId(e.target.value)}><option value="">Unassigned</option>{stores.map(s=>(<option key={s.id} value={s.id}>{s.name}</option>))}</select></div><div className="flex space-x-3 pt-2"><button type="button" onClick={()=>{ setShowAppoint(false); setAppointing(null); setSelectedStoreId(''); }} className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Cancel</button><button disabled={savingAppoint} type="submit" className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-green-800 transition-all disabled:opacity-50">{savingAppoint ? 'Saving...' : 'Save'}</button></div></form></div></div>)}
    </div>
  );
};

export default StaffDirectory;