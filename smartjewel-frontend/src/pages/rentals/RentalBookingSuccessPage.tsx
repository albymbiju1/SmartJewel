import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export const RentalBookingSuccessPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { bookingId, rentalItem, startDate, endDate, totalPrice } = location.state || {};

    useEffect(() => {
        if (!bookingId) {
            navigate('/rentals');
        }
    }, [bookingId, navigate]);

    if (!bookingId || !rentalItem) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
            <Navbar />

            <div className="container mx-auto px-6 py-16">
                <div className="max-w-2xl mx-auto">
                    {/* Success Icon */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                            <svg
                                className="w-12 h-12 text-green-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Booking Confirmed!
                        </h1>
                        <p className="text-gray-600">
                            Your rental booking has been successfully confirmed and payment received
                        </p>
                    </div>

                    {/* Booking Summary */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">Booking Details</h2>

                        {/* Product */}
                        <div className="flex gap-4 mb-6 pb-6 border-b">
                            {rentalItem.product?.image && (
                                <img
                                    src={rentalItem.product.image}
                                    alt={rentalItem.product.name}
                                    className="w-24 h-24 object-cover rounded-lg"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-gray-900">
                                    {rentalItem.product?.name}
                                </h3>
                                <p className="text-gray-600 capitalize">
                                    {rentalItem.product?.category}
                                </p>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="space-y-3 mb-6 pb-6 border-b">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Booking ID</span>
                                <span className="font-medium font-mono text-sm">{bookingId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Rental Period</span>
                                <span className="font-medium">
                                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Paid</span>
                                <span className="text-2xl font-bold text-green-600">
                                    ₹{totalPrice?.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Next Steps */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Next Steps
                            </h3>
                            <ul className="text-sm text-blue-800 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>You'll receive a confirmation email shortly with pickup instructions</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>Visit our store on or before your start date to collect the item</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>Bring a valid ID proof and this booking confirmation</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>Security deposit will be refunded after item return in good condition</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => navigate('/my-rentals')}
                            className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-md"
                        >
                            View My Bookings
                        </button>
                        <button
                            onClick={() => navigate('/rentals')}
                            className="flex-1 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Browse More Rentals
                        </button>
                    </div>

                    {/* Support */}
                    <div className="mt-8 text-center text-sm text-gray-600">
                        <p>Need help? Contact us at <a href="mailto:support@smartjewel.com" className="text-amber-600 hover:text-amber-700 font-medium">support@smartjewel.com</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RentalBookingSuccessPage;
