import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Store {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  latitude?: number;
  longitude?: number;
  opening_hours?: string;
}

interface AppointmentForm {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
}

const FindStorePage: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [appointmentData, setAppointmentData] = useState<AppointmentForm>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    preferred_date: '',
    preferred_time: '',
    notes: '',
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const response = await api.get('/stores');
        setStores(response.data.stores || []);
      } catch (error: any) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  const filteredStores = stores.filter(store =>
    store.location.toLowerCase().includes(searchLocation.toLowerCase()) ||
    store.name.toLowerCase().includes(searchLocation.toLowerCase()) ||
    store.address.toLowerCase().includes(searchLocation.toLowerCase())
  );

  const handleAppointmentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAppointmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;

    setBookingSubmitting(true);
    try {
      await api.post(`/stores/${selectedStore.id}/book-appointment`, appointmentData);
      setBookingSuccess(true);
      setAppointmentData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        preferred_date: '',
        preferred_time: '',
        notes: '',
      });
      setTimeout(() => {
        setShowAppointmentForm(false);
        setBookingSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      alert('Failed to book appointment. Please try again.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const getGoogleMapsEmbedUrl = (store: Store) => {
    if (store.latitude && store.longitude) {
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3504.1234567890!2d${store.longitude}!3d${store.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${store.latitude}%2C${store.longitude}!5e0!3m2!1sen!2sin!4v1234567890`;
    }
    // Fallback to address-based search
    const encodedAddress = encodeURIComponent(store.address);
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3504.1234567890!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${encodedAddress}!2z!5e0!3m2!1sen!2sin!4v1234567890`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a Store</h1>
          <p className="text-gray-600">Visit our showrooms to experience the finest jewelry and book appointments</p>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by location, city, or store name..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Search
            </button>
          </div>
        </div>

        {/* Stores Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading stores...</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No stores found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredStores.map((store) => (
              <div key={store.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                {/* Map Preview */}
                {store.latitude && store.longitude && (
                  <div className="h-48 bg-gray-200 relative">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      src={getGoogleMapsEmbedUrl(store)}
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Map of ${store.name}`}
                    ></iframe>
                  </div>
                )}

                {/* Store Details */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{store.name}</h3>

                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">📍</span>
                      <span>{store.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-bold">📞</span>
                      <a href={`tel:${store.phone}`} className="text-blue-600 hover:text-blue-800">
                        {store.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-bold">✉️</span>
                      <a href={`mailto:${store.email}`} className="text-blue-600 hover:text-blue-800">
                        {store.email}
                      </a>
                    </div>
                    {store.opening_hours && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-bold">🕐</span>
                        <span>{store.opening_hours}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Location:</span> {store.location}
                    </p>
                    <div className="flex gap-2">
                      {store.latitude && store.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center"
                        >
                          Get Directions
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setSelectedStore(store);
                          setShowAppointmentForm(true);
                        }}
                        className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Booking Modal */}
      {showAppointmentForm && selectedStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Book Appointment at {selectedStore.name}
              </h3>
              <button
                onClick={() => {
                  setShowAppointmentForm(false);
                  setSelectedStore(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {bookingSuccess ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="text-green-600 text-2xl mb-2">✓</div>
                <p className="text-green-800 font-semibold">Appointment request submitted successfully!</p>
                <p className="text-green-700 text-sm mt-1">We'll confirm your appointment shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={appointmentData.customer_name}
                    onChange={handleAppointmentChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="customer_email"
                    value={appointmentData.customer_email}
                    onChange={handleAppointmentChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={appointmentData.customer_phone}
                    onChange={handleAppointmentChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Your phone number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      name="preferred_date"
                      value={appointmentData.preferred_date}
                      onChange={handleAppointmentChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Time *
                    </label>
                    <input
                      type="time"
                      name="preferred_time"
                      value={appointmentData.preferred_time}
                      onChange={handleAppointmentChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={appointmentData.notes}
                    onChange={handleAppointmentChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Tell us what you're interested in (e.g., engagement rings, pendants, etc.)"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAppointmentForm(false);
                      setSelectedStore(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bookingSubmitting ? 'Submitting...' : 'Book Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="bg-gray-100 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>Can't find what you're looking for? <a href="/products" className="text-amber-600 hover:text-amber-700 font-semibold">Shop online</a> instead.</p>
        </div>
      </div>
    </div>
  );
};

export default FindStorePage;