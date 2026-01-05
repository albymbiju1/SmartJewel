import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

interface Booking {
    _id: string;
    rental_item_id: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    total_rental_price: number;
    security_deposit: number;
    total_amount: number;
    booking_status: string;
    payment_status: string;
    amount_paid: number;
    created_at: string;
    product: {
        _id: string;
        name: string;
        category: string;
        image: string;
    };
}

export const MyRentalsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (user) {
            fetchBookings();
        }
    }, [user, statusFilter]);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);

            const response = await api.get(`/api/rentals/bookings?${params.toString()}`);
            setBookings(response.data.bookings || []);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            confirmed: 'bg-blue-100 text-blue-800',
            active: 'bg-green-100 text-green-800',
            completed: 'bg-gray-100 text-gray-800',
            cancelled: 'bg-red-100 text-red-800',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
    };

    const getPaymentBadge = (status: string) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            partial: 'bg-orange-100 text-orange-800',
            paid: 'bg-green-100 text-green-800',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
    };

    if (loading && bookings.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Rental Bookings</h1>
                    <p className="text-gray-600 mt-1">View and manage your jewelry rentals</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setStatusFilter('')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === ''
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setStatusFilter('confirmed')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'confirmed'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Confirmed
                        </button>
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'active'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter('completed')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'completed'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Completed
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Bookings List */}
                {bookings.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <svg
                            className="mx-auto h-16 w-16 text-gray-400 mb-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Bookings Found</h3>
                        <p className="text-gray-600 mb-6">
                            {statusFilter ? `No ${statusFilter} bookings found.` : "You haven't made any rental bookings yet."}
                        </p>
                        <button
                            onClick={() => navigate('/rentals')}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                        >
                            Browse Rentals
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking) => (
                            <div
                                key={booking._id}
                                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => navigate(`/my-rentals/${booking._id}`)}
                            >
                                <div className="flex gap-6">
                                    {/* Image */}
                                    {booking.product?.image && (
                                        <img
                                            src={booking.product.image}
                                            alt={booking.product.name}
                                            className="w-32 h-32 object-cover rounded-lg"
                                        />
                                    )}

                                    {/* Details */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-xl font-semibold text-gray-900">
                                                    {booking.product?.name || 'Unknown Product'}
                                                </h3>
                                                <p className="text-sm text-gray-600 capitalize">
                                                    {booking.product?.category}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(booking.booking_status)}`}>
                                                    {booking.booking_status}
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentBadge(booking.payment_status)}`}>
                                                    {booking.payment_status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-600">Start Date</p>
                                                <p className="font-medium">
                                                    {new Date(booking.start_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">End Date</p>
                                                <p className="font-medium">
                                                    {new Date(booking.end_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">Duration</p>
                                                <p className="font-medium">{booking.duration_days} days</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">Total Amount</p>
                                                <p className="font-medium text-amber-600">
                                                    ₹{booking.total_amount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                                            <div className="text-sm">
                                                <span className="text-gray-600">Paid: </span>
                                                <span className="font-semibold">₹{booking.amount_paid.toLocaleString()}</span>
                                                {booking.amount_paid < booking.total_amount && (
                                                    <>
                                                        <span className="text-gray-600 mx-2">•</span>
                                                        <span className="text-gray-600">Remaining: </span>
                                                        <span className="font-semibold text-orange-600">
                                                            ₹{(booking.total_amount - booking.amount_paid).toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/my-rentals/${booking._id}`);
                                                }}
                                                className="text-amber-600 hover:text-amber-700 font-medium text-sm"
                                            >
                                                View Details →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyRentalsPage;
