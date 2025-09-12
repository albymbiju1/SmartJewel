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

// Using shared axios instance that carries Authorization header

const DAYS = [
  { v: 0, l: 'Sun' },
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
];

export const StaffSchedulePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string>('');
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }));
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
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
        // one_time uses effective_from as the specific date (optional effective_to)
        if (form.effective_from) payload.effective_from = form.effective_from;
        if (form.effective_to) payload.effective_to = form.effective_to;
      }
      if (form.store_id) payload.store_id = form.store_id;
      if (form.notes) payload.notes = form.notes;
      if (editingId) {
        await api.put(`/api/shift-schedules/${editingId}`, payload);
      } else {
        await api.post(`/api/staff/${id}/shift-schedules`, payload);
      }
      await load();
      // Reset edit state
      setEditingId('');
    } catch (e) {
      console.error(e);
      const msg = (e as any)?.response?.data?.error || (e as any)?.message || 'Failed to create schedule';
      setError(typeof msg === 'string' ? msg : 'Failed to create schedule');
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Shift Schedule</h1>
        <button className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>navigate(-1)}>Back</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Add Schedule</h2>
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}
          <form className="grid grid-cols-1 gap-3" onSubmit={onCreate}>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="radio" className="accent-blue-600" name="rec" checked={form.recurrence==='weekly'} onChange={()=>setForm({...form, recurrence:'weekly'})} />
                <span>Weekly</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" className="accent-blue-600" name="rec" checked={form.recurrence==='one_time'} onChange={()=>setForm({...form, recurrence:'one_time'})} />
                <span>One-time</span>
              </label>
            </div>

            {form.recurrence === 'weekly' ? (
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button type="button" key={d.v} onClick={()=>toggleDay(d.v)} className={`px-2.5 py-1 rounded-md border text-sm ${form.days.includes(d.v)? 'bg-blue-50 border-blue-400 text-blue-700':'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{d.l}</button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date From</label>
                  <input type="date" className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.effective_from} onChange={e=>setForm({...form, effective_from: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date To (optional)</label>
                  <input type="date" className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.effective_to} onChange={e=>setForm({...form, effective_to: e.target.value})} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start</label>
                <input type="time" className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.start_time} onChange={e=>setForm({...form, start_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End</label>
                <input type="time" className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.end_time} onChange={e=>setForm({...form, end_time: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Timezone</label>
                <input className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.timezone} onChange={e=>setForm({...form, timezone: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Store (optional)</label>
                <input className="h-10 w-full border border-gray-200 rounded-md px-3" placeholder="Store ID" value={form.store_id} onChange={e=>setForm({...form, store_id: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <input className="h-10 w-full border border-gray-200 rounded-md px-3" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} />
            </div>

            <div className="flex items-center justify-end gap-2">
              {editingId && (
                <button type="button" className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>{ setEditingId(''); }}>Cancel Edit</button>
              )}
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">{saving? 'Saving...' : editingId ? 'Save Changes' : 'Add'}</button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Schedules</h2>
          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-gray-500">No schedules</div>
          ) : (
            <ul className="space-y-2">
              {items.map(s => (
                <li key={s.id} className="flex items-center justify-between p-3 rounded-md border border-gray-100">
                  <div>
                    <div className="font-medium text-gray-900">
                      {s.recurrence === 'weekly' ? `Weekly: ${s.days?.map(d=>DAYS.find(x=>x.v===d)?.l).join(', ')}` : 'One-time'}
                    </div>
                    <div className="text-sm text-gray-600">{s.start_time} – {s.end_time} ({s.timezone})</div>
                    {s.effective_from && (
                      <div className="text-xs text-gray-500">From {s.effective_from}{s.effective_to? ` to ${s.effective_to}`:''}</div>
                    )}
                    {s.store_id && (
                      <div className="text-xs text-gray-500">Store: {s.store_id}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>{
                      setEditingId(s.id);
                      setForm({
                        recurrence: s.recurrence,
                        days: s.days || [],
                        start_time: s.start_time,
                        end_time: s.end_time,
                        timezone: s.timezone,
                        effective_from: s.effective_from || '',
                        effective_to: s.effective_to || '',
                        store_id: s.store_id || '',
                        notes: s.notes || '',
                      });
                      window.scrollTo({top: 0, behavior: 'smooth'});
                    }}>Edit</button>
                    <button className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={()=>onDelete(s.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffSchedulePage;
