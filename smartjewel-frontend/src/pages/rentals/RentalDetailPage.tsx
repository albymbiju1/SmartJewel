import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

interface RentalDetail {
    _id: string;
    product_id: string;
    rental_price_per_day: number;
    security_deposit: number;
    status: string;
    min_rental_days?: number;
    max_rental_days?: number;
    product: {
        _id: string;
        name: string;
        category: string;
        image: string;
        description?: string;
        metal?: string;
        purity?: string;
        weight?: number;
        weight_unit?: string;
    };
}

export const RentalDetailPage: React.FC = () => {
    const { rentalItemId } = useParams<{ rentalItemId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rental, setRental] = useState<RentalDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showBookingModal, setShowBookingModal] = useState(false);

    // Booking state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [duration, setDuration] = useState(0);
    const [totalPrice, setTotalPrice] = useState(0);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (rentalItemId) {
            fetchRentalDetail();
        }
    }, [rentalItemId]);

    // Calculate duration and price when dates change
    useEffect(() => {
        if (startDate && endDate && rental) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            if (days > 0) {
                setDuration(days);
                setTotalPrice(days * rental.rental_price_per_day + rental.security_deposit);
            } else {
                setDuration(0);
                setTotalPrice(0);
            }
        }
    }, [startDate, endDate, rental]);

    const fetchRentalDetail = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rentals/${rentalItemId}`
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Rental item not found');
                }
                throw new Error('Failed to fetch rental details');
            }

            const data = await response.json();
            setRental(data);
            setError(null);

            // Set default dates (tomorrow to day after)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 2);

            setStartDate(tomorrow.toISOString().split('T')[0]);
            setEndDate(dayAfter.toISOString().split('T')[0]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToRent = () => {
        if (!user) {
            localStorage.setItem('redirectAfterLogin', window.location.pathname);
            navigate('/login');
        } else {
            setShowBookingModal(true);
        }
    };

    const handleCreateBooking = async () => {
        if (!rental || !startDate || !endDate) return;

        try {
            setSubmitting(true);
            setBookingError(null);

            // Create booking
            const response = await api.post('/api/rentals/bookings', {
                rental_item_id: rental._id,
                start_date: startDate,
                end_date: endDate
            });

            const booking = response.data.booking;

            // Redirect to payment
            navigate('/rental-checkout', {
                state: {
                    bookingId: booking._id,
                    rentalItem: rental,
                    startDate,
                    endDate,
                    duration,
                    totalPrice
                }
            });
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to create booking';
            setBookingError(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const getTodayDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getMaxDate = () => {
        const today = new Date();
        const maxDays = rental?.max_rental_days || 30;
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 90); // 90 days advance booking
        return maxDate.toISOString().split('T')[0];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                </div>
            </div>
        );
    }

    if (error || !rental) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error || 'Rental item not found'}
                    </div>
                    <button
                        onClick={() => navigate('/rentals')}
                        className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to Rentals
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6 text-sm">
                    <button
                        onClick={() => navigate('/rentals')}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to Rentals
                    </button>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Image Gallery */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="aspect-square bg-gray-100 relative">
                            {rental.product.image ? (
                                <img
                                    src={rental.product.image}
                                    alt={rental.product.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full font-medium text-sm">
                                For Rent
                            </div>
                            {rental.status === 'available' && (
                                <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full font-medium text-sm">
                                    Available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{rental.product.name}</h1>
                            <p className="text-lg text-gray-600 capitalize">{rental.product.category}</p>
                        </div>

                        {/* Rental Pricing */}
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rental Information</h2>

                            <div className="flex justify-between items-center py-3 border-b border-gray-200">
                                <span className="text-gray-700">Rental Price (per day)</span>
                                <span className="text-2xl font-bold text-amber-600">₹{rental.rental_price_per_day.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center py-3 border-b border-gray-200">
                                <span className="text-gray-700">Security Deposit</span>
                                <span className="text-xl font-semibold text-gray-900">₹{rental.security_deposit.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center py-3">
                                <span className="text-gray-700">Status</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${rental.status === 'available'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
                                </span>
                            </div>
                        </div>

                        {/* Product Specifications */}
                        {(rental.product.metal || rental.product.purity || rental.product.weight) && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Specifications</h2>
                                <div className="space-y-3">
                                    {rental.product.metal && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Metal</span>
                                            <span className="font-medium text-gray-900 capitalize">{rental.product.metal}</span>
                                        </div>
                                    )}
                                    {rental.product.purity && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Purity</span>
                                            <span className="font-medium text-gray-900">{rental.product.purity}</span>
                                        </div>
                                    )}
                                    {rental.product.weight && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Weight</span>
                                            <span className="font-medium text-gray-900">
                                                {rental.product.weight} {rental.product.weight_unit || 'g'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {rental.product.description && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
                                <p className="text-gray-700 leading-relaxed">{rental.product.description}</p>
                            </div>
                        )}

                        {/* Action Button */}
                        <div className="sticky bottom-0 bg-white rounded-lg shadow-sm p-6">
                            <button
                                onClick={handleProceedToRent}
                                disabled={rental.status !== 'available'}
                                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors duration-200 ${rental.status === 'available'
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {rental.status === 'available'
                                    ? (user ? 'Proceed to Rent' : 'Login to Rent')
                                    : 'Currently Unavailable'}
                            </button>
                            {!user && rental.status === 'available' && (
                                <p className="text-sm text-gray-600 text-center mt-2">
                                    You need to login to proceed with rental
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
                            <h2 className="text-2xl font-bold text-gray-900">Book Rental</h2>
                            <p className="text-sm text-gray-600 mt-1">{rental.product.name}</p>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Date Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        min={getTodayDate()}
                                        max={getMaxDate()}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate || getTodayDate()}
                                        max={getMaxDate()}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            {duration > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <h3 className="font-semibold text-gray-900 mb-3">Price Breakdown</h3>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Duration</span>
                                        <span className="font-medium">{duration} day{duration > 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Rental Cost</span>
                                        <span className="font-medium">₹{(duration * rental.rental_price_per_day).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Security Deposit</span>
                                        <span className="font-medium">₹{rental.security_deposit.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-gray-900">Total Amount</span>
                                            <span className="text-xl font-bold text-amber-600">₹{totalPrice.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        * Security deposit will be refunded after return
                                    </p>
                                </div>
                            )}

                            {/* Error Message / KYC Required */}
                            {bookingError && (
                                <div className={`border rounded-lg px-4 py-4 ${bookingError.toLowerCase().includes('kyc')
                                        ? 'bg-amber-50 border-amber-200'
                                        : 'bg-red-50 border-red-200'
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {bookingError.toLowerCase().includes('kyc') ? (
                                                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-medium ${bookingError.toLowerCase().includes('kyc')
                                                    ? 'text-amber-800'
                                                    : 'text-red-800'
                                                }`}>
                                                {bookingError}
                                            </p>
                                            {bookingError.toLowerCase().includes('kyc') && (
                                                <button
                                                    onClick={() => navigate('/profile/kyc')}
                                                    className="mt-3 inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Upload KYC Documents
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> You'll be redirected to payment after confirming your booking dates.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowBookingModal(false)}
                                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateBooking}
                                disabled={!duration || duration < (rental.min_rental_days || 1) || submitting}
                                className={`px-5 py-2.5 rounded-lg font-medium transition-all ${duration && duration >= (rental.min_rental_days || 1) && !submitting
                                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {submitting ? 'Creating...' : 'Confirm & Pay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RentalDetailPage;
