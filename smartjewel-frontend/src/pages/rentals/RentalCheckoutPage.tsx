import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api';
import Navbar from '../../components/Navbar';

export const RentalCheckoutPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const { bookingId, rentalItem, startDate, endDate, duration, totalPrice } = location.state || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load Razorpay script
        if (window.Razorpay) return;
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.async = true;
        document.body.appendChild(s);
    }, []);

    useEffect(() => {
        if (!bookingId || !rentalItem) {
            navigate('/rentals');
        }
    }, [bookingId, rentalItem, navigate]);

    const handlePayment = async () => {
        if (!bookingId || !rentalItem || !user) return;

        try {
            setLoading(true);
            setError(null);

            // Create Razorpay order
            const orderResponse = await api.post('/payments/api/create-order', {
                amount: Math.round(totalPrice),
                currency: 'INR',
                customer: {
                    name: user.full_name || user.email,
                    email: user.email,
                    phone: user.phone_number || '',
                },
                items: [{
                    id: rentalItem.product_id,
                    name: `Rental: ${rentalItem.product.name}`,
                    qty: 1,
                    price: totalPrice
                }],
                booking_type: 'rental',
                booking_id: bookingId
            });

            const { order, key_id } = orderResponse.data;

            if (!order?.id || !key_id) throw new Error('Failed to initiate payment');

            // Open Razorpay checkout
            if (!window.Razorpay) throw new Error('Razorpay SDK not loaded');

            const rzp = new window.Razorpay({
                key: key_id,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency || 'INR',
                name: 'SmartJewel',
                description: `Rental Booking: ${rentalItem.product.name}`,
                prefill: {
                    name: user.full_name || user.email,
                    email: user.email,
                    contact: user.phone_number || ''
                },
                notes: {
                    booking_id: bookingId,
                    start_date: startDate,
                    end_date: endDate,
                    type: 'rental'
                },
                theme: { color: '#b45309' },
                method: { upi: true, card: true, netbanking: true, wallet: true },
                handler: async (response) => {
                    try {
                        // Verify payment
                        const verify = await api.post('/payments/razorpay/verify', {
                            ...response,
                            booking_id: bookingId,
                            booking_type: 'rental'
                        });

                        // Navigate to success page
                        navigate('/rental-booking-success', {
                            state: {
                                bookingId,
                                rentalItem,
                                startDate,
                                endDate,
                                totalPrice
                            }
                        });
                    } catch (e: any) {
                        const msg = e?.response?.data?.error || e?.message || 'Payment verification failed';
                        setError(String(msg));
                    }
                },
                modal: {
                    ondismiss: () => {
                        setError('Payment cancelled. You can try again.');
                        setLoading(false);
                    }
                }
            });

            (rzp as any).on?.('payment.failed', (resp: any) => {
                const desc = resp?.error?.description || resp?.error?.reason || 'Payment failed';
                setError(desc);
                setLoading(false);
            });

            rzp.open();
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || 'Failed to process payment');
        } finally {
            setLoading(false);
        }
    };

    if (!rentalItem || !bookingId) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <Navbar />

            <div className="container mx-auto px-6 py-10">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">Complete Your Rental Booking</h1>
                        <p className="text-gray-600 mt-1">Review and pay for your rental booking</p>
                    </div>

                    {/* Booking Summary */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Summary</h2>

                        {/* Item */}
                        <div className="flex gap-4 mb-6">
                            {rentalItem.product.image && (
                                <img
                                    src={rentalItem.product.image}
                                    alt={rentalItem.product.name}
                                    className="w-24 h-24 object-cover rounded-lg"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{rentalItem.product.name}</h3>
                                <p className="text-sm text-gray-600 capitalize">{rentalItem.product.category}</p>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Start Date</span>
                                <span className="font-medium">{new Date(startDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">End Date</span>
                                <span className="font-medium">{new Date(endDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Duration</span>
                                <span className="font-medium">{duration} day{duration > 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-2 border-t pt-4 mt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Rental Cost</span>
                                <span>₹{(duration * rentalItem.rental_price_per_day).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Security Deposit</span>
                                <span>₹{rentalItem.security_deposit.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-semibold text-gray-900">Total Amount</span>
                                <span className="text-xl font-bold text-amber-600">₹{totalPrice.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * Deposit refunded after item return
                            </p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Payment Button */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <button
                            onClick={handlePayment}
                            disabled={loading}
                            className={`w-full px-6 py-4 rounded-lg text-white font-semibold text-lg transition-colors ${loading
                                    ? 'bg-amber-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg'
                                }`}
                        >
                            {loading ? 'Processing...' : `Pay ₹${totalPrice.toLocaleString()}`}
                        </button>
                        <p className="text-xs text-gray-500 mt-3 text-center">
                            Secure payment via Razorpay | Test Mode
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RentalCheckoutPage;
