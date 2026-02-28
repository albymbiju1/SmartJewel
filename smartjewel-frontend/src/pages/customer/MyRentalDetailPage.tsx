import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

interface BookingDetail {
    _id: string;
    rental_item_id: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    rental_price_per_day: number;
    total_rental_price: number;
    security_deposit: number;
    late_fee: number;
    damage_charge: number;
    total_amount: number;
    booking_status: string;
    payment_status: string;
    amount_paid: number;
    deposit_refunded: boolean;
    actual_pickup_date?: string;
    actual_return_date?: string;
    condition_at_pickup?: string;
    condition_at_return?: string;
    damage_notes?: string;
    notes?: string;
    created_at: string;
    // Refund fields
    refund_status?: string;
    refund_id?: string;
    refund_amount?: number;
    cancellation_charge?: number;
    refund_initiated_at?: string;
    refund_settle_date?: string;
    refund_settled_at?: string;
    refund_error?: string;
    product: {
        _id: string;
        name: string;
        category: string;
        image: string;
        metal?: string;
        purity?: string;
        weight?: number;
    };
}

export const MyRentalDetailPage: React.FC = () => {
    const { bookingId } = useParams<{ bookingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (bookingId) {
            fetchBookingDetails();
        }
    }, [bookingId]);

    const fetchBookingDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/rentals/bookings/${bookingId}`);
            setBooking(response.data.booking);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load booking details');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        if (!booking || !window.confirm('Are you sure you want to cancel this booking? A 5% cancellation charge will apply.')) return;

        try {
            setCancelling(true);
            const response = await api.put(`/api/rentals/bookings/${bookingId}/cancel`, {
                reason: 'Customer cancelled'
            });

            await fetchBookingDetails(); // Refresh data

            // Show refund details if applicable
            if (response.data.refund_details) {
                const { refund_amount, cancellation_charge, original_amount } = response.data.refund_details;
                alert(
                    `Booking cancelled successfully!\n\n` +
                    `Original Amount: ₹${original_amount.toLocaleString()}\n` +
                    `Cancellation Charge (5%): ₹${cancellation_charge.toLocaleString()}\n` +
                    `Refund Amount (95%): ₹${refund_amount.toLocaleString()}\n\n` +
                    `The refund will be processed to your original payment method within 5-7 business days.`
                );
            } else {
                alert('Booking cancelled successfully');
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to cancel booking');
        } finally {
            setCancelling(false);
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
            refunded: 'bg-purple-100 text-purple-800',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
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

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="container mx-auto px-6 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error || 'Booking not found'}
                    </div>
                    <button
                        onClick={() => navigate('/my-rentals')}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to My Rentals
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="container mx-auto px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6 text-sm">
                    <button
                        onClick={() => navigate('/my-rentals')}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                        ← Back to My Rentals
                    </button>
                </nav>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
                    <p className="text-gray-600 mt-1">Booking ID: {booking._id}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Product Info */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Details</h2>
                            <div className="flex gap-6">
                                {booking.product?.image && (
                                    <img
                                        src={booking.product.image}
                                        alt={booking.product.name}
                                        className="w-32 h-32 object-cover rounded-lg"
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {booking.product?.name}
                                    </h3>
                                    <p className="text-gray-600 capitalize mb-2">{booking.product?.category}</p>
                                    {booking.product?.metal && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Metal:</span> {booking.product.metal}
                                            {booking.product.purity && ` (${booking.product.purity})`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Booking Timeline */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Timeline</h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 ${booking.booking_status !== 'cancelled' ? 'bg-green-500' : 'bg-gray-300'
                                        }`}></div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">Booking Confirmed</p>
                                        <p className="text-sm text-gray-600">
                                            {new Date(booking.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {booking.actual_pickup_date && (
                                    <div className="flex items-start gap-4">
                                        <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">Item Picked Up</p>
                                            <p className="text-sm text-gray-600">
                                                {new Date(booking.actual_pickup_date).toLocaleString()}
                                            </p>
                                            {booking.condition_at_pickup && (
                                                <p className="text-sm text-gray-600">
                                                    Condition: <span className="capitalize">{booking.condition_at_pickup}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {booking.actual_return_date && (
                                    <div className="flex items-start gap-4">
                                        <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">Item Returned</p>
                                            <p className="text-sm text-gray-600">
                                                {new Date(booking.actual_return_date).toLocaleString()}
                                            </p>
                                            {booking.condition_at_return && (
                                                <p className="text-sm text-gray-600">
                                                    Condition: <span className="capitalize">{booking.condition_at_return}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {booking.booking_status === 'cancelled' && (
                                    <div className="flex items-start gap-4">
                                        <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">Booking Cancelled</p>
                                            {booking.notes && (
                                                <p className="text-sm text-gray-600">{booking.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Additional Info */}
                        {(booking.damage_notes || booking.notes) && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
                                {booking.damage_notes && (
                                    <div className="mb-3">
                                        <p className="font-medium text-gray-900">Damage Notes:</p>
                                        <p className="text-gray-600">{booking.damage_notes}</p>
                                    </div>
                                )}
                                {booking.notes && (
                                    <div>
                                        <p className="font-medium text-gray-900">Notes:</p>
                                        <p className="text-gray-600">{booking.notes}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Status Card */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Booking Status</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(booking.booking_status)}`}>
                                        {booking.booking_status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Payment Status</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentBadge(booking.payment_status)}`}>
                                        {booking.payment_status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Rental Period */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rental Period</h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Start Date</span>
                                    <span className="font-medium">
                                        {new Date(booking.start_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">End Date</span>
                                    <span className="font-medium">
                                        {new Date(booking.end_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Duration</span>
                                    <span className="font-medium">{booking.duration_days} days</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Rental Cost</span>
                                    <span>₹{booking.total_rental_price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Security Deposit</span>
                                    <span>₹{booking.security_deposit.toLocaleString()}</span>
                                </div>
                                {booking.late_fee > 0 && (
                                    <div className="flex justify-between text-orange-600">
                                        <span>Late Fee</span>
                                        <span>₹{booking.late_fee.toLocaleString()}</span>
                                    </div>
                                )}
                                {booking.damage_charge > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Damage Charge</span>
                                        <span>₹{booking.damage_charge.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="border-t pt-2 flex justify-between font-semibold">
                                    <span className="text-gray-900">Total Amount</span>
                                    <span className="text-amber-600">₹{booking.total_amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-green-600 font-medium">
                                    <span>Amount Paid</span>
                                    <span>₹{booking.amount_paid.toLocaleString()}</span>
                                </div>
                                {booking.amount_paid < booking.total_amount && (
                                    <div className="flex justify-between text-orange-600 font-medium">
                                        <span>Remaining</span>
                                        <span>₹{(booking.total_amount - booking.amount_paid).toLocaleString()}</span>
                                    </div>
                                )}
                                {booking.deposit_refunded && (
                                    <p className="text-sm text-green-600 mt-2">✓ Deposit refunded</p>
                                )}
                            </div>
                        </div>

                        {/* Refund Information */}
                        {booking.booking_status === 'cancelled' && booking.refund_amount && booking.refund_amount > 0 && (() => {
                            const isSettled = booking.refund_status === 'settled';
                            const isCompleted = booking.refund_status === 'completed';
                            const isFailed = booking.refund_status === 'failed';

                            if (isSettled) {
                                return (
                                    <div className="bg-amber-50 rounded-lg shadow-sm p-6 border border-amber-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <h2 className="text-lg font-semibold text-amber-900">Money Credited ✓</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-700">
                                                <span>Original Amount</span>
                                                <span className="font-medium">₹{booking.amount_paid.toLocaleString()}</span>
                                            </div>
                                            {booking.cancellation_charge && (
                                                <div className="flex justify-between text-orange-700">
                                                    <span>Cancellation Charge (5%)</span>
                                                    <span>-₹{booking.cancellation_charge.toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-amber-800 text-base">
                                                <span>Refunded to Account</span>
                                                <span>₹{booking.refund_amount.toLocaleString()}</span>
                                            </div>
                                            {booking.refund_id && (
                                                <p className="text-xs text-amber-700 pt-1">
                                                    Refund ID: <span className="font-mono">{booking.refund_id}</span>
                                                </p>
                                            )}
                                            {booking.refund_settled_at && (
                                                <p className="text-xs text-amber-700">
                                                    Settled on: {new Date(booking.refund_settled_at).toLocaleDateString()}
                                                </p>
                                            )}
                                            <div className="mt-3 bg-amber-100 rounded-lg px-3 py-2">
                                                <p className="text-xs text-amber-800 font-medium">
                                                    💰 ₹{booking.refund_amount.toLocaleString()} has been credited to your original payment method.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            if (isCompleted) {
                                return (
                                    <div className="bg-green-50 rounded-lg shadow-sm p-6 border border-green-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <h2 className="text-lg font-semibold text-green-900">Refund Initiated ✓</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-700">
                                                <span>Original Amount</span>
                                                <span className="font-medium">₹{booking.amount_paid.toLocaleString()}</span>
                                            </div>
                                            {booking.cancellation_charge && (
                                                <div className="flex justify-between text-orange-700">
                                                    <span>Cancellation Charge (5%)</span>
                                                    <span>-₹{booking.cancellation_charge.toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-green-200 pt-2 flex justify-between font-bold text-green-800 text-base">
                                                <span>Refund Amount</span>
                                                <span>₹{booking.refund_amount.toLocaleString()}</span>
                                            </div>
                                            {booking.refund_id && (
                                                <p className="text-xs text-green-700 pt-1">
                                                    Refund ID: <span className="font-mono">{booking.refund_id}</span>
                                                </p>
                                            )}
                                            <div className="mt-3 bg-green-100 rounded-lg px-3 py-2">
                                                <p className="text-xs text-green-800 font-medium">
                                                    ✅ Your refund has been successfully processed. It will reflect in your account within 5-7 business days depending on your bank.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            if (isFailed) {
                                return (
                                    <div className="bg-red-50 rounded-lg shadow-sm p-6 border border-red-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <h2 className="text-lg font-semibold text-red-900">Refund Failed</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-700">
                                                <span>Refund Amount Due</span>
                                                <span className="font-medium">₹{booking.refund_amount.toLocaleString()}</span>
                                            </div>
                                            <div className="mt-3 bg-red-100 rounded-lg px-3 py-2">
                                                <p className="text-xs text-red-800 font-medium">
                                                    ⚠️ We encountered an issue processing your refund. Please contact support with your Booking ID for manual assistance.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Pending / processing
                            return (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                        <h2 className="text-lg font-semibold text-blue-900">Refund Processing…</h2>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-blue-800">
                                            <span>Original Amount</span>
                                            <span className="font-medium">₹{booking.amount_paid.toLocaleString()}</span>
                                        </div>
                                        {booking.cancellation_charge && (
                                            <div className="flex justify-between text-orange-700">
                                                <span>Cancellation Charge (5%)</span>
                                                <span>-₹{booking.cancellation_charge.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-blue-200 pt-2 flex justify-between font-semibold text-green-700">
                                            <span>Refund Amount (95%)</span>
                                            <span>₹{booking.refund_amount.toLocaleString()}</span>
                                        </div>
                                        {booking.refund_id && (
                                            <p className="text-xs text-blue-700 pt-1">
                                                Refund ID: <span className="font-mono">{booking.refund_id}</span>
                                            </p>
                                        )}
                                        <div className="mt-3 bg-blue-100 rounded-lg px-3 py-2">
                                            <p className="text-xs text-blue-800">
                                                ⏳ Your refund is being processed. It will be credited to your original payment method within 5-7 business days.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Actions */}
                        {booking.booking_status === 'confirmed' && (
                            <button
                                onClick={handleCancelBooking}
                                disabled={cancelling}
                                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-red-300"
                            >
                                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyRentalDetailPage;
