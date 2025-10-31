import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { RoleBasedNavigation } from '../../components/RoleBasedNavigation';

interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: string;
  created_at: string;
}

export const StoreAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch appointments from the store manager endpoint
        const response = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
        setAppointments(response.data.appointments);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  const handleApproveAppointment = async (appointmentId: string) => {
    try {
      await api.patch(`/api/store-manager/appointments/${appointmentId}/approve`, { notes: 'Approved by store manager' });
      // Refresh the appointments list
      const response = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
      setAppointments(response.data.appointments);
    } catch (err) {
      console.error('Failed to approve appointment:', err);
    }
  };

  const handleRejectAppointment = async (appointmentId: string) => {
    try {
      await api.patch(`/api/store-manager/appointments/${appointmentId}/reject`, { notes: 'Rejected by store manager' });
      // Refresh the appointments list
      const response = await api.get<{appointments: Appointment[]}>('/api/store-manager/appointments');
      setAppointments(response.data.appointments);
    } catch (err) {
      console.error('Failed to reject appointment:', err);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RoleBasedNavigation>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Appointment Requests</h1>
            <p className="text-gray-600 mt-2">Manage customer appointment requests for your store</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">All Appointments</h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-900">{appointment.customer_name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(appointment.status)}`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Email:</span> {appointment.customer_email}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Phone:</span> {appointment.customer_phone}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Date:</span> {appointment.preferred_date} at {appointment.preferred_time}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Requested:</span> {formatDate(appointment.created_at)}
                              </p>
                            </div>
                          </div>
                          {appointment.notes && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Notes:</span> {appointment.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {appointment.status === 'pending' && (
                        <div className="flex space-x-2 mt-4">
                          <button
                            onClick={() => handleApproveAppointment(appointment.id)}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectAppointment(appointment.id)}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments</h3>
                  <p className="mt-1 text-sm text-gray-500">There are no appointment requests at the moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleBasedNavigation>
  );
};

export default StoreAppointmentsPage;