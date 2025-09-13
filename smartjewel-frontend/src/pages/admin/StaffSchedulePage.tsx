import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';

type Recurrence = 'weekly' | 'one_time';

interface ScheduleItem {
  id: string;
  staff_id: string;
  recurrence: Recurrence;
  days?: number[];
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  timezone: string;
  effective_from?: string; // ISO date
  effective_to?: string;   // ISO date
  store_id?: string;
  notes?: string;
}

const DAYS = [
  { v: 0, l: 'Sun', full: 'Sunday' },
  { v: 1, l: 'Mon', full: 'Monday' },
  { v: 2, l: 'Tue', full: 'Tuesday' },
  { v: 3, l: 'Wed', full: 'Wednesday' },
  { v: 4, l: 'Thu', full: 'Thursday' },
  { v: 5, l: 'Fri', full: 'Friday' },
  { v: 6, l: 'Sat', full: 'Saturday' },
];

export const StaffSchedulePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string>('');
  const [staffInfo, setStaffInfo] = useState<{full_name: string, email: string} | null>(null);
  const [form, setForm] = useState({
    recurrence: 'weekly' as Recurrence,
    days: [1,2,3,4,5] as number[],
    start_time: '09:30',
    end_time: '18:00',
    timezone: 'Asia/Kolkata',
    effective_from: '',
    effective_to: '',
    store_id: '',
    notes: '',
  });

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ items: ScheduleItem[] }>(`/api/staff/${id}/shift-schedules`);
      setItems(res.data.items || []);
    } catch (e) {
      console.error(e);
      const msg = (e as any)?.response?.data?.error || (e as any)?.message || 'Failed to load schedules';
      setError(typeof msg === 'string' ? msg : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffInfo = async () => {
    if (!id) return;
    try {
      const res = await api.get<{full_name: string, email: string}>(`/api/staff/${id}`);
      setStaffInfo(res.data);
    } catch (e) {
      console.error('Failed to load staff info:', e);
    }
  };

  useEffect(() => { 
    load(); 
    loadStaffInfo();
    /* eslint-disable-next-line */ 
  }, [id]);

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }));
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    // Validate form based on schedule type
    if (form.recurrence === 'one_time' && !form.effective_from) {
      setError('Start date is required for one-time schedules');
      return;
    }
    
    if (form.recurrence === 'weekly' && form.days.length === 0) {
      setError('Please select at least one day for weekly schedules');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        recurrence: form.recurrence,
        start_time: form.start_time,
        end_time: form.end_time,
        timezone: form.timezone,
      };
      
      if (form.recurrence === 'weekly') {
        payload.days = form.days;
      } else {
        // For one-time schedules, effective_from is required
        // Send dates as strings in YYYY-MM-DD format for backend compatibility
        payload.effective_from = form.effective_from || null;
        if (form.effective_to) payload.effective_to = form.effective_to;
      }
      
      if (form.store_id) payload.store_id = form.store_id;
      if (form.notes) payload.notes = form.notes;
      
      console.log('Sending payload:', payload); // Debug log
      
      // For debugging - let's also log the form data
      console.log('Form data:', {
        recurrence: form.recurrence,
        effective_from: form.effective_from,
        effective_to: form.effective_to,
        start_time: form.start_time,
        end_time: form.end_time
      });
      
      if (editingId) {
        await api.put(`/api/shift-schedules/${editingId}`, payload);
      } else {
        await api.post(`/api/staff/${id}/shift-schedules`, payload);
      }
      
      await load();
      setEditingId('');
      
      // Reset form after successful creation
      if (!editingId) {
        setForm({
          recurrence: 'weekly',
          days: [1,2,3,4,5],
          start_time: '09:30',
          end_time: '18:00',
          timezone: 'Asia/Kolkata',
          effective_from: '',
          effective_to: '',
          store_id: '',
          notes: '',
        });
      }
    } catch (e: any) {
      console.error('Schedule creation error:', e);
      console.error('Error response:', e?.response?.data);
      
      let errorMessage = 'Failed to create schedule';
      
      if (e?.response?.data?.error) {
        errorMessage = e.response.data.error;
      } else if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      
      // Handle specific API errors
      if (e?.response?.status === 400) {
        errorMessage = 'Invalid schedule data. Please check your inputs.';
      } else if (e?.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (sid: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await api.delete(`/api/shift-schedules/${sid}`);
      await load();
    } catch (e) {
      console.error(e);
      const msg = (e as any)?.response?.data?.error || (e as any)?.message || 'Failed to delete schedule';
      setError(typeof msg === 'string' ? msg : 'Failed to delete schedule');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getScheduleTypeColor = (recurrence: Recurrence) => {
    return recurrence === 'weekly' 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-fraunces">Shift Schedule</h1>
                {staffInfo && (
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                      {getInitials(staffInfo.full_name)}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{staffInfo.full_name}</p>
                      <p className="text-sm text-gray-500">{staffInfo.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Schedules</p>
              <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Schedule Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 font-fraunces">
                {editingId ? 'Edit Schedule' : 'Add New Schedule'}
              </h2>
              {editingId && (
                <button 
                  onClick={() => {
                    setEditingId('');
                    setForm({
                      recurrence: 'weekly',
                      days: [1,2,3,4,5],
                      start_time: '09:30',
                      end_time: '18:00',
                      timezone: 'Asia/Kolkata',
                      effective_from: '',
                      effective_to: '',
                      store_id: '',
                      notes: '',
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {error && (
              <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <form onSubmit={onCreate} className="space-y-6">
              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Schedule Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                      checked={form.recurrence === 'weekly'} 
                      onChange={() => setForm({...form, recurrence: 'weekly'})} 
                    />
                    <span className="text-sm font-medium text-gray-700">Weekly Recurring</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                      checked={form.recurrence === 'one_time'} 
                      onChange={() => setForm({...form, recurrence: 'one_time'})} 
                    />
                    <span className="text-sm font-medium text-gray-700">One-time</span>
                  </label>
                </div>
              </div>

              {/* Days Selection (Weekly) */}
              {form.recurrence === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Working Days</label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map(d => (
                      <button 
                        type="button" 
                        key={d.v} 
                        onClick={() => toggleDay(d.v)} 
                        className={`p-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                          form.days.includes(d.v)
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                        }`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range (One-time) */}
              {form.recurrence === 'one_time' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                      value={form.effective_from} 
                      onChange={e => setForm({...form, effective_from: e.target.value})} 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                      value={form.effective_to} 
                      onChange={e => setForm({...form, effective_to: e.target.value})} 
                    />
                  </div>
                </div>
              )}

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input 
                    type="time" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                    value={form.start_time} 
                    onChange={e => setForm({...form, start_time: e.target.value})} 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input 
                    type="time" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                    value={form.end_time} 
                    onChange={e => setForm({...form, end_time: e.target.value})} 
                    required
                  />
                </div>
              </div>

              {/* Additional Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                    value={form.timezone} 
                    onChange={e => setForm({...form, timezone: e.target.value})} 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store ID (Optional)</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
                    placeholder="Enter store ID" 
                    value={form.store_id} 
                    onChange={e => setForm({...form, store_id: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 resize-none" 
                  rows={3}
                  placeholder="Add any additional notes..."
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})} 
                />
              </div>

              <div className="flex space-x-3 pt-4">
                {editingId && (
                  <button 
                    type="button" 
                    className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200" 
                    onClick={() => {
                      setEditingId('');
                      setForm({
                        recurrence: 'weekly',
                        days: [1,2,3,4,5],
                        start_time: '09:30',
                        end_time: '18:00',
                        timezone: 'Asia/Kolkata',
                        effective_from: '',
                        effective_to: '',
                        store_id: '',
                        notes: '',
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Schedule' : 'Add Schedule'}
                </button>
              </div>
            </form>
          </div>

          {/* Schedule List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 font-fraunces">Current Schedules</h2>
              <div className="text-sm text-gray-500">
                {items.length} schedule{items.length !== 1 ? 's' : ''}
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No schedules found</h3>
                <p className="text-gray-500">Add a new schedule to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map(schedule => (
                  <div key={schedule.id} className="group bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-all duration-300 border border-gray-100 hover:border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getScheduleTypeColor(schedule.recurrence)}`}>
                            {schedule.recurrence === 'weekly' ? 'Weekly' : 'One-time'}
                          </span>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                          </div>
                        </div>
                        
                        {schedule.recurrence === 'weekly' && schedule.days && (
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-600">
                              {schedule.days.map(d => DAYS.find(x => x.v === d)?.full).join(', ')}
                            </span>
                          </div>
                        )}
                        
                        {schedule.effective_from && (
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-600">
                              {schedule.effective_from}
                              {schedule.effective_to && ` - ${schedule.effective_to}`}
                            </span>
                          </div>
                        )}
                        
                        {schedule.store_id && (
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-sm text-gray-600">Store: {schedule.store_id}</span>
                          </div>
                        )}
                        
                        {schedule.notes && (
                          <div className="flex items-start space-x-2">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span className="text-sm text-gray-600">{schedule.notes}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                          onClick={() => {
                            setEditingId(schedule.id);
                            
                            // Format dates for form input (YYYY-MM-DD format)
                            const formatDateForInput = (dateValue: any) => {
                              if (!dateValue) return '';
                              if (typeof dateValue === 'string') {
                                // If it's already a string, extract date part
                                return dateValue.split('T')[0];
                              }
                              if (dateValue instanceof Date) {
                                return dateValue.toISOString().split('T')[0];
                              }
                              return '';
                            };
                            
                            setForm({
                              recurrence: schedule.recurrence,
                              days: schedule.days || [],
                              start_time: schedule.start_time,
                              end_time: schedule.end_time,
                              timezone: schedule.timezone,
                              effective_from: formatDateForInput(schedule.effective_from),
                              effective_to: formatDateForInput(schedule.effective_to),
                              store_id: schedule.store_id || '',
                              notes: schedule.notes || '',
                            });
                            window.scrollTo({top: 0, behavior: 'smooth'});
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => onDelete(schedule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffSchedulePage;