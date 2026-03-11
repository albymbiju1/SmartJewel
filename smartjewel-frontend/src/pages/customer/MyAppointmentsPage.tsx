import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

interface Appointment {
  id: string;
  store_name: string;
  customer_name: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Review',
    class: 'bg-amber-100 text-amber-800',
    icon: '🕐',
    description: 'Your appointment request is waiting for store confirmation.',
  },
  approved: {
    label: 'Approved',
    class: 'bg-green-100 text-green-800',
    icon: '✅',
    description: 'Your appointment has been confirmed! Please arrive on time.',
  },
  rejected: {
    label: 'Rejected',
    class: 'bg-red-100 text-red-800',
    icon: '❌',
    description: 'Unfortunately this slot is unavailable. Please book another time.',
  },
};

const MyAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  // Auto-fetch if logged in
  useEffect(() => {
    if (user?.email) {
      setSearchEmail(user.email);
      fetchAppointments(user.email);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchAppointments = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/stores/my-appointments?email=${encodeURIComponent(email)}`);
      setAppointments(res.data.appointments || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestEmail.trim()) {
      setSearchEmail(guestEmail.trim());
      fetchAppointments(guestEmail.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '—';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600 mt-1">Track your store visit appointment requests</p>
        </div>

        {/* Guest email lookup (show only if not logged in) */}
        {!user && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              🔍 Look up your appointments
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter the email address you used when booking your appointment.
            </p>
            <form onSubmit={handleGuestSearch} className="flex gap-3">
              <input
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Not searched yet (guest) */}
        {!loading && !error && !searchEmail && !user && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <span className="text-5xl mb-4 block">📅</span>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Find Your Appointment</h3>
            <p className="text-gray-500 text-sm">Enter your email above to view your appointment requests.</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && searchEmail && appointments.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <span className="text-5xl mb-4 block">📭</span>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Appointments Found</h3>
            <p className="text-gray-500 text-sm mb-6">
              No appointment requests found for <strong>{searchEmail}</strong>.
            </p>
            <button
              onClick={() => navigate('/find-store')}
              className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
            >
              Book an Appointment
            </button>
          </div>
        )}

        {/* Appointments list */}
        {!loading && appointments.length > 0 && (
          <div className="space-y-4">
            {appointments.map((appt) => {
              const status = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={appt.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Status bar */}
                  <div className={`h-1.5 w-full ${
                    appt.status === 'approved' ? 'bg-green-500' :
                    appt.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />

                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      {/* Store & customer */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {appt.store_name || 'SmartJewel Store'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Booked for <span className="font-medium text-gray-700">{appt.customer_name}</span>
                        </p>
                      </div>

                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${status.class}`}>
                        <span>{status.icon}</span>
                        {status.label}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Preferred Date</p>
                        <p className="font-medium text-gray-800">{formatDate(appt.preferred_date)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Preferred Time</p>
                        <p className="font-medium text-gray-800">{formatTime(appt.preferred_time)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-medium mb-1">Requested On</p>
                        <p className="font-medium text-gray-800">{formatDate(appt.created_at)}</p>
                      </div>
                    </div>

                    {/* Notes */}
                    {appt.notes && (
                      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 mb-4">
                        <span className="font-medium text-gray-700">Notes: </span>{appt.notes}
                      </div>
                    )}

                    {/* Status message */}
                    <div className={`text-xs rounded-lg px-4 py-2.5 flex items-center gap-2 ${
                      appt.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                      appt.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      <span>{status.description}</span>
                      {appt.status === 'rejected' && (
                        <button
                          onClick={() => navigate('/find-store')}
                          className="ml-auto font-semibold underline underline-offset-2 whitespace-nowrap hover:no-underline"
                        >
                          Book Again →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom CTA */}
            <div className="text-center pt-2">
              <button
                onClick={() => navigate('/find-store')}
                className="text-amber-600 hover:text-amber-700 text-sm font-medium underline underline-offset-2"
              >
                + Book Another Appointment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAppointmentsPage;
