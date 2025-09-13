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
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
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
      if (editingStaff) {
        const response = await api.put(`/api/staff/${editingStaff.id}`, {
          full_name: form.full_name,
          phone_number: form.phone_number || undefined,
          role_id: form.role_id,
          status: form.status,
        });
      } else {
        const response = await api.post('/api/staff', {
          full_name: form.full_name,
          email: form.email,
          phone_number: form.phone_number || undefined,
          role_id: form.role_id,
          status: form.status,
        });
      }
      setShowForm(false);
      setEditingStaff(null);
      setForm({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' });
      const fresh = await api.get<StaffResponse>(`/api/staff?page=1&limit=${limit}`);
      const filtered = { ...fresh.data, items: (fresh.data.items || []).filter(u => !['Customer','Admin'].includes(u.role?.role_name || '')) };
      setData(filtered);
      setPage(1);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to save';
      setSubmitError(typeof msg === 'string' ? msg : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    switch (roleName) {
      case 'Staff_L1': return 'Store Manager';
      case 'Staff_L2': return 'Sales Executive';
      case 'Staff_L3': return 'Inventory Staff';
      default: return roleName;
    }
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'Staff_L1': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Staff_L2': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Staff_L3': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-fraunces">Staff Management</h1>
              <p className="text-lg text-gray-600 mt-2">Manage your team members, roles, and permissions</p>
            </div>
            <button 
              onClick={() => {
                setEditingStaff(null);
                setForm({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' });
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data.items.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Staff</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{data.items.filter(u => u.status === 'active').length}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Store Managers</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{data.items.filter(u => u.role?.role_name === 'Staff_L1').length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sales Team</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{data.items.filter(u => u.role?.role_name === 'Staff_L2').length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                placeholder="Search staff members..." 
                value={query} 
                onChange={e => { setPage(1); setQuery(e.target.value); }} 
              />
            </div>
            
            <select 
              className="py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
              value={status} 
              onChange={e => { setPage(1); setStatus(e.target.value); }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            
            <select 
              className="py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
              value={roleId} 
              onChange={e => { setPage(1); setRoleId(e.target.value); }}
            >
              <option value="">All Roles</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {getRoleDisplayName(r.role_name)}
                </option>
              ))}
            </select>
            
            <button 
              className="py-3 px-6 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg" 
              onClick={() => setPage(1)}
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))
          ) : data.items.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff members found</h3>
              <p className="text-gray-500">Try adjusting your search criteria or add a new staff member.</p>
            </div>
          ) : data.items.map((staff) => (
            <div key={staff.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(staff.full_name)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{staff.full_name}</h3>
                  <p className="text-sm text-gray-500">{staff.email}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  staff.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}>
                  {staff.status}
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm text-gray-600">{staff.phone_number || 'No phone number'}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                  </svg>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(staff.role?.role_name || '')}`}>
                    {getRoleDisplayName(staff.role?.role_name || '')}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigate(`/admin/staff/${staff.id}/schedule`)}
                  className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors duration-200"
                >
                  Schedule
                </button>
                <button 
                  onClick={() => {
                    setEditingStaff(staff);
                    setForm({
                      full_name: staff.full_name,
                      email: staff.email,
                      phone_number: staff.phone_number || '',
                      role_id: staff.role?._id || '',
                      status: staff.status
                    });
                    setShowForm(true);
                  }}
                  className="flex-1 py-2 px-3 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-sm text-gray-600">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} staff members
          </div>
          <div className="flex space-x-2">
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className={`px-4 py-2 rounded-lg border font-medium transition-all duration-300 ${
                page <= 1 
                  ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
                  : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              Previous
            </button>
            <button 
              disabled={(page * limit) >= data.total} 
              onClick={() => setPage(p => p + 1)} 
              className={`px-4 py-2 rounded-lg border font-medium transition-all duration-300 ${
                (page * limit) >= data.total 
                  ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
                  : 'text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 font-fraunces">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setEditingStaff(null);
                  setForm({ full_name: '', email: '', phone_number: '', role_id: '', status: 'active' });
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={onSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {submitError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                  placeholder="Enter full name" 
                  value={form.full_name} 
                  onChange={e => setForm({...form, full_name: e.target.value})} 
                  required 
                />
              </div>
              
              {!editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                    type="email" 
                    placeholder="Enter email address" 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    required 
                  />
                </div>
              )}
              
              {editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500">
                    {form.email}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                  placeholder="Enter phone number (optional)" 
                  value={form.phone_number} 
                  onChange={e => setForm({...form, phone_number: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                  value={form.role_id} 
                  onChange={e => setForm({...form, role_id: e.target.value})} 
                  required
                >
                  <option value="">Select a role</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {getRoleDisplayName(r.role_name)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300" 
                  value={form.status} 
                  onChange={e => setForm({...form, status: e.target.value as 'active'|'inactive'})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button 
                  type="button" 
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200" 
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button 
                  disabled={submitting} 
                  type="submit" 
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-medium hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? 'Saving...' : (editingStaff ? 'Update Staff' : 'Add Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDirectory;